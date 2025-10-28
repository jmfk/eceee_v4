"""
AI Tracking Admin Configuration
"""

from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone

from .models import AIModelPrice, AIUsageLog, AIBudgetAlert, AIPromptConfig


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
        "error_code_display",
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
        "error_code",
        "error_traceback",
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
        (
            "Error Information",
            {"fields": ("error_message", "error_code", "error_traceback")},
        ),
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

    def error_code_display(self, obj):
        """Display error code if failed."""
        if not obj.was_successful and obj.error_code:
            return format_html('<span style="color: red;">{}</span>', obj.error_code)
        return "-"

    error_code_display.short_description = "Error Type"


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


@admin.register(AIPromptConfig)
class AIPromptConfigAdmin(admin.ModelAdmin):
    """Admin interface for AI prompt configurations."""

    list_display = [
        "prompt_type",
        "track_full_data",
        "is_active",
        "total_calls",
        "total_failed_calls",
        "failure_rate_display",
        "consecutive_failures_display",
        "total_cost_display",
        "last_called_at",
        "avg_cost_display",
    ]
    list_filter = ["track_full_data", "is_active", "created_at"]
    search_fields = ["prompt_type", "description"]
    readonly_fields = [
        "total_calls",
        "total_cost",
        "last_called_at",
        "last_duration_ms",
        "last_input_tokens",
        "last_output_tokens",
        "last_total_tokens",
        "created_at",
        "updated_at",
        "avg_cost_display",
        "total_failed_calls",
        "consecutive_failures",
        "last_failed_at",
        "failure_rate",
    ]

    fieldsets = (
        (
            "Configuration",
            {
                "fields": (
                    "prompt_type",
                    "description",
                    "track_full_data",
                    "is_active",
                )
            },
        ),
        (
            "Latest Call Data",
            {
                "fields": (
                    "last_called_at",
                    "last_user",
                    "last_input_tokens",
                    "last_output_tokens",
                    "last_total_tokens",
                    "last_cost",
                    "last_duration_ms",
                    "last_metadata",
                    "last_prompt",
                    "last_response",
                ),
                "classes": ("collapse",),
            },
        ),
        (
            "Statistics",
            {
                "fields": (
                    "total_calls",
                    "total_cost",
                    "avg_cost_display",
                    "created_at",
                    "updated_at",
                )
            },
        ),
        (
            "Failure Tracking",
            {
                "fields": (
                    "total_failed_calls",
                    "failure_rate",
                    "consecutive_failures",
                    "last_failed_at",
                    "last_error_code",
                    "last_error_message",
                    "last_error_traceback",
                ),
                "classes": ("collapse",),
            },
        ),
    )

    def total_cost_display(self, obj):
        """Display total cost formatted."""
        return f"${obj.total_cost:.4f}"

    total_cost_display.short_description = "Total Cost"

    def avg_cost_display(self, obj):
        """Display average cost per call."""
        if obj.total_calls > 0:
            return f"${obj.avg_cost_per_call:.4f}"
        return "$0"

    avg_cost_display.short_description = "Avg Cost/Call"

    def last_total_tokens(self, obj):
        """Display total tokens from last call."""
        return obj.last_total_tokens

    last_total_tokens.short_description = "Last Total Tokens"

    def failure_rate_display(self, obj):
        """Display failure rate with color coding."""
        rate = obj.failure_rate
        if rate > 50:
            return format_html(
                '<span style="color: red; font-weight: bold;">{:.1f}%</span>', rate
            )
        elif rate > 20:
            return format_html('<span style="color: orange;">{:.1f}%</span>', rate)
        elif rate > 0:
            return f"{rate:.1f}%"
        return "0%"

    failure_rate_display.short_description = "Failure Rate"

    def consecutive_failures_display(self, obj):
        """Display consecutive failures with alert."""
        if obj.consecutive_failures >= 3:
            return format_html(
                '<span style="color: red; font-weight: bold;">⚠️ {}</span>',
                obj.consecutive_failures,
            )
        elif obj.consecutive_failures > 0:
            return format_html(
                '<span style="color: orange;">{}</span>', obj.consecutive_failures
            )
        return "0"

    consecutive_failures_display.short_description = "Consecutive Fails"
