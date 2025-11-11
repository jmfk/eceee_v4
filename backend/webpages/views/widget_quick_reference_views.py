"""
Widget Quick Reference API Views

Provides comprehensive widget documentation including:
- Configuration schemas
- Template parameters
- Code examples
- CSS variables
- Special features
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from webpages.widget_registry import widget_type_registry
from easy_widgets.widget_examples import get_widget_examples, get_all_widget_examples

import logging

logger = logging.getLogger(__name__)


def extract_template_parameters(widget_type):
    """
    Extract template parameters from widget configuration model.
    Returns a dictionary of parameter names to their descriptions and types.
    """
    parameters = {}
    
    # Get configuration model
    config_model = widget_type.configuration_model
    if not config_model:
        return parameters
    
    # Extract field information from Pydantic model
    for field_name, field_info in config_model.model_fields.items():
        # Get field type
        field_type = str(field_info.annotation).replace("<class '", "").replace("'>", "")
        if "typing." in field_type:
            field_type = field_type.replace("typing.", "")
        
        # Get description
        description = field_info.description or "No description available"
        
        # Get default value if present
        default_value = None
        if field_info.default is not None and field_info.default != ...:
            default_value = field_info.default
        elif hasattr(field_info, "default_factory") and field_info.default_factory:
            try:
                default_value = field_info.default_factory()
            except:
                default_value = "factory function"
        
        # Build parameter info
        param_key = f"config.{field_name}"
        parameters[param_key] = {
            "type": field_type,
            "description": description,
            "default": default_value,
            "required": field_info.is_required()
        }
    
    # Add computed/special parameters that are added in prepare_template_context
    # These are common across many widgets
    special_params = {
        "config._context": {
            "type": "dict",
            "description": "Full rendering context with page, theme, and inheritance data",
            "default": None,
            "required": False
        },
        "config._context.page": {
            "type": "WebPage",
            "description": "Current page object",
            "default": None,
            "required": False
        },
        "config._context.theme": {
            "type": "PageTheme",
            "description": "Effective theme for the page",
            "default": None,
            "required": False
        },
        "config._context.path_variables": {
            "type": "dict",
            "description": "URL path variables (for dynamic pages)",
            "default": {},
            "required": False
        }
    }
    
    # Add widget-specific computed parameters based on widget type
    widget_class_name = widget_type.__class__.__name__
    
    if widget_class_name == "ContentWidget":
        special_params["config.processed_content"] = {
            "type": "str",
            "description": "HTML content with media inserts and lightbox processed",
            "default": None,
            "required": False
        }
    elif widget_class_name == "HeroWidget":
        special_params["config.hero_style"] = {
            "type": "str",
            "description": "Computed CSS style string for hero colors and background",
            "default": "",
            "required": False
        }
        special_params["config.background_image_url"] = {
            "type": "str",
            "description": "Processed imgproxy URL for background image",
            "default": None,
            "required": False
        }
    elif widget_class_name == "ImageWidget":
        special_params["config.media_items"] = {
            "type": "list",
            "description": "Processed media items with resolved collection images",
            "default": [],
            "required": False
        }
    elif widget_class_name == "NavbarWidget":
        special_params["config.navbar_style"] = {
            "type": "str",
            "description": "Computed inline CSS styles for navbar",
            "default": "",
            "required": False
        }
        special_params["config.menu_items"] = {
            "type": "list",
            "description": "Filtered and sorted menu items",
            "default": [],
            "required": False
        }
    elif widget_class_name == "HeaderWidget":
        special_params["config.header_style"] = {
            "type": "str",
            "description": "Computed CSS variables for responsive header images",
            "default": "",
            "required": False
        }
    elif widget_class_name == "NavigationWidget":
        special_params["config.dynamic_menu_items"] = {
            "type": "list",
            "description": "Auto-generated menu items from page sections or child pages",
            "default": [],
            "required": False
        }
        special_params["config.owner_page"] = {
            "type": "dict",
            "description": "Page where this widget was defined (for inherited widgets)",
            "default": None,
            "required": False
        }
    elif widget_class_name in ["NewsListWidget", "SidebarTopNewsWidget", "TopNewsPlugWidget"]:
        special_params["config.news_items"] = {
            "type": "list",
            "description": "Queried and prepared news items",
            "default": [],
            "required": False
        }
    elif widget_class_name == "NewsDetailWidget":
        special_params["config.news_object"] = {
            "type": "ObjectInstance",
            "description": "The resolved news object",
            "default": None,
            "required": False
        }
        special_params["config.published_version"] = {
            "type": "ObjectVersion",
            "description": "The published version of the news object",
            "default": None,
            "required": False
        }
    
    parameters.update(special_params)
    
    return parameters


def extract_special_features(widget_type):
    """Extract special features and capabilities of the widget."""
    features = {
        "hasSpecialEditor": hasattr(widget_type, "special_editor") and widget_type.special_editor,
        "isContainer": widget_type.get_slot_definitions() is not None,
        "supportsComponentStyles": True,  # All widgets support this via render_with_style
        "hideConfigFormFields": getattr(widget_type, "hide_config_form_fields", False),
        "isDevelopmentOnly": getattr(widget_type, "is_development_only", False),
    }
    
    # Add container slot information if applicable
    if features["isContainer"]:
        features["slots"] = widget_type.get_slot_definitions()
    
    return features


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def widget_quick_reference_list(request):
    """
    Get quick reference data for all widgets.
    
    Returns comprehensive documentation for each widget including:
    - Configuration schema
    - Template parameters
    - Basic and advanced examples
    - CSS variables
    - Special features
    """
    try:
        # Get all widget types
        widgets = widget_type_registry.list_widget_types(active_only=True)
        
        # Get all examples
        all_examples = get_all_widget_examples()
        
        # Build response data
        widget_data = []
        for widget_type in widgets:
            # Skip if not an easy_widget
            if not widget_type.type.startswith("easy_widgets."):
                continue
            
            # Get configuration schema
            config_schema = widget_type.configuration_model.model_json_schema()
            
            # Get template parameters
            template_parameters = extract_template_parameters(widget_type)
            
            # Get examples
            examples = all_examples.get(widget_type.type, {})
            
            # Get special features
            special_features = extract_special_features(widget_type)
            
            # Build widget data
            widget_info = {
                "type": widget_type.type,
                "name": widget_type.name,
                "description": widget_type.description,
                "category": getattr(widget_type, "category", "general"),
                "configSchema": config_schema,
                "templateParameters": template_parameters,
                "specialFeatures": special_features,
                "examples": examples,
                "cssVariables": widget_type.css_variables,
                "cssScope": widget_type.css_scope,
                "templateName": widget_type.template_name,
            }
            
            widget_data.append(widget_info)
        
        return Response({
            "widgets": widget_data,
            "count": len(widget_data)
        })
        
    except Exception as e:
        logger.error(f"Error generating widget quick reference: {e}", exc_info=True)
        return Response(
            {"error": "Failed to generate widget quick reference"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def widget_quick_reference_detail(request, widget_type):
    """
    Get quick reference data for a specific widget type.
    
    Args:
        widget_type: Widget type identifier (e.g., "easy_widgets.ContentWidget")
    
    Returns:
        Comprehensive documentation for the specified widget
    """
    try:
        # Get widget type from registry
        widget = widget_type_registry.get_widget_type_by_type(widget_type)
        
        if not widget:
            return Response(
                {"error": f"Widget type '{widget_type}' not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get configuration schema
        config_schema = widget.configuration_model.model_json_schema()
        
        # Get template parameters
        template_parameters = extract_template_parameters(widget)
        
        # Get examples
        examples = get_widget_examples(widget_type)
        
        # Get special features
        special_features = extract_special_features(widget)
        
        # Build response data
        widget_data = {
            "type": widget.type,
            "name": widget.name,
            "description": widget.description,
            "category": getattr(widget, "category", "general"),
            "configSchema": config_schema,
            "templateParameters": template_parameters,
            "specialFeatures": special_features,
            "examples": examples,
            "cssVariables": widget.css_variables,
            "cssScope": widget.css_scope,
            "templateName": widget.template_name,
            "widgetClass": widget.__class__.__name__,
        }
        
        return Response(widget_data)
        
    except Exception as e:
        logger.error(f"Error generating widget quick reference for {widget_type}: {e}", exc_info=True)
        return Response(
            {"error": "Failed to generate widget quick reference"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

