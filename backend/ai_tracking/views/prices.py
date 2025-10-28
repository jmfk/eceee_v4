"""
Price Management Views

API endpoints for managing AI model prices.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from ai_tracking.models import AIModelPrice
from ai_tracking.serializers import AIModelPriceSerializer
from ai_tracking.services import PriceUpdater


class AIModelPriceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for AI model prices.

    list: Get all model prices
    retrieve: Get specific price
    create: Add new price (admin only)
    update: Update price (admin only)
    partial_update: Partially update price (admin only)
    destroy: Delete price (admin only)
    refresh: Trigger manual price check (admin only)
    """

    queryset = AIModelPrice.objects.all()
    serializer_class = AIModelPriceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["provider", "model_name", "is_stale", "auto_updated"]
    search_fields = ["provider", "model_name", "notes"]
    ordering_fields = ["effective_date", "last_verified", "created_at"]
    ordering = ["-effective_date"]

    def get_permissions(self):
        """Only admins can create/update/delete prices."""
        if self.action in ["create", "update", "partial_update", "destroy", "refresh"]:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @action(detail=False, methods=["post"], permission_classes=[IsAdminUser])
    def refresh(self, request):
        """
        Trigger manual price check for all models.

        Attempts to fetch current prices from provider APIs and
        flags stale prices.
        """
        updater = PriceUpdater()
        results = updater.check_all_prices()

        # Send email notification
        updater.send_price_update_email(results)

        return Response(
            {"message": "Price check completed", "results": results},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAdminUser])
    def verify(self, request, pk=None):
        """
        Mark a specific price as verified.

        Updates last_verified timestamp and clears stale flag.
        """
        price = self.get_object()
        price.is_stale = False
        price.save()

        serializer = self.get_serializer(price)
        return Response(serializer.data)
