"""
Site ZIP package export/import services.
"""

import base64
import hashlib
import io
import json
import mimetypes
import os
import re
import secrets
import tempfile
import uuid
import zipfile
import zlib
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Set

from django.core.files.base import ContentFile, File
from django.db import models, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaCollection, MediaFile, MediaTag
from file_manager.storage import S3MediaStorage
from taxonomy.models import Tag as TaxonomyTag
from webpages.models import PageTheme, PageVersion, PageVersionTag, RemoteSiteBinding, SitePackageJob, WebPage
from webpages.services.theme_preview_content import (
    EMBEDDED_IMAGE_PATTERN,
    normalize_theme_preview_namespaces,
    rewrite_theme_library_image_urls,
)
from webpages.theme_layouts import default_theme_layouts, validate_theme_layouts

PACKAGE_VERSION = "2.0"
SUPPORTED_PACKAGE_VERSIONS = {"1.0", PACKAGE_VERSION}
THEME_TRANSFER_MAX_FILES = 250
THEME_TRANSFER_MAX_FILE_SIZE = 25 * 1024 * 1024
THEME_TRANSFER_MAX_TOTAL_SIZE = 100 * 1024 * 1024
SITE_PACKAGE_MAX_FILES = 20_000
SITE_PACKAGE_MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024
SITE_PACKAGE_MAX_IDENTITY_FILE_SIZE = 64 * 1024 * 1024
UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
URL_RE = re.compile(r"https?://[^\s\"'<>\\)]+", re.IGNORECASE)
HTML_IMAGE_SRC_RE = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.IGNORECASE)
IMAGE_URL_RE = re.compile(r"\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?[^\s]*)?$", re.IGNORECASE)
PAGE_REFERENCE_KEYS = {
    "pageId",
    "page_id",
    "parentPageId",
    "parent_page_id",
    "rootPageId",
    "root_page_id",
    "siteRootId",
    "site_root_id",
}
PAGE_REFERENCE_LIST_KEYS = {"pageIds", "page_ids"}
VERSION_REFERENCE_KEYS = {
    "versionId",
    "version_id",
    "currentVersionId",
    "current_version_id",
    "publishedVersionId",
    "published_version_id",
}
VERSION_REFERENCE_LIST_KEYS = {"versionIds", "version_ids"}
THEME_REFERENCE_KEYS = {"themeId", "theme_id"}
MEDIA_REFERENCE_KEYS = {"mediaId", "media_id", "fileId", "file_id"}
MEDIA_REFERENCE_LIST_KEYS = {"mediaIds", "media_ids", "fileIds", "file_ids"}


class MultipartUploadWriter(io.RawIOBase):
    """A forward-only file object that uploads ZIP bytes as S3 multipart parts."""

    def __init__(self, storage: S3MediaStorage, key: str, content_type="application/zip"):
        self.storage = storage
        self.key = key.lstrip("/")
        self.client = storage.client
        self.bucket_name = storage.bucket_name
        self.part_size = 8 * 1024 * 1024
        self.buffer = bytearray()
        self.position = 0
        self.parts = []
        self.part_number = 1
        self.closed_for_upload = False
        response = self.client.create_multipart_upload(
            Bucket=self.bucket_name,
            Key=self.key,
            ContentType=content_type,
        )
        self.upload_id = response["UploadId"]

    def writable(self):
        return True

    def seekable(self):
        return False

    def tell(self):
        return self.position

    def write(self, data):
        if self.closed_for_upload:
            raise ValueError("Cannot write to a completed multipart upload")
        if isinstance(data, str):
            data = data.encode("utf-8")
        self.buffer.extend(data)
        self.position += len(data)
        while len(self.buffer) >= self.part_size:
            self._upload_part(bytes(self.buffer[: self.part_size]))
            del self.buffer[: self.part_size]
        return len(data)

    def _upload_part(self, payload: bytes):
        response = self.client.upload_part(
            Bucket=self.bucket_name,
            Key=self.key,
            PartNumber=self.part_number,
            UploadId=self.upload_id,
            Body=payload,
        )
        self.parts.append({"PartNumber": self.part_number, "ETag": response["ETag"]})
        self.part_number += 1

    def complete(self):
        if self.closed_for_upload:
            return
        if self.buffer or not self.parts:
            self._upload_part(bytes(self.buffer))
            self.buffer.clear()
        self.client.complete_multipart_upload(
            Bucket=self.bucket_name,
            Key=self.key,
            UploadId=self.upload_id,
            MultipartUpload={"Parts": self.parts},
        )
        self.closed_for_upload = True

    def abort(self):
        if self.closed_for_upload:
            return
        self.client.abort_multipart_upload(
            Bucket=self.bucket_name,
            Key=self.key,
            UploadId=self.upload_id,
        )
        self.closed_for_upload = True


def _json_default(value):
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _write_json(zip_file: zipfile.ZipFile, path: str, payload: Dict[str, Any]):
    zip_file.writestr(path, json.dumps(payload, indent=2, default=_json_default))


