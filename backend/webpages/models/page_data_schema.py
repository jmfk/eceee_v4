"""
PageDataSchema Model

Stores JSON Schema definitions for validating and driving page_data forms.
"""

from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError


class PageDataSchema(models.Model):
    """
    Stores JSON Schema definitions for validating and driving page_data forms.

    Two types:
    - system: Single base schema applied to all pages (singleton, no name needed)
    - layout: Additional schema fields for specific layouts (extends system schema)
    """

    SCOPE_SYSTEM = "system"
    SCOPE_LAYOUT = "layout"
    SCOPE_CHOICES = (
        (SCOPE_SYSTEM, "System"),
        (SCOPE_LAYOUT, "Layout"),
    )

    # name is only used for layout schemas, system schema doesn't need a name
    name = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default=SCOPE_SYSTEM)
    layout_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of the code-based layout this schema applies to (scope=layout)",
    )
    schema = models.JSONField(help_text="JSON Schema draft-07+ definition")
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT)

    class Meta:
        indexes = [
            models.Index(
                fields=["scope", "layout_name", "is_active"],
                name="pds_scope_layout_active_idx",
            ),
            models.Index(fields=["is_active"], name="pds_active_idx"),
        ]
        ordering = ["-updated_at", "name"]
        constraints = [
            # Only one active system schema allowed
            models.UniqueConstraint(
                fields=["scope"],
                condition=models.Q(scope="system", is_active=True),
                name="unique_active_system_schema",
            ),
            # Only one active layout schema per layout
            models.UniqueConstraint(
                fields=["scope", "layout_name"],
                condition=models.Q(scope="layout", is_active=True),
                name="unique_active_layout_schema",
            ),
        ]

    def clean(self):
        super().clean()
        if self.scope == self.SCOPE_SYSTEM:
            # System schema doesn't need name or layout_name
            self.name = ""
            self.layout_name = ""
        elif self.scope == self.SCOPE_LAYOUT:
            # Layout schema requires layout_name
            if not self.layout_name:
                raise ValidationError("Layout schema must specify a layout_name")
            if not self.name:
                self.name = f"{self.layout_name} Schema"

    def __str__(self):
        if self.scope == self.SCOPE_LAYOUT:
            return f"{self.layout_name} Layout Schema"
        return "System Schema"

    @classmethod
    def get_effective_schema_for_layout(cls, layout_name: str | None):
        """
        Get schemas organized as groups without merging.

        Returns a grouped schema structure:
        {
            "type": "object",
            "groups": {
                "system": {
                    "title": "System Fields",
                    "properties": {...},
                    "required": [...],
                    "property_order": [...]
                },
                "layout": {
                    "title": "Layout Fields",
                    "properties": {...},
                    "required": [...],
                    "property_order": [...]
                }
            }
        }
        """
        from django.db.models import Q

        # Get the single active system schema
        system_schema_obj = cls.objects.filter(
            scope=cls.SCOPE_SYSTEM, is_active=True
        ).first()

        layout_schema_obj = None
        if layout_name:
            layout_schema_obj = cls.objects.filter(
                scope=cls.SCOPE_LAYOUT, layout_name=layout_name, is_active=True
            ).first()

        # Build grouped schema without merging
        grouped_schema = {"type": "object", "groups": {}}

        # Add system schema as a group if it exists
        if system_schema_obj:
            system_schema = cls._normalize_schema_case(system_schema_obj.schema)
            if system_schema.get("properties"):
                grouped_schema["groups"]["system"] = {
                    "title": "System Fields",
                    "properties": system_schema["properties"],
                }
                if system_schema.get("required"):
                    grouped_schema["groups"]["system"]["required"] = system_schema[
                        "required"
                    ]
                if system_schema.get("property_order"):
                    grouped_schema["groups"]["system"]["property_order"] = (
                        system_schema["property_order"]
                    )

        # Add layout schema as a group if it exists
        if layout_schema_obj:
            layout_schema = cls._normalize_schema_case(layout_schema_obj.schema)
            if layout_schema.get("properties"):
                grouped_schema["groups"]["layout"] = {
                    "title": "Layout Fields",
                    "properties": layout_schema["properties"],
                }
                if layout_schema.get("required"):
                    grouped_schema["groups"]["layout"]["required"] = layout_schema[
                        "required"
                    ]
                if layout_schema.get("property_order"):
                    grouped_schema["groups"]["layout"]["property_order"] = (
                        layout_schema["property_order"]
                    )

        # Return None if no groups were added
        if not grouped_schema["groups"]:
            return None

        return grouped_schema

    @classmethod
    def _normalize_schema_case(cls, schema):
        """
        Convert schema properties from snake_case to camelCase for frontend compatibility.
        This ensures all schema constraints use camelCase (maxLength, minLength, etc.)
        """
        if not isinstance(schema, dict):
            return schema

        def snake_to_camel(snake_str):
            """Convert snake_case to camelCase"""
            components = snake_str.split("_")
            return components[0] + "".join(word.capitalize() for word in components[1:])

        def convert_schema_keys(obj):
            """Recursively convert schema keys to camelCase"""
            if isinstance(obj, dict):
                converted = {}
                for key, value in obj.items():
                    # Convert constraint keys to camelCase
                    if key in [
                        "max_length",
                        "min_length",
                        "max_items",
                        "min_items",
                        "exclusive_minimum",
                        "exclusive_maximum",
                        "multiple_of",
                        "unique_items",
                        "additional_properties",
                        "property_order",
                    ]:
                        new_key = snake_to_camel(key)
                        converted[new_key] = convert_schema_keys(value)
                    else:
                        converted[key] = convert_schema_keys(value)
                return converted
            elif isinstance(obj, list):
                return [convert_schema_keys(item) for item in obj]
            else:
                return obj

        return convert_schema_keys(schema)

    @classmethod
    def _camel_to_snake(cls, name):
        """Convert camelCase to snake_case"""
        import re

        # Handle the case where name is already snake_case
        if "_" in name and name.islower():
            return name
        s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()

    @classmethod
    def _snake_to_camel(cls, name):
        """Convert snake_case to camelCase"""
        if "_" not in name:
            return name
        components = name.split("_")
        return components[0] + "".join(word.capitalize() for word in components[1:])

    @classmethod
    def _convert_camel_to_snake_keys(cls, obj):
        """Keep pageData in camelCase - no conversion needed"""
        return obj
