"""
Common serializers used across the project.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from typing import Any, Dict, List
from .models import ValueList, ValueListItem


class ValueListItemSerializer(serializers.ModelSerializer):
    """Serializer for ValueListItem model."""

    created_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)
    updated_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)

    class Meta:
        model = ValueListItem
        fields = [
            "id",
            "label",
            "slug",
            "value",
            "description",
            "order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["slug", "created_at", "updated_at"]


class ValueListItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a ValueListItem."""

    class Meta:
        model = ValueListItem
        fields = ["label", "value", "description", "order", "is_active"]


class ValueListSerializer(serializers.ModelSerializer):
    """Serializer for ValueList model."""

    item_count = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    created_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)
    updated_at = serializers.DateTimeField(format="%Y-%m-%dT%H:%M:%SZ", read_only=True)

    class Meta:
        model = ValueList
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "value_type",
            "is_active",
            "is_system",
            "created_at",
            "updated_at",
            "created_by",
            "item_count",
            "items",
        ]
        read_only_fields = [
            "slug",
            "created_at",
            "updated_at",
            "created_by",
            "item_count",
        ]

    def get_item_count(self, obj):
        return obj.item_count

    def get_items(self, obj):
        items = obj.items.filter(is_active=True).order_by("order", "label")
        return ValueListItemSerializer(items, many=True).data


class ValueListCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a ValueList."""

    items = ValueListItemCreateSerializer(many=True, required=False)

    class Meta:
        model = ValueList
        fields = [
            "name",
            "description",
            "value_type",
            "is_active",
            "is_system",
            "items",
        ]

    def create(self, validated_data):
        items_data = validated_data.pop("items", [])
        value_list = ValueList.objects.create(**validated_data)

        for item_data in items_data:
            ValueListItem.objects.create(value_list=value_list, **item_data)

        return value_list


class ValueListUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating a ValueList."""

    class Meta:
        model = ValueList
        fields = ["name", "description", "value_type", "is_active", "is_system"]


class AIAgentTaskSerializer(serializers.Serializer):
    """Serializer for AI agent tasks."""

    task_id = serializers.UUIDField()
    status = serializers.CharField()
    result = serializers.JSONField(required=False)
    error = serializers.CharField(required=False)
    created_at = serializers.DateTimeField()
    completed_at = serializers.DateTimeField(required=False)


class AIAgentTaskCreateSerializer(serializers.Serializer):
    """Serializer for creating AI agent tasks."""

    task_type = serializers.CharField()
    input_data = serializers.JSONField()


class AIAgentTaskTemplateSerializer(serializers.Serializer):
    """Serializer for AI agent task templates."""

    name = serializers.CharField()
    description = serializers.CharField()
    task_type = serializers.CharField()
    input_schema = serializers.JSONField()
    output_schema = serializers.JSONField()


class AIAgentTaskFromTemplateSerializer(serializers.Serializer):
    """Serializer for creating AI agent tasks from templates."""

    template_name = serializers.CharField()
    input_data = serializers.JSONField()


class TaskStatusUpdateSerializer(serializers.Serializer):
    """Serializer for updating task status."""

    status = serializers.CharField()
    result = serializers.JSONField(required=False)
    error = serializers.CharField(required=False)


class TaskConfigValidationSerializer(serializers.Serializer):
    """Serializer for validating task configuration."""

    task_type = serializers.CharField()
    config = serializers.JSONField()


class UserSerializer(serializers.ModelSerializer):
    """Simple serializer for User model."""

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]
        read_only_fields = fields
