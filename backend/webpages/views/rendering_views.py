"""
Function-based views for layout JSON serialization and page rendering.
"""

import logging
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import WebPage, PageVersion
from ..renderers import WebPageRenderer
from ..json_models import PageWidgetData
from ..utils.template_parser import LayoutSerializer as TemplateLayoutSerializer

# Setup logging
logger = logging.getLogger(__name__)


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
    try:
        from ..layout_registry import layout_registry

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

        mock_layout = MockLayout(layout_name, layout_instance.template_name)
        layout_json_data = serializer.serialize_layout(mock_layout)

        return Response(layout_json_data)

    except Exception as e:
        # Log detailed error for debugging (server-side only)
        logger.error(
            f"Error serializing layout '{layout_name}': {str(e)}", exc_info=True
        )

        # Return generic error message to prevent information disclosure
        error_msg = "Layout serialization failed"

        # In debug mode, provide more details for development but sanitize the error message
        if settings.DEBUG:
            # Sanitize error message to avoid leaking sensitive paths or internal details
            error_str = str(e)
            # Remove potential file paths and sensitive information
            import re

            # More comprehensive path sanitization
            sanitized_error = re.sub(r"[/\\][^\s]*[/\\][^\s]*", "/<path>/", error_str)
            sanitized_error = re.sub(
                r'File "([^"]+)"', 'File "<path>"', sanitized_error
            )
            sanitized_error = re.sub(r"'[/\\][^']*'", "'<path>'", sanitized_error)
            error_msg = f"Error serializing layout: {sanitized_error}"

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
            "page_title": page.get_title(),
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
