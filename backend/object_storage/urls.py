"""
URL Configuration for Object Storage System
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views
from .remote_views import (
    RemoteObjectCatalogView,
    RemoteObjectImportDetailView,
    RemoteObjectImportListView,
    RemoteObjectPreflightView,
    RemoteObjectSourceCatalogView,
    RemoteObjectSourceExportDetailView,
    RemoteObjectSourceExportDownloadView,
    RemoteObjectSourceExportListView,
    RemoteObjectSourcePreflightView,
)

# Create a router and register our viewsets
router = DefaultRouter()
router.register(r"object-types", views.ObjectTypeDefinitionViewSet, basename="objecttypedefinition")
router.register(r"objects", views.ObjectInstanceViewSet, basename="objectinstance")
router.register(r"versions", views.ObjectVersionViewSet, basename="objectversion")

app_name = "object_storage"

urlpatterns = [
    path("", include(router.urls)),
    path("upload-image/", views.upload_image, name="upload_image"),
    path("remote/catalog/", RemoteObjectCatalogView.as_view(), name="remote-object-catalog"),
    path("remote/preflight/", RemoteObjectPreflightView.as_view(), name="remote-object-preflight"),
    path("remote/imports/", RemoteObjectImportListView.as_view(), name="remote-object-imports"),
    path("remote/imports/<uuid:job_id>/", RemoteObjectImportDetailView.as_view(), name="remote-object-import-detail"),
    path("remote-source/catalog/", RemoteObjectSourceCatalogView.as_view(), name="remote-object-source-catalog"),
    path("remote-source/preflight/", RemoteObjectSourcePreflightView.as_view(), name="remote-object-source-preflight"),
    path("remote-source/exports/", RemoteObjectSourceExportListView.as_view(), name="remote-object-source-exports"),
    path(
        "remote-source/exports/<uuid:job_id>/",
        RemoteObjectSourceExportDetailView.as_view(),
        name="remote-object-source-export-detail",
    ),
    path(
        "remote-source/exports/<uuid:job_id>/download/",
        RemoteObjectSourceExportDownloadView.as_view(),
        name="remote-object-source-export-download",
    ),
]
