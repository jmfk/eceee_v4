"""
PageDataSchema ViewSet for CRUD operations on page data JSON Schemas.
"""

import json
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

        # Schema is already in camelCase - no conversion needed

        return Response({"layout_name": layout_name, "schema": schema})

    @action(detail=False, methods=["post"], url_path="validate")
    def validate_data(self, request):
        """Validate page data against database schemas (system and layout)."""
        from rest_framework import status
        from jsonschema import Draft202012Validator, Draft7Validator, ValidationError

        data = request.data
        page_data = data.get("page_data", {})
        layout_name = data.get("layout_name")

        # pageData remains in camelCase - no conversion needed
        from ..models import PageDataSchema

        # Use pageData directly without conversion
        validated_page_data = page_data if page_data else {}
        if not page_data:
            return Response(
                {"error": "page_data is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        if not layout_name:
            return Response(
                {"error": "layout_name is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get effective schema from database (combines system and layout schemas)
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

        # Perform group-by-group validation
        validation_result = {
            "is_valid": True,
            "errors": {},
            "warnings": {},
            "schema_used": schema,  # Return the original grouped schema to the frontend
            "group_validation": {},  # Track validation results per group
        }

        all_properties = set()  # Track all valid properties across groups

        if schema.get("groups"):
            for group_key, group_data in schema["groups"].items():
                group_result = self._validate_group(
                    group_key, group_data, validated_page_data
                )
                validation_result["group_validation"][group_key] = group_result
                # Collect properties from this group
                if group_data.get("properties"):
                    all_properties.update(group_data["properties"].keys())

                # If any group is invalid, overall validation is invalid
                if not group_result["is_valid"]:
                    validation_result["is_valid"] = False

                # Merge group errors into overall errors
                for prop, prop_errors in group_result["errors"].items():
                    if prop not in validation_result["errors"]:
                        validation_result["errors"][prop] = []
                    validation_result["errors"][prop].extend(prop_errors)

        # Check for additional properties not in any group
        if all_properties:
            data_properties = (
                set(validated_page_data.keys())
                if isinstance(validated_page_data, dict)
                else set()
            )
            extra_properties = data_properties - all_properties

            if extra_properties and schema.get("additionalProperties") is False:
                # Properties are already in camelCase - no conversion needed
                validation_result["warnings"]["_additional"] = [
                    f"Additional properties not allowed: {', '.join(extra_properties)}"
                ]
            elif extra_properties:
                # Properties are already in camelCase - no conversion needed
                validation_result["warnings"]["_additional"] = [
                    f"Properties not defined in schema: {', '.join(extra_properties)}"
                ]

        # Error property names are already in camelCase - no conversion needed

        return Response(validation_result)

    def _validate_group(self, group_key, group_data, validated_page_data):
        """Validate data against a specific group's schema."""
        from jsonschema import Draft202012Validator, Draft7Validator

        # group_data already contains the complete schema for this group
        group_schema = {"type": "object", **group_data}

        group_result = {
            "is_valid": True,
            "errors": {},
            "group_name": group_data.get("title", group_key.title()),
        }

        try:
            # Validate group schema structure
            try:
                Draft202012Validator.check_schema(group_schema)
                validator = Draft202012Validator(group_schema)
            except Exception:
                Draft7Validator.check_schema(group_schema)
                validator = Draft7Validator(group_schema)
            # Extract only the properties that belong to this group from the data
            group_properties = group_schema.get("properties", {}).keys()
            group_data_subset = {
                key: value
                for key, value in validated_page_data.items()
                if key in group_properties
            }

            # Validate the group's data subset
            errors = []
            for error in validator.iter_errors(group_data_subset):
                errors.append(
                    {
                        "property": (
                            ".".join(str(p) for p in error.absolute_path)
                            if error.absolute_path
                            else "_root"
                        ),
                        "message": error.message,
                        "constraint": error.validator,
                        "invalid_value": error.instance,
                    }
                )

            if errors:
                group_result["is_valid"] = False
                # Group errors by property
                for error in errors:
                    prop = error["property"]
                    if prop not in group_result["errors"]:
                        group_result["errors"][prop] = []
                    group_result["errors"][prop].append(
                        {
                            "message": error["message"],
                            "constraint": error["constraint"],
                            "invalid_value": error["invalid_value"],
                        }
                    )

        except Exception as e:
            group_result["is_valid"] = False
            group_result["errors"]["_group"] = [
                {
                    "message": f"Group validation failed: {str(e)}",
                    "constraint": "validation_error",
                    "invalid_value": None,
                }
            ]

        return group_result
