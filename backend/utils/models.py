"""
Models for utility features like value lists and configuration management.
"""

import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify
from django.core.exceptions import ValidationError
from django.utils import timezone
import re


class ValueList(models.Model):
    """
    Named lists of values that can be used to populate selection fields.
    Provides centralized management of dropdown options across the application.
    """

    VALUE_TYPE_CHOICES = [
        ("string", "String"),
        ("integer", "Integer"),
        ("decimal", "Decimal"),
    ]

    name = models.CharField(
        max_length=100,
        unique=True,
        help_text="Name for this value list (used as both identifier and display label)",
    )
    slug = models.SlugField(
        max_length=100, unique=True, help_text="Auto-generated slug from name"
    )
    description = models.TextField(
        blank=True, help_text="Optional description of what this value list represents"
    )
    value_type = models.CharField(
        max_length=10,
        choices=VALUE_TYPE_CHOICES,
        default="string",
        help_text="Type of values stored in this list",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this value list is active and available for use",
    )
    is_system = models.BooleanField(
        default=False, help_text="Whether this is a system-managed value list"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_value_lists",
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "Value List"
        verbose_name_plural = "Value Lists"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # Auto-generate slug from name if not provided
        if not self.slug:
            self.slug = slugify(self.name)

        # Ensure slug is unique
        if ValueList.objects.filter(slug=self.slug).exclude(pk=self.pk).exists():
            counter = 1
            original_slug = self.slug
            while ValueList.objects.filter(slug=self.slug).exclude(pk=self.pk).exists():
                self.slug = f"{original_slug}-{counter}"
                counter += 1

        super().save(*args, **kwargs)

    def clean(self):
        """Validate the value list"""
        if not self.name:
            raise ValidationError("Name is required")

        # Validate name format (alphanumeric and underscores only)
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9_]*$", self.name):
            raise ValidationError(
                "Name must start with a letter and contain only letters, numbers, and underscores"
            )

    @property
    def item_count(self):
        """Get the number of items in this value list"""
        return self.items.count()

    def get_items_dict(self):
        """Get items as a dictionary for API consumption"""
        return {
            item.slug: {
                "label": item.label,
                "value": item.get_typed_value(),
                "order": item.order,
                "is_active": item.is_active,
            }
            for item in self.items.filter(is_active=True).order_by("order", "label")
        }

    def get_items_list(self):
        """Get items as a list for form field consumption"""
        return [
            {
                "value": item.value or item.slug,
                "label": item.label,
                "slug": item.slug,
                "order": item.order,
            }
            for item in self.items.filter(is_active=True).order_by("order", "label")
        ]


