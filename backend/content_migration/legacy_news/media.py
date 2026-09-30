"""Idempotent legacy image import with deterministic informative placeholders."""

from __future__ import annotations

import hashlib
import io
import ipaddress
import mimetypes
import socket
import textwrap
import unicodedata
from pathlib import Path
from typing import Mapping, Optional
from urllib.parse import urlparse

import requests
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models import Q
from django.utils.text import slugify
from PIL import Image, ImageDraw, UnidentifiedImageError

from file_manager.models import MediaFile, MediaTag
from file_manager.storage import storage

from .fetcher import USER_AGENT

MAX_IMAGE_BYTES = 20 * 1024 * 1024


def placeholder_png(source_url: str, failure: str) -> bytes:
    """Return byte-stable 1200x675 PNG content describing a failed source image."""
    host = _placeholder_label(urlparse(source_url).netloc or "unknown host")
    filename = _placeholder_label(Path(urlparse(source_url).path).name or "unnamed image")
    source_id = hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:12]
    image = Image.new("RGB", (1200, 675), "#eef1ed")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, 32, 675), fill="#c94f45")
    draw.text((90, 160), "Image unavailable", fill="#25352d", stroke_width=1)
    lines = [f"File: {filename}", f"Host: {host}", f"Source ID: {source_id}", f"Reason: {failure}"]
    y = 260
    for line in lines:
        for wrapped in textwrap.wrap(line, width=72) or [""]:
            draw.text((90, y), wrapped, fill="#506159")
            y += 28
        y += 12
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=False, compress_level=9)
    return output.getvalue()


def _placeholder_label(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "replace").decode("ascii")
    return " ".join(normalized.replace("?", "_").split())[:160] or "unknown"


