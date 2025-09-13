"""
Serializers for utility models including Value Lists and AI Agent Tasks.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    ValueList,
    ValueListItem,
    AIAgentTask,
    AIAgentTaskUpdate,
    AIAgentTaskTemplate,
)


# Value List Serializers


class ValueListItemSerializer(serializers.ModelSerializer):
    """Serializer for value list items."""

    effective_value = serializers.CharField(read_only=True)
    typed_value = serializers.SerializerMethodField()

    class Meta:
        model = ValueListItem
        fields = [
            "id",
            "label",
            "slug",
            "value",
            "effective_value",
            "typed_value",
            "description",
            "order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]

    def get_typed_value(self, obj):
        """Get the typed value based on the value list type."""
        return obj.get_typed_value()


class ValueListSerializer(serializers.ModelSerializer):
    """Serializer for value lists."""

    items = ValueListItemSerializer(many=True, read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )
    items_dict = serializers.SerializerMethodField()
    items_list = serializers.SerializerMethodField()

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
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
            "item_count",
            "items",
            "items_dict",
            "items_list",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at", "item_count"]

    def get_items_dict(self, obj):
        """Get items as dictionary."""
        return obj.get_items_dict()

    def get_items_list(self, obj):
        """Get items as list."""
        return obj.get_items_list()


class ValueListCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating value lists."""

    class Meta:
        model = ValueList
        fields = ["name", "description", "value_type", "is_active"]

    def create(self, validated_data):
        """Create a new value list."""
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class ValueListUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating value lists."""

    class Meta:
        model = ValueList
        fields = ["name", "description", "value_type", "is_active"]


class ValueListItemCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating value list items."""

    class Meta:
        model = ValueListItem
        fields = ["label", "value", "description", "order", "is_active"]

    def create(self, validated_data):
        """Create a new value list item."""
        value_list = self.context["value_list"]
        validated_data["value_list"] = value_list
        return super().create(validated_data)


# AI Agent Task Serializers


class AIAgentTaskUpdateSerializer(serializers.ModelSerializer):
    """Serializer for task updates."""

    class Meta:
        model = AIAgentTaskUpdate
        fields = [
            "id",
            "update_type",
            "message",
            "data",
            "progress_percentage",
            "timestamp",
        ]
        read_only_fields = ["id", "timestamp"]


class AIAgentTaskSerializer(serializers.ModelSerializer):
    """Serializer for AI agent tasks."""

    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )
    progress_display = serializers.CharField(
        source="get_progress_display", read_only=True
    )
    is_active = serializers.BooleanField(read_only=True)
    is_finished = serializers.BooleanField(read_only=True)
    updates = AIAgentTaskUpdateSerializer(many=True, read_only=True)

    class Meta:
        model = AIAgentTask
        fields = [
            "id",
            "title",
            "description",
            "task_type",
            "task_config",
            "status",
            "priority",
            "progress",
            "progress_display",
            "result_data",
            "error_message",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
            "started_at",
            "completed_at",
            "celery_task_id",
            "estimated_duration",
            "actual_duration",
            "is_active",
            "is_finished",
            "updates",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
            "started_at",
            "completed_at",
            "celery_task_id",
            "actual_duration",
            "is_active",
            "is_finished",
            "progress_display",
            "updates",
        ]

    def create(self, validated_data):
        """Create a new AI agent task."""
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)

    def validate_task_config(self, value):
        """Validate task configuration based on task type."""
        task_type = self.initial_data.get("task_type", "custom")

        if task_type == "summary":
            required_fields = []
            if not value.get("content") and not value.get("urls"):
                raise serializers.ValidationError(
                    "Summary tasks require either 'content' or 'urls' in task_config"
                )
        elif task_type == "research":
            if not value.get("topic") and not value.get("urls"):
                raise serializers.ValidationError(
                    "Research tasks require either 'topic' or 'urls' in task_config"
                )
        elif task_type == "content_generation":
            if not value.get("topic"):
                raise serializers.ValidationError(
                    "Content generation tasks require 'topic' in task_config"
                )
        elif task_type == "data_analysis":
            if not value.get("data"):
                raise serializers.ValidationError(
                    "Data analysis tasks require 'data' in task_config"
                )

        return value


