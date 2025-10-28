"""
AI Tracking Models

This module defines the database models for tracking AI usage, costs, and pricing.
"""

from decimal import Decimal
from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

User = get_user_model()


class AIModelPrice(models.Model):
    """
    Tracks pricing information for AI models from different providers.

    Supports automatic price updates from provider APIs and manual entries.
    Flags stale prices that need verification.
    """

    PROVIDER_CHOICES = [
        ("openai", "OpenAI"),
        ("anthropic", "Anthropic"),
        ("google", "Google AI"),
        ("cohere", "Cohere"),
        ("other", "Other"),
    ]

    provider = models.CharField(max_length=50, choices=PROVIDER_CHOICES, db_index=True)
    model_name = models.CharField(max_length=100, db_index=True)

    # Pricing per 1000 tokens
    input_price_per_1k = models.DecimalField(
        max_digits=10, decimal_places=6, help_text="Price per 1000 input tokens in USD"
    )
    output_price_per_1k = models.DecimalField(
        max_digits=10, decimal_places=6, help_text="Price per 1000 output tokens in USD"
    )

    # Tracking and verification
    effective_date = models.DateTimeField(
        default=timezone.now, help_text="When this price became effective"
    )
    last_verified = models.DateTimeField(
        auto_now=True, help_text="Last time this price was verified"
    )
    is_stale = models.BooleanField(
        default=False, help_text="Whether this price needs to be updated"
    )
    auto_updated = models.BooleanField(
        default=False, help_text="Whether this price was automatically fetched from API"
    )

    # Additional information
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-effective_date"]
        unique_together = [["provider", "model_name", "effective_date"]]
        indexes = [
            models.Index(fields=["provider", "model_name"]),
            models.Index(fields=["is_stale"]),
        ]
        verbose_name = "AI Model Price"
        verbose_name_plural = "AI Model Prices"

    def __str__(self):
        return f"{self.provider}/{self.model_name} - ${self.input_price_per_1k}/1k in, ${self.output_price_per_1k}/1k out"

    def calculate_cost(self, input_tokens, output_tokens):
        """Calculate total cost for given token counts."""
        input_cost = (Decimal(input_tokens) / 1000) * self.input_price_per_1k
        output_cost = (Decimal(output_tokens) / 1000) * self.output_price_per_1k
        return input_cost + output_cost

    @classmethod
    def get_current_price(cls, provider, model_name):
        """Get the most recent price for a given provider and model."""
        return (
            cls.objects.filter(provider=provider, model_name=model_name)
            .order_by("-effective_date")
            .first()
        )


class AIUsageLog(models.Model):
    """
    Logs individual AI API calls with token usage, costs, and context.

    Optionally stores prompts and responses based on configuration.
    Links to related objects via GenericForeignKey for full traceability.
    """

    provider = models.CharField(max_length=50, db_index=True)
    model_name = models.CharField(max_length=100, db_index=True)
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="ai_usage_logs"
    )

    # Cost tracking
    input_tokens = models.IntegerField(help_text="Number of input tokens")
    output_tokens = models.IntegerField(help_text="Number of output tokens")
    total_cost = models.DecimalField(
        max_digits=10, decimal_places=6, help_text="Total cost in USD"
    )

    # Task context
    task_description = models.CharField(
        max_length=255, help_text="Brief description of what this AI call was for"
    )

    # Generic relation to any model
    content_type = models.ForeignKey(
        ContentType, on_delete=models.SET_NULL, null=True, blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")

    # Additional metadata as JSON
    metadata = models.JSONField(
        default=dict, blank=True, help_text="Additional context data (JSON)"
    )

    # Optional prompt/response storage
    prompt = models.TextField(blank=True)
    response = models.TextField(blank=True)
    store_full_data = models.BooleanField(
        default=False, help_text="Whether full prompt/response were stored"
    )

    # Performance tracking
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    duration_ms = models.IntegerField(
        null=True, blank=True, help_text="API call duration in milliseconds"
    )

    # Error tracking
    error_message = models.TextField(blank=True)
    was_successful = models.BooleanField(default=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["provider", "model_name"]),
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["was_successful"]),
        ]
        verbose_name = "AI Usage Log"
        verbose_name_plural = "AI Usage Logs"

    def __str__(self):
        user_str = self.user.username if self.user else "Unknown"
        return f"{self.provider}/{self.model_name} - {user_str} - ${self.total_cost} - {self.created_at}"

    @property
    def total_tokens(self):
        """Total tokens used (input + output)."""
        return self.input_tokens + self.output_tokens

    @property
    def cost_per_token(self):
        """Average cost per token."""
        total = self.total_tokens
        if total == 0:
            return Decimal("0")
        return self.total_cost / total


