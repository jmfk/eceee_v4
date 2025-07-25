"""
Django template parser for JSON layout serialization
"""

import re
import json
import logging
from typing import Dict, List, Any, Optional
from django.template import Template, Context
from django.template.base import Parser, Token
from django.template.loader import get_template
from django.utils.html import strip_tags, escape
from bs4 import BeautifulSoup, NavigableString, Comment
from django.core.cache import cache
from django.conf import settings

# Configure logging
logger = logging.getLogger(__name__)

# JSON Schema for validating default widgets
DEFAULT_WIDGET_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "type": {"type": "string", "maxLength": 100},
            "config": {"type": "object"},
            "id": {"type": "string", "maxLength": 50},
            "order": {"type": "integer", "minimum": 0},
        },
        "required": ["type"],
        "additionalProperties": False,
    },
    "maxItems": 20,  # Reasonable limit on number of default widgets
}


def validate_default_widgets_json(widgets_data: List[Dict[str, Any]]) -> bool:
    """
    Validate default widgets data against schema

    Args:
        widgets_data: List of widget dictionaries to validate

    Returns:
        bool: True if valid, False otherwise
    """
    try:
        # Basic type and structure validation
        if not isinstance(widgets_data, list):
            return False

        if len(widgets_data) > 20:  # Reasonable limit
            return False

        for widget in widgets_data:
            if not isinstance(widget, dict):
                return False

            # Check for dangerous keys that could be used for code execution
            dangerous_keys = [
                "__class__",
                "__module__",
                "__name__",
                "__globals__",
                "__builtins__",
                "eval",
                "exec",
            ]
            if any(key in widget for key in dangerous_keys):
                return False

            # Required field validation
            if "type" not in widget:
                return False

            widget_type = widget.get("type")
            if not isinstance(widget_type, str) or len(widget_type) > 100:
                return False

            # Reject dangerous widget types
            dangerous_types = ["eval", "exec", "import", "__import__", "compile"]
            if widget_type.lower() in dangerous_types:
                return False

            # Optional field validation
            if "config" in widget and not isinstance(widget.get("config"), dict):
                return False

            if "id" in widget:
                widget_id = widget.get("id")
                if not isinstance(widget_id, str) or len(widget_id) > 50:
                    return False

            if "order" in widget:
                order = widget.get("order")
                if not isinstance(order, int) or order < 0:
                    return False

        return True

    except Exception as e:
        logger.warning(f"Widget validation error: {e}")
        return False


