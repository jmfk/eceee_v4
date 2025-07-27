"""
Django REST Framework views for the Web Page Publishing System

Provides API endpoints for managing pages, layouts, themes, widgets, and versions
with proper authentication, permissions, and filtering.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
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

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

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
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
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

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

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
    """ViewSet for managing web pages."""

    queryset = (
        WebPage.objects.select_related(
            "parent", "theme", "created_by", "last_modified_by"
        )
        .prefetch_related("children")
        .all()
    )

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = WebPageFilter
    search_fields = ["title", "slug", "description", "meta_title", "meta_description"]
    ordering_fields = [
        "title",
        "slug",
        "sort_order",
        "created_at",
        "updated_at",
        "effective_date",
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
                queryset = queryset.filter(
                    publication_status="published", effective_date__lte=now
                ).filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))

        return queryset

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user, last_modified_by=self.request.user
        )

        # Normalize sort orders for the parent group
        page = serializer.instance
        WebPage.normalize_sort_orders(page.parent_id)

    def perform_update(self, serializer):
        serializer.save(last_modified_by=self.request.user)
        # Create draft version after successful update
        if self.request.data:
            auto_publish = self.request.data.get("auto_publish", False)
            description = self.request.data.get("version_description", "API update")
            serializer.instance.create_version(
                self.request.user,
                description,
                status="published" if auto_publish else "draft",
                auto_publish=auto_publish,
            )

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
        published_pages = (
            self.get_queryset()
            .filter(publication_status="published", effective_date__lte=now)
            .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
        )

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

        page.publication_status = "published"
        page.effective_date = now
        page.expiry_date = None
        page.last_modified_by = request.user
        page.save()

        # Create published version
        page.create_version(
            request.user, "Published via API", status="published", auto_publish=True
        )

        serializer = self.get_serializer(page)
        return Response(
            {
                "message": "Page published successfully",
                "effective_date": page.effective_date,
                "expiry_date": page.expiry_date,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        """Unpublish a page"""
        page = self.get_object()
        now = timezone.now()

        page.publication_status = "unpublished"
        page.effective_date = None
        page.expiry_date = now
        page.last_modified_by = request.user
        page.save()

        # Create version
        page.create_version(request.user, "Unpublished via API")

        serializer = self.get_serializer(page)
        return Response(
            {
                "message": "Page unpublished successfully",
                "effective_date": page.effective_date,
                "expiry_date": page.expiry_date,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def update_widgets(self, request, pk=None):
        """Update page widgets by creating a new version"""
        page = self.get_object()

        # Validate request data
        widgets_data = request.data.get("widgets", {})
        if not isinstance(widgets_data, dict):
            return Response(
                {"error": "Widgets data must be a JSON object"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get description for the version
        description = request.data.get("description", "Widget update via API")
        auto_publish = request.data.get("auto_publish", False)

        try:
            # Get current version data to preserve page_data
            current_version = page.get_current_version()
            current_page_data = current_version.page_data if current_version else {}

            # Create new version with updated widgets
            new_version = page.create_version(
                user=request.user,
                description=description,
                status="published" if auto_publish else "draft",
                auto_publish=auto_publish,
            )

            # Update the version with new widgets and preserve page_data
            new_version.page_data = current_page_data
            new_version.widgets = widgets_data
            new_version.save()

            # If auto-publishing, update page status
            if auto_publish:
                page.last_modified_by = request.user
                page.save()

            # Return updated page data
            serializer = self.get_serializer(page)
            return Response(
                {
                    "message": "Widgets updated successfully",
                    "version_id": new_version.id,
                    "version_number": new_version.version_number,
                    "auto_published": auto_publish,
                    "page": serializer.data,
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": f"Failed to update widgets: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )


class PageVersionViewSet(viewsets.ModelViewSet):
    """ViewSet for page versions with workflow support."""

    queryset = PageVersion.objects.select_related(
        "page", "created_by", "published_by"
    ).all()
    serializer_class = PageVersionSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
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

        if version.status == "published":
            return Response(
                {"error": "Version is already published"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            version.publish(request.user)
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


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticatedOrReadOnly])
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
