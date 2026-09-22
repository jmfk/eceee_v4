"""
PageVersion ViewSet for managing page versions with workflow support.
"""

from django.db import transaction
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response

from ..filters import PageVersionFilter
from ..models import PageVersion, WebPage
from ..serializers import (
    MetadataUpdateSerializer,
    PageDataUpdateSerializer,
    PageVersionComparisonSerializer,
    PageVersionListSerializer,
    PageVersionSerializer,
    PublishingUpdateSerializer,
    WidgetUpdateSerializer,
)
from ..services.page_version_workflow import (
    PageVersionWorkflowService,
    ScheduleConflictError,
    VersionConflictError,
    WorkflowError,
    workflow_payload,
)


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

    @staticmethod
    def _workflow_error_response(error):
        return Response(
            {
                "error": error.code,
                "message": str(error),
                "details": error.details,
            },
            status=(
                status.HTTP_409_CONFLICT
                if isinstance(error, (ScheduleConflictError, VersionConflictError))
                else status.HTTP_400_BAD_REQUEST
            ),
        )

    def get_queryset(self):
        """Enhanced queryset with special filtering for current and latest versions"""
        queryset = super().get_queryset()

        tenant = getattr(self.request, "tenant", None)
        if tenant:
            queryset = queryset.filter(page__tenant=tenant)
            if not self.request.user.is_staff and tenant.created_by_id != self.request.user.id:
                return queryset.none()

        if not self.request.user.is_staff and not tenant:
            now = timezone.now()
            published_versions = Q(effective_date__lte=now) & (Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
            queryset = queryset.filter(Q(created_by=self.request.user) | published_versions)

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
                page = get_object_or_404(self._page_queryset(), id=page_id)
                current_version = page.get_current_published_version()
                if current_version:
                    queryset = queryset.filter(id=current_version.id)
                else:
                    queryset = queryset.none()  # No current published version
            except Http404:
                queryset = queryset.none()

        # Special handling for latest version
        elif latest and page_id:
            try:
                page = get_object_or_404(self._page_queryset(), id=page_id)
                # For non-staff users requesting latest, only return latest if it's published
                if not self.request.user.is_staff:
                    latest_version = page.get_current_published_version()
                else:
                    latest_version = page.get_latest_version()
                if latest_version:
                    queryset = queryset.filter(id=latest_version.id)
                else:
                    queryset = queryset.none()  # No versions
            except Http404:
                queryset = queryset.none()

        return queryset

    def _page_queryset(self):
        queryset = WebPage.objects.all()
        tenant = getattr(self.request, "tenant", None)
        if self.request.user.is_staff:
            return queryset.filter(tenant=tenant) if tenant else queryset
        if tenant:
            if tenant.created_by_id != self.request.user.id:
                return queryset.none()
            return queryset.filter(tenant=tenant)
        return queryset.filter(created_by=self.request.user)

    def get_serializer_class(self):
        """Use different serializers based on action"""
        if self.action == "list":
            return PageVersionListSerializer
        elif self.action == "compare":
            return PageVersionComparisonSerializer
        return PageVersionSerializer

    def perform_create(self, serializer):
        # Auto-generate version number if not provided
        if "version_number" not in serializer.validated_data or serializer.validated_data["version_number"] is None:
            page = serializer.validated_data["page"]
            with transaction.atomic():
                # Get the latest version number with row-level locking to prevent race conditions
                latest_version = page.versions.select_for_update().order_by("-version_number").first()
                version_number = (latest_version.version_number + 1) if latest_version else 1
                serializer.validated_data["version_number"] = version_number

        # Ensure page_data has a default value if not provided
        if "page_data" not in serializer.validated_data or serializer.validated_data["page_data"] is None:
            serializer.validated_data["page_data"] = {}

        # Ensure widgets has a default value if not provided
        if "widgets" not in serializer.validated_data or serializer.validated_data["widgets"] is None:
            serializer.validated_data["widgets"] = {}

        page = serializer.validated_data.get("page")
        if page and not self._page_queryset().filter(pk=page.pk).exists():
            raise PermissionDenied("You do not have access to this page's tenant.")

        serializer.save(created_by=self.request.user)

    @transaction.atomic
    def perform_update(self, serializer):
        service = PageVersionWorkflowService(serializer.instance.page, self.request.user)
        service.assert_canonical_editable(serializer.instance)
        serializer.save()

    @transaction.atomic
    def perform_destroy(self, instance):
        """Override destroy to cleanup media references"""
        service = PageVersionWorkflowService(instance.page, self.request.user)
        service.assert_canonical_editable(instance)
        from file_manager.utils import cleanup_content_references

        # Clean up media references before deleting
        cleanup_content_references("webpage", str(instance.page.id))

        # Perform the actual deletion
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publish this exact canonical working version."""
        version = self.get_object()
        try:
            version = PageVersionWorkflowService(version.page, request.user).publish(version)
            serializer = self.get_serializer(version)
            return Response(
                {
                    "message": "Version published successfully",
                    "version": serializer.data,
                }
            )
        except WorkflowError as error:
            return self._workflow_error_response(error)

    @action(detail=True, methods=["post"], url_path="create-draft")
    def create_draft(self, request, pk=None):
        """Compatibility alias for the idempotent working-copy operation."""
        version = self.get_object()
        try:
            draft, created = PageVersionWorkflowService(version.page, request.user).get_or_create_working_copy()
            serializer = self.get_serializer(draft)
            return Response(
                {
                    "message": "Working copy created" if created else "Working copy reused",
                    "created": created,
                    "version": serializer.data,
                }
            )
        except WorkflowError as error:
            return self._workflow_error_response(error)

    @action(detail=True, methods=["patch"], url_path="widgets")
    @transaction.atomic
    def update_widgets(self, request, pk=None):
        """Update only widget data - no page_data validation"""
        version = self.get_object()
        try:
            PageVersionWorkflowService(version.page, request.user).assert_canonical_editable(version)
        except WorkflowError as error:
            return self._workflow_error_response(error)
        serializer = WidgetUpdateSerializer(version, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Return full version data for consistency
        full_serializer = PageVersionSerializer(version)
        return Response(full_serializer.data)

    @action(detail=True, methods=["patch"], url_path="page-data")
    @transaction.atomic
    def update_page_data(self, request, pk=None):
        """Update only page_data with schema validation"""
        version = self.get_object()
        try:
            PageVersionWorkflowService(version.page, request.user).assert_canonical_editable(version)
        except WorkflowError as error:
            return self._workflow_error_response(error)

        serializer = PageDataUpdateSerializer(version, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Return full version data for consistency
        full_serializer = PageVersionSerializer(version)
        return Response(full_serializer.data)

    @action(detail=True, methods=["patch"], url_path="metadata")
    @transaction.atomic
    def update_metadata(self, request, pk=None):
        """Update version metadata (title, layout, theme, etc.)"""
        version = self.get_object()
        try:
            PageVersionWorkflowService(version.page, request.user).assert_canonical_editable(version)
        except WorkflowError as error:
            return self._workflow_error_response(error)

        serializer = MetadataUpdateSerializer(version, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Return full version data for consistency
        full_serializer = PageVersionSerializer(version)
        return Response(full_serializer.data)

    @action(detail=True, methods=["patch"], url_path="publishing")
    @transaction.atomic
    def update_publishing(self, request, pk=None):
        """Compatibility endpoint routed through the canonical workflow."""
        version = self.get_object()

        try:
            PageVersionWorkflowService(version.page, request.user).assert_canonical_editable(version)
        except WorkflowError as error:
            return self._workflow_error_response(error)

        include_subpages = request.query_params.get("include_subpages", "false").lower() == "true"
        serializer = PublishingUpdateSerializer(version, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        effective_date = serializer.validated_data.get("effective_date", version.effective_date)
        expiry_date = serializer.validated_data.get("expiry_date", version.expiry_date)
        now = timezone.now()

        if include_subpages:
            if effective_date is None or effective_date > now:
                return Response(
                    {"error": "invalid_tree_publication", "message": "Page trees can only be published immediately."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            from ..publishing import PublishingService

            user = request.user if request.user.is_authenticated else None
            service = PublishingService(user)
            count, errors = service.publish_page_with_subpages(
                version.page.id,
                change_summary="Published with subpages via API",
                root_version_id=version.id,
            )
            version.refresh_from_db()
            full_serializer = PageVersionSerializer(version)
            response_data = full_serializer.data
            response_data["subpages_published_count"] = max(count - 1, 0)
            response_data["total_published_count"] = count
            if errors:
                response_data["errors"] = errors
            return Response(response_data)

        service = PageVersionWorkflowService(version.page, request.user)
        try:
            if effective_date is None:
                if expiry_date is not None:
                    raise WorkflowError("An expiry date requires a publication date.")
                if version.effective_date and version.effective_date > now:
                    version = service.cancel_schedule(version)
            elif effective_date <= now:
                version = service.publish(version)
            else:
                version = service.schedule(version, effective_date, expiry_date)
        except WorkflowError as error:
            return self._workflow_error_response(error)

        full_serializer = PageVersionSerializer(version)
        return Response(full_serializer.data)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Copy a historical version into the canonical working copy."""
        version = self.get_object()

        try:
            restored = PageVersionWorkflowService(version.page, request.user).restore_as_working_copy(version)
            serializer = self.get_serializer(restored)
            return Response(
                {
                    "message": "Version restored as working copy",
                    "version": serializer.data,
                }
            )
        except WorkflowError as error:
            return self._workflow_error_response(error)

    @action(detail=True, methods=["patch"], url_path="save")
    def save_working_copy(self, request, pk=None):
        """Atomically save all editable version fields with conflict detection."""
        version = self.get_object()
        client_updated_at = request.data.get("client_updated_at")
        if not client_updated_at:
            return Response(
                {
                    "error": "client_updated_at_required",
                    "message": "clientUpdatedAt is required when saving a working version.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        client_timestamp = parse_datetime(client_updated_at)
        if client_timestamp is None:
            return Response(
                {"error": "invalid_timestamp", "message": "clientUpdatedAt is invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                locked = PageVersion.objects.select_for_update().get(pk=version.pk)
                service = PageVersionWorkflowService(locked.page, request.user)
                service.assert_canonical_editable(locked)
                if locked.updated_at != client_timestamp:
                    raise VersionConflictError(
                        "This working version has been changed by another user.",
                        details={
                            "server_updated_at": locked.updated_at.isoformat(),
                            "client_updated_at": client_updated_at,
                        },
                    )
                payload = request.data.copy()
                payload.pop("client_updated_at", None)
                payload.pop("effective_date", None)
                payload.pop("expiry_date", None)
                serializer = PageVersionSerializer(
                    locked,
                    data=payload,
                    partial=True,
                    context={"request": request},
                )
                serializer.is_valid(raise_exception=True)
                serializer.save()
            return Response(serializer.data)
        except WorkflowError as error:
            return self._workflow_error_response(error)

    @action(detail=True, methods=["post"], url_path="schedule")
    def schedule(self, request, pk=None):
        version = self.get_object()
        effective_date = parse_datetime(request.data.get("effective_date", ""))
        expiry_date = parse_datetime(request.data.get("expiry_date", "")) if request.data.get("expiry_date") else None
        if effective_date is None:
            return Response(
                {"error": "invalid_effective_date", "message": "A valid future effectiveDate is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            scheduled = PageVersionWorkflowService(version.page, request.user).schedule(
                version, effective_date, expiry_date
            )
            return Response(PageVersionSerializer(scheduled).data)
        except WorkflowError as error:
            return self._workflow_error_response(error)

    @action(detail=True, methods=["post"], url_path="cancel-schedule")
    def cancel_schedule(self, request, pk=None):
        version = self.get_object()
        try:
            draft = PageVersionWorkflowService(version.page, request.user).cancel_schedule(version)
            return Response(PageVersionSerializer(draft).data)
        except WorkflowError as error:
            return self._workflow_error_response(error)

    def workflow(self, request, page_id=None):
        """Return the canonical aggregate workflow state for one page."""
        page = get_object_or_404(self._page_queryset(), pk=page_id)
        return Response(workflow_payload(page))

    def working_copy(self, request, page_id=None):
        """Idempotently return or create the page's canonical working copy."""
        page = get_object_or_404(self._page_queryset(), pk=page_id)
        try:
            version, created = PageVersionWorkflowService(page, request.user).get_or_create_working_copy()
            return Response(
                {
                    "created": created,
                    "version": PageVersionSerializer(version).data,
                    "workflow": workflow_payload(page),
                },
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            )
        except WorkflowError as error:
            return self._workflow_error_response(error)

    def unpublish_page(self, request, page_id=None):
        """Expire the explicit live version without turning it into a draft."""
        page = get_object_or_404(self._page_queryset(), pk=page_id)
        version_id = request.data.get("version_id")
        if not version_id:
            return Response(
                {"error": "version_id_required", "message": "versionId is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        version = get_object_or_404(self.get_queryset(), pk=version_id, page=page)
        try:
            unpublished = PageVersionWorkflowService(page, request.user).unpublish(version)
            return Response(
                {
                    "version": PageVersionSerializer(unpublished).data,
                    "workflow": workflow_payload(page),
                }
            )
        except WorkflowError as error:
            return self._workflow_error_response(error)

    @action(detail=False, methods=["post"], url_path="bulk-publish-explicit")
    def bulk_publish_explicit(self, request):
        """Publish reviewed page/version/timestamp tuples independently."""
        items = request.data.get("items")
        if not isinstance(items, list) or not items:
            return Response(
                {"error": "items_required", "message": "At least one reviewed item is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        results = []
        has_errors = False
        for item in items:
            page_id = item.get("page_id")
            version_id = item.get("version_id")
            client_updated_at = parse_datetime(item.get("client_updated_at", ""))
            try:
                if not page_id or not version_id or client_updated_at is None:
                    raise WorkflowError("Each item requires pageId, versionId, and clientUpdatedAt.")
                page = self._page_queryset().get(pk=page_id)
                version = self.get_queryset().get(pk=version_id, page=page)
                published = PageVersionWorkflowService(page, request.user).publish(
                    version, expected_updated_at=client_updated_at
                )
                results.append(
                    {
                        "page_id": page.id,
                        "version_id": published.id,
                        "status": "published",
                    }
                )
            except (WebPage.DoesNotExist, PageVersion.DoesNotExist):
                has_errors = True
                results.append(
                    {
                        "page_id": page_id,
                        "version_id": version_id,
                        "status": "error",
                        "error": "not_found",
                        "message": "The reviewed page or version no longer exists.",
                    }
                )
            except WorkflowError as error:
                has_errors = True
                results.append(
                    {
                        "page_id": page_id,
                        "version_id": version_id,
                        "status": "error",
                        "error": error.code,
                        "message": str(error),
                        "details": error.details,
                    }
                )

        return Response(
            {"atomic": False, "results": results},
            status=status.HTTP_207_MULTI_STATUS if has_errors else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"])
    def compare(self, request):
        """Compare two page versions."""
        version1_id = request.query_params.get("version1")
        version2_id = request.query_params.get("version2")

        if not version1_id or not version2_id:
            return Response(
                {"error": "version1 and version2 query parameters are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        accessible_versions = self.get_queryset()
        version1 = get_object_or_404(accessible_versions, pk=version1_id)
        version2 = get_object_or_404(accessible_versions, pk=version2_id, page=version1.page)

        serializer = self.get_serializer(
            {
                "version1": version1,
                "version2": version2,
                "changes": version2.compare_with(version1),
            }
        )
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="pack-aggressive",
        permission_classes=[permissions.IsAdminUser],
    )
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
            versions_to_delete = page.versions.filter(version_number__lt=current_published.version_number).exclude(
                id=current_published.id
            )

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
            current_version = page.create_version(user=request.user, version_title="Auto-generated initial version")

        serializer = self.get_serializer(current_version)
        return Response(serializer.data)

    def latest_for_page(self, request, page_id=None):
        """Get the latest version for a page without creating one as a side effect."""
        try:
            page = get_object_or_404(WebPage, id=page_id)
        except ValueError:
            return Response(
                {"error": "Invalid page ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.user.is_staff:
            latest_version = page.get_latest_version()
        else:
            latest_version = page.get_current_published_version()

        if not latest_version:
            return Response(None, status=status.HTTP_204_NO_CONTENT)

        serializer = self.get_serializer(latest_version)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="pack-drafts",
        permission_classes=[permissions.IsAdminUser],
    )
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
