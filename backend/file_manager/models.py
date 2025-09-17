"""
Media file management models for comprehensive file database system.

This module provides models for managing media files with S3 storage integration,
AI-powered tagging, collections, and advanced metadata handling.
"""

import uuid
import hashlib
from typing import Optional, Dict, Any
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import FileExtensionValidator
from django.utils.text import slugify
from content.models import Namespace


class MediaTag(models.Model):
    """Tags specifically for media files with namespace support."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    slug = models.SlugField(max_length=50)
    color = models.CharField(
        max_length=7, default="#3B82F6", help_text="Hex color code"
    )
    description = models.TextField(blank=True, help_text="Optional tag description")

    # Namespace integration
    namespace = models.ForeignKey(
        Namespace, on_delete=models.CASCADE, help_text="Namespace this tag belongs to"
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="created_media_tags"
    )

    class Meta:
        unique_together = [["name", "namespace"], ["slug", "namespace"]]
        ordering = ["name"]
        indexes = [
            models.Index(fields=["namespace", "name"]),
            models.Index(fields=["namespace", "slug"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.namespace.name})"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class MediaCollection(models.Model):
    """Collections for grouping related media files."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    slug = models.SlugField(
        max_length=255,
        blank=True,
    )
    description = models.TextField(blank=True)

    # Organization
    tags = models.ManyToManyField(MediaTag, blank=True)
    namespace = models.ForeignKey(
        Namespace,
        on_delete=models.CASCADE,
        help_text="Namespace this collection belongs to",
    )

    # Access control
    access_level = models.CharField(
        max_length=20,
        choices=[
            ("public", "Public"),
            ("members", "Members Only"),
            ("staff", "Staff Only"),
            ("private", "Private"),
        ],
        default="public",
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="created_media_collections"
    )
    last_modified_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="modified_media_collections"
    )

    class Meta:
        unique_together = [["slug", "namespace"]]
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["namespace", "access_level"]),
            models.Index(fields=["namespace", "created_at"]),
            models.Index(fields=["namespace", "slug"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.namespace.name})"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        super().save(*args, **kwargs)

    def _generate_unique_slug(self):
        """Generate a unique slug for the collection within its namespace."""
        from django.utils.text import slugify

        base_slug = slugify(self.title)
        if not base_slug:
            base_slug = "collection"

        slug = base_slug
        counter = 1

        # Check for existing slugs in the same namespace
        while (
            MediaCollection.objects.filter(namespace=self.namespace, slug=slug)
            .exclude(pk=self.pk)
            .exists()
        ):
            slug = f"{base_slug}-{counter}"
            counter += 1

        return slug


