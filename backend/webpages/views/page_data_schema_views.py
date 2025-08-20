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

        # Convert field names in required and propertyOrder to camelCase
        if schema and schema.get("groups"):
            clean_schema = schema.copy()

            # Convert field names in required, propertyOrder, and property keys to camelCase
            if "groups" in clean_schema:
                for group_key, group_data in clean_schema["groups"].items():
                    # Convert property keys to camelCase
                    if "properties" in group_data:
                        camel_properties = {}
                        for prop_key, prop_def in group_data["properties"].items():
                            camel_key = PageDataSchema._snake_to_camel(prop_key)
                            # Also convert property definition field names to camelCase
                            camel_prop_def = {}
                            for def_key, def_value in prop_def.items():
                                camel_def_key = PageDataSchema._snake_to_camel(def_key)
                                camel_prop_def[camel_def_key] = def_value
                            camel_properties[camel_key] = camel_prop_def
                        clean_schema["groups"][group_key][
                            "properties"
                        ] = camel_properties

                    # Convert required field names to camelCase
                    if "required" in group_data:
                        clean_schema["groups"][group_key]["required"] = [
                            PageDataSchema._snake_to_camel(field)
                            for field in group_data["required"]
                        ]

                    # Convert propertyOrder field names to camelCase
                    if "propertyOrder" in group_data:
                        clean_schema["groups"][group_key]["propertyOrder"] = [
                            PageDataSchema._snake_to_camel(field)
                            for field in group_data["propertyOrder"]
                        ]

            return Response({"layout_name": layout_name, "schema": clean_schema})

        return Response({"layout_name": layout_name, "schema": schema})

    @action(detail=False, methods=["post"], url_path="validate")
    def validate_data(self, request):
        """Validate page data against database schemas (system and layout)."""
        from rest_framework import status
        from jsonschema import Draft202012Validator, Draft7Validator, ValidationError

        data = request.data
        page_data = data.get("page_data", {})
        layout_name = data.get("layout_name")

        # Convert camelCase page_data to snake_case for backend validation
        from ..models import PageDataSchema

        converted_page_data = (
            PageDataSchema._convert_camel_to_snake_keys(page_data) if page_data else {}
        )
        import json

        print("converted_page_data", json.dumps(converted_page_data, indent=2))
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
                print("group_data", group_data)
                group_result = self._validate_group(
                    group_key, group_data, converted_page_data
                )
                validation_result["group_validation"][group_key] = group_result
                print(group_key, "group_result", group_result)
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
                set(converted_page_data.keys())
                if isinstance(converted_page_data, dict)
                else set()
            )
            extra_properties = data_properties - all_properties

            if extra_properties and schema.get("additionalProperties") is False:
                # Convert property names back to camelCase for frontend
                camel_extra = [
                    PageDataSchema._snake_to_camel(prop) for prop in extra_properties
                ]
                validation_result["warnings"]["_additional"] = [
                    f"Additional properties not allowed: {', '.join(camel_extra)}"
                ]
            elif extra_properties:
                # Convert property names back to camelCase for frontend
                camel_extra = [
                    PageDataSchema._snake_to_camel(prop) for prop in extra_properties
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

        return Response(validation_result)

    def _validate_group(self, group_key, group_data, converted_page_data):
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
            print("group_schema", json.dumps(group_schema, indent=2))
            # Extract only the properties that belong to this group from the data
            group_properties = group_schema.get("properties", {}).keys()
            group_data_subset = {
                key: value
                for key, value in converted_page_data.items()
                if key in group_properties
            }
            print("group_properties", group_properties)
            print("group_data_subset", group_data_subset)

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
