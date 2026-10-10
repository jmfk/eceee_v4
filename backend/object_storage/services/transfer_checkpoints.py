"""Destination-owned checkpoints for bounded object-package imports."""

import hashlib
import json
import logging
import os
import tempfile
import uuid
from contextlib import ExitStack, contextmanager

from django.core.files import File
from django.core.serializers.json import DjangoJSONEncoder
from django.db import connection, models, transaction
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify

from content.models import Namespace
from file_manager.models import MediaCollection, MediaFile, MediaTag, MediaUsage
from file_manager.storage import checkpoint_storage
from file_manager.storage import storage as media_storage
from file_manager.storage import system_storage
from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion, TransferCheckpoint
from taxonomy.models import Tag as TaxonomyTag

logger = logging.getLogger(__name__)


class PostRestoreCleanupError(RuntimeError):
    """The database restore committed, but superseded binary cleanup must retry."""


@contextmanager
def transfer_advisory_lock(key):
    """Hold a PostgreSQL session advisory lock for a stable string key."""
    if connection.vendor != "postgresql":
        yield
        return
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_lock(hashtextextended(%s, 0))", [str(key)])
    try:
        yield
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_unlock(hashtextextended(%s, 0))", [str(key)])


def tenant_transfer_lock(tenant_id):
    """Serialize two-phase transfer operations and tenant JSON-reference writes."""
    return transfer_advisory_lock(f"object-transfer:{tenant_id}")


def reference_write_barrier():
    """Block cross-tenant JSON-reference writes while restore validates/deletes."""
    return transfer_advisory_lock("object-reference-write")


def object_type_transfer_lock(object_type_id):
    """Serialize storage and database changes to a shared object type."""
    return transfer_advisory_lock(f"object-type-transfer:{object_type_id}")


@contextmanager
def object_type_name_transfer_locks(names):
    """Serialize lookup-or-create decisions for globally named object types."""
    with ExitStack() as stack:
        for name in sorted({str(value) for value in names if value}):
            stack.enter_context(transfer_advisory_lock(f"object-type-name-transfer:{name}"))
        yield


@contextmanager
def media_content_transfer_locks(file_hashes):
    """Serialize lookup-or-create decisions for imported media content."""
    with ExitStack() as stack:
        for file_hash in sorted({str(value) for value in file_hashes if value}):
            stack.enter_context(transfer_advisory_lock(f"media-content-transfer:{file_hash}"))
        yield


@contextmanager
def object_type_transfer_locks(object_type_ids):
    """Acquire object-type locks in deterministic order to avoid deadlocks."""
    with ExitStack() as stack:
        for object_type_id in sorted({int(value) for value in object_type_ids}):
            stack.enter_context(object_type_transfer_lock(object_type_id))
        yield


@contextmanager
def type_icon_path_locks(paths):
    """Serialize ownership checks and deletion of shared content-addressed icons."""
    with ExitStack() as stack:
        for path in sorted({str(value) for value in paths if value}):
            stack.enter_context(transfer_advisory_lock(f"type-icon-path:{path}"))
        yield


def begin_serializable_transfer():
    """Use predicate-conflict detection instead of cross-tenant table locks."""
    if connection.vendor != "postgresql":
        return
    atomic_blocks = getattr(connection, "atomic_blocks", [])
    if any(getattr(block, "_from_testcase", False) for block in atomic_blocks):
        return
    if len(atomic_blocks) != 1:
        raise RuntimeError("Transfer mutation must start in its own outer database transaction.")
    with connection.cursor() as cursor:
        cursor.execute("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE")


def _string_ids(queryset):
    return [str(value) for value in queryset.values_list("id", flat=True)]


def _datetime(value):
    return value.isoformat() if value else None


def _existing_media(tenant, file_hash):
    existing = MediaFile.objects.with_deleted().filter(tenant=tenant, file_hash=file_hash).first()
    if existing:
        return existing
    if MediaFile.objects.with_deleted().filter(file_hash=file_hash).exclude(tenant=tenant).exists():
        tenant_hash = hashlib.sha256(f"{file_hash}:{tenant.id}".encode()).hexdigest()
        return MediaFile.objects.with_deleted().filter(tenant=tenant, file_hash=tenant_hash).first()
    return None


def _type_snapshot(obj_type):
    return {
        "id": obj_type.id,
        "name": obj_type.name,
        "label": obj_type.label,
        "plural_label": obj_type.plural_label,
        "description": obj_type.description,
        "schema": obj_type.schema,
        "slot_configuration": obj_type.slot_configuration,
        "hierarchy_level": obj_type.hierarchy_level,
        "is_active": obj_type.is_active,
        "metadata": obj_type.metadata,
        "namespace_id": obj_type.namespace_id,
        "browser_group_id": obj_type.browser_group_id,
        "icon_image": obj_type.icon_image.name if obj_type.icon_image else "",
        "created_by_id": obj_type.created_by_id,
        "allowed_child_type_ids": _string_ids(obj_type.allowed_child_types.all()),
    }


def _object_snapshot(obj):
    return {
        "id": obj.id,
        "type_id": obj.object_type_id,
        "type_name": obj.object_type.name,
        "slug": obj.slug,
        "title": obj.title,
        "status": obj.status,
        "parent_id": obj.parent_id,
        "current_version_id": obj.current_version_id,
        "publish_date": _datetime(obj.publish_date),
        "unpublish_date": _datetime(obj.unpublish_date),
        "version": obj.version,
        "metadata": obj.metadata,
        "relationships": obj.relationships,
        "created_by_id": obj.created_by_id,
        "versions": [
            {
                "id": version.id,
                "version_number": version.version_number,
                "data": version.data,
                "widgets": version.widgets,
                "created_by_id": version.created_by_id,
                "change_description": version.change_description,
                "effective_date": _datetime(version.effective_date),
                "expiry_date": _datetime(version.expiry_date),
                "is_featured": version.is_featured,
            }
            for version in obj.versions.all()
        ],
        "version_ids": _string_ids(obj.versions.all()),
    }


def _media_snapshot(media):
    return {
        "id": str(media.id),
        "file_hash": media.file_hash,
        "file_path": media.file_path,
        "namespace_id": media.namespace_id,
        "title": media.title,
        "slug": media.slug,
        "description": media.description,
        "original_filename": media.original_filename,
        "file_url": media.file_url,
        "file_size": media.file_size,
        "content_type": media.content_type,
        "file_type": media.file_type,
        "width": media.width,
        "height": media.height,
        "metadata": media.metadata,
        "ai_generated_tags": media.ai_generated_tags,
        "ai_suggested_title": media.ai_suggested_title,
        "ai_extracted_text": media.ai_extracted_text,
        "ai_confidence_score": media.ai_confidence_score,
        "access_level": media.access_level,
        "download_count": media.download_count,
        "last_accessed": _datetime(media.last_accessed),
        "reference_count": media.reference_count,
        "last_referenced": _datetime(media.last_referenced),
        "referenced_in": media.referenced_in,
        "replaced_by_id": str(media.replaced_by_id) if media.replaced_by_id else None,
        "created_by_id": media.created_by_id,
        "last_modified_by_id": media.last_modified_by_id,
        "uploaded_by_id": media.uploaded_by_id,
        "is_deleted": media.is_deleted,
        "deleted_at": _datetime(media.deleted_at),
        "deleted_by_id": media.deleted_by_id,
        "tag_ids": _string_ids(media.tags.all()),
        "canonical_tag_ids": _string_ids(media.canonical_tags.all()),
        "collection_ids": _string_ids(media.collections.all()),
    }


def _collection_snapshot(collection):
    return {
        "id": str(collection.id),
        "namespace_id": collection.namespace_id,
        "title": collection.title,
        "slug": collection.slug,
        "description": collection.description,
        "access_level": collection.access_level,
        "created_by_id": collection.created_by_id,
        "last_modified_by_id": collection.last_modified_by_id,
        "tag_ids": _string_ids(collection.tags.all()),
        "canonical_tag_ids": _string_ids(collection.canonical_tags.all()),
    }


def _copy_to_spooled_file(source, name):
    spool = tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024)
    digest = hashlib.sha256()
    size = 0
    while chunk := source.read(1024 * 1024):
        spool.write(chunk)
        digest.update(chunk)
        size += len(chunk)
    spool.seek(0)
    return File(spool, name=name), digest.hexdigest(), size


def _capture_media_binaries(
    checkpoint_id,
    media_items,
    live_storage,
    checkpoint_storage_backend,
    require_present=True,
):
    """Copy affected live media into checkpoint-owned private object storage."""
    captured = {}
    written_paths = []
    try:
        for media in media_items:
            if not media.file_path or not live_storage.exists(media.file_path):
                if require_present:
                    raise ValueError(f"Media {media.id} is missing its binary and cannot be checkpointed.")
                captured[str(media.id)] = {"present": False}
                continue
            filename = os.path.basename(media.file_path) or str(media.id)
            checkpoint_path = f"transfer-checkpoints/{checkpoint_id}/media/{media.id}/{filename}"
            if checkpoint_storage_backend.exists(checkpoint_path):
                checkpoint_storage_backend.delete(checkpoint_path)
            with live_storage.open(media.file_path, "rb") as source:
                content, digest, size = _copy_to_spooled_file(source, filename)
                try:
                    save_checkpoint = getattr(
                        checkpoint_storage_backend,
                        "save_private",
                        checkpoint_storage_backend.save,
                    )
                    saved_path = save_checkpoint(checkpoint_path, content)
                finally:
                    content.close()
            if saved_path != checkpoint_path:
                checkpoint_storage_backend.delete(saved_path)
                raise ValueError(f"Could not reserve checkpoint storage for media {media.id}.")
            written_paths.append(saved_path)
            captured[str(media.id)] = {
                "present": True,
                "path": saved_path,
                "sha256": digest,
                "size": size,
            }
    except Exception:
        for path in written_paths:
            checkpoint_storage_backend.delete(path)
        raise
    return captured


def _restore_media_binaries(snapshot, live_storage, checkpoint_storage_backend):
    """Restore and verify checkpoint-owned media bytes before declaring success."""
    media_by_id = {str(item["id"]): item for item in snapshot.get("media", [])}
    for media_id, binary in snapshot.get("media_binaries", {}).items():
        item = media_by_id.get(str(media_id))
        if not item:
            raise ValueError(f"Checkpoint binary {media_id} has no media metadata.")
        live_path = item["file_path"]
        if not binary.get("present", True):
            if live_storage.exists(live_path):
                live_storage.delete(live_path)
            continue
        checkpoint_path = binary["path"]
        if not checkpoint_storage_backend.exists(checkpoint_path):
            raise ValueError(f"Checkpoint binary for media {media_id} is missing.")
        if hasattr(live_storage, "copy_from"):
            live_storage.copy_from(checkpoint_storage_backend, checkpoint_path, live_path)
        else:
            with checkpoint_storage_backend.open(checkpoint_path, "rb") as source:
                content, digest, size = _copy_to_spooled_file(source, os.path.basename(live_path))
                if size != binary["size"] or digest != binary["sha256"]:
                    content.close()
                    raise ValueError(f"Checkpoint binary for media {media_id} failed integrity verification.")
                try:
                    if live_storage.exists(live_path):
                        live_storage.delete(live_path)
                    saved_path = live_storage.save(live_path, content)
                finally:
                    content.close()
                if saved_path != live_path:
                    live_storage.delete(saved_path)
                    raise ValueError(f"Could not restore media binary {media_id} to its original path.")
        with live_storage.open(live_path, "rb") as restored:
            verified, digest, size = _copy_to_spooled_file(restored, os.path.basename(live_path))
            verified.close()
        if size != binary["size"] or digest != binary["sha256"]:
            raise ValueError(f"Restored media binary {media_id} failed integrity verification.")


def _cleanup_media_binaries(snapshot, checkpoint_storage_backend):
    for binary in snapshot.get("media_binaries", {}).values():
        if binary.get("path") and checkpoint_storage_backend.exists(binary["path"]):
            checkpoint_storage_backend.delete(binary["path"])


def _capture_type_icon_binaries(
    checkpoint_id,
    types,
    live_storage,
    checkpoint_storage_backend,
    require_present=True,
):
    """Copy affected object-type icons into checkpoint-owned private storage."""
    captured = {}
    written_paths = []
    try:
        for obj_type in types:
            live_path = obj_type.icon_image.name if obj_type.icon_image else ""
            if not live_path:
                captured[str(obj_type.id)] = {"present": False}
                continue
            if not live_storage.exists(live_path):
                if require_present:
                    raise ValueError(f"Object type {obj_type.id} is missing its icon and cannot be checkpointed.")
                captured[str(obj_type.id)] = {"present": False}
                continue
            filename = os.path.basename(live_path) or str(obj_type.id)
            checkpoint_path = f"transfer-checkpoints/{checkpoint_id}/type-icons/{obj_type.id}/{filename}"
            if checkpoint_storage_backend.exists(checkpoint_path):
                checkpoint_storage_backend.delete(checkpoint_path)
            with live_storage.open(live_path, "rb") as source:
                content, digest, size = _copy_to_spooled_file(source, filename)
                try:
                    save_checkpoint = getattr(
                        checkpoint_storage_backend,
                        "save_private",
                        checkpoint_storage_backend.save,
                    )
                    saved_path = save_checkpoint(checkpoint_path, content)
                finally:
                    content.close()
            if saved_path != checkpoint_path:
                checkpoint_storage_backend.delete(saved_path)
                raise ValueError(f"Could not reserve checkpoint storage for object type {obj_type.id}.")
            written_paths.append(saved_path)
            captured[str(obj_type.id)] = {
                "present": True,
                "path": saved_path,
                "sha256": digest,
                "size": size,
            }
    except Exception:
        for path in written_paths:
            checkpoint_storage_backend.delete(path)
        raise
    return captured


def _restore_type_icon_binaries(snapshot, live_storage, checkpoint_storage_backend):
    """Restore and verify checkpoint-owned object-type icon bytes."""
    types_by_id = {str(item["id"]): item for item in snapshot.get("types", [])}
    for type_id, binary in snapshot.get("type_icon_binaries", {}).items():
        item = types_by_id.get(str(type_id))
        if not item:
            raise ValueError(f"Checkpoint icon {type_id} has no object-type metadata.")
        live_path = item.get("icon_image", "")
        if not binary.get("present", True):
            if live_path and live_storage.exists(live_path):
                live_storage.delete(live_path)
            continue
        checkpoint_path = binary["path"]
        if not live_path or not checkpoint_storage_backend.exists(checkpoint_path):
            raise ValueError(f"Checkpoint icon for object type {type_id} is missing.")
        if hasattr(live_storage, "copy_from"):
            live_storage.copy_from(checkpoint_storage_backend, checkpoint_path, live_path)
        else:
            with checkpoint_storage_backend.open(checkpoint_path, "rb") as source:
                content, digest, size = _copy_to_spooled_file(source, os.path.basename(live_path))
                if size != binary["size"] or digest != binary["sha256"]:
                    content.close()
                    raise ValueError(f"Checkpoint icon for object type {type_id} failed integrity verification.")
                try:
                    if live_storage.exists(live_path):
                        live_storage.delete(live_path)
                    saved_path = live_storage.save(live_path, content)
                finally:
                    content.close()
                if saved_path != live_path:
                    live_storage.delete(saved_path)
                    raise ValueError(f"Could not restore object type icon {type_id} to its original path.")
        with live_storage.open(live_path, "rb") as restored:
            verified, digest, size = _copy_to_spooled_file(restored, os.path.basename(live_path))
            verified.close()
        if size != binary["size"] or digest != binary["sha256"]:
            raise ValueError(f"Restored object type icon {type_id} failed integrity verification.")


def _cleanup_type_icon_binaries(snapshot, checkpoint_storage_backend):
    for binary in snapshot.get("type_icon_binaries", {}).values():
        if binary.get("path") and checkpoint_storage_backend.exists(binary["path"]):
            checkpoint_storage_backend.delete(binary["path"])


def _checkpoint_binary_paths(snapshot):
    return {
        binary["path"]
        for key in ("media_binaries", "type_icon_binaries")
        for binary in snapshot.get(key, {}).values()
        if binary.get("path")
    }


def _cleanup_superseded_binaries(previous_snapshot, current_snapshot, checkpoint_storage_backend):
    retained_paths = _checkpoint_binary_paths(current_snapshot)
    for path in _checkpoint_binary_paths(previous_snapshot) - retained_paths:
        if checkpoint_storage_backend.exists(path):
            checkpoint_storage_backend.delete(path)


def _namespace_snapshot(namespace):
    return {
        "id": namespace.id,
        "name": namespace.name,
        "slug": namespace.slug,
        "description": namespace.description,
        "is_active": namespace.is_active,
        "is_default": namespace.is_default,
        "created_by_id": namespace.created_by_id,
    }


def _media_tag_snapshot(tag):
    return {
        "id": str(tag.id),
        "namespace_id": tag.namespace_id,
        "name": tag.name,
        "slug": tag.slug,
        "color": tag.color,
        "description": tag.description,
        "created_by_id": tag.created_by_id,
    }


def _taxonomy_tag_snapshot(tag):
    return {
        "id": str(tag.id),
        "namespace_id": tag.namespace_id,
        "name": tag.name,
        "slug": tag.slug,
        "tag_type": tag.tag_type,
        "color": tag.color,
        "description": tag.description,
        "created_by_id": tag.created_by_id,
    }


def _existing_destination_namespace(tenant, namespace_data, resolutions):
    if not namespace_data:
        return (
            Namespace.objects.filter(tenant=tenant, is_default=True).first()
            or Namespace.objects.filter(tenant=tenant, is_active=True).first()
        )
    mapped_slug = resolutions.get(namespace_data["slug"], namespace_data["slug"])
    mapped = Namespace.objects.filter(tenant=tenant, slug=mapped_slug).first()
    if mapped:
        return mapped
    return Namespace.objects.filter(tenant=tenant, slug=namespace_data["slug"]).first()


