"""
Content Object Serializers for Object Publishing System

Provides REST API serialization for content objects that can be published as pages.
"""

from rest_framework import serializers
from .models import Category, Tag, Namespace


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
