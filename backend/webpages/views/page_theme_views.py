"""
PageTheme ViewSet for managing page themes.
"""

from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from ..models import PageTheme
from ..serializers import PageThemeSerializer


class PageThemeViewSet(viewsets.ModelViewSet):
    """ViewSet for managing page themes."""

    queryset = PageTheme.objects.all()
    serializer_class = PageThemeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active", "created_by"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at", "updated_at"]
    ordering = ["name"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Get only active themes"""
        active_themes = self.queryset.filter(is_active=True)
        serializer = self.get_serializer(active_themes, many=True)
        return Response(serializer.data)
