"""
Web Pages Views Package

This package contains separate view files for each API endpoint to improve
code organization and maintainability.
"""

# Import all ViewSets and views for backward compatibility
from .code_layout_views import CodeLayoutViewSet
from .link_views import link_display_info, page_lookup, resolve_links
from .page_data_schema_views import PageDataSchemaViewSet
from .page_theme_views import PageThemeViewSet
from .page_version_views import PageVersionViewSet
from .rendering_views import layout_json, render_page_backend, render_page_preview
from .site_package_views import (
    SitePackageAssessmentView,
    SitePackageExportDetailView,
    SitePackageExportDownloadView,
    SitePackageExportListView,
    SitePackageImportDetailView,
    SitePackageImportListView,
)
from .webpage_views import WebPageViewSet
from .widget_type_views import WidgetTypeViewSet

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
    "resolve_links",
    "link_display_info",
    "page_lookup",
    "SitePackageExportDetailView",
    "SitePackageExportDownloadView",
    "SitePackageExportListView",
    "SitePackageImportDetailView",
    "SitePackageImportListView",
    "SitePackageAssessmentView",
]