def _planned_import_resources(tenant, media_plans, namespace_resolutions):
    """Record identities that package application may reuse and mutate."""
    namespace_targets = {}
    collection_targets = {}
    media_tag_targets = {}
    taxonomy_tag_targets = {}
    for data, media, namespace in media_plans:
        namespace_data = data.get("namespace")
        if media:
            selector = {"kind": "fixed", "id": str(media.namespace_id)}
        elif namespace_data:
            selector = {
                "kind": "explicit",
                "source_slug": namespace_data["slug"],
                "mapped_slug": namespace_resolutions.get(namespace_data["slug"], namespace_data["slug"]),
            }
        else:
            selector = {"kind": "fallback"}
        selector_key = json.dumps(selector, sort_keys=True)
        namespace_targets[selector_key] = {
            **selector,
            "expected_id": str(namespace.id) if namespace else None,
        }
        if not namespace:
            continue

        media_tag_data = list(data.get("media_tags", []))
        taxonomy_tag_data = list(data.get("canonical_tags", []))
        for collection_data in data.get("collections", []):
            collection = MediaCollection.objects.filter(
                namespace=namespace,
                slug=collection_data["slug"],
            ).first()
            key = (str(namespace.id), collection_data["slug"])
            collection_targets[key] = {
                "namespace_id": str(namespace.id),
                "slug": collection_data["slug"],
                "expected_id": str(collection.id) if collection else None,
            }
            media_tag_data.extend(collection_data.get("media_tags", []))
            taxonomy_tag_data.extend(collection_data.get("canonical_tags", []))

        for tag_data in media_tag_data:
            tag_slug = slugify(tag_data.get("slug") or tag_data.get("name")) or "tag"
            tag_name = tag_data.get("name") or tag_slug
            tag = MediaTag.objects.filter(namespace=namespace, slug=tag_slug).first()
            if tag is None:
                tag = MediaTag.objects.filter(namespace=namespace, name=tag_name).first()
            key = (str(namespace.id), tag_slug, tag_name)
            media_tag_targets[key] = {
                "namespace_id": str(namespace.id),
                "slug": tag_slug,
                "name": tag_name,
                "expected_id": str(tag.id) if tag else None,
            }

        for tag_data in taxonomy_tag_data:
            tag_type = tag_data.get("tag_type", "general")
            tag = TaxonomyTag.objects.filter(
                tenant=tenant,
                namespace=namespace,
                tag_type=tag_type,
                slug=tag_data["slug"],
            ).first()
            key = (str(namespace.id), tag_type, tag_data["slug"])
            taxonomy_tag_targets[key] = {
                "namespace_id": str(namespace.id),
                "tag_type": tag_type,
                "slug": tag_data["slug"],
                "expected_id": str(tag.id) if tag else None,
            }
    return {
        "namespaces": list(namespace_targets.values()),
        "collections": list(collection_targets.values()),
        "media_tags": list(media_tag_targets.values()),
        "taxonomy_tags": list(taxonomy_tag_targets.values()),
    }


def capture_object_import_checkpoint(
    job,
    payload,
    storage=None,
    checkpoint_storage_backend=None,
    system_storage_backend=None,
):
    with transaction.atomic():
        job.tenant.__class__.objects.select_for_update().only("pk").get(pk=job.tenant_id)
        return _capture_object_import_checkpoint(
            job,
            payload,
            storage,
            checkpoint_storage_backend,
            system_storage_backend,
        )


def _capture_object_import_checkpoint(
    job,
    payload,
    storage=None,
    checkpoint_storage_backend=None,
    system_storage_backend=None,
):
    """Persist the complete pre-import database scope before mutation starts."""
    tenant = job.tenant
    existing_checkpoint = TransferCheckpoint.objects.select_for_update().filter(source_job=job).first()
    if existing_checkpoint and existing_checkpoint.status in {
        TransferCheckpoint.STATUS_PREPARING,
        TransferCheckpoint.STATUS_AVAILABLE,
    }:
        return existing_checkpoint
    resolutions = job.options.get("type_resolutions", {})
    included_names = [
        item["name"] for item in payload.get("types", []) if resolutions.get(item["name"], "keep") != "skip"
    ]
    updated_names = [name for name in included_names if resolutions.get(name, "keep") == "update"]
    existing_type_names = set(
        ObjectTypeDefinition.objects.filter(name__in=included_names).values_list("name", flat=True)
    )
    mutable_type_names = sorted(set(updated_names) | (set(included_names) - existing_type_names))
    types = list(
        ObjectTypeDefinition.objects.select_for_update()
        .filter(name__in=updated_names)
        .prefetch_related("allowed_child_types")
    )
    object_keys = [
        (item["type"], item["slug"]) for item in payload.get("objects", []) if item["type"] in included_names
    ]
    existing_objects = list(
        ObjectInstance.objects.select_for_update()
        .filter(tenant=tenant, object_type__name__in=included_names)
        .select_related("object_type")
        .prefetch_related("versions")
    )
    wanted_keys = set(object_keys)
    existing_objects = [item for item in existing_objects if (item.object_type.name, item.slug) in wanted_keys]
    existing_media = []
    seen_media = set()
    existing_collections = {}
    media_plans = []
    namespace_resolutions = job.options.get("namespace_resolutions", {})
    for item in payload.get("media", []):
        media = _existing_media(tenant, item["file_hash"])
        if media:
            media = MediaFile.objects.with_deleted().select_for_update().get(pk=media.pk)
        if media and media.id not in seen_media:
            existing_media.append(media)
            seen_media.add(media.id)
        namespace = (
            media.namespace
            if media
            else _existing_destination_namespace(tenant, item.get("namespace"), namespace_resolutions)
        )
        media_plans.append((item, media, namespace))
        if namespace:
            collection_slugs = [collection["slug"] for collection in item.get("collections", [])]
            for collection in MediaCollection.objects.select_for_update().filter(
                namespace=namespace, slug__in=collection_slugs
            ):
                existing_collections[collection.id] = collection

    namespace_ids = {item.namespace_id for item in types if item.namespace_id}
    namespace_ids.update(item.namespace_id for item in existing_media)
    namespace_ids.update(item.namespace_id for item in existing_collections.values())
    media_tag_ids = set()
    taxonomy_tag_ids = set()
    for item in [*existing_media, *existing_collections.values()]:
        media_tag_ids.update(item.tags.values_list("id", flat=True))
        taxonomy_tag_ids.update(item.canonical_tags.values_list("id", flat=True))
    namespaces = list(Namespace.objects.select_for_update().filter(tenant=tenant, id__in=namespace_ids))
    media_tags = list(MediaTag.objects.select_for_update().filter(namespace__tenant=tenant, id__in=media_tag_ids))
    taxonomy_tags = list(TaxonomyTag.objects.select_for_update().filter(tenant=tenant, id__in=taxonomy_tag_ids))
    planned_resources = _planned_import_resources(tenant, media_plans, namespace_resolutions)

    live_storage = storage or media_storage
    checkpoint_storage_backend = checkpoint_storage_backend or (storage if storage is not None else checkpoint_storage)
    system_storage_backend = system_storage_backend or (storage if storage is not None else system_storage)
    # Use a retry-stable prefix. If a worker dies after a private object write
    # but before the database transaction commits, redelivery overwrites the
    # same key and the eventual checkpoint owns and cleans that object.
    checkpoint_id = uuid.uuid5(uuid.NAMESPACE_URL, f"eceee-object-import-checkpoint:{job.id}")
    binary_snapshot = {}
    try:
        binary_snapshot["media_binaries"] = _capture_media_binaries(
            checkpoint_id,
            existing_media,
            live_storage,
            checkpoint_storage_backend,
        )
        binary_snapshot["type_icon_binaries"] = _capture_type_icon_binaries(
            checkpoint_id,
            types,
            system_storage_backend,
            checkpoint_storage_backend,
        )
    except Exception:
        _cleanup_media_binaries(binary_snapshot, checkpoint_storage_backend)
        _cleanup_type_icon_binaries(binary_snapshot, checkpoint_storage_backend)
        raise
    snapshot = {
        "schema_version": 1,
        "types": [_type_snapshot(item) for item in types],
        "objects": [_object_snapshot(item) for item in existing_objects],
        "media": [_media_snapshot(item) for item in existing_media],
        **binary_snapshot,
        "collections": [_collection_snapshot(item) for item in existing_collections.values()],
        "namespaces": [_namespace_snapshot(item) for item in namespaces],
        "media_tags": [_media_tag_snapshot(item) for item in media_tags],
        "taxonomy_tags": [_taxonomy_tag_snapshot(item) for item in taxonomy_tags],
        "planned": {
            "type_names": included_names,
            "mutable_type_names": mutable_type_names,
            "object_keys": [[type_name, slug] for type_name, slug in object_keys],
            "media_hashes": [item["file_hash"] for item in payload.get("media", [])],
            "resources": planned_resources,
        },
    }
    try:
        checkpoint, _created = TransferCheckpoint.objects.get_or_create(
            source_job=job,
            defaults={
                "id": checkpoint_id,
                "tenant": tenant,
                "operation": TransferCheckpoint.OPERATION_OBJECT_IMPORT,
                "resource_scopes": ["objects", "types", "media", "namespaces", "tags", "collections"],
                "snapshot": snapshot,
                "source_details": {"job_id": str(job.id), "connection_id": str(job.connection_id or "")},
                "created_by": job.created_by,
            },
        )
    except Exception:
        _cleanup_media_binaries(snapshot, checkpoint_storage_backend)
        _cleanup_type_icon_binaries(snapshot, checkpoint_storage_backend)
        raise
    if not _created and checkpoint.status == TransferCheckpoint.STATUS_FAILED and not checkpoint.operation_result:
        previous_snapshot = checkpoint.snapshot
        checkpoint.snapshot = snapshot
        checkpoint.status = TransferCheckpoint.STATUS_PREPARING
        checkpoint.errors = []
        checkpoint.save(update_fields=["snapshot", "status", "errors", "updated_at"])

        def cleanup_superseded_snapshot():
            try:
                _cleanup_superseded_binaries(previous_snapshot, snapshot, checkpoint_storage_backend)
            except Exception:
                logger.exception("Could not clean superseded transfer checkpoint binaries for %s", checkpoint.id)

        transaction.on_commit(cleanup_superseded_snapshot)
    elif not _created:
        _cleanup_media_binaries(snapshot, checkpoint_storage_backend)
        _cleanup_type_icon_binaries(snapshot, checkpoint_storage_backend)
    return checkpoint


