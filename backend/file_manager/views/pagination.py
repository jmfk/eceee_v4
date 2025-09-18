"""
Custom pagination classes for file manager views.
"""

from rest_framework.pagination import PageNumberPagination


class MediaFilePagination(PageNumberPagination):
    """Custom pagination for media files."""

    page_size = 20
    page_size_query_param = "pageSize"  # Allow frontend to specify page size
    max_page_size = 100
    page_query_param = "page"