def _payload_fingerprint(payload: Dict[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=_json_default).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _version_fingerprint(payload: Dict[str, Any]) -> str:
    provided = payload.get("content_fingerprint")
    if provided:
        return provided
    lineage_fields = {
        "content_fingerprint",
        "source_id",
        "source_page_id",
        "version_number",
        "effective_date",
        "expiry_date",
        "created_at",
    }
    fingerprint_payload = {key: value for key, value in payload.items() if key not in lineage_fields}
    return _payload_fingerprint(fingerprint_payload)


def _version_sync_fingerprint(
    payload: Dict[str, Any],
    theme_fingerprints: Dict[str, str],
    media_metadata: Optional[Dict[str, Dict[str, Any]]] = None,
    page_mappings: Optional[Dict[str, int]] = None,
) -> str:
    theme_source_id = payload.get("theme_source_id")
    serialized_payload = json.dumps(payload, sort_keys=True, default=_json_default)
    media_dependencies = {}
    for source_id, metadata in (media_metadata or {}).items():
        references = (
            str(source_id),
            metadata.get("file_path"),
            metadata.get("file_url"),
            f"/media/{source_id}/",
        )
        if any(reference and str(reference) in serialized_payload for reference in references):
            media_dependencies[str(source_id)] = metadata.get("file_hash", "")
    page_dependencies = {
        str(source_id): destination_id
        for source_id, destination_id in (page_mappings or {}).items()
        if str(source_id) in serialized_payload
    }
    return _payload_fingerprint(
        {
            "content": _version_fingerprint(payload),
            "theme": theme_fingerprints.get(str(theme_source_id), "") if theme_source_id is not None else "",
            "media": media_dependencies,
            "pages": page_dependencies,
        }
    )


def _safe_export_filename_part(value: str) -> str:
    normalized = WebPage.normalize_hostname(value) if value else ""
    normalized = normalized or value or ""
    normalized = normalized.strip().lower().strip("[]")
    normalized = re.sub(r"[^a-z0-9._-]+", "-", normalized)
    normalized = re.sub(r"[-_.]{2,}", "-", normalized).strip("-_.")
    return normalized or "site"


def _format_export_datetime(export_datetime: Optional[datetime] = None) -> str:
    export_datetime = export_datetime or timezone.now()
    if timezone.is_naive(export_datetime):
        export_datetime = timezone.make_aware(export_datetime, timezone.get_current_timezone())
    else:
        export_datetime = timezone.localtime(export_datetime)
    return export_datetime.strftime("%Y%m%d-%H%M%S")


def build_site_package_export_filename(
    root_page: WebPage,
    random_part: Optional[str] = None,
    export_datetime: Optional[datetime] = None,
) -> str:
    """
    Build a browser-friendly ZIP filename from the public site identity.

    Prefer the first hostname because it maps to the public site visitors know.
    Fall back to the root page title when the site has not been assigned a hostname.
    """
    site_name = (root_page.hostnames or [None])[0] or root_page.title or root_page.slug or "site"
    random_code = random_part or secrets.token_hex(4)
    suffix = f"{_format_export_datetime(export_datetime)}-{random_code}"
    return f"{_safe_export_filename_part(site_name)}-{suffix}.zip"


def build_site_package_export_object_key(
    root_page: WebPage,
    random_part: Optional[str] = None,
    export_datetime: Optional[datetime] = None,
) -> str:
    return (
        "site-packages/exports/"
        f"{build_site_package_export_filename(root_page, random_part=random_part, export_datetime=export_datetime)}"
    )


def get_site_package_download_filename(job: SitePackageJob) -> str:
    if job.object_key:
        filename = os.path.basename(job.object_key)
        if filename:
            return filename
    if job.root_page:
        return build_site_package_export_filename(job.root_page)
    return f"site-package-{secrets.token_hex(4)}.zip"


def _walk_json(value: Any) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _walk_json(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk_json(item)


def _replace_in_json(value: Any, replacements: Dict[str, str]) -> Any:
    if isinstance(value, str):
        for old, new in replacements.items():
            value = value.replace(old, new)
        return value
    if isinstance(value, dict):
        return {key: _replace_in_json(item, replacements) for key, item in value.items()}
    if isinstance(value, list):
        return [_replace_in_json(item, replacements) for item in value]
    return value


def _rewrite_transferred_theme_assets(value: Any, replacements: Dict[str, str], storage) -> Any:
    """Point embedded theme asset references at the destination storage."""

    if isinstance(value, str):

        def replace_reference(match):
            reference = match.group(0)
            for old_path, new_path in replacements.items():
                if old_path in reference:
                    return storage.url(new_path)
            return reference

        rewritten = EMBEDDED_IMAGE_PATTERN.sub(replace_reference, value)
        return _replace_in_json(rewritten, replacements)
    if isinstance(value, dict):
        rewritten = {key: _rewrite_transferred_theme_assets(item, replacements, storage) for key, item in value.items()}
        referenced_path = None
        for key in ("url", "fileUrl", "file_url"):
            reference = value.get(key)
            if not isinstance(reference, str):
                continue
            referenced_path = next((new for old, new in replacements.items() if old in reference), None)
            if referenced_path:
                break
        if referenced_path and isinstance(rewritten.get("filename"), str):
            rewritten["filename"] = os.path.basename(referenced_path)
        return rewritten
    if isinstance(value, list):
        return [_rewrite_transferred_theme_assets(item, replacements, storage) for item in value]
    return value


def _remap_reference_value(value: Any, reference_map: Dict[str, Any]) -> Any:
    if value is None:
        return value
    return reference_map.get(str(value), value)


def _remap_reference_collection(value: Any, reference_map: Dict[str, Any]) -> Any:
    if isinstance(value, list):
        return [_remap_reference_value(item, reference_map) for item in value]
    return _remap_reference_value(value, reference_map)


def _remap_structured_references(
    value: Any,
    *,
    page_map: Optional[Dict[str, int]] = None,
    version_map: Optional[Dict[str, int]] = None,
    theme_map: Optional[Dict[str, int]] = None,
    media_map: Optional[Dict[str, str]] = None,
) -> Any:
    """
    Rewrite exported database ids inside known JSON reference fields.

    Site packages cannot preserve integer primary keys across databases, so JSON
    config needs a targeted pass for shapes like internal links
    ({type: "internal", pageId: 123}) without touching unrelated numeric values.
    """
    page_map = page_map or {}
    version_map = version_map or {}
    theme_map = theme_map or {}
    media_map = media_map or {}

    if isinstance(value, dict):
        remapped = {}
        for key, item in value.items():
            if key in PAGE_REFERENCE_KEYS:
                remapped[key] = _remap_reference_value(item, page_map)
            elif key in PAGE_REFERENCE_LIST_KEYS:
                remapped[key] = _remap_reference_collection(item, page_map)
            elif key in VERSION_REFERENCE_KEYS:
                remapped[key] = _remap_reference_value(item, version_map)
            elif key in VERSION_REFERENCE_LIST_KEYS:
                remapped[key] = _remap_reference_collection(item, version_map)
            elif key in THEME_REFERENCE_KEYS:
                remapped[key] = _remap_reference_value(item, theme_map)
            elif key in MEDIA_REFERENCE_KEYS:
                remapped[key] = _remap_reference_value(item, media_map)
            elif key in MEDIA_REFERENCE_LIST_KEYS:
                remapped[key] = _remap_reference_collection(item, media_map)
            else:
                remapped[key] = _remap_structured_references(
                    item,
                    page_map=page_map,
                    version_map=version_map,
                    theme_map=theme_map,
                    media_map=media_map,
                )
        return remapped
    if isinstance(value, list):
        return [
            _remap_structured_references(
                item,
                page_map=page_map,
                version_map=version_map,
                theme_map=theme_map,
                media_map=media_map,
            )
            for item in value
        ]
    return value


def _serialize_page(page: WebPage) -> Dict[str, Any]:
    return {
        "source_id": page.id,
        "stable_key": str(page.stable_key),
        "parent_source_id": page.parent_id,
        "title": page.title,
        "description": page.description,
        "slug": page.slug,
        "sort_order": page.sort_order,
        "hostnames": page.hostnames or [],
        "path_pattern_key": page.path_pattern_key,
        "enable_css_injection": page.enable_css_injection,
        "page_css_variables": page.page_css_variables,
        "page_custom_css": page.page_custom_css,
        "created_at": page.created_at,
        "updated_at": page.updated_at,
        "versions": [],
    }


def _serialize_version(version: PageVersion) -> Dict[str, Any]:
    payload = {
        "source_id": version.id,
        "source_page_id": version.page_id,
        "version_number": version.version_number,
        "version_title": version.version_title,
        "change_summary": version.change_summary,
        "meta_title": version.meta_title,
        "meta_description": version.meta_description,
        "code_layout": version.code_layout,
        "layout_key": version.layout_key,
        "page_data": version.page_data,
        "widgets": version.widgets,
        "theme_source_id": version.theme_id,
        "page_css_variables": version.page_css_variables,
        "page_custom_css": version.page_custom_css,
        "enable_css_injection": version.enable_css_injection,
        "effective_date": version.effective_date,
        "expiry_date": version.expiry_date,
        "tags": version.tags,
        "canonical_tags": [
            {
                "name": link.tag.name,
                "slug": link.tag.slug,
                "tag_type": link.tag.tag_type,
                "color": link.tag.color,
                "description": link.tag.description,
                "position": link.position,
            }
            for link in version.canonical_tag_links.select_related("tag").order_by("position")
        ],
        "created_at": version.created_at,
    }
    payload["content_fingerprint"] = _version_fingerprint(payload)
    return payload


def _serialize_theme(theme: PageTheme) -> Dict[str, Any]:
    payload = {
        "source_id": theme.id,
        "stable_key": str(theme.stable_key),
        "name": theme.name,
        "description": theme.description,
        "fonts": theme.fonts,
        "colors": theme.colors,
        "design_groups": theme.design_groups,
        "component_styles": theme.component_styles,
        "designer_preview": theme.designer_preview,
        "layouts": theme.layouts,
        "image_styles": theme.image_styles,
        "gallery_styles": theme.gallery_styles,
        "carousel_styles": theme.carousel_styles,
        "table_templates": theme.table_templates,
        "breakpoints": theme.breakpoints,
        "css_variables": theme.css_variables,
        "html_elements": theme.html_elements,
        "custom_css": theme.custom_css,
        "image": theme.image.name if theme.image else None,
        "site_icon": theme.site_icon.name if theme.site_icon else None,
        "is_active": theme.is_active,
        "is_default": theme.is_default,
    }
    payload["content_fingerprint"] = _payload_fingerprint(payload)
    return payload


def _serialize_media(media: MediaFile, storage=None) -> Dict[str, Any]:
    return {
        "source_id": str(media.id),
        "title": media.title,
        "slug": media.slug,
        "description": media.description,
        "original_filename": media.original_filename,
        "file_path": media.file_path,
        "file_url": media.file_url or (storage.url(media.file_path) if storage else None),
        "file_size": media.file_size,
        "content_type": media.content_type,
        "file_hash": media.file_hash,
        "file_type": media.file_type,
        "width": media.width,
        "height": media.height,
        "metadata": media.metadata,
        "ai_generated_tags": media.ai_generated_tags,
        "ai_suggested_title": media.ai_suggested_title,
        "ai_extracted_text": media.ai_extracted_text,
        "ai_confidence_score": media.ai_confidence_score,
        "access_level": media.access_level,
        "tags": [_serialize_media_tag(tag) for tag in media.tags.all()],
        "canonical_tags": [_serialize_taxonomy_tag(tag) for tag in media.canonical_tags.all()],
        "collections": [_serialize_collection(collection) for collection in media.collections.all()],
        "created_at": media.created_at,
    }


def _serialize_media_tag(tag: MediaTag) -> Dict[str, Any]:
    return {
        "name": tag.name,
        "slug": tag.slug,
        "color": tag.color,
        "description": tag.description,
    }


def _serialize_taxonomy_tag(tag: TaxonomyTag) -> Dict[str, Any]:
    return {
        "name": tag.name,
        "slug": tag.slug,
        "tag_type": tag.tag_type,
        "color": tag.color,
        "description": tag.description,
    }


def _serialize_collection(collection: MediaCollection) -> Dict[str, Any]:
    return {
        "source_id": str(collection.id),
        "title": collection.title,
        "slug": collection.slug,
        "description": collection.description,
        "access_level": collection.access_level,
        "tags": [_serialize_media_tag(tag) for tag in collection.tags.all()],
        "canonical_tags": [_serialize_taxonomy_tag(tag) for tag in collection.canonical_tags.all()],
    }


def _theme_asset_paths(theme: PageTheme) -> Set[str]:
    paths = set()
    if theme.image:
        paths.add(theme.image.name)
    if theme.site_icon:
        paths.add(theme.site_icon.name)
    for filename in theme.list_library_images():
        paths.add(f"theme_images/{theme.id}/library/{filename}")
    for url, _metadata in theme.get_design_group_image_urls():
        path = theme._extract_path_from_url(url)
        if path:
            paths.add(path)
    return paths


def build_theme_transfer_package(theme: PageTheme, storage=None) -> str:
    """Package one theme and its referenced files for remote synchronization."""
    storage = storage or S3MediaStorage()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
        _write_json(package, "theme.json", _serialize_theme(theme))
        for path in _theme_asset_paths(theme):
            file_obj = None
            try:
                file_obj = storage._open(path, "rb")
                package.writestr(f"assets/{path}", file_obj.read())
            except Exception:
                continue
            finally:
                if file_obj:
                    file_obj.close()
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _read_theme_transfer_package(encoded_package: str):
    package = None
    try:
        raw_package = base64.b64decode(encoded_package, validate=True)
        package = zipfile.ZipFile(io.BytesIO(raw_package), "r")
        files = [item for item in package.infolist() if not item.is_dir()]
        if (
            len(files) > THEME_TRANSFER_MAX_FILES
            or any(item.file_size > THEME_TRANSFER_MAX_FILE_SIZE for item in files)
            or sum(item.file_size for item in files) > THEME_TRANSFER_MAX_TOTAL_SIZE
        ):
            raise ValueError("Theme transfer package exceeds size limits.")
        data = json.loads(package.read("theme.json").decode("utf-8"))
    except (ValueError, KeyError, UnicodeDecodeError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
        if package is not None:
            package.close()
        raise ValueError("Invalid theme transfer package.") from exc
    if not isinstance(data, dict):
        package.close()
        raise ValueError("Invalid theme transfer package.")
    for name in package.namelist():
        if not name.startswith("assets/") or name.endswith("/"):
            continue
        original_path = name[len("assets/") :]
        if not original_path or original_path.startswith("/") or ".." in original_path.split("/"):
            package.close()
            raise ValueError("Invalid asset path in theme transfer package.")
    return package, data


def validate_theme_transfer_package(encoded_package: str):
    """Validate a package before its caller mutates theme records."""
    package, _data = _read_theme_transfer_package(encoded_package)
    try:
        with package:
            if package.testzip() is not None:
                raise ValueError("Invalid theme transfer package.")
    except zipfile.BadZipFile as exc:
        raise ValueError("Invalid theme transfer package.") from exc


def restore_theme_transfer_package(encoded_package: str, theme: PageTheme, storage=None) -> Dict[str, Any]:
    """Copy packaged files into a theme's library and return rewritten theme data."""
    storage = storage or S3MediaStorage()
    package, data = _read_theme_transfer_package(encoded_package)

    replacements = {}
    with package:
        asset_names = [name for name in package.namelist() if name.startswith("assets/") and not name.endswith("/")]
        original_paths = [name[len("assets/") :] for name in asset_names]
        for name, original_path in zip(asset_names, original_paths):
            content = package.read(name)
            suffix = os.path.splitext(original_path)[1]
            filename = f"{hashlib.sha256(content).hexdigest()}{suffix}"
            new_path = f"theme_images/{theme.id}/library/{filename}"
            storage._save(new_path, ContentFile(content))
            replacements[original_path] = new_path

    if replacements:
        for field_name in (
            "fonts",
            "colors",
            "design_groups",
            "component_styles",
            "designer_preview",
            "layouts",
            "image_styles",
            "gallery_styles",
            "carousel_styles",
            "table_templates",
            "breakpoints",
            "css_variables",
            "html_elements",
            "custom_css",
        ):
            data[field_name] = _rewrite_transferred_theme_assets(data.get(field_name), replacements, storage)
        data["image"] = replacements.get(data.get("image"), data.get("image"))
        data["site_icon"] = replacements.get(data.get("site_icon"), data.get("site_icon"))
    return data


def _unique_theme_name(base_name: str) -> str:
    name = base_name or "Imported Theme"
    candidate = name
    counter = 1
    while PageTheme.objects.filter(name=candidate).exists():
        counter += 1
        candidate = f"{name} ({counter})"
    return candidate


def _unique_page_slug(parent: Optional[WebPage], tenant, slug: str) -> str:
    base = slugify(slug or "imported-page") or "imported-page"
    candidate = base
    counter = 1
    queryset = WebPage.objects.filter(parent=parent, tenant=tenant, is_deleted=False)
    while queryset.filter(slug=candidate).exists():
        counter += 1
        candidate = f"{base}-{counter}"
    return candidate


def _unique_clone_title(tenant, title: str) -> str:
    base = (title or "Imported site").strip()
    candidate = f"{base} (clone)"
    counter = 2
    roots = WebPage.objects.filter(tenant=tenant, parent__isnull=True, is_deleted=False)
    while roots.filter(title=candidate).exists():
        candidate = f"{base} (clone {counter})"
        counter += 1
    return candidate


def _validate_site_package_members(package: zipfile.ZipFile):
    members = [item for item in package.infolist() if not item.is_dir()]
    if len(members) > SITE_PACKAGE_MAX_FILES or sum(item.file_size for item in members) > SITE_PACKAGE_MAX_TOTAL_SIZE:
        raise ValueError("The selected site package exceeds safety limits.")
    for member in members:
        if member.filename.startswith("themes/assets/") and member.file_size > THEME_TRANSFER_MAX_FILE_SIZE:
            raise ValueError("A theme asset exceeds the site package safety limit.")
        if member.filename.endswith(".json") and member.file_size > SITE_PACKAGE_MAX_IDENTITY_FILE_SIZE:
            raise ValueError(f"{member.filename} exceeds the site package inspection limit.")
    return members


def _validate_site_package_documents(manifest: Dict[str, Any], pages_document: Dict[str, Any]):
    if not isinstance(manifest, dict) or not isinstance(pages_document, dict):
        raise ValueError("The selected file is not a valid site package ZIP.")
    pages = pages_document.get("pages", [])
    if (
        manifest.get("package_version") not in SUPPORTED_PACKAGE_VERSIONS
        or not isinstance(pages, list)
        or not pages
        or not all(isinstance(item, dict) for item in pages)
    ):
        raise ValueError("The selected file is not a supported site package.")

    roots = [item for item in pages if item.get("parent_source_id") is None]
    if len(roots) != 1 or roots[0] is not pages[0] or roots[0].get("source_id") is None:
        raise ValueError("The site package must contain one root page listed first.")

    seen_source_ids = set()
    seen_lineage_keys = set()
    for page in pages:
        source_id = page.get("source_id")
        parent_source_id = page.get("parent_source_id")
        if isinstance(source_id, bool) or not isinstance(source_id, int) or source_id <= 0:
            raise ValueError("The site package contains invalid page identifiers.")
        if parent_source_id is not None and (
            isinstance(parent_source_id, bool) or not isinstance(parent_source_id, int) or parent_source_id <= 0
        ):
            raise ValueError("The site package contains invalid page identifiers.")
        if source_id in seen_source_ids:
            raise ValueError("The site package contains invalid page identifiers.")
        if parent_source_id is not None and parent_source_id not in seen_source_ids:
            raise ValueError("Site package pages must be listed after their parent page.")
        seen_source_ids.add(source_id)

        stable_key = page.get("stable_key")
        if stable_key:
            try:
                lineage_key = str(uuid.UUID(str(stable_key)))
            except (AttributeError, TypeError, ValueError) as exc:
                raise ValueError("The site package contains an invalid page stable key.") from exc
        else:
            lineage_key = str(source_id)
        if lineage_key in seen_lineage_keys:
            raise ValueError("The site package contains duplicate page lineage keys.")
        seen_lineage_keys.add(lineage_key)

    source = manifest.get("source") or {}
    if not isinstance(source, dict):
        raise ValueError("The selected file is not a supported site package.")

    def normalized_stable_key(value):
        if not value:
            return ""
        try:
            return str(uuid.UUID(str(value)))
        except (AttributeError, TypeError, ValueError) as exc:
            raise ValueError("The site package contains an invalid root stable key.") from exc

    manifest_root_key = normalized_stable_key(source.get("root_stable_key"))
    page_root_key = normalized_stable_key(roots[0].get("stable_key"))
    if manifest_root_key and page_root_key and manifest_root_key != page_root_key:
        raise ValueError("The site package root stable keys do not match.")
    return pages, roots[0], source, manifest_root_key or page_root_key


def inspect_site_package_upload(upload) -> Dict[str, Any]:
    """Read the source identity without consuming the uploaded ZIP stream."""
    position = upload.tell()
    try:
        upload.seek(0)
        with zipfile.ZipFile(upload, "r") as package:
            _validate_site_package_members(package)
            identity_members = {}
            for name in ("manifest.json", "pages.json"):
                member = package.getinfo(name)
                if member.file_size > SITE_PACKAGE_MAX_IDENTITY_FILE_SIZE:
                    raise ValueError(f"{name} exceeds the site package inspection limit.")
                identity_members[name] = json.loads(package.read(member).decode("utf-8"))
            manifest = identity_members["manifest.json"]
            pages_document = identity_members["pages.json"]
    except json.JSONDecodeError as exc:
        raise ValueError("The selected file is not a valid site package ZIP.") from exc
    except ValueError:
        raise
    except (
        AttributeError,
        EOFError,
        KeyError,
        OSError,
        RuntimeError,
        TypeError,
        UnicodeDecodeError,
        zipfile.BadZipFile,
        zlib.error,
    ) as exc:
        raise ValueError("The selected file is not a valid site package ZIP.") from exc
    finally:
        upload.seek(position)

    pages, root, source, stable_key = _validate_site_package_documents(manifest, pages_document)
    package_hash = _payload_fingerprint({"manifest": manifest, "pages": pages_document})
    return {
        "stable_key": stable_key,
        "source_id": str(root.get("source_id")),
        "package_hash": package_hash,
        "title": source.get("root_title") or root.get("title") or "Imported site",
        "slug": source.get("root_slug") or root.get("slug") or "imported-site",
    }


def _job_matches_site_package_identity(job: SitePackageJob, identity: Dict[str, Any]) -> bool:
    options = job.options or {}
    stable_key = identity.get("stable_key")
    if stable_key:
        return options.get("source_root_key") == stable_key
    package_hash = identity.get("package_hash")
    return bool(
        package_hash and not options.get("source_root_key") and options.get("source_package_hash") == package_hash
    )


def find_site_package_import_in_progress(tenant, identity: Dict[str, Any]) -> Optional[SitePackageJob]:
    now = timezone.now()
    jobs = (
        SitePackageJob.objects.filter(
            kind=SitePackageJob.KIND_IMPORT,
            status__in=(SitePackageJob.STATUS_PENDING, SitePackageJob.STATUS_RUNNING),
            options__tenant_id=str(tenant.id),
        )
        .filter(models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now))
        .order_by("-created_at")
    )
    return next((job for job in jobs if _job_matches_site_package_identity(job, identity)), None)


def find_site_package_conflicts(tenant, identity: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return active roots that represent the same source site."""
    matches = {}
    stable_key = identity.get("stable_key")
    if stable_key:
        for root in WebPage.objects.filter(
            tenant=tenant,
            stable_key=stable_key,
            parent__isnull=True,
            is_deleted=False,
        ):
            matches[root.id] = {"root": root, "binding_job_id": None}

    jobs = (
        SitePackageJob.objects.filter(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_COMPLETED,
            options__tenant_id=str(tenant.id),
            imported_root_page__tenant=tenant,
            imported_root_page__parent__isnull=True,
            imported_root_page__is_deleted=False,
        )
        .select_related("imported_root_page")
        .only(
            "id",
            "options",
            "imported_root_page_id",
            "imported_root_page__id",
            "imported_root_page__title",
            "imported_root_page__slug",
        )
        .order_by("-updated_at")
    )
    if stable_key:
        jobs = jobs.filter(options__source_root_key=stable_key)
    elif identity.get("package_hash"):
        jobs = jobs.filter(options__source_package_hash=identity["package_hash"])
    for job in jobs:
        if _job_matches_site_package_identity(job, identity):
            matches.setdefault(
                job.imported_root_page_id,
                {"root": job.imported_root_page, "binding_job_id": str(job.id)},
            )

    return [
        {
            "id": item["root"].id,
            "title": item["root"].title,
            "slug": item["root"].slug,
            "binding_job_id": item["binding_job_id"],
        }
        for item in matches.values()
    ]


class _StoredSitePackageBinding:
    """Binding-shaped state persisted in a ZIP import job's progress JSON."""

    def __init__(self, local_root, state=None):
        state = state or {}
        self.local_root = local_root
        self.local_root_id = local_root.id
        self.page_map = dict(state.get("page_map") or {})
        self.theme_map = dict(state.get("theme_map") or {})
        self.version_map = dict(state.get("version_map") or {})
        self.version_fingerprints = dict(state.get("version_fingerprints") or {})
        self.last_remote_exported_at = None
        self.last_synced_at = None

    def save(self):
        return None


class SitePackageExporter:
    """Builds site ZIP packages for a root page tree."""

    def __init__(self, job: SitePackageJob, storage=None):
        self.job = job
        self.storage = storage or S3MediaStorage()

    def run(self):
        self.job.mark_running()
        root_page = self.job.root_page
        options = self.job.options or {}
        include_media = options.get("include_media", True)
        include_themes = options.get("include_themes", True)
        object_key = self.job.object_key or build_site_package_export_object_key(root_page)
        writer = MultipartUploadWriter(self.storage, object_key)
        try:
            with zipfile.ZipFile(writer, "w", zipfile.ZIP_DEFLATED) as package:
                manifest = self.write_package(package, root_page, include_media, include_themes)
            writer.complete()
        except Exception as exc:
            writer.abort()
            self.job.mark_failed(exc)
            raise

        self.job.mark_completed(
            object_key=object_key,
            progress={
                **(self.job.progress or {}),
                "status": "completed",
                "manifest": manifest,
            },
            expires_at=timezone.now() + timedelta(hours=24),
        )
        return object_key

    def write_package(
        self,
        package: zipfile.ZipFile,
        root_page: WebPage,
        include_media: bool = True,
        include_themes: bool = True,
    ) -> Dict[str, Any]:
        pages = self._collect_pages(root_page)
        pages_payload = []
        selected_versions = []
        theme_ids = set()

        for page in pages:
            page_payload = _serialize_page(page)
            versions = self._select_versions(page)
            for version in versions:
                selected_versions.append(version)
                if version.theme_id:
                    theme_ids.add(version.theme_id)
                page_payload["versions"].append(_serialize_version(version))
            pages_payload.append(page_payload)

        themes = list(PageTheme.objects.filter(id__in=theme_ids).order_by("id")) if include_themes else []
        media_ids = (
            self._collect_media_ids(selected_versions, pages, root_page.tenant, themes) if include_media else set()
        )
        media_files = list(
            MediaFile.objects.filter(id__in=media_ids, tenant=root_page.tenant)
            .prefetch_related(
                "tags",
                "canonical_tags",
                "collections__tags",
                "collections__canonical_tags",
            )
            .order_by("id")
        )
        external_media_urls = self._collect_external_media_urls(selected_versions, pages, media_files, themes)

        _write_json(package, "pages.json", {"pages": pages_payload})
        theme_warnings = self._write_themes(package, themes)
        media_warnings = self._write_media(package, media_files)

        manifest = {
            "package_version": PACKAGE_VERSION,
            "kind": "site-root-tree",
            "exported_at": timezone.now().isoformat(),
            "source": {
                "root_page_id": root_page.id,
                "root_stable_key": str(root_page.stable_key),
                "root_title": root_page.title,
                "root_slug": root_page.slug,
            },
            "options": {
                "include_media": include_media,
                "include_themes": include_themes,
                "version_scope": "current_published_plus_newer_unpublished",
            },
            "counts": {
                "pages": len(pages_payload),
                "versions": len(selected_versions),
                "themes": len(themes),
                "media": len(media_files),
            },
            "object_maps": {
                "pages": [page["source_id"] for page in pages_payload],
                "themes": [theme.id for theme in themes],
                "media": [str(media.id) for media in media_files],
            },
            "warnings": [
                *[{"code": "external_media_reference", "url": url} for url in external_media_urls],
                *theme_warnings,
                *media_warnings,
            ],
        }
        _write_json(package, "manifest.json", manifest)
        self.job.progress = {"status": "packaged", "manifest": manifest}
        self.job.save(update_fields=["progress", "updated_at"])
        return manifest

    def _collect_pages(self, root_page: WebPage) -> List[WebPage]:
        collected = []
        queue = [root_page]
        while queue:
            page = queue.pop(0)
            collected.append(page)
            queue.extend(page.children.filter(is_deleted=False).order_by("sort_order", "id"))
        return collected

    def _select_versions(self, page: WebPage) -> List[PageVersion]:
        current = page.get_current_published_version()
        if current:
            now = timezone.now()
            newer_unpublished = (
                page.versions.filter(version_number__gt=current.version_number)
                .exclude(
                    effective_date__lte=now,
                    expiry_date__isnull=True,
                )
                .exclude(
                    effective_date__lte=now,
                    expiry_date__gt=now,
                )
                .order_by("version_number")
                .select_related("theme")
            )
            return [current, *list(newer_unpublished)]
        latest = page.versions.order_by("-version_number").select_related("theme").first()
        return [latest] if latest else []

    def _collect_media_ids(
        self,
        versions: Iterable[PageVersion],
        pages: Iterable[WebPage],
        tenant: Tenant,
        themes: Iterable[PageTheme] = (),
    ) -> Set[str]:
        candidates = set()
        texts = []
        for page in pages:
            texts.extend(
                _walk_json({"page_css_variables": page.page_css_variables, "page_custom_css": page.page_custom_css})
            )
        for version in versions:
            texts.extend(
                _walk_json(
                    {
                        "page_data": version.page_data,
                        "widgets": version.widgets,
                        "page_css_variables": version.page_css_variables,
                        "page_custom_css": version.page_custom_css,
                    }
                )
            )
        for theme in themes:
            texts.extend(_walk_json(_serialize_theme(theme)))
        for text in texts:
            for match in UUID_RE.findall(text):
                candidates.add(str(match).lower())
        matched = set(
            str(value)
            for value in MediaFile.objects.filter(tenant=tenant, id__in=candidates).values_list("id", flat=True)
        )
        # Older content sometimes stores only a managed URL/path and no media UUID.
        joined = "\n".join(texts)
        if joined:
            for media in MediaFile.objects.filter(tenant=tenant).only("id", "file_path", "file_url"):
                if (media.file_path and media.file_path in joined) or (media.file_url and media.file_url in joined):
                    matched.add(str(media.id))
        return matched

    def _collect_external_media_urls(
        self,
        versions: Iterable[PageVersion],
        pages: Iterable[WebPage],
        media_files: Iterable[MediaFile],
        themes: Iterable[PageTheme] = (),
    ) -> List[str]:
        owned_values = {value for media in media_files for value in (media.file_path, media.file_url) if value}
        candidates = set()
        for page in pages:
            for text in _walk_json(
                {"page_css_variables": page.page_css_variables, "page_custom_css": page.page_custom_css}
            ):
                candidates.update(HTML_IMAGE_SRC_RE.findall(text))
                candidates.update(url for url in URL_RE.findall(text) if IMAGE_URL_RE.search(url))
        for version in versions:
            for text in _walk_json(
                {
                    "page_data": version.page_data,
                    "widgets": version.widgets,
                    "page_css_variables": version.page_css_variables,
                    "page_custom_css": version.page_custom_css,
                }
            ):
                candidates.update(HTML_IMAGE_SRC_RE.findall(text))
                candidates.update(url for url in URL_RE.findall(text) if IMAGE_URL_RE.search(url))
        for theme in themes:
            owned_values.update(_theme_asset_paths(theme))
            for text in _walk_json(_serialize_theme(theme)):
                candidates.update(HTML_IMAGE_SRC_RE.findall(text))
                candidates.update(url for url in URL_RE.findall(text) if IMAGE_URL_RE.search(url))
        return sorted(
            url
            for url in candidates
            if url.startswith(("http://", "https://"))
            and not any(owned in url or url in owned for owned in owned_values)
        )

    def _write_themes(self, package: zipfile.ZipFile, themes: List[PageTheme]):
        storage = self.storage
        warnings = []
        for theme in themes:
            theme_data = _serialize_theme(theme)
            assets = []
            for path in sorted(_theme_asset_paths(theme)):
                file_obj = None
                try:
                    file_obj = storage._open(path, "rb")
                    content = file_obj.read()
                    assets.append({"path": path, "sha256": hashlib.sha256(content).hexdigest()})
                    package.writestr(f"themes/assets/{theme.id}/{path}", content)
                except Exception:
                    warnings.append(
                        {
                            "code": "theme_asset_unavailable",
                            "themeKey": str(theme.stable_key),
                            "path": path,
                        }
                    )
                finally:
                    if file_obj:
                        file_obj.close()
            theme_data["content_fingerprint"] = _payload_fingerprint(
                {
                    "metadata": {key: value for key, value in theme_data.items() if key != "content_fingerprint"},
                    "assets": assets,
                }
            )
            _write_json(package, f"themes/{theme.id}.json", theme_data)
        return warnings

    def _write_media(self, package: zipfile.ZipFile, media_files: List[MediaFile]):
        storage = self.storage
        warnings = []
        manifest = {"files": [_serialize_media(media, storage=storage) for media in media_files]}
        _write_json(package, "media/manifest.json", manifest)
        for media in media_files:
            file_obj = None
            try:
                file_obj = storage._open(media.file_path, "rb")
                filename = os.path.basename(media.file_path) or media.original_filename
                package.writestr(f"media/files/{media.id}/{filename}", file_obj.read())
            except Exception:
                warnings.append({"code": "media_file_unavailable", "mediaKey": str(media.id)})
            finally:
                if file_obj:
                    file_obj.close()
        return warnings


class SitePackageImporter:
    """Imports site ZIP packages as new root page trees."""

    def __init__(self, job: SitePackageJob, storage=None):
        self.job = job
        self.storage = storage or S3MediaStorage()
        self.theme_stable_map = {}
        self.theme_source_fingerprints = {}
        self.media_source_metadata = {}

    def run(self):
        self.job.mark_running()
        try:
            with self._download_package() as package_file:
                with zipfile.ZipFile(package_file, "r") as package:
                    imported_root = self.import_package(package)
        except Exception as exc:
            self.job.mark_failed(exc)
            raise

        self.job.mark_completed(
            imported_root_page=imported_root,
            progress={**(self.job.progress or {}), "status": "completed"},
            expires_at=timezone.now() + timedelta(hours=24),
        )
        return imported_root.id

    def _download_package(self):
        file_obj = self.storage._open(self.job.object_key, "rb")
        temp_file = tempfile.SpooledTemporaryFile(max_size=25 * 1024 * 1024)
        try:
            while True:
                chunk = file_obj.read(1024 * 1024)
                if not chunk:
                    break
                temp_file.write(chunk)
        finally:
            file_obj.close()
        temp_file.seek(0)
        return temp_file

    @transaction.atomic
    def import_package(self, package: zipfile.ZipFile) -> WebPage:
        _validate_site_package_members(package)
        manifest = json.loads(package.read("manifest.json").decode("utf-8"))
        pages_document = json.loads(package.read("pages.json").decode("utf-8"))
        _validate_site_package_documents(manifest, pages_document)
        options = self.job.options or {}
        if options.get("source") == "remote":
            package_root_key = manifest.get("source", {}).get("root_stable_key")
            if not package_root_key or str(package_root_key) != str(options.get("remote_site_key")):
                raise ValueError("The remote package does not match the selected site.")

        if options.get("mode") == "update":
            return self._update_package(package, manifest)

        pages_payload = json.loads(package.read("pages.json").decode("utf-8"))["pages"]
        theme_map = self._import_themes(package)
        media_map = self._import_media(package)
        replacements = self._build_replacements(media_map)

        tenant = self._destination_tenant()
        page_map: Dict[int, WebPage] = {}
        imported_versions: List[tuple[PageVersion, Optional[datetime], Optional[datetime]]] = []
        version_map: Dict[int, PageVersion] = {}
        imported_root = None

        for page_data in pages_payload:
            source_id = page_data["source_id"]
            parent_source_id = page_data["parent_source_id"]
            parent = page_map.get(parent_source_id) if parent_source_id else None
            title = page_data.get("title", "")
            if parent is None and options.get("mode") == "clone":
                title = _unique_clone_title(tenant, title)
            page = WebPage.objects.create(
                parent=parent,
                sort_order=page_data.get("sort_order", 0),
                title=title,
                description=page_data.get("description", ""),
                slug=_unique_page_slug(parent, tenant, page_data.get("slug")),
                hostnames=[] if not parent else page_data.get("hostnames", []),
                path_pattern_key=page_data.get("path_pattern_key", ""),
                enable_css_injection=page_data.get("enable_css_injection", True),
                page_css_variables=_replace_in_json(page_data.get("page_css_variables", {}), replacements),
                page_custom_css=_replace_in_json(page_data.get("page_custom_css", ""), replacements),
                tenant=tenant,
                created_by=self.job.created_by,
                last_modified_by=self.job.created_by,
            )
            page_map[source_id] = page
            if parent is None:
                imported_root = page

        page_reference_map = {str(source_id): page.id for source_id, page in page_map.items()}
        theme_reference_map = {str(source_id): theme.id for source_id, theme in theme_map.items()}
        media_reference_map = {str(source_id): str(media.id) for source_id, media in media_map.items()}

        for page_data in pages_payload:
            page = page_map[page_data["source_id"]]
            for version_data in page_data.get("versions", []):
                theme = theme_map.get(version_data.get("theme_source_id"))
                preserve_publication = (self.job.options or {}).get("preserve_publication_status", True)
                page_data_payload = _replace_in_json(version_data.get("page_data", {}), replacements)
                widgets_payload = _replace_in_json(version_data.get("widgets", {}), replacements)
                effective_date = (
                    self._parse_datetime(version_data.get("effective_date")) if preserve_publication else None
                )
                expiry_date = self._parse_datetime(version_data.get("expiry_date")) if preserve_publication else None
                imported_version = PageVersion.objects.create(
                    page=page,
                    version_number=version_data["version_number"],
                    version_title=version_data.get("version_title", ""),
                    change_summary=version_data.get("change_summary", {}),
                    meta_title=version_data.get("meta_title", ""),
                    meta_description=version_data.get("meta_description", ""),
                    code_layout=version_data.get("code_layout", ""),
                    layout_key=version_data.get("layout_key") or version_data.get("code_layout", ""),
                    page_data=page_data_payload,
                    widgets=widgets_payload,
                    theme=theme,
                    page_css_variables=_replace_in_json(version_data.get("page_css_variables", {}), replacements),
                    page_custom_css=_replace_in_json(version_data.get("page_custom_css", ""), replacements),
                    enable_css_injection=version_data.get("enable_css_injection", True),
                    # Complete all ID remapping before restoring publication dates.
                    # A published PageVersion is immutable by design.
                    effective_date=None,
                    expiry_date=None,
                    tags=version_data.get("tags", []),
                    created_by=self.job.created_by,
                )
                self._restore_page_tags(imported_version, version_data)
                imported_versions.append((imported_version, effective_date, expiry_date))
                version_map[version_data["source_id"]] = imported_version

        if version_map:
            version_reference_map = {str(source_id): version.id for source_id, version in version_map.items()}
            for imported_version, effective_date, expiry_date in imported_versions:
                page_data_payload = _remap_structured_references(
                    imported_version.page_data,
                    page_map=page_reference_map,
                    version_map=version_reference_map,
                    theme_map=theme_reference_map,
                    media_map=media_reference_map,
                )
                widgets_payload = _remap_structured_references(
                    imported_version.widgets,
                    page_map=page_reference_map,
                    version_map=version_reference_map,
                    theme_map=theme_reference_map,
                    media_map=media_reference_map,
                )
                if page_data_payload != imported_version.page_data or widgets_payload != imported_version.widgets:
                    imported_version.page_data = page_data_payload
                    imported_version.widgets = widgets_payload
                    imported_version.save(update_fields=["page_data", "widgets", "updated_at"])
                if effective_date or expiry_date:
                    imported_version.effective_date = effective_date
                    imported_version.expiry_date = expiry_date
                    imported_version.save(update_fields=["effective_date", "expiry_date", "updated_at"])

        if not imported_root:
            raise ValueError("Package did not contain a root page")
        self.job.progress = {
            **(self.job.progress or {}),
            "object_maps": {
                "pages": {str(source_id): page.id for source_id, page in page_map.items()},
                "versions": {str(source_id): version.id for source_id, version in version_map.items()},
                "themes": {str(source_id): theme.id for source_id, theme in theme_map.items()},
                "media": {str(source_id): str(media.id) for source_id, media in media_map.items()},
            },
        }
        self._create_remote_binding(manifest, pages_payload, page_map, version_map)
        self.job.progress = {
            **(self.job.progress or {}),
            "warnings": manifest.get("warnings", []),
        }
        self.job.save(update_fields=["progress", "updated_at"])
        return imported_root

    def _restore_page_tags(self, version: PageVersion, data: Dict[str, Any]):
        namespace = self._destination_namespace()
        for position, tag_data in enumerate(data.get("canonical_tags", [])):
            tag = self._get_or_create_taxonomy_tag(tag_data, namespace)
            PageVersionTag.objects.create(
                page_version=version,
                tag=tag,
                position=tag_data.get("position", position),
            )

    def _get_or_create_taxonomy_tag(self, data: Dict[str, Any], namespace: Namespace):
        slug = slugify(data.get("slug") or data.get("name")) or "tag"
        tag_type = slugify(data.get("tag_type") or "general") or "general"
        tag, _ = TaxonomyTag.objects.get_or_create(
            tenant=namespace.tenant,
            namespace=namespace,
            tag_type=tag_type,
            slug=slug,
            defaults={
                "name": data.get("name") or slug,
                "color": data.get("color") or "#3B82F6",
                "description": data.get("description", ""),
                "created_by": self.job.created_by,
            },
        )
        return tag

    def _create_remote_binding(self, manifest, pages_payload, page_map, version_map):
        options = self.job.options or {}
        connection_id = options.get("connection_id")
        remote_root_key = options.get("remote_site_key") or manifest.get("source", {}).get("root_stable_key")
        page_stable_map = {
            str(data.get("stable_key") or data["source_id"]): page_map[data["source_id"]].id
            for data in pages_payload
            if data["source_id"] in page_map
        }
        fingerprints = {}
        for page_data in pages_payload:
            key = str(page_data.get("stable_key") or page_data.get("source_id") or "")
            if key:
                fingerprints[key] = {
                    str(item["source_id"]): _version_sync_fingerprint(
                        item,
                        self.theme_source_fingerprints,
                        self.media_source_metadata,
                        {str(source_id): page.id for source_id, page in page_map.items()},
                    )
                    for item in page_data.get("versions", [])
                }
        root_data = next((item for item in pages_payload if item.get("parent_source_id") is None), pages_payload[0])
        if not connection_id:
            source_identity = remote_root_key or options.get("source_package_hash")
            if not source_identity:
                return
            self.job.progress = {
                **(self.job.progress or {}),
                "binding": {
                    "source_root_key": str(remote_root_key or ""),
                    "source_package_hash": options.get("source_package_hash", ""),
                    "local_root_id": page_map[root_data["source_id"]].id,
                    "page_map": page_stable_map,
                    "theme_map": self.theme_stable_map,
                    "version_map": {str(source_id): version.id for source_id, version in version_map.items()},
                    "version_fingerprints": fingerprints,
                },
            }
            return
        if not remote_root_key:
            return
        binding = RemoteSiteBinding.objects.create(
            tenant=self._destination_tenant(),
            connection_id=connection_id,
            remote_root_key=remote_root_key,
            local_root=page_map[root_data["source_id"]],
            page_map=page_stable_map,
            theme_map=self.theme_stable_map,
            version_map={str(source_id): version.id for source_id, version in version_map.items()},
            version_fingerprints=fingerprints,
            last_remote_exported_at=parse_datetime(manifest.get("exported_at")),
            last_synced_at=timezone.now(),
        )
        self.job.progress = {**(self.job.progress or {}), "binding_id": str(binding.id)}

    def _update_package(self, package: zipfile.ZipFile, manifest: Dict[str, Any]) -> WebPage:
        options = self.job.options or {}
        tenant = self._destination_tenant()
        pages_payload = json.loads(package.read("pages.json").decode("utf-8"))["pages"]
        binding = self._resolve_update_binding(tenant, pages_payload)
        theme_map = self._import_themes_for_update(package, binding)
        media_map = self._import_media(package)
        replacements = self._build_replacements(media_map)
        warnings = list(manifest.get("warnings", []))

        page_map = {}
        next_page_binding = dict(binding.page_map or {})
        remote_keys = {str(item.get("stable_key") or item["source_id"]) for item in pages_payload}
        for stale_key in sorted(set(next_page_binding) - remote_keys):
            warnings.append({"code": "remote_page_missing", "remotePageKey": stale_key})
        bound_page_ids = {int(page_id) for page_id in next_page_binding.values()}
        local_queue = [binding.local_root]
        while local_queue:
            local_page = local_queue.pop(0)
            local_queue.extend(local_page.children.filter(is_deleted=False).only("id"))
            if local_page.id != binding.local_root_id and local_page.id not in bound_page_ids:
                warnings.append(
                    {
                        "code": "local_page_preserved",
                        "localPageId": local_page.id,
                        "title": local_page.title,
                    }
                )

        for index, page_data in enumerate(pages_payload):
            stable_key = str(page_data.get("stable_key") or page_data["source_id"])
            local_id = next_page_binding.get(stable_key)
            page = WebPage.objects.filter(id=local_id, tenant=tenant, is_deleted=False).first() if local_id else None
            parent = page_map.get(page_data.get("parent_source_id"))
            if index == 0:
                page = binding.local_root
                parent = None
            elif page is None:
                page = WebPage.objects.create(
                    parent=parent,
                    sort_order=page_data.get("sort_order", 0),
                    title=page_data.get("title", ""),
                    description=page_data.get("description", ""),
                    slug=_unique_page_slug(parent, tenant, page_data.get("slug")),
                    hostnames=[],
                    path_pattern_key=page_data.get("path_pattern_key", ""),
                    enable_css_injection=page_data.get("enable_css_injection", True),
                    page_css_variables=_replace_in_json(page_data.get("page_css_variables", {}), replacements),
                    page_custom_css=_replace_in_json(page_data.get("page_custom_css", ""), replacements),
                    tenant=tenant,
                    created_by=self.job.created_by,
                    last_modified_by=self.job.created_by,
                )
            else:
                desired_slug = slugify(page_data.get("slug") or "imported-page") or "imported-page"
                conflict = (
                    WebPage.objects.filter(
                        tenant=tenant,
                        parent=parent,
                        slug=desired_slug,
                        is_deleted=False,
                    )
                    .exclude(pk=page.pk)
                    .exists()
                )
                if conflict:
                    warnings.append({"code": "slug_conflict", "remotePageKey": stable_key, "keptSlug": page.slug})
                else:
                    page.slug = desired_slug
                page.parent = parent
                page.sort_order = page_data.get("sort_order", page.sort_order)
                page.title = page_data.get("title", page.title)
                page.description = page_data.get("description", page.description)
                page.path_pattern_key = page_data.get("path_pattern_key", page.path_pattern_key)
                page.enable_css_injection = page_data.get("enable_css_injection", page.enable_css_injection)
                page.page_css_variables = _replace_in_json(
                    page_data.get("page_css_variables", page.page_css_variables), replacements
                )
                page.page_custom_css = _replace_in_json(
                    page_data.get("page_custom_css", page.page_custom_css), replacements
                )
                page.last_modified_by = self.job.created_by
                page.save()
            page_map[page_data["source_id"]] = page
            next_page_binding[stable_key] = page.id

        page_reference_map = {str(source_id): page.id for source_id, page in page_map.items()}
        theme_reference_map = {str(source_id): theme.id for source_id, theme in theme_map.items()}
        media_reference_map = {str(source_id): str(media.id) for source_id, media in media_map.items()}
        next_fingerprints = dict(binding.version_fingerprints or {})
        next_version_binding = dict(binding.version_map or {})
        new_versions = []
        publication_dates = {}
        preserve_publication = options.get("preserve_publication_status", True)

        for page_data in pages_payload:
            page = page_map[page_data["source_id"]]
            stable_key = str(page_data.get("stable_key") or page_data["source_id"])
            stored_fingerprints = next_fingerprints.get(stable_key, {})
            current_fingerprints = dict(stored_fingerprints) if isinstance(stored_fingerprints, dict) else {}
            legacy_fingerprints = set(stored_fingerprints) if isinstance(stored_fingerprints, list) else set()
            for version_data in page_data.get("versions", []):
                source_version_key = str(version_data["source_id"])
                fingerprint = _version_sync_fingerprint(
                    version_data,
                    self.theme_source_fingerprints,
                    self.media_source_metadata,
                    page_reference_map,
                )
                bound_version = PageVersion.objects.filter(
                    id=next_version_binding.get(source_version_key),
                    page=page,
                ).first()
                mapped_theme = theme_map.get(version_data.get("theme_source_id"))
                content_unchanged = bool(
                    bound_version
                    and current_fingerprints.get(source_version_key) == fingerprint
                    and bound_version.theme_id == (mapped_theme.id if mapped_theme else None)
                )
                if source_version_key not in current_fingerprints and legacy_fingerprints and bound_version:
                    content_unchanged = bool(
                        _version_fingerprint(version_data) in legacy_fingerprints
                        and bound_version.theme_id == (mapped_theme.id if mapped_theme else None)
                    )
                elif source_version_key not in current_fingerprints and legacy_fingerprints and mapped_theme is None:
                    content_unchanged = _version_fingerprint(version_data) in legacy_fingerprints
                desired_effective_date = (
                    self._parse_datetime(version_data.get("effective_date")) if preserve_publication else None
                )
                desired_expiry_date = (
                    self._parse_datetime(version_data.get("expiry_date")) if preserve_publication else None
                )
                if content_unchanged:
                    publication_changed = bool(
                        preserve_publication
                        and bound_version
                        and (
                            bound_version.effective_date != desired_effective_date
                            or bound_version.expiry_date != desired_expiry_date
                        )
                    )
                    if not publication_changed:
                        current_fingerprints[source_version_key] = fingerprint
                        continue
                    now = timezone.now()
                    if bound_version.effective_date is None or bound_version.effective_date > now:
                        bound_version.effective_date = desired_effective_date
                        bound_version.expiry_date = desired_expiry_date
                        bound_version.save(update_fields=["effective_date", "expiry_date", "updated_at"])
                        current_fingerprints[source_version_key] = fingerprint
                        continue
                    if bound_version.effective_date == desired_effective_date:
                        bound_version.expiry_date = desired_expiry_date
                        bound_version.save(update_fields=["expiry_date", "updated_at"])
                        current_fingerprints[source_version_key] = fingerprint
                        continue
                    replacement_cutoff = (
                        desired_effective_date if desired_effective_date and desired_effective_date > now else now
                    )
                    if bound_version.expiry_date:
                        replacement_cutoff = min(bound_version.expiry_date, replacement_cutoff)
                    bound_version.expiry_date = replacement_cutoff
                    bound_version.save(update_fields=["expiry_date", "updated_at"])
                elif preserve_publication and bound_version and bound_version.effective_date is not None:
                    now = timezone.now()
                    replacement_cutoff = (
                        desired_effective_date if desired_effective_date and desired_effective_date > now else now
                    )
                    if bound_version.expiry_date:
                        replacement_cutoff = min(bound_version.expiry_date, replacement_cutoff)
                    bound_version.expiry_date = replacement_cutoff
                    bound_version.save(update_fields=["expiry_date", "updated_at"])
                elif preserve_publication and desired_effective_date is not None:
                    now = timezone.now()
                    replacement_cutoff = desired_effective_date if desired_effective_date > now else now
                    superseded_version = page.get_current_published_version(now=replacement_cutoff)
                    if superseded_version:
                        if superseded_version.expiry_date:
                            replacement_cutoff = min(superseded_version.expiry_date, replacement_cutoff)
                        superseded_version.expiry_date = replacement_cutoff
                        superseded_version.save(update_fields=["expiry_date", "updated_at"])
                latest_number = page.versions.aggregate(maximum=models.Max("version_number"))["maximum"] or 0
                version = PageVersion.objects.create(
                    page=page,
                    version_number=latest_number + 1,
                    version_title=version_data.get("version_title") or "Remote update",
                    change_summary={
                        **(version_data.get("change_summary") or {}),
                        "remoteImport": True,
                        "sourceVersionId": version_data.get("source_id"),
                    },
                    meta_title=version_data.get("meta_title", ""),
                    meta_description=version_data.get("meta_description", ""),
                    code_layout=version_data.get("code_layout", ""),
                    layout_key=version_data.get("layout_key") or version_data.get("code_layout", ""),
                    page_data=_replace_in_json(version_data.get("page_data", {}), replacements),
                    widgets=_replace_in_json(version_data.get("widgets", {}), replacements),
                    theme=theme_map.get(version_data.get("theme_source_id")),
                    page_css_variables=_replace_in_json(version_data.get("page_css_variables", {}), replacements),
                    page_custom_css=_replace_in_json(version_data.get("page_custom_css", ""), replacements),
                    enable_css_injection=version_data.get("enable_css_injection", True),
                    effective_date=None,
                    expiry_date=None,
                    tags=version_data.get("tags", []),
                    created_by=self.job.created_by,
                )
                self._restore_page_tags(version, version_data)
                new_versions.append(version)
                publication_dates[version.id] = (
                    desired_effective_date,
                    desired_expiry_date,
                )
                next_version_binding[source_version_key] = version.id
                current_fingerprints[source_version_key] = fingerprint
            next_fingerprints[stable_key] = current_fingerprints

        for version in new_versions:
            version.page_data = _remap_structured_references(
                version.page_data,
                page_map=page_reference_map,
                version_map=next_version_binding,
                theme_map=theme_reference_map,
                media_map=media_reference_map,
            )
            version.widgets = _remap_structured_references(
                version.widgets,
                page_map=page_reference_map,
                version_map=next_version_binding,
                theme_map=theme_reference_map,
                media_map=media_reference_map,
            )
            version.save(update_fields=["page_data", "widgets", "updated_at"])
            effective_date, expiry_date = publication_dates[version.id]
            if effective_date or expiry_date:
                version.effective_date = effective_date
                version.expiry_date = expiry_date
                version.save(update_fields=["effective_date", "expiry_date", "updated_at"])

        binding.page_map = next_page_binding
        binding.version_map = next_version_binding
        binding.version_fingerprints = next_fingerprints
        binding.last_remote_exported_at = self._parse_datetime(manifest.get("exported_at"))
        binding.last_synced_at = timezone.now()
        binding.save()
        progress = {
            **(self.job.progress or {}),
            "warnings": warnings,
            "updated_pages": len(page_map),
            "created_versions": len(new_versions),
        }
        if isinstance(binding, _StoredSitePackageBinding):
            progress["binding"] = {
                "source_root_key": str(options.get("source_root_key") or ""),
                "source_package_hash": options.get("source_package_hash", ""),
                "local_root_id": binding.local_root_id,
                "page_map": binding.page_map,
                "theme_map": binding.theme_map,
                "version_map": binding.version_map,
                "version_fingerprints": binding.version_fingerprints,
            }
        else:
            progress["binding_id"] = str(binding.id)
        self.job.progress = progress
        self.job.imported_root_page = binding.local_root
        self.job.save(update_fields=["progress", "imported_root_page", "updated_at"])
        return binding.local_root

    def _resolve_update_binding(self, tenant, pages_payload):
        options = self.job.options or {}
        if options.get("source") == "remote":
            binding = (
                RemoteSiteBinding.objects.select_for_update()
                .filter(
                    tenant=tenant,
                    connection_id=options.get("connection_id"),
                    remote_root_key=options.get("remote_site_key"),
                    local_root_id=options.get("local_root_id"),
                    local_root__is_deleted=False,
                    local_root__parent__isnull=True,
                )
                .first()
            )
            if binding is None:
                raise ValueError("The selected local site is not linked to this remote site.")
            return binding

        local_root = (
            WebPage.objects.select_for_update()
            .filter(
                id=options.get("local_root_id"),
                tenant=tenant,
                parent__isnull=True,
                is_deleted=False,
            )
            .first()
        )
        if local_root is None:
            raise ValueError("The selected existing site is no longer available.")

        identity = {
            "stable_key": options.get("source_root_key"),
            "package_hash": options.get("source_package_hash"),
        }
        previous = next(
            (
                candidate
                for candidate in SitePackageJob.objects.filter(
                    kind=SitePackageJob.KIND_IMPORT,
                    imported_root_page=local_root,
                )
                .exclude(id=self.job.id)
                .order_by("-updated_at")[:25]
                if (candidate.progress or {}).get("binding") and _job_matches_site_package_identity(candidate, identity)
            ),
            None,
        )
        binding_job_id = options.get("source_binding_job_id")
        if previous is None and binding_job_id:
            previous = SitePackageJob.objects.filter(
                id=binding_job_id,
                imported_root_page=local_root,
                status=SitePackageJob.STATUS_COMPLETED,
            ).first()
        state = (previous.progress or {}).get("binding", {}) if previous else {}
        binding = _StoredSitePackageBinding(local_root, state)
        if not binding.page_map:
            queue = [local_root]
            while queue:
                page = queue.pop(0)
                queue.extend(page.children.filter(is_deleted=False))
                binding.page_map[str(page.stable_key)] = page.id
            legacy_map = (previous.progress or {}).get("object_maps", {}).get("pages", {}) if previous else {}
            for data in pages_payload:
                local_id = legacy_map.get(str(data.get("source_id")))
                if local_id:
                    binding.page_map[str(data.get("stable_key") or data["source_id"])] = local_id
            for data in pages_payload:
                key = str(data.get("stable_key") or data["source_id"])
                local_id = binding.page_map.get(key)
                if not local_id:
                    continue
                local_versions = list(PageVersion.objects.filter(page_id=local_id).order_by("version_number"))
                fingerprints_by_id = {
                    _version_fingerprint(_serialize_version(version)): version.id for version in local_versions
                }
                binding.version_fingerprints[key] = sorted(fingerprints_by_id)
                for version_data in data.get("versions", []):
                    local_version_id = fingerprints_by_id.get(_version_fingerprint(version_data))
                    if local_version_id:
                        binding.version_map[str(version_data["source_id"])] = local_version_id
        return binding

    def _parse_datetime(self, value):
        if not value:
            return None
        if hasattr(value, "isoformat"):
            return value
        return parse_datetime(value)

    def _destination_tenant(self):
        tenant_id = (self.job.options or {}).get("tenant_id")
        if tenant_id:
            tenant = Tenant.objects.filter(id=tenant_id).first()
            if tenant:
                return tenant
        if self.job.root_page_id:
            return self.job.root_page.tenant
        tenant = getattr(self.job.created_by, "tenant", None)
        if tenant:
            return tenant
        return Namespace.get_default().tenant

    def _destination_namespace(self):
        tenant = self._destination_tenant()
        namespace = Namespace.objects.filter(tenant=tenant, is_default=True).first()
        return namespace or Namespace.get_default()

    def _import_themes(self, package: zipfile.ZipFile) -> Dict[int, PageTheme]:
        theme_map = {}
        theme_files = [name for name in package.namelist() if name.startswith("themes/") and name.endswith(".json")]
        for theme_file in theme_files:
            data = json.loads(package.read(theme_file).decode("utf-8"))
            fingerprint = data.get("content_fingerprint") or _payload_fingerprint(data)
            theme = self._create_theme(package, data)
            theme_map[data["source_id"]] = theme
            self.theme_source_fingerprints[str(data["source_id"])] = fingerprint
            if data.get("stable_key"):
                self.theme_stable_map[str(data["stable_key"])] = {
                    "id": theme.id,
                    "fingerprint": fingerprint,
                }
        return theme_map

    def _create_theme(self, package, data):
        destination_tenant = self._destination_tenant()
        layouts = data.get("layouts") or default_theme_layouts()
        validate_theme_layouts(layouts)
        theme = PageTheme.objects.create(
            tenant=destination_tenant,
            name=_unique_theme_name(data.get("name", "Imported Theme")),
            description=data.get("description", ""),
            fonts=data.get("fonts", {}),
            colors=data.get("colors", {}),
            design_groups=data.get("design_groups", {}),
            component_styles=data.get("component_styles", {}),
            designer_preview=normalize_theme_preview_namespaces(data.get("designer_preview", {}), destination_tenant),
            layouts=layouts,
            image_styles=data.get("image_styles", {}),
            gallery_styles=data.get("gallery_styles", {}),
            carousel_styles=data.get("carousel_styles", {}),
            table_templates=data.get("table_templates", {}),
            breakpoints=data.get("breakpoints", {}),
            css_variables=data.get("css_variables", {}),
            html_elements=data.get("html_elements", {}),
            custom_css=data.get("custom_css", ""),
            is_active=data.get("is_active", True),
            is_default=False,
            created_by=self.job.created_by,
        )
        self._restore_theme_assets(package, theme, data)
        return theme

    def _import_themes_for_update(self, package, binding):
        theme_map = {}
        next_binding_map = dict(binding.theme_map or {})
        theme_files = [name for name in package.namelist() if name.startswith("themes/") and name.endswith(".json")]
        for theme_file in theme_files:
            data = json.loads(package.read(theme_file).decode("utf-8"))
            stable_key = str(data.get("stable_key") or data["source_id"])
            fingerprint = data.get("content_fingerprint") or _payload_fingerprint(data)
            self.theme_source_fingerprints[str(data["source_id"])] = fingerprint
            stored = next_binding_map.get(stable_key) or {}
            if isinstance(stored, int):
                stored = {"id": stored}
            theme = None
            if stored.get("fingerprint") == fingerprint:
                theme = PageTheme.objects.filter(id=stored.get("id"), tenant=self._destination_tenant()).first()
            if theme is None and data.get("stable_key"):
                existing_theme = PageTheme.objects.filter(
                    tenant=self._destination_tenant(),
                    stable_key=data["stable_key"],
                ).first()
                if existing_theme:
                    existing_metadata = _serialize_theme(existing_theme)
                    existing_metadata.pop("content_fingerprint", None)
                    existing_assets = []
                    for path in sorted(_theme_asset_paths(existing_theme)):
                        file_obj = None
                        try:
                            file_obj = self.storage._open(path, "rb")
                            digest = hashlib.sha256()
                            while True:
                                chunk = file_obj.read(1024 * 1024)
                                if not chunk:
                                    break
                                digest.update(chunk)
                            existing_assets.append({"path": path, "sha256": digest.hexdigest()})
                        except Exception:
                            continue
                        finally:
                            if file_obj:
                                file_obj.close()
                    existing_fingerprint = _payload_fingerprint(
                        {"metadata": existing_metadata, "assets": existing_assets}
                    )
                    if existing_fingerprint == fingerprint:
                        theme = existing_theme
            if theme is None:
                theme = self._create_theme(package, data)
            next_binding_map[stable_key] = {"id": theme.id, "fingerprint": fingerprint}
            theme_map[data["source_id"]] = theme
        binding.theme_map = next_binding_map
        return theme_map

    def _restore_theme_assets(self, package, theme: PageTheme, data: Dict[str, Any]):
        prefix = f"themes/assets/{data['source_id']}/"
        asset_replacements = {}
        preview_url_replacements = {}
        used_paths = set()
        for name in package.namelist():
            if not name.startswith(prefix) or name.endswith("/"):
                continue
            original_path = name[len(prefix) :]
            content = package.read(name)
            basename = os.path.basename(original_path)
            stem, extension = os.path.splitext(basename)
            new_path = f"theme_images/{theme.id}/library/{basename}"
            counter = 2
            while new_path in used_paths:
                new_path = f"theme_images/{theme.id}/library/{stem}-{counter}{extension}"
                counter += 1
            used_paths.add(new_path)
            self.storage._save(new_path, ContentFile(content))
            asset_replacements[original_path] = new_path
            source_library_prefix = f"theme_images/{data['source_id']}/library/"
            if original_path.startswith(source_library_prefix):
                preview_url_replacements[basename] = self.storage.url(new_path)
            if original_path == data.get("image"):
                theme.image.name = new_path
            if original_path == data.get("site_icon"):
                theme.site_icon.name = new_path

        if asset_replacements:
            for field_name in (
                "fonts",
                "colors",
                "design_groups",
                "component_styles",
                "layouts",
                "image_styles",
                "gallery_styles",
                "carousel_styles",
                "table_templates",
                "breakpoints",
                "css_variables",
                "html_elements",
            ):
                setattr(
                    theme,
                    field_name,
                    _replace_in_json(getattr(theme, field_name), asset_replacements),
                )
            theme.custom_css = _replace_in_json(theme.custom_css, asset_replacements)
            theme.designer_preview = rewrite_theme_library_image_urls(
                theme.designer_preview,
                preview_url_replacements,
                data["source_id"],
            )
        theme.save()

    def _import_media(self, package: zipfile.ZipFile) -> Dict[str, MediaFile]:
        try:
            manifest = json.loads(package.read("media/manifest.json").decode("utf-8"))
        except KeyError:
            return {}
        namespace = self._destination_namespace()
        media_map = {}
        for data in manifest.get("files", []):
            self.media_source_metadata[str(data["source_id"])] = data
            existing = (
                MediaFile.objects.with_deleted().filter(file_hash=data["file_hash"], tenant=namespace.tenant).first()
            )
            destination_hash = data["file_hash"]
            if (
                existing is None
                and MediaFile.objects.with_deleted()
                .filter(file_hash=destination_hash)
                .exclude(tenant=namespace.tenant)
                .exists()
            ):
                destination_hash = hashlib.sha256(
                    f"{data['file_hash']}:{namespace.tenant_id}".encode("utf-8")
                ).hexdigest()
                existing = (
                    MediaFile.objects.with_deleted()
                    .filter(
                        file_hash=destination_hash,
                        tenant=namespace.tenant,
                    )
                    .first()
                )
            if existing:
                if existing.is_deleted:
                    file_member = self._find_media_file_member(package, data["source_id"])
                    if not file_member:
                        continue
                    verified_file = self._verified_media_file(package, file_member, data["file_hash"])
                    try:
                        restored_path = self.storage._save(
                            existing.file_path,
                            verified_file,
                        )
                    finally:
                        verified_file.close()
                    if restored_path != existing.file_path:
                        existing.file_path = restored_path
                        existing.file_url = self.storage.url(restored_path)
                    existing.is_deleted = False
                    existing.deleted_at = None
                    existing.deleted_by = None
                    existing.save(update_fields=["file_path", "file_url", "is_deleted", "deleted_at", "deleted_by"])
                media_map[data["source_id"]] = existing
                self._restore_media_relations(existing, data, namespace)
                continue

            file_member = self._find_media_file_member(package, data["source_id"])
            if not file_member:
                continue
            extension = os.path.splitext(data.get("original_filename", ""))[1]
            destination_id = uuid.uuid4()
            new_path = f"{namespace.slug}/site-packages/{destination_id}{extension}"
            verified_file = self._verified_media_file(package, file_member, data["file_hash"])
            try:
                self.storage._save(new_path, verified_file)
            finally:
                verified_file.close()
            media = MediaFile.objects.create(
                id=destination_id,
                title=data.get("title") or data.get("original_filename", "Imported media"),
                slug=self._unique_media_slug(namespace, data.get("slug") or data.get("title")),
                description=data.get("description", ""),
                original_filename=data.get("original_filename", os.path.basename(new_path)),
                file_path=new_path,
                file_url=self.storage.url(new_path),
                file_size=data.get("file_size") or package.getinfo(file_member).file_size,
                content_type=data.get("content_type")
                or mimetypes.guess_type(new_path)[0]
                or "application/octet-stream",
                file_hash=destination_hash,
                file_type=data.get("file_type", "other"),
                width=data.get("width"),
                height=data.get("height"),
                metadata=data.get("metadata", {}),
                ai_generated_tags=data.get("ai_generated_tags", []),
                ai_suggested_title=data.get("ai_suggested_title", ""),
                ai_extracted_text=data.get("ai_extracted_text", ""),
                ai_confidence_score=data.get("ai_confidence_score"),
                namespace=namespace,
                tenant=namespace.tenant,
                access_level=data.get("access_level", "public"),
                created_by=self.job.created_by,
                last_modified_by=self.job.created_by,
                uploaded_by=self.job.created_by,
            )
            media_map[data["source_id"]] = media
            self._restore_media_relations(media, data, namespace)
        return media_map

    def _verified_media_file(self, package, file_member, expected_hash):
        content = tempfile.SpooledTemporaryFile(max_size=25 * 1024 * 1024)
        digest = hashlib.sha256()
        try:
            with package.open(file_member, "r") as source_file:
                while True:
                    chunk = source_file.read(1024 * 1024)
                    if not chunk:
                        break
                    digest.update(chunk)
                    content.write(chunk)
            if digest.hexdigest() != expected_hash:
                raise ValueError("A packaged media file does not match its SHA-256 hash.")
            content.seek(0)
            return File(content, name=os.path.basename(file_member))
        except Exception:
            content.close()
            raise

    def _restore_media_relations(self, media: MediaFile, data: Dict[str, Any], namespace: Namespace):
        legacy_tags = [self._get_or_create_media_tag(item, namespace) for item in data.get("tags", [])]
        if legacy_tags:
            media.tags.add(*legacy_tags)

        canonical_tags = [self._get_or_create_taxonomy_tag(item, namespace) for item in data.get("canonical_tags", [])]
        if canonical_tags:
            media.canonical_tags.add(*canonical_tags)

        for collection_data in data.get("collections", []):
            base_slug = slugify(collection_data.get("slug") or collection_data.get("title")) or "collection"
            collection, _ = MediaCollection.objects.get_or_create(
                namespace=namespace,
                slug=base_slug,
                defaults={
                    "title": collection_data.get("title") or base_slug,
                    "description": collection_data.get("description", ""),
                    "access_level": collection_data.get("access_level", "public"),
                    "created_by": self.job.created_by,
                    "last_modified_by": self.job.created_by,
                },
            )
            media.collections.add(collection)
            collection_legacy_tags = []
            for item in collection_data.get("tags", []):
                collection_legacy_tags.append(self._get_or_create_media_tag(item, namespace))
            if collection_legacy_tags:
                collection.tags.add(*collection_legacy_tags)
            collection_canonical = [
                self._get_or_create_taxonomy_tag(item, namespace) for item in collection_data.get("canonical_tags", [])
            ]
            if collection_canonical:
                collection.canonical_tags.add(*collection_canonical)

    def _get_or_create_media_tag(self, data: Dict[str, Any], namespace: Namespace):
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

    def _find_media_file_member(self, package, source_id):
        prefix = f"media/files/{source_id}/"
        for name in package.namelist():
            if name.startswith(prefix) and not name.endswith("/"):
                return name
        return None

    def _unique_media_slug(self, namespace, slug):
        base = slugify(slug or "imported-media") or "imported-media"
        candidate = base
        counter = 1
        while MediaFile.objects.filter(namespace=namespace, slug=candidate).exists():
            counter += 1
            candidate = f"{base}-{counter}"
        return candidate

    def _build_replacements(self, media_map: Dict[str, MediaFile]) -> Dict[str, str]:
        replacements = {}
        for old_id, media in media_map.items():
            source = self.media_source_metadata.get(str(old_id), {})
            destination_url = media.file_url or self.storage.url(media.file_path)
            if source.get("file_url"):
                replacements[source["file_url"]] = destination_url
            if source.get("file_path"):
                replacements[source["file_path"]] = media.file_path
            replacements[old_id] = str(media.id)
            replacements[f"/media/{old_id}/"] = f"/media/{media.id}/"
        return replacements