class AIPromptConfig(models.Model):
    """
    Configuration for controlling tracking behavior per prompt type.

    Each unique prompt type gets one config object that:
    - Controls whether to store full prompt/response in logs
    - Stores the latest call data for reference (regardless of tracking setting)
    - Auto-creates on first use
    """

    # Unique identifier for this prompt type
    prompt_type = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Stable identifier for this prompt type (e.g., 'extract_page_metadata')",
    )

    # Human-readable information
    description = models.TextField(
        blank=True, help_text="Description of what this prompt type does"
    )

    # Tracking controls
    track_full_data = models.BooleanField(
        default=False,
        help_text="Store full prompt/response text in AIUsageLog entries",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether to create AIUsageLog entries for this prompt type",
    )

    # Latest call data (always updated regardless of tracking settings)
    last_prompt = models.TextField(blank=True)
    last_response = models.TextField(blank=True)
    last_input_tokens = models.IntegerField(default=0)
    last_output_tokens = models.IntegerField(default=0)
    last_cost = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    last_user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    last_metadata = models.JSONField(default=dict, blank=True)
    last_called_at = models.DateTimeField(null=True, blank=True)
    last_duration_ms = models.IntegerField(null=True, blank=True)

    # Statistics
    total_calls = models.IntegerField(default=0, help_text="Total number of calls made")
    total_cost = models.DecimalField(
        max_digits=12,
        decimal_places=6,
        default=0,
        help_text="Cumulative cost of all calls",
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["prompt_type"]
        verbose_name = "AI Prompt Configuration"
        verbose_name_plural = "AI Prompt Configurations"

    def __str__(self):
        return f"{self.prompt_type} (track_full_data={self.track_full_data})"

    @property
    def avg_cost_per_call(self):
        """Average cost per call."""
        if self.total_calls == 0:
            return Decimal("0")
        return self.total_cost / self.total_calls

    @property
    def last_total_tokens(self):
        """Total tokens from last call."""
        return self.last_input_tokens + self.last_output_tokens


class AIBudgetAlert(models.Model):
    """
    Defines budget thresholds and alerts for AI usage.

    Monitors spending per period (daily/weekly/monthly) and sends
    email notifications when thresholds are exceeded.
    """

    PERIOD_CHOICES = [
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
    ]

    name = models.CharField(max_length=100, unique=True)
    budget_amount = models.DecimalField(
        max_digits=10, decimal_places=2, help_text="Budget threshold in USD"
    )
    period = models.CharField(
        max_length=20, choices=PERIOD_CHOICES, help_text="Budget period"
    )

    # Optional filters
    provider = models.CharField(
        max_length=50, blank=True, help_text="Optional: limit to specific provider"
    )
    model_name = models.CharField(
        max_length=100, blank=True, help_text="Optional: limit to specific model"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="Optional: limit to specific user",
    )

    # Notification settings
    email_recipients = models.JSONField(
        default=list, help_text="List of email addresses to notify"
    )
    threshold_percentage = models.IntegerField(
        default=80, help_text="Alert when spending reaches this percentage of budget"
    )

    # State tracking
    is_active = models.BooleanField(default=True)
    last_triggered = models.DateTimeField(null=True, blank=True)
    last_checked = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "AI Budget Alert"
        verbose_name_plural = "AI Budget Alerts"

    def __str__(self):
        return f"{self.name} - ${self.budget_amount}/{self.period}"

    def get_current_spend(self):
        """Calculate current spending for this budget period."""
        from datetime import timedelta
        from django.db.models import Sum

        now = timezone.now()

        # Determine start date based on period
        if self.period == "daily":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif self.period == "weekly":
            # Start of week (Monday)
            start_date = now - timedelta(days=now.weekday())
            start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        else:  # monthly
            start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Build query
        query = AIUsageLog.objects.filter(
            created_at__gte=start_date, was_successful=True
        )

        # Apply optional filters
        if self.provider:
            query = query.filter(provider=self.provider)
        if self.model_name:
            query = query.filter(model_name=self.model_name)
        if self.user:
            query = query.filter(user=self.user)

        result = query.aggregate(total=Sum("total_cost"))
        return result["total"] or Decimal("0")

    def should_trigger_alert(self):
        """Check if alert should be triggered."""
        if not self.is_active:
            return False

        current_spend = self.get_current_spend()
        threshold = (self.budget_amount * self.threshold_percentage) / 100

        return current_spend >= threshold

    def get_spend_percentage(self):
        """Get current spending as percentage of budget."""
        current_spend = self.get_current_spend()
        if self.budget_amount == 0:
            return 0
        return float((current_spend / self.budget_amount) * 100)
