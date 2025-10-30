"""
General Schema System for EASY v4

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
                "component": "TextInput",  # Renamed from ui_component
                "category": "input",
                "description": "Single line text input",
                "validation_rules": {
                    "min_length": {"type": "integer", "minimum": 0},
                    "max_length": {"type": "integer", "minimum": 1},
                    "pattern": {"type": "string"},
                },
                "ui_props": {
                    "placeholder": "Enter text...",
                },
            },
            {
                "key": "textarea",
                "label": "Textarea",
                "json_schema_type": "string",
                "component": "TextareaInput",
                "category": "input",
                "description": "Multi-line text input",
                "validation_rules": {
                    "min_length": {"type": "integer", "minimum": 0},
                    "max_length": {"type": "integer", "minimum": 1},
                },
                "ui_props": {
                    "rows": 3,
                    "autoResize": False,
                },
            },
            {
                "key": "rich_text",
                "label": "Rich Text",
                "json_schema_type": "string",
                "component": "RichTextInput",  # Renamed from ui_component
                "config_component": "RichTextConfig",
                "category": "input",
                "description": "Rich text editor with formatting",
                "validation_rules": {
                    "min_length": {"type": "integer", "minimum": 0},
                    "max_length": {"type": "integer", "minimum": 1},
                },
                "ui_props": {
                    "toolbar": "basic",
                },
            },
            {
                "key": "password",
                "label": "Password",
                "json_schema_type": "string",
                "component": "PasswordInput",
                "category": "input",
                "description": "Password input with strength indicator",
                "validation_rules": {
                    "min_length": {"type": "integer", "minimum": 8},
                    "pattern": {"type": "string"},
                },
                "ui_props": {
                    "showStrengthIndicator": True,
                    "minLength": 8,
                },
            },
            {
                "key": "time",
                "label": "Time",
                "json_schema_type": "string",
                "component": "TimeInput",
                "category": "input",
                "description": "Time picker",
                "validation_rules": {"format": {"type": "string", "enum": ["time"]}},
                "ui_props": {
                    "step": 60,
                },
            },
            {
                "key": "number",
                "label": "Number",
                "json_schema_type": "number",
                "component": "NumberInput",  # Renamed from ui_component
                "category": "input",
                "description": "Numeric input",
                "validation_rules": {
                    "minimum": {"type": "number"},
                    "maximum": {"type": "number"},
                    "multipleOf": {"type": "number"},
                },
                "ui_props": {
                    "step": "any",
                },
            },
            {
                "key": "date",
                "label": "Date",
                "json_schema_type": "string",
                "component": "DateInput",  # Renamed from ui_component
                "category": "input",
                "description": "Date picker",
                "validation_rules": {"format": {"type": "string", "enum": ["date"]}},
                "ui_props": {
                    "format": "YYYY-MM-DD",
                },
            },
            {
                "key": "datetime",
                "label": "Date & Time",
                "json_schema_type": "string",
                "component": "DateTimeInput",  # Renamed from ui_component
                "category": "input",
                "description": "Date and time picker",
                "validation_rules": {
                    "format": {"type": "string", "enum": ["date-time"]}
                },
                "ui_props": {
                    "format": "YYYY-MM-DD HH:mm:ss",
                },
            },
            {
                "key": "boolean",
                "label": "Boolean",
                "json_schema_type": "boolean",
                "component": "BooleanInput",  # Renamed from ui_component
                "category": "input",
                "description": "True/false toggle",
                "validation_rules": {},
                "ui_props": {
                    "variant": "toggle",
                },
            },
            {
                "key": "image",
                "label": "Image",
                "json_schema_type": "string",
                "component": "ImageInput",  # Renamed from ui_component
                "config_component": "ImageConfig",
                "category": "media",
                "description": "Image upload and selection",
                "validation_rules": {"format": {"type": "string", "enum": ["uri"]}},
                "ui_props": {
                    "accept": "image/*",
                    "multiple": False,
                },
            },
            {
                "key": "file",
                "label": "File",
                "json_schema_type": "string",
                "component": "FileInput",  # Renamed from ui_component
                "category": "media",
                "description": "File upload",
                "validation_rules": {"format": {"type": "string", "enum": ["uri"]}},
                "ui_props": {
                    "accept": "*/*",
                    "multiple": False,
                },
            },
            {
                "key": "url",
                "label": "URL",
                "json_schema_type": "string",
                "component": "URLInput",  # Renamed from ui_component
                "category": "input",
                "description": "URL input with validation",
                "validation_rules": {"format": {"type": "string", "enum": ["uri"]}},
                "ui_props": {
                    "placeholder": "https://example.com",
                },
            },
            {
                "key": "email",
                "label": "Email",
                "json_schema_type": "string",
                "component": "EmailInput",  # Renamed from ui_component
                "category": "input",
                "description": "Email input with validation",
                "validation_rules": {"format": {"type": "string", "enum": ["email"]}},
                "ui_props": {
                    "placeholder": "user@example.com",
                },
            },
            {
                "key": "choice",
                "label": "Choice",
                "json_schema_type": "string",
                "component": "SelectInput",  # Renamed from ui_component
                "config_component": "SelectConfig",
                "category": "selection",
                "description": "Single choice from predefined options",
                "validation_rules": {
                    "enum": {"type": "array", "items": {"type": "string"}}
                },
                "ui_props": {
                    "placeholder": "Select an option...",
                },
            },
            {
                "key": "multi_choice",
                "label": "Multiple Choice",
                "json_schema_type": "array",
                "component": "MultiSelectInput",  # Renamed from ui_component
                "config_component": "MultiSelectConfig",
                "category": "selection",
                "description": "Multiple choices from predefined options",
                "validation_rules": {
                    "items": {
                        "type": "object",
                        "properties": {"enum": {"type": "array"}},
                    },
                    "uniqueItems": {"type": "boolean"},
                },
                "ui_props": {
                    "placeholder": "Select options...",
                },
            },
            {
                "key": "user_reference",
                "label": "User Reference",
                "json_schema_type": "integer",
                "component": "UserSelectorInput",  # Renamed from ui_component
                "config_component": "UserSelectorConfig",
                "category": "reference",
                "description": "Reference to a user",
                "validation_rules": {},
                "ui_props": {
                    "searchable": True,
                },
            },
            {
                "key": "object_reference",
                "label": "Object Reference",
                "json_schema_type": "integer",
                "component": "ObjectSelectorInput",  # Renamed from ui_component
                "config_component": "ObjectSelectorConfig",
                "category": "reference",
                "description": "Reference to another object",
                "validation_rules": {"objectType": {"type": "string"}},
                "ui_props": {
                    "searchable": True,
                },
            },
            # Advanced field types
            {
                "key": "color",
                "label": "Color Picker",
                "json_schema_type": "string",
                "component": "ColorInput",
                "config_component": "ColorConfig",
                "category": "input",
                "description": "Color picker with presets and eyedropper",
                "validation_rules": {
                    "pattern": {"type": "string"},
                    "format": {"type": "string", "enum": ["color"]},
                },
                "ui_props": {
                    "format": "hex",
                    "showPresets": True,
                    "showEyeDropper": True,
                },
            },
            {
                "key": "slider",
                "label": "Slider",
                "json_schema_type": "number",
                "component": "SliderInput",
                "config_component": "SliderConfig",
                "category": "input",
                "description": "Range slider with visual feedback",
                "validation_rules": {
                    "minimum": {"type": "number"},
                    "maximum": {"type": "number"},
                    "multipleOf": {"type": "number"},
                },
                "ui_props": {
                    "min": 0,
                    "max": 100,
                    "step": 1,
                    "showValue": True,
                },
            },
            {
                "key": "tags",
                "label": "Tags",
                "json_schema_type": "array",
                "component": "TagInput",
                "config_component": "TagConfig",
                "category": "selection",
                "description": "Tag input with autocomplete and creation",
                "validation_rules": {
                    "items": {"type": "string"},
                    "uniqueItems": {"type": "boolean"},
                    "maxItems": {"type": "integer"},
                },
                "ui_props": {
                    "allowCreate": True,
                    "tagColors": True,
                    "maxTags": 10,
                },
            },
            {
                "key": "date_range",
                "label": "Date Range",
                "json_schema_type": "object",
                "component": "DateRangeInput",
                "config_component": "DateRangeConfig",
                "category": "input",
                "description": "Date range picker with presets",
                "validation_rules": {
                    "properties": {
                        "start": {"type": "string", "format": "date"},
                        "end": {"type": "string", "format": "date"},
                    },
                    "required": ["start", "end"],
                },
                "ui_props": {
                    "allowSameDate": True,
                    "showPresets": True,
                },
            },
            # Special interactive field types
            {
                "key": "command_palette",
                "label": "Command Palette",
                "json_schema_type": "string",
                "component": "CommandPaletteInput",
                "config_component": "CommandPaletteConfig",
                "category": "special",
                "description": "Global fuzzy-searchable command palette",
                "validation_rules": {},
                "ui_props": {
                    "showCategories": True,
                    "maxResults": 10,
                },
            },
            {
                "key": "combobox",
                "label": "Combobox",
                "json_schema_type": "string",
                "component": "ComboboxInput",
                "config_component": "ComboboxConfig",
                "category": "special",
                "description": "Async search combobox with creatable options",
                "validation_rules": {},
                "ui_props": {
                    "allowCreate": True,
                    "searchDebounce": 300,
                },
            },
            {
                "key": "mentions",
                "label": "Mentions & Hashtags",
                "json_schema_type": "string",
                "component": "MentionsInput",
                "config_component": "MentionsConfig",
                "category": "special",
                "description": "Text input with @mentions and #hashtags",
                "validation_rules": {},
                "ui_props": {
                    "mentionStyle": "highlight",
                    "rows": 4,
                },
            },
            {
                "key": "cascader",
                "label": "Tree Select",
                "json_schema_type": "array",
                "component": "CascaderInput",
                "config_component": "CascaderConfig",
                "category": "special",
                "description": "Hierarchical tree selection",
                "validation_rules": {
                    "items": {"type": "string"},
                },
                "ui_props": {
                    "multiple": False,
                    "showSearch": True,
                },
            },
            {
                "key": "transfer",
                "label": "Transfer List",
                "json_schema_type": "array",
                "component": "TransferInput",
                "config_component": "TransferConfig",
                "category": "special",
                "description": "Dual listbox for item transfer",
                "validation_rules": {
                    "items": {"type": "string"},
                    "uniqueItems": {"type": "boolean"},
                },
                "ui_props": {
                    "searchable": True,
                    "showSelectAll": True,
                    "height": 300,
                },
            },
            # Advanced UI pattern field types
            {
                "key": "rule_builder",
                "label": "Rule Builder",
                "json_schema_type": "object",
                "component": "RuleBuilderInput",
                "config_component": "RuleBuilderConfig",
                "category": "special",
                "description": "Visual if/and/or filter builder",
                "validation_rules": {},
                "ui_props": {
                    "maxDepth": 3,
                    "showPreview": True,
                },
            },
            {
                "key": "reorderable_list",
                "label": "Reorderable List",
                "json_schema_type": "array",
                "component": "ReorderableInput",
                "config_component": "ReorderableConfig",
                "category": "special",
                "description": "Drag-and-drop sortable list",
                "validation_rules": {
                    "items": {"type": "string"},
                },
                "ui_props": {
                    "allowAdd": True,
                    "allowRemove": True,
                    "allowReorder": True,
                },
            },
            {
                "key": "rating",
                "label": "Rating",
                "json_schema_type": "number",
                "component": "RatingInput",
                "config_component": "RatingConfig",
                "category": "input",
                "description": "Star rating with custom icons",
                "validation_rules": {
                    "minimum": {"type": "number", "minimum": 0},
                    "maximum": {"type": "number", "maximum": 10},
                },
                "ui_props": {
                    "max": 5,
                    "icon": "star",
                    "allowClear": True,
                },
            },
            {
                "key": "segmented_control",
                "label": "Segmented Control",
                "json_schema_type": "string",
                "component": "SegmentedControlInput",
                "config_component": "SegmentedControlConfig",
                "category": "selection",
                "description": "iOS-style segmented control",
                "validation_rules": {
                    "enum": {"type": "array", "items": {"type": "string"}},
                },
                "ui_props": {
                    "variant": "default",
                    "size": "md",
                },
            },
            {
                "key": "numeric_stepper",
                "label": "Numeric Stepper",
                "json_schema_type": "number",
                "component": "NumericStepperInput",
                "config_component": "NumericStepperConfig",
                "category": "input",
                "description": "Enhanced number input with steppers",
                "validation_rules": {
                    "minimum": {"type": "number"},
                    "maximum": {"type": "number"},
                    "multipleOf": {"type": "number"},
                },
                "ui_props": {
                    "step": 1,
                    "showSteppers": True,
                    "precision": 0,
                },
            },
            {
                "key": "object_type_selector",
                "label": "Object Type Selector",
                "json_schema_type": "array",
                "component": "ObjectTypeSelectorInput",
                "config_component": "ObjectTypeSelectorConfig",
                "category": "reference",
                "description": "Select object type(s) from the system",
                "validation_rules": {
                    "items": {"type": "integer"},
                },
                "ui_props": {
                    "multiple": True,
                },
            },
            {
                "key": "object_reference",
                "label": "Object Reference",
                "json_schema_type": "array",  # array for multiple, integer for single
                "component": "ObjectReferenceInput",
                "config_component": "ObjectReferenceConfig",
                "category": "reference",
                "description": "Reference to other object instances with configurable constraints",
                "validation_rules": {
                    "multiple": {"type": "boolean"},
                    "max_items": {"type": "integer", "minimum": 1},
                    "allowed_object_types": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "relationship_type": {"type": "string"},
                },
                "ui_props": {
                    "multiple": False,
                    "max_items": None,
                    "allowed_object_types": [],
                    "show_search": True,
                    "allow_direct_pk": True,
                },
            },
            {
                "key": "reverse_object_reference",
                "label": "Reverse Object Reference",
                "json_schema_type": "array",
                "component": "ReverseObjectReferenceDisplay",
                "config_component": "ReverseObjectReferenceConfig",
                "category": "reference",
                "description": "Read-only display of reverse relationships from other objects",
                "read_only": True,
                "validation_rules": {
                    "reverse_relationship_type": {"type": "string"},
                    "reverse_object_types": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "ui_props": {
                    "reverse_object_types": [],
                    "show_count": True,
                    "link_to_objects": True,
                },
            },
        ]

        for field_type in core_types:
            self.register_field_type(**field_type)

    def register_field_type(
        self,
        key: str,
        label: str,
        json_schema_type: str,
        component: str,
        description: str = "",
        validation_rules: Dict = None,
        category: str = "input",
        config_component: Optional[str] = None,
        ui_props: Dict = None,
        **kwargs,
    ):
        """Register a new field type"""
        self._field_types[key] = {
            "key": key,
            "label": label,
            "json_schema_type": json_schema_type,
            "component": component,  # Renamed from ui_component
            "category": category,
            "config_component": config_component,
            "description": description,
            "validation_rules": validation_rules or {},
            "ui_props": ui_props or {},
            **kwargs,
        }

    def get_field_type(self, key: str) -> Optional[Dict[str, Any]]:
        """Get field type definition"""
        return self._field_types.get(key)

    def get_field_type_by_component(self, component: str) -> Optional[Dict[str, Any]]:
        """Get field type definition by component name"""
        for field_type in self._field_types.values():
            if field_type["component"] == component:
                return field_type
        return None

    def get_all_field_types(self) -> Dict[str, Dict[str, Any]]:
        """Get all registered field types"""
        return self._field_types.copy()

    def get_field_types_choices(self) -> List[Tuple[str, str]]:
        """Get field types as Django choices"""
        return [(key, info["label"]) for key, info in self._field_types.items()]

    def is_valid_field_type(self, key: str) -> bool:
        """Check if field type is registered"""
        return key in self._field_types

    def is_valid_component(self, component: str) -> bool:
        """Check if component name is registered"""
        return any(ft["component"] == component for ft in self._field_types.values())


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

        # Check for either field_type or component
        if "field_type" not in prop_def and "component" not in prop_def:
            raise ValidationError(
                f"Property '{prop_name}' must have either a 'field_type' or 'component' field"
            )

        # If field_type is present, validate it
        if "field_type" in prop_def:
            if not field_registry.is_valid_field_type(prop_def["field_type"]):
                valid_types = list(field_registry.get_all_field_types().keys())
                raise ValidationError(
                    f"Invalid field_type '{prop_def['field_type']}' for property '{prop_name}'. "
                    f"Valid types: {', '.join(valid_types)}"
                )

            # Get field type info from registry
            field_type_info = field_registry.get_field_type(prop_def["field_type"])
            expected_type = field_type_info["json_schema_type"]

        # If component is present, validate it
        elif "component" in prop_def:
            if not field_registry.is_valid_component(prop_def["component"]):
                raise ValidationError(
                    f"Invalid component '{prop_def['component']}' for property '{prop_name}'"
                )

            # Get field type info from registry by component
            field_type_info = field_registry.get_field_type_by_component(
                prop_def["component"]
            )
            expected_type = field_type_info["json_schema_type"]

        # Validate that type matches expected JSON Schema type
        if prop_def["type"] != expected_type:
            raise ValidationError(
                f"Property '{prop_name}' has type '{prop_def['type']}' but expects type '{expected_type}'"
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
    return field_info["component"] if field_info else "TextInput"


def register_custom_field_type(
    key: str,
    label: str,
    json_schema_type: str,
    component: str,
    description: str = "",
    validation_rules: Dict = None,
    category: str = "input",
    config_component: Optional[str] = None,
    ui_props: Dict = None,
    **kwargs,
) -> None:
    """
    Register a new custom field type

    Usage:
        register_custom_field_type(
            key='color',
            label='Color Picker',
            json_schema_type='string',
            component='ColorPicker',
            category='input',
            description='Color selection with picker',
            validation_rules={'pattern': '^#[0-9A-Fa-f]{6}$'},
            ui_props={'format': 'hex'}
        )
    """
    field_registry.register_field_type(
        key=key,
        label=label,
        json_schema_type=json_schema_type,
        component=component,
        category=category,
        config_component=config_component,
        description=description,
        validation_rules=validation_rules or {},
        ui_props=ui_props or {},
        **kwargs,
    )


def get_all_field_types() -> Dict[str, Dict[str, Any]]:
    """Get all registered field types"""
    return field_registry.get_all_field_types()


def get_field_types_for_django_choices() -> List[Tuple[str, str]]:
    """Get field types formatted for Django model choices"""
    return field_registry.get_field_types_choices()


def validate_object_reference(value: Any, field_config: Dict[str, Any]) -> None:
    """
    Validate object_reference field values.

    Args:
        value: The field value (int for single, list of ints for multiple)
        field_config: Field configuration from schema

    Raises:
        ValidationError: If validation fails
    """
    from object_storage.models import ObjectInstance, ObjectTypeDefinition

    # Get configuration
    multiple = field_config.get("multiple", False)
    max_items = field_config.get("max_items")
    allowed_types = field_config.get("allowed_object_types", [])

    # Handle None/empty values
    if value is None or value == [] or value == "":
        if field_config.get("required", False):
            raise ValidationError("This field is required")
        return

    # Normalize to list
    if not multiple:
        if not isinstance(value, (int, str)):
            raise ValidationError("Single reference must be an integer ID")
        value = [int(value)]
    else:
        if not isinstance(value, list):
            raise ValidationError("Multiple references must be a list of IDs")
        value = [int(v) if isinstance(v, str) else v for v in value]

    # Validate max_items
    if max_items and len(value) > max_items:
        raise ValidationError(
            f"Cannot have more than {max_items} references (got {len(value)})"
        )

    # Validate each reference
    for ref_id in value:
        if not isinstance(ref_id, int):
            raise ValidationError(f"Reference ID must be integer, got {type(ref_id)}")

        # Check object exists
        try:
            obj = ObjectInstance.objects.get(id=ref_id)
        except ObjectInstance.DoesNotExist:
            raise ValidationError(f"Referenced object with ID {ref_id} does not exist")

        # Check allowed types
        if allowed_types:
            if obj.object_type.name not in allowed_types:
                raise ValidationError(
                    f"Object type '{obj.object_type.name}' is not allowed. "
                    f"Allowed types: {', '.join(allowed_types)}"
                )


def validate_reverse_object_reference(value: Any, field_config: Dict[str, Any]) -> None:
    """
    Validate reverse_object_reference field values.

    This field is read-only and computed, so validation is minimal.

    Args:
        value: The field value (ignored, as it's computed)
        field_config: Field configuration from schema

    Raises:
        ValidationError: If trying to set value on read-only field
    """
    # Reverse references are read-only and computed
    # They should not be validated or set by users
    # If value is present and not None, it means someone tried to set it
    if value is not None and value != []:
        raise ValidationError(
            "Reverse object reference fields are read-only and cannot be set directly"
        )
