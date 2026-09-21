import uuid

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Tenant
from site_statistics.serializers import EventIngestionSerializer
from site_statistics.tasks import ingest_events


class EventIngestionView(APIView):
    """
    API endpoint for receiving analytics events.
    Supports both JS-based client tracking and server-side tracking.
    """

    permission_classes = [AllowAny]  # Public endpoint for tracking
    max_batch_size = 100

    def post(self, request, *args, **kwargs):
        tenant_identifier = request.headers.get("X-Tenant-ID") or request.data.get("tenant_id")

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

        if "events" in request.data:
            events = request.data["events"]
            if not isinstance(events, list):
                return Response(
                    {"error": "events must be an array"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            events = [request.data]

        if len(events) > self.max_batch_size:
            return Response(
                {"error": f"Too many events; maximum batch size is {self.max_batch_size}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EventIngestionSerializer(data=events, many=True)
        serializer.is_valid(raise_exception=True)

        payloads = []
        for event_data in serializer.validated_data:
            metadata = dict(event_data.get("metadata", {}))
            if event_data.get("session_id"):
                metadata.setdefault("session_id", event_data["session_id"])

            event_time = event_data.get("event_time", timezone.now())
            payloads.append(
                {
                    "user_id": event_data.get("user_id") or "anonymous",
                    "event_type": event_data.get("event_type", "pageview"),
                    "event_time": event_time.isoformat(),
                    "url": event_data.get("url"),
                    "referrer": event_data.get("referrer"),
                    "metadata": metadata,
                }
            )

        if payloads:
            ingest_events.delay(str(tenant.id), payloads)

        return Response({"status": "received"}, status=status.HTTP_202_ACCEPTED)
