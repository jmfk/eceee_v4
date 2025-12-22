from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import DataConnection, DataStream, DataTransformer
from .serializers import (
    DataConnectionSerializer, 
    DataConnectionListSerializer, 
    DataStreamSerializer, 
    DataTransformerSerializer
)

from .services.manager import DataConnectionManager

class DataConnectionViewSet(viewsets.ModelViewSet):
    queryset = DataConnection.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    manager = DataConnectionManager()

    def get_serializer_class(self):
        if self.action == 'list':
            return DataConnectionListSerializer
        return DataConnectionSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Test a connection by executing its first stream if available."""
        connection = self.get_object()
        stream = connection.streams.first()
        if not stream:
            return Response({"error": "No streams defined for this connection"}, status=status.HTTP_400_BAD_REQUEST)
        
        data = self.manager.execute_stream(stream.id, bypass_cache=True)
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def preview_stream(self, request, pk=None):
        """Preview a stream with potentially unsaved configuration."""
        connection = self.get_object()
        data = self.manager.preview_stream(connection.id, request.data)
        return Response(data, status=status.HTTP_200_OK)

class DataStreamViewSet(viewsets.ModelViewSet):
    queryset = DataStream.objects.all()
    serializer_class = DataStreamSerializer
    permission_classes = [permissions.IsAuthenticated]
    manager = DataConnectionManager()

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Execute a specific data stream."""
        stream = self.get_object()
        bypass_cache = request.data.get('bypass_cache', False)
        query_params = request.data.get('params', {})
        
        data = self.manager.execute_stream(stream.id, bypass_cache=bypass_cache, query_params=query_params)
        return Response(data, status=status.HTTP_200_OK)

class DataTransformerViewSet(viewsets.ModelViewSet):
    queryset = DataTransformer.objects.all()
    serializer_class = DataTransformerSerializer
    permission_classes = [permissions.IsAuthenticated]
