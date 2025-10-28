"""
Analytics Views

API endpoints for AI usage analytics and reporting.
"""

from decimal import Decimal
from datetime import timedelta
from django.db.models import Sum, Count, Avg, Q
from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ai_tracking.models import AIUsageLog
from ai_tracking.serializers import (
    AnalyticsSummarySerializer,
    AnalyticsGroupSerializer,
    AnalyticsTrendSerializer,
)


class AnalyticsViewSet(viewsets.ViewSet):
    """
    ViewSet for AI usage analytics.

    Provides aggregated data and insights about AI usage and costs.
    """

    permission_classes = [IsAuthenticated]

    def _get_base_queryset(self, request):
        """Get base queryset with filters applied."""
        queryset = AIUsageLog.objects.filter(was_successful=True)

        # Date range filtering
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)

        # Provider filtering
        provider = request.query_params.get("provider")
        if provider:
            queryset = queryset.filter(provider=provider)

        # Model filtering
        model_name = request.query_params.get("model")
        if model_name:
            queryset = queryset.filter(model_name=model_name)

        # User filtering (non-admin users can only see their own data)
        if not request.user.is_staff:
            queryset = queryset.filter(user=request.user)
        else:
            user_id = request.query_params.get("user")
            if user_id:
                queryset = queryset.filter(user_id=user_id)

        return queryset

    @action(detail=False, methods=["get"])
    def summary(self, request):
        """
        Get summary analytics for the specified period.

        Query params:
        - date_from: Start date (ISO format)
        - date_to: End date (ISO format)
        - provider: Filter by provider
        - model: Filter by model name
        - user: Filter by user ID (admin only)
        """
        queryset = self._get_base_queryset(request)

        # Calculate aggregates
        aggregates = queryset.aggregate(
            total_cost=Sum("total_cost"),
            total_calls=Count("id"),
            total_input_tokens=Sum("input_tokens"),
            total_output_tokens=Sum("output_tokens"),
            avg_cost_per_call=Avg("total_cost"),
            avg_duration_ms=Avg("duration_ms"),
        )

        # Calculate success rate
        total_logs = AIUsageLog.objects.filter(
            created_at__gte=request.query_params.get("date_from")
            or timezone.now() - timedelta(days=30)
        ).count()

        success_rate = 100.0
        if total_logs > 0:
            success_rate = (aggregates["total_calls"] / total_logs) * 100

        # Build response
        data = {
            "total_cost": aggregates["total_cost"] or Decimal("0"),
            "total_calls": aggregates["total_calls"] or 0,
            "total_input_tokens": aggregates["total_input_tokens"] or 0,
            "total_output_tokens": aggregates["total_output_tokens"] or 0,
            "total_tokens": (aggregates["total_input_tokens"] or 0)
            + (aggregates["total_output_tokens"] or 0),
            "avg_cost_per_call": aggregates["avg_cost_per_call"] or Decimal("0"),
            "avg_duration_ms": aggregates["avg_duration_ms"] or 0,
            "success_rate": success_rate,
        }

        serializer = AnalyticsSummarySerializer(data)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def by_user(self, request):
        """
        Get costs grouped by user.

        Admin only. Returns top users by cost.
        """
        if not request.user.is_staff:
            return Response(
                {"detail": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
            )

        queryset = self._get_base_queryset(request)

        # Group by user
        results = (
            queryset.values("user__username")
            .annotate(
                total_cost=Sum("total_cost"),
                total_calls=Count("id"),
                total_tokens=Sum("input_tokens") + Sum("output_tokens"),
                avg_cost_per_call=Avg("total_cost"),
            )
            .order_by("-total_cost")[:20]
        )

        # Format results
        data = []
        for item in results:
            data.append(
                {
                    "group_key": item["user__username"] or "Unknown",
                    "total_cost": item["total_cost"],
                    "total_calls": item["total_calls"],
                    "total_tokens": item["total_tokens"],
                    "avg_cost_per_call": item["avg_cost_per_call"],
                }
            )

        serializer = AnalyticsGroupSerializer(data, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def by_model(self, request):
        """
        Get costs grouped by model.

        Returns top models by cost.
        """
        queryset = self._get_base_queryset(request)

        # Group by model
        results = (
            queryset.values("provider", "model_name")
            .annotate(
                total_cost=Sum("total_cost"),
                total_calls=Count("id"),
                total_tokens=Sum("input_tokens") + Sum("output_tokens"),
                avg_cost_per_call=Avg("total_cost"),
            )
            .order_by("-total_cost")[:20]
        )

        # Format results
        data = []
        for item in results:
            data.append(
                {
                    "group_key": f"{item['provider']}/{item['model_name']}",
                    "total_cost": item["total_cost"],
                    "total_calls": item["total_calls"],
                    "total_tokens": item["total_tokens"],
                    "avg_cost_per_call": item["avg_cost_per_call"],
                }
            )

        serializer = AnalyticsGroupSerializer(data, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def by_provider(self, request):
        """
        Get costs grouped by provider.
        """
        queryset = self._get_base_queryset(request)

        # Group by provider
        results = (
            queryset.values("provider")
            .annotate(
                total_cost=Sum("total_cost"),
                total_calls=Count("id"),
                total_tokens=Sum("input_tokens") + Sum("output_tokens"),
                avg_cost_per_call=Avg("total_cost"),
            )
            .order_by("-total_cost")
        )

        # Format results
        data = []
        for item in results:
            data.append(
                {
                    "group_key": item["provider"],
                    "total_cost": item["total_cost"],
                    "total_calls": item["total_calls"],
                    "total_tokens": item["total_tokens"],
                    "avg_cost_per_call": item["avg_cost_per_call"],
                }
            )

        serializer = AnalyticsGroupSerializer(data, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def trends(self, request):
        """
        Get cost trends over time.

        Query params:
        - period: 'daily', 'weekly', or 'monthly' (default: daily)
        - date_from: Start date
        - date_to: End date
        """
        queryset = self._get_base_queryset(request)

        # Determine truncation function
        period = request.query_params.get("period", "daily")
        if period == "weekly":
            trunc_func = TruncWeek
        elif period == "monthly":
            trunc_func = TruncMonth
        else:
            trunc_func = TruncDate

        # Group by date
        results = (
            queryset.annotate(date=trunc_func("created_at"))
            .values("date")
            .annotate(
                total_cost=Sum("total_cost"),
                total_calls=Count("id"),
                total_tokens=Sum("input_tokens") + Sum("output_tokens"),
            )
            .order_by("date")
        )

        # Format results
        data = []
        for item in results:
            data.append(
                {
                    "date": item["date"],
                    "total_cost": item["total_cost"],
                    "total_calls": item["total_calls"],
                    "total_tokens": item["total_tokens"],
                }
            )

        serializer = AnalyticsTrendSerializer(data, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def top_tasks(self, request):
        """
        Get most expensive task types.
        """
        queryset = self._get_base_queryset(request)

        # Group by task description
        results = (
            queryset.values("task_description")
            .annotate(
                total_cost=Sum("total_cost"),
                total_calls=Count("id"),
                total_tokens=Sum("input_tokens") + Sum("output_tokens"),
                avg_cost_per_call=Avg("total_cost"),
            )
            .order_by("-total_cost")[:20]
        )

        # Format results
        data = []
        for item in results:
            data.append(
                {
                    "group_key": item["task_description"],
                    "total_cost": item["total_cost"],
                    "total_calls": item["total_calls"],
                    "total_tokens": item["total_tokens"],
                    "avg_cost_per_call": item["avg_cost_per_call"],
                }
            )

        serializer = AnalyticsGroupSerializer(data, many=True)
        return Response(serializer.data)
