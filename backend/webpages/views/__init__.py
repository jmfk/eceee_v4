"""
Web Pages Views Package

This package contains separate view files for each API endpoint to improve
code organization and maintainability.
"""

# Import all ViewSets and views for backward compatibility
from .code_layout_views import CodeLayoutViewSet
from .page_theme_views import PageThemeViewSet
from .widget_type_views import WidgetTypeViewSet
from .webpage_views import WebPageViewSet
from .page_version_views import PageVersionViewSet
from .page_data_schema_views import PageDataSchemaViewSet
from .rendering_views import layout_json, render_page_backend, render_page_preview

__all__ = [
    "CodeLayoutViewSet",
    "PageThemeViewSet",
    "WidgetTypeViewSet",
    "WebPageViewSet",
    "PageVersionViewSet",
    "PageDataSchemaViewSet",
    "layout_json",
    "render_page_backend",
    "render_page_preview",
]
