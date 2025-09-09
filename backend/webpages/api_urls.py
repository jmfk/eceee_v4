"""
API URL routing for the Web Page Publishing System

Provides RESTful endpoints for managing pages, layouts, themes, widgets, and versions.
This file contains only the API endpoints (DRF ViewSets) for inclusion in the main API.
"""

from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from rest_framework.urlpatterns import format_suffix_patterns
from .views import (
    WebPageViewSet,
    PageVersionViewSet,
    CodeLayoutViewSet,
    PageThemeViewSet,
    WidgetTypeViewSet,
    PageDataSchemaViewSet,
    layout_json,
    render_page_backend,
    render_page_preview,
)
from .views.simplified_layout_views import (
    simplified_layout_json,
    simplified_layouts_list,
    simplified_layout_schema,
    validate_simplified_layout,
)

# Create router and register viewsets
router = DefaultRouter()
router.register(r"pages", WebPageViewSet, basename="webpage")
router.register(r"versions", PageVersionViewSet, basename="pageversion")
# Phase 1.3: Enhanced layout endpoints with template data support
router.register(
    r"layouts", CodeLayoutViewSet, basename="layout"
)  # Unified endpoint for all layout operations
router.register(r"themes", PageThemeViewSet, basename="pagetheme")
# Widget-types will be handled with custom patterns to allow dots in widget type names
# router.register(r"widget-types", WidgetTypeViewSet, basename="widgettype")
router.register(r"page-data-schemas", PageDataSchemaViewSet, basename="pagedataschema")

# Custom widget-types patterns that allow dots in widget type names
widget_type_patterns = [
    re_path(
        r"^widget-types/$",
        WidgetTypeViewSet.as_view({"get": "list"}),
        name="widgettype-list",
    ),
    re_path(
        r"^widget-types/active/$",
        WidgetTypeViewSet.as_view({"get": "active"}),
        name="widgettype-active",
    ),
    re_path(
        r"^widget-types/(?P<pk>[^/]+)/$",
        WidgetTypeViewSet.as_view({"get": "retrieve"}),
        name="widgettype-detail",
    ),
    re_path(
        r"^widget-types/(?P<pk>[^/]+)/schema/$",
        WidgetTypeViewSet.as_view({"get": "schema"}),
        name="widgettype-schema",
    ),
    re_path(
        r"^widget-types/(?P<pk>[^/]+)/configuration-defaults/$",
        WidgetTypeViewSet.as_view({"get": "configuration_defaults"}),
        name="widgettype-configuration-defaults",
    ),
    re_path(
        r"^widget-types/(?P<pk>[^/]+)/validate/$",
        WidgetTypeViewSet.as_view({"post": "validate_widget_config"}),
        name="widgettype-validate-widget-config",
    ),
]

# API URLs without app_name to avoid namespace conflicts when included in main API
urlpatterns = [
    # Legacy layout JSON (Django template-based)
    path("layouts/<str:layout_name>/json/", layout_json, name="layout-json"),
    # New simplified layout JSON (React-optimized)
    path(
        "layouts/simplified/", simplified_layouts_list, name="simplified-layouts-list"
    ),
    path(
        "layouts/simplified/<str:layout_name>/",
        simplified_layout_json,
        name="simplified-layout-json",
    ),
    path(
        "layouts/simplified/schema/",
        simplified_layout_schema,
        name="simplified-layout-schema",
    ),
    path(
        "layouts/simplified/validate/",
        validate_simplified_layout,
        name="simplified-layout-validate",
    ),
    # Nested page-version endpoints (consistent path-based routing)
    path(
        "pages/<int:page_id>/versions/",
        PageVersionViewSet.as_view({"get": "by_page"}),
        name="page-versions-list",
    ),
    path(
        "pages/<int:page_id>/versions/current/",
        PageVersionViewSet.as_view({"get": "current_for_page"}),
        name="page-current-version",
    ),
    path(
        "pages/<int:page_id>/versions/latest/",
        PageVersionViewSet.as_view({"get": "latest_for_page"}),
        name="page-latest-version",
    ),
    path(
        "pages/<int:page_id>/versions/<int:pk>/",
        PageVersionViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="page-version-detail",
    ),
    # Backend rendering endpoints
    path("pages/<int:page_id>/render/", render_page_backend, name="page-render"),
    path(
        "pages/<int:page_id>/versions/<int:version_id>/render/",
        render_page_backend,
        name="page-version-render",
    ),
    path("pages/preview/", render_page_preview, name="page-preview"),
    path("", include(router.urls)),
] + widget_type_patterns
