"""
Widget template tags for the webpages app.

These tags provide utility functions for widget rendering in templates.
"""

from django import template
from django.utils.safestring import mark_safe
from django.template.loader import render_to_string
import json

register = template.Library()


@register.filter
def widget_css_classes(widget, default=''):
    """
    Get CSS classes for a widget.
    
    Usage:
        {{ widget|widget_css_classes:"default-class" }}
    """
    css_classes = []
    
    # Add widget type class
    if hasattr(widget, 'type'):
        css_classes.append(f"widget-{widget.type.lower().replace(' ', '-')}")
    
    # Add custom CSS classes from config
    if hasattr(widget, 'config') and widget.config.get('css_class'):
        css_classes.append(widget.config['css_class'])
    
    # Add default if no classes found
    if not css_classes and default:
        css_classes.append(default)
    
    return ' '.join(css_classes)


@register.filter
def get_item(dictionary, key):
    """
    Get an item from a dictionary using a variable as key.
    
    Usage:
        {{ mydict|get_item:item.name }}
    """
    if dictionary is None:
        return None
    return dictionary.get(key)


@register.filter
def json_script(value, element_id=None):
    """
    Output value as JSON inside a script tag.
    
    Usage:
        {{ widget.config|json_script:"widget-config" }}
    """
    json_str = json.dumps(value)
    if element_id:
        return mark_safe(
            f'<script id="{element_id}" type="application/json">{json_str}</script>'
        )
    return mark_safe(json_str)


@register.simple_tag
def widget_render(widget, context=None):
    """
    Render a widget with its template.
    
    Usage:
        {% widget_render widget %}
    """
    if not widget:
        return ''
    
    template_name = getattr(widget, 'template_name', None)
    if not template_name:
        return ''
    
    render_context = {
        'widget': widget,
        'config': getattr(widget, 'config', {}),
    }
    
    if context:
        render_context.update(context)
    
    try:
        return render_to_string(template_name, render_context)
    except Exception as e:
        return f'<!-- Widget render error: {e} -->'


@register.inclusion_tag('webpages/widgets/widget_wrapper.html')
def widget_wrapper(widget, slot='main', order=0):
    """
    Wrap a widget in a standard container.
    
    Usage:
        {% widget_wrapper widget slot="sidebar" order=1 %}
    """
    return {
        'widget': widget,
        'slot': slot,
        'order': order,
        'widget_id': f"widget-{slot}-{order}",
        'css_classes': widget_css_classes(widget),
    }


@register.filter
def widget_config_value(config, field_name):
    """
    Get a value from widget configuration.
    
    Usage:
        {{ widget.config|widget_config_value:"title" }}
    """
    if not config:
        return ''
    return config.get(field_name, '')


@register.filter
def widget_has_content(widget):
    """
    Check if a widget has any content configured.
    
    Usage:
        {% if widget|widget_has_content %}...{% endif %}
    """
    if not widget or not hasattr(widget, 'config'):
        return False
    
    config = widget.config
    if not config:
        return False
    
    # Check for common content fields
    content_fields = ['content', 'html_content', 'text', 'title', 'items', 'images']
    
    for field in content_fields:
        if config.get(field):
            return True
    
    return False