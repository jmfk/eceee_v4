"""URL configuration for Content Import app."""

from django.urls import path
from .views import (
    CaptureScreenshotView,
    ExtractContentView,
    ExtractMetadataView,
    ProcessImportView,
    AnalyzeHierarchyView,
    ProxyPageView,
    ProxyAssetView,
    GenerateMediaMetadataView,
    UploadMediaFileView,
)


app_name = "content_import"

urlpatterns = [
    path("capture/", CaptureScreenshotView.as_view(), name="capture"),
    path("extract/", ExtractContentView.as_view(), name="extract"),
    path("extract-metadata/", ExtractMetadataView.as_view(), name="extract_metadata"),
    path("process/", ProcessImportView.as_view(), name="process"),
    path(
        "analyze-hierarchy/", AnalyzeHierarchyView.as_view(), name="analyze_hierarchy"
    ),
    path("proxy-page/", ProxyPageView.as_view(), name="proxy_page"),
    path("proxy-asset/", ProxyAssetView.as_view(), name="proxy_asset"),
    path(
        "generate-metadata/",
        GenerateMediaMetadataView.as_view(),
        name="generate_metadata",
    ),
    path("upload-media/", UploadMediaFileView.as_view(), name="upload_media"),
]
