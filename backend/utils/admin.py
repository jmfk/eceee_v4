"""
Django admin configuration for utility models.
"""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from .models import (
    ValueList,
    ValueListItem,
    AIAgentTask,
    AIAgentTaskUpdate,
    AIAgentTaskTemplate,
    ClipboardEntry,
)


class ValueListItemInline(admin.TabularInline):
    """Inline admin for value list items"""

    model = ValueListItem
    extra = 0
    fields = ["label", "slug", "value", "order", "is_active"]
    readonly_fields = ["slug"]
    ordering = ["order", "label"]


@admin.register(ValueList)
class ValueListAdmin(admin.ModelAdmin):
    """Admin interface for Value Lists"""

    list_display = [
        "name",
        "value_type",
        "item_count_display",
        "is_active",
        "is_system",
        "created_by",
        "created_at",
    ]
    list_filter = ["value_type", "is_active", "is_system", "created_at"]
    search_fields = ["name", "description"]
    readonly_fields = ["slug", "created_at", "updated_at", "item_count"]
    inlines = [ValueListItemInline]

    fieldsets = (
        (
            "Basic Information",
            {"fields": ("name", "slug", "description", "is_active")},
        ),
        ("Configuration", {"fields": ("value_type", "is_system")}),
        ("Statistics", {"fields": ("item_count",), "classes": ("collapse",)}),
        (
            "Metadata",
            {
                "fields": ("created_at", "updated_at", "created_by"),
                "classes": ("collapse",),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        """Set created_by when creating new value lists"""
        if not change:  # Creating new object
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def item_count_display(self, obj):
        """Display count of items in the value list"""
        count = obj.item_count
        if count == 0:
            return format_html('<span style="color: #999;">0 items</span>')
        return format_html(
            "<strong>{} item{}</strong>", count, "s" if count != 1 else ""
        )

    item_count_display.short_description = "Items"

    def get_queryset(self, request):
        """Optimize queryset with related data"""
        return super().get_queryset(request).select_related("created_by")


@admin.register(ValueListItem)
class ValueListItemAdmin(admin.ModelAdmin):
    """Admin interface for Value List Items"""

    list_display = [
        "label",
        "value_list",
        "effective_value_display",
        "value_type_display",
        "order",
        "is_active",
    ]
    list_filter = ["value_list", "is_active", "value_list__value_type"]
    search_fields = ["label", "value", "description", "value_list__name"]
    readonly_fields = ["slug"]
    list_editable = ["order", "is_active"]

    fieldsets = (
        (
            "Basic Information",
            {"fields": ("value_list", "label", "slug", "value", "description")},
        ),
        ("Configuration", {"fields": ("order", "is_active")}),
        (
            "Metadata",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    def effective_value_display(self, obj):
        """Display the effective value"""
        effective = obj.effective_value
        if obj.value and obj.value != obj.slug:
            return format_html("<code>{}</code> <small>(custom)</small>", effective)
        return format_html("<code>{}</code>", effective)

    effective_value_display.short_description = "Effective Value"

    def value_type_display(self, obj):
        """Display the value type from the parent list"""
        return obj.value_list.get_value_type_display()

    value_type_display.short_description = "Type"

    def get_queryset(self, request):
        """Optimize queryset with related data"""
        return super().get_queryset(request).select_related("value_list")


class AIAgentTaskUpdateInline(admin.TabularInline):
    """Inline admin for AI agent task updates."""

    model = AIAgentTaskUpdate
    extra = 0
    fields = ["update_type", "message", "progress_percentage", "timestamp"]
    readonly_fields = ["timestamp"]
    ordering = ["-timestamp"]

    def has_add_permission(self, request, obj=None):
        """Prevent manual addition of updates."""
        return False


@admin.register(AIAgentTask)
class AIAgentTaskAdmin(admin.ModelAdmin):
    """Admin interface for AI Agent Tasks."""

    list_display = [
        "title",
        "task_type",
        "status",
        "progress_display",
        "created_by",
        "created_at",
        "duration_display",
    ]
    list_filter = [
        "task_type",
        "status",
        "priority",
        "created_at",
        "started_at",
        "completed_at",
    ]
    search_fields = ["title", "description", "created_by__username"]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
        "started_at",
        "completed_at",
        "actual_duration",
        "celery_task_id",
        "is_active",
        "is_finished",
    ]

    fieldsets = (
        ("Task Information", {"fields": ("id", "title", "description", "task_type")}),
        ("Configuration", {"fields": ("task_config", "priority")}),
        (
            "Execution Status",
            {"fields": ("status", "progress", "celery_task_id", "error_message")},
        ),
        ("Results", {"fields": ("result_data",), "classes": ("collapse",)}),
        (
            "Timing",
            {
                "fields": (
                    "estimated_duration",
                    "actual_duration",
                    "created_at",
                    "updated_at",
                    "started_at",
                    "completed_at",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Metadata",
            {
                "fields": ("created_by", "is_active", "is_finished"),
                "classes": ("collapse",),
            },
        ),
    )

    inlines = [AIAgentTaskUpdateInline]

    def progress_display(self, obj):
        """Display progress with visual indicator."""
        if obj.status == "pending":
            return format_html('<span style="color: #666;">Queued</span>')
        elif obj.status == "running":
            return format_html(
                '<div style="background: #f0f0f0; border-radius: 3px; width: 100px; height: 20px;">'
                '<div style="background: #007cba; height: 100%; width: {}%; border-radius: 3px;"></div>'
                "</div> {}%",
                obj.progress,
                obj.progress,
            )
        elif obj.status == "completed":
            return format_html('<span style="color: #28a745;">✓ Complete</span>')
        elif obj.status == "failed":
            return format_html('<span style="color: #dc3545;">✗ Failed</span>')
        elif obj.status == "cancelled":
            return format_html('<span style="color: #6c757d;">Cancelled</span>')
        return obj.get_progress_display()

    progress_display.short_description = "Progress"

    def duration_display(self, obj):
        """Display task duration."""
        if obj.actual_duration:
            total_seconds = obj.actual_duration.total_seconds()
            if total_seconds < 60:
                return f"{total_seconds:.1f}s"
            elif total_seconds < 3600:
                return f"{total_seconds/60:.1f}m"
            else:
                return f"{total_seconds/3600:.1f}h"
        elif obj.started_at and obj.status == "running":
            from django.utils import timezone

            duration = timezone.now() - obj.started_at
            total_seconds = duration.total_seconds()
            if total_seconds < 60:
                return f"{total_seconds:.1f}s (running)"
            elif total_seconds < 3600:
                return f"{total_seconds/60:.1f}m (running)"
            else:
                return f"{total_seconds/3600:.1f}h (running)"
        return "-"

    duration_display.short_description = "Duration"

    def get_queryset(self, request):
        """Optimize queryset."""
        return super().get_queryset(request).select_related("created_by")

    actions = ["cancel_selected_tasks", "retry_selected_tasks"]

    def cancel_selected_tasks(self, request, queryset):
        """Cancel selected tasks."""
        active_tasks = queryset.filter(status__in=["pending", "running"])

        for task in active_tasks:
            if task.celery_task_id:
                from celery import current_app

                current_app.control.revoke(task.celery_task_id, terminate=True)

            task.status = "cancelled"
            task.save()

        count = active_tasks.count()
        self.message_user(request, f"Successfully cancelled {count} tasks.")

    cancel_selected_tasks.short_description = "Cancel selected tasks"

    def retry_selected_tasks(self, request, queryset):
        """Retry selected failed/cancelled tasks."""
        failed_tasks = queryset.filter(status__in=["failed", "cancelled"])

        for task in failed_tasks:
            # Reset task status
            task.status = "pending"
            task.progress = 0
            task.error_message = ""
            task.result_data = {}
            task.started_at = None
            task.completed_at = None
            task.actual_duration = None
            task.save()

            # Start new Celery task
            from .tasks import execute_ai_agent_task

            celery_task = execute_ai_agent_task.delay(str(task.id))
            task.celery_task_id = celery_task.id
            task.save(update_fields=["celery_task_id"])

        count = failed_tasks.count()
        self.message_user(request, f"Successfully retried {count} tasks.")

    retry_selected_tasks.short_description = "Retry selected tasks"


@admin.register(AIAgentTaskTemplate)
class AIAgentTaskTemplateAdmin(admin.ModelAdmin):
    """Admin interface for AI Agent Task Templates."""

    list_display = [
        "name",
        "task_type",
        "usage_count",
        "is_active",
        "created_by",
        "created_at",
    ]
    list_filter = ["task_type", "is_active", "created_at"]
    search_fields = ["name", "description", "created_by__username"]
    readonly_fields = ["id", "usage_count", "created_at", "updated_at"]

    fieldsets = (
        (
            "Template Information",
            {"fields": ("id", "name", "description", "task_type")},
        ),
        ("Configuration", {"fields": ("default_config", "config_schema", "is_active")}),
        ("Usage Statistics", {"fields": ("usage_count",), "classes": ("collapse",)}),
        (
            "Metadata",
            {
                "fields": ("created_by", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    def save_model(self, request, obj, form, change):
        """Set created_by when creating new templates."""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def get_queryset(self, request):
        """Optimize queryset."""
        return super().get_queryset(request).select_related("created_by")


@admin.register(AIAgentTaskUpdate)
class AIAgentTaskUpdateAdmin(admin.ModelAdmin):
    """Admin interface for AI Agent Task Updates."""

    list_display = [
        "task_title",
        "update_type",
        "message_preview",
        "progress_percentage",
        "timestamp",
    ]
    list_filter = ["update_type", "timestamp", "task__task_type"]
    search_fields = ["message", "task__title", "task__created_by__username"]
    readonly_fields = ["id", "timestamp"]

    fieldsets = (
        ("Update Information", {"fields": ("id", "task", "update_type", "message")}),
        ("Data", {"fields": ("data", "progress_percentage"), "classes": ("collapse",)}),
        ("Metadata", {"fields": ("timestamp",), "classes": ("collapse",)}),
    )

    def task_title(self, obj):
        """Display the related task title."""
        return obj.task.title

    task_title.short_description = "Task"

    def message_preview(self, obj):
        """Display a preview of the message."""
        if len(obj.message) > 50:
            return f"{obj.message[:50]}..."
        return obj.message

    message_preview.short_description = "Message"

    def get_queryset(self, request):
        """Optimize queryset."""
        return super().get_queryset(request).select_related("task")

    def has_add_permission(self, request):
        """Prevent manual addition of updates."""
        return False


@admin.register(ClipboardEntry)
class ClipboardEntryAdmin(admin.ModelAdmin):
    """Admin interface for Clipboard Entries."""

    list_display = [
        "id",
        "user",
        "clipboard_type",
        "operation",
        "created_at",
        "expires_at",
    ]
    list_filter = ["clipboard_type", "operation", "created_at", "user"]
    search_fields = ["user__username", "clipboard_type"]
    readonly_fields = ["id", "created_at"]
    
    fieldsets = (
        ("Clipboard Information", {
            "fields": ("id", "user", "clipboard_type", "operation")
        }),
        ("Data", {
            "fields": ("data", "metadata"),
            "classes": ("collapse",)
        }),
        ("Metadata", {
            "fields": ("created_at", "expires_at"),
            "classes": ("collapse",)
        }),
    )

    def get_queryset(self, request):
        """Optimize queryset."""
        return super().get_queryset(request).select_related("user")