class ValueListItem(models.Model):
    """
    Individual items within a value list.
    """

    value_list = models.ForeignKey(
        ValueList, on_delete=models.CASCADE, related_name="items"
    )
    label = models.CharField(max_length=200, help_text="Display label for this item")
    slug = models.SlugField(max_length=100, help_text="Auto-generated slug from label")
    value = models.CharField(
        max_length=500,
        blank=True,
        help_text="Optional custom value (defaults to slug if empty)",
    )
    description = models.TextField(
        blank=True, help_text="Optional description for this item"
    )
    order = models.PositiveIntegerField(
        default=0, help_text="Sort order within the value list"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this item is active and available for selection",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "label"]
        unique_together = [("value_list", "slug"), ("value_list", "label")]
        verbose_name = "Value List Item"
        verbose_name_plural = "Value List Items"

    def __str__(self):
        return f"{self.value_list.name}: {self.label}"

    def save(self, *args, **kwargs):
        # Auto-generate slug from label if not provided
        if not self.slug:
            self.slug = slugify(self.label)

        # Ensure slug is unique within the value list
        if (
            ValueListItem.objects.filter(value_list=self.value_list, slug=self.slug)
            .exclude(pk=self.pk)
            .exists()
        ):
            counter = 1
            original_slug = self.slug
            while (
                ValueListItem.objects.filter(value_list=self.value_list, slug=self.slug)
                .exclude(pk=self.pk)
                .exists()
            ):
                self.slug = f"{original_slug}-{counter}"
                counter += 1

        super().save(*args, **kwargs)

    def clean(self):
        """Validate the value list item"""
        if not self.label:
            raise ValidationError("Label is required")

        # Validate value based on value list type
        if self.value and self.value_list:
            if self.value_list.value_type == "integer":
                try:
                    int(self.value)
                except ValueError:
                    raise ValidationError("Value must be an integer")
            elif self.value_list.value_type == "decimal":
                try:
                    float(self.value)
                except ValueError:
                    raise ValidationError("Value must be a decimal number")

    def get_typed_value(self):
        """Get the value converted to the appropriate type"""
        value = self.value or self.slug

        if self.value_list.value_type == "integer":
            try:
                return int(value)
            except ValueError:
                return value
        elif self.value_list.value_type == "decimal":
            try:
                return float(value)
            except ValueError:
                return value

        return value  # string type or fallback

    @property
    def effective_value(self):
        """Get the effective value (custom value or slug)"""
        return self.value or self.slug


# AI Agent Task Models


class AIAgentTask(models.Model):
    """
    Model for tracking AI agent tasks and their execution status.

    Supports various task types like content summarization, research,
    analysis, and custom AI workflows.
    """

    # Task types
    TASK_TYPE_CHOICES = [
        ("summary", "Content Summarization"),
        ("research", "Research & Analysis"),
        ("content_generation", "Content Generation"),
        ("data_analysis", "Data Analysis"),
        ("custom", "Custom Task"),
    ]

    # Task status
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    # Priority levels
    PRIORITY_CHOICES = [
        ("low", "Low"),
        ("normal", "Normal"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]

    # Core fields
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255, help_text="Human-readable task title")
    description = models.TextField(blank=True, help_text="Detailed task description")
    task_type = models.CharField(
        max_length=20, choices=TASK_TYPE_CHOICES, default="custom"
    )

    # Task configuration
    task_config = models.JSONField(
        default=dict, help_text="Configuration parameters for the AI agent task"
    )

    # Execution tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    priority = models.CharField(
        max_length=10, choices=PRIORITY_CHOICES, default="normal"
    )
    progress = models.PositiveIntegerField(
        default=0, help_text="Progress percentage (0-100)"
    )

    # Results and output
    result_data = models.JSONField(
        default=dict, blank=True, help_text="Task results and generated content"
    )
    error_message = models.TextField(
        blank=True, help_text="Error details if task failed"
    )

    # Metadata
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="ai_tasks",
        help_text="User who initiated the task",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Celery task tracking
    celery_task_id = models.CharField(
        max_length=255, blank=True, help_text="Celery task ID for monitoring"
    )

    # Execution details
    estimated_duration = models.DurationField(
        null=True, blank=True, help_text="Estimated task completion time"
    )
    actual_duration = models.DurationField(
        null=True, blank=True, help_text="Actual time taken to complete"
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["created_by", "status"]),
            models.Index(fields=["task_type", "status"]),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        # Auto-set timestamps based on status changes
        if self.status == "running" and not self.started_at:
            self.started_at = timezone.now()
        elif (
            self.status in ["completed", "failed", "cancelled"]
            and not self.completed_at
        ):
            self.completed_at = timezone.now()
            if self.started_at:
                self.actual_duration = self.completed_at - self.started_at

        super().save(*args, **kwargs)

    @property
    def is_active(self):
        """Check if task is currently active (pending or running)."""
        return self.status in ["pending", "running"]

    @property
    def is_finished(self):
        """Check if task has finished (completed, failed, or cancelled)."""
        return self.status in ["completed", "failed", "cancelled"]

    def get_progress_display(self):
        """Get human-readable progress display."""
        if self.status == "pending":
            return "Queued"
        elif self.status == "running":
            return f"{self.progress}%"
        elif self.status == "completed":
            return "Complete"
        elif self.status == "failed":
            return "Failed"
        elif self.status == "cancelled":
            return "Cancelled"
        return "Unknown"


