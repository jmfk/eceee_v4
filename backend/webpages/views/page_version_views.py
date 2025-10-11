"""
PageVersion ViewSet for managing page versions with workflow support.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import Q, Exists, OuterRef
from django.utils import timezone
from django.shortcuts import get_object_or_404

from ..models import WebPage, PageVersion, PageDataSchema
from ..serializers import (
    PageVersionSerializer,
    PageVersionListSerializer,
    PageVersionComparisonSerializer,
    WidgetUpdateSerializer,
    PageDataUpdateSerializer,
    MetadataUpdateSerializer,
    PublishingUpdateSerializer,
)
from ..filters import PageVersionFilter


class PageVersionViewSet(viewsets.ModelViewSet):
    """ViewSet for page versions with workflow support."""

    queryset = PageVersion.objects.select_related("page", "created_by").all()
    serializer_class = PageVersionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = PageVersionFilter
    search_fields = ["version_title", "change_summary"]
    ordering_fields = ["created_at", "version_number", "version_title"]
    ordering = ["-created_at"]

    def get_queryset(self):
        """Enhanced queryset with special filtering for current and latest versions"""
        queryset = super().get_queryset()

        # SECURITY: For non-staff users, only allow access to published versions
        if not self.request.user.is_staff:
            now = timezone.now()
            # Filter to only published versions (have effective_date and are not expired)
            queryset = queryset.filter(effective_date__lte=now).filter(
                Q(expiry_date__isnull=True) | Q(expiry_date__gt=now)
            )

        # Handle special query parameters
        page_id = self.request.query_params.get("page")
        current = self.request.query_params.get("current", "").lower() == "true"
        latest = self.request.query_params.get("latest", "").lower() == "true"

        # Filter by page if specified
        if page_id:
            queryset = queryset.filter(page_id=page_id)

        # Special handling for current published version
        if current and page_id:
            try:
                page = get_object_or_404(WebPage, id=page_id)
                current_version = page.get_current_published_version()
                if current_version:
                    queryset = queryset.filter(id=current_version.id)
                else:
                    queryset = queryset.none()  # No current published version
            except:
                queryset = queryset.none()

        # Special handling for latest version
        elif latest and page_id:
            try:
                page = get_object_or_404(WebPage, id=page_id)
                # For non-staff users requesting latest, only return latest if it's published
                if not self.request.user.is_staff:
                    latest_version = page.get_current_published_version()
                else:
                    latest_version = page.get_latest_version()
                if latest_version:
                    queryset = queryset.filter(id=latest_version.id)
                else:
                    queryset = queryset.none()  # No versions
            except:
                queryset = queryset.none()

        return queryset

    def get_serializer_class(self):
        """Use different serializers based on action"""
        if self.action == "list":
            return PageVersionListSerializer
        elif self.action == "compare":
            return PageVersionComparisonSerializer
        return PageVersionSerializer

    def perform_create(self, serializer):
        # Auto-generate version number if not provided
        if (
            "version_number" not in serializer.validated_data
            or serializer.validated_data["version_number"] is None
        ):
            page = serializer.validated_data["page"]
            with transaction.atomic():
                # Get the latest version number with row-level locking to prevent race conditions
                latest_version = (
                    page.versions.select_for_update()
                    .order_by("-version_number")
                    .first()
                )
                version_number = (
                    (latest_version.version_number + 1) if latest_version else 1
                )
                serializer.validated_data["version_number"] = version_number

        # Ensure page_data has a default value if not provided
        if (
            "page_data" not in serializer.validated_data
            or serializer.validated_data["page_data"] is None
        ):
            serializer.validated_data["page_data"] = {}

        # Ensure widgets has a default value if not provided
        if (
            "widgets" not in serializer.validated_data
            or serializer.validated_data["widgets"] is None
        ):
            serializer.validated_data["widgets"] = {}

        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        """Override destroy to cleanup media references"""
        from file_manager.utils import cleanup_content_references

        # Clean up media references before deleting
        cleanup_content_references("webpage", str(instance.page.id))

        # Perform the actual deletion
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publish this version"""
        version = self.get_object()

        if version.get_publication_status() == "published":
            return Response(
                {"error": "Version is already published"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Handle anonymous user for development
            user = request.user if request.user.is_authenticated else None
            version.publish(user)
            serializer = self.get_serializer(version)
            return Response(
                {
                    "message": "Version published successfully",
                    "version": serializer.data,
                }
            )
        except Exception as e:
            return Response(
                {"error": f"Publishing failed: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=["patch"], url_path="widgets")
    def update_widgets(self, request, pk=None):
        """Update only widget data - no page_data validation"""
        version = self.get_object()

        serializer = WidgetUpdateSerializer(version, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Return full version data for consistency
        full_serializer = PageVersionSerializer(version)
        return Response(full_serializer.data)

    @action(detail=True, methods=["patch"], url_path="page-data")
    def update_page_data(self, request, pk=None):
        """Update only page_data with schema validation"""
        version = self.get_object()

        serializer = PageDataUpdateSerializer(version, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Return full version data for consistency
        full_serializer = PageVersionSerializer(version)
        return Response(full_serializer.data)

    @action(detail=True, methods=["patch"], url_path="metadata")
    def update_metadata(self, request, pk=None):
        """Update version metadata (title, layout, theme, etc.)"""
        version = self.get_object()

        serializer = MetadataUpdateSerializer(version, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Return full version data for consistency
        full_serializer = PageVersionSerializer(version)
        return Response(full_serializer.data)

    @action(detail=True, methods=["patch"], url_path="publishing")
    def update_publishing(self, request, pk=None):
        """Update publishing dates and settings"""
        version = self.get_object()

        serializer = PublishingUpdateSerializer(
            version, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Return full version data for consistency
        full_serializer = PageVersionSerializer(version)
        return Response(full_serializer.data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Restore this version as current"""
        version = self.get_object()

        try:
            new_version = version.restore_as_current(request.user)
            serializer = self.get_serializer(new_version)
            return Response(
                {
                    "message": "Version restored successfully",
                    "new_version": serializer.data,
                }
            )
        except Exception as e:
            return Response(
                {"error": f"Restore failed: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"], url_path="pack-aggressive")
    def pack_aggressive(self, request):
        """Remove all superseded and draft versions older than current published"""
        page_id = request.data.get("page_id")
        if not page_id:
            return Response(
                {"error": "page_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            page = WebPage.objects.get(id=page_id)

            # Find the current published version
            current_published = None
            for version in page.versions.all():
                if version.is_current_published():
                    current_published = version
                    break

            if not current_published:
                return Response(
                    {"error": "No currently published version found"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find versions to delete (superseded and drafts older than current published)
            versions_to_delete = page.versions.filter(
                version_number__lt=current_published.version_number
            ).exclude(id=current_published.id)

            # Count for response
            deleted_count = versions_to_delete.count()
            deleted_versions = [
                {
                    "id": v.id,
                    "version_number": v.version_number,
                    "version_title": v.version_title,
                    "status": v.get_publication_status(),
                }
                for v in versions_to_delete
            ]

            # Delete the versions
            versions_to_delete.delete()

            return Response(
                {
                    "message": f"Successfully removed {deleted_count} old versions",
                    "deleted_count": deleted_count,
                    "deleted_versions": deleted_versions,
                    "kept_current_published": {
                        "id": current_published.id,
                        "version_number": current_published.version_number,
                        "version_title": current_published.version_title,
                    },
                }
            )

        except WebPage.DoesNotExist:
            return Response(
                {"error": "Page not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return Response(
                {"error": f"Pack operation failed: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(
        detail=False,
        methods=["get"],
        url_path="pages/(?P<page_id>[^/.]+)/versions",
    )
    def by_page(self, request, page_id=None):
        """Get all versions for a specific page"""
        try:
            # Verify page exists
            page = get_object_or_404(WebPage, id=page_id)

            # Get queryset and apply filters
            queryset = self.get_queryset().filter(page=page)

            # Apply pagination
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)

        except ValueError:
            return Response(
                {"error": "Invalid page ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(
        detail=False,
        methods=["get"],
        url_path="pages/(?P<page_id>[^/.]+)/versions/current",
    )
    def current_for_page(self, request, page_id=None):
        """Get current published version for a specific page, creating one if none exists"""
        try:
            page = get_object_or_404(WebPage, id=page_id)
        except ValueError:
            return Response(
                {"error": "Invalid page ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_version = page.get_current_published_version()
        if not current_version:
            # Fallback to latest version for staff users
            if request.user.is_staff:
                current_version = page.get_latest_version()

        if not current_version:
            # Auto-create initial version if none exists
            current_version = page.create_version(
                user=request.user, version_title="Auto-generated initial version"
            )
            # Log the auto-creation
            import logging

            logger = logging.getLogger(__name__)
            logger.info(
                f"Auto-created initial version for page {page_id} (no versions existed)"
            )

        serializer = self.get_serializer(current_version)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="pack-drafts")
    def pack_drafts(self, request):
        """Remove only draft versions older than current published"""
        page_id = request.data.get("page_id")
        if not page_id:
            return Response(
                {"error": "page_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            page = WebPage.objects.get(id=page_id)

            # Find the current published version
            current_published = None
            for version in page.versions.all():
                if version.is_current_published():
                    current_published = version
                    break

            if not current_published:
                return Response(
                    {"error": "No currently published version found"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Find draft versions to delete (only drafts older than current published)
            versions_to_delete = page.versions.filter(
                version_number__lt=current_published.version_number,
                effective_date__isnull=True,  # Draft versions have no effective_date
            ).exclude(id=current_published.id)

            # Count for response
            deleted_count = versions_to_delete.count()
            deleted_versions = [
                {
                    "id": v.id,
                    "version_number": v.version_number,
                    "version_title": v.version_title,
                    "status": v.get_publication_status(),
                }
                for v in versions_to_delete
            ]

            # Delete the versions
            versions_to_delete.delete()

            return Response(
                {
                    "message": f"Successfully removed {deleted_count} old draft versions",
                    "deleted_count": deleted_count,
                    "deleted_versions": deleted_versions,
                    "kept_current_published": {
                        "id": current_published.id,
                        "version_number": current_published.version_number,
                        "version_title": current_published.version_title,
                    },
                }
            )

        except WebPage.DoesNotExist:
            return Response(
                {"error": "Page not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            return Response(
                {"error": f"Pack operation failed: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
