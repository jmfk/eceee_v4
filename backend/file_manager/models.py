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
    slug = models.SlugField(max_length=255)
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
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)


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
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

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

    def get_thumbnail_url(self, size: str = "medium") -> Optional[str]:
        """Get thumbnail URL for images."""
        if not self.is_image:
            return None
        # This will be implemented in the storage service
        return f"/media/thumbnails/{self.id}/{size}.webp"


class MediaThumbnail(models.Model):
    """Thumbnail variants for media files."""

    SIZE_CHOICES = [
        ("small", "Small (150x150)"),
        ("medium", "Medium (300x300)"),
        ("large", "Large (600x600)"),
        ("xlarge", "Extra Large (1200x1200)"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    media_file = models.ForeignKey(
        MediaFile, on_delete=models.CASCADE, related_name="thumbnails"
    )
    size = models.CharField(max_length=10, choices=SIZE_CHOICES)
    file_path = models.CharField(max_length=500, help_text="S3 path to thumbnail")
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    file_size = models.BigIntegerField(help_text="Thumbnail file size in bytes")

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [["media_file", "size"]]
        ordering = ["size"]
        indexes = [
            models.Index(fields=["media_file", "size"]),
        ]

    def __str__(self):
        return f"{self.media_file.title} - {self.get_size_display()}"


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
