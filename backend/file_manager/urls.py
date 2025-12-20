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
    MediaFileProxyView,
    PendingMediaFileViewSet,
    MediaSlugValidationView,
    BulkMediaOperationsView,
)
from django.views.decorators.csrf import csrf_exempt
from .views.imgproxy_sign import sign_imgproxy_url, batch_sign_imgproxy_urls, generate_responsive_imgproxy_urls
from .views.table_import import import_table_view

app_name = "file_manager"

# Create router for ViewSets
router = DefaultRouter()
router.register(r"files", MediaFileViewSet, basename="mediafile")
router.register(r"tags", MediaTagViewSet, basename="mediatag")
router.register(r"collections", MediaCollectionViewSet, basename="mediacollection")
router.register(r"pending-files", PendingMediaFileViewSet, basename="pendingmediafile")

urlpatterns = [
    # Include router URLs
    path("", include(router.urls)),
    # Upload and search endpoints
    path("upload/", MediaUploadView.as_view(), name="media-upload"),
    path("search/", MediaSearchView.as_view(), name="media-search"),
    # AI and bulk operation endpoints
    path("ai-suggestions/", MediaAISuggestionsView.as_view(), name="ai-suggestions"),
    path("validate-slug/", MediaSlugValidationView.as_view(), name="validate-slug"),
    path("bulk-operations/", BulkMediaOperationsView.as_view(), name="bulk-operations"),
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
    # File proxy URL pattern (clean access)
    path(
        "proxy/<slug:namespace_slug>/<path:file_slug>",
        MediaFileProxyView.as_view(),
        name="media-file-proxy",
    ),
    # imgproxy URL signing endpoints (secure server-side signing)
    path(
        "imgproxy/sign/",
        csrf_exempt(sign_imgproxy_url),
        name="imgproxy-sign",
    ),
    path(
        "imgproxy/sign-batch/",
        csrf_exempt(batch_sign_imgproxy_urls),
        name="imgproxy-sign-batch",
    ),
    path(
        "imgproxy/responsive/",
        csrf_exempt(generate_responsive_imgproxy_urls),
        name="imgproxy-responsive",
    ),
    # Table import endpoint
    path(
        "import-table/",
        import_table_view,
        name="import-table",
    ),
]
