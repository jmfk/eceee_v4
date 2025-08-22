"""
Content Object Serializers for Object Publishing System

Provides REST API serialization for content objects that can be published as pages.
"""

from rest_framework import serializers
from .models import News, Event, LibraryItem, Member, Category, Tag, Namespace


class NamespaceSerializer(serializers.ModelSerializer):
    """Serializer for Namespace model"""

    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    content_count = serializers.SerializerMethodField()

    class Meta:
        model = Namespace
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "is_active",
            "is_default",
            "created_at",
            "updated_at",
            "created_by",
            "created_by_name",
            "content_count",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
        ]

    def get_content_count(self, obj):
        """Get total count of content objects in this namespace"""
        return obj.get_content_count()

    def validate_is_default(self, value):
        """Ensure only one default namespace can exist"""
        if value and Namespace.objects.filter(is_default=True).exists():
            # If this is an update, exclude the current instance
            if self.instance:
                if (
                    Namespace.objects.filter(is_default=True)
                    .exclude(pk=self.instance.pk)
                    .exists()
                ):
                    raise serializers.ValidationError(
                        "Only one default namespace can exist. Please unset the current default first."
                    )
            else:
                # This is a new instance
                raise serializers.ValidationError(
                    "Only one default namespace can exist. Please unset the current default first."
                )
        return value


class NamespaceListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Namespace lists"""

    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    content_count = serializers.SerializerMethodField()

    class Meta:
        model = Namespace
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "is_active",
            "is_default",
            "created_at",
            "created_by_name",
            "content_count",
        ]
        read_only_fields = ["id", "created_at", "created_by_name"]

    def get_content_count(self, obj):
        """Get total count of content objects in this namespace"""
        return obj.get_content_count()


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category model"""

    class Meta:
        model = Category
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "color",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class TagSerializer(serializers.ModelSerializer):
    """Serializer for Tag model"""

    namespace_name = serializers.CharField(source="namespace.name", read_only=True)

    class Meta:
        model = Tag
        fields = [
            "id",
            "name",
            "namespace",
            "namespace_name",
            "usage_count",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "usage_count",
            "created_at",
        ]

    def create(self, validated_data):
        """Create tag with default namespace if none provided"""
        if "namespace" not in validated_data or validated_data["namespace"] is None:
            validated_data["namespace"] = Namespace.get_default()
        return super().create(validated_data)


class NewsSerializer(serializers.ModelSerializer):
    """Serializer for News model"""

    category = CategorySerializer(read_only=True)
    category_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    last_modified_by_name = serializers.CharField(
        source="last_modified_by.username", read_only=True
    )

    class Meta:
        model = News
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "content",
            "excerpt",
            "is_published",
            "published_date",
            "featured",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "featured_image",
            "gallery_images",
            "author",
            "byline",
            "source",
            "source_url",
            "priority",
            "show_author",
            "show_publish_date",
            "allow_comments",
            "category",
            "category_id",
            "tags",
            "tag_ids",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "created_by_name",
            "last_modified_by_name",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
        ]

    def create(self, validated_data):
        tag_ids = validated_data.pop("tag_ids", [])
        instance = super().create(validated_data)

        if tag_ids:
            instance.tags.set(tag_ids)

        return instance

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)
        instance = super().update(instance, validated_data)

        if tag_ids is not None:
            instance.tags.set(tag_ids)

        return instance


class EventSerializer(serializers.ModelSerializer):
    """Serializer for Event model"""

    category = CategorySerializer(read_only=True)
    category_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    last_modified_by_name = serializers.CharField(
        source="last_modified_by.username", read_only=True
    )
    duration_hours = serializers.ReadOnlyField()
    is_upcoming = serializers.ReadOnlyField()
    is_past = serializers.ReadOnlyField()

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "content",
            "excerpt",
            "is_published",
            "published_date",
            "featured",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "featured_image",
            "gallery_images",
            "start_date",
            "end_date",
            "all_day",
            "timezone",
            "location_name",
            "location_address",
            "location_url",
            "virtual_meeting_url",
            "registration_required",
            "registration_url",
            "max_attendees",
            "current_attendees",
            "organizer_name",
            "organizer_email",
            "organizer_phone",
            "status",
            "show_location",
            "show_organizer",
            "category",
            "category_id",
            "tags",
            "tag_ids",
            "duration_hours",
            "is_upcoming",
            "is_past",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "created_by_name",
            "last_modified_by_name",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
        ]

    def create(self, validated_data):
        tag_ids = validated_data.pop("tag_ids", [])
        instance = super().create(validated_data)

        if tag_ids:
            instance.tags.set(tag_ids)

        return instance

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)
        instance = super().update(instance, validated_data)

        if tag_ids is not None:
            instance.tags.set(tag_ids)

        return instance


