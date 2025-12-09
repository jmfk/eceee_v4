"""
DRF serializers for file manager API endpoints.

Provides serialization for media files, tags, collections, and related models
following the existing API patterns and camelCase conversion.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from django.conf import settings
from content.models import Namespace
from .models import MediaFile, MediaTag, MediaCollection, MediaUsage, PendingMediaFile
from utils.serializers import UserSerializer


def convert_tag_names_to_ids(tag_items, namespace, user):
    """
    Convert a list of tag names/IDs to actual tag IDs.
    Creates new tags if they don't exist.

    Args:
        tag_items: List of tag names or UUIDs
        namespace: Namespace object
        user: User object for creating new tags

    Returns:
        List of tag UUID strings
    """
    import uuid

    tag_ids = []

    for tag_item in tag_items:
        tag_item = str(tag_item).strip()
        if not tag_item:
            continue

        # Check if it's already a UUID (tag ID)
        try:
            uuid.UUID(tag_item)
            # It's a valid UUID, check if tag exists
            if MediaTag.objects.filter(id=tag_item, namespace=namespace).exists():
                tag_ids.append(tag_item)
            else:
                raise serializers.ValidationError(f"Tag with ID {tag_item} not found.")
        except ValueError:
            # It's a tag name, find or create the tag
            tag, created = MediaTag.objects.get_or_create(
                name=tag_item,
                namespace=namespace,
                defaults={
                    "created_by": user,
                    "slug": tag_item.lower().replace(" ", "-"),
                },
            )
            tag_ids.append(str(tag.id))

    return tag_ids


class MediaTagSerializer(serializers.ModelSerializer):
    """Serializer for media tags."""

    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    namespace = serializers.CharField(source="namespace.slug", required=False)
    usage_count = serializers.SerializerMethodField()

    def get_usage_count(self, obj):
        """Get the number of files using this tag."""
        # Check if file_count is already annotated (from usage_stats endpoint)
        if hasattr(obj, "file_count"):
            return obj.file_count
        # Otherwise, count manually
        return obj.mediafile_set.count()

    class Meta:
        model = MediaTag
        fields = [
            "id",
            "name",
            "slug",
            "color",
            "description",
            "namespace",
            "created_at",
            "created_by",
            "created_by_name",
            "usage_count",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "created_by",
            "created_by_name",
            "usage_count",
        ]

    def create(self, validated_data):
        """Set created_by from request user and handle namespace slug conversion."""
        from content.models import Namespace
        from django.db import IntegrityError

        # Set created_by from request user
        validated_data["created_by"] = self.context["request"].user

        # Handle namespace conversion from slug to object
        namespace_slug = validated_data.get("namespace").get("slug")
        if namespace_slug:
            try:
                validated_data["namespace"] = Namespace.objects.get(slug=namespace_slug)
            except Namespace.DoesNotExist:
                raise serializers.ValidationError(
                    f"Namespace '{namespace_slug}' not found."
                )
        else:
            # Set default namespace if none provided
            validated_data["namespace"] = Namespace.get_default()

        # Check if tag with same name already exists in this namespace
        existing_tag, created = MediaTag.objects.get_or_create(
            name=validated_data["name"],
            namespace=validated_data["namespace"],
            defaults={
                "slug": validated_data.get(
                    "slug", validated_data["name"].lower().replace(" ", "-")
                ),
                "created_by": validated_data["created_by"],
                "color": validated_data.get("color", "#3B82F6"),
                "description": validated_data.get("description", ""),
            },
        )

        return existing_tag


class MediaUsageSerializer(serializers.ModelSerializer):
    """Serializer for media usage tracking."""

    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )

    class Meta:
        model = MediaUsage
        fields = [
            "id",
            "usage_type",
            "object_id",
            "object_type",
            "field_name",
            "context_data",
            "created_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = ["id", "created_at", "created_by", "created_by_name"]


class MediaCollectionSerializer(serializers.ModelSerializer):
    """Serializer for media collections."""

    tags = MediaTagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False, allow_empty=True
    )

    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    last_modified_by_name = serializers.CharField(
        source="last_modified_by.username", read_only=True
    )
    namespace = serializers.CharField(source="namespace.slug", required=False)
    file_count = serializers.SerializerMethodField()
    sample_images = serializers.SerializerMethodField()
    slug = serializers.SlugField(required=False, allow_blank=True)

    class Meta:
        model = MediaCollection
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "namespace",
            "access_level",
            "tags",
            "tag_ids",
            "file_count",
            "sample_images",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "last_modified_by",
            "last_modified_by_name",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "last_modified_by",
            "last_modified_by_name",
            "file_count",
            "sample_images",
        ]

    def get_file_count(self, obj):
        """Get number of files in collection."""
        return obj.mediafile_set.count()

    def get_sample_images(self, obj):
        """Get sample images for thumbnail grid (max 16)."""
        # Get image files from the collection
        image_files = obj.mediafile_set.filter(file_type="image")[
            :16
        ]  # Limit to 16 images max

        # Return simplified data for thumbnails
        sample_images = []
        for file in image_files:
            # Get the file URL for images
            imgproxy_url = file.get_file_url()
            if imgproxy_url:
                sample_images.append(
                    {
                        "id": str(file.id),
                        "imgproxy_base_url": imgproxy_url,
                        "title": file.title or file.original_filename,
                    }
                )

        return sample_images

    def create(self, validated_data):
        """Create collection with tags."""
        from content.models import Namespace

        tag_ids = validated_data.pop("tag_ids", [])
        validated_data["created_by"] = self.context["request"].user
        validated_data["last_modified_by"] = self.context["request"].user

        # Handle namespace conversion from slug to object
        namespace_slug = validated_data.get("namespace").get("slug")
        if namespace_slug:
            try:
                validated_data["namespace"] = Namespace.objects.get(slug=namespace_slug)
            except Namespace.DoesNotExist:
                raise serializers.ValidationError(
                    f"Namespace '{namespace_slug}' not found."
                )
        else:
            # Set default namespace if none provided
            validated_data["namespace"] = Namespace.get_default()

        collection = super().create(validated_data)

        if tag_ids:
            tags = MediaTag.objects.filter(
                id__in=tag_ids, namespace=collection.namespace
            )
            collection.tags.set(tags)

        return collection

    def update(self, instance, validated_data):
        """Update collection with tags."""
        tag_ids = validated_data.pop("tag_ids", None)
        validated_data["last_modified_by"] = self.context["request"].user

        collection = super().update(instance, validated_data)

        if tag_ids is not None:
            tags = MediaTag.objects.filter(
                id__in=tag_ids, namespace=collection.namespace
            )
            collection.tags.set(tags)

        return collection


class MediaFileListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for media file lists."""

    tags = MediaTagSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    namespace = serializers.CharField(source="namespace.slug", read_only=True)
    file_size_human = serializers.CharField(read_only=True)
    dimensions = serializers.CharField(read_only=True)
    imgproxy_base_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    # SEO-friendly URLs
    absolute_url = serializers.SerializerMethodField()
    uuid_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()
    annotation = serializers.SerializerMethodField()

    class Meta:
        model = MediaFile
        fields = [
            "id",
            "title",
            "slug",
            "file_type",
            "content_type",
            "file_size",
            "file_size_human",
            "width",
            "height",
            "dimensions",
            "access_level",
            "namespace",
            "tags",
            "imgproxy_base_url",
            "thumbnail_url",
            "absolute_url",
            "uuid_url",
            "download_url",
            "annotation",
            "created_at",
            "created_by",
            "created_by_name",
        ]

    def get_imgproxy_base_url(self, obj):
        """Get imgproxy base URL for dynamic resizing."""
        if obj.is_image:
            return obj.get_file_url()
        return None

    def get_thumbnail_url(self, obj):
        """Get pre-generated thumbnail URL (150x150)."""
        if obj.is_image:
            return obj.get_imgproxy_thumbnail_url(size=150)
        return None

    def get_absolute_url(self, obj):
        """Get SEO-friendly slug-based URL."""
        try:
            return obj.get_absolute_url()
        except:
            return None

    def get_uuid_url(self, obj):
        """Get UUID-based URL."""
        try:
            return obj.get_uuid_url()
        except:
            return None

    def get_download_url(self, obj):
        """Get download URL."""
        try:
            return obj.get_download_url()
        except:
            return None

    def get_annotation(self, obj):
        """Get annotation from metadata."""
        if hasattr(obj, 'metadata') and obj.metadata and isinstance(obj.metadata, dict):
            return obj.metadata.get("annotation", "")
        return ""


class MediaFileDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for individual media files."""

    deleted_by = UserSerializer(read_only=True)
    reference_count = serializers.IntegerField(read_only=True)
    is_deletable = serializers.SerializerMethodField()

    def get_is_deletable(self, obj):
        """Check if file can be deleted (no references)."""
        return obj.reference_count == 0

    tags = MediaTagSerializer(many=True, read_only=True)
    collections = MediaCollectionSerializer(many=True, read_only=True)
    usage_records = MediaUsageSerializer(many=True, read_only=True)

    tag_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False, allow_empty=True
    )
    collection_ids = serializers.ListField(
        child=serializers.UUIDField(), write_only=True, required=False, allow_empty=True
    )

    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    last_modified_by_name = serializers.CharField(
        source="last_modified_by.username", read_only=True
    )
    namespace = serializers.CharField(source="namespace.slug", read_only=True)
    file_size_human = serializers.CharField(read_only=True)
    dimensions = serializers.CharField(read_only=True)
    file_url = serializers.SerializerMethodField()

    # imgproxy base URL for dynamic resizing
    imgproxy_base_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    annotation = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = MediaFile
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "original_filename",
            "file_path",
            "file_size",
            "file_size_human",
            "content_type",
            "file_hash",
            "file_type",
            "width",
            "height",
            "dimensions",
            "ai_generated_tags",
            "ai_suggested_title",
            "ai_extracted_text",
            "ai_confidence_score",
            "namespace",
            "access_level",
            "download_count",
            "last_accessed",
            "tags",
            "collections",
            "usage_records",
            "tag_ids",
            "collection_ids",
            "file_url",
            "imgproxy_base_url",
            "thumbnail_url",
            "annotation",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "last_modified_by",
            "last_modified_by_name",
            # Soft delete fields
            "is_deleted",
            "deleted_at",
            "deleted_by",
            # Reference tracking fields
            "reference_count",
            "last_referenced",
            "is_deletable",
        ]
        read_only_fields = [
            "id",
            "file_path",
            "file_size",
            "content_type",
            "file_hash",
            "width",
            "height",
            "ai_generated_tags",
            "ai_suggested_title",
            "ai_extracted_text",
            "ai_confidence_score",
            "download_count",
            "last_accessed",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "last_modified_by",
            "last_modified_by_name",
            "namespace",
            "file_size_human",
            "dimensions",
            "file_url",
            # Soft delete fields
            "is_deleted",
            "deleted_at",
            "deleted_by",
            # Reference tracking fields
            "reference_count",
            "last_referenced",
            "is_deletable",
        ]

    def get_file_url(self, obj):
        """Get file URL."""
        # This will be implemented with the storage service
        return f"/api/media/files/{obj.id}/download/"

    def validate_slug(self, value):
        """Validate slug format and uniqueness within namespace."""
        import re
        from django.utils.text import slugify

        if not value:
            return value

        # Clean and normalize the slug
        cleaned_slug = slugify(value)

        # Validate format (lowercase, alphanumeric, hyphens only)
        if not re.match(r'^[a-z0-9-]+$', cleaned_slug):
            raise serializers.ValidationError(
                "Slug must contain only lowercase letters, numbers, and hyphens."
            )

        # Check uniqueness within namespace (excluding current instance)
        instance = self.instance
        if instance:
            from content.models import Namespace
            
            # Check if slug exists in the same namespace (excluding this file)
            existing = MediaFile.objects.filter(
                namespace=instance.namespace, slug=cleaned_slug
            ).exclude(pk=instance.pk).first()

            if existing:
                raise serializers.ValidationError(
                    f"A file with slug '{cleaned_slug}' already exists in this namespace."
                )

        return cleaned_slug

    def update(self, instance, validated_data):
        """Update media file with tags and collections."""
        tag_ids = validated_data.pop("tag_ids", None)
        collection_ids = validated_data.pop("collection_ids", None)
        annotation = validated_data.pop("annotation", None)
        validated_data["last_modified_by"] = self.context["request"].user

        # Handle annotation in metadata
        if annotation is not None and hasattr(instance, 'metadata'):
            if not instance.metadata:
                instance.metadata = {}
            instance.metadata["annotation"] = annotation
            instance.save(update_fields=["metadata"])

        media_file = super().update(instance, validated_data)

        if tag_ids is not None:
            tags = MediaTag.objects.filter(
                id__in=tag_ids, namespace=media_file.namespace
            )
            media_file.tags.set(tags)

        if collection_ids is not None:
            collections = MediaCollection.objects.filter(
                id__in=collection_ids, namespace=media_file.namespace
            )
            media_file.collections.set(collections)

        return media_file

    def get_imgproxy_base_url(self, obj):
        """Get imgproxy base URL for dynamic resizing."""
        if obj.is_image:
            return obj.get_file_url()
        return None

    def get_thumbnail_url(self, obj):
        """Get pre-generated thumbnail URL (150x150 for images, or document thumbnail)."""
        if obj.is_image:
            return obj.get_imgproxy_thumbnail_url(size=150)
        elif obj.file_type == 'document' and obj.has_thumbnail():
            from .storage import S3MediaStorage
            storage = S3MediaStorage()
            return storage.get_public_url(obj.get_thumbnail_path())
        return None

    def to_representation(self, instance):
        """Add annotation from metadata to representation."""
        representation = super().to_representation(instance)
        if hasattr(instance, 'metadata') and instance.metadata and isinstance(instance.metadata, dict):
            representation["annotation"] = instance.metadata.get("annotation", "")
        else:
            representation["annotation"] = ""
        return representation


class MediaUploadSerializer(serializers.Serializer):
    """Serializer for file upload requests."""

    files = serializers.ListField(
        child=serializers.FileField(),
        allow_empty=False,
        max_length=getattr(
            settings, "MEDIA_MAX_FILES_PER_UPLOAD", 50
        ),  # Configurable limit (field limits handled separately)
    )
    folder_path = serializers.CharField(
        max_length=200, required=False, allow_blank=True
    )
    namespace = serializers.CharField(required=True)
    force_upload = serializers.BooleanField(required=False, default=False)
    replace_files = serializers.JSONField(
        required=False,
        default=dict,
        help_text="Map of filename to action: 'replace' or 'keep'. For replace, also include existing file ID.",
    )
    
    # ZIP extraction fields
    collection_id = serializers.UUIDField(
        required=False,
        allow_null=True,
        help_text="Collection ID to add extracted files to (for ZIP uploads)"
    )
    extract_zip = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Whether to extract ZIP files or upload as-is"
    )
    max_zip_size = serializers.IntegerField(
        required=False,
        allow_null=True,
        help_text="Override maximum ZIP file size in bytes"
    )

    def validate_namespace(self, value):
        """Validate namespace exists and user has access."""
        try:
            if value == "default":
                namespace = Namespace.get_default()
            else:
                namespace = Namespace.objects.get(slug=value)
            # Add permission check here if needed
            return namespace.slug
        except Namespace.DoesNotExist:
            raise serializers.ValidationError("Invalid namespace.")

    def validate_files(self, files):
        """Validate uploaded files."""
        max_file_size = getattr(
            settings, "MEDIA_FILE_MAX_SIZE", 100 * 1024 * 1024
        )  # 100MB
        allowed_types = getattr(
            settings,
            "MEDIA_ALLOWED_TYPES",
            [
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/webp",
                "image/svg+xml",  # Added for testing
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "video/mp4",
                "video/webm",
                "audio/mpeg",
                "audio/wav",
                "application/zip",  # Allow ZIP files
                "application/x-zip-compressed",  # Alternative ZIP MIME type
            ],
        )

        for file in files:
            # Check file size (allow larger for ZIP files)
            is_zip = file.content_type in ["application/zip", "application/x-zip-compressed"]
            file_max_size = max_file_size if not is_zip else max_file_size
            
            if file.size > file_max_size:
                raise serializers.ValidationError(
                    f"File {file.name} is too large. Maximum size is {file_max_size // (1024*1024)}MB."
                )

            # Check content type
            if file.content_type not in allowed_types:
                raise serializers.ValidationError(
                    f"File type {file.content_type} is not allowed for {file.name}."
                )

        return files


class MediaSearchSerializer(serializers.Serializer):
    """Serializer for media search requests."""

    # Legacy search field (for backward compatibility)
    q = serializers.CharField(required=False, allow_blank=True)

    # New structured search fields
    text_search = serializers.CharField(
        required=False, allow_blank=True, max_length=255
    )
    tag_names = serializers.ListField(
        child=serializers.CharField(max_length=100), required=False, allow_empty=True
    )
    text_tags = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        allow_empty=True,
        help_text="Search for tags by text, matching against tag names and slugs",
    )

    # Existing fields
    file_type = serializers.ChoiceField(
        choices=MediaFile.FILE_TYPE_CHOICES, required=False, allow_blank=True
    )
    # New fields for multiple file type and MIME type filtering
    file_types = serializers.ListField(
        child=serializers.ChoiceField(choices=MediaFile.FILE_TYPE_CHOICES),
        required=False,
        allow_empty=True,
    )
    mime_types = serializers.ListField(
        child=serializers.CharField(max_length=100), required=False, allow_empty=True
    )
    tags = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    collections = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    access_level = serializers.ChoiceField(
        choices=MediaFile.ACCESS_LEVEL_CHOICES, required=False, allow_blank=True
    )
    created_after = serializers.DateTimeField(required=False)
    created_before = serializers.DateTimeField(required=False)
    min_size = serializers.IntegerField(required=False, min_value=0)
    max_size = serializers.IntegerField(required=False, min_value=0)
    namespace = serializers.CharField(required=False)

    def validate_namespace(self, value):
        """Validate namespace exists."""
        if value:
            try:
                if value == "default":
                    namespace = Namespace.get_default()
                else:
                    namespace = Namespace.objects.get(slug=value)
                return namespace.slug
            except Namespace.DoesNotExist:
                raise serializers.ValidationError("Invalid namespace.")
        return value

    def validate(self, data):
        """Cross-field validation."""
        if data.get("min_size") and data.get("max_size"):
            if data["min_size"] > data["max_size"]:
                raise serializers.ValidationError(
                    "min_size cannot be greater than max_size."
                )

        if data.get("created_after") and data.get("created_before"):
            if data["created_after"] > data["created_before"]:
                raise serializers.ValidationError(
                    "created_after cannot be after created_before."
                )

        # Validate that both q and text_search are not provided (avoid confusion)
        if data.get("q") and data.get("text_search"):
            raise serializers.ValidationError(
                "Cannot use both 'q' and 'text_search' parameters. Use 'text_search' for new implementations."
            )

        return data


class AIMediaSuggestionsSerializer(serializers.Serializer):
    """Serializer for AI suggestion requests."""

    file_id = serializers.UUIDField(required=True)

    def validate_file_id(self, value):
        """Validate file exists and user has access."""
        try:
            media_file = MediaFile.objects.get(id=value)
            # Add permission check here if needed
            return media_file
        except MediaFile.DoesNotExist:
            raise serializers.ValidationError("Media file not found.")


class BulkOperationSerializer(serializers.Serializer):
    """Serializer for bulk operations on media files."""

    OPERATION_CHOICES = [
        ("add_tags", "Add Tags"),
        ("remove_tags", "Remove Tags"),
        ("set_access_level", "Set Access Level"),
        ("add_to_collection", "Add to Collection"),
        ("remove_from_collection", "Remove from Collection"),
        ("delete", "Delete Files"),
    ]

    file_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        max_length=100,  # Limit bulk operations
    )
    operation = serializers.ChoiceField(choices=OPERATION_CHOICES)

    # Optional parameters based on operation
    tag_names = serializers.ListField(
        child=serializers.CharField(max_length=100), required=False, allow_empty=True
    )
    collection_id = serializers.UUIDField(required=False, allow_null=True)
    access_level = serializers.ChoiceField(
        choices=MediaFile.ACCESS_LEVEL_CHOICES, required=False
    )

    def validate(self, data):
        """Validate operation parameters."""
        operation = data.get("operation")

        if operation in ["add_tags", "remove_tags"] and not data.get("tag_names"):
            raise serializers.ValidationError("tag_names required for tag operations.")

        if operation in [
            "add_to_collection",
            "remove_from_collection",
        ] and not data.get("collection_id"):
            raise serializers.ValidationError(
                "collection_id required for collection operations."
            )

        if operation == "set_access_level" and not data.get("access_level"):
            raise serializers.ValidationError(
                "access_level required for access level operations."
            )

        return data


class PendingMediaFileListSerializer(serializers.ModelSerializer):
    """Serializer for pending media file list view."""

    uploaded_by_name = serializers.CharField(
        source="uploaded_by.username", read_only=True
    )
    namespace = serializers.CharField(source="namespace.slug", read_only=True)
    file_size_human = serializers.SerializerMethodField()

    class Meta:
        model = PendingMediaFile
        fields = [
            "id",
            "original_filename",
            "file_type",
            "file_size",
            "file_size_human",
            "width",
            "height",
            "status",
            "created_at",
            "expires_at",
            "uploaded_by_name",
            "namespace",
            "ai_suggested_title",
        ]

    def get_file_size_human(self, obj):
        """Return human-readable file size."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if obj.file_size < 1024.0:
                return f"{obj.file_size:.1f} {unit}"
            obj.file_size /= 1024.0
        return f"{obj.file_size:.1f} PB"


