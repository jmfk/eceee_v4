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


class WidgetTemplateParser:
    """Parse widget Django templates into JSON representation"""

    def __init__(self):
        self.cache_timeout = getattr(
            settings, "WIDGET_TEMPLATE_PARSER_CACHE_TIMEOUT", 300
        )  # 5 minutes default
        self.template_variable_pattern = re.compile(
            r"\{\{\s*([^}]+)\s*\}\}", re.MULTILINE
        )
        self.template_tag_pattern = re.compile(r"\{\%\s*([^%]+)\s*\%\}", re.MULTILINE)
        # Patterns for Django template logic blocks
        # Non-greedy matching to prevent capturing nested blocks incorrectly
        self.if_block_pattern = re.compile(
            r"\{\%\s*if\s+([^%]+?)\s*\%\}(.*?)\{\%\s*endif\s*\%\}",
            re.DOTALL | re.MULTILINE,
        )
        self.for_block_pattern = re.compile(
            r"\{\%\s*for\s+([^%]+?)\s*\%\}(.*?)\{\%\s*endfor\s*\%\}",
            re.DOTALL | re.MULTILINE,
        )

    def _preprocess_django_template(self, template_source: str) -> str:
        """
        Pre-process Django template to convert template logic into parseable HTML elements

        Converts Django template blocks like {% if %} into custom HTML elements
        that BeautifulSoup can properly parse as structured content.

        Args:
            template_source: Raw Django template source code

        Returns:
            Processed template source with template logic converted to HTML elements
        """

        def replace_if_blocks(match):
            condition = match.group(1).strip()
            content = match.group(2).strip()
            
            # Validate condition is safe
            if not self._validate_template_condition(condition):
                logger.warning(f"Potentially unsafe Django template condition blocked: {condition[:100]}")
                return f'<!-- Invalid template condition: {escape(condition[:50])} -->'
            
            # Use Django's escape() for proper HTML attribute encoding
            escaped_condition = escape(condition)
            return f'<template-conditional data-condition="{escaped_condition}">{content}</template-conditional>'

        def replace_for_blocks(match):
            loop_expr = match.group(1).strip()
            content = match.group(2).strip()
            
            # Validate loop expression is safe
            if not self._validate_template_loop_expression(loop_expr):
                logger.warning(f"Potentially unsafe Django template loop expression blocked: {loop_expr[:100]}")
                return f'<!-- Invalid template loop: {escape(loop_expr[:50])} -->'
            
            # Use Django's escape() for proper HTML attribute encoding
            escaped_loop = escape(loop_expr)
            return f'<template-loop data-loop="{escaped_loop}">{content}</template-loop>'

        # Apply transformations
        processed = self.if_block_pattern.sub(replace_if_blocks, template_source)
        processed = self.for_block_pattern.sub(replace_for_blocks, processed)

        return processed

    def _validate_template_condition(self, condition: str) -> bool:
        """
        Validate that a Django template condition is safe to process
        
        Args:
            condition: The template condition to validate
            
        Returns:
            True if condition is safe, False otherwise
        """
        if not condition or len(condition) > 200:  # Reasonable length limit
            return False
            
        # Check for dangerous patterns
        dangerous_patterns = [
            '__',  # Dunder methods
            'import',  # Import statements
            'exec',  # Code execution
            'eval',  # Expression evaluation
            '<script',  # Script tags
            'javascript:',  # JavaScript URLs
            'data:',  # Data URLs
            '{{',  # Nested template syntax
            '{%',  # Nested template tags
        ]
        
        condition_lower = condition.lower()
        for pattern in dangerous_patterns:
            if pattern in condition_lower:
                return False
                
        # Only allow safe Django template syntax patterns
        safe_pattern = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*(\s+(and|or|not)\s+[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*)*$')
        return bool(safe_pattern.match(condition.strip()))

    def _validate_template_loop_expression(self, loop_expr: str) -> bool:
        """
        Validate that a Django template loop expression is safe to process
        
        Args:
            loop_expr: The template loop expression to validate
            
        Returns:
            True if expression is safe, False otherwise
        """
        if not loop_expr or len(loop_expr) > 200:  # Reasonable length limit
            return False
            
        # Check for dangerous patterns (same as condition validation)
        dangerous_patterns = [
            '__',  # Dunder methods
            'import',  # Import statements
            'exec',  # Code execution
            'eval',  # Expression evaluation
            '<script',  # Script tags
            'javascript:',  # JavaScript URLs
            'data:',  # Data URLs
            '{{',  # Nested template syntax
            '{%',  # Nested template tags
        ]
        
        loop_expr_lower = loop_expr.lower()
        for pattern in dangerous_patterns:
            if pattern in loop_expr_lower:
                return False
                
        # Only allow safe Django for loop syntax: "item in items" or "key, value in items.items"
        safe_pattern = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*(\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*)*\s+in\s+[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$')
        return bool(safe_pattern.match(loop_expr.strip()))

    def parse_widget_template(self, template_name: str) -> Dict[str, Any]:
        """
        Parse a widget Django template file into JSON representation

        Args:
            template_name: Path to template file (e.g., 'webpages/widgets/text_block.html')

        Returns:
            Dict containing the JSON template structure
        """
        # Input validation
        if not template_name or not isinstance(template_name, str):
            raise ValueError("template_name must be a non-empty string")
            
        if len(template_name) > 500:  # Reasonable path length limit
            raise ValueError("template_name is too long")
            
        # Validate template name contains only safe characters
        if not re.match(r'^[a-zA-Z0-9_/.-]+$', template_name):
            raise ValueError("template_name contains invalid characters")
            
        # Prevent path traversal attacks
        if '..' in template_name or template_name.startswith('/'):
            raise ValueError("template_name contains invalid path components")
        
        # Check cache first
        cache_key = f"widget_template_parser:{template_name}"
        cached_result = cache.get(cache_key)
        if cached_result:
            logger.debug(f"Widget template parser cache hit for {template_name}")
            return cached_result

        try:
            template = get_template(template_name)
            template_source = template.template.source

            # Pre-process Django template logic before BeautifulSoup parsing
            processed_source = self._preprocess_django_template(template_source)

            # Parse the processed template content
            soup = BeautifulSoup(processed_source, "html.parser")

            # Find root elements (excluding comments and whitespace)
            root_elements = [elem for elem in soup.children if elem.name]

            if not root_elements:
                raise ValueError("No root HTML element found in widget template")

            # Parse the template structure
            parsed_elements = []
            for root_element in root_elements:
                element_json = self._parse_widget_element(root_element, template_source)
                if element_json:
                    parsed_elements.append(element_json)

            # Extract template variables and tags
            template_variables = self._extract_template_variables(template_source)
            template_tags = self._extract_template_tags(template_source)

            # Build result
            result = {
                "structure": (
                    parsed_elements[0]
                    if len(parsed_elements) == 1
                    else {"type": "fragment", "children": parsed_elements}
                ),
                "template_variables": template_variables,
                "template_tags": template_tags,
                "has_inline_css": self._has_inline_css(template_source),
            }

            # Cache the result
            cache.set(cache_key, result, self.cache_timeout)
            logger.debug(f"Widget template parser cached result for {template_name}")

            return result

        except Exception as e:
            logger.error(f"Error parsing widget template {template_name}: {e}")
            raise Exception("Widget template parsing failed")

    def _parse_widget_element(self, element, template_source: str) -> Dict[str, Any]:
        """Parse a BeautifulSoup element into JSON node for widgets"""

        if isinstance(element, NavigableString):
            if isinstance(element, Comment):
                return None  # Skip comments

            content = str(element).strip()
            if content:
                # Check if content contains template variables
                variables = self.template_variable_pattern.findall(content)
                if variables:
                    return {
                        "type": "template_text",
                        "content": escape(content),
                        "variables": [escape(var.strip()) for var in variables],
                    }
                else:
                    return {
                        "type": "text",
                        "content": escape(content),
                    }
            return None

        # Handle style tags specially
        if element.name == "style":
            css_content = element.get_text().strip()
            return {
                "type": "style",
                "css": escape(css_content),
                "variables": self.template_variable_pattern.findall(css_content),
            }

        # Handle template-conditional elements (converted from {% if %} blocks)
        if element.name == "template-conditional":
            condition = element.get("data-condition", "")
            
            # Safely decode condition - it was already validated during pre-processing
            # Use html.unescape for proper HTML entity decoding
            from html import unescape
            unescaped_condition = unescape(condition)
            
            # Re-validate the unescaped condition for additional security
            if not self._validate_template_condition(unescaped_condition):
                logger.warning(f"Invalid condition detected during parsing: {unescaped_condition[:50]}")
                return {
                    "type": "text",
                    "content": "<!-- Invalid template condition -->"
                }

            # Parse children of the conditional block
            children = []
            for child in element.children:
                child_node = self._parse_widget_element(child, template_source)
                if child_node:
                    children.append(child_node)

            return {
                "type": "conditional_block",
                "condition": escape(unescaped_condition),
                "content": (
                    children[0]
                    if len(children) == 1
                    else {"type": "fragment", "children": children}
                ),
            }

        # Handle template-loop elements (converted from {% for %} blocks)
        if element.name == "template-loop":
            loop_expr = element.get("data-loop", "")
            
            # Safely decode loop expression - it was already validated during pre-processing
            # Use html.unescape for proper HTML entity decoding
            from html import unescape
            unescaped_loop = unescape(loop_expr)
            
            # Re-validate the unescaped loop expression for additional security
            if not self._validate_template_loop_expression(unescaped_loop):
                logger.warning(f"Invalid loop expression detected during parsing: {unescaped_loop[:50]}")
                return {
                    "type": "text",
                    "content": "<!-- Invalid template loop -->"
                }

            # Parse children of the loop block
            children = []
            for child in element.children:
                child_node = self._parse_widget_element(child, template_source)
                if child_node:
                    children.append(child_node)

            return {
                "type": "loop_block",
                "loop": escape(unescaped_loop),
                "content": (
                    children[0]
                    if len(children) == 1
                    else {"type": "fragment", "children": children}
                ),
            }

        # Regular HTML element
        node = {"type": "element", "tag": element.name}

        # Extract classes (may contain template variables)
        if element.get("class"):
            classes = " ".join(element.get("class"))
            node["classes"] = escape(classes)
            # Check for template variables in classes
            class_variables = self.template_variable_pattern.findall(classes)
            if class_variables:
                node["class_variables"] = [
                    escape(var.strip()) for var in class_variables
                ]

        # Extract attributes (may contain template variables)
        attributes = {}
        template_attributes = {}

        for attr_name, attr_value in element.attrs.items():
            if attr_name == "class":
                continue  # Already handled above

            if isinstance(attr_value, list):
                attr_value = " ".join(attr_value)

            attr_value_str = str(attr_value)
            escaped_attr_name = escape(str(attr_name)[:100])
            escaped_attr_value = escape(attr_value_str[:1000])

            # Check for template variables in attribute values
            attr_variables = self.template_variable_pattern.findall(attr_value_str)
            if attr_variables:
                template_attributes[escaped_attr_name] = {
                    "value": escaped_attr_value,
                    "variables": [escape(var.strip()) for var in attr_variables],
                }
            else:
                attributes[escaped_attr_name] = escaped_attr_value

        if attributes:
            node["attributes"] = attributes
        if template_attributes:
            node["template_attributes"] = template_attributes

        # Parse children
        children = []
        for child in element.children:
            child_node = self._parse_widget_element(child, template_source)
            if child_node:
                children.append(child_node)

        if children:
            node["children"] = children

        return node

    def _extract_template_variables(self, template_source: str) -> List[str]:
        """Extract all template variables from the template source"""
        variables = set()
        matches = self.template_variable_pattern.findall(template_source)

        for match in matches:
            # Clean up the variable (remove filters, etc.)
            var_parts = match.split("|")[0].strip()  # Remove filters
            variables.add(escape(var_parts[:200]))  # Limit length and escape

        return sorted(list(variables))

    def _extract_template_tags(self, template_source: str) -> List[str]:
        """Extract all template tags from the template source"""
        tags = set()
        matches = self.template_tag_pattern.findall(template_source)

        for match in matches:
            # Extract the tag name (first word)
            tag_parts = match.strip().split()
            if tag_parts:
                tag_name = tag_parts[0]
                # Only include common Django template tags
                if tag_name in [
                    "if",
                    "endif",
                    "for",
                    "endfor",
                    "comment",
                    "endcomment",
                    "load",
                    "include",
                    "extends",
                    "block",
                    "endblock",
                ]:
                    tags.add(escape(tag_name))

        return sorted(list(tags))

    def _has_inline_css(self, template_source: str) -> bool:
        """Check if template contains inline CSS (style tags)"""
        return "<style>" in template_source.lower()


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


class WidgetSerializer:
    """Serialize widget templates to JSON"""

    def __init__(self):
        self.parser = WidgetTemplateParser()

    def serialize_widget_template(self, widget_instance) -> Dict[str, Any]:
        """
        Serialize a widget's template to JSON representation

        Args:
            widget_instance: Widget instance with template_name attribute

        Returns:
            Dict containing the JSON template structure
        """
        try:
            template_name = widget_instance.template_name
            template_json = self.parser.parse_widget_template(template_name)

            # Add widget metadata
            result = {
                "widget": {
                    "name": widget_instance.name,
                    "template_name": template_name,
                },
                "template_json": template_json,
            }

            return result
        except Exception as e:
            # Re-raise with generic message to prevent information disclosure
            logger.error(
                f"Error serializing widget template {widget_instance.name}: {e}"
            )
            raise Exception("Widget template parsing failed")
