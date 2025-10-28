"""
AI Tracking Admin Configuration
"""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone

from .models import AIModelPrice, AIUsageLog, AIBudgetAlert


@admin.register(AIModelPrice)
class AIModelPriceAdmin(admin.ModelAdmin):
    """Admin interface for AI model prices."""

    list_display = [
        "provider",
        "model_name",
        "input_price_display",
        "output_price_display",
        "effective_date",
        "days_since_verified",
        "is_stale",
        "auto_updated",
    ]
    list_filter = ["provider", "is_stale", "auto_updated", "effective_date"]
    search_fields = ["provider", "model_name", "notes"]
    readonly_fields = [
        "created_at",
        "updated_at",
        "last_verified",
        "days_since_verified",
    ]

    fieldsets = (
        ("Model Information", {"fields": ("provider", "model_name")}),
        ("Pricing", {"fields": ("input_price_per_1k", "output_price_per_1k")}),
        (
            "Tracking",
            {"fields": ("effective_date", "last_verified", "is_stale", "auto_updated")},
        ),
        (
            "Additional Information",
            {"fields": ("notes", "created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    def input_price_display(self, obj):
        """Display input price formatted."""
        return f"${obj.input_price_per_1k}/1k"

    input_price_display.short_description = "Input Price"

    def output_price_display(self, obj):
        """Display output price formatted."""
        return f"${obj.output_price_per_1k}/1k"

    output_price_display.short_description = "Output Price"

    def days_since_verified(self, obj):
        """Calculate days since last verification."""
        delta = timezone.now() - obj.last_verified
        days = delta.days

        if days > 30:
            return format_html('<span style="color: red;">{} days</span>', days)
        elif days > 14:
            return format_html('<span style="color: orange;">{} days</span>', days)
        return f"{days} days"

    days_since_verified.short_description = "Days Since Verified"

    actions = ["mark_as_stale", "mark_as_verified"]

    def mark_as_stale(self, request, queryset):
        """Mark selected prices as stale."""
        updated = queryset.update(is_stale=True)
        self.message_user(request, f"{updated} prices marked as stale.")

    mark_as_stale.short_description = "Mark as stale"

    def mark_as_verified(self, request, queryset):
        """Mark selected prices as verified."""
        updated = queryset.update(is_stale=False, last_verified=timezone.now())
        self.message_user(request, f"{updated} prices marked as verified.")

    mark_as_verified.short_description = "Mark as verified"


@admin.register(AIUsageLog)
class AIUsageLogAdmin(admin.ModelAdmin):
    """Admin interface for AI usage logs."""

    list_display = [
        "created_at",
        "provider",
        "model_name",
        "user",
        "task_description_short",
        "tokens_display",
        "cost_display",
        "duration_display",
        "was_successful",
    ]
    list_filter = [
        "provider",
        "model_name",
        "was_successful",
        "store_full_data",
        "created_at",
    ]
    search_fields = [
        "task_description",
        "user__username",
        "prompt",
        "response",
    ]
    readonly_fields = [
        "provider",
        "model_name",
        "user",
        "input_tokens",
        "output_tokens",
        "total_tokens",
        "total_cost",
        "cost_per_token",
        "task_description",
        "content_type",
        "object_id",
        "metadata",
        "prompt",
        "response",
        "store_full_data",
        "created_at",
        "duration_ms",
        "error_message",
        "was_successful",
    ]

    date_hierarchy = "created_at"

    fieldsets = (
        (
            "Basic Information",
            {
                "fields": (
                    "created_at",
                    "provider",
                    "model_name",
                    "user",
                    "was_successful",
                )
            },
        ),
        (
            "Task Context",
            {"fields": ("task_description", "content_type", "object_id", "metadata")},
        ),
        (
            "Usage & Cost",
            {
                "fields": (
                    "input_tokens",
                    "output_tokens",
                    "total_tokens",
                    "total_cost",
                    "cost_per_token",
                    "duration_ms",
                )
            },
        ),
        (
            "Prompt & Response",
            {
                "fields": ("store_full_data", "prompt", "response"),
                "classes": ("collapse",),
            },
        ),
        ("Error Information", {"fields": ("error_message",), "classes": ("collapse",)}),
    )

    def has_add_permission(self, request):
        """Logs are created automatically, not manually."""
        return False

    def has_change_permission(self, request, obj=None):
        """Logs should not be edited."""
        return False

    def task_description_short(self, obj):
        """Truncate task description."""
        if len(obj.task_description) > 50:
            return f"{obj.task_description[:50]}..."
        return obj.task_description

    task_description_short.short_description = "Task"

    def tokens_display(self, obj):
        """Display token counts."""
        return f"{obj.input_tokens:,} in / {obj.output_tokens:,} out"

    tokens_display.short_description = "Tokens"

    def cost_display(self, obj):
        """Display cost formatted."""
        return f"${obj.total_cost:.4f}"

    cost_display.short_description = "Cost"

    def duration_display(self, obj):
        """Display duration formatted."""
        if obj.duration_ms:
            if obj.duration_ms > 1000:
                return f"{obj.duration_ms / 1000:.2f}s"
            return f"{obj.duration_ms}ms"
        return "-"

    duration_display.short_description = "Duration"


@admin.register(AIBudgetAlert)
class AIBudgetAlertAdmin(admin.ModelAdmin):
    """Admin interface for budget alerts."""

    list_display = [
        "name",
        "budget_amount",
        "period",
        "current_spend_display",
        "spend_percentage_display",
        "is_active",
        "last_triggered",
    ]
    list_filter = ["period", "is_active", "provider"]
    search_fields = ["name", "provider", "model_name"]
    readonly_fields = [
        "last_triggered",
        "last_checked",
        "created_at",
        "updated_at",
        "current_spend_display",
        "spend_percentage_display",
    ]

    fieldsets = (
        (
            "Alert Configuration",
            {"fields": ("name", "budget_amount", "period", "threshold_percentage")},
        ),
        (
            "Filters (Optional)",
            {
                "fields": ("provider", "model_name", "user"),
                "description": "Leave blank to monitor all usage",
            },
        ),
        ("Notifications", {"fields": ("email_recipients", "is_active")}),
        (
            "Status",
            {
                "fields": (
                    "current_spend_display",
                    "spend_percentage_display",
                    "last_triggered",
                    "last_checked",
                    "created_at",
                    "updated_at",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    def current_spend_display(self, obj):
        """Display current spending."""
        # Handle case where object hasn't been saved yet
        if obj.budget_amount is None:
            return "-"

        spend = obj.get_current_spend()
        if spend > obj.budget_amount:
            return format_html('<span style="color: red;">${:.2f}</span>', spend)
        elif spend > (obj.budget_amount * obj.threshold_percentage / 100):
            return format_html('<span style="color: orange;">${:.2f}</span>', spend)
        return f"${spend:.2f}"

    current_spend_display.short_description = "Current Spend"

    def spend_percentage_display(self, obj):
        """Display spending percentage."""
        # Handle case where object hasn't been saved yet
        if obj.budget_amount is None:
            return "-"

        percentage = obj.get_spend_percentage()
        if percentage > 100:
            return format_html('<span style="color: red;">{:.1f}%</span>', percentage)
        elif percentage > obj.threshold_percentage:
            return format_html(
                '<span style="color: orange;">{:.1f}%</span>', percentage
            )
        return f"{percentage:.1f}%"

    spend_percentage_display.short_description = "Spend %"
