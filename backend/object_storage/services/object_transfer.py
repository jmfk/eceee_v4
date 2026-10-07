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
from django.db.models import Sum
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
UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


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
    return all(local_slots.get(name) == definition for name, definition in remote_slots.items()) and not any(
        definition.get("required") for name, definition in local_slots.items() if name not in remote_slots
    )


def type_has_foreign_tenant_usage(obj_type, tenant):
    """Return true when changing a global type would affect another tenant."""
    namespace_tenant_id = obj_type.namespace.tenant_id if obj_type.namespace_id else None
    return (namespace_tenant_id is not None and namespace_tenant_id != tenant.id) or ObjectInstance.objects.filter(
        object_type=obj_type
    ).exclude(tenant=tenant).exists()


def serialize_media(media):
    return {
        "source_id": str(media.id),
        "title": media.title,
        "slug": media.slug,
        "description": media.description,
        "original_filename": media.original_filename,
        "file_path": media.file_path,
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


def build_preflight(tenant, root_ids):
    objects = collect_object_graph(tenant, root_ids)
    versions = [version for obj in objects for version in selected_versions(obj)]
    media_ids = set()
    external_urls = set()
    for version in versions:
        for value in _walk({"data": version.data, "widgets": version.widgets}):
            media_ids.update(match.lower() for match in UUID_RE.findall(value))
            if value.startswith(("http://", "https://")) and "/files/" not in value:
                external_urls.add(value)
    media = MediaFile.objects.filter(tenant=tenant, id__in=media_ids, is_deleted=False)
    media_bytes = media.aggregate(total=Sum("file_size"))["total"] or 0
    types = {obj.object_type_id: obj.object_type for obj in objects}
    namespaces = {}
    for obj_type in types.values():
        if obj_type.namespace_id:
            namespaces[obj_type.namespace.slug] = {
                "name": obj_type.namespace.name,
                "slug": obj_type.namespace.slug,
                "description": obj_type.namespace.description,
            }
    for item in media.select_related("namespace"):
        namespaces[item.namespace.slug] = {
            "name": item.namespace.name,
            "slug": item.namespace.slug,
            "description": item.namespace.description,
        }
    return {
        "object_count": len(objects),
        "version_count": len(versions),
        "media_count": media.count(),
        "media_bytes": media_bytes,
        "type_icon_count": sum(bool(item.icon_image) for item in types.values()),
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
            "max_uncompressed_bytes": MAX_UNCOMPRESSED_BYTES,
            "within_limits": len(objects) <= MAX_OBJECTS and media_bytes <= MAX_UNCOMPRESSED_BYTES,
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
        media_ids = set()
        for version in versions:
            for text in _walk({"data": version.data, "widgets": version.widgets}):
                media_ids.update(UUID_RE.findall(text))
        media_files = list(
            MediaFile.objects.filter(tenant=self.job.tenant, id__in=media_ids, is_deleted=False)
            .select_related("namespace")
            .prefetch_related(
                "tags",
                "canonical_tags",
                "collections__tags",
                "collections__canonical_tags",
            )
        )
        type_map = {obj.object_type_id: obj.object_type for obj in objects}
        object_ids = {obj.id for obj in objects}
        payload = {
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
        objects_json = json.dumps(payload, default=_json_default).encode()
        package.writestr("objects.json", objects_json)
        checksums = {"objects.json": hashlib.sha256(objects_json).hexdigest()}
        total_media = 0
        for media in media_files:
            total_media += media.file_size or 0
            if total_media > MAX_UNCOMPRESSED_BYTES:
                raise ValueError("The selected media exceeds the 2 GB transfer limit.")
            file_obj = self.storage._open(media.file_path, "rb")
            try:
                member = f"media/{media.id}/{os.path.basename(media.file_path)}"
                digest = hashlib.sha256()
                with package.open(member, "w", force_zip64=True) as destination:
                    while chunk := file_obj.read(1024 * 1024):
                        digest.update(chunk)
                        destination.write(chunk)
                checksums[member] = digest.hexdigest()
            finally:
                file_obj.close()
        icon_count = 0
        for obj_type in type_map.values():
            if not obj_type.icon_image:
                continue
            member = f"type-icons/{slugify(obj_type.name)}/{os.path.basename(obj_type.icon_image.name)}"
            digest = hashlib.sha256()
            with obj_type.icon_image.open("rb") as source, package.open(member, "w", force_zip64=True) as destination:
                while chunk := source.read(1024 * 1024):
                    total_media += len(chunk)
                    if total_media > MAX_UNCOMPRESSED_BYTES:
                        raise ValueError("The selected media exceeds the 2 GB transfer limit.")
                    digest.update(chunk)
                    destination.write(chunk)
            checksums[member] = digest.hexdigest()
            icon_count += 1
        manifest = {
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
        package.writestr("manifest.json", json.dumps(manifest, default=_json_default))
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


def _remap_object_reference(value, object_map, skipped_ids):
    if isinstance(value, dict):
        candidate = value.get("object_id") or value.get("objectId") or value.get("id")
        if candidate is not None and str(candidate) in skipped_ids:
            return None
        return {
            key: _remap_object_reference(item, object_map, skipped_ids)
            for key, item in value.items()
            if str(item) not in skipped_ids
        }
    if isinstance(value, list):
        return [
            mapped for item in value if (mapped := _remap_object_reference(item, object_map, skipped_ids)) is not None
        ]
    if str(value) in object_map:
        return object_map[str(value)]
    if str(value) in skipped_ids:
        return None
    return value


def _remap(value: Any, object_map, media_map, reference_fields=None, skipped_ids=None):
    reference_fields = reference_fields or set()
    skipped_ids = skipped_ids or set()
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if key in reference_fields or key in {"object_id", "objectId"}:
                mapped = _remap_object_reference(item, object_map, skipped_ids)
            else:
                mapped = _remap(item, object_map, media_map, reference_fields, skipped_ids)
            if mapped is not None:
                result[key] = mapped
        return result
    if isinstance(value, list):
        return [
            mapped
            for item in value
            if (mapped := _remap(item, object_map, media_map, reference_fields, skipped_ids)) is not None
        ]
    if isinstance(value, str):
        return UUID_RE.sub(lambda match: str(media_map.get(match.group(0).lower(), match.group(0))), value)
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


class ObjectPackageImporter:
    def __init__(self, job, storage=None):
        self.job = job
        self.storage = storage or S3MediaStorage()
        self.created_media_paths = []
        self.created_type_icon_paths = []

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
            comparable = ("schema", "slot_configuration", "hierarchy_level")
            differs = existing and any(getattr(existing, field) != data.get(field) for field in comparable)
            resolution = resolutions.get(data["name"], "keep")
            compatible = existing and type_is_compatible(existing, data)
            if differs and resolution == "keep" and not compatible:
                raise ValueError(f"Local object type {data['name']} is not compatible with the remote definition.")
            if differs and resolution == "skip":
                continue
            if differs and resolution == "update":
                if type_has_foreign_tenant_usage(existing, tenant):
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
                ObjectTypeDefinition.objects.filter(name__in=data.get("allowed_child_types", []))
            )
            obj_type.browser_group = ObjectTypeDefinition.objects.filter(name=data.get("browser_group")).first()
            obj_type.save(update_fields=["browser_group", "updated_at"])

        media_map = self._import_media(package, payload.get("media", []))
        object_map = {}
        source_payloads = {}
        skipped_ids = {str(item["source_id"]) for item in payload["objects"] if item["type"] not in type_map}
        for data in payload["objects"]:
            obj_type = type_map.get(data["type"])
            if not obj_type:
                continue
            obj, _created = ObjectInstance.objects.get_or_create(
                tenant=tenant,
                object_type=obj_type,
                slug=data["slug"],
                defaults={"title": data["title"], "status": data["status"], "created_by": user},
            )
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
            )
            obj.relationships = [item for item in obj.relationships if item.get("object_id") is not None]
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
                    ),
                    "widgets": _remap(
                        version_data.get("widgets", {}),
                        object_map,
                        media_map,
                        {"object_id", "objectId"},
                        skipped_ids,
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
        rebuild_imported_reverse_relationships(tenant, [obj for obj, _data in source_payloads.values()])
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
                MediaTag.objects.get_or_create(
                    namespace=existing.namespace,
                    slug=item["slug"],
                    defaults={**item, "created_by": self.job.created_by},
                )[0]
                for item in data.get("media_tags", [])
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
                    MediaTag.objects.get_or_create(
                        namespace=existing.namespace,
                        slug=tag["slug"],
                        defaults={**tag, "created_by": self.job.created_by},
                    )[0]
                    for tag in item.get("media_tags", [])
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
            result[str(data["source_id"])] = str(existing.id)
        return result
