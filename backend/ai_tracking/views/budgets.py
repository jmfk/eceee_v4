"""
Budget Alerts Views

API endpoints for managing AI budget alerts.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from ai_tracking.models import AIBudgetAlert
from ai_tracking.serializers import AIBudgetAlertSerializer
from ai_tracking.services import PriceUpdater


class AIBudgetAlertViewSet(viewsets.ModelViewSet):
    """
    ViewSet for AI budget alerts.

    list: Get all budget alerts
    retrieve: Get specific alert
    create: Create new alert (admin only)
    update: Update alert (admin only)
    partial_update: Partially update alert (admin only)
    destroy: Delete alert (admin only)
    check: Check current spend against all budgets
    """

    queryset = AIBudgetAlert.objects.all()
    serializer_class = AIBudgetAlertSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["period", "provider", "is_active"]
    search_fields = ["name"]
    ordering_fields = ["created_at", "budget_amount", "last_triggered"]
    ordering = ["-created_at"]

    def get_permissions(self):
        """Only admins can create/update/delete alerts."""
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [IsAdminUser()]
        return [IsAuthenticated()]

    @action(detail=False, methods=["get"])
    def check(self, request):
        """
        Check current spend against all active budgets.

        Returns list of budgets with current spend status.
        """
        alerts = AIBudgetAlert.objects.filter(is_active=True)

        results = []
        for alert in alerts:
            current_spend = alert.get_current_spend()
            percentage = alert.get_spend_percentage()
            should_alert = alert.should_trigger_alert()

            results.append(
                {
                    "id": alert.id,
                    "name": alert.name,
                    "budget_amount": alert.budget_amount,
                    "current_spend": current_spend,
                    "spend_percentage": percentage,
                    "period": alert.period,
                    "threshold_percentage": alert.threshold_percentage,
                    "should_alert": should_alert,
                    "over_budget": current_spend > alert.budget_amount,
                }
            )

        return Response(results)

    @action(detail=True, methods=["post"])
    def test_alert(self, request, pk=None):
        """
        Send a test alert email.

        Admin only. Useful for testing email configuration.
        """
        if not request.user.is_staff:
            return Response(
                {"detail": "Admin access required"}, status=status.HTTP_403_FORBIDDEN
            )

        alert = self.get_object()
        updater = PriceUpdater()

        try:
            updater._send_budget_alert_email(alert)
            return Response(
                {"message": f'Test alert sent to {", ".join(alert.email_recipients)}'}
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
