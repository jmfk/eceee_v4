"""
URL configuration for file manager API endpoints.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MediaFileViewSet,
    MediaTagViewSet,
    MediaCollectionViewSet,
    MediaUploadView,
    MediaSearchView,
    MediaAISuggestionsView,
    MediaFileBySlugView,
    MediaFileByUUIDView,
    MediaFileDownloadView,
)

app_name = "file_manager"

# Create router for ViewSets
router = DefaultRouter()
router.register(r"files", MediaFileViewSet, basename="mediafile")
router.register(r"tags", MediaTagViewSet, basename="mediatag")
router.register(r"collections", MediaCollectionViewSet, basename="mediacollection")

urlpatterns = [
    # Include router URLs
    path("", include(router.urls)),
    # Upload and search endpoints
    path("upload/", MediaUploadView.as_view(), name="media-upload"),
    path("search/", MediaSearchView.as_view(), name="media-search"),
    # AI and bulk operation endpoints
    path("ai-suggestions/", MediaAISuggestionsView.as_view(), name="ai-suggestions"),
    # path('bulk-operations/', BulkMediaOperationsView.as_view(), name='bulk-operations'),
    # SEO-friendly file access URLs
    path(
        "file/<slug:namespace_slug>/<slug:file_slug>/",
        MediaFileBySlugView.as_view(),
        name="media-file-by-slug",
    ),
    path(
        "file/<uuid:file_uuid>/",
        MediaFileByUUIDView.as_view(),
        name="media-file-by-uuid",
    ),
    path(
        "download/<slug:namespace_slug>/<slug:file_slug>/",
        MediaFileDownloadView.as_view(),
        name="media-file-download",
    ),
]
