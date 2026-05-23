"""
Site ZIP package export/import services.
"""

import io
import json
import mimetypes
import os
import re
import secrets
import tempfile
import zipfile
from datetime import timedelta
from typing import Any, Dict, Iterable, List, Optional, Set

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaFile
from file_manager.storage import S3MediaStorage
from webpages.models import PageTheme, PageVersion, SitePackageJob, WebPage

PACKAGE_VERSION = "1.0"
UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
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


def _safe_export_filename_part(value: str) -> str:
    normalized = WebPage.normalize_hostname(value) if value else ""
    normalized = normalized or value or ""
    normalized = normalized.strip().lower().strip("[]")
    normalized = re.sub(r"[^a-z0-9._-]+", "-", normalized)
    normalized = re.sub(r"[-_.]{2,}", "-", normalized).strip("-_.")
    return normalized or "site"


def build_site_package_export_filename(
    root_page: WebPage, random_part: Optional[str] = None
) -> str:
    """
    Build a browser-friendly ZIP filename from the public site identity.

    Prefer the first hostname because it maps to the public site visitors know.
    Fall back to the root page title when the site has not been assigned a hostname.
    """
    site_name = (
        (root_page.hostnames or [None])[0]
        or root_page.title
        or root_page.slug
        or "site"
    )
    suffix = random_part or secrets.token_hex(4)
    return f"{_safe_export_filename_part(site_name)}-{suffix}.zip"


