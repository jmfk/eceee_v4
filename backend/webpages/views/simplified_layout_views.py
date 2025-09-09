"""
Simplified Layout API Views

These views provide the new simplified layout JSON format that eliminates
Django template complexity and is optimized for React frontend consumption.
"""

import logging
from django.conf import settings
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.views.decorators.cache import cache_page
from django.utils.decorators import method_decorator

from ..utils.simplified_layout_serializer import (
    SimplifiedLayoutSerializer,
    create_predefined_layouts,
)

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
@cache_page(60 * 30)  # Cache for 30 minutes
def simplified_layout_json(request, layout_name):
    """
    Return simplified JSON representation of a layout

    This endpoint provides clean, React-friendly layout JSON that eliminates
    Django template processing complexity.

    Args:
        layout_name: Name of the layout to serialize (e.g., 'sidebar_layout')

    Query Parameters:
        use_predefined: Use predefined optimized layouts (default: true)

    Returns:
        Simplified JSON structure for React consumption
    """
    try:
        use_predefined = (
            request.query_params.get("use_predefined", "true").lower() == "true"
        )

        if use_predefined:
            # Use predefined optimized layouts
            predefined_layouts = create_predefined_layouts()

            if layout_name in predefined_layouts:
                layout_data = predefined_layouts[layout_name]
                logger.info(f"Serving predefined simplified layout: {layout_name}")

                return Response(
                    {
                        "success": True,
                        "layout": layout_data,
                        "source": "predefined",
                        "cache_info": {
                            "cached": True,
                            "cache_key": f"predefined:{layout_name}",
                        },
                    }
                )

        # Fall back to template parsing
        serializer = SimplifiedLayoutSerializer()
        layout_data = serializer.serialize_layout(layout_name)

        logger.info(f"Serving parsed simplified layout: {layout_name}")

        return Response(
            {
                "success": True,
                "layout": layout_data,
                "source": "template_parsed",
                "cache_info": {
                    "cached": False,
                    "cache_key": f"simplified_layout:{layout_name}",
                },
            }
        )

    except Exception as e:
        logger.error(f"Error serving simplified layout {layout_name}: {e}")

        # Return error response with fallback
        return Response(
            {
                "success": False,
                "error": f"Failed to generate simplified layout for '{layout_name}'",
                "layout": create_predefined_layouts().get("single_column"),  # Fallback
                "source": "error_fallback",
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def simplified_layouts_list(request):
    """
    List all available simplified layouts

    Returns:
        List of available simplified layouts with metadata
    """
    try:
        predefined_layouts = create_predefined_layouts()

        # Create layout list with metadata
        layout_list = []
        for layout_name, layout_data in predefined_layouts.items():
            layout_list.append(
                {
                    "name": layout_data["name"],
                    "label": layout_data["label"],
                    "description": layout_data["description"],
                    "type": layout_data["type"],
                    "slotCount": len(layout_data["slots"]),
                    "isActive": True,
                    "source": "predefined",
                }
            )

        # Sort by label
        layout_list.sort(key=lambda x: x["label"])

        return Response(
            {
                "success": True,
                "results": layout_list,
                "count": len(layout_list),
                "api_version": "2.0",
            }
        )

    except Exception as e:
        logger.error(f"Error listing simplified layouts: {e}")
        return Response(
            {
                "success": False,
                "error": "Failed to list simplified layouts",
                "results": [],
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def simplified_layout_schema(request):
    """
    Return the JSON schema for simplified layouts

    This can be used for validation and tooling.
    """
    schema = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": "https://eceee.dev/schemas/simplified-layout.json",
        "title": "Simplified Layout Schema",
        "description": "Schema for simplified layout JSON format",
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "pattern": "^[a-z][a-z0-9_]*$",
                "description": "Unique layout identifier",
            },
            "label": {
                "type": "string",
                "minLength": 1,
                "description": "Human-readable display name",
            },
            "description": {
                "type": "string",
                "description": "Layout description for users",
            },
            "version": {
                "type": "string",
                "enum": ["2.0"],
                "description": "Schema version",
            },
            "type": {
                "type": "string",
                "enum": ["css-grid", "flexbox", "custom"],
                "description": "Layout rendering method",
            },
            "structure": {
                "type": "object",
                "description": "Layout structure definition",
                "additionalProperties": True,
            },
            "slots": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "label": {"type": "string"},
                        "description": {"type": "string"},
                        "required": {"type": "boolean"},
                        "maxWidgets": {"type": "integer", "minimum": 0},
                        "allowedWidgetTypes": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "area": {"type": "string"},
                        "className": {"type": "string"},
                        "style": {"type": "object"},
                    },
                    "required": ["name", "label"],
                },
                "minItems": 1,
                "description": "Widget slot definitions",
            },
            "css": {
                "type": "object",
                "properties": {
                    "framework": {"type": "string"},
                    "customClasses": {"type": "array", "items": {"type": "string"}},
                    "responsiveBreakpoints": {"type": "object"},
                },
                "description": "CSS and styling configuration",
            },
            "metadata": {"type": "object", "description": "Additional layout metadata"},
        },
        "required": ["name", "label", "version", "type", "structure", "slots"],
    }

    return Response({"success": True, "schema": schema, "version": "2.0"})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def validate_simplified_layout(request):
    """
    Validate a simplified layout JSON against the schema

    Body:
        layout: Layout JSON to validate

    Returns:
        Validation result with any errors
    """
    try:
        import jsonschema

        layout_data = request.data.get("layout")
        if not layout_data:
            return Response(
                {"success": False, "error": "No layout data provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get schema
        schema_response = simplified_layout_schema(request)
        schema = schema_response.data["schema"]

        # Validate
        try:
            jsonschema.validate(layout_data, schema)

            return Response(
                {"success": True, "valid": True, "message": "Layout JSON is valid"}
            )

        except jsonschema.ValidationError as e:
            return Response(
                {
                    "success": True,
                    "valid": False,
                    "errors": [
                        {
                            "path": list(e.path),
                            "message": e.message,
                            "invalid_value": e.instance,
                        }
                    ],
                }
            )

        except jsonschema.SchemaError as e:
            return Response(
                {"success": False, "error": f"Schema error: {e.message}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    except ImportError:
        return Response(
            {"success": False, "error": "jsonschema library not available"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    except Exception as e:
        logger.error(f"Error validating simplified layout: {e}")
        return Response(
            {"success": False, "error": "Validation failed"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
