"""Bounded ZIP packages for selected object trees and their dependencies."""

import hashlib
import json
import os
import re
import zipfile
from collections import deque
from typing import Any

from django.core.files import File
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify

from content.models import Namespace
from file_manager.models import MediaCollection, MediaFile, MediaTag
from file_manager.storage import S3MediaStorage, system_storage
from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion
from taxonomy.models import Tag as TaxonomyTag

PACKAGE_VERSION = "object-transfer/1"
MAX_CANDIDATES_PER_TYPE = 500
MAX_OBJECTS = 10_000
MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024
MAX_ENTRIES = 25_000
# Bound ZIP headers and worst-case deflate overhead separately from member sizes.
MAX_ARCHIVE_BYTES = MAX_UNCOMPRESSED_BYTES + 64 * 1024 * 1024
UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
URL_RE = re.compile(r"https?://[^\s\"'<>\\)]+", re.IGNORECASE)


def _json_default(value):
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _walk(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from _walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk(item)
    elif isinstance(value, str):
        yield value


def selected_versions(obj):
    current = obj.get_current_published_version()
    if current:
        return [current, *obj.versions.filter(version_number__gt=current.version_number).order_by("version_number")]
    latest = obj.versions.order_by("-version_number").first()
    return [latest] if latest else []


def _reference_field_names(obj_type):
    return {
        name
        for name, definition in ((obj_type.schema or {}).get("properties") or {}).items()
        if (definition.get("component_type") or definition.get("componentType")) == "object_reference"
    }


def _reference_ids(value):
    if isinstance(value, dict):
        candidate = value.get("object_id") or value.get("objectId") or value.get("id")
        if candidate is not None:
            yield candidate
        for item in value.values():
            yield from _reference_ids(item)
    elif isinstance(value, list):
        for item in value:
            yield from _reference_ids(item)
    elif isinstance(value, int) or (isinstance(value, str) and value.isdigit()):
        yield value


def _collect_media_files(tenant, versions):
    texts = [text for version in versions for text in _walk({"data": version.data, "widgets": version.widgets})]
    media_ids = {match.lower() for text in texts for match in UUID_RE.findall(text)}
    joined = "\n".join(texts)
    if joined:
        candidates = MediaFile.objects.filter(tenant=tenant, is_deleted=False).select_related("namespace")
        for media in candidates.only(
            "id",
            "file_path",
            "file_url",
            "original_filename",
            "content_type",
            "slug",
            "namespace__slug",
        ):
            references = (media.file_path, media.file_url, media.get_absolute_url())
            if any(reference and reference in joined for reference in references):
                media_ids.add(str(media.id))
    return list(
        MediaFile.objects.filter(tenant=tenant, id__in=media_ids, is_deleted=False)
        .select_related("namespace")
        .prefetch_related("tags", "canonical_tags", "collections__tags", "collections__canonical_tags")
    )


def collect_object_graph(tenant, root_ids):
    roots = list(ObjectInstance.objects.filter(tenant=tenant, parent__isnull=True, id__in=root_ids))
    if len(roots) != len(set(root_ids)):
        raise ValueError("One or more selected root objects are unavailable.")
    collected = {}
    queue = deque(roots)
    while queue:
        obj = queue.popleft()
        if obj.id in collected:
            continue
        collected[obj.id] = obj
        if len(collected) > MAX_OBJECTS:
            raise ValueError(f"The selection expands beyond the {MAX_OBJECTS} object limit.")
        queue.extend(obj.children.filter(tenant=tenant).select_related("object_type"))
        related_ids = {
            rel.get("object_id") for rel in (obj.relationships or []) if isinstance(rel, dict) and rel.get("object_id")
        }
        reference_fields = _reference_field_names(obj.object_type)
        for version in selected_versions(obj):
            for field_name in reference_fields:
                related_ids.update(_reference_ids((version.data or {}).get(field_name)))
        if related_ids:
            queue.extend(ObjectInstance.objects.filter(tenant=tenant, id__in=related_ids).select_related("object_type"))
    return list(collected.values())


def collect_type_definitions(objects):
    """Collect object types plus the topology types they reference."""
    collected = {}
    queue = deque(obj.object_type for obj in objects)
    while queue:
        obj_type = queue.popleft()
        if obj_type.id in collected:
            continue
        collected[obj_type.id] = obj_type
        queue.extend(obj_type.allowed_child_types.all())
        if obj_type.browser_group_id:
            queue.append(obj_type.browser_group)
    return collected


def candidate_catalog(tenant, selections):
    results = []
    for selection in selections:
        type_name = str(selection.get("object_type") or "").strip()
        try:
            requested_limit = int(selection.get("limit") or 100)
        except (TypeError, ValueError):
            requested_limit = 100
        limit = min(max(requested_limit, 1), MAX_CANDIDATES_PER_TYPE)
        obj_type = ObjectTypeDefinition.objects.filter(name=type_name, is_active=True).first()
        if not obj_type:
            continue
        roots = ObjectInstance.objects.filter(tenant=tenant, object_type=obj_type, parent__isnull=True).order_by(
            "-created_at", "-id"
        )[:limit]
        results.append(
            {
                "object_type": serialize_type(obj_type),
                "limit": limit,
                "candidates": [
                    {
                        "id": obj.id,
                        "title": obj.title,
                        "slug": obj.slug,
                        "status": obj.status,
                        "created_at": obj.created_at,
                        "descendant_count": obj.get_descendant_count(),
                    }
                    for obj in roots
                ],
            }
        )
    return results


def serialize_type(obj_type):
    return {
        "name": obj_type.name,
        "label": obj_type.label,
        "plural_label": obj_type.plural_label,
        "description": obj_type.description,
        "schema": obj_type.schema,
        "slot_configuration": obj_type.slot_configuration,
        "hierarchy_level": obj_type.hierarchy_level,
        "is_active": obj_type.is_active,
        "metadata": obj_type.metadata,
        "icon_filename": os.path.basename(obj_type.icon_image.name) if obj_type.icon_image else None,
        "namespace": (
            {
                "name": obj_type.namespace.name,
                "slug": obj_type.namespace.slug,
                "description": obj_type.namespace.description,
            }
            if obj_type.namespace_id
            else None
        ),
        "allowed_child_types": list(obj_type.allowed_child_types.values_list("name", flat=True)),
        "browser_group": obj_type.browser_group.name if obj_type.browser_group_id else None,
    }


def type_is_compatible(local, remote):
    """Return true when remote fields and slots fit the local contract."""
    local_schema = local.schema or {}
    remote_schema = remote.get("schema") or {}
    if local_schema.get("type", "object") != remote_schema.get("type", "object"):
        return False
    local_root_constraints = {
        key: value for key, value in local_schema.items() if key not in {"properties", "required"}
    }
    remote_root_constraints = {
        key: value for key, value in remote_schema.items() if key not in {"properties", "required"}
    }
    if local_root_constraints != remote_root_constraints:
        return False
    if local.hierarchy_level != (remote.get("hierarchy_level") or remote.get("hierarchyLevel")):
        return False

    local_properties = local_schema.get("properties", {})
    remote_properties = remote_schema.get("properties", {})
    local_required = set(local_schema.get("required", []))
    remote_required = set(remote_schema.get("required", []))
    if not local_required.issubset(remote_required):
        return False

    def normalized_definition(definition):
        normalized = dict(definition)
        if "componentType" in normalized and "component_type" not in normalized:
            normalized["component_type"] = normalized.pop("componentType")
        return normalized

    for name, definition in remote_properties.items():
        local_definition = local_properties.get(name)
        if local_definition is None or normalized_definition(local_definition) != normalized_definition(definition):
            return False

    local_slot_configuration = local.slot_configuration or {}
    remote_slot_configuration = remote.get("slot_configuration") or remote.get("slotConfiguration") or {}
    local_slot_constraints = {key: value for key, value in local_slot_configuration.items() if key != "slots"}
    remote_slot_constraints = {key: value for key, value in remote_slot_configuration.items() if key != "slots"}
    if local_slot_constraints != remote_slot_constraints:
        return False

    local_slots = {item.get("name"): item for item in local_slot_configuration.get("slots", []) if item.get("name")}
    remote_slots = {item.get("name"): item for item in remote_slot_configuration.get("slots", []) if item.get("name")}
    slots_compatible = all(
        local_slots.get(name) == definition for name, definition in remote_slots.items()
    ) and not any(definition.get("required") for name, definition in local_slots.items() if name not in remote_slots)
    if not slots_compatible:
        return False

    local_children = _local_allowed_child_type_names(local)
    remote_children = set(remote.get("allowed_child_types") or remote.get("allowedChildTypes") or [])
    local_browser_group = getattr(getattr(local, "browser_group", None), "name", None)
    remote_browser_group = remote.get("browser_group") or remote.get("browserGroup")
    return remote_children.issubset(local_children) and local_browser_group == remote_browser_group


def _local_allowed_child_type_names(obj_type):
    relation = getattr(obj_type, "allowed_child_types", None)
    if relation is None:
        return set()
    return set(relation.values_list("name", flat=True))


def type_definition_differs(local, remote):
    """Compare the complete structural contract used by imported objects."""
    if any(getattr(local, field) != remote.get(field) for field in ("schema", "slot_configuration", "hierarchy_level")):
        return True
    remote_children = set(remote.get("allowed_child_types") or remote.get("allowedChildTypes") or [])
    remote_browser_group = remote.get("browser_group") or remote.get("browserGroup")
    local_browser_group = getattr(getattr(local, "browser_group", None), "name", None)
    return _local_allowed_child_type_names(local) != remote_children or local_browser_group != remote_browser_group


def type_has_foreign_tenant_usage(obj_type, tenant):
    """Return true when changing a global type would affect another tenant."""
    return (
        type_has_foreign_namespace(obj_type, tenant)
        or ObjectInstance.objects.filter(object_type=obj_type).exclude(tenant=tenant).exists()
    )


def type_has_foreign_namespace(obj_type, tenant):
    namespace_tenant_id = obj_type.namespace.tenant_id if obj_type.namespace_id else None
    return namespace_tenant_id is not None and namespace_tenant_id != tenant.id


def serialize_media(media):
    return {
        "source_id": str(media.id),
        "title": media.title,
        "slug": media.slug,
        "description": media.description,
        "original_filename": media.original_filename,
        "file_path": media.file_path,
        "file_url": media.file_url,
        "storage_url": media.get_file_url(),
        "canonical_url": media.get_absolute_url(),
        "file_size": media.file_size,
        "content_type": media.content_type,
        "file_hash": media.file_hash,
        "file_type": media.file_type,
        "width": media.width,
        "height": media.height,
        "metadata": media.metadata,
        "ai_generated_tags": media.ai_generated_tags,
        "access_level": media.access_level,
        "namespace": {"name": media.namespace.name, "slug": media.namespace.slug},
        "media_tags": [
            {"name": tag.name, "slug": tag.slug, "color": tag.color, "description": tag.description}
            for tag in media.tags.all()
        ],
        "canonical_tags": [
            {
                "name": tag.name,
                "slug": tag.slug,
                "tag_type": tag.tag_type,
                "color": tag.color,
                "description": tag.description,
            }
            for tag in media.canonical_tags.all()
        ],
        "collections": [
            {
                "title": collection.title,
                "slug": collection.slug,
                "description": collection.description,
                "access_level": collection.access_level,
                "media_tags": [
                    {"name": tag.name, "slug": tag.slug, "color": tag.color, "description": tag.description}
                    for tag in collection.tags.all()
                ],
                "canonical_tags": [
                    {
                        "name": tag.name,
                        "slug": tag.slug,
                        "tag_type": tag.tag_type,
                        "color": tag.color,
                        "description": tag.description,
                    }
                    for tag in collection.canonical_tags.all()
                ],
            }
            for collection in media.collections.all()
        ],
    }


def _build_payload(objects, media_files, type_map):
    object_ids = {obj.id for obj in objects}
    return {
        "types": [serialize_type(value) for value in sorted(type_map.values(), key=lambda value: value.name)],
        "objects": [
            {
                "source_id": obj.id,
                "type": obj.object_type.name,
                "parent_source_id": obj.parent_id if obj.parent_id in object_ids else None,
                "title": obj.title,
                "slug": obj.slug,
                "status": obj.status,
                "metadata": obj.metadata,
                "relationships": obj.relationships,
                "publish_date": obj.publish_date,
                "unpublish_date": obj.unpublish_date,
                "versions": [
                    {
                        "source_id": version.id,
                        "version_number": version.version_number,
                        "data": version.data,
                        "widgets": version.widgets,
                        "change_description": version.change_description,
                        "effective_date": version.effective_date,
                        "expiry_date": version.expiry_date,
                        "is_featured": version.is_featured,
                    }
                    for version in selected_versions(obj)
                ],
            }
            for obj in objects
        ],
        "media": [serialize_media(media) for media in media_files],
    }


def _media_member_name(media):
    return f"media/{media.id}/{os.path.basename(media.file_path)}"


def _type_icon_member_name(obj_type):
    return f"type-icons/{slugify(obj_type.name)}/{os.path.basename(obj_type.icon_image.name)}"


def _build_manifest(root_ids, objects, versions, media_files, icon_count, checksums):
    return {
        "package_version": PACKAGE_VERSION,
        "exported_at": timezone.now(),
        "root_ids": root_ids,
        "counts": {
            "objects": len(objects),
            "versions": len(versions),
            "media": len(media_files),
            "type_icons": icon_count,
        },
        "checksums": checksums,
    }


def build_preflight(tenant, root_ids):
    objects = collect_object_graph(tenant, root_ids)
    versions = [version for obj in objects for version in selected_versions(obj)]
    texts = [text for version in versions for text in _walk({"data": version.data, "widgets": version.widgets})]
    media = _collect_media_files(tenant, versions)
    owned_references = {
        reference
        for item in media
        for reference in (item.file_path, item.file_url, item.get_absolute_url())
        if reference
    }
    external_urls = {
        url
        for text in texts
        for url in URL_RE.findall(text)
        if not any(reference in url or url in reference for reference in owned_references)
    }
    media_bytes = sum(item.file_size or 0 for item in media)
    types = collect_type_definitions(objects)
    namespaces = {}
    for obj_type in types.values():
        if obj_type.namespace_id:
            namespaces[obj_type.namespace.slug] = {
                "name": obj_type.namespace.name,
                "slug": obj_type.namespace.slug,
                "description": obj_type.namespace.description,
            }
    for item in media:
        namespaces[item.namespace.slug] = {
            "name": item.namespace.name,
            "slug": item.namespace.slug,
            "description": item.namespace.description,
        }
    payload_bytes = json.dumps(_build_payload(objects, media, types), default=_json_default).encode()
    checksums = {"objects.json": "0" * 64}
    checksums.update({_media_member_name(item): "0" * 64 for item in media})
    icon_bytes = 0
    icon_count = 0
    for obj_type in types.values():
        if not obj_type.icon_image:
            continue
        checksums[_type_icon_member_name(obj_type)] = "0" * 64
        icon_bytes += obj_type.icon_image.size
        icon_count += 1
    entry_count = len(media) + icon_count + 2
    manifest = _build_manifest(root_ids, objects, versions, media, icon_count, checksums)
    manifest_bytes = json.dumps(manifest, default=_json_default).encode()
    uncompressed_bytes = len(payload_bytes) + media_bytes + icon_bytes + len(manifest_bytes)
    return {
        "object_count": len(objects),
        "version_count": len(versions),
        "media_count": len(media),
        "media_bytes": media_bytes,
        "type_icon_count": icon_count,
        "type_count": len(types),
        "types": [serialize_type(item) for item in sorted(types.values(), key=lambda value: value.name)],
        "namespaces": sorted(namespaces.values(), key=lambda value: value["slug"]),
        "objects": [
            {"type": obj.object_type.name, "slug": obj.slug, "title": obj.title}
            for obj in sorted(objects, key=lambda value: (value.object_type.name, value.slug))
        ],
        "external_urls": sorted(external_urls),
        "limits": {
            "max_objects": MAX_OBJECTS,
            "max_entries": MAX_ENTRIES,
            "max_uncompressed_bytes": MAX_UNCOMPRESSED_BYTES,
            "entry_count": entry_count,
            "uncompressed_bytes": uncompressed_bytes,
            "within_limits": (
                len(objects) <= MAX_OBJECTS
                and entry_count <= MAX_ENTRIES
                and uncompressed_bytes <= MAX_UNCOMPRESSED_BYTES
            ),
        },
    }


class ObjectPackageExporter:
    def __init__(self, job, storage=None):
        self.job = job
        self.storage = storage or S3MediaStorage()

    def run(self):
        from webpages.services.site_package import MultipartUploadWriter

        self.job.mark_running(phase="packaging")
        key = self.job.object_key or f"object-transfers/exports/{self.job.id}.zip"
        writer = MultipartUploadWriter(self.storage, key)
        try:
            with zipfile.ZipFile(writer, "w", zipfile.ZIP_DEFLATED, allowZip64=True) as package:
                manifest = self.write_package(package)
            writer.complete()
        except Exception as exc:
            writer.abort()
            self.job.mark_failed(exc)
            raise
        self.job.object_key = key
        self.job.mark_completed(phase="completed", manifest=manifest)
        return key

    def write_package(self, package):
        root_ids = [int(value) for value in self.job.options.get("root_ids", [])]
        objects = collect_object_graph(self.job.tenant, root_ids)
        versions = [version for obj in objects for version in selected_versions(obj)]
        media_files = _collect_media_files(self.job.tenant, versions)
        type_map = collect_type_definitions(objects)
        payload = _build_payload(objects, media_files, type_map)
        objects_json = json.dumps(payload, default=_json_default).encode()
        icon_types = [obj_type for obj_type in type_map.values() if obj_type.icon_image]
        entry_count = len(media_files) + len(icon_types) + 2
        if entry_count > MAX_ENTRIES:
            raise ValueError("The object package exceeds safety limits.")
        package.writestr("objects.json", objects_json)
        checksums = {"objects.json": hashlib.sha256(objects_json).hexdigest()}
        total_uncompressed = len(objects_json)
        for media in media_files:
            file_obj = self.storage._open(media.file_path, "rb")
            try:
                member = _media_member_name(media)
                digest = hashlib.sha256()
                with package.open(member, "w", force_zip64=True) as destination:
                    while chunk := file_obj.read(1024 * 1024):
                        total_uncompressed += len(chunk)
                        if total_uncompressed > MAX_UNCOMPRESSED_BYTES:
                            raise ValueError("The object package exceeds safety limits.")
                        digest.update(chunk)
                        destination.write(chunk)
                checksums[member] = digest.hexdigest()
            finally:
                file_obj.close()
        icon_count = 0
        for obj_type in icon_types:
            member = _type_icon_member_name(obj_type)
            digest = hashlib.sha256()
            with obj_type.icon_image.open("rb") as source, package.open(member, "w", force_zip64=True) as destination:
                while chunk := source.read(1024 * 1024):
                    total_uncompressed += len(chunk)
                    if total_uncompressed > MAX_UNCOMPRESSED_BYTES:
                        raise ValueError("The object package exceeds safety limits.")
                    digest.update(chunk)
                    destination.write(chunk)
            checksums[member] = digest.hexdigest()
            icon_count += 1
        manifest = _build_manifest(root_ids, objects, versions, media_files, icon_count, checksums)
        manifest_json = json.dumps(manifest, default=_json_default).encode()
        if total_uncompressed + len(manifest_json) > MAX_UNCOMPRESSED_BYTES:
            raise ValueError("The object package exceeds safety limits.")
        package.writestr("manifest.json", manifest_json)
        return manifest


def validate_package(package):
    members = [item for item in package.infolist() if not item.is_dir()]
    if len(members) > MAX_ENTRIES or sum(item.file_size for item in members) > MAX_UNCOMPRESSED_BYTES:
        raise ValueError("The object package exceeds safety limits.")
    for item in members:
        if item.filename.startswith("/") or ".." in item.filename.split("/"):
            raise ValueError("The object package contains an unsafe path.")
    if package.testzip() is not None:
        raise ValueError("The object package is corrupt.")
    manifest = json.loads(package.read("manifest.json"))
    if manifest.get("package_version") != PACKAGE_VERSION:
        raise ValueError("Unsupported object package version.")
    checksums = manifest.get("checksums")
    checked_members = {item.filename for item in members if item.filename != "manifest.json"}
    if not isinstance(checksums, dict) or set(checksums) != checked_members:
        raise ValueError("The object package checksum manifest is incomplete.")
    for name, expected in checksums.items():
        if name not in package.namelist():
            raise ValueError(f"The object package is missing {name}.")
        digest = hashlib.sha256()
        with package.open(name) as source:
            while chunk := source.read(1024 * 1024):
                digest.update(chunk)
        if digest.hexdigest() != expected:
            raise ValueError(f"The object package checksum failed for {name}.")
    payload = json.loads(package.read("objects.json"))
    if len(payload.get("objects", [])) > MAX_OBJECTS:
        raise ValueError(f"The object package exceeds the {MAX_OBJECTS} object limit.")
    return manifest, payload


def _namespace(tenant, user, data, resolutions=None):
    resolutions = resolutions or {}
    if not data:
        namespace = Namespace.objects.filter(tenant=tenant, is_default=True).first()
        if namespace:
            return namespace
        namespace = Namespace.objects.filter(tenant=tenant, is_active=True).first()
        if namespace:
            return namespace
        base_slug = slugify(tenant.identifier)[:90] or "workspace"
        slug = base_slug
        counter = 2
        while Namespace.objects.filter(slug=slug).exists():
            slug = f"{base_slug[: 98 - len(str(counter))]}-{counter}"
            counter += 1
        base_name = f"{tenant.name} content"[:90]
        name = base_name
        counter = 2
        while Namespace.objects.filter(name=name).exists():
            name = f"{base_name[: 98 - len(str(counter))]} {counter}"
            counter += 1
        return Namespace.objects.create(
            tenant=tenant,
            created_by=user,
            name=name,
            slug=slug,
        )
    mapped_slug = resolutions.get(data["slug"], data["slug"])
    mapped = Namespace.objects.filter(tenant=tenant, slug=mapped_slug).first()
    if mapped:
        return mapped
    namespace = Namespace.objects.filter(tenant=tenant, slug=data["slug"]).first()
    if namespace:
        return namespace
    if Namespace.objects.filter(slug=data["slug"]).exclude(tenant=tenant).exists():
        raise ValueError(f"Namespace {data['slug']} belongs to another workspace and needs an explicit mapping.")
    if (
        Namespace.objects.filter(name=data.get("name") or data["slug"])
        .exclude(tenant=tenant, slug=data["slug"])
        .exists()
    ):
        raise ValueError(f"Namespace {data['name']} conflicts with another workspace and needs an explicit mapping.")
    return Namespace.objects.create(
        tenant=tenant,
        created_by=user,
        name=data.get("name") or data["slug"],
        slug=data["slug"],
        description=data.get("description", ""),
    )


def _remap_object_reference(value, object_map, skipped_ids, require_mapping=True):
    if isinstance(value, dict):
        candidate = value.get("object_id") or value.get("objectId") or value.get("id")
        if candidate is not None:
            mapped_candidate = object_map.get(str(candidate))
            if mapped_candidate is None:
                return None
            return {
                key: (
                    mapped_candidate
                    if key in {"object_id", "objectId", "id"}
                    else _remap_object_reference(item, object_map, skipped_ids, require_mapping=False)
                )
                for key, item in value.items()
            }
        return {
            key: _remap_object_reference(item, object_map, skipped_ids, require_mapping=require_mapping)
            for key, item in value.items()
            if str(item) not in skipped_ids
        }
    if isinstance(value, list):
        return [
            mapped
            for item in value
            if (
                mapped := _remap_object_reference(
                    item,
                    object_map,
                    skipped_ids,
                    require_mapping=require_mapping,
                )
            )
            is not None
        ]
    if str(value) in object_map:
        return object_map[str(value)]
    if str(value) in skipped_ids or require_mapping:
        return None
    return value


def _remap(
    value: Any,
    object_map,
    media_map,
    reference_fields=None,
    skipped_ids=None,
    media_replacements=None,
):
    reference_fields = reference_fields or set()
    skipped_ids = skipped_ids or set()
    media_replacements = media_replacements or {}
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if key in reference_fields or key in {"object_id", "objectId"}:
                mapped = _remap_object_reference(item, object_map, skipped_ids)
            else:
                mapped = _remap(item, object_map, media_map, reference_fields, skipped_ids, media_replacements)
            if mapped is not None:
                result[key] = mapped
        return result
    if isinstance(value, list):
        return [
            mapped
            for item in value
            if (mapped := _remap(item, object_map, media_map, reference_fields, skipped_ids, media_replacements))
            is not None
        ]
    if isinstance(value, str):
        value = UUID_RE.sub(lambda match: str(media_map.get(match.group(0).lower(), match.group(0))), value)
        for source, destination in sorted(media_replacements.items(), key=lambda item: len(item[0]), reverse=True):
            value = value.replace(source, destination)
        return value
    if str(value) in media_map:
        return media_map[str(value)]
    return value


def rebuild_imported_reverse_relationships(tenant, objects):
    """Rebuild reverse relationships for imported targets in one tenant-scoped pass."""
    targets = {str(obj.id): obj for obj in objects}
    if not targets:
        return

    reverse_relations = {target_id: [] for target_id in targets}
    seen = {target_id: set() for target_id in targets}
    sources = (
        ObjectInstance.objects.filter(tenant=tenant)
        .exclude(relationships=[])
        .values_list("id", "relationships")
        .iterator()
    )
    for source_id, relationships in sources:
        for relationship in relationships or []:
            target_id = str(relationship.get("object_id"))
            if target_id not in targets or target_id == str(source_id):
                continue
            relation_key = (relationship.get("type"), source_id)
            if relation_key in seen[target_id]:
                continue
            seen[target_id].add(relation_key)
            reverse_relations[target_id].append({"type": relationship.get("type"), "object_id": source_id})

    imported_objects = list(targets.values())
    for target_id, obj in targets.items():
        obj.related_from = reverse_relations[target_id]
    ObjectInstance.objects.bulk_update(imported_objects, ["related_from"], batch_size=500)


def _relationship_target_ids(relationships):
    target_ids = set()
    for relationship in relationships or []:
        if not isinstance(relationship, dict):
            continue
        value = relationship.get("object_id")
        try:
            target_ids.add(int(value))
        except (TypeError, ValueError):
            continue
    return target_ids


class ObjectPackageImporter:
    def __init__(self, job, storage=None):
        self.job = job
        self.storage = storage or S3MediaStorage()
        self.created_media_paths = []
        self.created_type_icon_paths = []
        self.media_replacements = {}

    def run(self):
        self.job.mark_running(phase="importing")
        file_obj = self.storage._open(self.job.object_key, "rb")
        try:
            with zipfile.ZipFile(file_obj, "r") as package:
                result = self.import_package(package)
        except Exception as exc:
            for path in self.created_media_paths:
                try:
                    self.storage.delete(path)
                except Exception:
                    pass
            for path in self.created_type_icon_paths:
                try:
                    system_storage.delete(path)
                except Exception:
                    pass
            self.job.mark_failed(exc)
            raise
        finally:
            file_obj.close()
        self.job.mark_completed(phase="completed", **result)
        return result

    @transaction.atomic
    def import_package(self, package):
        manifest, payload = validate_package(package)
        tenant, user = self.job.tenant, self.job.created_by
        resolutions = self.job.options.get("type_resolutions", {})
        namespace_resolutions = self.job.options.get("namespace_resolutions", {})
        type_map = {}
        pending_relations = []
        for data in payload["types"]:
            existing = ObjectTypeDefinition.objects.filter(name=data["name"]).first()
            created = existing is None
            differs = existing and type_definition_differs(existing, data)
            resolution = resolutions.get(data["name"], "keep")
            compatible = existing and type_is_compatible(existing, data)
            foreign_namespace = existing and type_has_foreign_namespace(existing, tenant)
            if differs and resolution == "keep" and not compatible:
                raise ValueError(f"Local object type {data['name']} is not compatible with the remote definition.")
            if resolution == "skip" and (differs or foreign_namespace):
                continue
            if foreign_namespace:
                raise ValueError(f"Object type {data['name']} is used by another workspace and cannot be reused.")
            if resolution == "update" and existing and type_has_foreign_tenant_usage(existing, tenant):
                raise ValueError(f"Object type {data['name']} is used by another workspace and cannot be updated.")
            if differs and resolution not in {"keep", "update"}:
                raise ValueError(f"Resolve the object type conflict for {data['name']} before importing.")
            namespace = _namespace(tenant, user, data.get("namespace"), namespace_resolutions)
            if not existing:
                existing = ObjectTypeDefinition.objects.create(
                    name=data["name"], label=data["label"], plural_label=data["plural_label"], created_by=user
                )
            if created or resolution == "update":
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
                    setattr(existing, field, data.get(field, getattr(existing, field)))
                existing.namespace = namespace
                existing.save()
                icon_member = next(
                    (name for name in package.namelist() if name.startswith(f"type-icons/{slugify(data['name'])}/")),
                    None,
                )
                if icon_member:
                    checksum = manifest["checksums"][icon_member]
                    suffix = os.path.splitext(data.get("icon_filename") or icon_member)[1]
                    icon_path = f"object_types/icons/remote/{slugify(data['name'])}/{checksum}{suffix}"
                    if not system_storage.exists(icon_path):
                        with package.open(icon_member) as source:
                            saved_path = system_storage.save(icon_path, File(source, name=os.path.basename(icon_path)))
                        self.created_type_icon_paths.append(saved_path)
                        icon_path = saved_path
                    existing.icon_image.name = icon_path
                    existing.save(update_fields=["icon_image", "updated_at"])
            type_map[data["name"]] = existing
            if created or resolution == "update":
                pending_relations.append((existing, data))
        for obj_type, data in pending_relations:
            obj_type.allowed_child_types.set(
                type_map[name] for name in data.get("allowed_child_types", []) if name in type_map
            )
            obj_type.browser_group = type_map.get(data.get("browser_group"))
            obj_type.save(update_fields=["browser_group", "updated_at"])

        media_map = self._import_media(package, payload.get("media", []))
        object_map = {}
        source_payloads = {}
        affected_reverse_target_ids = set()
        skipped_ids = {str(item["source_id"]) for item in payload["objects"] if item["type"] not in type_map}
        for data in payload["objects"]:
            obj_type = type_map.get(data["type"])
            if not obj_type:
                continue
            obj, created = ObjectInstance.objects.get_or_create(
                tenant=tenant,
                object_type=obj_type,
                slug=data["slug"],
                defaults={"title": data["title"], "status": data["status"], "created_by": user},
            )
            if created and obj.current_version_id:
                obj.versions.all().delete()
                obj.current_version = None
                obj.version = 1
            affected_reverse_target_ids.update(_relationship_target_ids(obj.relationships))
            obj.title = data["title"]
            obj.status = data["status"]
            obj.metadata = data.get("metadata", {})
            obj.publish_date = (
                parse_datetime(data.get("publish_date"))
                if isinstance(data.get("publish_date"), str)
                else data.get("publish_date")
            )
            obj.unpublish_date = (
                parse_datetime(data.get("unpublish_date"))
                if isinstance(data.get("unpublish_date"), str)
                else data.get("unpublish_date")
            )
            obj.save()
            object_map[str(data["source_id"])] = obj.id
            source_payloads[str(data["source_id"])] = (obj, data)

        created_versions = 0
        for source_id, (obj, data) in source_payloads.items():
            parent_id = object_map.get(str(data.get("parent_source_id")))
            obj.parent_id = parent_id
            obj.relationships = _remap(
                data.get("relationships", []),
                object_map,
                media_map,
                {"object_id", "objectId"},
                skipped_ids,
                self.media_replacements,
            )
            obj.relationships = [item for item in obj.relationships if item.get("object_id") is not None]
            affected_reverse_target_ids.update(_relationship_target_ids(obj.relationships))
            obj.save(update_fields=["parent", "relationships", "updated_at"])
            reference_fields = _reference_field_names(obj.object_type)
            existing_versions = list(obj.versions.order_by("version_number"))
            selected_version = obj.current_version
            selected_version_created = False
            for version_data in data.get("versions", []):
                version_payload = {
                    "data": _remap(
                        version_data.get("data", {}),
                        object_map,
                        media_map,
                        reference_fields,
                        skipped_ids,
                        self.media_replacements,
                    ),
                    "widgets": _remap(
                        version_data.get("widgets", {}),
                        object_map,
                        media_map,
                        {"object_id", "objectId"},
                        skipped_ids,
                        self.media_replacements,
                    ),
                    "effective_date": (
                        parse_datetime(version_data.get("effective_date"))
                        if version_data.get("effective_date")
                        else None
                    ),
                    "expiry_date": (
                        parse_datetime(version_data.get("expiry_date")) if version_data.get("expiry_date") else None
                    ),
                    "is_featured": version_data.get("is_featured", False),
                }
                matching_version = next(
                    (
                        version
                        for version in reversed(existing_versions)
                        if all(getattr(version, key) == value for key, value in version_payload.items())
                    ),
                    None,
                )
                if matching_version:
                    selected_version = matching_version
                    selected_version_created = False
                    continue
                number = (existing_versions[-1].version_number if existing_versions else 0) + 1
                selected_version = ObjectVersion.objects.create(
                    object_instance=obj,
                    version_number=number,
                    created_by=user,
                    change_description="Remote object import",
                    **version_payload,
                )
                existing_versions.append(selected_version)
                selected_version_created = True
                created_versions += 1
            if selected_version_created and obj.current_version_id != selected_version.id:
                obj.current_version = selected_version
                obj.version = selected_version.version_number
                obj.save(update_fields=["current_version", "version", "updated_at"])
        imported_objects = [obj for obj, _data in source_payloads.values()]
        imported_ids = {obj.id for obj in imported_objects}
        affected_targets = list(
            ObjectInstance.objects.filter(tenant=tenant, id__in=affected_reverse_target_ids).exclude(
                id__in=imported_ids
            )
        )
        rebuild_imported_reverse_relationships(tenant, [*imported_objects, *affected_targets])
        return {"object_map": object_map, "media_map": media_map, "created_versions": created_versions}

    def _import_media(self, package, media_payload):
        result = {}
        for data in media_payload:
            destination_hash = data["file_hash"]
            existing = MediaFile.objects.filter(
                tenant=self.job.tenant, file_hash=destination_hash, is_deleted=False
            ).first()
            if not existing:
                if MediaFile.objects.filter(file_hash=destination_hash).exclude(tenant=self.job.tenant).exists():
                    destination_hash = hashlib.sha256(f"{data['file_hash']}:{self.job.tenant_id}".encode()).hexdigest()
                    existing = MediaFile.objects.filter(
                        tenant=self.job.tenant,
                        file_hash=destination_hash,
                        is_deleted=False,
                    ).first()
            if not existing:
                member = next(
                    (name for name in package.namelist() if name.startswith(f"media/{data['source_id']}/")), None
                )
                if not member:
                    continue
                namespace = _namespace(
                    self.job.tenant,
                    self.job.created_by,
                    data.get("namespace"),
                    self.job.options.get("namespace_resolutions", {}),
                )
                suffix = os.path.splitext(data.get("original_filename", ""))[1]
                path = f"{namespace.slug}/object-transfers/{destination_hash}{suffix}"
                with package.open(member) as source:
                    self.storage._save(path, File(source, name=os.path.basename(path)))
                self.created_media_paths.append(path)
                base_slug = slugify(data.get("slug") or data.get("title")) or "imported-media"
                slug = base_slug
                counter = 2
                while MediaFile.objects.filter(namespace=namespace, slug=slug).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1
                existing = MediaFile.objects.create(
                    tenant=self.job.tenant,
                    namespace=namespace,
                    title=data.get("title") or data.get("original_filename") or "Imported media",
                    slug=slug,
                    description=data.get("description", ""),
                    original_filename=data.get("original_filename") or os.path.basename(path),
                    file_path=path,
                    file_size=package.getinfo(member).file_size,
                    content_type=data.get("content_type") or "application/octet-stream",
                    file_hash=destination_hash,
                    file_type=data.get("file_type", "other"),
                    width=data.get("width"),
                    height=data.get("height"),
                    metadata=data.get("metadata", {}),
                    ai_generated_tags=data.get("ai_generated_tags", []),
                    access_level=data.get("access_level", "public"),
                    created_by=self.job.created_by,
                    last_modified_by=self.job.created_by,
                    uploaded_by=self.job.created_by,
                )
            media_tags = [
                self._get_or_create_media_tag(item, existing.namespace) for item in data.get("media_tags", [])
            ]
            canonical = [
                TaxonomyTag.objects.get_or_create(
                    tenant=self.job.tenant,
                    namespace=existing.namespace,
                    tag_type=item.get("tag_type", "general"),
                    slug=item["slug"],
                    defaults={**item, "created_by": self.job.created_by},
                )[0]
                for item in data.get("canonical_tags", [])
            ]
            if media_tags:
                existing.tags.add(*media_tags)
            if canonical:
                existing.canonical_tags.add(*canonical)
            collections = []
            for item in data.get("collections", []):
                collection, _created = MediaCollection.objects.get_or_create(
                    namespace=existing.namespace,
                    slug=item["slug"],
                    defaults={
                        "title": item.get("title") or item["slug"],
                        "description": item.get("description", ""),
                        "access_level": item.get("access_level", "public"),
                        "created_by": self.job.created_by,
                        "last_modified_by": self.job.created_by,
                    },
                )
                collection_tags = [
                    self._get_or_create_media_tag(tag, existing.namespace) for tag in item.get("media_tags", [])
                ]
                if collection_tags:
                    collection.tags.add(*collection_tags)
                collection_canonical_tags = [
                    TaxonomyTag.objects.get_or_create(
                        tenant=self.job.tenant,
                        namespace=existing.namespace,
                        tag_type=tag.get("tag_type", "general"),
                        slug=tag["slug"],
                        defaults={**tag, "created_by": self.job.created_by},
                    )[0]
                    for tag in item.get("canonical_tags", [])
                ]
                if collection_canonical_tags:
                    collection.canonical_tags.add(*collection_canonical_tags)
                collections.append(collection)
            if collections:
                existing.collections.add(*collections)
            source_id = str(data["source_id"])
            result[source_id] = str(existing.id)
            destination_url = existing.get_absolute_url()
            destination_storage_url = existing.get_file_url()
            for source, destination in (
                (data.get("file_path"), existing.file_path),
                (data.get("file_url"), existing.file_url or destination_storage_url),
                (data.get("storage_url"), destination_storage_url),
                (data.get("canonical_url"), destination_url),
            ):
                if source:
                    self.media_replacements[source] = destination
        return result

    def _get_or_create_media_tag(self, data, namespace):
        slug = slugify(data.get("slug") or data.get("name")) or "tag"
        name = data.get("name") or slug
        tag = MediaTag.objects.filter(namespace=namespace, slug=slug).first()
        if tag is None:
            tag = MediaTag.objects.filter(namespace=namespace, name=name).first()
        if tag is None:
            tag = MediaTag.objects.create(
                namespace=namespace,
                name=name,
                slug=slug,
                color=data.get("color") or "#3B82F6",
                description=data.get("description", ""),
                created_by=self.job.created_by,
            )
        return tag
