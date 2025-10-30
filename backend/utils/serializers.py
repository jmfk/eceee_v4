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


class UserListSerializer(serializers.ModelSerializer):
    """Extended serializer for User model with staff/superuser status."""

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
        ]
        read_only_fields = fields


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change."""

    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, data):
        if data["new_password"] != data["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        if len(data["new_password"]) < 8:
            raise serializers.ValidationError(
                {"new_password": "Password must be at least 8 characters long."}
            )
        return data


class PasswordResetLinkSerializer(serializers.Serializer):
    """Serializer for password reset link generation response."""

    reset_url = serializers.URLField(read_only=True)
    user_id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    expires_in = serializers.CharField(read_only=True)


class CreateUserSerializer(serializers.ModelSerializer):
    """Serializer for creating new users."""

    password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "confirm_password",
            "is_staff",
            "is_superuser",
        ]

    def validate(self, data):
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        return data

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists.")
        return value

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UpdateUserSerializer(serializers.ModelSerializer):
    """Serializer for updating user permissions."""

    class Meta:
        model = User
        fields = [
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_superuser",
        ]

    def validate_email(self, value):
        # Check if email is being changed and if it already exists
        user = self.instance
        if value and value != user.email and User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email already exists.")
        return value
