"""
DRF serializers for file manager API endpoints.

Provides serialization for media files, tags, collections, and related models
following the existing API patterns and camelCase conversion.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from django.conf import settings
from content.models import Namespace
from .models import MediaFile, MediaTag, MediaCollection, MediaThumbnail, MediaUsage


class MediaTagSerializer(serializers.ModelSerializer):
    """Serializer for media tags."""

    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    namespace_name = serializers.CharField(source="namespace.name", read_only=True)

    class Meta:
        model = MediaTag
        fields = [
            "id",
            "name",
            "slug",
            "color",
            "description",
            "namespace",
            "namespace_name",
            "created_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "created_by",
            "created_by_name",
            "namespace_name",
        ]

    def create(self, validated_data):
        """Set created_by from request user."""
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class MediaThumbnailSerializer(serializers.ModelSerializer):
    """Serializer for media thumbnails."""

    url = serializers.SerializerMethodField()

    class Meta:
        model = MediaThumbnail
        fields = [
            "id",
            "size",
            "file_path",
            "width",
            "height",
            "file_size",
            "url",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_url(self, obj):
        """Get thumbnail URL."""
        # This will be implemented with the storage service
        return f"/api/media/thumbnails/{obj.id}/"


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
    namespace_name = serializers.CharField(source="namespace.name", read_only=True)
    file_count = serializers.SerializerMethodField()

    class Meta:
        model = MediaCollection
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "namespace",
            "namespace_name",
            "access_level",
            "tags",
            "tag_ids",
            "file_count",
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
            "namespace_name",
            "file_count",
        ]

    def get_file_count(self, obj):
        """Get number of files in collection."""
        return obj.mediafile_set.count()

    def create(self, validated_data):
        """Create collection with tags."""
        tag_ids = validated_data.pop("tag_ids", [])
        validated_data["created_by"] = self.context["request"].user
        validated_data["last_modified_by"] = self.context["request"].user

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
    namespace_name = serializers.CharField(source="namespace.name", read_only=True)
    file_size_human = serializers.CharField(read_only=True)
    dimensions = serializers.CharField(read_only=True)
    thumbnail_url = serializers.SerializerMethodField()
    # SEO-friendly URLs
    absolute_url = serializers.SerializerMethodField()
    uuid_url = serializers.SerializerMethodField()
    download_url = serializers.SerializerMethodField()

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
            "namespace_name",
            "tags",
            "thumbnail_url",
            "absolute_url",
            "uuid_url",
            "download_url",
            "created_at",
            "created_by",
            "created_by_name",
        ]

    def get_thumbnail_url(self, obj):
        """Get thumbnail URL for images."""
        if obj.is_image:
            return obj.get_thumbnail_url("medium")
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


class MediaFileDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for individual media files."""

    tags = MediaTagSerializer(many=True, read_only=True)
    collections = MediaCollectionSerializer(many=True, read_only=True)
    thumbnails = MediaThumbnailSerializer(many=True, read_only=True)
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
    namespace_name = serializers.CharField(source="namespace.name", read_only=True)
    file_size_human = serializers.CharField(read_only=True)
    dimensions = serializers.CharField(read_only=True)
    file_url = serializers.SerializerMethodField()

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
            "namespace_name",
            "access_level",
            "download_count",
            "last_accessed",
            "tags",
            "collections",
            "thumbnails",
            "usage_records",
            "tag_ids",
            "collection_ids",
            "file_url",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "last_modified_by",
            "last_modified_by_name",
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
            "namespace_name",
            "file_size_human",
            "dimensions",
            "file_url",
        ]

    def get_file_url(self, obj):
        """Get file URL."""
        # This will be implemented with the storage service
        return f"/api/media/files/{obj.id}/download/"

    def update(self, instance, validated_data):
        """Update media file with tags and collections."""
        tag_ids = validated_data.pop("tag_ids", None)
        collection_ids = validated_data.pop("collection_ids", None)
        validated_data["last_modified_by"] = self.context["request"].user

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


class MediaUploadSerializer(serializers.Serializer):
    """Serializer for file upload requests."""

    files = serializers.ListField(
        child=serializers.FileField(),
        allow_empty=False,
        max_length=10,  # Limit to 10 files per upload
    )
    folder_path = serializers.CharField(
        max_length=200, required=False, allow_blank=True
    )
    namespace = serializers.IntegerField(required=True)

    def validate_namespace(self, value):
        """Validate namespace exists and user has access."""
        try:
            namespace = Namespace.objects.get(id=value)
            # Add permission check here if needed
            return namespace
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
            ],
        )

        for file in files:
            # Check file size
            if file.size > max_file_size:
                raise serializers.ValidationError(
                    f"File {file.name} is too large. Maximum size is {max_file_size // (1024*1024)}MB."
                )

            # Check content type
            if file.content_type not in allowed_types:
                raise serializers.ValidationError(
                    f"File type {file.content_type} is not allowed for {file.name}."
                )

        return files


class MediaSearchSerializer(serializers.Serializer):
    """Serializer for media search requests."""

    q = serializers.CharField(required=False, allow_blank=True)
    file_type = serializers.ChoiceField(
        choices=MediaFile.FILE_TYPE_CHOICES, required=False, allow_blank=True
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
    namespace = serializers.IntegerField(required=False)

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
    tag_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )
    collection_id = serializers.UUIDField(required=False)
    access_level = serializers.ChoiceField(
        choices=MediaFile.ACCESS_LEVEL_CHOICES, required=False
    )

    def validate(self, data):
        """Validate operation parameters."""
        operation = data.get("operation")

        if operation in ["add_tags", "remove_tags"] and not data.get("tag_ids"):
            raise serializers.ValidationError("tag_ids required for tag operations.")

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
