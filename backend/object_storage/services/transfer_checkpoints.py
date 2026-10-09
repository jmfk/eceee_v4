"""Destination-owned checkpoints for bounded object-package imports."""

import hashlib

from django.db import models, transaction

from content.models import Namespace
from file_manager.models import MediaCollection, MediaFile, MediaTag
from file_manager.storage import S3MediaStorage, system_storage
from object_storage.models import ObjectInstance, ObjectTypeDefinition, TransferCheckpoint
from taxonomy.models import Tag as TaxonomyTag


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
        "version_ids": _string_ids(obj.versions.all()),
    }


def _media_snapshot(media):
    return {
        "id": str(media.id),
        "file_hash": media.file_hash,
        "file_path": media.file_path,
        "is_deleted": media.is_deleted,
        "deleted_at": _datetime(media.deleted_at),
        "deleted_by_id": media.deleted_by_id,
        "tag_ids": _string_ids(media.tags.all()),
        "canonical_tag_ids": _string_ids(media.canonical_tags.all()),
        "collection_ids": _string_ids(media.collections.all()),
    }


def capture_object_import_checkpoint(job, payload):
    """Persist the complete pre-import database scope before mutation starts."""
    tenant = job.tenant
    resolutions = job.options.get("type_resolutions", {})
    included_names = [
        item["name"] for item in payload.get("types", []) if resolutions.get(item["name"], "keep") != "skip"
    ]
    types = list(ObjectTypeDefinition.objects.filter(name__in=included_names).prefetch_related("allowed_child_types"))
    type_by_name = {item.name: item for item in types}
    object_keys = [
        (item["type"], item["slug"]) for item in payload.get("objects", []) if item["type"] in included_names
    ]
    existing_objects = list(
        ObjectInstance.objects.filter(tenant=tenant, object_type__name__in=included_names)
        .select_related("object_type")
        .prefetch_related("versions")
    )
    wanted_keys = set(object_keys)
    existing_objects = [item for item in existing_objects if (item.object_type.name, item.slug) in wanted_keys]
    existing_media = []
    seen_media = set()
    for item in payload.get("media", []):
        media = _existing_media(tenant, item["file_hash"])
        if media and media.id not in seen_media:
            existing_media.append(media)
            seen_media.add(media.id)

    tenant_namespace_ids = _string_ids(Namespace.objects.filter(tenant=tenant))
    snapshot = {
        "schema_version": 1,
        "types": [_type_snapshot(item) for item in types],
        "objects": [_object_snapshot(item) for item in existing_objects],
        "media": [_media_snapshot(item) for item in existing_media],
        "inventory": {
            "type_ids": [str(type_by_name[name].id) for name in included_names if name in type_by_name],
            "namespace_ids": tenant_namespace_ids,
            "media_tag_ids": _string_ids(MediaTag.objects.filter(namespace__tenant=tenant)),
            "taxonomy_tag_ids": _string_ids(TaxonomyTag.objects.filter(tenant=tenant)),
            "collection_ids": _string_ids(MediaCollection.objects.filter(namespace__tenant=tenant)),
        },
        "planned": {
            "type_names": included_names,
            "object_keys": [[type_name, slug] for type_name, slug in object_keys],
            "media_hashes": [item["file_hash"] for item in payload.get("media", [])],
        },
    }
    return TransferCheckpoint.objects.create(
        tenant=tenant,
        source_job=job,
        operation=TransferCheckpoint.OPERATION_OBJECT_IMPORT,
        resource_scopes=["objects", "media"],
        snapshot=snapshot,
        source_details={"job_id": str(job.id), "connection_id": str(job.connection_id or "")},
        created_by=job.created_by,
    )


def record_object_import_mutation(checkpoint, result, media_paths, type_icon_paths):
    """Bind records and storage objects created by the completed import to its checkpoint."""
    snapshot = checkpoint.snapshot
    inventory = snapshot["inventory"]
    tenant = checkpoint.tenant
    previous_object_ids = {str(item["id"]) for item in snapshot["objects"]}
    previous_media_ids = {item["id"] for item in snapshot["media"]}
    current_type_ids = {
        str(item.id) for item in ObjectTypeDefinition.objects.filter(name__in=snapshot["planned"]["type_names"])
    }
    checkpoint.created_resources = {
        "object_ids": sorted(set(map(str, result.get("object_map", {}).values())) - previous_object_ids),
        "media_ids": sorted(set(map(str, result.get("media_map", {}).values())) - previous_media_ids),
        "type_ids": sorted(current_type_ids - set(inventory["type_ids"])),
        "namespace_ids": sorted(
            set(_string_ids(Namespace.objects.filter(tenant=tenant))) - set(inventory["namespace_ids"])
        ),
        "media_tag_ids": sorted(
            set(_string_ids(MediaTag.objects.filter(namespace__tenant=tenant))) - set(inventory["media_tag_ids"])
        ),
        "taxonomy_tag_ids": sorted(
            set(_string_ids(TaxonomyTag.objects.filter(tenant=tenant))) - set(inventory["taxonomy_tag_ids"])
        ),
        "collection_ids": sorted(
            set(_string_ids(MediaCollection.objects.filter(namespace__tenant=tenant)))
            - set(inventory["collection_ids"])
        ),
        "media_paths": list(media_paths),
        "type_icon_paths": list(type_icon_paths),
    }
    checkpoint.save(update_fields=["created_resources", "updated_at"])