class PendingMediaFile(models.Model):
    """Temporary storage for uploaded files awaiting approval."""

    # File type choices (shared with MediaFile)
    FILE_TYPE_CHOICES = [
        ("image", "Image"),
        ("document", "Document"),
        ("video", "Video"),
        ("audio", "Audio"),
        ("archive", "Archive"),
        ("other", "Other"),
    ]

    # Access level choices (shared with MediaFile)
    ACCESS_LEVEL_CHOICES = [
        ("public", "Public"),
        ("members", "Members Only"),
        ("staff", "Staff Only"),
        ("private", "Private"),
    ]

    # Status choices for approval workflow
    STATUS_CHOICES = [
        ("pending", "Pending Approval"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("expired", "Expired"),
    ]

    # File identity and storage
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500, help_text="S3 key/path")
    file_size = models.BigIntegerField(help_text="File size in bytes")
    content_type = models.CharField(max_length=100)
    file_hash = models.CharField(
        max_length=64, unique=True, help_text="SHA-256 hash for deduplication"
    )

    # Media-specific metadata
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES)

    # Image-specific fields
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)

    # AI-generated metadata
    ai_generated_tags = models.JSONField(
        default=list,
        blank=True,
        help_text="AI-suggested tags based on content analysis",
    )
    ai_suggested_title = models.CharField(max_length=255, blank=True)
    ai_extracted_text = models.TextField(
        blank=True, help_text="Text extracted from images/documents via OCR"
    )
    ai_confidence_score = models.FloatField(
        null=True, blank=True, help_text="AI confidence score for suggestions (0.0-1.0)"
    )

    # Organization
    namespace = models.ForeignKey(
        Namespace, on_delete=models.CASCADE, help_text="Namespace this file belongs to"
    )
    folder_path = models.CharField(
        max_length=500, blank=True, help_text="Optional folder path"
    )

    # Approval workflow
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    # Timestamps and ownership
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(help_text="When this pending file expires")
    uploaded_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="pending_media_files"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["namespace", "status"]),
            models.Index(fields=["uploaded_by", "status"]),
            models.Index(fields=["status", "expires_at"]),
            models.Index(fields=["file_hash"]),
        ]

    def __str__(self):
        return f"{self.original_filename} ({self.status})"

    def approve_and_create_media_file(
        self, title, slug=None, description="", tags=None, access_level="public"
    ):
        """
        Approve this pending file and create a MediaFile instance.

        Args:
            title: Title for the media file
            slug: Optional slug (auto-generated if not provided)
            description: Optional description
            tags: List of tag IDs to associate
            access_level: Access level for the file

        Returns:
            MediaFile instance
        """
        from django.utils import timezone
        import logging

        logger = logging.getLogger(__name__)
        logger.info(f"Approving pending file: {self.original_filename} (ID: {self.id})")

        try:
            # Create the MediaFile
            media_file = MediaFile.objects.create(
                title=title,
                slug=slug,
                description=description,
                original_filename=self.original_filename,
                file_path=self.file_path,
                file_size=self.file_size,
                content_type=self.content_type,
                file_hash=self.file_hash,
                file_type=self.file_type,
                width=self.width,
                height=self.height,
                ai_generated_tags=self.ai_generated_tags,
                ai_suggested_title=self.ai_suggested_title,
                ai_extracted_text=self.ai_extracted_text,
                ai_confidence_score=self.ai_confidence_score,
                namespace=self.namespace,
                access_level=access_level,
                created_by=self.uploaded_by,
                last_modified_by=self.uploaded_by,
            )

            logger.info(
                f"Created MediaFile: {media_file.id} for file: {self.original_filename}"
            )

            # Associate tags if provided
            if tags:
                media_file.tags.set(tags)
                logger.info(
                    f"Associated {len(tags)} tags with MediaFile: {media_file.id}"
                )

            # Update status
            self.status = "approved"
            self.save()

            logger.info(f"Successfully approved pending file: {self.original_filename}")
            return media_file

        except Exception as e:
            logger.error(
                f"Failed to create MediaFile for pending file {self.original_filename}: {e}"
            )
            logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
            # Don't update status if MediaFile creation failed
            raise

    def reject(self):
        """Reject this pending file and clean up storage."""
        from .storage import S3MediaStorage
        import logging

        logger = logging.getLogger(__name__)

        # Check if the same file exists in MediaFile (approved files)
        # If it does, don't delete from S3 as it's still being used
        existing_media_file = MediaFile.objects.filter(file_hash=self.file_hash).first()

        if existing_media_file:
            logger.info(
                f"Not deleting S3 file {self.file_path} - same file exists in MediaFile: {existing_media_file.title}"
            )
        else:
            # Check if other pending files with same hash exist
            other_pending_files = (
                PendingMediaFile.objects.filter(
                    file_hash=self.file_hash, status__in=["pending", "approved"]
                )
                .exclude(id=self.id)
                .exists()
            )

            if other_pending_files:
                logger.info(
                    f"Not deleting S3 file {self.file_path} - other pending files with same hash exist"
                )
            else:
                # Safe to delete from S3 - no other references to this file
                try:
                    storage = S3MediaStorage()
                    storage.delete_file(self.file_path)
                    logger.info(f"Deleted rejected file from S3: {self.file_path}")
                except Exception as e:
                    logger.error(
                        f"Failed to delete rejected file {self.file_path}: {e}"
                    )

        # Update status
        self.status = "rejected"
        self.save()

    def is_expired(self):
        """Check if this pending file has expired."""
        from django.utils import timezone

        return timezone.now() > self.expires_at

    @classmethod
    def cleanup_expired(cls):
        """Clean up expired pending files."""
        from django.utils import timezone
        from .storage import S3MediaStorage
        import logging

        logger = logging.getLogger(__name__)
        expired_files = cls.objects.filter(
            status="pending", expires_at__lt=timezone.now()
        )

        storage = S3MediaStorage()

        for pending_file in expired_files:
            try:
                # Check if the same file exists in MediaFile (approved files)
                # If it does, don't delete from S3 as it's still being used
                existing_media_file = MediaFile.objects.filter(
                    file_hash=pending_file.file_hash
                ).first()

                if existing_media_file:
                    logger.info(
                        f"Not deleting S3 file {pending_file.file_path} - same file exists in MediaFile: {existing_media_file.title}"
                    )
                else:
                    # Check if other pending files with same hash exist
                    other_pending_files = (
                        cls.objects.filter(
                            file_hash=pending_file.file_hash,
                            status__in=["pending", "approved"],
                        )
                        .exclude(id=pending_file.id)
                        .exists()
                    )

                    if other_pending_files:
                        logger.info(
                            f"Not deleting S3 file {pending_file.file_path} - other pending files with same hash exist"
                        )
                    else:
                        # Safe to delete from S3 - no other references to this file
                        storage.delete_file(pending_file.file_path)
                        logger.info(
                            f"Deleted expired file from S3: {pending_file.file_path}"
                        )

                # Mark as expired
                pending_file.status = "expired"
                pending_file.save()
            except Exception as e:
                logger.error(
                    f"Failed to cleanup expired file {pending_file.file_path}: {e}"
                )


