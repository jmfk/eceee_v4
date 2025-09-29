"""
Simplified Layout Serializer - Generate clean, React-friendly layout JSON

This serializer converts Django layout templates to simplified JSON format
that eliminates Django template processing complexity and is optimized
for React/JavaScript frontend consumption.
"""

import logging
import re
from typing import Dict, List, Any, Optional
from django.template.loader import get_template
from bs4 import BeautifulSoup
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)


class SimplifiedLayoutSerializer:
    """
    Convert layout templates to simplified JSON format optimized for React frontend

    This serializer eliminates Django template complexity and creates clean,
    declarative layout definitions that can be processed directly by React.
    """

    def __init__(self):
        self.cache_timeout = getattr(
            settings, "SIMPLIFIED_LAYOUT_CACHE_TIMEOUT", 3600
        )  # 1 hour

    def serialize_layout(self, layout_name: str) -> Dict[str, Any]:
        """
        Convert a layout template to simplified JSON format

        Args:
            layout_name: Name of the layout (e.g., 'sidebar_layout')

        Returns:
            Dict containing simplified layout JSON
        """
        # Check cache first
        cache_key = f"simplified_layout:{layout_name}"
        cached_result = cache.get(cache_key)
        if cached_result:
            logger.debug(f"Simplified layout cache hit for {layout_name}")
            return cached_result

        try:
            # Load and parse the template
            # Get the layout from registry to get the correct template path
            from ..layout_registry import layout_registry
            layout_instance = layout_registry.get_layout(layout_name)
            if not layout_instance:
                raise ValueError(f"Layout '{layout_name}' not found in registry")
            template_name = layout_instance.template_name
            template = get_template(template_name)
            template_source = template.template.source

            # Parse template to extract layout information
            layout_info = self._parse_template_structure(template_source)

            # Create simplified layout JSON
            simplified_layout = {
                "name": layout_name,
                "label": self._generate_label(layout_name),
                "description": self._extract_description(template_source),
                "version": "2.0",
                "type": self._detect_layout_type(template_source),
                "structure": self._create_structure_definition(layout_info),
                "slots": self._extract_slot_definitions(layout_info),
                "css": self._extract_css_configuration(layout_info),
                "metadata": {
                    "source": "django_template",
                    "template_name": template_name,
                    "generated_at": self._get_timestamp(),
                },
            }

            # Cache the result
            cache.set(cache_key, simplified_layout, self.cache_timeout)
            logger.info(f"Generated simplified layout JSON for {layout_name}")

            return simplified_layout

        except Exception as e:
            logger.error(f"Error generating simplified layout for {layout_name}: {e}")
            # Return fallback layout
            return self._create_fallback_layout(layout_name, str(e))

    def _parse_template_structure(self, template_source: str) -> Dict[str, Any]:
        """Parse template HTML to extract structure information"""
        try:
            # Remove Django template tags for parsing
            cleaned_source = self._clean_django_template_tags(template_source)

            # Parse with BeautifulSoup
            soup = BeautifulSoup(cleaned_source, "html.parser")

            # Extract layout information
            layout_info = {
                "root_element": None,
                "slots": [],
                "css_classes": [],
                "grid_structure": None,
                "flex_structure": None,
            }

            # Find the main content block
            content_block = soup.find(
                "div", class_=lambda x: x and ("grid" in x or "flex" in x)
            )
            if content_block:
                layout_info["root_element"] = content_block
                layout_info["css_classes"] = content_block.get("class", [])

                # Detect grid or flexbox structure
                if any("grid" in cls for cls in layout_info["css_classes"]):
                    layout_info["grid_structure"] = self._parse_grid_structure(
                        content_block
                    )
                elif any("flex" in cls for cls in layout_info["css_classes"]):
                    layout_info["flex_structure"] = self._parse_flex_structure(
                        content_block
                    )

            # Extract widget slots
            slot_elements = soup.find_all(attrs={"data-widget-slot": True})
            for slot_element in slot_elements:
                slot_info = self._extract_slot_info(slot_element)
                layout_info["slots"].append(slot_info)

            return layout_info

        except Exception as e:
            logger.error(f"Error parsing template structure: {e}")
            return {"slots": [], "css_classes": []}

    def _clean_django_template_tags(self, template_source: str) -> str:
        """Remove Django template tags for HTML parsing"""
        # Remove {% %} tags
        cleaned = re.sub(r"{%.*?%}", "", template_source, flags=re.DOTALL)

        # Remove {{ }} variables
        cleaned = re.sub(r"{{.*?}}", "", cleaned, flags=re.DOTALL)

        # Remove {# #} comments
        cleaned = re.sub(r"{#.*?#}", "", cleaned, flags=re.DOTALL)

        return cleaned

    def _detect_layout_type(self, template_source: str) -> str:
        """Detect the layout type (css-grid, flexbox, custom)"""
        if "grid-cols" in template_source or "grid-template" in template_source:
            return "css-grid"
        elif "flex" in template_source:
            return "flexbox"
        else:
            return "custom"

    def _parse_grid_structure(self, element) -> Dict[str, Any]:
        """Parse CSS Grid structure from element classes"""
        classes = element.get("class", [])
        grid_structure = {"display": "grid", "gap": "1.5rem", "padding": "1.5rem"}

        # Parse Tailwind grid classes
        for cls in classes:
            if cls.startswith("grid-cols-"):
                # Convert Tailwind grid-cols to CSS
                if "grid-cols-1" in cls:
                    grid_structure["gridTemplateColumns"] = "1fr"
                elif "grid-cols-2" in cls:
                    grid_structure["gridTemplateColumns"] = "1fr 1fr"
                elif "grid-cols-3" in cls:
                    grid_structure["gridTemplateColumns"] = "1fr 1fr 1fr"
                elif "[2fr_1fr]" in cls:
                    grid_structure["gridTemplateColumns"] = "2fr 1fr"

            elif cls.startswith("gap-"):
                gap_map = {
                    "gap-4": "1rem",
                    "gap-5": "1.25rem",
                    "gap-6": "1.5rem",
                    "gap-8": "2rem",
                }
                grid_structure["gap"] = gap_map.get(cls, "1.5rem")

            elif cls.startswith("p-"):
                padding_map = {
                    "p-4": "1rem",
                    "p-5": "1.25rem",
                    "p-6": "1.5rem",
                    "p-8": "2rem",
                }
                grid_structure["padding"] = padding_map.get(cls, "1.5rem")

        return grid_structure

    def _parse_flex_structure(self, element) -> Dict[str, Any]:
        """Parse Flexbox structure from element classes"""
        classes = element.get("class", [])
        flex_structure = {"display": "flex", "flexDirection": "column", "gap": "1.5rem"}

        for cls in classes:
            if "flex-row" in cls:
                flex_structure["flexDirection"] = "row"
            elif "flex-col" in cls:
                flex_structure["flexDirection"] = "column"

        return flex_structure

    def _extract_slot_info(self, slot_element) -> Dict[str, Any]:
        """Extract slot information from slot element"""
        slot_info = {
            "name": slot_element.get("data-widget-slot"),
            "label": slot_element.get("data-slot-title", ""),
            "description": slot_element.get("data-slot-description", ""),
            "maxWidgets": self._parse_int_attr(
                slot_element.get("data-slot-max-widgets")
            ),
            "required": slot_element.get("data-slot-required", "false").lower()
            == "true",
            "allowedWidgetTypes": self._parse_allowed_widget_types(slot_element),
            "className": " ".join(slot_element.get("class", [])),
            "style": self._extract_inline_styles(slot_element),
        }

        # Detect grid area from classes or position
        if slot_element.parent and "grid" in str(slot_element.parent.get("class", [])):
            slot_info["area"] = self._detect_grid_area(slot_element)

        return slot_info

    def _parse_allowed_widget_types(self, slot_element) -> List[str]:
        """Extract allowed widget types from slot element or default to all"""
        # For now, allow all core widgets - can be enhanced later
        return [
            "core_widgets.ContentWidget",
            "core_widgets.ImageWidget",
            "core_widgets.TableWidget",
            "core_widgets.HeaderWidget",
            "core_widgets.FooterWidget",
            "core_widgets.NavigationWidget",
        ]

    def _detect_grid_area(self, slot_element) -> str:
        """Detect CSS grid area for slot element"""
        slot_name = slot_element.get("data-widget-slot")

        # Map common slot names to grid areas
        area_map = {
            "header": "header",
            "main": "main",
            "sidebar": "sidebar",
            "sidebar-top": "sidebar",
            "sidebar-middle": "sidebar",
            "sidebar-bottom": "sidebar",
            "footer": "footer",
        }

        return area_map.get(slot_name, slot_name)

    def _create_structure_definition(
        self, layout_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create structure definition from parsed layout info"""
        if layout_info.get("grid_structure"):
            return layout_info["grid_structure"]
        elif layout_info.get("flex_structure"):
            return layout_info["flex_structure"]
        else:
            # Default single column structure
            return {
                "display": "flex",
                "flexDirection": "column",
                "gap": "2rem",
                "maxWidth": "1024px",
                "margin": "0 auto",
                "padding": "2rem",
            }

    def _extract_slot_definitions(
        self, layout_info: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Extract and clean slot definitions"""
        slots = layout_info.get("slots", [])

        # Ensure required fields and clean data
        cleaned_slots = []
        for slot in slots:
            if slot.get("name"):
                cleaned_slot = {
                    "name": slot["name"],
                    "label": slot.get("label")
                    or slot["name"].replace("_", " ").title(),
                    "description": slot.get(
                        "description", f"Content area for {slot['name']}"
                    ),
                    "required": slot.get("required", False),
                    "maxWidgets": slot.get("maxWidgets", 10),
                    "allowedWidgetTypes": slot.get("allowedWidgetTypes", ["*"]),
                    "className": slot.get("className", ""),
                    "style": slot.get("style", {}),
                    "area": slot.get("area", slot["name"]),
                }
                cleaned_slots.append(cleaned_slot)

        return cleaned_slots

    def _extract_css_configuration(self, layout_info: Dict[str, Any]) -> Dict[str, Any]:
        """Extract CSS configuration from layout info"""
        return {
            "framework": "tailwind",
            "customClasses": layout_info.get("css_classes", []),
            "responsiveBreakpoints": {
                "mobile": {"maxWidth": "640px", "gridTemplateColumns": "1fr"},
                "tablet": {"maxWidth": "1024px"},
            },
        }

    def _extract_description(self, template_source: str) -> str:
        """Extract description from template comments"""
        # Look for description in template comments
        desc_match = re.search(
            r"<!--\s*Description:\s*(.*?)\s*-->", template_source, re.IGNORECASE
        )
        if desc_match:
            return desc_match.group(1).strip()

        # Fallback description
        return "Layout template converted to simplified JSON format"

    def _generate_label(self, layout_name: str) -> str:
        """Generate human-readable label from layout name"""
        return layout_name.replace("_", " ").replace("-", " ").title()

    def _parse_int_attr(self, value: str) -> Optional[int]:
        """Parse integer attribute value"""
        if not value:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    def _extract_inline_styles(self, element) -> Dict[str, Any]:
        """Extract inline styles from element"""
        style_attr = element.get("style", "")
        if not style_attr:
            return {}

        # Parse simple CSS properties
        styles = {}
        for prop in style_attr.split(";"):
            if ":" in prop:
                key, value = prop.split(":", 1)
                styles[key.strip()] = value.strip()

        return styles

    def _get_timestamp(self) -> str:
        """Get current timestamp for metadata"""
        from datetime import datetime

        return datetime.now().isoformat()

    def _create_fallback_layout(
        self, layout_name: str, error_message: str
    ) -> Dict[str, Any]:
        """Create fallback layout when parsing fails"""
        return {
            "name": layout_name,
            "label": self._generate_label(layout_name),
            "description": f"Fallback layout for {layout_name}",
            "version": "2.0",
            "type": "flexbox",
            "structure": {
                "display": "flex",
                "flexDirection": "column",
                "gap": "2rem",
                "maxWidth": "1024px",
                "margin": "0 auto",
                "padding": "2rem",
            },
            "slots": [
                {
                    "name": "main",
                    "label": "Main Content",
                    "description": "Primary content area",
                    "required": true,
                    "maxWidgets": 10,
                    "allowedWidgetTypes": ["*"],
                    "className": "main-slot",
                    "style": {
                        "backgroundColor": "#ffffff",
                        "padding": "2rem",
                        "borderRadius": "0.75rem",
                        "border": "1px solid #e5e7eb",
                    },
                }
            ],
            "css": {"framework": "tailwind", "customClasses": ["layout-fallback"]},
            "metadata": {
                "source": "fallback",
                "error": error_message,
                "generated_at": self._get_timestamp(),
            },
        }


def create_predefined_layouts() -> Dict[str, Dict[str, Any]]:
    """
    Create predefined simplified layouts for common use cases

    These layouts are optimized for React rendering and eliminate
    Django template complexity entirely.
    """

    layouts = {}

    # Single Column Layout
    layouts["single_column"] = {
        "name": "single_column",
        "label": "Single Column",
        "description": "Simple single column layout for articles and content",
        "version": "2.0",
        "type": "flexbox",
        "structure": {
            "display": "flex",
            "flexDirection": "column",
            "gap": "2rem",
            "maxWidth": "1024px",
            "margin": "0 auto",
            "padding": "2rem",
            "minHeight": "100vh",
        },
        "slots": [
            {
                "name": "main",
                "label": "Main Content",
                "description": "Primary content area for articles and posts",
                "required": True,
                "maxWidgets": 20,
                "allowedWidgetTypes": ["*"],
                "className": "main-content bg-white p-8 rounded-xl shadow-sm border border-gray-200",
                "style": {
                    "flex": "1",
                    "backgroundColor": "#ffffff",
                    "padding": "2rem",
                    "borderRadius": "0.75rem",
                    "border": "1px solid #e5e7eb",
                },
            }
        ],
        "css": {
            "framework": "tailwind",
            "customClasses": ["layout-single-column"],
            "responsiveBreakpoints": {
                "mobile": {"maxWidth": "640px", "padding": "1rem"}
            },
        },
    }

    # Sidebar Layout
    layouts["sidebar_layout"] = {
        "name": "sidebar_layout",
        "label": "Sidebar Layout",
        "description": "Main content with sidebar for complementary content",
        "version": "2.0",
        "type": "css-grid",
        "structure": {
            "display": "grid",
            "gridTemplateColumns": "2fr 1fr",
            "gridTemplateRows": "auto 1fr auto",
            "gridTemplateAreas": ["header header", "main sidebar", "footer footer"],
            "gap": "1.5rem",
            "padding": "1.5rem",
            "minHeight": "100vh",
        },
        "slots": [
            {
                "name": "header",
                "label": "Page Header",
                "description": "Site navigation, branding, and header content",
                "area": "header",
                "maxWidgets": 3,
                "required": False,
                "allowedWidgetTypes": [
                    "core_widgets.HeaderWidget",
                    "core_widgets.NavigationWidget",
                ],
                "className": "header-slot bg-white p-8 rounded-xl shadow-sm border border-gray-200",
                "style": {
                    "gridArea": "header",
                    "backgroundColor": "#ffffff",
                    "padding": "2rem",
                    "borderRadius": "0.75rem",
                    "border": "1px solid #e5e7eb",
                },
            },
            {
                "name": "main",
                "label": "Main Content",
                "description": "Primary content area for articles and posts",
                "area": "main",
                "maxWidgets": 10,
                "required": True,
                "allowedWidgetTypes": [
                    "core_widgets.ContentWidget",
                    "core_widgets.ImageWidget",
                    "core_widgets.TableWidget",
                ],
                "className": "main-slot bg-white p-8 rounded-xl shadow-sm border border-gray-200",
                "style": {
                    "gridArea": "main",
                    "backgroundColor": "#ffffff",
                    "padding": "2rem",
                    "borderRadius": "0.75rem",
                    "border": "1px solid #e5e7eb",
                },
            },
            {
                "name": "sidebar",
                "label": "Sidebar",
                "description": "Complementary content and navigation widgets",
                "area": "sidebar",
                "maxWidgets": 5,
                "required": False,
                "allowedWidgetTypes": [
                    "core_widgets.NavigationWidget",
                    "core_widgets.ContentWidget",
                ],
                "className": "sidebar-slot bg-gray-50 p-6 rounded-xl border border-gray-200",
                "style": {
                    "gridArea": "sidebar",
                    "backgroundColor": "#f9fafb",
                    "padding": "1.5rem",
                    "borderRadius": "0.75rem",
                    "border": "1px solid #e5e7eb",
                },
            },
            {
                "name": "footer",
                "label": "Footer",
                "description": "Site footer with links and copyright",
                "area": "footer",
                "maxWidgets": 2,
                "required": False,
                "allowedWidgetTypes": [
                    "core_widgets.FooterWidget",
                    "core_widgets.NavigationWidget",
                ],
                "className": "footer-slot bg-gray-700 text-white p-6 rounded-xl text-center",
                "style": {
                    "gridArea": "footer",
                    "backgroundColor": "#374151",
                    "color": "#ffffff",
                    "padding": "1.5rem",
                    "borderRadius": "0.75rem",
                    "textAlign": "center",
                },
            },
        ],
        "css": {
            "framework": "tailwind",
            "customClasses": ["layout-sidebar", "responsive-grid"],
            "responsiveBreakpoints": {
                "mobile": {
                    "maxWidth": "640px",
                    "gridTemplateColumns": "1fr",
                    "gridTemplateAreas": ["header", "main", "sidebar", "footer"],
                },
                "tablet": {"maxWidth": "1024px", "gridTemplateColumns": "1.5fr 1fr"},
            },
        },
    }

    # Two Column Layout
    layouts["two_column"] = {
        "name": "two_column",
        "label": "Two Column",
        "description": "Equal two column layout",
        "version": "2.0",
        "type": "css-grid",
        "structure": {
            "display": "grid",
            "gridTemplateColumns": "1fr 1fr",
            "gridTemplateRows": "auto 1fr auto",
            "gridTemplateAreas": ["header header", "left right", "footer footer"],
            "gap": "2rem",
            "padding": "2rem",
            "minHeight": "100vh",
        },
        "slots": [
            {
                "name": "header",
                "label": "Header",
                "description": "Page header area",
                "area": "header",
                "maxWidgets": 2,
                "required": False,
                "allowedWidgetTypes": ["core_widgets.HeaderWidget"],
                "className": "header-slot col-span-2",
            },
            {
                "name": "left",
                "label": "Left Column",
                "description": "Left content column",
                "area": "left",
                "maxWidgets": 8,
                "required": True,
                "allowedWidgetTypes": ["*"],
                "className": "left-slot",
            },
            {
                "name": "right",
                "label": "Right Column",
                "description": "Right content column",
                "area": "right",
                "maxWidgets": 8,
                "required": True,
                "allowedWidgetTypes": ["*"],
                "className": "right-slot",
            },
            {
                "name": "footer",
                "label": "Footer",
                "description": "Page footer area",
                "area": "footer",
                "maxWidgets": 1,
                "required": False,
                "allowedWidgetTypes": ["core_widgets.FooterWidget"],
                "className": "footer-slot col-span-2",
            },
        ],
        "css": {
            "framework": "tailwind",
            "customClasses": ["layout-two-column"],
            "responsiveBreakpoints": {
                "mobile": {
                    "maxWidth": "640px",
                    "gridTemplateColumns": "1fr",
                    "gridTemplateAreas": ["header", "left", "right", "footer"],
                }
            },
        },
    }

    return layouts
