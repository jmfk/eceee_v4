"""Operator diagnostic API. Explicit JSON casing is independent of CMS browser adapters."""

import logging
import time
from io import BytesIO

from drf_spectacular.utils import extend_schema
from rest_framework import exceptions, serializers
from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from core.machine_api_keys import MachineAPIKeyAuthentication

from .access import DiagnosticPermission, DiagnosticThrottle, global_allowed, tenants_for
from .catalog import inventory
from .database import query_data
from .events import LEVELS, SERVICES
from .logs import event_details, search_logs, source_inventory
from .schema import CatalogSerializer, DataResultsSerializer, EventSerializer, LogResultsSerializer, SourcesSerializer

logger = logging.getLogger("core.diagnostics.audit")


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError({"non_field_errors": ["Expected a JSON object."]})
        if set(data) - set(self.fields):
            raise serializers.ValidationError({"non_field_errors": ["Unknown diagnostic parameter."]})
        return super().to_internal_value(data)


class TenantSelection(StrictSerializer):
    tenants = serializers.JSONField(required=True, help_text="A tenant UUID, list of UUIDs, or all_allowed.")


class PageQuery(TenantSelection):
    limit = serializers.IntegerField(default=50, min_value=1, max_value=200)
    cursor = serializers.CharField(required=False, max_length=16384)


class LogQuery(PageQuery):
    start = serializers.DateTimeField(required=False)
    end = serializers.DateTimeField(required=False)
    source = serializers.ChoiceField(choices=SERVICES, required=False)
    level = serializers.ChoiceField(choices=sorted(LEVELS), required=False)
    text = serializers.CharField(required=False, max_length=200, allow_blank=True)
    request_id = serializers.UUIDField(required=False)
    include_global = serializers.BooleanField(default=False)


class Filter(StrictSerializer):
    column = serializers.CharField(max_length=100)
    operator = serializers.ChoiceField(choices=("eq", "ne", "lt", "lte", "gt", "gte", "in", "is_null"))
    value = serializers.JSONField(required=False)


class Sort(StrictSerializer):
    column = serializers.CharField(max_length=100)
    direction = serializers.ChoiceField(choices=("asc", "desc"), default="asc")


class DataQuery(PageQuery):
    table = serializers.CharField(max_length=100)
    columns = serializers.ListField(
        child=serializers.CharField(max_length=100), max_length=100, required=False, allow_empty=False
    )
    filters = Filter(many=True, required=False, max_length=20)
    sort = Sort(many=True, required=False, max_length=5)


class DetailsQuery(TenantSelection):
    include_global = serializers.BooleanField(default=False)


class DiagnosticView(APIView):
    authentication_classes = [MachineAPIKeyAuthentication]
    permission_classes = [DiagnosticPermission]
    throttle_classes = [DiagnosticThrottle]
    parser_classes = [JSONParser]
    renderer_classes = [JSONRenderer]

    def initial(self, request, *args, **kwargs):
        self.started = time.monotonic()
        self.audit_tenants = []
        self.audit_sources = []
        super().initial(request, *args, **kwargs)
        # Authenticate/throttle first, then read at most one byte beyond the diagnostic body limit.
        try:
            stream = request.stream
            body = stream.read(16385) if stream else b""
        except ValueError:
            raise exceptions.ParseError("Invalid diagnostic request length.") from None
        if len(body) > 16384:
            raise exceptions.ParseError("Diagnostic request exceeds 16 KiB.")
        request._request._body = body
        request._request._stream = BytesIO(body)
        request._stream = BytesIO(body)

    def selection(self, request, data):
        self.audit_tenants = tenants_for(request, data["tenants"])
        return self.audit_tenants

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        if response.status_code < 400:
            rendered = self.renderer_classes[0]().render(response.data)
            if len(rendered) > 1024 * 1024:
                response = Response(
                    {"detail": "Diagnostic response exceeded its size limit; refine the query."}, status=422
                )
                response = super().finalize_response(request, response, *args, **kwargs)
                response["Cache-Control"] = "no-store"
        key = getattr(request, "auth", None)
        logger.info(
            "diagnostic_operation",
            extra={
                "diagnostic_audit": {
                    "key_id": str(getattr(key, "pk", "")),
                    "operation": type(self).__name__,
                    "tenants": getattr(self, "audit_tenants", []),
                    "sources": getattr(self, "audit_sources", []),
                    "status": response.status_code,
                    "count": len(response.data.get("results", [])) if isinstance(response.data, dict) else 0,
                    "limited": response.data.get("limited", False) if isinstance(response.data, dict) else False,
                    "elapsed_ms": round((time.monotonic() - getattr(self, "started", time.monotonic())) * 1000),
                }
            },
        )
        return response


class SourcesView(DiagnosticView):
    @extend_schema(
        responses=SourcesSerializer,
        description="Available diagnostic sources; global coverage metadata requires diagnostics.global.read.",
    )
    def get(self, request):
        return Response(source_inventory(request))


class LogSearchView(DiagnosticView):
    @extend_schema(
        request=LogQuery,
        responses=LogResultsSerializer,
        description=(
            "Search sanitized logs over at most 24 hours. Signed cursors bind tenant selection, key "
            "and immutable export generation; expire after one hour."
        ),
    )
    def post(self, request):
        serializer = LogQuery(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        self.audit_sources = [data["source"]] if data.get("source") else []
        return Response(search_logs(request, data, self.selection(request, data)))


class EventView(DiagnosticView):
    @extend_schema(
        parameters=[DetailsQuery],
        responses=EventSerializer,
        description="Read selected diagnostic event; tenants must be specified. No raw event endpoint exists.",
    )
    def get(self, request, event_id):
        serializer = DetailsQuery(data=request.query_params.dict())
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return Response(event_details(request, event_id, self.selection(request, data), data["include_global"]))


class CatalogView(DiagnosticView):
    @extend_schema(
        responses=CatalogSerializer,
        description=(
            "Model table/field inventory. Only reviewed diagnostic projections are queryable; "
            "all unreviewed fields are excluded."
        ),
    )
    def get(self, request):
        return Response({"results": inventory(global_allowed(request))})


class DataQueryView(DiagnosticView):
    @extend_schema(
        request=DataQuery,
        responses=DataResultsSerializer,
        description=(
            "Query approved masked diagnostic views, never SQL. Filters and ordering operate on masked values. "
            "Live row pagination is not a database snapshot; query timeout is five seconds."
        ),
    )
    def post(self, request):
        serializer = DataQuery(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return Response(query_data(request, data, self.selection(request, data)))