class AIAgentTaskCreateSerializer(serializers.ModelSerializer):
    """Simplified serializer for creating AI agent tasks."""

    class Meta:
        model = AIAgentTask
        fields = ["title", "description", "task_type", "task_config", "priority"]

    def create(self, validated_data):
        """Create a new AI agent task and start execution."""
        validated_data["created_by"] = self.context["request"].user
        task = super().create(validated_data)

        # Start the Celery task
        from .tasks import execute_ai_agent_task

        celery_task = execute_ai_agent_task.delay(str(task.id))

        # Update task with Celery task ID
        task.celery_task_id = celery_task.id
        task.save(update_fields=["celery_task_id"])

        return task


class AIAgentTaskTemplateSerializer(serializers.ModelSerializer):
    """Serializer for AI agent task templates."""

    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )

    class Meta:
        model = AIAgentTaskTemplate
        fields = [
            "id",
            "name",
            "description",
            "task_type",
            "default_config",
            "config_schema",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
            "usage_count",
            "is_active",
        ]
        read_only_fields = [
            "id",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
            "usage_count",
        ]

    def create(self, validated_data):
        """Create a new task template."""
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class AIAgentTaskFromTemplateSerializer(serializers.Serializer):
    """Serializer for creating tasks from templates."""

    template_id = serializers.UUIDField()
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True)
    task_config = serializers.JSONField()
    priority = serializers.ChoiceField(
        choices=AIAgentTask.PRIORITY_CHOICES, default="normal"
    )

    def validate_template_id(self, value):
        """Validate that template exists and is active."""
        try:
            template = AIAgentTaskTemplate.objects.get(id=value, is_active=True)
            self.template = template
            return value
        except AIAgentTaskTemplate.DoesNotExist:
            raise serializers.ValidationError("Template not found or inactive")

    def create(self, validated_data):
        """Create task from template."""
        template = self.template

        # Merge template config with provided config
        merged_config = template.default_config.copy()
        merged_config.update(validated_data["task_config"])

        # Create task
        task = AIAgentTask.objects.create(
            title=validated_data["title"],
            description=validated_data.get("description", template.description),
            task_type=template.task_type,
            task_config=merged_config,
            priority=validated_data["priority"],
            created_by=self.context["request"].user,
        )

        # Increment template usage
        template.increment_usage()

        # Start the Celery task
        from .tasks import execute_ai_agent_task

        celery_task = execute_ai_agent_task.delay(str(task.id))

        # Update task with Celery task ID
        task.celery_task_id = celery_task.id
        task.save(update_fields=["celery_task_id"])

        return task


class TaskStatusUpdateSerializer(serializers.Serializer):
    """Serializer for updating task status."""

    status = serializers.ChoiceField(choices=AIAgentTask.STATUS_CHOICES)

    def validate_status(self, value):
        """Validate status transition."""
        task = self.context.get("task")
        if not task:
            return value

        current_status = task.status

        # Define allowed transitions
        allowed_transitions = {
            "pending": ["running", "cancelled"],
            "running": ["completed", "failed", "cancelled"],
            "completed": [],  # Completed tasks can't be changed
            "failed": ["pending"],  # Failed tasks can be retried
            "cancelled": ["pending"],  # Cancelled tasks can be restarted
        }

        if value not in allowed_transitions.get(current_status, []):
            raise serializers.ValidationError(
                f"Cannot change status from {current_status} to {value}"
            )

        return value


class TaskConfigValidationSerializer(serializers.Serializer):
    """Serializer for validating task configurations."""

    task_type = serializers.ChoiceField(choices=AIAgentTask.TASK_TYPE_CHOICES)
    task_config = serializers.JSONField()

    def validate(self, data):
        """Validate the complete configuration."""
        task_type = data["task_type"]
        config = data["task_config"]

        # Use the main serializer's validation logic
        serializer = AIAgentTaskSerializer()
        serializer.initial_data = {"task_type": task_type}

        try:
            serializer.validate_task_config(config)
        except serializers.ValidationError as e:
            raise serializers.ValidationError({"task_config": e.detail})

        return data
