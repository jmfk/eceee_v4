"""Theme-owned preview documents and tenant-scoped import helpers."""

import copy
import html
import json
import os
import re
import uuid
from io import BytesIO
from urllib.parse import urlparse

import requests
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.utils.text import slugify
from PIL import Image, UnidentifiedImageError

from content.models import Namespace
from file_manager.models import MediaCollection, MediaFile
from file_manager.storage import system_storage
from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion
from webpages.layout_autodiscovery import autodiscover_layouts
from webpages.layout_registry import layout_registry
from webpages.models import PageTheme, WebPage

from .designer_theme import designer_page_sources, designer_preview_layout, designer_preview_version

MAX_IMPORTED_IMAGES = 100
MAX_IMPORTED_IMAGE_BYTES = 10 * 1024 * 1024
IMAGE_EXTENSIONS = {".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}
SAFE_REMOTE_PREVIEW_IMAGE_EXTENSIONS = {".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"}
EMBEDDED_IMAGE_PATTERN = re.compile(
    r"(?:https?://[^\s\"'()<>]+|s3://[^\s\"'()<>]+|/?(?:theme_images|uploads|media|files|site-package)/[^\s\"'()<>]+)"
    r"\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?[^\s\"'()<>]*)?",
    re.IGNORECASE,
)
MEDIA_ID_ATTRIBUTE_PATTERN = re.compile(
    r"\sdata-(?:media|file)-id\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s>]+)",
    re.IGNORECASE,
)
SOURCE_LINK_KEYS = {
    "cachedPath",
    "cachedRootHostnames",
    "effectiveDate",
    "expiryDate",
    "hostnames",
    "currentVersionId",
    "collectionId",
    "fileId",
    "mediaId",
    "objectId",
    "pageId",
    "parentId",
    "parentObjectId",
    "pathPatternKey",
    "publishDate",
    "publishedVersionId",
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
    "current_version_id",
    "collection_id",
    "file_id",
    "media_id",
    "object_id",
    "page_id",
    "parent_id",
    "parent_object_id",
    "path_pattern_key",
    "publish_date",
    "published_version_id",
    "related_from",
    "root_id",
    "site_id",
    "slug_path",
    "tenant_id",
    "version_id",
}


def _default_namespace(theme):
    return Namespace.objects.filter(tenant=theme.tenant, is_active=True).order_by("-is_default", "name", "id").first()


def _namespace_snapshot(namespace):
    return {"id": namespace.id, "slug": namespace.slug} if namespace else None


def normalize_theme_preview_namespaces(value, tenant):
    """Map imported object previews to active namespaces owned by the target tenant."""
    normalized = copy.deepcopy(value if isinstance(value, dict) else {})
    namespaces = list(Namespace.objects.filter(tenant=tenant, is_active=True).order_by("-is_default", "name", "id"))
    default_namespace = namespaces[0] if namespaces else None
    namespaces_by_slug = {namespace.slug: namespace for namespace in namespaces}

    for view in normalized.get("views", []):
        if not isinstance(view, dict) or view.get("kind") != "object":
            continue
        object_type = view.get("objectType")
        if not isinstance(object_type, dict):
            continue
        source_namespace = object_type.get("namespace")
        source_slug = source_namespace.get("slug") if isinstance(source_namespace, dict) else None
        object_type["namespace"] = _namespace_snapshot(namespaces_by_slug.get(source_slug) or default_namespace)

    return detach_theme_preview_object_references(normalized)


def _object_type_snapshot(object_type, theme, default_namespace=None):
    namespace = object_type.namespace if object_type.namespace_id else None
    if not namespace or not namespace.is_active or namespace.tenant_id != theme.tenant_id:
        namespace = default_namespace
    return {
        "key": object_type.name,
        "name": object_type.name,
        "label": object_type.label,
        "description": object_type.description,
        "schema": copy.deepcopy(object_type.schema or {}),
        "slotConfiguration": copy.deepcopy(object_type.slot_configuration or {}),
        "namespace": _namespace_snapshot(namespace),
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
    default_namespace = _default_namespace(theme)
    object_types = [
        _object_type_snapshot(object_type, theme, default_namespace)
        for object_type in ObjectTypeDefinition.objects.filter(is_active=True)
        .select_related("namespace")
        .order_by("label", "id")
    ]
    return {
        "layouts": layouts,
        "pages": pages,
        "objects": objects,
        "objectTypes": object_types,
        "defaultNamespace": _namespace_snapshot(default_namespace),
    }


def _strip_source_links(value):
    if isinstance(value, dict):
        return {key: _strip_source_links(child) for key, child in value.items() if key not in SOURCE_LINK_KEYS}
    if isinstance(value, list):
        return [_strip_source_links(child) for child in value]
    return copy.deepcopy(value)


def _normalized_page_path(path):
    normalized = f"/{str(path or '').strip('/')}"
    return "/" if normalized == "/" else f"{normalized}/"


def materialize_theme_preview_page_links(theme, value):
    """Detach tenant page links from database IDs and development origins."""
    pages = None
    pages_by_id = {}
    roots_by_id = {}
    roots_by_hostname = {}
    pages_by_site_path = {}

    def load_pages():
        nonlocal pages
        if pages is not None:
            return
        pages = list(
            WebPage.objects.filter(tenant=theme.tenant, is_deleted=False)
            .only("id", "parent_id", "cached_root_id", "cached_path", "slug", "hostnames")
            .order_by("id")
        )
        pages_by_id.update({page.id: page for page in pages})
        roots_by_id.update({page.id: page for page in pages if page.parent_id is None})
        for root in roots_by_id.values():
            for candidate in root.hostnames or []:
                hostname = WebPage.normalize_hostname(candidate)
                if hostname and hostname not in {"*", "default"}:
                    roots_by_hostname[hostname] = root
        for page in pages:
            root_id = page.id if page.parent_id is None else page.cached_root_id
            path = page.cached_path or page.get_absolute_url() or "/"
            pages_by_site_path[(root_id, _normalized_page_path(path))] = page

    def portable_page_link(page, source):
        root_id = page.id if page.parent_id is None else page.cached_root_id
        root = roots_by_id.get(root_id)
        hostname = next(
            (
                WebPage.normalize_hostname(candidate)
                for candidate in (root.hostnames if root else [])
                if WebPage.normalize_hostname(candidate) not in {"", "*", "default"}
            ),
            "",
        )
        result = {
            key: copy.deepcopy(child)
            for key, child in source.items()
            if key not in SOURCE_LINK_KEYS and key not in {"url", "resolvedUrl", "resolved_url"}
        }
        result["type"] = "internal"
        result["path"] = page.cached_path or page.get_absolute_url() or "/"
        if hostname:
            result["siteHostname"] = hostname
        return result

    def portable_link(link):
        link_type = link.get("type")
        if link_type == "internal":
            page_id = link.get("pageId") or link.get("page_id")
            if page_id:
                load_pages()
                try:
                    page = pages_by_id.get(int(page_id))
                except (TypeError, ValueError):
                    page = None
                if page:
                    return portable_page_link(page, link)
            return _strip_source_links(link)

        if link_type != "external" or not isinstance(link.get("url"), str):
            return {key: rewrite(child) for key, child in link.items()}

        parsed = urlparse(link["url"])
        hostname = WebPage.normalize_hostname(parsed.hostname or "")
        if not hostname or parsed.scheme not in {"http", "https"}:
            return {key: rewrite(child) for key, child in link.items()}
        load_pages()
        root = roots_by_hostname.get(hostname)
        page = pages_by_site_path.get((root.id, _normalized_page_path(parsed.path))) if root else None
        if not page:
            return {key: rewrite(child) for key, child in link.items()}
        portable = portable_page_link(page, link)
        if parsed.fragment and not portable.get("anchor"):
            portable["anchor"] = parsed.fragment
        if parsed.query:
            portable["query"] = parsed.query
        return portable

    def rewrite_string(candidate):
        decoded = html.unescape(candidate)
        try:
            parsed = json.loads(decoded)
        except (TypeError, ValueError, json.JSONDecodeError):
            parsed = None
        if isinstance(parsed, dict) and parsed.get("type"):
            rewritten = json.dumps(portable_link(parsed), separators=(",", ":"))
            return html.escape(rewritten, quote=True) if decoded != candidate else rewritten

        def replace_href(match):
            quote, href = match.groups()
            decoded_href = html.unescape(href)
            try:
                parsed_href = json.loads(decoded_href)
            except (TypeError, ValueError, json.JSONDecodeError):
                return match.group(0)
            if not isinstance(parsed_href, dict) or not parsed_href.get("type"):
                return match.group(0)
            rewritten_href = html.escape(json.dumps(portable_link(parsed_href), separators=(",", ":")), quote=True)
            return f"href={quote}{rewritten_href}{quote}"

        return re.sub(r"href=(['\"])(.*?)\1", replace_href, candidate, flags=re.IGNORECASE)

    def rewrite(current):
        if isinstance(current, dict):
            if current.get("type") in {"internal", "external", "email", "phone", "anchor", "media"}:
                return portable_link(current)
            return {key: rewrite(child) for key, child in current.items()}
        if isinstance(current, list):
            return [rewrite(child) for child in current]
        if isinstance(current, str):
            return rewrite_string(current)
        return copy.deepcopy(current)

    return rewrite(value)


def resolve_theme_preview_library_urls(theme, value):
    """Resolve stored theme-library references through the active storage backend."""

    def rewrite(current):
        if isinstance(current, dict):
            return {key: rewrite(child) for key, child in current.items()}
        if isinstance(current, list):
            return [rewrite(child) for child in current]
        if not isinstance(current, str) or "theme_images/" not in current:
            return copy.deepcopy(current)
        return EMBEDDED_IMAGE_PATTERN.sub(
            lambda match: theme._resolve_theme_library_image_url(match.group(0)),
            current,
        )

    return rewrite(value)


def legacy_preview_image_references(value, source_prefix="/files/"):
    """Return legacy relative image references beneath an explicit source prefix."""
    references = set()

    def collect(current):
        if isinstance(current, dict):
            for child in current.values():
                collect(child)
        elif isinstance(current, list):
            for child in current:
                collect(child)
        elif isinstance(current, str):
            for match in EMBEDDED_IMAGE_PATTERN.finditer(current):
                reference = match.group(0)
                extension = os.path.splitext(urlparse(reference).path)[1].lower()
                if reference.startswith(source_prefix) and extension in SAFE_REMOTE_PREVIEW_IMAGE_EXTENSIONS:
                    references.add(reference)

    collect(value)
    return sorted(references)


def import_legacy_preview_images(theme, value, source_origin, source_prefix="/files/"):
    """Copy explicitly scoped legacy preview images into the theme library."""
    parsed_origin = urlparse(source_origin)
    if (
        parsed_origin.scheme != "https"
        or not parsed_origin.hostname
        or parsed_origin.username
        or parsed_origin.password
        or parsed_origin.query
        or parsed_origin.fragment
    ):
        raise ValidationError("Legacy preview image origin must be a credential-free HTTPS origin.")
    normalized_origin = f"https://{parsed_origin.netloc}"
    if not source_prefix.startswith("/files/") or ".." in source_prefix:
        raise ValidationError("Legacy preview image prefix must stay beneath /files/.")

    references = legacy_preview_image_references(value, source_prefix)
    replacements = {}
    saved_paths = []
    try:
        for reference in references:
            response_context = requests.get(
                f"{normalized_origin}{reference}",
                allow_redirects=False,
                stream=True,
                timeout=(5, 20),
            )
            with response_context as response:
                if response.status_code != 200:
                    raise ValidationError(f"Could not import legacy preview image {reference}.")
                content_type = response.headers.get("Content-Type", "").split(";", 1)[0].lower()
                if not content_type.startswith("image/"):
                    raise ValidationError(f"Legacy preview asset is not an image: {reference}.")
                chunks = []
                size = 0
                for chunk in response.iter_content(64 * 1024):
                    size += len(chunk)
                    if size > MAX_IMPORTED_IMAGE_BYTES:
                        raise ValidationError("Imported preview images cannot exceed 10 MB each.")
                    chunks.append(chunk)
                content = b"".join(chunks)
            try:
                with Image.open(BytesIO(content)) as image:
                    image.verify()
            except (UnidentifiedImageError, OSError) as exc:
                raise ValidationError(f"Legacy preview asset is not a valid image: {reference}.") from exc

            stem, extension = os.path.splitext(os.path.basename(urlparse(reference).path))
            filename = f"{slugify(stem) or 'preview'}-{uuid.uuid4().hex[:10]}{extension.lower()}"
            saved_path = system_storage.save(
                f"theme_images/{theme.id}/library/{filename}",
                ContentFile(content),
            )
            saved_paths.append(saved_path)
            replacements[reference] = system_storage.url(saved_path)

        def rewrite(current):
            if isinstance(current, dict):
                return {key: rewrite(child) for key, child in current.items()}
            if isinstance(current, list):
                return [rewrite(child) for child in current]
            if not isinstance(current, str):
                return copy.deepcopy(current)
            rewritten = current
            for reference, replacement in replacements.items():
                rewritten = rewritten.replace(reference, replacement)
            return rewritten

        return rewrite(value), len(replacements), saved_paths
    except Exception:
        for saved_path in saved_paths:
            try:
                system_storage.delete(saved_path)
            except Exception:
                pass
        raise


def _materialize_media_links(theme, value):
    """Resolve tenant-owned media navigation links before source IDs are removed."""
    media_urls = {}

    def resolve(current):
        if isinstance(current, dict):
            resolved = {key: resolve(child) for key, child in current.items()}
            if current.get("type") != "media":
                return resolved
            media_id = current.get("mediaId") or current.get("media_id")
            if not media_id:
                return resolved
            if media_id not in media_urls:
                try:
                    media_file = MediaFile.objects.filter(id=media_id, tenant=theme.tenant, is_deleted=False).first()
                except (TypeError, ValueError, ValidationError):
                    media_file = None
                media_urls[media_id] = media_file.get_absolute_url() if media_file else None
            if media_urls[media_id]:
                resolved["url"] = media_urls[media_id]
            return resolved
        if isinstance(current, list):
            return [resolve(child) for child in current]
        return copy.deepcopy(current)

    return resolve(value)


def _detach_object_references(data, schema):
    detached = _strip_source_links(data if isinstance(data, dict) else {})
    properties = schema.get("properties", {}) if isinstance(schema, dict) else {}
    for name, definition in properties.items():
        if not isinstance(definition, dict) or name not in detached:
            continue
        component_type = (
            definition.get("componentType")
            or definition.get("component_type")
            or definition.get("field_type")
            or definition.get("type")
        )
        if component_type in {"object_reference", "object_selector", "reverse_object_reference"}:
            detached[name] = [] if isinstance(detached[name], list) else None
    return detached


def detach_theme_preview_object_references(value):
    """Remove live object IDs from object preview data before it is stored."""
    detached = copy.deepcopy(value if isinstance(value, dict) else {})
    for view in detached.get("views", []):
        if not isinstance(view, dict) or view.get("kind") != "object":
            continue
        object_type = view.get("objectType")
        content = view.get("content")
        if not isinstance(object_type, dict) or not isinstance(content, dict):
            continue
        content["data"] = _detach_object_references(content.get("data", {}), object_type.get("schema", {}))
    return detached


def materialize_legacy_preview_collections(value, tenant):
    """Detach saved preview widgets from live collections using tenant-owned media or embedded samples."""
    media_cache = {}

    def media_item(sample):
        if not isinstance(sample, dict):
            return None
        media_id = sample.get("id") or sample.get("mediaId") or sample.get("media_id")
        media_file = None
        if media_id:
            if media_id not in media_cache:
                try:
                    tenant_media = MediaFile.objects.filter(
                        id=media_id,
                        tenant=tenant,
                        namespace__tenant=tenant,
                        is_deleted=False,
                    ).first()
                    media_cache[media_id] = (tenant_media, MediaFile.objects.filter(id=media_id).exists())
                except (TypeError, ValueError, ValidationError):
                    media_cache[media_id] = (None, False)
            media_file, media_exists = media_cache[media_id]
            if media_file is None and media_exists:
                return None
        url = (
            media_file.get_absolute_url()
            if media_file
            else sample.get("imgproxyBaseUrl")
            or sample.get("imgproxy_base_url")
            or sample.get("fileUrl")
            or sample.get("file_url")
            or sample.get("url")
        )
        if not url:
            return None
        metadata = media_file.metadata if media_file and isinstance(media_file.metadata, dict) else {}
        return {
            "url": url,
            "type": "image",
            "altText": (media_file.title if media_file else None)
            or sample.get("altText")
            or sample.get("alt_text")
            or sample.get("title")
            or "Image",
            "caption": (media_file.description if media_file else None) or sample.get("caption") or "",
            "annotation": metadata.get("annotation", ""),
            "title": (media_file.title if media_file else None) or sample.get("title") or "",
            "width": media_file.width if media_file else sample.get("width"),
            "height": media_file.height if media_file else sample.get("height"),
            "thumbnailUrl": sample.get("thumbnailUrl") or sample.get("thumbnail_url") or url,
        }

    def collection_items(selector):
        collection = None
        try:
            collection = MediaCollection.objects.filter(
                id=selector.get("id"),
                namespace__tenant=tenant,
                namespace__is_active=True,
            ).first()
        except (TypeError, ValueError, ValidationError):
            pass
        if collection:
            samples = [
                {
                    "id": str(media_file.id),
                    "title": media_file.title,
                    "url": media_file.get_absolute_url(),
                    "width": media_file.width,
                    "height": media_file.height,
                }
                for media_file in MediaFile.objects.filter(
                    collections=collection,
                    tenant=tenant,
                    namespace=collection.namespace,
                    file_type="image",
                    is_deleted=False,
                ).order_by("-created_at", "id")
            ]
        else:
            samples = selector.get("sampleImages") or selector.get("sample_images") or []
        return [item for sample in samples if (item := media_item(sample))]

    def rewrite(current):
        if isinstance(current, dict):
            selector = current.get("image")
            is_collection = (
                isinstance(selector, dict)
                and selector.get("id")
                and (
                    selector.get("type") == "collection"
                    or any(
                        key in selector for key in ("fileCount", "file_count", "sampleImages", "sample_images", "slug")
                    )
                )
            )
            rewritten = {key: rewrite(child) for key, child in current.items()}
            if is_collection:
                fallback = collection_items(selector)
                rewritten.pop("image", None)
                rewritten.pop("collectionId", None)
                rewritten.pop("collection_id", None)
                if fallback:
                    rewritten["mediaItems"] = fallback
                    rewritten.pop("media_items", None)
            return rewritten
        if isinstance(current, list):
            return [rewrite(child) for child in current]
        return copy.deepcopy(current)

    return rewrite(value)


def _media_file_for_reference(theme, reference):
    if not isinstance(reference, str) or not reference:
        return None

    path = urlparse(reference).path
    uuid_match = re.search(
        r"/(?:media|file|files)/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:/|$)",
        path,
        re.IGNORECASE,
    )
    if uuid_match:
        return MediaFile.objects.filter(tenant=theme.tenant, id=uuid_match.group(1)).first()

    canonical_match = re.fullmatch(r"/files/([^/]+)/([^/]+)", path)
    if not canonical_match:
        return None
    namespace_slug, filename = canonical_match.groups()
    media_slug = os.path.splitext(filename)[0]
    return MediaFile.objects.filter(
        tenant=theme.tenant,
        namespace__slug=namespace_slug,
        slug=media_slug,
    ).first()


def _managed_storage_path(reference):
    if not isinstance(reference, str) or not reference:
        return None
    if reference.startswith("s3://"):
        parts = reference[5:].split("/", 1)
        return parts[1] if len(parts) == 2 and parts[0] == system_storage.bucket_name else None
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
            managed_path = path[marker:]
            if parsed.netloc:
                try:
                    storage_url = urlparse(system_storage.url(managed_path))
                except Exception:
                    return None
                if (parsed.scheme.lower(), parsed.netloc.lower()) != (
                    storage_url.scheme.lower(),
                    storage_url.netloc.lower(),
                ):
                    return None
            return managed_path
    return None


def _copy_preview_images(theme, value):
    copied_paths = {}
    authorized_paths = {}
    saved_paths = []
    copied_count = 0

    def is_tenant_owned(source_path):
        if source_path in authorized_paths:
            return authorized_paths[source_path]
        if source_path.startswith("theme_images/"):
            parts = source_path.split("/", 2)
            allowed = (
                len(parts) == 3
                and parts[1].isdigit()
                and PageTheme.objects.filter(id=parts[1], tenant=theme.tenant).exists()
            )
        else:
            allowed = MediaFile.objects.filter(tenant=theme.tenant, file_path=source_path).exists()
        authorized_paths[source_path] = allowed
        return allowed

    def copy_reference(reference):
        nonlocal copied_count
        media_file = _media_file_for_reference(theme, reference)
        source_path = media_file.file_path if media_file else _managed_storage_path(reference)
        if not source_path or os.path.splitext(source_path)[1].lower() not in IMAGE_EXTENSIONS:
            return reference
        if not media_file:
            # A raw storage URL can be converted only when it identifies exactly
            # one image in this tenant. Ambiguous legacy paths remain untouched.
            matches = list(MediaFile.objects.filter(tenant=theme.tenant, file_path=source_path, file_type="image")[:2])
            if len(matches) == 1:
                media_file = matches[0]
        if media_file and media_file.file_type == "image":
            return media_file.get_uuid_url()
        if media_file:
            authorized_paths[source_path] = True
        if not is_tenant_owned(source_path):
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
        saved_paths.append(saved_path)
        copied_paths[source_path] = system_storage.url(saved_path)
        copied_count += 1
        return copied_paths[source_path]

    def collection_selector(value):
        if not isinstance(value, dict) or not value.get("id"):
            return False
        if value.get("type") == "collection":
            return True
        return any(
            key in value for key in ("fileCount", "file_count", "sampleImages", "sample_images", "slug")
        ) and not any(value.get(key) for key in ("url", "fileUrl", "file_url", "imageUrl", "image_url", "src"))

    def collection_media_items(selector):
        collection = (
            MediaCollection.objects.filter(
                id=selector["id"],
                namespace__tenant=theme.tenant,
                namespace__is_active=True,
            )
            .select_related("namespace")
            .first()
        )
        if not collection:
            samples = selector.get("sampleImages") or selector.get("sample_images") or []
            return [
                {
                    "url": sample.get("imgproxyBaseUrl")
                    or sample.get("imgproxy_base_url")
                    or sample.get("fileUrl")
                    or sample.get("file_url")
                    or sample.get("url"),
                    "type": "image",
                    "altText": sample.get("altText") or sample.get("alt_text") or sample.get("title") or "Image",
                    "caption": sample.get("caption", ""),
                    "annotation": sample.get("annotation", ""),
                    "title": sample.get("title", ""),
                    "width": sample.get("width"),
                    "height": sample.get("height"),
                    "thumbnailUrl": sample.get("thumbnailUrl") or sample.get("thumbnail_url"),
                }
                for sample in samples
                if isinstance(sample, dict)
                and (
                    sample.get("imgproxyBaseUrl")
                    or sample.get("imgproxy_base_url")
                    or sample.get("fileUrl")
                    or sample.get("file_url")
                    or sample.get("url")
                )
            ]

        files = MediaFile.objects.filter(
            collections=collection,
            namespace=collection.namespace,
            tenant=theme.tenant,
            file_type="image",
            is_deleted=False,
        ).order_by("-created_at", "id")
        items = []
        for media_file in files:
            copied_url = media_file.get_uuid_url()
            metadata = media_file.metadata if isinstance(media_file.metadata, dict) else {}
            items.append(
                {
                    "url": copied_url,
                    "type": "image",
                    "altText": media_file.title or "Image",
                    "caption": media_file.description or "",
                    "annotation": metadata.get("annotation", ""),
                    "title": media_file.title or "",
                    "width": media_file.width,
                    "height": media_file.height,
                    "thumbnailUrl": copied_url,
                }
            )
        return items

    def rewrite(current, parent_key=""):
        if isinstance(current, dict):
            image_selector = current.get("image")
            has_collection_selector = collection_selector(image_selector)
            rewritten = {
                key: rewrite(child, key)
                for key, child in current.items()
                if not (
                    has_collection_selector
                    and key in {"image", "mediaItems", "media_items", "collectionId", "collection_id"}
                )
            }
            if has_collection_selector:
                rewritten["mediaItems"] = collection_media_items(image_selector)
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
            media_reference_keys = {
                "filePath",
                "file_path",
                "fileUrl",
                "file_url",
                "imageUrl",
                "image_url",
                "thumbnailUrl",
                "thumbnail_url",
                "url",
                "src",
            }
            copied_media_reference = any(
                isinstance(current.get(key), str) and rewritten.get(key) != current.get(key)
                for key in media_reference_keys
            )
            points_to_library = any(
                isinstance(rewritten.get(key), str) and rewritten[key].startswith("/api/v1/media/file/")
                for key in media_reference_keys
            )
            if copied_media_reference and not points_to_library:
                for key in ("mediaId", "media_id", "fileId", "file_id"):
                    rewritten.pop(key, None)
                if current.get("type") in {"image", "media", "file"} or any(
                    key in current for key in media_reference_keys - {"url", "src"}
                ):
                    rewritten.pop("id", None)
            return rewritten
        if isinstance(current, list):
            return [rewrite(child, parent_key) for child in current]
        if isinstance(current, str):
            rewritten_string = EMBEDDED_IMAGE_PATTERN.sub(lambda match: copy_reference(match.group(0)), current)
            if "/api/v1/media/file/" not in rewritten_string:
                rewritten_string = MEDIA_ID_ATTRIBUTE_PATTERN.sub("", rewritten_string)
            if rewritten_string != current:
                return rewritten_string
            normalized_key = parent_key.lower().replace("-", "_")
            if any(token in normalized_key for token in ("image", "thumbnail", "poster", "src", "url", "file")):
                return copy_reference(current)
        return copy.deepcopy(current)

    try:
        return rewrite(value), copied_count
    except Exception:
        for saved_path in saved_paths:
            try:
                system_storage.delete(saved_path)
            except Exception:
                pass
        raise


def rewrite_theme_library_image_urls(value, filename_urls, source_theme_id):
    """Point copied preview image references at a newly imported theme library."""

    if source_theme_id is None:
        candidate_ids = set()

        def collect_source_ids(current):
            if isinstance(current, dict):
                for child in current.values():
                    collect_source_ids(child)
            elif isinstance(current, list):
                for child in current:
                    collect_source_ids(child)
            elif isinstance(current, str):
                for match in EMBEDDED_IMAGE_PATTERN.finditer(current):
                    path = urlparse(match.group(0)).path.lstrip("/")
                    library_match = re.search(r"(?:^|/)theme_images/([^/]+)/(?:library|design_groups)/([^/]+)$", path)
                    if library_match and library_match.group(2) in filename_urls:
                        candidate_ids.add(library_match.group(1))

        collect_source_ids(value)
        if len(candidate_ids) != 1:
            return copy.deepcopy(value)
        source_theme_id = candidate_ids.pop()

    def rewrite(current):
        if isinstance(current, dict):
            return {key: rewrite(child) for key, child in current.items()}
        if isinstance(current, list):
            return [rewrite(child) for child in current]
        if not isinstance(current, str):
            return copy.deepcopy(current)

        def replace(match):
            reference = match.group(0)
            path = urlparse(reference).path.lstrip("/")
            library_match = re.search(r"(?:^|/)theme_images/([^/]+)/(?:library|design_groups)/[^/]+$", path)
            if not library_match or library_match.group(1) != str(source_theme_id):
                return reference
            filename = os.path.basename(path)
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
                "widgets": _strip_source_links(
                    materialize_theme_preview_page_links(theme, _materialize_media_links(theme, version.widgets or {}))
                ),
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
            ObjectInstance.objects.filter(id=source_id, tenant=theme.tenant)
            .select_related("object_type", "object_type__namespace")
            .first()
        )
        if not instance:
            raise ValidationError("That object is not available in this account.")
        if not instance.current_version_id:
            raise ValidationError("That object has no content to copy.")
        version = (
            ObjectVersion.objects.filter(id=instance.current_version_id, object_instance=instance)
            .values("data", "widgets")
            .first()
        )
        if not version:
            raise ValidationError("That object's current version is invalid.")
        schema = copy.deepcopy(instance.object_type.schema or {})
        content, copied_images = _copy_preview_images(
            theme,
            {
                "title": instance.title,
                "data": _detach_object_references(version["data"], schema),
                "widgets": _strip_source_links(
                    materialize_theme_preview_page_links(theme, _materialize_media_links(theme, version["widgets"]))
                ),
            },
        )
        return {
            "id": f"object-{uuid.uuid4().hex}",
            "label": instance.title or f"Object {instance.id}",
            "kind": "object",
            "layout": "main_layout",
            "objectType": _object_type_snapshot(instance.object_type, theme, _default_namespace(theme)),
            "content": content,
        }, copied_images

    raise ValidationError("Preview source type must be page or object.")