def record_object_import_mutation(checkpoint, result, created_resources, media_paths, type_icon_paths):
    """Bind records and storage objects created by the completed import to its checkpoint."""
    checkpoint.created_resources = {
        **{key: sorted(set(map(str, values))) for key, values in created_resources.items()},
        "media_paths": list(media_paths),
        "type_icon_paths": list(type_icon_paths),
    }
    checkpoint.operation_result = {**result, "checkpoint_id": str(checkpoint.id)}
    checkpoint.status = TransferCheckpoint.STATUS_AVAILABLE
    checkpoint.errors = []
    checkpoint.save(update_fields=["created_resources", "operation_result", "status", "errors", "updated_at"])


def _capture_inverse_checkpoint(
    checkpoint,
    user,
    live_storage,
    checkpoint_storage_backend,
    system_storage_backend,
    inverse_id,
):
    """Capture the current affected state so restoring a checkpoint is itself reversible."""
    snapshot = checkpoint.snapshot or {}
    created = checkpoint.created_resources or {}
    object_ids = {item["id"] for item in snapshot.get("objects", [])} | set(created.get("object_ids", []))
    media_ids = {item["id"] for item in snapshot.get("media", [])} | set(created.get("media_ids", []))
    type_ids = {item["id"] for item in snapshot.get("types", [])} | set(created.get("type_ids", []))
    collection_ids = {item["id"] for item in snapshot.get("collections", [])} | set(created.get("collection_ids", []))
    namespace_ids = set(created.get("namespace_ids", [])) | {item["id"] for item in snapshot.get("namespaces", [])}
    media_tag_ids = set(created.get("media_tag_ids", [])) | {item["id"] for item in snapshot.get("media_tags", [])}
    taxonomy_tag_ids = set(created.get("taxonomy_tag_ids", [])) | {
        item["id"] for item in snapshot.get("taxonomy_tags", [])
    }

    objects = list(
        ObjectInstance.objects.select_for_update()
        .filter(tenant=checkpoint.tenant, id__in=object_ids)
        .select_related("object_type")
        .prefetch_related("versions")
    )
    media = list(
        MediaFile.objects.with_deleted()
        .select_for_update()
        .filter(tenant=checkpoint.tenant, id__in=media_ids)
        .prefetch_related("tags", "canonical_tags", "collections")
    )
    types = list(
        ObjectTypeDefinition.objects.select_for_update().filter(id__in=type_ids).prefetch_related("allowed_child_types")
    )
    collections = list(
        MediaCollection.objects.select_for_update()
        .filter(namespace__tenant=checkpoint.tenant, id__in=collection_ids)
        .prefetch_related("tags", "canonical_tags")
    )
    namespace_ids.update(item.namespace_id for item in media)
    namespace_ids.update(item.namespace_id for item in types if item.namespace_id)
    namespace_ids.update(item.namespace_id for item in collections)
    namespaces = list(Namespace.objects.filter(tenant=checkpoint.tenant, id__in=namespace_ids))
    missing_media_ids = {str(item["id"]) for item in snapshot.get("media", [])} - {
        str(media_file.id) for media_file in media
    }
    missing_type_ids = {str(item["id"]) for item in snapshot.get("types", [])} - {
        str(obj_type.id) for obj_type in types
    }
    inverse_created_resources = {
        "object_ids": sorted(
            {str(item["id"]) for item in snapshot.get("objects", [])} - {str(item.id) for item in objects}
        ),
        "media_ids": sorted(missing_media_ids),
        "type_ids": sorted(missing_type_ids),
        "namespace_ids": sorted(
            {str(item["id"]) for item in snapshot.get("namespaces", [])} - {str(item.id) for item in namespaces}
        ),
        "media_tag_ids": sorted(
            {str(item["id"]) for item in snapshot.get("media_tags", [])}
            - set(
                map(
                    str,
                    MediaTag.objects.filter(
                        namespace__tenant=checkpoint.tenant,
                        id__in=[item["id"] for item in snapshot.get("media_tags", [])],
                    ).values_list("id", flat=True),
                )
            )
        ),
        "taxonomy_tag_ids": sorted(
            {str(item["id"]) for item in snapshot.get("taxonomy_tags", [])}
            - set(
                map(
                    str,
                    TaxonomyTag.objects.filter(
                        tenant=checkpoint.tenant,
                        id__in=[item["id"] for item in snapshot.get("taxonomy_tags", [])],
                    ).values_list("id", flat=True),
                )
            )
        ),
        "collection_ids": sorted(
            {str(item["id"]) for item in snapshot.get("collections", [])} - {str(item.id) for item in collections}
        ),
        "media_paths": sorted(
            {
                item["file_path"]
                for item in snapshot.get("media", [])
                if str(item["id"]) in missing_media_ids and item.get("file_path")
            }
        ),
        "type_icon_paths": sorted(
            {
                item["icon_image"]
                for item in snapshot.get("types", [])
                if str(item["id"]) in missing_type_ids and item.get("icon_image")
            }
        ),
    }
    binary_snapshot = {}
    try:
        binary_snapshot["media_binaries"] = _capture_media_binaries(
            inverse_id,
            media,
            live_storage,
            checkpoint_storage_backend,
            require_present=False,
        )
        binary_snapshot["type_icon_binaries"] = _capture_type_icon_binaries(
            inverse_id,
            types,
            system_storage_backend,
            checkpoint_storage_backend,
            require_present=False,
        )
    except Exception:
        _cleanup_media_binaries(binary_snapshot, checkpoint_storage_backend)
        _cleanup_type_icon_binaries(binary_snapshot, checkpoint_storage_backend)
        raise
    inverse_snapshot = {
        "schema_version": 1,
        "namespaces": [_namespace_snapshot(item) for item in namespaces],
        "media_tags": [
            _media_tag_snapshot(item)
            for item in MediaTag.objects.filter(namespace__tenant=checkpoint.tenant, id__in=media_tag_ids)
        ],
        "taxonomy_tags": [
            _taxonomy_tag_snapshot(item)
            for item in TaxonomyTag.objects.filter(tenant=checkpoint.tenant, id__in=taxonomy_tag_ids)
        ],
        "types": [_type_snapshot(item) for item in types],
        "objects": [_object_snapshot(item) for item in objects],
        "media": [_media_snapshot(item) for item in media],
        **binary_snapshot,
        "collections": [_collection_snapshot(item) for item in collections],
    }
    try:
        inverse = TransferCheckpoint.objects.create(
            id=inverse_id,
            tenant=checkpoint.tenant,
            operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
            status=TransferCheckpoint.STATUS_AVAILABLE,
            resource_scopes=checkpoint.resource_scopes,
            snapshot=inverse_snapshot,
            created_resources=inverse_created_resources,
            operation_result={"restorable": True},
            source_details={"restore_of": str(checkpoint.id)},
            created_by=user,
        )
        checkpoint.source_details = {
            **checkpoint.source_details,
            "inverse_checkpoint_id": str(inverse.id),
        }
        checkpoint.source_details.pop("inverse_capture_pending", None)
        checkpoint.save(update_fields=["source_details", "updated_at"])
    except Exception:
        _cleanup_media_binaries(inverse_snapshot, checkpoint_storage_backend)
        _cleanup_type_icon_binaries(inverse_snapshot, checkpoint_storage_backend)
        raise
    return inverse


def _delete_created_media(checkpoint):
    for media in MediaFile.objects.with_deleted().filter(
        tenant=checkpoint.tenant,
        id__in=checkpoint.created_resources.get("media_ids", []),
    ):
        models.Model.delete(media)


def _delete_created_media_binaries(checkpoint, storage):
    paths = set(checkpoint.created_resources.get("media_paths", []))
    paths.update(
        value
        for value in MediaFile.objects.with_deleted()
        .filter(tenant=checkpoint.tenant, id__in=checkpoint.created_resources.get("media_ids", []))
        .values_list("file_path", flat=True)
        if value
    )
    for path in paths:
        if storage.exists(path):
            storage.delete(path)


