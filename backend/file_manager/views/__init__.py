"""
File manager views package.

This package contains all the views for the file manager app, organized into
logical modules for better maintainability.
"""

from .media_file import MediaFileViewSet
from .pending_media import PendingMediaFileViewSet
from .upload import MediaUploadView
from .search import MediaSearchView, MediaAISuggestionsView
from .collections import MediaTagViewSet, MediaCollectionViewSet
from .utils import (
    MediaSlugValidationView,
    BulkMediaOperationsView,
    MediaFileBySlugView,
    MediaFileByUUIDView,
    MediaFileDownloadView,
    MediaFileProxyView,
)

__all__ = [
    "MediaFileViewSet",
    "PendingMediaFileViewSet",
    "MediaUploadView",
    "MediaSearchView",
    "MediaAISuggestionsView",
    "MediaTagViewSet",
    "MediaCollectionViewSet",
    "MediaSlugValidationView",
    "BulkMediaOperationsView",
    "MediaFileBySlugView",
    "MediaFileByUUIDView",
    "MediaFileDownloadView",
    "MediaFileProxyView",
]
