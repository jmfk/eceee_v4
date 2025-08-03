"""
Django REST Framework views for the Web Page Publishing System

Provides API endpoints for managing pages, layouts, themes, widgets, and versions
with proper authentication, permissions, and filtering.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.throttling import UserRateThrottle
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q
from django.utils import timezone
import logging
import time
from django.core.cache import cache

from .models import WebPage, PageVersion, PageTheme
from .serializers import (
    WebPageDetailSerializer,
    WebPageListSerializer,
    WebPageTreeSerializer,
    PageVersionSerializer,
    PageVersionListSerializer,
    PageVersionComparisonSerializer,
    LayoutSerializer,
    PageThemeSerializer,
    PageHierarchySerializer,
)
from .filters import WebPageFilter, PageVersionFilter
from .utils.template_parser import LayoutSerializer as TemplateLayoutSerializer

# Setup logging for API metrics
logger = logging.getLogger("webpages.api")


class CodeLayoutViewSet(viewsets.ViewSet):
    """
    ViewSet for managing code-based layouts.

    Provides API endpoints for layout discovery, validation, and management.
    """

    permission_classes = [permissions.IsAuthenticated]

    def _get_api_version(self, request):
        """Get API version from request headers or query params"""
        version = request.META.get("HTTP_API_VERSION") or request.query_params.get(
            "version", "v1"
        )
        return version

    def _get_client_ip(self, request):
        """Get client IP address for rate limiting"""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip

    def _add_rate_limiting_headers(self, response, request, endpoint_type="default"):
        """Add rate limiting headers to prevent API abuse"""
        rate_limits = {
            "list": 1000,
            "detail": 2000,
            "default": 1000,
        }

        limit = rate_limits.get(endpoint_type, rate_limits["default"])

        # Simple rate tracking using cache
        client_ip = self._get_client_ip(request)
        cache_key = f"rate_limit:{endpoint_type}:{client_ip}"
        current_requests = cache.get(cache_key, 0)

        # Update cache with expiry of 1 hour
        cache.set(cache_key, current_requests + 1, 3600)

        # Add rate limit headers
        response["X-RateLimit-Limit"] = str(limit)
        response["X-RateLimit-Remaining"] = str(max(0, limit - current_requests - 1))
        response["X-RateLimit-Reset"] = str(int(time.time()) + 3600)

        if current_requests >= limit * 0.9:
            response["Retry-After"] = "3600"

        return response

    def _log_metrics(self, request, endpoint, layout_name=None):
        """Log API usage metrics for monitoring"""
        metrics_data = {
            "endpoint": endpoint,
            "layout_name": layout_name,
            "api_version": self._get_api_version(request),
            "user_agent": request.META.get("HTTP_USER_AGENT", "unknown"),
            "client_ip": self._get_client_ip(request),
            "timestamp": timezone.now().isoformat(),
        }

        logger.debug(f"Layout API request: {metrics_data}")

    def _create_formatted_response(self, data, request, status_code=status.HTTP_200_OK):
        """Create response with proper content type"""
        response = Response(data, status=status_code)
        response["Vary"] = "Accept, Accept-Encoding, API-Version"
        response["Content-Language"] = "en"
        response["X-API-Features"] = "rate-limiting,metrics,caching"
        return response

    def _add_caching_headers(self, response, layout_name=None):
        """Add proper HTTP caching headers"""
        from django.utils.http import http_date
        from django.utils import timezone
        import time

        response["Cache-Control"] = "public, max-age=3600"
        response["Vary"] = "Accept-Encoding, Accept, API-Version"

        if layout_name:
            etag = f'"{layout_name}-{int(time.time() // 3600)}"'
            response["ETag"] = etag

        response["Last-Modified"] = http_date(timezone.now().timestamp())
        return response

    def list(self, request):
        """Get all registered code-based layouts"""
        from .layout_registry import layout_registry
        from .layout_autodiscovery import get_layout_summary

        active_only = request.query_params.get("active_only", "true").lower() == "true"
        api_version = self._get_api_version(request)

        # Log metrics
        self._log_metrics(request, "list")

        # Get layouts
        layouts = layout_registry.list_layouts(active_only=active_only)
        layout_data = [layout.to_dict() for layout in layouts]

        # Use serializer for consistent formatting
        serializer_context = {
            "api_version": api_version,
            "request": request,
        }

        serializer = LayoutSerializer(
            layout_data,
            many=True,
            context=serializer_context,
        )

        response_data = {
            "results": serializer.data,
            "summary": get_layout_summary(),
            "api_version": api_version,
        }

        response = self._create_formatted_response(response_data, request)
        response = self._add_caching_headers(response)
        response = self._add_rate_limiting_headers(response, request, "list")
        return response

    def retrieve(self, request, pk=None):
        """Get a specific code-based layout by name"""
        from .layout_registry import layout_registry

        layout = layout_registry.get_layout(pk)
        if not layout:
            error_data = {"error": f"Layout '{pk}' not found"}
            return self._create_formatted_response(
                error_data, request, status.HTTP_404_NOT_FOUND
            )

        api_version = self._get_api_version(request)

        # Log metrics
        self._log_metrics(request, "detail", layout_name=pk)

        # Get layout data
        layout_data = layout.to_dict()

        # Use serializer for consistent formatting
        serializer_context = {
            "api_version": api_version,
            "request": request,
        }

        serializer = LayoutSerializer(layout_data, context=serializer_context)

        response = self._create_formatted_response(serializer.data, request)
        response = self._add_caching_headers(response, layout_name=pk)
        response = self._add_rate_limiting_headers(response, request, "detail")
        return response

    @action(detail=False, methods=["get"])
    def choices(self, request):
        """Get layout choices for forms/dropdowns"""
        from .layout_registry import layout_registry

        # Log metrics
        self._log_metrics(request, "choices")

        active_only = request.query_params.get("active_only", "true").lower() == "true"
        layouts = layout_registry.list_layouts(active_only=active_only)
        choices = [(layout.name, layout.name) for layout in layouts]

        response = self._create_formatted_response(choices, request)
        response = self._add_caching_headers(response)
        response = self._add_rate_limiting_headers(response, request, "list")
        return response

    @action(detail=False, methods=["post"])
    def reload(self, request):
        """Reload all layouts (admin/dev use)"""
        if not request.user.is_staff:
            error_data = {"error": "Only staff can reload layouts"}
            return self._create_formatted_response(
                error_data, request, status.HTTP_403_FORBIDDEN
            )

        # Log metrics for admin operations
        self._log_metrics(request, "reload")

        from .layout_autodiscovery import reload_layouts, get_layout_summary

        try:
            reload_layouts()
            success_data = {
                "message": "Layouts reloaded successfully",
                "summary": get_layout_summary(),
            }
            response = self._create_formatted_response(success_data, request)
            response = self._add_rate_limiting_headers(response, request, "default")
            return response
        except Exception as e:
            error_data = {"error": f"Failed to reload layouts: {str(e)}"}
            return self._create_formatted_response(
                error_data, request, status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=["get"])
    def validate(self, request):
        """Validate all registered layouts (admin/dev use)"""
        if not request.user.is_staff:
            error_data = {"error": "Only staff can validate layouts"}
            return self._create_formatted_response(
                error_data, request, status.HTTP_403_FORBIDDEN
            )

        # Log metrics for admin operations
        self._log_metrics(request, "validate")

        from .layout_autodiscovery import validate_layout_configuration

        try:
            validate_layout_configuration()
            success_data = {"message": "All layouts are valid"}
            response = self._create_formatted_response(success_data, request)
            response = self._add_rate_limiting_headers(response, request, "default")
            return response
        except Exception as e:
            error_data = {"error": f"Layout validation failed: {str(e)}"}
            return self._create_formatted_response(
                error_data, request, status.HTTP_400_BAD_REQUEST
            )


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


class WidgetTypeViewSet(viewsets.ViewSet):
    """ViewSet for code-based widget types."""

    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        """List all registered widget types"""
        from .widget_registry import widget_type_registry

        active_only = request.query_params.get("active", "true").lower() == "true"
        widget_types = widget_type_registry.to_dict(active_only=active_only)

        # Apply search filter if provided
        search = request.query_params.get("search")
        if search:
            search_lower = search.lower()
            widget_types = [
                wt
                for wt in widget_types
                if search_lower in wt["name"].lower()
                or search_lower in wt["description"].lower()
            ]

        # Apply ordering
        ordering = request.query_params.get("ordering", "name")
        if ordering.startswith("-"):
            reverse_order = True
            ordering = ordering[1:]
        else:
            reverse_order = False

        if ordering in ["name", "description"]:
            widget_types.sort(key=lambda x: x.get(ordering, ""), reverse=reverse_order)

        return Response(widget_types)

    def retrieve(self, request, pk=None):
        """Get a specific widget type by name"""
        from .widget_registry import widget_type_registry

        widget_type = widget_type_registry.get_widget_type(pk)
        if not widget_type:
            return Response(
                {"error": f"Widget type '{pk}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(widget_type.to_dict())

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Get only active widget types"""
        from .widget_registry import widget_type_registry

        active_types = widget_type_registry.to_dict(active_only=True)
        return Response(active_types)