class PendingMediaFileDetailSerializer(serializers.ModelSerializer):
    """Serializer for pending media file detail view."""

    uploaded_by_name = serializers.CharField(
        source="uploaded_by.username", read_only=True
    )
    namespace = serializers.CharField(source="namespace.slug", read_only=True)
    file_size_human = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = PendingMediaFile
        fields = [
            "id",
            "original_filename",
            "file_path",
            "file_size",
            "file_size_human",
            "content_type",
            "file_hash",
            "file_type",
            "width",
            "height",
            "ai_generated_tags",
            "ai_suggested_title",
            "ai_extracted_text",
            "ai_confidence_score",
            "namespace",
            "folder_path",
            "status",
            "created_at",
            "expires_at",
            "uploaded_by",
            "uploaded_by_name",
            "thumbnail_url",
        ]

    def get_file_size_human(self, obj):
        """Return human-readable file size."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if obj.file_size < 1024.0:
                return f"{obj.file_size:.1f} {unit}"
            obj.file_size /= 1024.0
        return f"{obj.file_size:.1f} PB"

    def get_thumbnail_url(self, obj):
        """Get document thumbnail URL if available."""
        if obj.file_type == 'document' and obj.has_thumbnail():
            from .storage import S3MediaStorage
            storage = S3MediaStorage()
            return storage.get_public_url(obj.get_thumbnail_path())
        return None


class MediaFileApprovalSerializer(serializers.Serializer):
    """Serializer for approving a pending media file."""

    title = serializers.CharField(max_length=255)
    slug = serializers.SlugField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    tag_ids = serializers.ListField(
        child=serializers.CharField(), required=True, allow_empty=False
    )
    access_level = serializers.ChoiceField(
        choices=MediaFile.ACCESS_LEVEL_CHOICES, default="public"
    )
    collection_id = serializers.UUIDField(required=False, allow_null=True)
    collection_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True, allow_null=True
    )

    def validate_title(self, value):
        """Validate title is not empty."""
        if not value.strip():
            raise serializers.ValidationError("Title cannot be empty.")
        return value.strip()

    def validate_tag_ids(self, value):
        """Validate that at least one tag is provided and convert tag names to IDs."""
        if not value or len(value) == 0:
            raise serializers.ValidationError(
                "At least one tag is required to approve a file."
            )

        # Get namespace and user from context
        namespace = self.context.get("namespace")
        user = self.context.get("user")

        if not namespace or not user:
            raise serializers.ValidationError("Missing namespace or user context.")

        # Convert tag names/IDs to actual tag IDs
        tag_ids = convert_tag_names_to_ids(value, namespace, user)

        if not tag_ids:
            raise serializers.ValidationError("No valid tags provided.")

        return tag_ids


class BulkApprovalItemSerializer(serializers.Serializer):
    """Serializer for individual bulk approval item."""

    pending_file_id = serializers.UUIDField()
    title = serializers.CharField(max_length=255)
    slug = serializers.SlugField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    tag_ids = serializers.ListField(
        child=serializers.CharField(), required=True, allow_empty=False
    )
    access_level = serializers.ChoiceField(
        choices=MediaFile.ACCESS_LEVEL_CHOICES, default="public"
    )

    def validate_tag_ids(self, value):
        """Validate that at least one tag is provided and convert tag names to IDs."""
        if not value or len(value) == 0:
            raise serializers.ValidationError(
                "At least one tag is required to approve a file."
            )

        # Note: Tag conversion will be handled in the view for bulk operations
        # since each file might be in a different namespace
        return value


class BulkApprovalSerializer(serializers.Serializer):
    """Serializer for bulk approval of pending files."""

    approvals = serializers.ListField(
        child=BulkApprovalItemSerializer(),
        allow_empty=False,
        max_length=50,  # Limit bulk operations
    )