def _delete_created_media(checkpoint):
    paths = set(checkpoint.created_resources.get("media_paths", []))
    for media in MediaFile.objects.with_deleted().filter(
        tenant=checkpoint.tenant,
        id__in=checkpoint.created_resources.get("media_ids", []),
    ):
        paths.add(media.file_path)
        models.Model.delete(media)
    if paths:
        transaction.on_commit(lambda: [S3MediaStorage().delete(path) for path in paths])


def restore_object_import_checkpoint(checkpoint, user):
    """Restore one object-import checkpoint; repeated successful restores are no-ops."""
    try:
        return _restore_object_import_checkpoint(checkpoint, user)
    except Exception as exc:
        failed = TransferCheckpoint.objects.get(pk=checkpoint.pk, tenant=checkpoint.tenant)
        failed.mark_failed(exc)
        raise


@transaction.atomic
def _restore_object_import_checkpoint(checkpoint, user):
    checkpoint = TransferCheckpoint.objects.select_for_update().get(pk=checkpoint.pk, tenant=checkpoint.tenant)
    if checkpoint.status == TransferCheckpoint.STATUS_RESTORED:
        return checkpoint
    if checkpoint.status == TransferCheckpoint.STATUS_RESTORING:
        raise ValueError("This checkpoint is already being restored.")
    checkpoint.mark_restoring(user)
    snapshot = checkpoint.snapshot
    created = checkpoint.created_resources or {}
    existing_object_ids = [item["id"] for item in snapshot.get("objects", [])]
    ObjectInstance.objects.filter(tenant=checkpoint.tenant, id__in=existing_object_ids).update(parent_id=None)
    ObjectInstance.objects.filter(
        tenant=checkpoint.tenant,
        id__in=created.get("object_ids", []),
    ).delete()
    for item in snapshot.get("objects", []):
        obj = ObjectInstance.objects.select_for_update().get(id=item["id"], tenant=checkpoint.tenant)
        obj.current_version_id = None
        obj.save(update_fields=["current_version", "updated_at"])
        obj.versions.exclude(id__in=item["version_ids"]).delete()
        ObjectInstance.objects.filter(pk=obj.pk).update(
            title=item["title"],
            status=item["status"],
            parent_id=item["parent_id"],
            current_version_id=item["current_version_id"],
            publish_date=item["publish_date"],
            unpublish_date=item["unpublish_date"],
            version=item["version"],
            metadata=item["metadata"],
            relationships=item["relationships"],
        )
    ObjectInstance._tree_manager.rebuild()
    tenant_objects = list(ObjectInstance.objects.filter(tenant=checkpoint.tenant))
    from object_storage.services.object_transfer import rebuild_imported_reverse_relationships

    rebuild_imported_reverse_relationships(checkpoint.tenant, tenant_objects)

    _delete_created_media(checkpoint)
    for item in snapshot.get("media", []):
        media = MediaFile.objects.with_deleted().select_for_update().get(id=item["id"], tenant=checkpoint.tenant)
        MediaFile.objects.with_deleted().filter(pk=media.pk).update(
            is_deleted=item["is_deleted"],
            deleted_at=item["deleted_at"],
            deleted_by_id=item["deleted_by_id"],
        )
        media.tags.set(item["tag_ids"])
        media.canonical_tags.set(item["canonical_tag_ids"])
        media.collections.set(item["collection_ids"])

    MediaCollection.objects.filter(id__in=created.get("collection_ids", [])).delete()
    MediaTag.objects.filter(id__in=created.get("media_tag_ids", []), mediafile__isnull=True).delete()
    TaxonomyTag.objects.filter(
        id__in=created.get("taxonomy_tag_ids", []),
        media_files__isnull=True,
        media_collections__isnull=True,
    ).delete()

    for item in snapshot.get("types", []):
        obj_type = ObjectTypeDefinition.objects.select_for_update().get(id=item["id"])
        for field in (
            "label",
            "plural_label",
            "description",
            "schema",
            "slot_configuration",
            "hierarchy_level",
            "is_active",
            "metadata",
        ):
            setattr(obj_type, field, item[field])
        obj_type.namespace_id = item["namespace_id"]
        obj_type.browser_group_id = item["browser_group_id"]
        obj_type.icon_image.name = item["icon_image"]
        obj_type.save()
        obj_type.allowed_child_types.set(item["allowed_child_type_ids"])
    ObjectTypeDefinition.objects.filter(id__in=created.get("type_ids", []), objectinstance__isnull=True).delete()
    Namespace.objects.filter(id__in=created.get("namespace_ids", [])).delete()

    icon_paths = created.get("type_icon_paths", [])
    if icon_paths:
        transaction.on_commit(lambda: [system_storage.delete(path) for path in icon_paths])
    checkpoint.mark_restored()
    return checkpoint
