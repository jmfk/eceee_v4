"""
Code Layout ViewSet for managing code-based layouts.

Provides API endpoints for layout discovery, validation, and management.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
import logging
import time
from django.core.cache import cache

from ..serializers import LayoutSerializer
from ..utils.template_parser import LayoutSerializer as TemplateLayoutSerializer

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
        from ..layout_registry import layout_registry
        from ..layout_autodiscovery import get_layout_summary

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

        from ..layout_registry import layout_registry

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
        from ..layout_registry import layout_registry

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

        from ..layout_autodiscovery import reload_layouts, get_layout_summary

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

        from ..layout_autodiscovery import validate_layout_configuration

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