def sanitize_widget_content(widget_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize widget content to prevent XSS attacks

    Args:
        widget_data: Widget dictionary to sanitize

    Returns:
        Dict: Sanitized widget data
    """
    sanitized = {}

    # Sanitize type field
    widget_type = widget_data.get("type", "")
    sanitized["type"] = escape(str(widget_type)[:100])  # Escape HTML and limit length

    # Sanitize config if present
    if "config" in widget_data and isinstance(widget_data["config"], dict):
        sanitized_config = {}
        for key, value in widget_data["config"].items():
            if isinstance(value, str):
                sanitized_config[escape(str(key)[:50])] = escape(str(value)[:1000])
            elif isinstance(value, (int, float, bool)):
                sanitized_config[escape(str(key)[:50])] = value
            # Skip other types for security
        sanitized["config"] = sanitized_config

    # Sanitize other fields
    if "id" in widget_data:
        sanitized["id"] = escape(str(widget_data["id"])[:50])

    if "order" in widget_data and isinstance(widget_data["order"], int):
        sanitized["order"] = max(0, min(widget_data["order"], 9999))

    return sanitized


class TemplateParser:
    """Parse Django templates into JSON layout representation"""

    def __init__(self):
        self.default_widgets_pattern = re.compile(
            r"{#\s*default:\s*(\[.*?\])\s*#}", re.DOTALL | re.MULTILINE
        )
        self.cache_timeout = getattr(
            settings, "TEMPLATE_PARSER_CACHE_TIMEOUT", 300
        )  # 5 minutes default

    def parse_template(self, template_name: str) -> Dict[str, Any]:
        """
        Parse a Django template file into JSON layout representation

        Args:
            template_name: Path to template file (e.g., 'webpages/layouts/sidebar_layout.html')

        Returns:
            Dict containing the JSON layout structure
        """
        # Check cache first
        cache_key = f"template_parser:{template_name}"
        cached_result = cache.get(cache_key)
        if cached_result:
            logger.debug(f"Template parser cache hit for {template_name}")
            return cached_result

        try:
            template = get_template(template_name)
            # Get the template source from the template object
            template_source = template.template.source

            # Extract the content block (between {% block content %} and {% endblock %})
            content_match = re.search(
                r"{%\s*block\s+content\s*%}(.*?){%\s*endblock\s*%}",
                template_source,
                re.DOTALL,
            )

            if not content_match:
                raise ValueError(f"No content block found in template {template_name}")

            content_html = content_match.group(1).strip()

            # Parse the HTML content
            soup = BeautifulSoup(content_html, "html.parser")

            # Find the root element (should be a single container)
            root_elements = [elem for elem in soup.children if elem.name]

            if not root_elements:
                raise ValueError("No root HTML element found in template content")

            root_element = root_elements[0]

            # Parse the root element and its children
            layout_json = self._parse_element(root_element, template_source)

            # Cache the result
            cache.set(cache_key, layout_json, self.cache_timeout)
            logger.debug(f"Template parser cached result for {template_name}")

            return layout_json

        except Exception as e:
            logger.error(f"Error parsing template {template_name}: {e}")
            raise Exception(f"Template parsing failed")  # Generic error message

    def _parse_element(self, element, template_source: str) -> Dict[str, Any]:
        """Parse a BeautifulSoup element into JSON node"""

        if isinstance(element, NavigableString):
            if isinstance(element, Comment):
                return None  # Skip comments in final output

            content = str(element).strip()
            if content:
                return {
                    "type": "text",
                    "content": escape(content),  # Escape HTML content
                }
            return None

        # Regular HTML element
        node = {"type": "element", "tag": element.name}

        # Extract classes
        if element.get("class"):
            # Sanitize class names
            classes = " ".join([escape(cls) for cls in element.get("class") if cls])
            node["classes"] = classes

        # Extract attributes (excluding widget slot attributes)
        attributes = {}
        slot_info = None

        for attr_name, attr_value in element.attrs.items():
            if attr_name.startswith("data-widget-slot"):
                # This is a slot element
                slot_info = {
                    "name": escape(str(attr_value)[:100]),  # Sanitize and limit length
                    "title": escape(str(element.get("data-slot-title", "")[:200])),
                    "description": escape(
                        str(element.get("data-slot-description", "")[:500])
                    ),
                }

                max_widgets = element.get("data-slot-max-widgets")
                if max_widgets:
                    try:
                        max_widgets_int = int(max_widgets)
                        slot_info["maxWidgets"] = max(
                            1, min(max_widgets_int, 50)
                        )  # Reasonable limits
                    except ValueError:
                        pass

                node["type"] = "slot"

            elif not attr_name.startswith("data-slot-"):
                # Regular attribute (not widget slot related) - sanitize
                if isinstance(attr_value, list):
                    attr_value = " ".join(attr_value)
                attributes[escape(str(attr_name)[:100])] = escape(
                    str(attr_value)[:1000]
                )

        if attributes:
            node["attributes"] = attributes

        if slot_info:
            # Extract default widgets from template comments with validation
            default_widgets = self._extract_default_widgets(element, template_source)
            if default_widgets:
                slot_info["defaultWidgets"] = default_widgets

            node["slot"] = slot_info
            # Slot elements don't have children in our model
            return node

        # Parse children for regular elements
        children = []
        for child in element.children:
            child_node = self._parse_element(child, template_source)
            if child_node:
                children.append(child_node)

        if children:
            node["children"] = children

        return node

    def _extract_default_widgets(
        self, element, template_source: str
    ) -> Optional[List[Dict[str, Any]]]:
        """Extract and validate default widgets from Django template comments within the element"""

        # Get the string representation of this element
        element_str = str(element)

        # Look for default widget comments within this element
        matches = self.default_widgets_pattern.findall(element_str)

        if not matches:
            return None

        # Parse the first match (there should only be one per slot)
        try:
            default_widgets_json = matches[0]

            # Security: Limit JSON size to prevent DoS
            if len(default_widgets_json) > 10000:  # 10KB limit
                logger.warning(
                    f"Default widgets JSON too large: {len(default_widgets_json)} bytes"
                )
                return None

            # Parse JSON with validation
            default_widgets = json.loads(default_widgets_json)

            # Validate structure
            if not validate_default_widgets_json(default_widgets):
                logger.warning("Invalid default widgets JSON structure")
                return None

            # Sanitize content
            sanitized_widgets = []
            for widget in default_widgets:
                sanitized_widget = sanitize_widget_content(widget)
                sanitized_widgets.append(sanitized_widget)

            return sanitized_widgets

        except (json.JSONDecodeError, IndexError, ValueError) as e:
            logger.warning(f"Error parsing default widgets JSON: {e}")

        return None


class LayoutSerializer:
    """Serialize PageLayout objects to JSON"""

    def __init__(self):
        self.parser = TemplateParser()

    def serialize_layout(self, layout) -> Dict[str, Any]:
        """
        Serialize a PageLayout object to JSON representation

        Args:
            layout: PageLayout model instance

        Returns:
            Dict containing complete layout information
        """
        try:
            # Parse the template file
            template_name = f"webpages/layouts/{layout.template_name}"
            layout_json = self.parser.parse_template(template_name)

            # Add layout metadata
            result = {
                "layout": {
                    "id": layout.id,
                    "name": layout.name,
                    "description": layout.description,
                    "template_name": layout.template_name,
                },
                "structure": layout_json,
            }

            return result
        except Exception as e:
            # Re-raise with generic message to prevent information disclosure
            logger.error(f"Error serializing layout {layout.name}: {e}")
            raise Exception("Template parsing failed")  # Generic error message