def build_site_package_export_object_key(
    root_page: WebPage, random_part: Optional[str] = None
) -> str:
    return (
        "site-packages/exports/"
        f"{build_site_package_export_filename(root_page, random_part=random_part)}"
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
    return {
        "source_id": version.id,
        "source_page_id": version.page_id,
        "version_number": version.version_number,
        "version_title": version.version_title,
        "change_summary": version.change_summary,
        "meta_title": version.meta_title,
        "meta_description": version.meta_description,
        "code_layout": version.code_layout,
        "page_data": version.page_data,
        "widgets": version.widgets,
        "theme_source_id": version.theme_id,
        "page_css_variables": version.page_css_variables,
        "page_custom_css": version.page_custom_css,
        "enable_css_injection": version.enable_css_injection,
        "effective_date": version.effective_date,
        "expiry_date": version.expiry_date,
        "tags": version.tags,
        "created_at": version.created_at,
    }


def _serialize_theme(theme: PageTheme) -> Dict[str, Any]:
    return {
        "source_id": theme.id,
        "name": theme.name,
        "description": theme.description,
        "fonts": theme.fonts,
        "colors": theme.colors,
        "design_groups": theme.design_groups,
        "component_styles": theme.component_styles,
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


def _serialize_media(media: MediaFile) -> Dict[str, Any]:
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
        "access_level": media.access_level,
        "created_at": media.created_at,
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
        object_key = self.job.object_key or build_site_package_export_object_key(
            root_page
        )
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

        media_ids = self._collect_media_ids(selected_versions) if include_media else set()
        media_files = list(MediaFile.objects.filter(id__in=media_ids).order_by("id"))
        themes = list(PageTheme.objects.filter(id__in=theme_ids).order_by("id")) if include_themes else []

        _write_json(package, "pages.json", {"pages": pages_payload})
        self._write_themes(package, themes)
        self._write_media(package, media_files)

        manifest = {
            "package_version": PACKAGE_VERSION,
            "kind": "site-root-tree",
            "exported_at": timezone.now().isoformat(),
            "source": {
                "root_page_id": root_page.id,
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

    def _collect_media_ids(self, versions: Iterable[PageVersion]) -> Set[str]:
        candidates = set()
        for version in versions:
            for text in _walk_json({"page_data": version.page_data, "widgets": version.widgets}):
                for match in UUID_RE.findall(text):
                    candidates.add(str(match).lower())
        if not candidates:
            return set()
        return set(str(value) for value in MediaFile.objects.filter(id__in=candidates).values_list("id", flat=True))

    def _write_themes(self, package: zipfile.ZipFile, themes: List[PageTheme]):
        storage = self.storage
        for theme in themes:
            _write_json(package, f"themes/{theme.id}.json", _serialize_theme(theme))
            for path in _theme_asset_paths(theme):
                file_obj = None
                try:
                    file_obj = storage._open(path, "rb")
                    package.writestr(f"themes/assets/{theme.id}/{path}", file_obj.read())
                except Exception:
                    continue
                finally:
                    if file_obj:
                        file_obj.close()

    def _write_media(self, package: zipfile.ZipFile, media_files: List[MediaFile]):
        storage = self.storage
        manifest = {"files": [_serialize_media(media) for media in media_files]}
        _write_json(package, "media/manifest.json", manifest)
        for media in media_files:
            file_obj = None
            try:
                file_obj = storage._open(media.file_path, "rb")
                filename = os.path.basename(media.file_path) or media.original_filename
                package.writestr(f"media/files/{media.id}/{filename}", file_obj.read())
            except Exception:
                continue
            finally:
                if file_obj:
                    file_obj.close()


class SitePackageImporter:
    """Imports site ZIP packages as new root page trees."""

    def __init__(self, job: SitePackageJob, storage=None):
        self.job = job
        self.storage = storage or S3MediaStorage()

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
        manifest = json.loads(package.read("manifest.json").decode("utf-8"))
        if manifest.get("package_version") != PACKAGE_VERSION:
            raise ValueError("Unsupported site package version")

        pages_payload = json.loads(package.read("pages.json").decode("utf-8"))["pages"]
        theme_map = self._import_themes(package)
        media_map = self._import_media(package)
        replacements = self._build_replacements(media_map)

        tenant = self._destination_tenant()
        page_map: Dict[int, WebPage] = {}
        imported_versions: List[PageVersion] = []
        version_map: Dict[int, PageVersion] = {}
        imported_root = None

        for page_data in pages_payload:
            source_id = page_data["source_id"]
            parent_source_id = page_data["parent_source_id"]
            parent = page_map.get(parent_source_id) if parent_source_id else None
            page = WebPage.objects.create(
                parent=parent,
                sort_order=page_data.get("sort_order", 0),
                title=page_data.get("title", ""),
                description=page_data.get("description", ""),
                slug=_unique_page_slug(parent, tenant, page_data.get("slug")),
                hostnames=[] if not parent else page_data.get("hostnames", []),
                path_pattern_key=page_data.get("path_pattern_key", ""),
                enable_css_injection=page_data.get("enable_css_injection", True),
                page_css_variables=page_data.get("page_css_variables", {}),
                page_custom_css=page_data.get("page_custom_css", ""),
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
                page_data_payload = _remap_structured_references(
                    page_data_payload,
                    page_map=page_reference_map,
                    theme_map=theme_reference_map,
                    media_map=media_reference_map,
                )
                widgets_payload = _remap_structured_references(
                    widgets_payload,
                    page_map=page_reference_map,
                    theme_map=theme_reference_map,
                    media_map=media_reference_map,
                )
                imported_version = PageVersion.objects.create(
                    page=page,
                    version_number=version_data["version_number"],
                    version_title=version_data.get("version_title", ""),
                    change_summary=version_data.get("change_summary", {}),
                    meta_title=version_data.get("meta_title", ""),
                    meta_description=version_data.get("meta_description", ""),
                    code_layout=version_data.get("code_layout", ""),
                    page_data=page_data_payload,
                    widgets=widgets_payload,
                    theme=theme,
                    page_css_variables=version_data.get("page_css_variables", {}),
                    page_custom_css=version_data.get("page_custom_css", ""),
                    enable_css_injection=version_data.get("enable_css_injection", True),
                    effective_date=(
                        self._parse_datetime(version_data.get("effective_date")) if preserve_publication else None
                    ),
                    expiry_date=(
                        self._parse_datetime(version_data.get("expiry_date")) if preserve_publication else None
                    ),
                    tags=version_data.get("tags", []),
                    created_by=self.job.created_by,
                )
                imported_versions.append(imported_version)
                version_map[version_data["source_id"]] = imported_version

        if version_map:
            version_reference_map = {str(source_id): version.id for source_id, version in version_map.items()}
            for imported_version in imported_versions:
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
        self.job.save(update_fields=["progress", "updated_at"])
        return imported_root

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
            theme = PageTheme.objects.create(
                tenant=self._destination_tenant(),
                name=_unique_theme_name(data.get("name", "Imported Theme")),
                description=data.get("description", ""),
                fonts=data.get("fonts", {}),
                colors=data.get("colors", {}),
                design_groups=data.get("design_groups", {}),
                component_styles=data.get("component_styles", {}),
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
            theme_map[data["source_id"]] = theme
        return theme_map

    def _restore_theme_assets(self, package, theme: PageTheme, data: Dict[str, Any]):
        prefix = f"themes/assets/{data['source_id']}/"
        asset_replacements = {}
        for name in package.namelist():
            if not name.startswith(prefix) or name.endswith("/"):
                continue
            original_path = name[len(prefix) :]
            content = package.read(name)
            new_path = f"theme_images/{theme.id}/library/{os.path.basename(original_path)}"
            self.storage._save(new_path, ContentFile(content))
            asset_replacements[original_path] = new_path
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
        theme.save()

    def _import_media(self, package: zipfile.ZipFile) -> Dict[str, MediaFile]:
        try:
            manifest = json.loads(package.read("media/manifest.json").decode("utf-8"))
        except KeyError:
            return {}
        namespace = self._destination_namespace()
        media_map = {}
        for data in manifest.get("files", []):
            existing = MediaFile.objects.filter(file_hash=data["file_hash"]).first()
            if existing:
                media_map[data["source_id"]] = existing
                continue

            file_member = self._find_media_file_member(package, data["source_id"])
            if not file_member:
                continue
            content = package.read(file_member)
            extension = os.path.splitext(data.get("original_filename", ""))[1]
            new_path = f"{namespace.slug}/site-packages/{data['source_id']}{extension}"
            self.storage._save(new_path, ContentFile(content))
            media = MediaFile.objects.create(
                title=data.get("title") or data.get("original_filename", "Imported media"),
                slug=self._unique_media_slug(namespace, data.get("slug") or data.get("title")),
                description=data.get("description", ""),
                original_filename=data.get("original_filename", os.path.basename(new_path)),
                file_path=new_path,
                file_size=data.get("file_size") or len(content),
                content_type=data.get("content_type")
                or mimetypes.guess_type(new_path)[0]
                or "application/octet-stream",
                file_hash=data["file_hash"],
                file_type=data.get("file_type", "other"),
                width=data.get("width"),
                height=data.get("height"),
                metadata=data.get("metadata", {}),
                namespace=namespace,
                tenant=namespace.tenant,
                access_level=data.get("access_level", "public"),
                created_by=self.job.created_by,
                last_modified_by=self.job.created_by,
                uploaded_by=self.job.created_by,
            )
            media_map[data["source_id"]] = media
        return media_map

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
            replacements[old_id] = str(media.id)
            replacements[f"/media/{old_id}/"] = f"/media/{media.id}/"
        return replacements
