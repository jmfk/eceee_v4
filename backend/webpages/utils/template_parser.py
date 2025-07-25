"""
Django template parser for JSON layout serialization
"""

import re
import json
from typing import Dict, List, Any, Optional
from django.template import Template, Context
from django.template.base import Parser, Token
from django.template.loader import get_template
from django.utils.html import strip_tags
from bs4 import BeautifulSoup, NavigableString, Comment


class TemplateParser:
    """Parse Django templates into JSON layout representation"""
    
    def __init__(self):
        self.default_widgets_pattern = re.compile(
            r'{#\s*default:\s*(\[.*?\])\s*#}',
            re.DOTALL | re.MULTILINE
        )
    
    def parse_template(self, template_name: str) -> Dict[str, Any]:
        """
        Parse a Django template file into JSON layout representation
        
        Args:
            template_name: Path to template file (e.g., 'webpages/layouts/sidebar_layout.html')
            
        Returns:
            Dict containing the JSON layout structure
        """
        try:
            template = get_template(template_name)
            # Get the template source from the template object
            template_source = template.template.source
            
            # Extract the content block (between {% block content %} and {% endblock %})
            content_match = re.search(
                r'{%\s*block\s+content\s*%}(.*?){%\s*endblock\s*%}',
                template_source,
                re.DOTALL
            )
            
            if not content_match:
                raise ValueError(f"No content block found in template {template_name}")
            
            content_html = content_match.group(1).strip()
            
            # Parse the HTML content
            soup = BeautifulSoup(content_html, 'html.parser')
            
            # Find the root element (should be a single container)
            root_elements = [elem for elem in soup.children if elem.name]
            
            if not root_elements:
                raise ValueError("No root HTML element found in template content")
            
            root_element = root_elements[0]
            
            # Parse the root element and its children
            layout_json = self._parse_element(root_element, template_source)
            
            return layout_json
            
        except Exception as e:
            raise Exception(f"Error parsing template {template_name}: {str(e)}")
    
    def _parse_element(self, element, template_source: str) -> Dict[str, Any]:
        """Parse a BeautifulSoup element into JSON node"""
        
        if isinstance(element, NavigableString):
            if isinstance(element, Comment):
                return None  # Skip comments in final output
            
            content = str(element).strip()
            if content:
                return {
                    "type": "text",
                    "content": content
                }
            return None
        
        # Regular HTML element
        node = {
            "type": "element",
            "tag": element.name
        }
        
        # Extract classes
        if element.get('class'):
            node["classes"] = ' '.join(element.get('class'))
        
        # Extract attributes (excluding widget slot attributes)
        attributes = {}
        slot_info = None
        
        for attr_name, attr_value in element.attrs.items():
            if attr_name.startswith('data-widget-slot'):
                # This is a slot element
                slot_info = {
                    "name": attr_value,
                    "title": element.get('data-slot-title', ''),
                    "description": element.get('data-slot-description', ''),
                }
                
                max_widgets = element.get('data-slot-max-widgets')
                if max_widgets:
                    try:
                        slot_info["maxWidgets"] = int(max_widgets)
                    except ValueError:
                        pass
                
                node["type"] = "slot"
                
            elif not attr_name.startswith('data-slot-'):
                # Regular attribute (not widget slot related)
                attributes[attr_name] = attr_value
        
        if attributes:
            node["attributes"] = attributes
        
        if slot_info:
            # Extract default widgets from template comments
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
    
    def _extract_default_widgets(self, element, template_source: str) -> Optional[List[Dict[str, Any]]]:
        """Extract default widgets from Django template comments within the element"""
        
        # Get the string representation of this element
        element_str = str(element)
        
        # Look for default widget comments within this element
        matches = self.default_widgets_pattern.findall(element_str)
        
        if not matches:
            return None
        
        # Parse the first match (there should only be one per slot)
        try:
            default_widgets_json = matches[0]
            default_widgets = json.loads(default_widgets_json)
            
            if isinstance(default_widgets, list):
                return default_widgets
                
        except (json.JSONDecodeError, IndexError):
            pass
        
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
            "structure": layout_json
        }
        
        return result