def _delete_created_type_icon_binaries(checkpoint, snapshot, storage):
    restored_paths = {item.get("icon_image") for item in snapshot.get("types", []) if item.get("icon_image")}
    cleanup_paths = set(checkpoint.created_resources.get("type_icon_paths", []))
    inverse_id = checkpoint.source_details.get("inverse_checkpoint_id")
    if inverse_id:
        inverse_snapshot = (
            TransferCheckpoint.objects.filter(id=inverse_id, tenant=checkpoint.tenant)
            .values_list("snapshot", flat=True)
            .first()
            or {}
        )
        cleanup_paths.update(item.get("icon_image") for item in inverse_snapshot.get("types", []))
    for path in cleanup_paths - restored_paths:
        if path and not ObjectTypeDefinition.objects.filter(icon_image=path).exists() and storage.exists(path):
            storage.delete(path)


def _keyed_object_reference_ids(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"object_id", "objectId", "parent_object_id", "parentObjectId"}:
                try:
                    yield int(item)
                except (TypeError, ValueError):
                    pass
            yield from _keyed_object_reference_ids(item)
    elif isinstance(value, list):
        for item in value:
            yield from _keyed_object_reference_ids(item)


def _restore_scope_ids(snapshot, created):
    return {
        ObjectTypeDefinition: {str(item["id"]) for item in snapshot.get("types", [])}
        | set(map(str, created.get("type_ids", []))),
        ObjectInstance: {str(item["id"]) for item in snapshot.get("objects", [])}
        | set(map(str, created.get("object_ids", []))),
        MediaFile: {str(item["id"]) for item in snapshot.get("media", [])}
        | set(map(str, created.get("media_ids", []))),
        MediaCollection: {str(item["id"]) for item in snapshot.get("collections", [])}
        | set(map(str, created.get("collection_ids", []))),
        MediaTag: {str(item["id"]) for item in snapshot.get("media_tags", [])}
        | set(map(str, created.get("media_tag_ids", []))),
        TaxonomyTag: {str(item["id"]) for item in snapshot.get("taxonomy_tags", [])}
        | set(map(str, created.get("taxonomy_tag_ids", []))),
    }


def _sorted_snapshot_items(items):
    normalized = json.loads(json.dumps(list(items), cls=DjangoJSONEncoder))
    return sorted(normalized, key=lambda item: str(item["id"]))


def _assert_live_binaries_match(snapshot, key, items_key, path_key, storage):
    items = {str(item["id"]): item for item in snapshot.get(items_key, [])}
    for item_id, binary in snapshot.get(key, {}).items():
        item = items.get(str(item_id))
        if not item:
            raise ValueError("The destination changed after its recovery checkpoint was prepared.")
        live_path = item.get(path_key) or ""
        present = bool(live_path and storage.exists(live_path))
        if present != binary.get("present", True):
            raise ValueError("The destination changed after its recovery checkpoint was prepared.")
        if not present:
            continue
        with storage.open(live_path, "rb") as source:
            content, digest, size = _copy_to_spooled_file(source, os.path.basename(live_path))
            content.close()
        if digest != binary["sha256"] or size != binary["size"]:
            raise ValueError("The destination changed after its recovery checkpoint was prepared.")


def _assert_current_state_matches(
    checkpoint,
    expected_snapshot,
    expected_absent,
    live_storage,
    system_storage_backend,
    *,
    check_binaries=True,
):
    """Verify the exact affected state while restore table locks are held."""

    def assert_items(key, queryset, serializer, absent_key):
        expected = _sorted_snapshot_items(expected_snapshot.get(key, []))
        ids = {item["id"] for item in expected} | set(expected_absent.get(absent_key, []))
        actual = _sorted_snapshot_items(serializer(item) for item in queryset.filter(id__in=ids))
        if actual != expected:
            raise ValueError("The destination changed after its recovery checkpoint was prepared.")

    object_ids = {item["id"] for item in expected_snapshot.get("objects", [])} | set(
        expected_absent.get("object_ids", [])
    )
    list(ObjectVersion.objects.select_for_update().filter(object_instance_id__in=object_ids).only("id"))
    assert_items(
        "objects",
        ObjectInstance.objects.select_for_update()
        .filter(tenant=checkpoint.tenant)
        .select_related("object_type")
        .prefetch_related("versions"),
        _object_snapshot,
        "object_ids",
    )
    assert_items(
        "types",
        ObjectTypeDefinition.objects.select_for_update().prefetch_related("allowed_child_types"),
        _type_snapshot,
        "type_ids",
    )
    assert_items(
        "media",
        MediaFile.objects.with_deleted()
        .select_for_update()
        .filter(tenant=checkpoint.tenant)
        .prefetch_related("tags", "canonical_tags", "collections"),
        _media_snapshot,
        "media_ids",
    )
    assert_items(
        "collections",
        MediaCollection.objects.select_for_update()
        .filter(namespace__tenant=checkpoint.tenant)
        .prefetch_related("tags", "canonical_tags"),
        _collection_snapshot,
        "collection_ids",
    )
    assert_items(
        "namespaces",
        Namespace.objects.select_for_update().filter(tenant=checkpoint.tenant),
        _namespace_snapshot,
        "namespace_ids",
    )
    assert_items(
        "media_tags",
        MediaTag.objects.select_for_update().filter(namespace__tenant=checkpoint.tenant),
        _media_tag_snapshot,
        "media_tag_ids",
    )
    assert_items(
        "taxonomy_tags",
        TaxonomyTag.objects.select_for_update().filter(tenant=checkpoint.tenant),
        _taxonomy_tag_snapshot,
        "taxonomy_tag_ids",
    )
    if check_binaries:
        _assert_live_binaries_match(expected_snapshot, "media_binaries", "media", "file_path", live_storage)
        _assert_live_binaries_match(
            expected_snapshot,
            "type_icon_binaries",
            "types",
            "icon_image",
            system_storage_backend,
        )


def assert_import_checkpoint_current(checkpoint, live_storage, system_storage_backend):
    """Abort when destination state changed after the committed import checkpoint."""
    _assert_current_state_matches(checkpoint, checkpoint.snapshot, {}, live_storage, system_storage_backend)
    planned = checkpoint.snapshot.get("planned", {})

    expected_type_ids = {str(item["id"]) for item in checkpoint.snapshot.get("types", [])}
    current_type_ids = set(
        map(
            str,
            ObjectTypeDefinition.objects.filter(name__in=planned.get("mutable_type_names", [])).values_list(
                "id", flat=True
            ),
        )
    )
    if current_type_ids != expected_type_ids:
        raise ValueError("The destination changed after its import checkpoint was prepared.")

    object_keys = {tuple(item) for item in planned.get("object_keys", [])}
    expected_object_ids = {str(item["id"]) for item in checkpoint.snapshot.get("objects", [])}
    current_objects = ObjectInstance.objects.filter(
        tenant=checkpoint.tenant,
        object_type__name__in={item[0] for item in object_keys},
        slug__in={item[1] for item in object_keys},
    ).select_related("object_type")
    current_object_ids = {str(item.id) for item in current_objects if (item.object_type.name, item.slug) in object_keys}
    if current_object_ids != expected_object_ids:
        raise ValueError("The destination changed after its import checkpoint was prepared.")

    expected_media_ids = {str(item["id"]) for item in checkpoint.snapshot.get("media", [])}
    current_media_ids = {
        str(media.id)
        for file_hash in planned.get("media_hashes", [])
        if (media := _existing_media(checkpoint.tenant, file_hash)) is not None
    }
    if current_media_ids != expected_media_ids:
        raise ValueError("The destination changed after its import checkpoint was prepared.")

    resources = planned.get("resources", {})
    for target in resources.get("namespaces", []):
        if target["kind"] == "fixed":
            namespace = Namespace.objects.filter(tenant=checkpoint.tenant, id=target["id"]).first()
        elif target["kind"] == "explicit":
            namespace = Namespace.objects.filter(
                tenant=checkpoint.tenant,
                slug=target["mapped_slug"],
            ).first()
            if namespace is None:
                namespace = Namespace.objects.filter(
                    tenant=checkpoint.tenant,
                    slug=target["source_slug"],
                ).first()
        else:
            namespace = (
                Namespace.objects.filter(tenant=checkpoint.tenant, is_default=True).first()
                or Namespace.objects.filter(tenant=checkpoint.tenant, is_active=True).first()
            )
        if (str(namespace.id) if namespace else None) != target["expected_id"]:
            raise ValueError("The destination changed after its import checkpoint was prepared.")

    for target in resources.get("collections", []):
        resource = MediaCollection.objects.filter(
            namespace_id=target["namespace_id"],
            slug=target["slug"],
        ).first()
        if (str(resource.id) if resource else None) != target["expected_id"]:
            raise ValueError("The destination changed after its import checkpoint was prepared.")

    for target in resources.get("media_tags", []):
        resource = MediaTag.objects.filter(
            namespace_id=target["namespace_id"],
            slug=target["slug"],
        ).first()
        if resource is None:
            resource = MediaTag.objects.filter(
                namespace_id=target["namespace_id"],
                name=target["name"],
            ).first()
        if (str(resource.id) if resource else None) != target["expected_id"]:
            raise ValueError("The destination changed after its import checkpoint was prepared.")

    for target in resources.get("taxonomy_tags", []):
        resource = TaxonomyTag.objects.filter(
            tenant=checkpoint.tenant,
            namespace_id=target["namespace_id"],
            tag_type=target["tag_type"],
            slug=target["slug"],
        ).first()
        if (str(resource.id) if resource else None) != target["expected_id"]:
            raise ValueError("The destination changed after its import checkpoint was prepared.")


