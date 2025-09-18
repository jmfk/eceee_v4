"""
Common serializers used across the project.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from typing import Any, Dict, List


class ValueListItemSerializer(serializers.Serializer):
    """Serializer for a single value in a list."""

    value = serializers.CharField()
    label = serializers.CharField(required=False)


class ValueListItemCreateSerializer(serializers.Serializer):
    """Serializer for creating a single value in a list."""

    value = serializers.CharField()
    label = serializers.CharField(required=False)


class ValueListCreateSerializer(serializers.Serializer):
    """Serializer for creating a list of values."""

    values = serializers.ListField(child=ValueListItemSerializer())


class ValueListUpdateSerializer(serializers.Serializer):
    """Serializer for updating a list of values."""

    values = serializers.ListField(child=ValueListItemSerializer())


class ValueListSerializer(serializers.Serializer):
    """Serializer for a list of values."""

    values = serializers.ListField(child=serializers.CharField())

    def to_representation(self, instance: List[Any]) -> Dict[str, List[Any]]:
        """Convert list to dictionary with 'values' key."""
        return {"values": instance}


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
