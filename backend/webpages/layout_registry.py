"""
Layout Registry System for Code-Based Layouts

This module provides the infrastructure for registering layout classes directly in code,
enabling third-party apps to provide custom layouts without database entries.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional, Type
from django.template.loader import get_template
from django.core.exceptions import ImproperlyConfigured
import logging

logger = logging.getLogger(__name__)


class BaseLayout(ABC):
    """
    Abstract base class for all layout implementations.

    Third-party apps should subclass this to create custom layouts.
    """

    # Required class attributes that must be defined in subclasses
    name: str = None
    description: str = ""
    template_name: str = "webpages/page_detail.html"
    css_classes: str = ""

    def __init__(self):
        if self.name is None:
            raise ImproperlyConfigured(
                f"Layout class {self.__class__.__name__} must define a 'name' attribute"
            )

    @property
    @abstractmethod
    def slot_configuration(self) -> Dict[str, Any]:
        """
        Return the slot configuration for this layout.

        Must return a dictionary with at least a 'slots' key containing
        a list of slot definitions.

        Example:
        {
            "slots": [
                {
                    "name": "header",
                    "title": "Header",
                    "description": "Main header content",
                    "max_widgets": 1,
                    "css_classes": "slot-header",
                    "default_widgets": [
                        {
                            "type": "text",
                            "config": {
                                "content": "<h1>Welcome</h1>",
                                "format": "html"
                            }
                        }
                    ]
                },
                {
                    "name": "content",
                    "title": "Main Content",
                    "description": "Primary page content",
                    "max_widgets": None,
                    "css_classes": "slot-content"
                }
            ]
        }
        """
        pass

    @property
    def is_active(self) -> bool:
        """Whether this layout is available for use. Override to add custom logic."""
        return True

    def validate_slot_configuration(self) -> None:
        """Validate that the slot configuration is properly formatted."""
        config = self.slot_configuration

        if not isinstance(config, dict):
            raise ImproperlyConfigured(
                f"Layout {self.name} slot_configuration must return a dictionary"
            )

        if "slots" not in config:
            raise ImproperlyConfigured(
                f"Layout {self.name} slot_configuration must contain a 'slots' key"
            )

        if not isinstance(config["slots"], list):
            raise ImproperlyConfigured(f"Layout {self.name} slots must be a list")

        for slot in config["slots"]:
            if not isinstance(slot, dict):
                raise ImproperlyConfigured(
                    f"Layout {self.name} each slot must be a dictionary"
                )
            if "name" not in slot:
                raise ImproperlyConfigured(
                    f"Layout {self.name} each slot must have a 'name' field"
                )

    def get_template(self):
        """Get the Django template for this layout."""
        return get_template(self.template_name)

    def to_dict(self) -> Dict[str, Any]:
        """Convert layout to dictionary representation for API serialization."""
        return {
            "name": self.name,
            "description": self.description,
            "template_name": self.template_name,
            "slot_configuration": self.slot_configuration,
            "css_classes": self.css_classes,
            "is_active": self.is_active,
            "type": "code",
        }


class LayoutRegistry:
    """
    Global registry for layout classes.

    Provides methods to register layouts and retrieve them by name.
    """

    def __init__(self):
        self._layouts: Dict[str, Type[BaseLayout]] = {}
        self._instances: Dict[str, BaseLayout] = {}

    def register(self, layout_class: Type[BaseLayout]) -> None:
        """
        Register a layout class.

        Args:
            layout_class: A subclass of BaseLayout
        """
        if not issubclass(layout_class, BaseLayout):
            raise ImproperlyConfigured(
                f"Layout class {layout_class.__name__} must inherit from BaseLayout"
            )

        # Create instance to validate and get name
        instance = layout_class()
        instance.validate_slot_configuration()

        name = instance.name
        if name in self._layouts:
            logger.warning(
                f"Layout '{name}' is being re-registered. Previous registration will be overwritten."
            )

        self._layouts[name] = layout_class
        self._instances[name] = instance

        logger.info(f"Registered layout: {name}")

        # Invalidate caches when layout changes
        self._invalidate_layout_caches(name)

    def unregister(self, name: str) -> None:
        """Unregister a layout by name."""
        if name in self._layouts:
            del self._layouts[name]
            del self._instances[name]
            logger.info(f"Unregistered layout: {name}")

            # Invalidate caches when layout is removed
            self._invalidate_layout_caches(name)

    def get_layout(self, name: str) -> Optional[BaseLayout]:
        """Get a layout instance by name."""
        return self._instances.get(name)

    def get_layout_class(self, name: str) -> Optional[Type[BaseLayout]]:
        """Get a layout class by name."""
        return self._layouts.get(name)

    def is_registered(self, name: str) -> bool:
        """Check if a layout is registered by name."""
        return name in self._layouts

    def list_layouts(self, active_only: bool = True) -> List[BaseLayout]:
        """Get all registered layouts."""
        layouts = list(self._instances.values())
        if active_only:
            layouts = [layout for layout in layouts if layout.is_active]
        return layouts

    def get_default_layout(self) -> Optional[BaseLayout]:
        """
        Get the default layout to use when no layout is specified.
        Returns the first active registered layout, or None if no layouts are registered.
        """
        active_layouts = self.list_layouts(active_only=True)
        if active_layouts:
            return active_layouts[0]
        return None

    def clear(self) -> None:
        """Clear all registered layouts."""
        self._layouts.clear()
        self._instances.clear()
        logger.info("Cleared all registered layouts")

        # Invalidate all layout caches
        self._invalidate_all_layout_caches()

    def reload(self) -> None:
        """Clear registry and trigger re-import of layouts."""
        self.clear()
        # Re-import will happen automatically when modules are re-imported

    def _invalidate_layout_caches(self, layout_name: str) -> None:
        """Invalidate all caches related to a specific layout."""
        try:
            from django.core.cache import cache

            # Clear specific layout caches
            cache_keys = [
                f"simplified_layout:{layout_name}",
                f"layout_json:{layout_name}",
                f"layout_template:{layout_name}",
            ]

            for cache_key in cache_keys:
                cache.delete(cache_key)
                logger.debug(f"Cleared cache key: {cache_key}")

            # Clear layout list caches (they contain all layouts)
            list_cache_keys = [
                "layout_registry:list_layouts:active",
                "layout_registry:list_layouts:all",
                "simplified_layouts_list",
                "layout_choices",
            ]

            for cache_key in list_cache_keys:
                cache.delete(cache_key)
                logger.debug(f"Cleared list cache key: {cache_key}")

            logger.info(f"Invalidated caches for layout: {layout_name}")

        except Exception as e:
            logger.warning(f"Failed to invalidate caches for layout {layout_name}: {e}")

    def _invalidate_all_layout_caches(self) -> None:
        """Invalidate all layout-related caches."""
        try:
            from django.core.cache import cache

            # Get all layout names for specific cache invalidation
            layout_names = list(self._layouts.keys())

            # Clear all specific layout caches
            for layout_name in layout_names:
                self._invalidate_layout_caches(layout_name)

            # Clear any remaining layout-related cache patterns
            cache_patterns = [
                "simplified_layout:*",
                "layout_json:*",
                "layout_template:*",
                "layout_registry:*",
                "simplified_layouts_list",
            ]

            # Django's cache doesn't support pattern deletion by default,
            # so we clear the entire cache as a fallback
            logger.info("Clearing entire cache due to layout registry changes")
            cache.clear()

        except Exception as e:
            logger.warning(f"Failed to invalidate all layout caches: {e}")


# Global registry instance
layout_registry = LayoutRegistry()


def register_layout(layout_class: Type[BaseLayout]) -> Type[BaseLayout]:
    """
    Decorator function to register a layout class.

    Usage:
        @register_layout
        class MyLayout(BaseLayout):
            name = "my_layout"
            # ... implementation
    """
    layout_registry.register(layout_class)
    return layout_class