def _has_external_dependents(instance, scope_ids):
    """Return whether a created resource gained a relation outside the import scope."""
    for relation in instance._meta.related_objects:
        related = getattr(instance, relation.get_accessor_name(), None)
        if related is None or not hasattr(related, "all"):
            continue
        queryset = related.all()
        owned = scope_ids.get(relation.related_model, set())
        if owned:
            queryset = queryset.exclude(pk__in=owned)
        if queryset.exists():
            return True
    return False


def _recheck_restore_dependencies(checkpoint, snapshot, created):
    """Recheck created-resource dependencies in the serializable mutation transaction."""
    from object_storage.services.object_transfer import (
        _reference_field_names,
        _reference_ids,
        _relationship_target_ids,
        type_has_foreign_namespace,
        type_has_foreign_tenant_usage,
    )
    from webpages.models import PageVersion

    scope_ids = _restore_scope_ids(snapshot, created)
    for item in snapshot.get("types", []):
        obj_type = ObjectTypeDefinition.objects.select_for_update().filter(id=item["id"]).first()
        if obj_type and (
            type_has_foreign_namespace(obj_type, checkpoint.tenant)
            or type_has_foreign_tenant_usage(obj_type, checkpoint.tenant)
        ):
            raise ValueError(f"Object type {obj_type.name} is now used by another workspace and cannot be restored.")
    created_object_ids = {int(value) for value in created.get("object_ids", [])}
    affected_object_ids = created_object_ids | {int(item["id"]) for item in snapshot.get("objects", [])}
    if ObjectInstance.objects.filter(parent_id__in=created_object_ids).exclude(id__in=affected_object_ids).exists():
        raise ValueError("Content created after this import is nested below imported content and blocks restore.")
    for obj in ObjectInstance.objects.exclude(id__in=affected_object_ids).only("id", "relationships").iterator():
        if _relationship_target_ids(obj.relationships) & created_object_ids:
            raise ValueError("Content outside this import now references imported content and blocks restore.")
    created_media_tokens = {
        str(value)
        for row in MediaFile.objects.with_deleted()
        .filter(tenant=checkpoint.tenant, id__in=created.get("media_ids", []))
        .values_list("id", "file_path", "file_url")
        for value in row
        if value
    }
    for version in (
        ObjectVersion.objects.exclude(object_instance_id__in=affected_object_ids)
        .select_related("object_instance__object_type")
        .only("id", "data", "widgets", "object_instance__object_type__schema")
        .iterator()
    ):
        reference_fields = _reference_field_names(version.object_instance.object_type)
        referenced_ids = {
            int(value)
            for name in reference_fields
            for value in _reference_ids(version.data.get(name))
            if str(value).isdigit()
        }
        referenced_ids.update(_keyed_object_reference_ids(version.widgets))
        if referenced_ids & created_object_ids:
            raise ValueError("Content outside this import now references imported content and blocks restore.")
        serialized = json.dumps({"data": version.data, "widgets": version.widgets}, default=str)
        if any(token in serialized for token in created_media_tokens):
            raise ValueError("Content outside this import now references imported media and blocks restore.")
    for version in PageVersion.objects.only("id", "page_data", "widgets").iterator():
        referenced_ids = set(_keyed_object_reference_ids(version.page_data))
        referenced_ids.update(_keyed_object_reference_ids(version.widgets))
        if referenced_ids & created_object_ids:
            raise ValueError("Content outside this import now references imported content and blocks restore.")
        serialized = json.dumps({"page_data": version.page_data, "widgets": version.widgets}, default=str)
        if any(token in serialized for token in created_media_tokens):
            raise ValueError("Content outside this import now references imported media and blocks restore.")
    created_type_ids = {str(value) for value in created.get("type_ids", [])}
    affected_type_ids = {str(value) for value in scope_ids[ObjectTypeDefinition]}
    if any(
        type_has_foreign_namespace(obj_type, checkpoint.tenant)
        for obj_type in ObjectTypeDefinition.objects.filter(id__in=created_type_ids)
    ):
        raise ValueError("An object type created by this import now belongs to another workspace and blocks restore.")
    if (
        ObjectTypeDefinition.objects.exclude(id__in=affected_type_ids)
        .filter(
            models.Q(browser_group_id__in=created_type_ids) | models.Q(allowed_child_types__id__in=created_type_ids)
        )
        .exists()
        or ObjectInstance.objects.exclude(id__in=affected_object_ids)
        .filter(object_type_id__in=created_type_ids)
        .exists()
    ):
        raise ValueError("Object types created by this import are now used outside its scope and block restore.")
    created_media_ids = set(created.get("media_ids", []))
    created_media_paths = {path for path in created.get("media_paths", []) if path}
    if (
        created_media_paths
        and MediaFile.objects.with_deleted()
        .filter(file_path__in=created_media_paths)
        .exclude(id__in=scope_ids[MediaFile])
        .exists()
    ):
        raise ValueError("A media path created by this import is now used outside its scope and blocks restore.")
    created_type_icon_paths = {path for path in created.get("type_icon_paths", []) if path}
    if (
        created_type_icon_paths
        and ObjectTypeDefinition.objects.filter(icon_image__in=created_type_icon_paths)
        .exclude(id__in=scope_ids[ObjectTypeDefinition])
        .exists()
    ):
        raise ValueError("An object-type icon created by this import is now used outside its scope and blocks restore.")
    if MediaUsage.objects.filter(media_file_id__in=created_media_ids).exists():
        raise ValueError("Media created by this import is now in use and blocks restore.")
    if (
        MediaFile.collections.through.objects.filter(mediafile_id__in=created_media_ids)
        .exclude(mediacollection_id__in=scope_ids[MediaCollection])
        .exists()
    ):
        raise ValueError("Media created by this import is now in an external collection and blocks restore.")
    for collection in MediaCollection.objects.filter(id__in=created.get("collection_ids", [])):
        if collection.mediafile_set.exclude(id__in=scope_ids[MediaFile]).exists():
            raise ValueError(
                "A media collection created by this import is now used outside its scope and blocks restore."
            )
    if (
        MediaFile.objects.with_deleted()
        .exclude(id__in=scope_ids[MediaFile])
        .filter(replaced_by_id__in=created_media_ids)
        .exists()
    ):
        raise ValueError("Media created by this import now replaces another file and blocks restore.")
    for model, key, message in (
        (MediaTag, "media_tag_ids", "Media tags"),
        (TaxonomyTag, "taxonomy_tag_ids", "Taxonomy tags"),
        (Namespace, "namespace_ids", "A namespace"),
    ):
        for instance in model.objects.filter(id__in=created.get(key, [])):
            if _has_external_dependents(instance, scope_ids):
                raise ValueError(f"{message} created by this import are now used outside its scope and block restore.")


def _prepare_inverse_checkpoint(
    checkpoint,
    user,
    live_storage,
    checkpoint_storage_backend,
    system_storage_backend,
):
    """Durably commit recovery state before any live binary or database mutation."""
    # Reserve a retry-stable, per-attempt ID in its own transaction before any
    # private object write. Worker redelivery reuses it; an explicit retry gets
    # a new immutable inverse checkpoint after the API clears this marker.
    with transaction.atomic():
        checkpoint.tenant.__class__.objects.select_for_update().only("pk").get(pk=checkpoint.tenant_id)
        checkpoint = TransferCheckpoint.objects.select_for_update().get(pk=checkpoint.pk, tenant=checkpoint.tenant)
        if checkpoint.status == TransferCheckpoint.STATUS_RESTORED:
            return None, False
        if checkpoint.status not in {
            TransferCheckpoint.STATUS_AVAILABLE,
            TransferCheckpoint.STATUS_RESTORE_PENDING,
            TransferCheckpoint.STATUS_RESTORING,
            TransferCheckpoint.STATUS_FAILED,
        }:
            raise ValueError("This checkpoint is not available to restore.")
        if checkpoint.status == TransferCheckpoint.STATUS_FAILED and not checkpoint.operation_result:
            raise ValueError("This checkpoint belongs to an import that did not complete.")
        inverse_id = checkpoint.source_details.get("inverse_checkpoint_id")
        if not inverse_id:
            if checkpoint.status == TransferCheckpoint.STATUS_RESTORING:
                raise ValueError("This restore has no durable inverse checkpoint and cannot be resumed safely.")
            inverse_id = str(uuid.uuid4())
            checkpoint.source_details = {
                **checkpoint.source_details,
                "inverse_checkpoint_id": inverse_id,
                "inverse_capture_pending": True,
            }
            checkpoint.save(update_fields=["source_details", "updated_at"])

    with transaction.atomic():
        checkpoint.tenant.__class__.objects.select_for_update().only("pk").get(pk=checkpoint.tenant_id)
        checkpoint = TransferCheckpoint.objects.select_for_update().get(pk=checkpoint.pk, tenant=checkpoint.tenant)
        inverse = TransferCheckpoint.objects.filter(id=inverse_id, tenant=checkpoint.tenant).first()
        resumed = inverse is not None and (
            checkpoint.status == TransferCheckpoint.STATUS_RESTORING
            or checkpoint.source_details.get("binary_recovery_failed", False)
        )
        if inverse is None:
            inverse = _capture_inverse_checkpoint(
                checkpoint,
                user,
                live_storage,
                checkpoint_storage_backend,
                system_storage_backend,
                uuid.UUID(str(inverse_id)),
            )
        checkpoint.mark_restoring(user)
        return inverse, resumed


