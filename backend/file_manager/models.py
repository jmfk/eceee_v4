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

    @property
    def has_tags(self):
        """Check if collection has at least one tag."""
        return self.tags.exists()

    def can_accept_uploads(self):
        """
        Check if collection can accept file uploads.
        
        Returns:
            bool: True if collection has at least one tag, False otherwise.
        """
        return self.has_tags


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

    # Additional metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata (e.g., annotation, custom fields)",
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
        self, title, slug=None, description="", annotation="", tags=None, access_level="public"
    ):
        """
        Approve this pending file and create a MediaFile instance.

        Args:
            title: Title for the media file
            slug: Optional slug (auto-generated if not provided)
            description: Optional description
            annotation: Optional annotation text (stored in metadata)
            tags: List of tag IDs to associate
            access_level: Access level for the file

        Returns:
            MediaFile instance
        """
        from django.utils import timezone
        import logging

        logger = logging.getLogger(__name__)

        try:
            # Ensure we have a namespace
            if not self.namespace:
                raise ValueError("PendingMediaFile has no namespace. Cannot approve without a namespace.")
            
            # Create the MediaFile using atomic helper
            # This will handle any soft-deleted files with the same hash
            media_file = MediaFile.create_with_hash_cleanup(
                file_hash=self.file_hash,
                title=title,
                slug=slug,
                description=description,
                original_filename=self.original_filename,
                file_path=self.file_path,
                file_size=self.file_size,
                content_type=self.content_type,
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

            # Store annotation in metadata if provided
            if annotation:
                media_file.metadata = media_file.metadata or {}
                media_file.metadata["annotation"] = annotation
                media_file.save()

            # Associate tags if provided
            if tags:
                media_file.tags.set(tags)

            # Update status
            self.status = "approved"
            self.save()

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
            pass
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
                pass
            else:
                # Safe to delete from S3 - no other references to this file
                try:
                    storage = S3MediaStorage()
                    storage.delete_file(self.file_path)
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

    def get_thumbnail_path(self):
        """
        Get S3 path for document thumbnail if exists.

        Returns:
            Thumbnail S3 path or None
        """
        if not self.metadata:
            return None
        return self.metadata.get('thumbnail_path')

    def has_thumbnail(self):
        """
        Check if document has generated thumbnail.

        Returns:
            True if thumbnail exists, False otherwise
        """
        return bool(self.get_thumbnail_path())

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
                    pass
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
                        pass
                    else:
                        # Safe to delete from S3 - no other references to this file
                        storage.delete_file(pending_file.file_path)

                # Mark as expired
                pending_file.status = "expired"
                pending_file.save()
            except Exception as e:
                logger.error(
                    f"Failed to cleanup expired file {pending_file.file_path}: {e}"
                )


class MediaFileManager(models.Manager):
    """Custom manager for MediaFile model to handle soft deletes."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

    def with_deleted(self):
        return super().get_queryset()

    def only_deleted(self):
        return super().get_queryset().filter(is_deleted=True)


class MediaFile(models.Model):
    """Core media file model with S3 storage integration."""

    objects = MediaFileManager()

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
    file_url = models.URLField(
        max_length=500, help_text="Public URL for the file", null=True, blank=True
    )
    file_size = models.BigIntegerField(help_text="File size in bytes")
    content_type = models.CharField(max_length=100)
    file_hash = models.CharField(
        max_length=64, unique=True, help_text="SHA-256 hash for deduplication"
    )
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="uploaded_media_files",
        null=True,
        blank=True,
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

    # Additional metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata (e.g., annotation, custom fields)",
    )

    # Organization
    namespace = models.ForeignKey(
        Namespace, on_delete=models.CASCADE, help_text="Namespace this file belongs to"
    )
    
    # Multi-tenancy support
    tenant = models.ForeignKey(
        "core.Tenant",
        on_delete=models.CASCADE,
        related_name="media_files",
        help_text="Tenant this media file belongs to",
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

    # Reference tracking
    reference_count = models.PositiveIntegerField(
        default=0, help_text="Number of times this file is referenced in content"
    )
    last_referenced = models.DateTimeField(null=True, blank=True)
    referenced_in = models.JSONField(
        default=dict,
        blank=True,
        help_text="Dictionary of content references {content_type: [ids]}",
    )

    # Soft delete
    is_deleted = models.BooleanField(default=False, help_text="Soft delete flag")
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="deleted_media_files",
    )

    # Replacement tracking
    replaced_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replaced_files",
        help_text="If this file was replaced, points to the replacement",
    )

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
            models.Index(fields=["tenant_id"], name="mediafile_tenant_idx"),
            # Search indexes
            models.Index(fields=["namespace", "title"]),
            models.Index(fields=["namespace", "slug"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.original_filename})"

    @classmethod
    def create_with_hash_cleanup(cls, file_hash: str, **kwargs):
        """
        Create a new MediaFile, atomically handling any soft-deleted records with the same hash.

        This method ensures that:
        1. Any soft-deleted MediaFile with the same hash is hard-deleted first
        2. The object in object storage is preserved (not deleted if referenced elsewhere)
        3. A new MediaFile record is created with fresh metadata
        4. All operations happen atomically in a single transaction

        Args:
            file_hash: The SHA-256 hash of the file
            **kwargs: All other fields needed to create a MediaFile

        Returns:
            MediaFile: The newly created MediaFile instance

        Raises:
            ValidationError: If an active (non-deleted) file with the same hash already exists
            IntegrityError: If the creation fails due to other database constraints
        """
        from django.db import transaction
        from django.core.exceptions import ValidationError
        import logging

        logger = logging.getLogger(__name__)

        with transaction.atomic():
            # Check for existing active file with same hash (true duplicate)
            existing_active = cls.objects.filter(file_hash=file_hash).first()
            if existing_active:
                logger.warning(
                    f"Cannot create MediaFile: active file with hash {file_hash} already exists (ID: {existing_active.id})"
                )
                raise ValidationError(
                    f"An active file with this content already exists: {existing_active.title}"
                )

            # Find and hard delete any soft-deleted records with same hash
            existing_deleted = (
                cls.objects.with_deleted()
                .filter(file_hash=file_hash, is_deleted=True)
                .first()
            )

            if existing_deleted:
                # Hard delete the soft-deleted record
                # The delete method will preserve the S3 object if other files reference it
                existing_deleted.delete(force=True)

            # Create the new MediaFile
            kwargs["file_hash"] = file_hash
            
            # Generate slug if not provided
            if not kwargs.get("slug"):
                # Create a temporary instance to use the slug generation method
                # Include namespace to avoid RelatedObjectDoesNotExist
                temp_instance = cls(
                    title=kwargs.get("title", "untitled"),
                    namespace=kwargs.get("namespace")
                )
                kwargs["slug"] = temp_instance._generate_unique_slug()
            
            new_file = cls.objects.create(**kwargs)

            return new_file

    def save(self, *args, **kwargs):
        # Only auto-generate slug on creation (not on updates)
        if not self.slug and self.pk is None:
            self.slug = self._generate_unique_slug()
        super().save(*args, **kwargs)

    def add_reference(self, content_type, content_id):
        """
        Add a reference to this media file.

        Args:
            content_type: The type of content (e.g., 'webpage', 'widget')
            content_id: The ID of the content
        """
        from django.utils import timezone

        refs = self.referenced_in
        if content_type not in refs:
            refs[content_type] = []

        if content_id not in refs[content_type]:
            refs[content_type].append(content_id)
            self.reference_count = self.reference_count + 1
            self.last_referenced = timezone.now()
            self.referenced_in = refs
            self.save(
                update_fields=["reference_count", "last_referenced", "referenced_in"]
            )

    def remove_reference(self, content_type, content_id):
        """
        Remove a reference to this media file.

        Args:
            content_type: The type of content (e.g., 'webpage', 'widget')
            content_id: The ID of the content

        Returns:
            bool: True if reference was removed, False if not found
        """
        refs = self.referenced_in
        if content_type not in refs or content_id not in refs[content_type]:
            return False

        refs[content_type].remove(content_id)
        if not refs[content_type]:
            del refs[content_type]

        self.reference_count = self.reference_count - 1
        self.referenced_in = refs
        self.save(update_fields=["reference_count", "referenced_in"])
        return True

    def get_references(self):
        """
        Get all references to this media file.

        Returns:
            dict: Dictionary of content references {content_type: [ids]}
        """
        return self.referenced_in

    def restore(self, user=None):
        """
        Restore a soft-deleted media file.

        Args:
            user: The user performing the restore action
        """
        if not self.is_deleted:
            return False

        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])
        return True

    def delete(self, user=None, force=False, *args, **kwargs):
        """
        Override delete to implement soft delete functionality.

        Args:
            user: The user performing the delete action
            force: If True, performs a hard delete regardless of reference count

        Returns:
            bool: True if delete was successful, False if prevented due to references
        """
        if force:
            # Handle S3 cleanup and related files
            from .storage import S3MediaStorage
            import logging

            logger = logging.getLogger(__name__)

            # Check if other files reference the same S3 object (same file_hash)
            # Need to check both active and soft-deleted MediaFile records
            other_media_files = (
                MediaFile.objects.with_deleted()
                .filter(file_hash=self.file_hash)
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
                except Exception as e:
                    logger.error(f"Failed to delete S3 file {self.file_path}: {e}")
                    # Don't fail the database deletion if S3 cleanup fails

            # Delete any related PendingMediaFile records with same hash that are approved
            related_pending = PendingMediaFile.objects.filter(
                file_hash=self.file_hash, status="approved"
            )
            if related_pending.exists():
                related_pending.delete()

            # Call parent delete to remove from database
            return super().delete(*args, **kwargs)

        if self.reference_count > 0:
            return False

        from django.utils import timezone

        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = user
        self.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])
        return True

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

        # Use file hash as version for cache-busting
        kwargs.setdefault("version", self.file_hash)

        return get_image_url(
            source_url=source_url, width=width, height=height, **kwargs
        )

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

        # #region agent log
        import json
        try:
            with open('/Users/jmfk/code/eceee_v4/.cursor/debug.log', 'a') as f:
                f.write(json.dumps({"location":"models.py:1035","message":"Before get_thumbnail_url call","data":{"source_url":source_url,"size":size,"version":self.file_hash},"timestamp":__import__('time').time()*1000,"sessionId":"debug-session","hypothesisId":"H1"}) + '\n')
        except: pass
        # #endregion

        return get_thumbnail_url(source_url=source_url, size=size, version=self.file_hash)

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

        return imgproxy_service.get_preset_url(source_url=source_url, preset=preset, version=self.file_hash)

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
            version=self.file_hash,
        )

    def get_file_url(self):
        """Get the direct file URL (S3 or local)."""
        from .storage import S3MediaStorage

        storage = S3MediaStorage()
        return storage.get_public_url(self.file_path)

    def get_thumbnail_path(self):
        """
        Get S3 path for document thumbnail if exists.

        Returns:
            Thumbnail S3 path or None
        """
        if not self.metadata:
            return None
        return self.metadata.get('thumbnail_path')

    def has_thumbnail(self):
        """
        Check if document has generated thumbnail.

        Returns:
            True if thumbnail exists, False otherwise
        """
        return bool(self.get_thumbnail_path())


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
