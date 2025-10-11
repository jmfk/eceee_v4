"""
Widget Registry System for Code-Based Widget Types

This module provides the infrastructure for registering widget type classes directly in code,
enabling third-party apps to provide custom widget types without database entries.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Type, Tuple
from django.template.loader import get_template
from django.core.exceptions import ImproperlyConfigured
from django.utils.text import slugify
from pydantic import BaseModel, ValidationError
from pydantic.fields import PydanticUndefined
import logging

logger = logging.getLogger(__name__)


class BaseWidget(ABC):
    """
    Abstract base class for all widget type implementations.

    Third-party apps should subclass this to create custom widget types.
    """

    # Required class attributes that must be defined in subclasses
    name: str = None
    app_label: str | None = None
    description: str = ""
    template_name: str = "webpages/widgets/default.html"

    # Inheritance and publishing defaults
    default_inheritance_level: int = (
        0  # Default: page-specific (0 = this page only, -1 = infinite)
    )
    default_is_published: bool = True  # Default: published

    # Enhanced CSS injection system
    widget_css: str = ""  # Widget-specific CSS
    css_variables: Dict[str, str] = {}  # Widget-specific CSS variables
    css_dependencies: List[str] = []  # External CSS dependencies (URLs)
    css_scope: str = "global"  # CSS scoping: 'global', 'widget', 'slot'
    enable_css_injection: bool = True  # Whether this widget type supports CSS injection

    def __init__(self):
        if self.name is None:
            raise ImproperlyConfigured(
                f"Widget class {self.__class__.__name__} must define a 'name' attribute"
            )

    @property
    @abstractmethod
    def configuration_model(self) -> Type[BaseModel]:
        """
        Return the pydantic model class for this widget's configuration.

        Must return a pydantic BaseModel subclass that defines the
        configuration schema for this widget type.

        Example:
        class TextBlockConfig(BaseModel):
            title: Optional[str] = None
            content: str
            alignment: str = "left"

        @property
        def configuration_model(self):
            return TextBlockConfig
        """
        pass

    @property
    def is_active(self) -> bool:
        """Whether this widget type is available for use. Override to add custom logic."""
        return True

    def validate_configuration(
        self, configuration: Dict[str, Any]
    ) -> Tuple[bool, List[str]]:
        """
        Validate a configuration dictionary against this widget type's pydantic model.
        Returns (is_valid, errors) tuple.
        """
        try:
            self.configuration_model(**configuration)
            return True, []
        except ValidationError as e:
            errors = [f"{err['loc'][0]}: {err['msg']}" for err in e.errors()]
            return False, errors
        except Exception as e:
            return False, [f"Validation error: {str(e)}"]

    def get_configuration_defaults(self) -> Dict[str, Any]:
        """Extract default values from the pydantic model"""
        try:
            # Get the model fields and their defaults
            defaults = {}
            model_fields = self.configuration_model.model_fields

            for field_name, field_info in model_fields.items():
                # Check for regular default values (but exclude PydanticUndefined and Ellipsis)
                if (
                    field_info.default is not None
                    and field_info.default != ...
                    and field_info.default is not PydanticUndefined
                ):
                    defaults[field_name] = field_info.default
                # Check for default factories
                elif (
                    hasattr(field_info, "default_factory")
                    and field_info.default_factory is not None
                    and field_info.default_factory is not PydanticUndefined
                ):
                    try:
                        defaults[field_name] = field_info.default_factory()
                    except Exception:
                        # Skip if default factory fails
                        pass

            return defaults
        except Exception:
            return {}

    @classmethod
    def get_slot_definitions(cls) -> Optional[Dict[str, Dict[str, Any]]]:
        """
        Define slots provided by this container widget (if any).

        For container widgets that provide nested slots, return a dictionary
        mapping slot names to their definitions including dimensions.

        Returns:
            Dict mapping slot name to slot definition with structure:
            {
                "slot_name": {
                    "name": str,
                    "title": str,
                    "description": str,
                    "max_widgets": int,
                    "dimensions": {
                        "mobile": {"width": float|int|None, "height": float|int|None},
                        "tablet": {"width": float|int|None, "height": float|int|None},
                        "desktop": {"width": float|int|None, "height": float|int|None},
                    }
                }
            }

            Dimension values:
            - None: Unknown/dynamic dimension
            - int (e.g., 896): Absolute pixels (used in layouts)
            - float 0.0-1.0 (e.g., 0.5): Fraction of parent (used in container widgets)

        Example:
            @classmethod
            def get_slot_definitions(cls):
                return {
                    "left": {
                        "name": "left",
                        "title": "Left Column",
                        "description": "Left column content",
                        "max_widgets": 10,
                        "dimensions": {
                            "mobile": {"width": 1.0, "height": None},
                            "tablet": {"width": 0.48, "height": None},
                            "desktop": {"width": 0.48, "height": None},
                        }
                    }
                }
        """
        return None

    def get_widget_dimensions(
        self, context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Dict[str, Optional[int]]]:
        """
        Get the calculated dimensions for this widget from the rendering context.

        Args:
            context: Rendering context containing _widget_dimensions

        Returns:
            Dictionary with dimensions per breakpoint:
            {
                "mobile": {"width": 360, "height": None},
                "tablet": {"width": 768, "height": None},
                "desktop": {"width": 896, "height": None}
            }
        """
        if not context:
            return {}
        return context.get("_widget_dimensions", {})

    def calculate_nested_slot_dimensions(
        self,
        parent_dimensions: Dict[str, Dict[str, Optional[int]]],
        slot_dimensions: Dict[str, Dict[str, Optional[float]]],
    ) -> Dict[str, Dict[str, Optional[int]]]:
        """
        Calculate pixel dimensions for a nested slot based on parent widget dimensions.

        Args:
            parent_dimensions: Parent widget's dimensions in pixels per breakpoint
            slot_dimensions: Slot's dimension fractions/values per breakpoint

        Returns:
            Calculated pixel dimensions per breakpoint
        """
        result = {}

        for breakpoint in ["mobile", "tablet", "desktop"]:
            parent = parent_dimensions.get(breakpoint, {})
            slot = slot_dimensions.get(breakpoint, {})

            parent_width = parent.get("width")
            parent_height = parent.get("height")
            slot_width = slot.get("width")
            slot_height = slot.get("height")

            # Calculate width
            if parent_width and slot_width:
                if isinstance(slot_width, float) and 0 <= slot_width <= 1.0:
                    # Fraction of parent
                    calculated_width = int(parent_width * slot_width)
                else:
                    # Already absolute pixels
                    calculated_width = int(slot_width)
            else:
                calculated_width = None

            # Calculate height (if specified)
            if parent_height and slot_height:
                if isinstance(slot_height, float) and 0 <= slot_height <= 1.0:
                    calculated_height = int(parent_height * slot_height)
                else:
                    calculated_height = int(slot_height)
            else:
                calculated_height = None

            result[breakpoint] = {
                "width": calculated_width,
                "height": calculated_height,
            }

        return result

    def prepare_template_context(self, config, context=None):
        """
        Default implementation of prepare_template_context.

        Captures the widget_data['config'] data and provides full access to
        current page/object data and all inherited states.

        Override this method in widget subclasses for custom processing.

        Args:
            config: Widget configuration dictionary from widget_data['configuration']
            context: Full rendering context with page, object, and inherited data

        Returns:
            dict: Processed configuration ready for template rendering
        """
        # Start with a copy of the base configuration
        template_config = config.copy() if config else {}
        context = context if context else {}

        # Add context data access for widgets that need it
        if context:
            # Provide access to page hierarchy and inheritance
            template_config["_context"] = {
                "widget": config.get("config"),
                "page": context.get("page"),
                "current_page": context.get("current_page"),
                "page_version": context.get("page_version"),
                "page_data": context.get("page_data"),
                "parent": context.get("parent"),
                "layout": context.get("layout"),
                "theme": context.get("theme"),
                "slots": context.get("slots", []),
                "request": context.get("request"),
                "path_variables": context.get(
                    "path_variables", {}
                ),  # NEW: Add path variables
            }

            # If this is an object page, add object context
            if context.get("is_object_page"):
                template_config["_context"]["object_content"] = context.get(
                    "object_content"
                )
                template_config["_context"]["linked_object"] = context.get(
                    "linked_object"
                )

        return template_config

    def parse_configuration(self, configuration: Dict[str, Any]) -> BaseModel:
        """
        Parse and validate configuration data, returning pydantic model instance.
        Raises ValidationError if configuration is invalid.
        """
        return self.configuration_model(**configuration)

    @property
    def slug(self):
        """
        DEPRECATED: Use widget.type instead.
        Generate a URL-safe slug from the widget name.
        This property is kept for backward compatibility only.
        """
        return slugify(self.name)

    def to_dict(self, include_template_json: bool = True) -> Dict[str, Any]:
        """Convert widget type to dictionary representation.

        Args:
            include_template_json: When True, include the parsed template JSON. When False,
                omit it to reduce payload size and avoid parsing overhead.
        """
        result = {
            "type": self.type,  # Unique type id (e.g., "default_widgets.ContentWidget")
            "name": self.name,
            "description": self.description,
            "template_name": self.template_name,  # Include template name for backward compatibility
            "widget_class": self.__class__.__name__,
            "is_active": self.is_active,
            "configuration_schema": self.configuration_model.model_json_schema(),
        }

        # Include template JSON only when requested
        if include_template_json:
            template_json = self.get_template_json()
            if template_json:
                result["template_json"] = template_json

        return result

    @property
    def type(self):
        if self.app_label is None:
            module = self.__class__.__module__
            app_label = module.split(".")[0]
        else:
            app_label = self.app_label
        class_id = self.__class__.__name__
        return f"{app_label}.{class_id}"

    def get_css_for_injection(
        self, widget_instance=None, scope_id: str = None
    ) -> Dict[str, str]:
        """
        Get CSS content for injection including widget-specific styles.

        Args:
            widget_instance: Specific widget instance (for dynamic CSS)
            scope_id: CSS scope identifier for scoping

        Returns:
            Dictionary with CSS content for injection
        """
        css_data = {
            "widget_css": self.widget_css,
            "css_variables": self.css_variables.copy(),
            "css_dependencies": self.css_dependencies.copy(),
            "scope": self.css_scope,
            "scope_id": scope_id or f"widget-{self.name.lower().replace(' ', '-')}",
            "enable_injection": self.enable_css_injection,
        }

        # Allow widget instances to override CSS dynamically
        if widget_instance and hasattr(widget_instance, "get_dynamic_css"):
            dynamic_css = widget_instance.get_dynamic_css()
            if dynamic_css:
                css_data.update(dynamic_css)

        return css_data

    def validate_css_content(self) -> Tuple[bool, List[str]]:
        """
        Validate the widget's CSS content for security and syntax.

        Returns:
            Tuple of (is_valid, errors)
        """
        from .css_validation import css_injection_manager

        if not self.widget_css:
            return True, []

        is_valid, _, errors = css_injection_manager.validate_and_inject_css(
            self.widget_css, scope_type=self.css_scope, context=f"Widget: {self.name}"
        )

        return is_valid, errors

    def get_template_json(self) -> Optional[Dict[str, Any]]:
        """
        Get the JSON representation of this widget's template.

        Returns:
            Dict containing the template JSON structure, or None if parsing fails
        """
        try:
            from .utils.template_parser import WidgetSerializer

            serializer = WidgetSerializer()
            result = serializer.serialize_widget_template(self)
            return result["template_json"]
        except Exception as e:
            logger.warning(f"Failed to parse template for widget '{self.name}': {e}")
            return None


class WidgetTypeRegistry:
    """
    Global registry for widget type classes.

    Provides methods to register widget types and retrieve them by name.
    """

    def __init__(self):
        self._widgets: Dict[str, Type[BaseWidget]] = {}
        self._instances: Dict[str, BaseWidget] = {}

    def register(self, widget_class: Type[BaseWidget]) -> None:
        """
        Register a widget type class.

        Args:
            widget_class: A subclass of BaseWidget
        """
        if not issubclass(widget_class, BaseWidget):
            raise ImproperlyConfigured(
                f"Widget class {widget_class.__name__} must inherit from BaseWidget"
            )

        # Create instance to validate
        instance = widget_class()

        name = instance.name
        if name in self._widgets:
            logger.warning(
                f"Widget type '{name}' is being re-registered. Previous registration will be overwritten."
            )

        self._widgets[name] = widget_class
        self._instances[name] = instance

        logger.info(f"Registered widget type: {name}")

    def unregister(self, name: str) -> None:
        """Unregister a widget type by name."""
        if name in self._widgets:
            del self._widgets[name]
            del self._instances[name]
            logger.info(f"Unregistered widget type: {name}")

    def get_widget_type(self, name: str) -> Optional[BaseWidget]:
        """Get a widget type instance by name."""
        return self._instances.get(name)

    def get_widget_type_by_slug(self, slug: str) -> Optional[BaseWidget]:
        """
        DEPRECATED: Use get_widget_type_by_type() or get_widget_type_flexible() instead.
        Get a widget type instance by slug.
        This method is kept for backward compatibility only.
        """
        for widget in self._instances.values():
            if widget.slug == slug:
                return widget
        return None

    def get_widget_type_by_type(self, widget_type: str) -> Optional[BaseWidget]:
        """Get a widget type instance by type identifier (e.g., 'default_widgets.TextBlockWidget')."""
        for widget in self._instances.values():
            if widget.type == widget_type:
                return widget
        return None

    def get_widget_type_flexible(self, identifier: str) -> Optional[BaseWidget]:
        """
        Get a widget type instance by any identifier - tries type, then name.
        This provides backward compatibility during the transition to new naming.

        Lookup order:
        1. Exact type match (e.g., "default_widgets.ContentWidget")
        2. Case-insensitive type match
        3. Human-readable name (legacy)
        """
        if not identifier:
            return None

        # Try new format first (default_widgets.WidgetName) - exact match
        widget = self.get_widget_type_by_type(identifier)
        if widget:
            return widget

        # Try case-insensitive type match for frontend compatibility
        identifier_lower = identifier.lower()
        for widget_instance in self._instances.values():
            if widget_instance.type.lower() == identifier_lower:
                return widget_instance

        # Try old format (human name) for backward compatibility
        widget = self.get_widget_type(identifier)
        if widget:
            return widget

        return None

    def get_widget_class(self, name: str) -> Optional[Type[BaseWidget]]:
        """Get a widget type class by name."""
        return self._widgets.get(name)

    def list_widget_types(self, active_only: bool = True) -> List[BaseWidget]:
        """Get all registered widget types."""
        widgets = list(self._instances.values())
        if active_only:
            widgets = [widget for widget in widgets if widget.is_active]
        return widgets

    def get_widget_names(self, active_only: bool = True) -> List[str]:
        """Get list of all registered widget type names."""
        widgets = self.list_widget_types(active_only=active_only)
        return [widget.name for widget in widgets]

    def to_dict(
        self,
        active_only: bool = True,
        include_template_json: bool = True,
    ) -> List[Dict[str, Any]]:
        """Get all widget types as dictionary representations.

        Args:
            active_only: Whether to include only active widgets
            include_template_json: Whether to include parsed template JSON in each dict
        """
        widgets = self.list_widget_types(active_only=active_only)
        results: List[Dict[str, Any]] = []
        for widget in widgets:
            # Delegate the include_template_json behavior to the widget to avoid unnecessary parsing
            d = widget.to_dict(include_template_json=include_template_json)
            results.append(d)
        return results


# Global registry instance
widget_type_registry = WidgetTypeRegistry()


def register_widget_type(widget_class: Type[BaseWidget]) -> Type[BaseWidget]:
    """
    Decorator to register a widget type class.

    Usage:
    @register_widget_type
    class MyWidget(BaseWidget):
        name = "my_widget"
        # ... rest of implementation
    """
    widget_type_registry.register(widget_class)
    return widget_class


def get_widget_type(name: str) -> Optional[BaseWidget]:
    """Convenience function to get a widget type by name."""
    return widget_type_registry.get_widget_type(name)


def list_widget_types(active_only: bool = True) -> List[BaseWidget]:
    """Convenience function to list all widget types."""
    return widget_type_registry.list_widget_types(active_only=active_only)