class LegacyMediaImporter:
    def __init__(
        self,
        *,
        namespace,
        tenant,
        user,
        local_assets: Optional[Mapping[str, Path]] = None,
    ):
        self.namespace = namespace
        self.tenant = tenant
        self.user = user
        self.local_assets = dict(local_assets or {})
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})

    def import_image(
        self,
        source_url: str,
        *,
        alt: str = "",
        article_identity: str = "",
        resume: bool = False,
    ) -> MediaFile:
        existing = (
            MediaFile.objects.filter(tenant=self.tenant, namespace=self.namespace)
            .filter(Q(metadata__legacy_source_url=source_url) | Q(metadata__legacy_source_urls__contains=[source_url]))
            .first()
        )
        is_placeholder = bool(existing and existing.metadata.get("migration_placeholder"))
        if existing and (not is_placeholder or not resume):
            self._record_article(existing, article_identity)
            self._apply_tags(existing, placeholder=is_placeholder)
            return existing

        try:
            content, content_type = self._read_image(source_url)
            placeholder = False
            failure = ""
        except Exception as exc:  # the article import must survive remote media failure
            failure = self._failure_category(exc)
            content = placeholder_png(source_url, failure)
            content_type = "image/png"
            placeholder = True

        filename = Path(urlparse(source_url).path).name or "legacy-image"
        if placeholder:
            filename = f"unavailable-{hashlib.sha256(source_url.encode()).hexdigest()[:12]}.png"
        uploaded = SimpleUploadedFile(filename, content, content_type=content_type)

        if existing and is_placeholder and not placeholder:
            result = storage.overwrite_file(existing.file_path, uploaded)
            existing.original_filename = filename
            existing.file_size = result["file_size"]
            existing.content_type = result["content_type"]
            existing.file_hash = result["file_hash"]
            existing.width = result.get("width")
            existing.height = result.get("height")
            existing.metadata = {
                **existing.metadata,
                "migration_placeholder": False,
                "legacy_media_failure": "",
            }
            existing.save()
            self._record_article(existing, article_identity)
            self._apply_tags(existing, placeholder=False)
            return existing

        content_hash = hashlib.sha256(content).hexdigest()
        duplicate = MediaFile.objects.filter(file_hash=content_hash).first()
        if duplicate:
            if duplicate.tenant_id != self.tenant.id or duplicate.namespace_id != self.namespace.id:
                raise ValueError("Matching media hash belongs to a different tenant or namespace")
            metadata = dict(duplicate.metadata or {})
            urls = list(metadata.get("legacy_source_urls", []))
            if source_url not in urls:
                urls.append(source_url)
            metadata.update({"legacy_source_urls": urls})
            duplicate.metadata = metadata
            duplicate.save(update_fields=["metadata", "updated_at"])
            self._record_article(duplicate, article_identity)
            self._apply_tags(duplicate, placeholder=placeholder)
            return duplicate

        result = storage.upload_file(uploaded, "legacy/news")

        media = MediaFile.objects.create(
            title=alt.strip() or filename,
            slug=self._unique_slug(filename),
            description=(f"Legacy image unavailable: {failure}" if placeholder else "Imported legacy News image"),
            original_filename=filename,
            file_path=result["file_path"],
            file_url=storage.get_public_url(result["file_path"]),
            file_size=result["file_size"],
            content_type=result["content_type"],
            file_hash=result["file_hash"],
            file_type="image",
            width=result.get("width"),
            height=result.get("height"),
            namespace=self.namespace,
            tenant=self.tenant,
            access_level="public",
            created_by=self.user,
            last_modified_by=self.user,
            uploaded_by=self.user,
            metadata={
                "legacy_source_url": source_url,
                "legacy_source_urls": [source_url],
                "migration_placeholder": placeholder,
                "legacy_media_failure": failure,
                "legacy_news_articles": [article_identity] if article_identity else [],
            },
        )
        self._apply_tags(media, placeholder=placeholder)
        return media

    @staticmethod
    def _record_article(media: MediaFile, article_identity: str) -> None:
        if not article_identity:
            return
        metadata = dict(media.metadata or {})
        articles = list(metadata.get("legacy_news_articles", []))
        if article_identity not in articles:
            articles.append(article_identity)
            metadata["legacy_news_articles"] = articles
            media.metadata = metadata
            media.save(update_fields=["metadata", "updated_at"])

    def _read_image(self, source_url: str) -> tuple[bytes, str]:
        local_path = self.local_assets.get(source_url)
        if local_path:
            content = local_path.read_bytes()
            content_type = mimetypes.guess_type(local_path.name)[0] or "application/octet-stream"
        else:
            current_url = source_url
            response = None
            for _ in range(4):
                self._validate_remote_url(current_url)
                response = self.session.get(current_url, timeout=20, allow_redirects=False)
                if response.is_redirect or response.is_permanent_redirect:
                    location = response.headers.get("Location")
                    if not location:
                        raise ValueError("redirect-without-location")
                    from urllib.parse import urljoin

                    current_url = urljoin(current_url, location)
                    continue
                break
            else:
                raise ValueError("too-many-redirects")
            if response is None:
                raise ValueError("empty-response")
            response.raise_for_status()
            content = response.content
            content_type = response.headers.get("Content-Type", "").split(";", 1)[0].strip()
        if not content or len(content) > MAX_IMAGE_BYTES:
            raise ValueError("empty-or-oversized")
        if not content_type.startswith("image/"):
            raise ValueError("not-an-image")
        if content_type != "image/svg+xml":
            with Image.open(io.BytesIO(content)) as image:
                image.verify()
        return content, content_type

    @staticmethod
    def _validate_remote_url(url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("unsupported-image-url")
        try:
            addresses = {
                ipaddress.ip_address(item[4][0])
                for item in socket.getaddrinfo(
                    parsed.hostname,
                    parsed.port or (443 if parsed.scheme == "https" else 80),
                    type=socket.SOCK_STREAM,
                )
            }
        except (socket.gaierror, ValueError) as exc:
            raise ValueError("unresolvable-image-host") from exc
        if not addresses or any(
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_multicast
            or address.is_reserved
            or address.is_unspecified
            for address in addresses
        ):
            raise ValueError("non-public-image-host")

    def _apply_tags(self, media: MediaFile, *, placeholder: bool) -> None:
        names = ["legacy", "news"] + (["migration-placeholder"] if placeholder else [])
        tags = []
        for name in names:
            tag, _ = MediaTag.objects.get_or_create(
                name=name,
                namespace=self.namespace,
                defaults={"slug": slugify(name), "created_by": self.user},
            )
            tags.append(tag)
        media.tags.add(*tags)
        if not placeholder:
            media.tags.remove(*MediaTag.objects.filter(namespace=self.namespace, slug="migration-placeholder"))

    def _unique_slug(self, filename: str) -> str:
        base = slugify(Path(filename).stem)[:220] or "legacy-image"
        slug = base
        suffix = 1
        while MediaFile.objects.filter(namespace=self.namespace, slug=slug).exists():
            slug = f"{base}-{suffix}"
            suffix += 1
        return slug

    @staticmethod
    def _failure_category(exc: Exception) -> str:
        if isinstance(exc, requests.Timeout):
            return "timeout"
        if isinstance(exc, requests.HTTPError) and exc.response is not None:
            return f"http-{exc.response.status_code}"
        if isinstance(exc, requests.RequestException):
            return "network-error"
        if isinstance(exc, ValueError):
            category = str(exc)
            if category and all(character.isalnum() or character == "-" for character in category):
                return category[:80]
        if isinstance(exc, (UnidentifiedImageError, OSError)):
            return "invalid-image"
        return exc.__class__.__name__.lower()[:80]
