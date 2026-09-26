"""Theme-owned preview documents and tenant-scoped import helpers."""

import copy
import os
import re
import uuid
from urllib.parse import urlparse

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.utils.text import slugify

from file_manager.storage import system_storage
from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion
from webpages.layout_autodiscovery import autodiscover_layouts
from webpages.layout_registry import layout_registry
from webpages.models import WebPage

from .designer_theme import designer_page_sources, designer_preview_layout, designer_preview_version

MAX_IMPORTED_IMAGES = 100
MAX_IMPORTED_IMAGE_BYTES = 10 * 1024 * 1024
IMAGE_EXTENSIONS = {".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}
EMBEDDED_IMAGE_PATTERN = re.compile(
    r"(?:https?://[^\s\"'()<>]+|s3://[^\s\"'()<>]+|/?(?:theme_images|uploads|media|site-package)/[^\s\"'()<>]+)"
    r"\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?[^\s\"'()<>]*)?",
    re.IGNORECASE,
)
SOURCE_LINK_KEYS = {
    "cachedPath",
    "cachedRootHostnames",
    "effectiveDate",
    "expiryDate",
    "hostnames",
    "objectId",
    "pageId",
    "parentId",
    "pathPatternKey",
    "publishDate",
    "relatedFrom",
    "relationships",
    "rootId",
    "siteId",
    "slugPath",
    "tenantId",
    "versionId",
    "cached_path",
    "cached_root_hostnames",
    "effective_date",
    "expiry_date",
    "object_id",
    "page_id",
    "parent_id",
    "path_pattern_key",
    "publish_date",
    "related_from",
    "root_id",
    "site_id",
    "slug_path",
    "tenant_id",
    "version_id",
}


def _object_type_snapshot(object_type):
    return {
        "key": object_type.name,
        "name": object_type.name,
        "label": object_type.label,
        "description": object_type.description,
        "schema": copy.deepcopy(object_type.schema or {}),
        "slotConfiguration": copy.deepcopy(object_type.slot_configuration or {}),
    }


def list_theme_preview_sources(theme):
    """Return tenant-scoped page/object sources plus templates for new previews."""
    autodiscover_layouts()
    layouts = [
        {
            "key": layout.name,
            "label": layout.name.replace("_", " ").title(),
            "description": layout.description,
        }
        for layout in layout_registry.list_layouts(active_only=True)
    ]
    pages = designer_page_sources(theme)
    objects = []
    instances = (
        ObjectInstance.objects.filter(tenant=theme.tenant)
        .select_related("object_type")
        .order_by("object_type__label", "title", "id")
    )
    for instance in instances:
        objects.append(
            {
                "id": instance.id,
                "label": f"{instance.object_type.label} — {instance.title}",
                "title": instance.title,
                "objectType": instance.object_type.name,
                "objectTypeLabel": instance.object_type.label,
                "hasContent": instance.current_version_id is not None,
            }
        )
    object_types = [
        _object_type_snapshot(object_type)
        for object_type in ObjectTypeDefinition.objects.filter(is_active=True).order_by("label", "id")
    ]
    return {"layouts": layouts, "pages": pages, "objects": objects, "objectTypes": object_types}


def _strip_source_links(value):
    if isinstance(value, dict):
        return {key: _strip_source_links(child) for key, child in value.items() if key not in SOURCE_LINK_KEYS}
    if isinstance(value, list):
        return [_strip_source_links(child) for child in value]
    return copy.deepcopy(value)


def _detach_object_references(data, schema):
    detached = _strip_source_links(data if isinstance(data, dict) else {})
    properties = schema.get("properties", {}) if isinstance(schema, dict) else {}
    for name, definition in properties.items():
        if not isinstance(definition, dict) or name not in detached:
            continue
        component_type = definition.get("componentType") or definition.get("component_type")
        if component_type in {"object_reference", "object_selector"}:
            detached[name] = [] if isinstance(detached[name], list) else None
    return detached


def _managed_storage_path(reference):
    if not isinstance(reference, str) or not reference:
        return None
    if reference.startswith("s3://"):
        parts = reference[5:].split("/", 1)
        return parts[1] if len(parts) == 2 else None
    if "://" not in reference and not reference.startswith("/"):
        return reference.split("?", 1)[0]

    parsed = urlparse(reference)
    path = parsed.path.lstrip("/")
    if path.startswith(f"{system_storage.bucket_name}/"):
        path = path[len(system_storage.bucket_name) + 1 :]
    known_prefixes = ("theme_images/", "uploads/", "media/", "site-package/")
    for prefix in known_prefixes:
        marker = path.find(prefix)
        if marker >= 0:
            return path[marker:]
    return None


def _copy_preview_images(theme, value):
    copied_paths = {}
    copied_count = 0

    def copy_reference(reference):
        nonlocal copied_count
        source_path = _managed_storage_path(reference)
        if not source_path or os.path.splitext(source_path)[1].lower() not in IMAGE_EXTENSIONS:
            return reference
        if source_path in copied_paths:
            return copied_paths[source_path]
        if copied_count >= MAX_IMPORTED_IMAGES:
            raise ValidationError(f"A preview import can copy at most {MAX_IMPORTED_IMAGES} images.")
        if not system_storage.exists(source_path):
            return reference
        with system_storage.open(source_path, "rb") as source:
            content = source.read(MAX_IMPORTED_IMAGE_BYTES + 1)
        if len(content) > MAX_IMPORTED_IMAGE_BYTES:
            raise ValidationError("Imported preview images cannot exceed 10 MB each.")
        stem, extension = os.path.splitext(os.path.basename(source_path))
        filename = f"{slugify(stem) or 'preview'}-{uuid.uuid4().hex[:10]}{extension.lower()}"
        saved_path = system_storage.save(f"theme_images/{theme.id}/library/{filename}", ContentFile(content))
        copied_paths[source_path] = system_storage.url(saved_path)
        copied_count += 1
        return copied_paths[source_path]

    def rewrite(current, parent_key=""):
        if isinstance(current, dict):
            rewritten = {key: rewrite(child, key) for key, child in current.items()}
            path_value = current.get("filePath") or current.get("file_path")
            if isinstance(path_value, str):
                copied_url = copy_reference(path_value)
                if copied_url != path_value:
                    for key in ("url", "fileUrl", "file_url", "imageUrl", "image_url", "src"):
                        if key in rewritten:
                            rewritten[key] = copied_url
                    rewritten.pop("filePath", None)
                    rewritten.pop("file_path", None)
                    rewritten["url"] = copied_url
                    rewritten["filename"] = os.path.basename(urlparse(copied_url).path)
            return rewritten
        if isinstance(current, list):
            return [rewrite(child, parent_key) for child in current]
        if isinstance(current, str):
            rewritten_string = EMBEDDED_IMAGE_PATTERN.sub(lambda match: copy_reference(match.group(0)), current)
            if rewritten_string != current:
                return rewritten_string
            normalized_key = parent_key.lower().replace("-", "_")
            if any(token in normalized_key for token in ("image", "thumbnail", "poster", "src", "url", "file")):
                return copy_reference(current)
        return copy.deepcopy(current)

    return rewrite(value), copied_count


def rewrite_theme_library_image_urls(value, filename_urls):
    """Point copied preview image references at a newly imported theme library."""

    def rewrite(current):
        if isinstance(current, dict):
            return {key: rewrite(child) for key, child in current.items()}
        if isinstance(current, list):
            return [rewrite(child) for child in current]
        if not isinstance(current, str):
            return copy.deepcopy(current)

        def replace(match):
            filename = os.path.basename(urlparse(match.group(0)).path)
            return filename_urls.get(filename, match.group(0))

        return EMBEDDED_IMAGE_PATTERN.sub(replace, current)

    return rewrite(value)


def import_theme_preview_document(theme, source_kind, source_id):
    """Copy one tenant-owned page or object into a detached theme document."""
    try:
        source_id = int(source_id)
    except (TypeError, ValueError) as exc:
        raise ValidationError("Choose a valid preview source.") from exc

    if source_kind == "page":
        page = (
            WebPage.objects.filter(id=source_id, tenant=theme.tenant, is_deleted=False)
            .select_related("latest_version", "current_published_version", "parent")
            .first()
        )
        if not page:
            raise ValidationError("That page is not available in this account.")
        version = designer_preview_version(page)
        if not version:
            raise ValidationError("That page has no content to copy.")
        layout = designer_preview_layout(page, version)
        content, copied_images = _copy_preview_images(
            theme,
            {
                "title": page.title,
                "pageData": _strip_source_links(version.page_data or {}),
                "widgets": _strip_source_links(version.widgets or {}),
                "codeLayout": layout,
            },
        )
        return {
            "id": f"page-{uuid.uuid4().hex}",
            "label": page.title or f"Page {page.id}",
            "kind": "page",
            "layout": layout,
            "content": content,
        }, copied_images

    if source_kind == "object":
        instance = (
            ObjectInstance.objects.filter(id=source_id, tenant=theme.tenant).select_related("object_type").first()
        )
        if not instance:
            raise ValidationError("That object is not available in this account.")
        version = None
        if instance.current_version_id:
            version = ObjectVersion.objects.filter(id=instance.current_version_id).values("data", "widgets").first()
        schema = copy.deepcopy(instance.object_type.schema or {})
        content, copied_images = _copy_preview_images(
            theme,
            {
                "title": instance.title,
                "data": _detach_object_references(version["data"] if version else {}, schema),
                "widgets": _strip_source_links(version["widgets"] if version else {}),
            },
        )
        return {
            "id": f"object-{uuid.uuid4().hex}",
            "label": instance.title or f"Object {instance.id}",
            "kind": "object",
            "layout": "main_layout",
            "objectType": _object_type_snapshot(instance.object_type),
            "content": content,
        }, copied_images

    raise ValidationError("Preview source type must be page or object.")