def _ensure_restore_mutation_intent(
    checkpoint,
    inverse,
    live_storage,
    system_storage_backend,
):
    """Durably mark a validated restore attempt before storage mutation."""
    marker = str(inverse.id)
    with transaction.atomic():
        begin_serializable_transfer()
        checkpoint.tenant.__class__.objects.select_for_update().only("pk").get(pk=checkpoint.tenant_id)
        checkpoint = TransferCheckpoint.objects.select_for_update().get(pk=checkpoint.pk, tenant=checkpoint.tenant)
        if checkpoint.source_details.get("restore_mutation_intent") == marker:
            # A redelivery may repair partial binary writes, but it must not
            # overwrite a user change committed after the worker stopped.
            _assert_current_state_matches(
                checkpoint,
                inverse.snapshot,
                inverse.created_resources or {},
                live_storage,
                system_storage_backend,
                check_binaries=False,
            )
            return
        _assert_current_state_matches(
            checkpoint,
            inverse.snapshot,
            inverse.created_resources or {},
            live_storage,
            system_storage_backend,
        )
        checkpoint.source_details = {
            **checkpoint.source_details,
            "restore_mutation_intent": marker,
        }
        checkpoint.save(update_fields=["source_details", "updated_at"])


def restore_object_import_checkpoint(
    checkpoint,
    user,
    storage=None,
    checkpoint_storage_backend=None,
    system_storage_backend=None,
):
    with tenant_transfer_lock(checkpoint.tenant_id):
        checkpoint = TransferCheckpoint.objects.get(pk=checkpoint.pk, tenant=checkpoint.tenant)
        object_type_ids = {
            int(item["id"]) for item in checkpoint.snapshot.get("types", []) if item.get("id") is not None
        }
        object_type_ids.update(int(value) for value in checkpoint.created_resources.get("type_ids", []))
        icon_paths = set(checkpoint.created_resources.get("type_icon_paths", []))
        icon_paths.update(item.get("icon_image") for item in checkpoint.snapshot.get("types", []))
        media_hashes = {item.get("file_hash") for item in checkpoint.snapshot.get("media", [])}
        media_hashes.update(checkpoint.snapshot.get("planned", {}).get("media_hashes", []))
        media_hashes.update(
            MediaFile.objects.with_deleted()
            .filter(tenant=checkpoint.tenant, id__in=checkpoint.created_resources.get("media_ids", []))
            .values_list("file_hash", flat=True)
        )
        inverse_id = checkpoint.source_details.get("inverse_checkpoint_id")
        if inverse_id:
            inverse_snapshot = (
                TransferCheckpoint.objects.filter(id=inverse_id, tenant=checkpoint.tenant)
                .values_list("snapshot", flat=True)
                .first()
                or {}
            )
            media_hashes.update(item.get("file_hash") for item in inverse_snapshot.get("media", []))
            icon_paths.update(item.get("icon_image") for item in inverse_snapshot.get("types", []))
        with media_content_transfer_locks(media_hashes), object_type_transfer_locks(object_type_ids):
            # Icon writers use the same type lock. Refetch only after owning it,
            # then keep every observed path locked through post-commit cleanup.
            icon_paths.update(
                ObjectTypeDefinition.objects.filter(id__in=object_type_ids).values_list("icon_image", flat=True)
            )
            with type_icon_path_locks(icon_paths):
                return _restore_object_import_checkpoint_locked(
                    checkpoint,
                    user,
                    storage,
                    checkpoint_storage_backend,
                    system_storage_backend,
                )


def _restore_object_import_checkpoint_locked(
    checkpoint,
    user,
    storage=None,
    checkpoint_storage_backend=None,
    system_storage_backend=None,
):
    """Restore one object-import checkpoint; repeated and redelivered restores resume safely."""
    live_storage = storage or media_storage
    checkpoint_storage_backend = checkpoint_storage_backend or (storage if storage is not None else checkpoint_storage)
    system_storage_backend = system_storage_backend or (storage if storage is not None else system_storage)
    try:
        inverse, resumed = _prepare_inverse_checkpoint(
            checkpoint,
            user,
            live_storage,
            checkpoint_storage_backend,
            system_storage_backend,
        )
    except Exception as exc:
        failed = TransferCheckpoint.objects.get(pk=checkpoint.pk, tenant=checkpoint.tenant)
        failed.mark_failed(exc)
        raise
    if inverse is None:
        restored = TransferCheckpoint.objects.get(pk=checkpoint.pk, tenant=checkpoint.tenant)
        _finish_restored_binary_cleanup(restored, live_storage, system_storage_backend)
        return restored
    recovery = {"mutation_started": False}
    try:
        _ensure_restore_mutation_intent(
            checkpoint,
            inverse,
            live_storage,
            system_storage_backend,
        )
        if resumed:
            recovery["mutation_started"] = True
            _restore_media_binaries(inverse.snapshot, live_storage, checkpoint_storage_backend)
            _restore_type_icon_binaries(inverse.snapshot, system_storage_backend, checkpoint_storage_backend)
        _assert_live_binaries_match(inverse.snapshot, "media_binaries", "media", "file_path", live_storage)
        _assert_live_binaries_match(
            inverse.snapshot,
            "type_icon_binaries",
            "types",
            "icon_image",
            system_storage_backend,
        )
        recovery["mutation_started"] = True
        _restore_media_binaries(checkpoint.snapshot, live_storage, checkpoint_storage_backend)
        _restore_type_icon_binaries(checkpoint.snapshot, system_storage_backend, checkpoint_storage_backend)
        # The exclusive global barrier is intentionally limited to the final
        # dependency recheck and database mutation. Slow object-storage copies
        # above must not stop unrelated workspaces from writing content.
        with reference_write_barrier(), transaction.atomic():
            restored = _restore_object_import_checkpoint(
                checkpoint,
                user,
                live_storage,
                system_storage_backend,
                inverse,
            )
    except Exception as exc:
        recovery_error = None
        if recovery["mutation_started"]:
            try:
                _restore_media_binaries(inverse.snapshot, live_storage, checkpoint_storage_backend)
                _restore_type_icon_binaries(inverse.snapshot, system_storage_backend, checkpoint_storage_backend)
            except Exception as compensation_exc:
                recovery_error = compensation_exc
        failed = TransferCheckpoint.objects.get(pk=checkpoint.pk, tenant=checkpoint.tenant)
        error = str(exc)
        if recovery_error:
            error = f"{error} Binary recovery also failed: {recovery_error}"
            failed.source_details = {**failed.source_details, "binary_recovery_failed": True}
            failed.save(update_fields=["source_details", "updated_at"])
        failed.mark_failed(error)
        raise
    _finish_restored_binary_cleanup(restored, live_storage, system_storage_backend)
    return restored


def _finish_restored_binary_cleanup(checkpoint, live_storage, system_storage_backend):
    """Idempotently remove superseded binaries only after the DB restore commits."""
    if not checkpoint.source_details.get("binary_cleanup_pending", False):
        return
    try:
        _delete_created_media_binaries(checkpoint, live_storage)
        _delete_created_type_icon_binaries(checkpoint, checkpoint.snapshot, system_storage_backend)
    except Exception as exc:
        logger.exception("Post-restore binary cleanup remains pending for checkpoint %s", checkpoint.id)
        checkpoint.errors = [*(checkpoint.errors or []), f"Binary cleanup failed: {exc}"]
        checkpoint.save(update_fields=["errors", "updated_at"])
        raise PostRestoreCleanupError("Post-restore binary cleanup failed and remains retryable.") from exc
    checkpoint.source_details.pop("binary_cleanup_pending", None)
    checkpoint.source_details.pop("binary_cleanup_retry_active", None)
    checkpoint.errors = []
    checkpoint.save(update_fields=["source_details", "errors", "updated_at"])


