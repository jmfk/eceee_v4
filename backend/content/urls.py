"""
URL Configuration for Content Object Publishing System

Provides API endpoints for content objects that can be published as pages.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router and register our viewsets
router = DefaultRouter()
router.register(r"categories", views.CategoryViewSet)
router.register(r"tags", views.TagViewSet)
router.register(r"news", views.NewsViewSet)
router.register(r"events", views.EventViewSet)
router.register(r"library-items", views.LibraryItemViewSet)
router.register(r"members", views.MemberViewSet)

app_name = "content"

urlpatterns = [
    # API endpoints
    path("api/", include(router.urls)),
]
