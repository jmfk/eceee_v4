"""
WidgetType ViewSet for managing code-based widget types.
"""

import json
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from pydantic import ValidationError


def format_pydantic_errors(pydantic_errors):
    """
    Format Pydantic validation errors into a user-friendly structure.

    Args:
        pydantic_errors: List of error dictionaries from Pydantic ValidationError

    Returns:
        dict: Formatted errors grouped by field name
    """
    formatted_errors = {}

    for error in pydantic_errors:
        field_name = error["loc"][0] if error["loc"] else "root"
        error_message = error["msg"]
        error_type = error["type"]

        # Create user-friendly error messages
        if error_type == "missing":
            message = f"This field is required"
        elif error_type == "string_too_short":
            min_length = error.get("ctx", {}).get("limit_value", "specified")
            message = f"Must be at least {min_length} characters long"
        elif error_type == "string_too_long":
            max_length = error.get("ctx", {}).get("limit_value", "specified")
            message = f"Must be no more than {max_length} characters long"
        elif error_type == "value_error":
            message = error_message
        elif error_type == "type_error":
            expected_type = error.get("ctx", {}).get("expected_type", "valid value")
            message = f"Expected {expected_type}"
        else:
            message = error_message

        if field_name not in formatted_errors:
            formatted_errors[field_name] = []
        formatted_errors[field_name].append(message)

    return formatted_errors


class WidgetTypeViewSet(viewsets.ViewSet):
    """ViewSet for code-based widget types."""

    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        """List all registered widget types"""
        from ..widget_registry import widget_type_registry

        active_only = request.query_params.get("active", "true").lower() == "true"
        include_template_json = (
            request.query_params.get("include_template_json", "true").lower() == "true"
        )
        widget_types = widget_type_registry.to_dict(
            active_only=active_only, include_template_json=include_template_json
        )

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
        """Get a specific widget type by slug or name"""

        from ..widget_registry import widget_type_registry

        # Try to find by slug first, then by name
        widget_type = widget_type_registry.get_widget_type_by_slug(
            pk
        ) or widget_type_registry.get_widget_type(pk)
        if not widget_type:
            return Response(
                {"error": f"Widget type '{pk}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        include_template_json = (
            request.query_params.get("include_template_json", "true").lower() == "true"
        )
        data = widget_type.to_dict(include_template_json=include_template_json)
        return Response(data)

    @action(detail=False, methods=["get"])
    def active(self, request):
        """Get only active widget types"""
        from ..widget_registry import widget_type_registry

        include_template_json = (
            request.query_params.get("include_template_json", "true").lower() == "true"
        )
        active_types = widget_type_registry.to_dict(
            active_only=True, include_template_json=include_template_json
        )
        return Response(active_types)

    @action(detail=True, methods=["post"], url_path="validate")
    def validate_widget_config(self, request, pk=None):
        """Validate widget configuration using Pydantic models"""
        from ..widget_registry import widget_type_registry

        print("validate_widget_config", pk)

        # Try to find by slug first, then by name
        widget_type = widget_type_registry.get_widget_type_by_slug(
            pk
        ) or widget_type_registry.get_widget_type(pk)
        if not widget_type:
            return Response(
                {"error": f"Widget type '{pk}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        widget_data = request.data.get("widget_data", {})

        try:
            # Use Pydantic model for validation
            validated_config = widget_type.configuration_model(**widget_data)
            return Response(
                {
                    "is_valid": True,
                    "errors": {},
                    "warnings": {},
                    "validated_data": validated_config.model_dump(),
                }
            )
        except ValidationError as e:
            return Response(
                {
                    "is_valid": False,
                    "errors": format_pydantic_errors(e.errors()),
                    "warnings": {},
                    "raw_errors": e.errors(),  # Include raw errors for debugging
                }
            )
        except Exception as e:
            return Response(
                {"error": f"Validation failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get"], url_path="configuration-defaults")
    def configuration_defaults(self, request, pk=None):
        """Return default configuration values and schema for a widget type"""
        from ..widget_registry import widget_type_registry

        # Try to find by slug first, then by name
        widget_type = widget_type_registry.get_widget_type_by_slug(
            pk
        ) or widget_type_registry.get_widget_type(pk)
        if not widget_type:
            return Response(
                {"error": f"Widget type '{pk}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        defaults = widget_type.get_configuration_defaults()
        schema = widget_type.configuration_model.model_json_schema()
        return Response({"defaults": defaults, "schema": schema})

    @action(detail=True, methods=["get"], url_path="schema")
    def schema(self, request, pk=None):
        """Return JSON schema for a widget type configuration"""
        from ..widget_registry import widget_type_registry

        # Try to find by slug first, then by name
        widget_type = widget_type_registry.get_widget_type_by_slug(
            pk
        ) or widget_type_registry.get_widget_type(pk)
        if not widget_type:
            return Response(
                {"error": f"Widget type '{pk}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(widget_type.configuration_model.model_json_schema())
