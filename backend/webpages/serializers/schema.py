# Copyright (C) 2025 Johan Mats Fred Karlsson
#
# This file is part of easy_v4.
#
# This program is licensed under the Server Side Public License, version 1,
# as published by MongoDB, Inc. See the LICENSE file for details.

"""
Schema serializers for the Web Page Publishing System
"""

from rest_framework import serializers
from ..models import PageDataSchema
from .base import UserSerializer


class PageDataSchemaSerializer(serializers.ModelSerializer):
    """Serializer for page data JSON Schemas (system and layout scopes)."""

    created_by = UserSerializer(read_only=True)
    layout_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True, allow_null=True
    )

    def to_internal_value(self, data):
        # Ensure layout_name is present for field validation
        if "layout_name" not in data:
            data = data.copy() if hasattr(data, "copy") else dict(data)
            data["layout_name"] = ""

        # Schema field is kept in camelCase - no conversion needed
        return super().to_internal_value(data)

    def to_representation(self, instance):
        """Schema field is already in camelCase - no conversion needed"""
        data = super().to_representation(instance)
        return data

    class Meta:
        model = PageDataSchema
        fields = [
            "id",
            "name",
            "description",
            "scope",
            "layout_name",
            "schema",
            "is_active",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by"]

    def validate(self, data):
        # Handle system vs layout scope constraints
        scope = data.get("scope", getattr(self.instance, "scope", None))

        if scope == PageDataSchema.SCOPE_SYSTEM:
            # For system schemas, clear layout_name and name fields (like model.clean())
            data["layout_name"] = ""
            data["name"] = ""
        elif scope == PageDataSchema.SCOPE_LAYOUT:
            # For layout schemas, layout_name is required
            layout_name = data.get(
                "layout_name", getattr(self.instance, "layout_name", "")
            )
            if not layout_name:
                raise serializers.ValidationError(
                    {"layout_name": "Layout name is required for layout scope"}
                )
        else:
            # Default layout_name to empty string if not provided
            if "layout_name" not in data:
                data["layout_name"] = ""

        # Validate JSON Schema correctness using jsonschema library
        try:
            from jsonschema import Draft202012Validator, Draft7Validator

            schema = data.get("schema", getattr(self.instance, "schema", {}))
            # Try latest first, fall back to draft-07
            try:
                Draft202012Validator.check_schema(schema)
            except Exception:
                Draft7Validator.check_schema(schema)
        except Exception as e:
            raise serializers.ValidationError(
                {"schema": f"Invalid JSON Schema: {str(e)}"}
            )

        return data

