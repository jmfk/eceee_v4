"""
Theme Sync ViewSet for file-based theme synchronization.

Provides endpoints for bidirectional sync between local Python files and server JSON storage.
"""

from rest_framework import viewsets, permissions, status, authentication
from rest_framework.decorators import action
from rest_framework.response import Response
from django.conf import settings
from django.utils import timezone
from django.db import models
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

from ..models import PageTheme
from ..serializers.theme_sync import (
    ThemeSyncSerializer,
    ThemeSyncPushSerializer,
    ThemeSyncStatusSerializer,
    ThemeSyncConflictCheckSerializer,
)


@method_decorator(csrf_exempt, name="dispatch")
class ThemeSyncViewSet(viewsets.ViewSet):
    """ViewSet for theme synchronization operations"""

    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [
        authentication.TokenAuthentication,
        authentication.SessionAuthentication,
    ]

    def check_sync_enabled(self):
        """Check if theme sync is enabled"""
        if not getattr(settings, "THEME_SYNC_ENABLED", False):
            return Response(
                {
                    "error": "Theme sync is disabled. Set THEME_SYNC_ENABLED=True to enable."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    @action(detail=False, methods=["get"])
    def status(self, request):
        """
        Get themes updated since a specific version.

        Query params:
        - since_version: Minimum version to return (default: 0)
        """
        check = self.check_sync_enabled()
        if check:
            return check

        since_version = int(request.query_params.get("since_version", 0))

        # Filter by tenant from middleware
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response(
                {"error": "Tenant is required. Provide X-Tenant-ID header."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        themes = PageTheme.objects.filter(
            tenant=tenant, sync_version__gt=since_version
        ).order_by("sync_version")

        max_version = (
            PageTheme.objects.filter(tenant=tenant).aggregate(
                max_version=models.Max("sync_version")
            )["max_version"]
            or 0
        )

        serializer = ThemeSyncSerializer(
            themes, many=True, context={"request": request}
        )

        # For output serialization, pass data directly
        return Response(
            {
                "themes": serializer.data,
                "max_version": max_version,
            }
        )

    @action(detail=False, methods=["post"])
    def pull(self, request):
        """
        Pull all themes from server (initial sync).
        Returns all themes with their current versions.
        """
        check = self.check_sync_enabled()
        if check:
            return check

        # Filter by tenant from middleware
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response(
                {"error": "Tenant is required. Provide X-Tenant-ID header."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        themes = PageTheme.objects.filter(tenant=tenant).order_by("name")
        serializer = ThemeSyncSerializer(
            themes, many=True, context={"request": request}
        )

        max_version = (
            PageTheme.objects.filter(tenant=tenant).aggregate(
                max_version=models.Max("sync_version")
            )["max_version"]
            or 0
        )

        # For output serialization, pass data directly
        return Response(
            {
                "themes": serializer.data,
                "max_version": max_version,
            }
        )

    @action(detail=False, methods=["post"])
    def push(self, request):
        """
        Push theme update to server with version check.

        Request body:
        {
            "sync_version": 5,
            "theme_data": {
                "name": "Modern Blue",
                "colors": {...},
                ...
            }
        }

        Returns 409 Conflict if version mismatch.
        """
        check = self.check_sync_enabled()
        if check:
            return check

        push_serializer = ThemeSyncPushSerializer(data=request.data)
        if not push_serializer.is_valid():
            return Response(push_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        theme_data = push_serializer.validated_data["theme_data"]
        client_version = push_serializer.validated_data["sync_version"]
        theme_name = theme_data.get("name")

        if not theme_name:
            return Response(
                {"error": "Theme name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Filter by tenant from middleware
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response(
                {"error": "Tenant is required. Provide X-Tenant-ID header."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            theme = PageTheme.objects.get(name=theme_name, tenant=tenant)
            # Check version conflict
            if client_version < theme.sync_version:
                return Response(
                    {
                        "error": "Version conflict",
                        "client_version": client_version,
                        "server_version": theme.sync_version,
                        "message": (
                            f"Client version ({client_version}) is older than "
                            f"server version ({theme.sync_version}). "
                            "Please pull latest changes and resolve conflicts."
                        ),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Update existing theme
            serializer = ThemeSyncSerializer(
                theme, data=theme_data, partial=True, context={"request": request}
            )
        except PageTheme.DoesNotExist:
            # Create new theme - set tenant from request
            theme_data["tenant"] = tenant.id
            serializer = ThemeSyncSerializer(
                data=theme_data, context={"request": request}
            )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Save with sync metadata
        theme = serializer.save(
            sync_source="sync",
            last_synced_at=timezone.now(),
            skip_version_increment=False,  # Will increment in save()
        )

        return Response(
            ThemeSyncSerializer(theme, context={"request": request}).data,
            status=status.HTTP_200_OK if theme.id else status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"])
    def check_conflict(self, request):
        """
        Check for version conflict before push.

        Query params:
        - name: Theme name
        - version: Client version
        """
        check = self.check_sync_enabled()
        if check:
            return check

        theme_name = request.query_params.get("name")
        client_version = request.query_params.get("version")

        if not theme_name or not client_version:
            return Response(
                {"error": "name and version query parameters are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            client_version = int(client_version)
        except ValueError:
            return Response(
                {"error": "version must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Filter by tenant from middleware
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response(
                {"error": "Tenant is required. Provide X-Tenant-ID header."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            theme = PageTheme.objects.get(name=theme_name, tenant=tenant)
            has_conflict = client_version < theme.sync_version

            return Response(
                {
                    "has_conflict": has_conflict,
                    "client_version": client_version,
                    "server_version": theme.sync_version,
                    "theme_name": theme_name,
                }
            )
        except PageTheme.DoesNotExist:
            return Response(
                {
                    "has_conflict": False,
                    "client_version": client_version,
                    "server_version": 0,
                    "theme_name": theme_name,
                }
            )

    @action(detail=False, methods=["post"])
    def resolve_conflict(self, request):
        """
        Force push after manual conflict resolution.
        Use with caution - overwrites server version.

        Request body:
        {
            "theme_data": {...},
            "force": true  # Must be explicitly set
        }
        """
        check = self.check_sync_enabled()
        if check:
            return check

        if not request.data.get("force"):
            return Response(
                {"error": "force=true is required for conflict resolution"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        theme_data = request.data.get("theme_data")
        if not theme_data:
            return Response(
                {"error": "theme_data is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        theme_name = theme_data.get("name")
        if not theme_name:
            return Response(
                {"error": "Theme name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Filter by tenant from middleware
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response(
                {"error": "Tenant is required. Provide X-Tenant-ID header."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            theme = PageTheme.objects.get(name=theme_name, tenant=tenant)
            serializer = ThemeSyncSerializer(
                theme, data=theme_data, partial=True, context={"request": request}
            )
        except PageTheme.DoesNotExist:
            serializer = ThemeSyncSerializer(
                data=theme_data, context={"request": request}
            )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        theme = serializer.save(
            sync_source="sync",
            last_synced_at=timezone.now(),
            skip_version_increment=False,
        )

        return Response(
            ThemeSyncSerializer(theme, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )
