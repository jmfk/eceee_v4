"""
General Schema System for ECEEE v4

Provides a reusable, extensible schema system that can be used across:
- Object Type schemas
- Page Data schemas
- Widget schemas
- Any other dynamic schema needs

Features:
- Extensible field type registry
- JSON Schema foundation with custom field types
- Consistent validation across all schema types
- Easy to add new field types
"""

from typing import Dict, List, Any, Optional, Tuple
from django.core.exceptions import ValidationError
import re


class FieldTypeRegistry:
    """Registry for managing field types across the application"""

    def __init__(self):
        self._field_types: Dict[str, Dict[str, Any]] = {}
        self._register_core_types()

    def _register_core_types(self):
        """Register the core field types that are always available"""
        core_types = [
            {
                "key": "text",
                "label": "Text",
                "json_schema_type": "string",
                "ui_component": "TextInput",
                "description": "Single line text input",
                "validation_rules": {
                    "min_length": {"type": "integer", "minimum": 0},
                    "max_length": {"type": "integer", "minimum": 1},
                    "pattern": {"type": "string"},
                },
            },
            {
                "key": "rich_text",
                "label": "Rich Text",
                "json_schema_type": "string",
                "ui_component": "RichTextEditor",
                "description": "Rich text editor with formatting",
                "validation_rules": {
                    "min_length": {"type": "integer", "minimum": 0},
                    "max_length": {"type": "integer", "minimum": 1},
                },
            },
            {
                "key": "number",
                "label": "Number",
                "json_schema_type": "number",
                "ui_component": "NumberInput",
                "description": "Numeric input",
                "validation_rules": {
                    "minimum": {"type": "number"},
                    "maximum": {"type": "number"},
                    "multipleOf": {"type": "number"},
                },
            },
            {
                "key": "date",
                "label": "Date",
                "json_schema_type": "string",
                "ui_component": "DatePicker",
                "description": "Date picker",
                "validation_rules": {"format": {"type": "string", "enum": ["date"]}},
            },
            {
                "key": "datetime",
                "label": "Date & Time",
                "json_schema_type": "string",
                "ui_component": "DateTimePicker",
                "description": "Date and time picker",
                "validation_rules": {
                    "format": {"type": "string", "enum": ["date-time"]}
                },
            },
            {
                "key": "boolean",
                "label": "Boolean",
                "json_schema_type": "boolean",
                "ui_component": "ToggleInput",
                "description": "True/false toggle",
                "validation_rules": {},
            },
            {
                "key": "image",
                "label": "Image",
                "json_schema_type": "string",
                "ui_component": "ImageUpload",
                "description": "Image upload and selection",
                "validation_rules": {"format": {"type": "string", "enum": ["uri"]}},
            },
            {
                "key": "file",
                "label": "File",
                "json_schema_type": "string",
                "ui_component": "FileUpload",
                "description": "File upload",
                "validation_rules": {"format": {"type": "string", "enum": ["uri"]}},
            },
            {
                "key": "url",
                "label": "URL",
                "json_schema_type": "string",
                "ui_component": "URLInput",
                "description": "URL input with validation",
                "validation_rules": {"format": {"type": "string", "enum": ["uri"]}},
            },
            {
                "key": "email",
                "label": "Email",
                "json_schema_type": "string",
                "ui_component": "EmailInput",
                "description": "Email input with validation",
                "validation_rules": {"format": {"type": "string", "enum": ["email"]}},
            },
            {
                "key": "choice",
                "label": "Choice",
                "json_schema_type": "string",
                "ui_component": "SelectInput",
                "description": "Single choice from predefined options",
                "validation_rules": {
                    "enum": {"type": "array", "items": {"type": "string"}}
                },
            },
            {
                "key": "multi_choice",
                "label": "Multiple Choice",
                "json_schema_type": "array",
                "ui_component": "MultiSelectInput",
                "description": "Multiple choices from predefined options",
                "validation_rules": {
                    "items": {
                        "type": "object",
                        "properties": {"enum": {"type": "array"}},
                    },
                    "uniqueItems": {"type": "boolean"},
                },
            },
            {
                "key": "user_reference",
                "label": "User Reference",
                "json_schema_type": "integer",
                "ui_component": "UserSelector",
                "description": "Reference to a user",
                "validation_rules": {},
            },
            {
                "key": "object_reference",
                "label": "Object Reference",
                "json_schema_type": "integer",
                "ui_component": "ObjectSelector",
                "description": "Reference to another object",
                "validation_rules": {"objectType": {"type": "string"}},
            },
        ]

        for field_type in core_types:
            self.register_field_type(**field_type)

    def register_field_type(
        self,
        key: str,
        label: str,
        json_schema_type: str,
        ui_component: str,
        description: str = "",
        validation_rules: Dict = None,
        **kwargs,
    ):
        """Register a new field type"""
        self._field_types[key] = {
            "key": key,
            "label": label,
            "json_schema_type": json_schema_type,
            "ui_component": ui_component,
            "description": description,
            "validation_rules": validation_rules or {},
            **kwargs,
        }

    def get_field_type(self, key: str) -> Optional[Dict[str, Any]]:
        """Get field type definition"""
        return self._field_types.get(key)

    def get_all_field_types(self) -> Dict[str, Dict[str, Any]]:
        """Get all registered field types"""
        return self._field_types.copy()

    def get_field_types_choices(self) -> List[Tuple[str, str]]:
        """Get field types as Django choices"""
        return [(key, info["label"]) for key, info in self._field_types.items()]

    def is_valid_field_type(self, key: str) -> bool:
        """Check if field type is registered"""
        return key in self._field_types


# Global field type registry instance
field_registry = FieldTypeRegistry()


class SchemaValidator:
    """General schema validator for all schema types in the application"""

    @staticmethod
    def validate_property_name(name: str) -> bool:
        """Validate property name format"""
        # Must start with letter, then letters/numbers/underscores
        return bool(re.match(r"^[a-zA-Z][a-zA-Z0-9_]*$", name))

    @staticmethod
    def validate_schema_structure(
        schema: Dict[str, Any], schema_type: str = "general"
    ) -> None:
        """
        Validate general schema structure

        Args:
            schema: The schema to validate
            schema_type: Type of schema ('object_type', 'page_data', 'widget', 'general')
        """
        if not isinstance(schema, dict):
            raise ValidationError("Schema must be a JSON object")

        # Validate required fields
        if "type" not in schema or schema["type"] != "object":
            raise ValidationError("Schema must have type 'object'")

        if "properties" not in schema:
            raise ValidationError("Schema must contain a 'properties' object")

        if not isinstance(schema["properties"], dict):
            raise ValidationError("Schema 'properties' must be an object")

        # Validate optional arrays
        if "required" in schema and not isinstance(schema["required"], list):
            raise ValidationError("Schema 'required' must be an array")

        if "propertyOrder" in schema and not isinstance(schema["propertyOrder"], list):
            raise ValidationError("Schema 'propertyOrder' must be an array")

        # Validate each property
        for prop_name, prop_def in schema["properties"].items():
            SchemaValidator._validate_property(prop_name, prop_def)

        # Validate references
        SchemaValidator._validate_references(schema)

    @staticmethod
    def _validate_property(prop_name: str, prop_def: Dict[str, Any]) -> None:
        """Validate individual property definition"""
        if not SchemaValidator.validate_property_name(prop_name):
            raise ValidationError(
                f"Property name '{prop_name}' is invalid. Names must start with a letter "
                f"and contain only letters, numbers, and underscores."
            )

        if not isinstance(prop_def, dict):
            raise ValidationError(f"Property '{prop_name}' must be an object")

        # Validate required fields
        if "type" not in prop_def:
            raise ValidationError(f"Property '{prop_name}' must have a 'type' field")

        if "field_type" not in prop_def:
            raise ValidationError(
                f"Property '{prop_name}' must have a 'field_type' field"
            )

        # Validate field type is registered
        if not field_registry.is_valid_field_type(prop_def["field_type"]):
            valid_types = list(field_registry.get_all_field_types().keys())
            raise ValidationError(
                f"Invalid field_type '{prop_def['field_type']}' for property '{prop_name}'. "
                f"Valid types: {', '.join(valid_types)}"
            )

        # Validate that type matches field_type's expected JSON Schema type
        field_type_info = field_registry.get_field_type(prop_def["field_type"])
        expected_type = field_type_info["json_schema_type"]

        if prop_def["type"] != expected_type:
            raise ValidationError(
                f"Property '{prop_name}' has type '{prop_def['type']}' but field_type "
                f"'{prop_def['field_type']}' expects type '{expected_type}'"
            )

    @staticmethod
    def _validate_references(schema: Dict[str, Any]) -> None:
        """Validate that required and propertyOrder reference existing properties"""
        property_names = set(schema["properties"].keys())

        # Validate required array
        for req_prop in schema.get("required", []):
            if req_prop not in property_names:
                raise ValidationError(
                    f"Required property '{req_prop}' not found in properties"
                )

        # Validate propertyOrder array
        for ordered_prop in schema.get("propertyOrder", []):
            if ordered_prop not in property_names:
                raise ValidationError(
                    f"PropertyOrder property '{ordered_prop}' not found in properties"
                )


def validate_schema(schema: Dict[str, Any], schema_type: str = "general") -> None:
    """
    Main function to validate any schema in the application

    Args:
        schema: The schema dictionary to validate
        schema_type: Type of schema for context-specific validation

    Raises:
        ValidationError: If schema is invalid
    """
    SchemaValidator.validate_schema_structure(schema, schema_type)


def get_ui_component_for_field_type(field_type: str) -> str:
    """Get the UI component name for a field type"""
    field_info = field_registry.get_field_type(field_type)
    return field_info["ui_component"] if field_info else "TextInput"


def register_custom_field_type(
    key: str,
    label: str,
    json_schema_type: str,
    ui_component: str,
    description: str = "",
    validation_rules: Dict = None,
    **kwargs,
) -> None:
    """
    Register a new custom field type

    Usage:
        register_custom_field_type(
            key='color',
            label='Color Picker',
            json_schema_type='string',
            ui_component='ColorPicker',
            description='Color selection with picker',
            validation_rules={'pattern': '^#[0-9A-Fa-f]{6}$'}
        )
    """
    field_registry.register_field_type(
        key=key,
        label=label,
        json_schema_type=json_schema_type,
        ui_component=ui_component,
        description=description,
        validation_rules=validation_rules or {},
        **kwargs,
    )


def get_all_field_types() -> Dict[str, Dict[str, Any]]:
    """Get all registered field types"""
    return field_registry.get_all_field_types()


def get_field_types_for_django_choices() -> List[Tuple[str, str]]:
    """Get field types formatted for Django model choices"""
    return field_registry.get_field_types_choices()
