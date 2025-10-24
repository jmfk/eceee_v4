"""
WidgetType ViewSet for managing code-based widget types.
"""

import json
import importlib
import inspect
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import (
    action,
    api_view,
    permission_classes as dec_permission_classes,
)
from rest_framework.response import Response
from pydantic import ValidationError, BaseModel
from pydantic.fields import PydanticUndefined


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

        # Try flexible lookup: type, name, or slug
        widget_type = widget_type_registry.get_widget_type_flexible(pk)
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

        # Try flexible lookup: type, name, or slug
        widget_type = widget_type_registry.get_widget_type_flexible(pk)
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

        # Try flexible lookup: type, name, or slug
        widget_type = widget_type_registry.get_widget_type_flexible(pk)
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

        # Try flexible lookup: type, name, or slug
        widget_type = widget_type_registry.get_widget_type_flexible(pk)
        if not widget_type:
            return Response(
                {"error": f"Widget type '{pk}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(widget_type.configuration_model.model_json_schema())

    @action(detail=True, methods=["get"], url_path="config-ui-schema")
    def config_ui_schema(self, request, pk=None):
        """
        Return enhanced configuration schema with UI metadata for building forms.
        Includes field-level json_schema_extra data for UI component mapping.
        """
        from ..widget_registry import widget_type_registry

        # Try flexible lookup: type, name, or slug
        widget_type = widget_type_registry.get_widget_type_flexible(pk)
        if not widget_type:
            return Response(
                {"error": f"Widget type '{pk}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get the base JSON schema
        base_schema = widget_type.configuration_model.model_json_schema()

        # Check if widget type wants to hide form fields (special editor only)
        hide_form_fields = getattr(widget_type, "hide_config_form_fields", False)

        # Extract field-level metadata from Pydantic model (skip if hiding form fields)
        fields_metadata = {}
        if not hide_form_fields:
            model_fields = widget_type.configuration_model.model_fields

            for field_name, field_info in model_fields.items():
                field_meta = {
                    "name": field_name,
                    "type": (
                        field_info.annotation.__name__
                        if hasattr(field_info.annotation, "__name__")
                        else str(field_info.annotation)
                    ),
                    "required": field_info.is_required(),
                    "default": (
                        None
                        if field_info.default is None
                        or field_info.default == ...
                        or field_info.default is PydanticUndefined
                        else field_info.default
                    ),
                    "description": field_info.description or "",
                }

                # Extract json_schema_extra metadata (UI hints)
                if field_info.json_schema_extra:
                    if isinstance(field_info.json_schema_extra, dict):
                        field_meta["ui"] = field_info.json_schema_extra
                    elif callable(field_info.json_schema_extra):
                        # If it's a function, call it with the schema dict
                        extra_dict = {}
                        field_info.json_schema_extra(extra_dict, field_info)
                        field_meta["ui"] = extra_dict

                # Add validation constraints from the schema
                if (
                    "properties" in base_schema
                    and field_name in base_schema["properties"]
                ):
                    prop_schema = base_schema["properties"][field_name]
                    if "minimum" in prop_schema:
                        field_meta["minimum"] = prop_schema["minimum"]
                    if "maximum" in prop_schema:
                        field_meta["maximum"] = prop_schema["maximum"]
                    if "minLength" in prop_schema:
                        field_meta["minLength"] = prop_schema["minLength"]
                    if "maxLength" in prop_schema:
                        field_meta["maxLength"] = prop_schema["maxLength"]
                    if "pattern" in prop_schema:
                        field_meta["pattern"] = prop_schema["pattern"]
                    if "enum" in prop_schema:
                        field_meta["enum"] = prop_schema["enum"]
                    if "minItems" in prop_schema:
                        field_meta["minItems"] = prop_schema["minItems"]
                    if "maxItems" in prop_schema:
                        field_meta["maxItems"] = prop_schema["maxItems"]
                    if "items" in prop_schema:
                        field_meta["items"] = prop_schema["items"]

                fields_metadata[field_name] = field_meta

        # Get default values
        defaults = widget_type.get_configuration_defaults()

        response_data = {
            "widget_type": widget_type.type,
            "widget_name": widget_type.name,
            "schema": base_schema,
            "fields": fields_metadata,
            "defaults": defaults,
            "required": base_schema.get("required", []),
        }

        # Add flag if form fields should be hidden
        if hide_form_fields:
            response_data["hideFormFields"] = True

        return Response(response_data)


def find_pydantic_model(model_name: str):
    """
    Find a Pydantic model by name across all widget modules.

    Searches through:
    - default_widgets.widgets
    - eceee_widgets.widgets
    - Any other registered widget modules

    Args:
        model_name: Name of the Pydantic model class (e.g., "PageSectionConfig")

    Returns:
        The Pydantic model class, or None if not found
    """
    from ..widget_registry import widget_type_registry

    # Get all registered widget modules
    widget_modules = set()
    for widget_type in widget_type_registry.list_widget_types(active_only=False):
        # Get the module where the widget is defined
        widget_module = widget_type.__class__.__module__
        # Extract the app and widgets path (e.g., "default_widgets.widgets")
        if ".widgets." in widget_module:
            base_module = widget_module.rsplit(".", 1)[0]
            widget_modules.add(base_module)

    # Also add common widget module paths
    widget_modules.update(
        [
            # "default_widgets.widgets",
            "eceee_widgets.widgets",
        ]
    )

    # Search each module for the model
    for module_path in widget_modules:
        try:
            module = importlib.import_module(module_path)
            # Check if the module has submodules (e.g., navigation, content, etc.)
            if hasattr(module, "__path__"):
                # It's a package, search through all submodules
                import pkgutil

                for importer, modname, ispkg in pkgutil.iter_modules(module.__path__):
                    try:
                        submodule = importlib.import_module(f"{module_path}.{modname}")
                        if hasattr(submodule, model_name):
                            obj = getattr(submodule, model_name)
                            # Verify it's a Pydantic model
                            if inspect.isclass(obj) and issubclass(obj, BaseModel):
                                return obj
                    except (ImportError, AttributeError):
                        continue
            # Also check the module itself
            if hasattr(module, model_name):
                obj = getattr(module, model_name)
                if inspect.isclass(obj) and issubclass(obj, BaseModel):
                    return obj
        except (ImportError, AttributeError):
            continue

    return None


@api_view(["GET"])
@dec_permission_classes([permissions.IsAuthenticated])
def pydantic_model_schema(request, model_name):
    """
    API endpoint to fetch a Pydantic model's JSON schema by model name.

    This is used by ConditionalGroupField to dynamically fetch schemas
    for referenced config models.

    Usage:
        GET /api/v1/webpages/pydantic-models/PageSectionConfig/schema/

    Returns:
        JSON schema for the Pydantic model, including json_schema_extra metadata
    """
    model_class = find_pydantic_model(model_name)

    if model_class is None:
        return Response(
            {
                "error": f"Pydantic model '{model_name}' not found",
                "detail": "Model must be defined in a widget module and be a subclass of BaseModel",
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        schema = model_class.model_json_schema()
        return Response({"model_name": model_name, "schema": schema})
    except Exception as e:
        return Response(
            {
                "error": f"Failed to generate schema for '{model_name}'",
                "detail": str(e),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
