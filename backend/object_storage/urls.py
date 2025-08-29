"""
URL Configuration for Object Storage System
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router and register our viewsets
router = DefaultRouter()
router.register(
    r"object-types", views.ObjectTypeDefinitionViewSet, basename="objecttypedefinition"
)
router.register(r"objects", views.ObjectInstanceViewSet, basename="objectinstance")
router.register(r"versions", views.ObjectVersionViewSet, basename="objectversion")

app_name = "object_storage"

urlpatterns = [
    path("api/", include(router.urls)),
]