class AIAgentTaskUpdate(models.Model):
    """
    Model for tracking real-time updates during AI agent task execution.

    This allows for detailed progress tracking and provides data for
    real-time frontend updates via WebSocket/SSE.
    """

    UPDATE_TYPE_CHOICES = [
        ("progress", "Progress Update"),
        ("status", "Status Change"),
        ("result", "Partial Result"),
        ("error", "Error/Warning"),
        ("info", "Information"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        AIAgentTask, on_delete=models.CASCADE, related_name="updates"
    )

    update_type = models.CharField(max_length=20, choices=UPDATE_TYPE_CHOICES)
    message = models.TextField(help_text="Human-readable update message")

    # Optional structured data
    data = models.JSONField(
        default=dict, blank=True, help_text="Structured data for the update"
    )

    # Progress tracking
    progress_percentage = models.PositiveIntegerField(
        null=True, blank=True, help_text="Progress at time of update (0-100)"
    )

    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]
        indexes = [
            models.Index(fields=["task", "timestamp"]),
            models.Index(fields=["update_type", "timestamp"]),
        ]

    def __str__(self):
        return (
            f"{self.task.title} - {self.get_update_type_display()}: {self.message[:50]}"
        )


class AIAgentTaskTemplate(models.Model):
    """
    Template for common AI agent tasks to simplify task creation.

    This allows users to quickly create tasks based on predefined
    configurations and parameters.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField()
    task_type = models.CharField(max_length=20, choices=AIAgentTask.TASK_TYPE_CHOICES)

    # Template configuration
    default_config = models.JSONField(
        default=dict,
        help_text="Default configuration for tasks created from this template",
    )

    # UI configuration
    config_schema = models.JSONField(
        default=dict, help_text="JSON schema for validating and generating UI forms"
    )

    # Metadata
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="ai_task_templates"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Usage tracking
    usage_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def increment_usage(self):
        """Increment usage counter when template is used."""
        self.usage_count += 1
        self.save(update_fields=["usage_count"])


class ClipboardEntry(models.Model):
    """
    Server-side clipboard storage for user cut/copy operations.
    
    Stores clipboard data on the server with UUIDs, enabling cross-window/instance
    clipboard operations without browser permission issues.
    """

    CLIPBOARD_TYPE_CHOICES = [
        ("widgets", "Widgets"),
        ("pages", "Pages"),
        ("content", "Content"),
        ("media", "Media"),
    ]

    OPERATION_CHOICES = [
        ("cut", "Cut"),
        ("copy", "Copy"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="clipboard_entries",
        help_text="User who owns this clipboard entry",
    )
    clipboard_type = models.CharField(
        max_length=20,
        choices=CLIPBOARD_TYPE_CHOICES,
        help_text="Type of clipboard content (widgets, pages, content, etc.)",
    )
    operation = models.CharField(
        max_length=10,
        choices=OPERATION_CHOICES,
        help_text="Operation type: cut or copy",
    )
    data = models.JSONField(
        default=dict,
        help_text="Clipboard content data (widgets, pages, etc.)",
    )
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Operation-specific metadata (pageId, widgetPaths, etc.)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Optional expiration time for automatic cleanup",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "clipboard_type"]),
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["clipboard_type", "created_at"]),
        ]
        verbose_name = "Clipboard Entry"
        verbose_name_plural = "Clipboard Entries"

    def __str__(self):
        return f"{self.user.username} - {self.clipboard_type} ({self.operation})"

    def is_expired(self):
        """Check if the clipboard entry has expired."""
        if self.expires_at:
            return timezone.now() > self.expires_at
        return False
