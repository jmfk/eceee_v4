"""
PageDataSchema ViewSet for CRUD operations on page data JSON Schemas.
"""

from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from ..models import PageDataSchema
from ..serializers import PageDataSchemaSerializer


class PageDataSchemaViewSet(viewsets.ModelViewSet):
    """CRUD for page data JSON Schemas with filter support."""

    queryset = PageDataSchema.objects.all()
    serializer_class = PageDataSchemaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["scope", "layout_name", "is_active", "name"]
    search_fields = ["name", "description", "layout_name"]
    ordering_fields = ["updated_at", "created_at", "name"]
    ordering = ["-updated_at"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="effective")
    def effective(self, request):
        """Return the effective schema for a given layout name (query param: layout_name)."""
        layout_name = request.query_params.get("layout_name")
        schema = PageDataSchema.get_effective_schema_for_layout(layout_name)
        return Response({"layout_name": layout_name, "schema": schema})

    @action(detail=False, methods=["post"], url_path="validate")
    def validate_data(self, request):
        """Validate page data against a schema."""
        from rest_framework import status
        from jsonschema import Draft202012Validator, Draft7Validator, ValidationError

        data = request.data
        page_data = data.get("page_data", {})
        layout_name = data.get("layout_name")
        schema = data.get("schema")  # Optional: provide schema directly

        # Convert camelCase page_data to snake_case for backend validation
        from ..models import PageDataSchema

        converted_page_data = (
            PageDataSchema._convert_camel_to_snake_keys(page_data) if page_data else {}
        )

        if not page_data:
            return Response(
                {"error": "page_data is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get effective schema if not provided
        if not schema:
            if not layout_name:
                return Response(
                    {"error": "Either schema or layout_name is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            schema = PageDataSchema.get_effective_schema_for_layout(layout_name)

        if not schema:
            return Response(
                {
                    "is_valid": True,
                    "errors": {},
                    "warnings": {"_general": ["No schema found - validation skipped"]},
                    "message": "No schema configured for validation",
                }
            )

        # Perform validation
        validation_result = {
            "is_valid": True,
            "errors": {},
            "warnings": {},
            "schema_used": schema,
        }

        try:
            # Validate schema structure first
            try:
                Draft202012Validator.check_schema(schema)
                validator = Draft202012Validator(schema)
            except Exception:
                Draft7Validator.check_schema(schema)
                validator = Draft7Validator(schema)

            # Validate the data (use converted snake_case data for validation)
            errors = []
            for error in validator.iter_errors(converted_page_data):
                errors.append(
                    {
                        "property": (
                            ".".join(str(p) for p in error.absolute_path)
                            if error.absolute_path
                            else "_root"
                        ),
                        "message": error.message,
                        "invalid_value": error.instance,
                        "schema_path": (
                            ".".join(str(p) for p in error.schema_path)
                            if error.schema_path
                            else ""
                        ),
                        "constraint": error.validator,
                        "constraint_value": error.validator_value,
                    }
                )

            if errors:
                validation_result["is_valid"] = False
                # Group errors by property
                for error in errors:
                    prop = error["property"]
                    if prop not in validation_result["errors"]:
                        validation_result["errors"][prop] = []
                    validation_result["errors"][prop].append(
                        {
                            "message": error["message"],
                            "constraint": error["constraint"],
                            "invalid_value": error["invalid_value"],
                        }
                    )

            # Check for additional properties not in schema
            if schema.get("properties"):
                schema_properties = set(schema["properties"].keys())
                data_properties = (
                    set(converted_page_data.keys())
                    if isinstance(converted_page_data, dict)
                    else set()
                )
                extra_properties = data_properties - schema_properties

                if extra_properties and schema.get("additionalProperties") is False:
                    # Convert property names back to camelCase for frontend
                    camel_extra = [
                        PageDataSchema._snake_to_camel(prop)
                        for prop in extra_properties
                    ]
                    validation_result["warnings"]["_additional"] = [
                        f"Additional properties not allowed: {', '.join(camel_extra)}"
                    ]
                elif extra_properties:
                    # Convert property names back to camelCase for frontend
                    camel_extra = [
                        PageDataSchema._snake_to_camel(prop)
                        for prop in extra_properties
                    ]
                    validation_result["warnings"]["_additional"] = [
                        f"Properties not defined in schema: {', '.join(camel_extra)}"
                    ]

            # Convert error property names back to camelCase for frontend
            if validation_result["errors"]:
                camel_errors = {}
                for prop, errors in validation_result["errors"].items():
                    if prop == "_root":
                        camel_errors[prop] = errors
                    else:
                        # Convert snake_case property name back to camelCase
                        camel_prop = PageDataSchema._snake_to_camel(prop)
                        camel_errors[camel_prop] = errors
                validation_result["errors"] = camel_errors

        except Exception as e:
            return Response(
                {"error": f"Validation failed: {str(e)}", "is_valid": False},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(validation_result)