def _restore_object_import_checkpoint(
    checkpoint,
    user,
    live_storage,
    system_storage_backend,
    inverse,
):
    begin_serializable_transfer()
    checkpoint.tenant.__class__.objects.select_for_update().only("pk").get(pk=checkpoint.tenant_id)
    checkpoint = TransferCheckpoint.objects.select_for_update().get(pk=checkpoint.pk, tenant=checkpoint.tenant)
    if checkpoint.status == TransferCheckpoint.STATUS_RESTORED:
        return checkpoint
    if checkpoint.status not in {
        TransferCheckpoint.STATUS_AVAILABLE,
        TransferCheckpoint.STATUS_RESTORE_PENDING,
        TransferCheckpoint.STATUS_RESTORING,
        TransferCheckpoint.STATUS_FAILED,
    }:
        raise ValueError("This checkpoint is not available to restore.")
    if checkpoint.status == TransferCheckpoint.STATUS_FAILED and not checkpoint.operation_result:
        raise ValueError("This checkpoint belongs to an import that did not complete.")
    snapshot = checkpoint.snapshot
    created = checkpoint.created_resources or {}
    _assert_current_state_matches(
        checkpoint,
        inverse.snapshot,
        inverse.created_resources or {},
        live_storage,
        system_storage_backend,
        check_binaries=False,
    )
    _assert_live_binaries_match(snapshot, "media_binaries", "media", "file_path", live_storage)
    _assert_live_binaries_match(
        snapshot,
        "type_icon_binaries",
        "types",
        "icon_image",
        system_storage_backend,
    )
    from object_storage.services.object_transfer import rebuild_imported_reverse_relationships

    _recheck_restore_dependencies(checkpoint, snapshot, created)
    created_object_ids = {int(value) for value in created.get("object_ids", [])}
    for item in snapshot.get("namespaces", []):
        Namespace.objects.update_or_create(
            id=item["id"],
            defaults={
                "tenant": checkpoint.tenant,
                "name": item["name"],
                "slug": item["slug"],
                "description": item["description"],
                "is_active": item["is_active"],
                "is_default": item["is_default"],
                "created_by_id": item["created_by_id"],
            },
        )

    restored_types = []
    for item in snapshot.get("types", []):
        obj_type, _created = ObjectTypeDefinition.objects.update_or_create(
            id=item["id"],
            defaults={
                "name": item["name"],
                "label": item["label"],
                "plural_label": item["plural_label"],
                "description": item["description"],
                "schema": item["schema"],
                "slot_configuration": item["slot_configuration"],
                "hierarchy_level": item["hierarchy_level"],
                "is_active": item["is_active"],
                "metadata": item["metadata"],
                "namespace_id": item["namespace_id"],
                "icon_image": item["icon_image"],
                "created_by_id": item["created_by_id"],
            },
        )
        restored_types.append((obj_type, item))
    for obj_type, item in restored_types:
        obj_type.browser_group_id = item["browser_group_id"]
        obj_type.save(update_fields=["browser_group", "updated_at"])
        obj_type.allowed_child_types.set(item["allowed_child_type_ids"])

    existing_object_ids = [item["id"] for item in snapshot.get("objects", [])]
    created_object_ids = {int(value) for value in created.get("object_ids", [])}
    # Detach restored rows from import-created parents before deleting those
    # parents; model saves keep MPTT coordinates valid without a global rebuild.
    for obj in ObjectInstance.objects.filter(
        tenant=checkpoint.tenant,
        id__in=existing_object_ids,
        parent_id__in=created_object_ids,
    ):
        obj.parent = None
        obj.save(update_fields=["parent", "updated_at"])
    created_objects = list(
        ObjectInstance.objects.filter(tenant=checkpoint.tenant, id__in=created_object_ids).order_by("level")
    )
    created_ids_present = {obj.id for obj in created_objects}
    for obj in created_objects:
        if obj.parent_id not in created_ids_present and ObjectInstance.objects.filter(pk=obj.pk).exists():
            obj.delete()
    for item in snapshot.get("objects", []):
        obj = ObjectInstance.objects.select_for_update().filter(id=item["id"], tenant=checkpoint.tenant).first()
        if not obj:
            if not {"type_id", "slug", "title", "status", "created_by_id"}.issubset(item):
                raise ObjectInstance.DoesNotExist(f"Object {item['id']} is missing from this checkpoint restore.")
            obj = ObjectInstance.objects.create(
                id=item["id"],
                tenant=checkpoint.tenant,
                object_type_id=item["type_id"],
                slug=item["slug"],
                title=item["title"],
                status=item["status"],
                created_by_id=item["created_by_id"],
            )
        obj.current_version_id = None
        obj.save(update_fields=["current_version", "updated_at"])
        obj.versions.exclude(id__in=item["version_ids"]).delete()
        for version in item.get("versions", []):
            ObjectVersion.objects.update_or_create(
                id=version["id"],
                defaults={
                    "object_instance": obj,
                    "version_number": version["version_number"],
                    "data": version["data"],
                    "widgets": version["widgets"],
                    "created_by_id": version["created_by_id"],
                    "change_description": version["change_description"],
                    "effective_date": parse_datetime(version["effective_date"]) if version["effective_date"] else None,
                    "expiry_date": parse_datetime(version["expiry_date"]) if version["expiry_date"] else None,
                    "is_featured": version["is_featured"],
                },
            )
        ObjectInstance.objects.filter(pk=obj.pk).update(
            title=item["title"],
            status=item["status"],
            current_version_id=item["current_version_id"],
            publish_date=item["publish_date"],
            unpublish_date=item["unpublish_date"],
            version=item["version"],
            metadata=item["metadata"],
            relationships=item["relationships"],
        )
    # Reparent through MPTT in a second pass after every restored row exists.
    for item in snapshot.get("objects", []):
        obj = ObjectInstance.objects.get(id=item["id"], tenant=checkpoint.tenant)
        if obj.parent_id != item["parent_id"]:
            obj.parent_id = item["parent_id"]
            obj.save(update_fields=["parent", "updated_at"])
    tenant_objects = list(ObjectInstance.objects.filter(tenant=checkpoint.tenant))
    rebuild_imported_reverse_relationships(checkpoint.tenant, tenant_objects)

    _delete_created_media(checkpoint)
    for item in snapshot.get("media_tags", []):
        MediaTag.objects.update_or_create(
            id=item["id"],
            defaults={
                "namespace_id": item["namespace_id"],
                "name": item["name"],
                "slug": item["slug"],
                "color": item["color"],
                "description": item["description"],
                "created_by_id": item["created_by_id"],
            },
        )
    for item in snapshot.get("taxonomy_tags", []):
        TaxonomyTag.objects.update_or_create(
            id=item["id"],
            defaults={
                "tenant": checkpoint.tenant,
                "namespace_id": item["namespace_id"],
                "name": item["name"],
                "slug": item["slug"],
                "tag_type": item["tag_type"],
                "color": item["color"],
                "description": item["description"],
                "created_by_id": item["created_by_id"],
            },
        )
    for item in snapshot.get("collections", []):
        MediaCollection.objects.update_or_create(
            id=item["id"],
            defaults={
                "namespace_id": item["namespace_id"],
                "title": item["title"],
                "slug": item["slug"],
                "description": item["description"],
                "access_level": item["access_level"],
                "created_by_id": item["created_by_id"],
                "last_modified_by_id": item["last_modified_by_id"],
            },
        )
    for item in snapshot.get("media", []):
        media, _created = MediaFile.objects.with_deleted().update_or_create(
            id=item["id"],
            defaults={
                "tenant": checkpoint.tenant,
                "namespace_id": item["namespace_id"],
                "title": item["title"],
                "slug": item["slug"],
                "description": item["description"],
                "original_filename": item["original_filename"],
                "file_path": item["file_path"],
                "file_url": item["file_url"],
                "file_size": item["file_size"],
                "content_type": item["content_type"],
                "file_hash": item["file_hash"],
                "file_type": item["file_type"],
                "width": item["width"],
                "height": item["height"],
                "metadata": item["metadata"],
                "ai_generated_tags": item["ai_generated_tags"],
                "ai_suggested_title": item["ai_suggested_title"],
                "ai_extracted_text": item["ai_extracted_text"],
                "ai_confidence_score": item["ai_confidence_score"],
                "access_level": item["access_level"],
                "download_count": item["download_count"],
                "last_accessed": parse_datetime(item["last_accessed"]) if item["last_accessed"] else None,
                "reference_count": item["reference_count"],
                "last_referenced": parse_datetime(item["last_referenced"]) if item["last_referenced"] else None,
                "referenced_in": item["referenced_in"],
                "created_by_id": item["created_by_id"],
                "last_modified_by_id": item["last_modified_by_id"],
                "uploaded_by_id": item["uploaded_by_id"],
                "is_deleted": item["is_deleted"],
                "deleted_at": parse_datetime(item["deleted_at"]) if item["deleted_at"] else None,
                "deleted_by_id": item["deleted_by_id"],
            },
        )
        media.tags.set(item["tag_ids"])
        media.canonical_tags.set(item["canonical_tag_ids"])
        media.collections.set(item["collection_ids"])
    for item in snapshot.get("media", []):
        MediaFile.objects.with_deleted().filter(id=item["id"], tenant=checkpoint.tenant).update(
            replaced_by_id=item["replaced_by_id"]
        )

    for item in snapshot.get("collections", []):
        collection = MediaCollection.objects.select_for_update().get(id=item["id"], namespace__tenant=checkpoint.tenant)
        collection.tags.set(item["tag_ids"])
        collection.canonical_tags.set(item["canonical_tag_ids"])

    MediaCollection.objects.filter(id__in=created.get("collection_ids", [])).delete()
    MediaTag.objects.filter(id__in=created.get("media_tag_ids", [])).delete()
    TaxonomyTag.objects.filter(id__in=created.get("taxonomy_tag_ids", [])).delete()

    ObjectTypeDefinition.objects.filter(id__in=created.get("type_ids", [])).delete()
    Namespace.objects.filter(id__in=created.get("namespace_ids", [])).delete()
    checkpoint.source_details.pop("binary_recovery_failed", None)
    checkpoint.source_details["binary_cleanup_pending"] = True
    checkpoint.save(update_fields=["source_details", "updated_at"])
    checkpoint.mark_restored()
    return checkpoint
