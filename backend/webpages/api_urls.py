"""
API URL routing for the Web Page Publishing System

Provides RESTful endpoints for managing pages, layouts, themes, widgets, and versions.
This file contains only the API endpoints (DRF ViewSets) for inclusion in the main API.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
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

# Create router and register viewsets
router = DefaultRouter()
router.register(r"pages", WebPageViewSet, basename="webpage")
router.register(r"versions", PageVersionViewSet, basename="pageversion")
# Phase 1.3: Enhanced layout endpoints with template data support
router.register(
    r"layouts", CodeLayoutViewSet, basename="layout"
)  # Unified endpoint for all layout operations
router.register(r"themes", PageThemeViewSet, basename="pagetheme")
router.register(r"widget-types", WidgetTypeViewSet, basename="widgettype")
router.register(r"page-data-schemas", PageDataSchemaViewSet, basename="pagedataschema")

# API URLs without app_name to avoid namespace conflicts when included in main API
urlpatterns = [
    path("layouts/<str:layout_name>/json/", layout_json, name="layout-json"),
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
]
