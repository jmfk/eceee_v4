"""
Usage Logs Views

API endpoints for viewing AI usage logs.
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from ai_tracking.models import AIUsageLog
from ai_tracking.serializers import AIUsageLogSerializer, AIUsageLogListSerializer


class AIUsageLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for AI usage logs (read-only).

    Usage logs are created automatically by the AIClient service.

    list: Get all usage logs with filtering
    retrieve: Get specific usage log with full details
    """

    queryset = AIUsageLog.objects.select_related("user", "content_type").all()
    permission_classes = [IsAuthenticated]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = [
        "provider",
        "model_name",
        "user",
        "was_successful",
        "store_full_data",
    ]
    search_fields = ["task_description", "prompt", "response"]
    ordering_fields = [
        "created_at",
        "total_cost",
        "input_tokens",
        "output_tokens",
        "duration_ms",
    ]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        """Use different serializers for list vs detail."""
        if self.action == "list":
            return AIUsageLogListSerializer
        return AIUsageLogSerializer

    def get_queryset(self):
        """Filter queryset based on query parameters."""
        queryset = super().get_queryset()

        # Date range filtering
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if date_from:
            queryset = queryset.filter(created_at__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__lte=date_to)

        # Content type filtering
        content_type = self.request.query_params.get("content_type")
        if content_type:
            queryset = queryset.filter(content_type__model=content_type)

        # Non-admin users can only see their own logs
        if not self.request.user.is_staff:
            queryset = queryset.filter(user=self.request.user)

        return queryset
