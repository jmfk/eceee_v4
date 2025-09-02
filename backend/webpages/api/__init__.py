"""
Widget API module for the webpages app.
"""

from .widget_api import (
    widget_types_list,
    widget_type_detail,
    validate_widget_configuration,
    render_widget_preview,
    get_page_widgets,
    create_widget,
    update_widget,
    delete_widget,
    reorder_widgets,
    duplicate_widget,
)

__all__ = [
    'widget_types_list',
    'widget_type_detail',
    'validate_widget_configuration',
    'render_widget_preview',
    'get_page_widgets',
    'create_widget',
    'update_widget',
    'delete_widget',
    'reorder_widgets',
    'duplicate_widget',
]