class WebPageViewSet(viewsets.ModelViewSet):
    """ViewSet for managing web pages with rate limiting for hostname operations."""

    queryset = (
        WebPage.objects.select_related(
            "parent", "theme", "created_by", "last_modified_by"
        )
        .prefetch_related("children")
        .all()
    )

    permission_classes = [permissions.IsAuthenticated]
    # Rate limiting for hostname management security
    throttle_classes = [UserRateThrottle]
    throttle_scope = "webpage_modifications"
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = WebPageFilter
    search_fields = ["title", "slug", "description", "meta_title", "meta_description"]
    ordering_fields = [
        "title",
        "slug",
        "sort_order",
        "created_at",
        "updated_at",
    ]
    ordering = ["sort_order", "title"]

    def get_serializer_class(self):
        """Use different serializers based on action"""
        if self.action == "list":
            return WebPageListSerializer
        elif self.action in ["tree", "hierarchy"]:
            return WebPageTreeSerializer
        return WebPageDetailSerializer

    def get_queryset(self):
        """Filter queryset based on action and permissions"""
        queryset = super().get_queryset()

        if self.action in ["list", "retrieve"]:
            # For public endpoints, only show published pages to non-staff users
            if not self.request.user.is_staff:
                now = timezone.now()
                # Get pages that have published versions
                published_page_ids = (
                    PageVersion.objects.filter(effective_date__lte=now)
                    .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
                    .values_list("page_id", flat=True)
                    .distinct()
                )

                queryset = queryset.filter(id__in=published_page_ids)

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, last_modified_by=self.request.user
        )

        # Normalize sort orders for the parent group
        page = serializer.instance
        WebPage.normalize_sort_orders(page.parent_id)

    def retrieve(self, request, pk=None):
        """Override retrieve to include last saved version data with widgets"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        page_data = serializer.data

        # Get the last saved version (most recent regardless of status)
        last_saved_version = instance.versions.order_by("-version_number").first()
        if last_saved_version:
            # Add last saved version data to the response
            page_data["widgets"] = last_saved_version.widgets or {}
            page_data["page_data"] = last_saved_version.page_data or {}
            page_data["last_saved_version"] = {
                "version_id": last_saved_version.id,
                "version_number": last_saved_version.version_number,
                "is_current_published": last_saved_version.is_current_published(),
                "publication_status": last_saved_version.get_publication_status(),
                "description": last_saved_version.description,
                "created_at": last_saved_version.created_at,
                "created_by": (
                    last_saved_version.created_by.username
                    if last_saved_version.created_by
                    else None
                ),
                "effective_date": last_saved_version.effective_date,
                "expiry_date": last_saved_version.expiry_date,
                "change_summary": last_saved_version.change_summary or {},
            }
        else:
            # No versions exist yet
            page_data["widgets"] = {}
            page_data["page_data"] = {}
            page_data["last_saved_version"] = {
                "version_id": None,
                "version_number": 0,
                "is_current_published": False,
                "publication_status": "draft",
                "description": None,
                "created_at": None,
                "created_by": None,
                "effective_date": None,
                "expiry_date": None,
                "change_summary": {},
            }

        return Response(page_data)

    def perform_update(self, serializer):
        """Enhanced to handle unified saves (page data + widgets)"""
        # Check if there's any data to save
        has_data = bool(self.request.data)

        if not has_data:
            return

        # Prepare validated data for unified save
        save_kwargs = {"last_modified_by": self.request.user}

        # Save the page data (including widgets if present)
        # The serializer's update method will handle both page fields, widgets, and version creation
        # Version options (auto_publish, version_description) are passed through the request data
        serializer.save(**save_kwargs)

        # Note: Version creation is now handled by the serializer's update method
        # Version options are automatically extracted from validated_data in the serializer

    @action(detail=False, methods=["get"])
    def tree(self, request):
        """Get page hierarchy as a tree structure"""
        root_pages = self.get_queryset().filter(parent__isnull=True)
        serializer = PageHierarchySerializer(
            root_pages, many=True, context={"request": request}
        )
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def published(self, request):
        """Get only published pages"""
        now = timezone.now()
        # Get pages that have published versions
        published_page_ids = (
            PageVersion.objects.filter(effective_date__lte=now)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
            .values_list("page_id", flat=True)
            .distinct()
        )

        published_pages = self.get_queryset().filter(id__in=published_page_ids)

        page = self.paginate_queryset(published_pages)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(published_pages, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publish a page immediately"""
        page = self.get_object()
        now = timezone.now()

        # Handle anonymous user for development
        user = request.user if request.user.is_authenticated else None
        if user:
            page.last_modified_by = user
        page.save()

        # Create published version
        version = page.create_version(user, "Published via API")
        # Set effective_date to publish immediately
        version.effective_date = now
        version.save()

        serializer = self.get_serializer(page)
        return Response(
            {
                "message": "Page published successfully",
                "effective_date": version.effective_date,
                "expiry_date": version.expiry_date,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        """Unpublish a page"""
        page = self.get_object()
        now = timezone.now()

        # Handle anonymous user for development
        user = request.user if request.user.is_authenticated else None
        if user:
            page.last_modified_by = user
        page.save()

        # Create unpublished version (no effective_date means it's a draft)
        version = page.create_version(user, "Unpublished via API")

        serializer = self.get_serializer(page)
        return Response(
            {
                "message": "Page unpublished successfully",
                "effective_date": version.effective_date,
                "expiry_date": version.expiry_date,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"])
    def versions(self, request, pk=None):
        """Get all versions for this page"""
        page = self.get_object()
        versions = page.versions.select_related("created_by").order_by(
            "-version_number"
        )

        version_data = []
        for version in versions:
            version_data.append(
                {
                    "id": version.id,
                    "version_number": version.version_number,
                    "description": version.description,
                    "publication_status": version.get_publication_status(),
                    "is_current_published": version.is_current_published(),
                    "created_at": version.created_at,
                    "created_by": (
                        version.created_by.username if version.created_by else None
                    ),
                    "effective_date": version.effective_date,
                    "expiry_date": version.expiry_date,
                    "publication_status": version.get_publication_status(),
                    "has_widgets": bool(version.widgets),
                    "widgets_count": len(version.widgets) if version.widgets else 0,
                }
            )

        return Response(
            {
                "page_id": page.id,
                "page_title": page.title,
                "current_version": (
                    page.get_current_published_version().id
                    if page.get_current_published_version()
                    else None
                ),
                "total_versions": len(version_data),
                "versions": version_data,
            }
        )

    @action(detail=True, methods=["get"], url_path="versions/(?P<version_id>[^/.]+)")
    def version_detail(self, request, pk=None, version_id=None):
        """Get complete data for a specific version of this page"""
        page = self.get_object()

        # Validate that the version belongs to this page
        try:
            version = page.versions.select_related("created_by").get(id=version_id)
        except PageVersion.DoesNotExist:
            return Response(
                {"error": f"Version {version_id} not found for page {page.id}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Return complete version data including widgets (same format as PageVersionViewSet.widgets)
        return Response(
            {
                "version_id": version.id,
                "version_number": version.version_number,
                "page_id": version.page.id,
                "page_title": version.page.title,
                "widgets": version.widgets or {},
                "page_data": version.page_data or {},
                "is_current_published": version.is_current_published(),
                "publication_status": version.get_publication_status(),
                "description": version.description,
                "created_at": version.created_at,
                "created_by": (
                    version.created_by.username if version.created_by else None
                ),
                "effective_date": version.effective_date,
                "expiry_date": version.expiry_date,
                "publication_status": version.get_publication_status(),
                "change_summary": version.change_summary or {},
            }
        )


class PageVersionViewSet(viewsets.ModelViewSet):
    """ViewSet for page versions with workflow support."""

    queryset = PageVersion.objects.select_related("page", "created_by").all()
    serializer_class = PageVersionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = PageVersionFilter
    search_fields = ["title", "description", "change_summary"]
    ordering_fields = ["created_at", "version_number", "title"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        """Use different serializers based on action"""
        if self.action == "list":
            return PageVersionListSerializer
        elif self.action == "compare":
            return PageVersionComparisonSerializer
        return PageVersionSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

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

    @action(detail=True, methods=["get"])
    def widgets(self, request, pk=None):
        """Get widget data for this specific version"""
        version = self.get_object()

        return Response(
            {
                "version_id": version.id,
                "version_number": version.version_number,
                "page_id": version.page.id,
                "widgets": version.widgets or {},
                "page_data": version.page_data or {},
                "is_current_published": version.is_current_published(),
                "publication_status": version.get_publication_status(),
                "description": version.description,
                "created_at": version.created_at,
                "created_by": (
                    version.created_by.username if version.created_by else None
                ),
            }
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def layout_json(request, layout_name):
    """
    Return JSON representation of a layout template

    Args:
        layout_name: Name of the layout to serialize (e.g., 'sidebar_layout')

    Returns:
        JSON structure representing the layout template
    """
    import logging
    from django.conf import settings

    logger = logging.getLogger(__name__)

    try:
        from .layout_registry import layout_registry

        # Get the layout class from registry
        layout_class = layout_registry.get_layout_class(layout_name)
        if not layout_class:
            return Response(
                {"error": f"Layout '{layout_name}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Create layout instance
        layout_instance = layout_class()

        # Use the template parser to serialize the layout
        serializer = TemplateLayoutSerializer()

        # Create a mock layout object for the serializer
        class MockLayout:
            def __init__(self, name, template_name):
                self.name = name
                self.template_name = template_name
                self.description = getattr(layout_instance, "description", "")
                self.id = name  # Use name as ID for code-based layouts

        mock_layout = MockLayout(layout_name, f"{layout_name}.html")
        layout_json = serializer.serialize_layout(mock_layout)

        return Response(layout_json)

    except Exception as e:
        # Log detailed error for debugging (server-side only)
        logger.error(
            f"Error serializing layout '{layout_name}': {str(e)}", exc_info=True
        )

        # Return generic error message to prevent information disclosure
        error_msg = "Layout serialization failed"

        # In debug mode, provide more details for development
        if settings.DEBUG:
            error_msg = f"Error serializing layout: {str(e)}"

        return Response(
            {"error": error_msg}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def render_page_backend(request, page_id, version_id=None):
    """
    Render a complete WebPage using the backend renderer.

    Args:
        page_id: ID of the WebPage to render
        version_id: Optional specific PageVersion ID to render

    Query Parameters:
        include_css: Include CSS in response (default: true)
        include_meta: Include meta tags in response (default: true)
        include_debug: Include debug info in response (default: false, only in DEBUG mode)

    Returns:
        JSON response with 'html', 'css', 'meta', and optionally 'debug_info'
    """
    import logging
    from django.conf import settings
    from django.shortcuts import get_object_or_404
    from .renderers import WebPageRenderer
    from .models import WebPage, PageVersion

    logger = logging.getLogger(__name__)

    try:
        # Get the page
        page = get_object_or_404(WebPage, id=page_id)

        # Check if page is accessible
        if not page.is_published() and not request.user.is_authenticated:
            return Response(
                {"error": "Page not found or not accessible"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get specific version if requested
        page_version = None
        if version_id:
            page_version = get_object_or_404(PageVersion, id=version_id, page=page)
            # Check if user can access this version
            if (
                page_version.get_publication_status() != "published"
                and not request.user.is_authenticated
            ):
                return Response(
                    {"error": "Version not found or not accessible"},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Get query parameters
        include_css = request.GET.get("include_css", "true").lower() == "true"
        include_meta = request.GET.get("include_meta", "true").lower() == "true"
        include_debug = (
            request.GET.get("include_debug", "false").lower() == "true"
            and settings.DEBUG
        )

        # Render the page
        renderer = WebPageRenderer(request=request)
        result = renderer.render(page, version=page_version)

        # Build response
        response_data = {
            "html": result["html"],
            "page_id": page.id,
            "page_title": page.title,
            "page_slug": page.slug,
        }

        if include_css:
            response_data["css"] = result["css"]

        if include_meta:
            response_data["meta"] = result["meta"]

        if include_debug:
            response_data["debug_info"] = result["debug_info"]

        return Response(response_data)

    except ValueError as e:
        # Handle specific rendering errors
        error_msg = str(e)
        if not settings.DEBUG:
            error_msg = "Page rendering failed"

        return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        # Log detailed error for debugging
        logger.error(f"Error rendering page {page_id}: {str(e)}", exc_info=True)

        # Return generic error message
        error_msg = "Page rendering failed"
        if settings.DEBUG:
            error_msg = f"Error rendering page: {str(e)}"

        return Response(
            {"error": error_msg}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def render_page_preview(request):
    """
    Render a page preview with custom widget data (for editing).

    Body:
        {
            "page_id": 123,
            "widgets": [...],  // Widget data to render
            "page_data": {...}, // Optional page data override
            "include_css": true,
            "include_debug": false
        }

    Returns:
        JSON response with rendered HTML and optional CSS/debug info
    """
    import logging
    from django.conf import settings
    from django.shortcuts import get_object_or_404
    from .renderers import WebPageRenderer
    from .models import WebPage, PageVersion
    from .json_models import PageWidgetData

    logger = logging.getLogger(__name__)

    try:
        # Validate request data
        page_id = request.data.get("page_id")
        widgets_data = request.data.get("widgets", [])
        page_data_override = request.data.get("page_data", {})
        include_css = request.data.get("include_css", True)
        include_debug = request.data.get("include_debug", False) and settings.DEBUG

        if not page_id:
            return Response(
                {"error": "page_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get the page
        page = get_object_or_404(WebPage, id=page_id)

        # Create a mock PageVersion with the provided widget data
        current_version = page.get_current_published_version()
        if not current_version:
            return Response(
                {"error": "No current version found for page"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create mock version for preview
        class MockPageVersion:
            def __init__(self, original_version, widgets_override, page_data_override):
                # Copy attributes from original version
                for attr in [
                    "id",
                    "version_number",
                    "effective_date",
                    "expiry_date",
                ]:
                    setattr(self, attr, getattr(original_version, attr, None))

                # Override with preview data
                self.widgets = widgets_override
                self.page_data = {
                    **(original_version.page_data or {}),
                    **page_data_override,
                }

        mock_version = MockPageVersion(
            current_version, widgets_data, page_data_override
        )

        # Render the page with mock data
        renderer = WebPageRenderer(request=request)
        result = renderer.render(page, version=mock_version)

        # Build response
        response_data = {
            "html": result["html"],
            "page_id": page.id,
            "preview": True,
        }

        if include_css:
            response_data["css"] = result["css"]

        if include_debug:
            response_data["debug_info"] = result["debug_info"]
            response_data["widget_count"] = len(widgets_data)

        return Response(response_data)

    except Exception as e:
        # Log detailed error for debugging
        logger.error(f"Error rendering page preview: {str(e)}", exc_info=True)

        # Return generic error message
        error_msg = "Page preview rendering failed"
        if settings.DEBUG:
            error_msg = f"Error rendering preview: {str(e)}"

        return Response(
            {"error": error_msg}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
