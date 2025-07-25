"""
Layout Template Parser for React Editor Integration

This module provides comprehensive analysis of HTML layout templates,
extracting structure, styling, and metadata information that the React
editor needs to properly render and allow editing of layouts.
"""

import re
import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from django.template.loader import get_template
from django.template import Context, Template
from django.conf import settings
from bs4 import BeautifulSoup, Comment

logger = logging.getLogger(__name__)


class LayoutTemplateParser:
    """
    Parses HTML layout templates and extracts comprehensive structural
    and styling information for the React editor.
    """

    def __init__(self, layout_obj):
        """
        Initialize parser with a layout object.

        Args:
            layout_obj: Instance of BaseLayout or subclass
        """
        self.layout = layout_obj
        self.template_content = None
        self.parsed_soup = None
        self.css_content = None
        self._parse_errors = []

        # Parse the template on initialization
        self._load_template()

    def _load_template(self):
        """Load and parse the HTML template."""
        try:
            # Get the Django template
            template = get_template(self.layout.template_name)

            # Render with minimal context to get the structure
            context = {
                "page": {"title": "Sample Page", "slug": "sample"},
                "request": None,
                "user": None,
            }

            self.template_content = template.render(context)

            # Parse with BeautifulSoup
            self.parsed_soup = BeautifulSoup(self.template_content, "html.parser")

        except Exception as e:
            logger.error(f"Failed to load template {self.layout.template_name}: {e}")
            self._parse_errors.append(f"Template loading error: {e}")
            self.template_content = ""
            self.parsed_soup = BeautifulSoup("", "html.parser")

    def get_template_structure(self) -> Dict[str, Any]:
        """
        Extract the complete template structure for React editor.

        Returns detailed hierarchy, element information, and relationships.
        """
        if not self.parsed_soup:
            return {"error": "Template not parsed", "structure": None}

        try:
            # Find the main content container
            content_container = self._find_content_container()

            if not content_container:
                return {
                    "error": "No content container found",
                    "structure": None,
                    "raw_html": (
                        self.template_content[:500] + "..."
                        if len(self.template_content) > 500
                        else self.template_content
                    ),
                }

            # Extract structure recursively
            structure = self._extract_element_structure(content_container)

            return {
                "root_element": structure,
                "template_type": self._determine_template_type(),
                "framework_detected": self._detect_css_framework(),
                "total_elements": len(self.parsed_soup.find_all()),
                "slot_elements": len(
                    self.parsed_soup.find_all(attrs={"data-widget-slot": True})
                ),
                "parsing_metadata": {
                    "template_name": self.layout.template_name,
                    "parsed_successfully": True,
                    "errors": self._parse_errors,
                },
            }

        except Exception as e:
            logger.error(f"Error extracting template structure: {e}")
            return {
                "error": f"Structure extraction failed: {e}",
                "parsing_metadata": {
                    "template_name": self.layout.template_name,
                    "parsed_successfully": False,
                    "errors": self._parse_errors + [str(e)],
                },
            }

    def _find_content_container(self):
        """Find the main content container in the template."""
        # Look for common patterns
        selectors = [
            "[data-widget-slot]",  # Direct slot elements
            ".content",
            "#content",
            "main",
            ".container",
            ".wrapper",
            '[class*="layout"]',
            'div[class*="col"]',
        ]

        for selector in selectors:
            elements = self.parsed_soup.select(selector)
            if elements:
                # Return the parent that contains multiple slots, or the first element
                for elem in elements:
                    if elem.find_all(attrs={"data-widget-slot": True}):
                        return elem.parent if elem.parent.name != "body" else elem
                return elements[0]

        # Fallback to body content
        body = self.parsed_soup.find("body")
        if body:
            return body

        # Last resort - the whole document
        return self.parsed_soup

    def _extract_element_structure(self, element, depth=0) -> Dict[str, Any]:
        """Recursively extract element structure."""
        if depth > 10:  # Prevent infinite recursion
            return {"error": "Max depth reached"}

        if not element or not hasattr(element, "name"):
            return None

        structure = {
            "tag": element.name,
            "attributes": dict(element.attrs) if element.attrs else {},
            "text_content": element.get_text(strip=True) if element.string else "",
            "is_slot": bool(element.get("data-widget-slot")),
            "slot_info": (
                self._extract_slot_info(element)
                if element.get("data-widget-slot")
                else None
            ),
            "css_classes": element.get("class", []),
            "position": {
                "depth": depth,
                "index": (
                    list(element.parent.children).index(element)
                    if element.parent
                    else 0
                ),
            },
            "children": [],
        }

        # Extract children (only for non-slot elements or limited depth)
        if not structure["is_slot"] or depth < 2:
            for child in element.children:
                if hasattr(child, "name") and child.name:  # Skip text nodes
                    child_structure = self._extract_element_structure(child, depth + 1)
                    if child_structure:
                        structure["children"].append(child_structure)

        return structure

    def _extract_slot_info(self, slot_element) -> Dict[str, Any]:
        """Extract detailed slot information from element."""
        slot_name = slot_element.get("data-widget-slot")
        slot_config = next(
            (
                slot
                for slot in self.layout.slot_configuration.get("slots", [])
                if slot.get("name") == slot_name
            ),
            {},
        )

        return {
            "name": slot_name,
            "title": slot_element.get("data-slot-title")
            or slot_config.get("title", ""),
            "description": slot_element.get("data-slot-description")
            or slot_config.get("description", ""),
            "max_widgets": slot_element.get("data-slot-max-widgets")
            or slot_config.get("max_widgets"),
            "css_classes": slot_element.get("class", []),
            "dimensions": self._estimate_dimensions(slot_element),
            "position_type": self._determine_position_type(slot_element),
            "accepts_widgets": True,
            "constraints": {
                "max_widgets": slot_config.get("max_widgets"),
                "min_widgets": 0,
                "allowed_widget_types": slot_config.get("allowed_widget_types", []),
            },
        }

    def get_slot_hierarchy(self) -> Dict[str, Any]:
        """
        Extract slot hierarchy and relationships.

        Returns information about how slots are arranged and related.
        """
        slots = self.parsed_soup.find_all(attrs={"data-widget-slot": True})

        hierarchy = {
            "total_slots": len(slots),
            "slots": [],
            "relationships": [],
            "layout_pattern": self._determine_layout_pattern(slots),
        }

        for idx, slot in enumerate(slots):
            slot_info = {
                "index": idx,
                "name": slot.get("data-widget-slot"),
                "parent_tag": slot.parent.name if slot.parent else None,
                "parent_classes": slot.parent.get("class", []) if slot.parent else [],
                "siblings_count": (
                    len([s for s in slot.parent.children if hasattr(s, "name")])
                    if slot.parent
                    else 0
                ),
                "nesting_level": self._get_nesting_level(slot),
                "grid_position": self._determine_grid_position(slot),
                "responsive_behavior": self._analyze_responsive_classes(slot),
            }

            hierarchy["slots"].append(slot_info)

        # Determine relationships between slots
        hierarchy["relationships"] = self._analyze_slot_relationships(slots)

        return hierarchy

    def get_css_analysis(self) -> Dict[str, Any]:
        """
        Analyze CSS classes and styling information.

        Returns detailed CSS analysis for the React editor.
        """
        analysis = {
            "framework": self._detect_css_framework(),
            "layout_classes": self._extract_layout_classes(),
            "responsive_classes": self._extract_responsive_classes(),
            "spacing_classes": self._extract_spacing_classes(),
            "color_classes": self._extract_color_classes(),
            "grid_system": self._analyze_grid_system(),
            "custom_css": self._extract_custom_css(),
        }

        return analysis

    def get_editor_instructions(self) -> Dict[str, Any]:
        """
        Generate specific instructions for the React editor.

        Returns actionable instructions for rendering and editing.
        """
        instructions = {
            "rendering": {
                "container_setup": self._get_container_instructions(),
                "slot_rendering": self._get_slot_rendering_instructions(),
                "responsive_handling": self._get_responsive_instructions(),
                "interaction_zones": self._define_interaction_zones(),
            },
            "editing": {
                "drag_drop_zones": self._define_drag_drop_zones(),
                "resize_handles": self._define_resize_handles(),
                "style_controls": self._define_style_controls(),
                "constraint_warnings": self._define_constraint_warnings(),
            },
            "preview": {
                "device_breakpoints": self._get_device_breakpoints(),
                "zoom_levels": [0.5, 0.75, 1.0, 1.25, 1.5],
                "interaction_modes": ["edit", "preview", "responsive"],
            },
        }

        return instructions

    def get_layout_constraints(self) -> Dict[str, Any]:
        """Extract layout constraints and limitations."""
        return {
            "slot_constraints": [
                {
                    "slot_name": slot.get("name"),
                    "max_widgets": slot.get("max_widgets"),
                    "required": slot.get("required", False),
                    "widget_types": slot.get("allowed_widget_types", []),
                }
                for slot in self.layout.slot_configuration.get("slots", [])
            ],
            "layout_constraints": {
                "min_width": self._extract_min_width(),
                "max_width": self._extract_max_width(),
                "fixed_height": self._has_fixed_height(),
                "responsive": self._is_responsive_layout(),
            },
            "editor_constraints": {
                "allow_column_resize": self._allows_column_resize(),
                "allow_slot_reorder": False,  # Default to false for safety
                "allow_slot_add_remove": False,
                "allow_layout_modification": False,
            },
        }

    def get_responsive_info(self) -> Dict[str, Any]:
        """Extract responsive design information."""
        return {
            "breakpoints": self._detect_breakpoints(),
            "responsive_classes": self._extract_responsive_classes(),
            "mobile_behavior": self._analyze_mobile_behavior(),
            "tablet_behavior": self._analyze_tablet_behavior(),
            "desktop_behavior": self._analyze_desktop_behavior(),
            "grid_behavior": self._analyze_grid_responsive_behavior(),
        }

    def get_accessibility_info(self) -> Dict[str, Any]:
        """Extract accessibility information from the template."""
        return {
            "semantic_elements": self._count_semantic_elements(),
            "aria_attributes": self._extract_aria_attributes(),
            "heading_structure": self._analyze_heading_structure(),
            "focus_management": self._analyze_focus_management(),
            "color_contrast": self._analyze_color_contrast(),
            "accessibility_score": self._calculate_accessibility_score(),
        }

    def get_validation_rules(self) -> Dict[str, Any]:
        """Generate validation rules for the editor."""
        return {
            "required_slots": [
                slot.get("name")
                for slot in self.layout.slot_configuration.get("slots", [])
                if slot.get("required", False)
            ],
            "slot_widget_limits": {
                slot.get("name"): slot.get("max_widgets")
                for slot in self.layout.slot_configuration.get("slots", [])
                if slot.get("max_widgets") is not None
            },
            "css_validation": {
                "required_classes": self._get_required_css_classes(),
                "forbidden_classes": self._get_forbidden_css_classes(),
                "class_patterns": self._get_css_class_patterns(),
            },
            "structure_validation": {
                "min_slots": 1,
                "max_slots": 10,
                "required_elements": self._get_required_elements(),
            },
        }

    # Helper methods for analysis

    def _determine_template_type(self) -> str:
        """Determine the type of template based on structure."""
        if "hero" in self.layout.name.lower():
            return "hero"
        elif "single" in self.layout.name.lower():
            return "single_column"
        elif "two" in self.layout.name.lower():
            return "two_column"
        elif "three" in self.layout.name.lower():
            return "three_column"
        elif "grid" in self.layout.name.lower():
            return "grid"
        else:
            return "custom"

    def _detect_css_framework(self) -> str:
        """Detect which CSS framework is being used."""
        html_content = str(self.parsed_soup).lower()

        if "tailwind" in html_content or any(
            cls in html_content for cls in ["bg-", "text-", "p-", "m-", "w-", "h-"]
        ):
            return "tailwind"
        elif "bootstrap" in html_content or "container" in html_content:
            return "bootstrap"
        elif "bulma" in html_content:
            return "bulma"
        else:
            return "custom"

    def _estimate_dimensions(self, element) -> Dict[str, str]:
        """Estimate element dimensions from CSS classes."""
        classes = " ".join(element.get("class", []))

        # Tailwind patterns
        width_match = re.search(r"w-(\w+)", classes)
        height_match = re.search(r"h-(\w+)", classes)

        return {
            "width": f"w-{width_match.group(1)}" if width_match else "auto",
            "height": f"h-{height_match.group(1)}" if height_match else "auto",
            "responsive": any(
                prefix in classes for prefix in ["sm:", "md:", "lg:", "xl:"]
            ),
        }

    def _determine_position_type(self, element) -> str:
        """Determine positioning type of an element."""
        classes = " ".join(element.get("class", []))

        if "fixed" in classes:
            return "fixed"
        elif "absolute" in classes:
            return "absolute"
        elif "relative" in classes:
            return "relative"
        elif "flex" in classes or "grid" in classes:
            return "layout"
        else:
            return "normal"

    def _get_nesting_level(self, element) -> int:
        """Calculate nesting level of an element."""
        level = 0
        current = element.parent
        while current and current.name != "body":
            level += 1
            current = current.parent
        return level

    def _determine_grid_position(self, element) -> Dict[str, Any]:
        """Determine grid position information."""
        classes = " ".join(element.get("class", []))

        # Look for grid/flex positioning classes
        col_span = re.search(r"col-span-(\d+)", classes)
        row_span = re.search(r"row-span-(\d+)", classes)

        return {
            "column_span": int(col_span.group(1)) if col_span else 1,
            "row_span": int(row_span.group(1)) if row_span else 1,
            "is_grid_item": "col-span" in classes or "row-span" in classes,
            "flex_grow": "flex-grow" in classes or "flex-1" in classes,
        }

    def _analyze_responsive_classes(self, element) -> Dict[str, List[str]]:
        """Analyze responsive behavior of an element."""
        classes = element.get("class", [])
        responsive = {"mobile": [], "tablet": [], "desktop": []}

        for cls in classes:
            if cls.startswith("sm:"):
                responsive["mobile"].append(cls)
            elif cls.startswith("md:"):
                responsive["tablet"].append(cls)
            elif cls.startswith("lg:") or cls.startswith("xl:"):
                responsive["desktop"].append(cls)

        return responsive

    def _determine_layout_pattern(self, slots) -> str:
        """Determine the overall layout pattern."""
        if len(slots) == 1:
            return "single"
        elif len(slots) == 2:
            return "dual"
        elif len(slots) == 3:
            return "triple"
        else:
            return "complex"

    def _analyze_slot_relationships(self, slots) -> List[Dict[str, Any]]:
        """Analyze relationships between slots."""
        relationships = []

        for i, slot1 in enumerate(slots):
            for j, slot2 in enumerate(slots[i + 1 :], i + 1):
                if slot1.parent == slot2.parent:
                    relationships.append(
                        {
                            "slot1": slot1.get("data-widget-slot"),
                            "slot2": slot2.get("data-widget-slot"),
                            "relationship": "siblings",
                            "container": slot1.parent.name if slot1.parent else None,
                        }
                    )
                elif slot2 in slot1.descendants:
                    relationships.append(
                        {
                            "slot1": slot1.get("data-widget-slot"),
                            "slot2": slot2.get("data-widget-slot"),
                            "relationship": "parent-child",
                            "direction": "contains",
                        }
                    )

        return relationships

    def _extract_layout_classes(self) -> List[str]:
        """Extract layout-related CSS classes."""
        layout_classes = []
        all_classes = []

        # Collect all classes from the template
        for element in self.parsed_soup.find_all(class_=True):
            all_classes.extend(element.get("class", []))

        # Filter for layout-related classes
        layout_patterns = [
            r"^(flex|grid|container|wrapper|layout)",
            r"(row|col|column)",
            r"(justify|align|items)",
            r"(gap|space)",
        ]

        for cls in set(all_classes):
            if any(re.search(pattern, cls, re.I) for pattern in layout_patterns):
                layout_classes.append(cls)

        return layout_classes

    def _extract_responsive_classes(self) -> Dict[str, List[str]]:
        """Extract responsive-related CSS classes."""
        responsive_classes = {"mobile": [], "tablet": [], "desktop": []}

        for element in self.parsed_soup.find_all(class_=True):
            classes = element.get("class", [])
            for cls in classes:
                if cls.startswith("sm:"):
                    responsive_classes["mobile"].append(cls)
                elif cls.startswith("md:"):
                    responsive_classes["tablet"].append(cls)
                elif cls.startswith("lg:") or cls.startswith("xl:"):
                    responsive_classes["desktop"].append(cls)

        return responsive_classes

    def _extract_spacing_classes(self) -> List[str]:
        """Extract spacing-related CSS classes."""
        spacing_classes = []

        for element in self.parsed_soup.find_all(class_=True):
            classes = element.get("class", [])
            for cls in classes:
                if re.match(r"^[mp][tblrxy]?-\d+$", cls):  # Tailwind spacing
                    spacing_classes.append(cls)
                elif cls.startswith(("margin", "padding")):
                    spacing_classes.append(cls)

        return list(set(spacing_classes))

    def _extract_color_classes(self) -> List[str]:
        """Extract color-related CSS classes."""
        color_classes = []

        for element in self.parsed_soup.find_all(class_=True):
            classes = element.get("class", [])
            for cls in classes:
                if any(
                    prefix in cls
                    for prefix in ["bg-", "text-", "border-", "from-", "to-"]
                ):
                    color_classes.append(cls)

        return list(set(color_classes))

    def _analyze_grid_system(self) -> Dict[str, Any]:
        """Analyze grid system usage."""
        grid_elements = self.parsed_soup.find_all(class_=re.compile(r"(grid|col|row)"))

        return {
            "uses_grid": len(grid_elements) > 0,
            "grid_containers": len(
                self.parsed_soup.find_all(class_=re.compile(r"grid"))
            ),
            "total_columns": self._count_columns(),
            "responsive_grid": self._has_responsive_grid(),
        }

    def _extract_custom_css(self) -> Dict[str, Any]:
        """Extract custom CSS information."""
        return {
            "inline_styles": len(self.parsed_soup.find_all(style=True)),
            "custom_classes": self._find_custom_classes(),
            "css_variables": self._extract_css_variables(),
        }

    # Additional helper methods would continue here...
    # For brevity, I'm including just the core structure

    def _count_columns(self) -> int:
        """Count the number of columns in the layout."""
        # This is a simplified implementation
        col_elements = self.parsed_soup.find_all(class_=re.compile(r"col"))
        return len(col_elements) if col_elements else 1

    def _has_responsive_grid(self) -> bool:
        """Check if the layout uses responsive grid."""
        return bool(self.parsed_soup.find_all(class_=re.compile(r"(sm:|md:|lg:|xl:)")))

    def _find_custom_classes(self) -> List[str]:
        """Find custom (non-framework) CSS classes."""
        # This would compare against known framework classes
        # For now, return empty list
        return []

    def _extract_css_variables(self) -> List[str]:
        """Extract CSS custom properties."""
        # This would parse style attributes and linked CSS
        # For now, return empty list
        return []

    # Placeholder implementations for remaining methods
    def _get_container_instructions(self):
        return {}

    def _get_slot_rendering_instructions(self):
        return {}

    def _get_responsive_instructions(self):
        return {}

    def _define_interaction_zones(self):
        return {}

    def _define_drag_drop_zones(self):
        return {}

    def _define_resize_handles(self):
        return {}

    def _define_style_controls(self):
        return {}

    def _define_constraint_warnings(self):
        return {}

    def _get_device_breakpoints(self):
        return {}

    def _extract_min_width(self):
        return None

    def _extract_max_width(self):
        return None

    def _has_fixed_height(self):
        return False

    def _is_responsive_layout(self):
        return True

    def _allows_column_resize(self):
        return False

    def _detect_breakpoints(self):
        return {}

    def _analyze_mobile_behavior(self):
        return {}

    def _analyze_tablet_behavior(self):
        return {}

    def _analyze_desktop_behavior(self):
        return {}

    def _analyze_grid_responsive_behavior(self):
        return {}

    def _count_semantic_elements(self):
        return {}

    def _extract_aria_attributes(self):
        return {}

    def _analyze_heading_structure(self):
        return {}

    def _analyze_focus_management(self):
        return {}

    def _analyze_color_contrast(self):
        return {}

    def _calculate_accessibility_score(self):
        return 0

    def _get_required_css_classes(self):
        return []

    def _get_forbidden_css_classes(self):
        return []

    def _get_css_class_patterns(self):
        return []

    def _get_required_elements(self):
        return []
