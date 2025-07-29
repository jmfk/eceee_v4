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
    layout_json,
)

# Create router and register viewsets
router = DefaultRouter()
router.register(r"pages", WebPageViewSet, basename="webpage")
router.register(r"versions", PageVersionViewSet, basename="pageversion")
# router.register(r"layouts", PageLayoutViewSet, basename="pagelayout")  # Removed - using code layouts only
router.register(r"code-layouts", CodeLayoutViewSet, basename="codelayout")
# Phase 1.3: Enhanced layout endpoints with template data support
router.register(
    r"layouts", CodeLayoutViewSet, basename="layout"
)  # New unified endpoint
router.register(r"themes", PageThemeViewSet, basename="pagetheme")
router.register(r"widget-types", WidgetTypeViewSet, basename="widgettype")

# API URLs without app_name to avoid namespace conflicts when included in main API
urlpatterns = [
    path("", include(router.urls)),
    path("layouts/<str:layout_name>/json/", layout_json, name="layout-json"),
]
