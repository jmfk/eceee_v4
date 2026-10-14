from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import HasTenantAccess

from .models import DataConnection, DataStream, DataTransformer
from .serializers import (
    DataConnectionListSerializer,
    DataConnectionSerializer,
    DataStreamSerializer,
    DataTransformerSerializer,
)
from .services.manager import DataConnectionManager


class DataConnectionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]
    manager = DataConnectionManager()

    def get_queryset(self):
        return DataConnection.objects.filter(tenant=self.request.tenant).prefetch_related("streams")

    def get_serializer_class(self):
        if self.action == "list":
            return DataConnectionListSerializer
        return DataConnectionSerializer

    @action(detail=True, methods=["post"])
    def test(self, request, pk=None):
        """Test a connection without serializing its stored credential."""
        connection = self.get_object()
        if connection.connection_type == "LEGACY_API":
            from content_migration.plugins.eceee_legacy import test_legacy_api_connection

            result, response_status = test_legacy_api_connection(connection)
            return Response(result, status=response_status)
        stream = connection.streams.first()
        if not stream:
            return Response({"error": "No streams defined for this connection"}, status=status.HTTP_400_BAD_REQUEST)

        data = self.manager.execute_stream(stream.id, bypass_cache=True)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def preview_stream(self, request, pk=None):
        """Preview a stream with potentially unsaved configuration."""
        connection = self.get_object()
        data = self.manager.preview_stream(connection.id, request.data)
        return Response(data, status=status.HTTP_200_OK)


class DataStreamViewSet(viewsets.ModelViewSet):
    serializer_class = DataStreamSerializer
    permission_classes = [permissions.IsAuthenticated, HasTenantAccess]
    manager = DataConnectionManager()

    def get_queryset(self):
        return DataStream.objects.filter(connection__tenant=self.request.tenant)

    @action(detail=True, methods=["post"])
    def execute(self, request, pk=None):
        """Execute a specific data stream."""
        stream = self.get_object()
        bypass_cache = request.data.get("bypass_cache", False)
        query_params = request.data.get("params", {})

        data = self.manager.execute_stream(stream.id, bypass_cache=bypass_cache, query_params=query_params)
        return Response(data, status=status.HTTP_200_OK)


class DataTransformerViewSet(viewsets.ModelViewSet):
    queryset = DataTransformer.objects.all()
    serializer_class = DataTransformerSerializer
    permission_classes = [permissions.IsAuthenticated]
