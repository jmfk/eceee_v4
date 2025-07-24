"""
Widget Registry System for Code-Based Widget Types

This module provides the infrastructure for registering widget type classes directly in code,
enabling third-party apps to provide custom widget types without database entries.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Type, Tuple
from django.template.loader import get_template
from django.core.exceptions import ImproperlyConfigured
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
    description: str = ""
    template_name: str = "webpages/widgets/default.html"

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

    def parse_configuration(self, configuration: Dict[str, Any]) -> BaseModel:
        """
        Parse and validate configuration data, returning pydantic model instance.
        Raises ValidationError if configuration is invalid.
        """
        return self.configuration_model(**configuration)

    def to_dict(self) -> Dict[str, Any]:
        """Convert widget type to dictionary representation"""
        return {
            "name": self.name,
            "description": self.description,
            "template_name": self.template_name,
            "is_active": self.is_active,
            "configuration_schema": self.configuration_model.model_json_schema(),
        }

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

    def to_dict(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get all widget types as dictionary representations."""
        widgets = self.list_widget_types(active_only=active_only)
        return [widget.to_dict() for widget in widgets]


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
