import json
import uuid
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from statistics.services.queue_driver import RabbitMqDriver
from core.models import Tenant

class EventIngestionView(APIView):
    """
    API endpoint for receiving analytics events.
    Supports both JS-based client tracking and server-side tracking.
    """
    permission_classes = [AllowAny]  # Public endpoint for tracking

    def post(self, request, *args, **kwargs):
        tenant_identifier = request.headers.get("X-Tenant-ID") or request.data.get("tenantId")
        
        if not tenant_identifier:
            return Response({"error": "Tenant ID required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Try UUID first, then identifier
            try:
                tenant = Tenant.objects.get(id=uuid.UUID(tenant_identifier))
            except (ValueError, Tenant.DoesNotExist):
                tenant = Tenant.objects.get(identifier=tenant_identifier)
        except Tenant.DoesNotExist:
            return Response({"error": "Invalid Tenant"}, status=status.HTTP_404_NOT_FOUND)

        events = request.data.get("events", [])
        if not isinstance(events, list):
            events = [request.data]

        queue_driver = RabbitMqDriver()
        
        for event_data in events:
            # Prepare event for queue
            payload = {
                "tenant_id": str(tenant.id),
                "user_id": event_data.get("userId"),
                "event_type": event_data.get("eventType", "pageview"),
                "event_time": event_data.get("eventTime", timezone.now().isoformat()),
                "url": event_data.get("url"),
                "referrer": event_data.get("referrer"),
                "metadata": event_data.get("metadata", {}),
            }
            
            # Anonymize IP or user_id if needed here
            # For now, we assume userId is already an anonymized hash from the client
            
            queue_driver.publish(tenant.id, payload)

        return Response({"status": "received"}, status=status.HTTP_202_ACCEPTED)

