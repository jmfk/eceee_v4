"""
WidgetType ViewSet for managing code-based widget types.
"""

from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response


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
        """Get a specific widget type by name"""

        from ..widget_registry import widget_type_registry

        widget_type = widget_type_registry.get_widget_type(pk)
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

    @action(detail=True, methods=["post"], url_path="validate-configuration")
    def validate_configuration(self, request, pk=None):
        """Validate widget configuration payload for a specific widget type"""
        from ..widget_registry import widget_type_registry

        widget_type = widget_type_registry.get_widget_type(pk)
        if not widget_type:
            return Response(
                {"error": f"Widget type '{pk}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        configuration = request.data.get("configuration", {})
        is_valid, errors = widget_type.validate_configuration(configuration)
        return Response({"is_valid": is_valid, "errors": errors})

    @action(detail=True, methods=["get"], url_path="configuration-defaults")
    def configuration_defaults(self, request, pk=None):
        """Return default configuration values and schema for a widget type"""
        from ..widget_registry import widget_type_registry

        widget_type = widget_type_registry.get_widget_type(pk)
        if not widget_type:
            return Response(
                {"error": f"Widget type '{pk}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        defaults = widget_type.get_configuration_defaults()
        schema = widget_type.configuration_schema
        return Response({"defaults": defaults, "schema": schema})

    @action(detail=True, methods=["get"], url_path="schema")
    def schema(self, request, pk=None):
        """Return JSON schema for a widget type configuration"""
        from ..widget_registry import widget_type_registry

        widget_type = widget_type_registry.get_widget_type(pk)
        if not widget_type:
            return Response(
                {"error": f"Widget type '{pk}' not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(widget_type.configuration_schema)
