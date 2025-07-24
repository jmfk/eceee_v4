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
                    "max_widgets": 1
                },
                {
                    "name": "content",
                    "title": "Main Content",
                    "description": "Primary page content",
                    "max_widgets": None
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
            "type": "code",  # Distinguish from database layouts
        }


class TemplateBasedLayout(BaseLayout):
    """
    Enhanced layout class supporting HTML templates with automatic slot parsing.

    This class extends BaseLayout to support loading HTML templates,
    extracting CSS styles, and automatically parsing widget slots from
    data-widget-slot attributes.
    """

    # Template file path (relative to templates directory)
    template_file: str = None

    # CSS file path (optional, can use inline CSS in template)
    css_file: str = None

    def __init__(self):
        super().__init__()
        self._extracted_html = ""
        self._extracted_css = ""
        self._parsed_slots = []

        if self.template_file:
            self._parse_template()

    def _parse_template(self):
        """Parse HTML template to extract slots and CSS"""
        try:
            template_content = self._load_template_content()
            self._extracted_html = self._extract_html(template_content)
            self._extracted_css = self._extract_css(template_content)
            self._parsed_slots = self._parse_slots(template_content)
        except Exception as e:
            logger.error(
                f"Failed to parse template '{self.template_file}' for layout '{self.name}': {e}"
            )
            raise ImproperlyConfigured(
                f"Template parsing failed for layout '{self.name}': {e}"
            )

    def _load_template_content(self) -> str:
        """Load template file content"""
        try:
            template = get_template(self.template_file)
            return template.template.source
        except Exception as e:
            raise ImproperlyConfigured(
                f"Could not load template '{self.template_file}' for layout '{self.name}': {e}"
            )

    def _extract_html(self, content: str) -> str:
        """Extract HTML content, removing <style> tags"""
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(content, "html.parser")

            # Remove style tags (they'll be handled separately)
            for style_tag in soup.find_all("style"):
                style_tag.decompose()

            return str(soup)
        except ImportError:
            raise ImproperlyConfigured(
                "BeautifulSoup4 is required for template-based layouts. Install with: pip install beautifulsoup4"
            )

    def _extract_css(self, content: str) -> str:
        """Extract CSS from <style> tags"""
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(content, "html.parser")

            css_content = []
            for style_tag in soup.find_all("style"):
                css_content.append(style_tag.get_text().strip())

            return "\n".join(css_content)
        except ImportError:
            raise ImproperlyConfigured(
                "BeautifulSoup4 is required for template-based layouts. Install with: pip install beautifulsoup4"
            )

    def _parse_slots(self, content: str) -> List[Dict]:
        """Parse widget slots from data-widget-slot attributes"""
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(content, "html.parser")

            slots = []
            slot_elements = soup.find_all(attrs={"data-widget-slot": True})

            for element in slot_elements:
                slot_name = element.get("data-widget-slot")
                if not slot_name:
                    continue

                slot_data = {
                    "name": slot_name,
                    "title": element.get(
                        "data-slot-title", slot_name.replace("_", " ").title()
                    ),
                    "description": element.get(
                        "data-slot-description", f"{slot_name} content area"
                    ),
                    "max_widgets": self._parse_max_widgets(
                        element.get("data-slot-max-widgets")
                    ),
                    "css_classes": (
                        element.get("class", []) if element.get("class") else []
                    ),
                    "selector": f'[data-widget-slot="{slot_name}"]',
                }
                slots.append(slot_data)

            return slots
        except ImportError:
            raise ImproperlyConfigured(
                "BeautifulSoup4 is required for template-based layouts. Install with: pip install beautifulsoup4"
            )

    def _parse_max_widgets(self, value) -> Optional[int]:
        """Parse max widgets attribute"""
        if value is None:
            return None
        try:
            return int(value) if value != "" else None
        except (ValueError, TypeError):
            logger.warning(
                f"Invalid max_widgets value '{value}' in template '{self.template_file}'"
            )
            return None

    @property
    def slot_configuration(self) -> Dict[str, Any]:
        """Return slot configuration (implementation of abstract method)"""
        return {"slots": self._parsed_slots}

    def validate_slot_configuration(self) -> None:
        """Enhanced validation for template-based layouts"""
        super().validate_slot_configuration()

        # Additional validation for template-based layouts
        if self.template_file and not self._parsed_slots:
            logger.warning(
                f"Template '{self.template_file}' for layout '{self.name}' contains no widget slots"
            )

    def to_dict(self) -> Dict[str, Any]:
        """Enhanced dictionary representation including template data"""
        base_dict = super().to_dict()

        # Add template-specific data
        base_dict.update(
            {
                "template_based": True,
                "template_file": self.template_file,
                "has_css": bool(self._extracted_css),
                "parsed_slots_count": len(self._parsed_slots),
            }
        )

        # Include HTML and CSS if available
        if hasattr(self, "_extracted_html") and self._extracted_html:
            base_dict["html"] = self._extracted_html

        if hasattr(self, "_extracted_css") and self._extracted_css:
            base_dict["css"] = self._extracted_css

        return base_dict


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

    def unregister(self, name: str) -> None:
        """Unregister a layout by name."""
        if name in self._layouts:
            del self._layouts[name]
            del self._instances[name]
            logger.info(f"Unregistered layout: {name}")

    def get_layout(self, name: str) -> Optional[BaseLayout]:
        """Get a layout instance by name."""
        return self._instances.get(name)

    def get_layout_class(self, name: str) -> Optional[Type[BaseLayout]]:
        """Get a layout class by name."""
        return self._layouts.get(name)

    def list_layouts(self, active_only: bool = True) -> List[BaseLayout]:
        """Get all registered layouts."""
        layouts = list(self._instances.values())
        if active_only:
            layouts = [layout for layout in layouts if layout.is_active]
        return layouts

    def get_layout_choices(self, active_only: bool = True) -> List[tuple]:
        """Get layout choices for forms/admin."""
        layouts = self.list_layouts(active_only=active_only)
        return [(layout.name, layout.name) for layout in layouts]

    def is_registered(self, name: str) -> bool:
        """Check if a layout is registered."""
        return name in self._layouts

    def clear(self) -> None:
        """Clear all registered layouts (mainly for testing)."""
        self._layouts.clear()
        self._instances.clear()


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
