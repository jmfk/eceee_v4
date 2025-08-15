"""
PageDataSchema ViewSet for CRUD operations on page data JSON Schemas.
"""

from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from ..models import PageDataSchema
from ..serializers import PageDataSchemaSerializer


class PageDataSchemaViewSet(viewsets.ModelViewSet):
    """CRUD for page data JSON Schemas with filter support."""

    queryset = PageDataSchema.objects.all()
    serializer_class = PageDataSchemaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["scope", "layout_name", "is_active", "name"]
    search_fields = ["name", "description", "layout_name"]
    ordering_fields = ["updated_at", "created_at", "name"]
    ordering = ["-updated_at"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="effective")
    def effective(self, request):
        """Return the effective schema for a given layout name (query param: layout_name)."""
        layout_name = request.query_params.get("layout_name")
        schema = PageDataSchema.get_effective_schema_for_layout(layout_name)
        return Response({"layout_name": layout_name, "schema": schema})
