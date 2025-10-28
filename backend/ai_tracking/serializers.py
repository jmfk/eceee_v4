"""
AI Tracking Serializers

DRF serializers for AI tracking models with camelCase conversion.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import AIModelPrice, AIUsageLog, AIBudgetAlert

User = get_user_model()


class AIModelPriceSerializer(serializers.ModelSerializer):
    """Serializer for AI model pricing information."""

    days_since_verified = serializers.SerializerMethodField()

    class Meta:
        model = AIModelPrice
        fields = [
            "id",
            "provider",
            "model_name",
            "input_price_per_1k",
            "output_price_per_1k",
            "effective_date",
            "last_verified",
            "is_stale",
            "auto_updated",
            "notes",
            "created_at",
            "updated_at",
            "days_since_verified",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "last_verified"]

    def get_days_since_verified(self, obj):
        """Calculate days since last verification."""
        from django.utils import timezone

        delta = timezone.now() - obj.last_verified
        return delta.days


class UserSimpleSerializer(serializers.ModelSerializer):
    """Simple user serializer for nested usage."""

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name"]
        read_only_fields = fields


class AIUsageLogSerializer(serializers.ModelSerializer):
    """Serializer for AI usage logs."""

    user = UserSimpleSerializer(read_only=True)
    total_tokens = serializers.IntegerField(read_only=True)
    cost_per_token = serializers.DecimalField(
        max_digits=10, decimal_places=6, read_only=True
    )
    content_type_name = serializers.SerializerMethodField()

    class Meta:
        model = AIUsageLog
        fields = [
            "id",
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
            "content_type_name",
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
        read_only_fields = fields

    def get_content_type_name(self, obj):
        """Get human-readable content type name."""
        if obj.content_type:
            return str(obj.content_type)
        return None


class AIUsageLogListSerializer(serializers.ModelSerializer):
    """Simplified serializer for list view (excludes prompt/response)."""

    user_username = serializers.CharField(source="user.username", read_only=True)
    total_tokens = serializers.IntegerField(read_only=True)

    class Meta:
        model = AIUsageLog
        fields = [
            "id",
            "provider",
            "model_name",
            "user_username",
            "input_tokens",
            "output_tokens",
            "total_tokens",
            "total_cost",
            "task_description",
            "created_at",
            "duration_ms",
            "was_successful",
        ]
        read_only_fields = fields


class AIBudgetAlertSerializer(serializers.ModelSerializer):
    """Serializer for budget alerts."""

    current_spend = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    spend_percentage = serializers.FloatField(read_only=True)

    class Meta:
        model = AIBudgetAlert
        fields = [
            "id",
            "name",
            "budget_amount",
            "period",
            "provider",
            "model_name",
            "user",
            "email_recipients",
            "threshold_percentage",
            "is_active",
            "last_triggered",
            "last_checked",
            "created_at",
            "updated_at",
            "current_spend",
            "spend_percentage",
        ]
        read_only_fields = [
            "id",
            "last_triggered",
            "last_checked",
            "created_at",
            "updated_at",
            "current_spend",
            "spend_percentage",
        ]

    def to_representation(self, instance):
        """Add current spend and percentage to representation."""
        data = super().to_representation(instance)
        data["current_spend"] = instance.get_current_spend()
        data["spend_percentage"] = instance.get_spend_percentage()
        return data


class AnalyticsSummarySerializer(serializers.Serializer):
    """Serializer for analytics summary data."""

    total_cost = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_calls = serializers.IntegerField()
    total_input_tokens = serializers.IntegerField()
    total_output_tokens = serializers.IntegerField()
    total_tokens = serializers.IntegerField()
    avg_cost_per_call = serializers.DecimalField(max_digits=10, decimal_places=6)
    avg_duration_ms = serializers.FloatField()
    success_rate = serializers.FloatField()


class AnalyticsGroupSerializer(serializers.Serializer):
    """Serializer for grouped analytics data."""

    group_key = serializers.CharField()
    total_cost = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_calls = serializers.IntegerField()
    total_tokens = serializers.IntegerField()
    avg_cost_per_call = serializers.DecimalField(max_digits=10, decimal_places=6)


class AnalyticsTrendSerializer(serializers.Serializer):
    """Serializer for trend data over time."""

    date = serializers.DateField()
    total_cost = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_calls = serializers.IntegerField()
    total_tokens = serializers.IntegerField()