class MediaFile(models.Model):
    """Core media file model with S3 storage integration."""

    # File type choices
    FILE_TYPE_CHOICES = [
        ("image", "Image"),
        ("document", "Document"),
        ("video", "Video"),
        ("audio", "Audio"),
        ("archive", "Archive"),
        ("other", "Other"),
    ]

    # Access level choices
    ACCESS_LEVEL_CHOICES = [
        ("public", "Public"),
        ("members", "Members Only"),
        ("staff", "Staff Only"),
        ("private", "Private"),
    ]

    # File identity and storage
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    description = models.TextField(blank=True)

    # File information
    original_filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500, help_text="S3 key/path")
    file_size = models.BigIntegerField(help_text="File size in bytes")
    content_type = models.CharField(max_length=100)
    file_hash = models.CharField(
        max_length=64, unique=True, help_text="SHA-256 hash for deduplication"
    )

    # Media-specific metadata
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES)

    # Image-specific fields
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)

    # AI-generated metadata
    ai_generated_tags = models.JSONField(
        default=list,
        blank=True,
        help_text="AI-suggested tags based on content analysis",
    )
    ai_suggested_title = models.CharField(max_length=255, blank=True)
    ai_extracted_text = models.TextField(
        blank=True, help_text="Text extracted from images/documents via OCR"
    )
    ai_confidence_score = models.FloatField(
        null=True, blank=True, help_text="AI confidence score for suggestions (0.0-1.0)"
    )

    # Organization
    namespace = models.ForeignKey(
        Namespace, on_delete=models.CASCADE, help_text="Namespace this file belongs to"
    )
    tags = models.ManyToManyField(MediaTag, blank=True)
    collections = models.ManyToManyField(MediaCollection, blank=True)

    # Access control
    access_level = models.CharField(
        max_length=20, choices=ACCESS_LEVEL_CHOICES, default="public"
    )

    # Usage tracking
    download_count = models.PositiveIntegerField(default=0)
    last_accessed = models.DateTimeField(null=True, blank=True)

    # Timestamps and ownership
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="created_media_files"
    )
    last_modified_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="modified_media_files"
    )

    class Meta:
        unique_together = [["slug", "namespace"]]
        ordering = ["-created_at"]
        indexes = [
            # Performance indexes
            models.Index(fields=["file_type"]),
            models.Index(fields=["namespace", "file_type"]),
            models.Index(fields=["namespace", "access_level"]),
            models.Index(fields=["namespace", "created_at"]),
            models.Index(fields=["file_hash"]),
            models.Index(fields=["content_type"]),
            models.Index(fields=["created_by"]),
            # Search indexes
            models.Index(fields=["namespace", "title"]),
            models.Index(fields=["namespace", "slug"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.original_filename})"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._generate_unique_slug()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        """Custom delete method to handle S3 cleanup and related files."""
        from .storage import S3MediaStorage
        import logging

        logger = logging.getLogger(__name__)
        logger.info(
            f"Deleting MediaFile: {self.title} (ID: {self.id}, File: {self.original_filename})"
        )

        # Check if other files reference the same S3 object (same file_hash)
        other_media_files = (
            MediaFile.objects.filter(file_hash=self.file_hash)
            .exclude(id=self.id)
            .exists()
        )

        other_pending_files = PendingMediaFile.objects.filter(
            file_hash=self.file_hash, status__in=["pending", "approved"]
        ).exists()

        # Only delete from S3 if no other files reference it
        if not other_media_files and not other_pending_files:
            try:
                storage = S3MediaStorage()
                storage.delete_file(self.file_path)
                logger.info(f"Deleted S3 file: {self.file_path}")
            except Exception as e:
                logger.error(f"Failed to delete S3 file {self.file_path}: {e}")
                # Don't fail the database deletion if S3 cleanup fails
        else:
            logger.info(
                f"Not deleting S3 file {self.file_path} - other files reference it"
            )

        # Delete any related PendingMediaFile records with same hash that are approved
        related_pending = PendingMediaFile.objects.filter(
            file_hash=self.file_hash, status="approved"
        )
        if related_pending.exists():
            logger.info(
                f"Deleting {related_pending.count()} related approved pending files"
            )
            related_pending.delete()

        # Call parent delete to remove from database
        super().delete(*args, **kwargs)
        logger.info(f"Successfully deleted MediaFile: {self.title}")

    def _generate_unique_slug(self):
        """Generate a unique, SEO-friendly slug for the media file."""
        import re
        import os
        from django.utils.text import slugify

        # Start with the title, fallback to filename without extension
        base_text = self.title or os.path.splitext(self.original_filename)[0]

        # Clean and optimize for SEO
        base_text = self._clean_text_for_seo(base_text)

        # Generate base slug
        base_slug = slugify(base_text)

        # Ensure minimum length and meaningful content
        if len(base_slug) < 3:
            base_slug = f"file-{base_slug}" if base_slug else "media-file"

        # Ensure uniqueness within namespace
        return self._ensure_unique_slug(base_slug)

    def _clean_text_for_seo(self, text):
        """Clean text for SEO-friendly slug generation."""
        import re

        # Remove file extensions if present
        text = re.sub(
            r"\.(pdf|jpg|jpeg|png|gif|svg|mp4|mp3|doc|docx|txt)$",
            "",
            text,
            flags=re.IGNORECASE,
        )

        # Replace common separators with spaces
        text = re.sub(r"[_\-\.]", " ", text)

        # Remove special characters but keep alphanumeric and spaces
        text = re.sub(r"[^\w\s\-]", "", text)

        # Normalize whitespace
        text = re.sub(r"\s+", " ", text).strip()

        # Convert to title case for better readability
        text = text.title()

        return text

    def _ensure_unique_slug(self, base_slug):
        """Ensure slug is unique within the namespace."""
        slug = base_slug
        counter = 1

        # Check if slug exists in the same namespace
        while (
            MediaFile.objects.filter(namespace=self.namespace, slug=slug)
            .exclude(pk=self.pk)
            .exists()
        ):
            slug = f"{base_slug}-{counter}"
            counter += 1

            # Prevent infinite loops
            if counter > 1000:
                # Fallback to UUID-based slug
                slug = f"{base_slug}-{str(uuid.uuid4())[:8]}"
                break

        return slug

    @property
    def file_size_human(self) -> str:
        """Return human-readable file size."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if self.file_size < 1024.0:
                return f"{self.file_size:.1f} {unit}"
            self.file_size /= 1024.0
        return f"{self.file_size:.1f} PB"

    @property
    def is_image(self) -> bool:
        """Check if file is an image."""
        return self.file_type == "image"

    @property
    def dimensions(self) -> Optional[str]:
        """Return image dimensions as string."""
        if self.width and self.height:
            return f"{self.width}x{self.height}"
        return None

    def calculate_file_hash(self, file_content: bytes) -> str:
        """Calculate SHA-256 hash of file content."""
        return hashlib.sha256(file_content).hexdigest()

    def get_absolute_url(self):
        """Get the canonical URL for this media file using slug."""
        from django.urls import reverse

        return reverse(
            "file_manager:media-file-by-slug",
            kwargs={"namespace_slug": self.namespace.slug, "file_slug": self.slug},
        )

    def get_uuid_url(self):
        """Get the UUID-based URL for this media file."""
        from django.urls import reverse

        return reverse(
            "file_manager:media-file-by-uuid", kwargs={"file_uuid": str(self.id)}
        )

    def get_download_url(self):
        """Get the download URL (SEO-friendly slug version)."""
        from django.urls import reverse

        return reverse(
            "file_manager:media-file-download",
            kwargs={"namespace_slug": self.namespace.slug, "file_slug": self.slug},
        )

    def get_api_url(self):
        """Get the API URL for this media file."""
        from django.urls import reverse

        return reverse("file_manager:mediafile-detail", kwargs={"pk": str(self.id)})

    @classmethod
    def get_by_slug_or_uuid(cls, identifier, namespace=None):
        """
        Get media file by slug or UUID.

        Args:
            identifier: Either a slug or UUID string
            namespace: Namespace object or slug (required for slug lookup)

        Returns:
            MediaFile instance or None
        """
        import uuid as uuid_module

        # Try to parse as UUID first
        try:
            uuid_obj = uuid_module.UUID(identifier)
            return cls.objects.get(id=uuid_obj)
        except (ValueError, cls.DoesNotExist):
            pass

        # Try as slug (requires namespace)
        if namespace:
            try:
                if hasattr(namespace, "slug"):
                    namespace_slug = namespace.slug
                else:
                    namespace_slug = str(namespace)

                from content.models import Namespace

                namespace_obj = Namespace.objects.get(slug=namespace_slug)
                return cls.objects.get(slug=identifier, namespace=namespace_obj)
            except (cls.DoesNotExist, Namespace.DoesNotExist):
                pass

        return None

    def get_imgproxy_url(self, width=None, height=None, **kwargs):
        """
        Get imgproxy URL for on-the-fly image processing.

        Args:
            width: Target width in pixels
            height: Target height in pixels
            **kwargs: Additional imgproxy options (resize_type, quality, format, etc.)

        Returns:
            imgproxy URL for processed image, or original URL if not an image
        """
        if self.file_type != "image":
            return self.get_file_url()

        from .imgproxy import get_image_url
        from .storage import S3MediaStorage

        storage = S3MediaStorage()
        source_url = storage.get_public_url(self.file_path)

        return get_image_url(
            source_url=source_url, width=width, height=height, **kwargs
        )

    def get_responsive_urls(self, **kwargs):
        """
        Get responsive image URLs for different screen sizes.

        Args:
            **kwargs: Additional imgproxy options

        Returns:
            Dictionary mapping size names to imgproxy URLs
        """
        if self.file_type != "image":
            return {"original": self.get_file_url()}

        from .imgproxy import get_responsive_images
        from .storage import S3MediaStorage

        storage = S3MediaStorage()
        source_url = storage.get_public_url(self.file_path)

        return get_responsive_images(source_url=source_url, **kwargs)

    def get_imgproxy_thumbnail_url(self, size=150):
        """
        Get thumbnail URL using imgproxy.

        Args:
            size: Thumbnail size (square)

        Returns:
            Thumbnail imgproxy URL
        """
        if self.file_type != "image":
            return self.get_file_url()

        from .imgproxy import get_thumbnail_url
        from .storage import S3MediaStorage

        storage = S3MediaStorage()
        source_url = storage.get_public_url(self.file_path)

        return get_thumbnail_url(source_url=source_url, size=size)

    def get_preset_url(self, preset):
        """
        Get imgproxy URL using a predefined preset.

        Args:
            preset: Preset name (thumbnail, small, medium, large, hero, avatar)

        Returns:
            imgproxy URL with preset
        """
        if self.file_type != "image":
            return self.get_file_url()

        from .imgproxy import imgproxy_service
        from .storage import S3MediaStorage

        storage = S3MediaStorage()
        source_url = storage.get_public_url(self.file_path)

        return imgproxy_service.get_preset_url(source_url=source_url, preset=preset)

    def get_optimized_url(self, width=None, height=None, webp=True, quality=85):
        """
        Get optimized image URL with modern format support.

        Args:
            width: Target width
            height: Target height
            webp: Enable WebP format detection
            quality: Image quality (1-100)

        Returns:
            Optimized imgproxy URL
        """
        if self.file_type != "image":
            return self.get_file_url()

        from .imgproxy import imgproxy_service
        from .storage import S3MediaStorage

        storage = S3MediaStorage()
        source_url = storage.get_public_url(self.file_path)

        return imgproxy_service.get_optimized_url(
            source_url=source_url,
            width=width,
            height=height,
            webp=webp,
            quality=quality,
        )

    def get_file_url(self):
        """Get the direct file URL (S3 or local)."""
        from .storage import S3MediaStorage

        storage = S3MediaStorage()
        return storage.get_public_url(self.file_path)


class MediaUsage(models.Model):
    """Track where media files are used throughout the system."""

    USAGE_TYPE_CHOICES = [
        ("widget", "Widget"),
        ("page_data", "Page Data"),
        ("content", "Content"),
        ("collection", "Collection"),
        ("other", "Other"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    media_file = models.ForeignKey(
        MediaFile, on_delete=models.CASCADE, related_name="usage_records"
    )

    # Usage context
    usage_type = models.CharField(max_length=20, choices=USAGE_TYPE_CHOICES)
    object_id = models.CharField(
        max_length=100, help_text="ID of the object using this media"
    )
    object_type = models.CharField(
        max_length=50, help_text="Type of object (model name)"
    )
    field_name = models.CharField(
        max_length=100, blank=True, help_text="Field name where media is used"
    )

    # Context metadata
    context_data = models.JSONField(
        default=dict, blank=True, help_text="Additional context about usage"
    )

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="media_usage_records"
    )

    class Meta:
        unique_together = [["media_file", "usage_type", "object_id", "field_name"]]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["media_file"]),
            models.Index(fields=["usage_type", "object_id"]),
            models.Index(fields=["object_type"]),
        ]

    def __str__(self):
        return f"{self.media_file.title} used in {self.usage_type}: {self.object_id}"
