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
    PageLayoutViewSet,
    CodeLayoutViewSet,
    PageThemeViewSet,
    WidgetTypeViewSet,
    # PageWidgetViewSet,  # Temporarily disabled
)

# Create router and register viewsets
router = DefaultRouter()
router.register(r"pages", WebPageViewSet, basename="webpage")
router.register(r"versions", PageVersionViewSet, basename="pageversion")
router.register(r"layouts", PageLayoutViewSet, basename="pagelayout")
router.register(r"code-layouts", CodeLayoutViewSet, basename="codelayout")
router.register(r"themes", PageThemeViewSet, basename="pagetheme")
router.register(r"widget-types", WidgetTypeViewSet, basename="widgettype")
# router.register(r"widgets", PageWidgetViewSet, basename="pagewidget")  # Temporarily disabled

# API URLs without app_name to avoid namespace conflicts when included in main API
urlpatterns = [
    path("", include(router.urls)),
]