class LibraryItemSerializer(serializers.ModelSerializer):
    """Serializer for LibraryItem model"""

    category = CategorySerializer(read_only=True)
    category_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    last_modified_by_name = serializers.CharField(
        source="last_modified_by.username", read_only=True
    )

    class Meta:
        model = LibraryItem
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "content",
            "excerpt",
            "is_published",
            "published_date",
            "featured",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "featured_image",
            "gallery_images",
            "item_type",
            "file_url",
            "file_size",
            "file_format",
            "attachments",
            "access_level",
            "version",
            "isbn",
            "doi",
            "download_count",
            "view_count",
            "category",
            "category_id",
            "tags",
            "tag_ids",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "created_by_name",
            "last_modified_by_name",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "download_count",
            "view_count",
        ]

    def create(self, validated_data):
        tag_ids = validated_data.pop("tag_ids", [])
        instance = super().create(validated_data)

        if tag_ids:
            instance.tags.set(tag_ids)

        return instance

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)
        instance = super().update(instance, validated_data)

        if tag_ids is not None:
            instance.tags.set(tag_ids)

        return instance


class MemberSerializer(serializers.ModelSerializer):
    """Serializer for Member model"""

    category = CategorySerializer(read_only=True)
    category_id = serializers.IntegerField(
        write_only=True, required=False, allow_null=True
    )
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    created_by_name = serializers.CharField(
        source="created_by.username", read_only=True
    )
    last_modified_by_name = serializers.CharField(
        source="last_modified_by.username", read_only=True
    )
    full_name = serializers.ReadOnlyField(source="get_full_name")
    short_name = serializers.ReadOnlyField(source="get_short_name")

    class Meta:
        model = Member
        fields = [
            "id",
            "title",
            "slug",
            "description",
            "content",
            "excerpt",
            "is_published",
            "published_date",
            "featured",
            "meta_title",
            "meta_description",
            "meta_keywords",
            "featured_image",
            "gallery_images",
            "first_name",
            "last_name",
            "middle_name",
            "display_name",
            "job_title",
            "department",
            "organization",
            "email",
            "phone",
            "office_location",
            "biography",
            "expertise_areas",
            "qualifications",
            "website_url",
            "linkedin_url",
            "twitter_handle",
            "member_type",
            "start_date",
            "end_date",
            "is_current",
            "show_contact_info",
            "show_biography",
            "list_in_directory",
            "category",
            "category_id",
            "tags",
            "tag_ids",
            "full_name",
            "short_name",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
            "created_by_name",
            "last_modified_by_name",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "last_modified_by",
        ]

    def create(self, validated_data):
        tag_ids = validated_data.pop("tag_ids", [])
        instance = super().create(validated_data)

        if tag_ids:
            instance.tags.set(tag_ids)

        return instance

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)
        instance = super().update(instance, validated_data)

        if tag_ids is not None:
            instance.tags.set(tag_ids)

        return instance


# Summary serializers for lists and selection
class NewsListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for News lists"""

    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = News
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "is_published",
            "published_date",
            "featured",
            "priority",
            "author",
            "category_name",
        ]


class EventListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Event lists"""

    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "is_published",
            "published_date",
            "featured",
            "start_date",
            "end_date",
            "status",
            "location_name",
            "category_name",
        ]


class LibraryItemListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for LibraryItem lists"""

    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = LibraryItem
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "is_published",
            "published_date",
            "featured",
            "item_type",
            "file_format",
            "file_size",
            "access_level",
            "category_name",
        ]


class MemberListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Member lists"""

    category_name = serializers.CharField(source="category.name", read_only=True)
    full_name = serializers.ReadOnlyField(source="get_full_name")

    class Meta:
        model = Member
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "is_published",
            "published_date",
            "featured",
            "full_name",
            "job_title",
            "department",
            "member_type",
            "category_name",
        ]
