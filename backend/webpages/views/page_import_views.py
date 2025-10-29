"""Page import API views for importing external page trees."""

import logging
import uuid
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.core.cache import cache

from ..models import WebPage
from content.models import Namespace
from ..services.page_tree_importer import PageTreeImporter
from ..services.single_page_importer import SinglePageImporter


logger = logging.getLogger(__name__)


class ImportTreeView(APIView):
    """Start a page tree import from external URL."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """
        Start importing a page tree from external website.

        POST /api/v1/webpages/import-tree/
        Frontend sends (camelCase):
        {
            "url": "https://example.com/section",
            "parentPageId": 123,  # Optional, for subpage import
            "hostname": "example.com",  # Optional, for root page import
            "namespace": "default",  # Optional, defaults to "default"
            "maxDepth": 5,  # Optional, defaults to 5
            "maxPages": 100  # Optional, defaults to 100
        }

        Backend receives (converted to snake_case by CamelCaseJSONParser):
        {
            "url": "https://example.com/section",
            "parent_page_id": 123,
            "hostname": "example.com",
            "namespace": "default",
            "max_depth": 5,
            "max_pages": 100
        }

        Returns (converted to camelCase by CamelCaseJSONRenderer):
            {
                "taskId": "uuid",
                "status": "running",
                "progress": {...}
            }
        """
        # Get parameters (camelCase from frontend is converted to snake_case by CamelCaseJSONParser)
        url = request.data.get("url")
        parent_page_id = request.data.get("parent_page_id")
        hostname = request.data.get("hostname")
        namespace_slug = request.data.get("namespace", "default")
        max_depth = request.data.get("max_depth", 5)
        max_pages = request.data.get("max_pages", 100)
        request_delay = request.data.get("request_delay", 2.0)

        # Validate required parameters
        if not url:
            return Response(
                {"error": "URL is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Validate parent_page_id or hostname
        parent_page = None
        if parent_page_id:
            try:
                parent_page = WebPage.objects.get(id=parent_page_id, is_deleted=False)
            except WebPage.DoesNotExist:
                return Response(
                    {"error": "Parent page not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )
        elif not hostname:
            return Response(
                {"error": "Either parent_page_id or hostname is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get namespace
        try:
            if namespace_slug == "default":
                namespace = Namespace.get_default()
            else:
                namespace = Namespace.objects.get(slug=namespace_slug)
        except Namespace.DoesNotExist:
            return Response(
                {"error": "Invalid namespace"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Create task ID
        task_id = str(uuid.uuid4())

        # Start import (synchronously for now - could be async with Celery later)
        try:
            importer = PageTreeImporter(request.user, namespace)
            progress = importer.import_tree(
                start_url=url,
                parent_page=parent_page,
                hostname=hostname,
                max_depth=max_depth,
                max_pages=max_pages,
                request_delay=request_delay,
            )

            # Store progress in cache (expires in 1 hour)
            cache.set(f"import_progress_{task_id}", progress.to_dict(), 3600)

            return Response(
                {
                    "task_id": task_id,  # Will be converted to taskId by CamelCaseJSONRenderer
                    "status": progress.status,
                    "progress": progress.to_dict(),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            logger.error(f"Import failed: {e}")
            return Response(
                {"error": f"Import failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ImportStatusView(APIView):
    """Get status of an import task."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, task_id):
        """
        Get import task status and progress.

        GET /api/v1/webpages/import-tree/{task_id}/status/

        Backend returns (snake_case, converted to camelCase by renderer):
            {
                "status": "completed",
                "progress": {
                    "pages_discovered": 10,
                    "pages_created": 8,
                    "pages_skipped": 2,
                    "errors": [],
                    "current_url": null
                }
            }
        """
        # Get progress from cache
        progress = cache.get(f"import_progress_{task_id}")

        if not progress:
            return Response(
                {"error": "Import task not found"}, status=status.HTTP_404_NOT_FOUND
            )

        return Response(
            {"status": progress["status"], "progress": progress},
            status=status.HTTP_200_OK,
        )


class ImportSinglePageView(APIView):
    """Import a single page and return discovered links."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """
        Import a single page from external URL and return discovered links.

        POST /api/v1/webpages/pages/import-page/
        Frontend sends (camelCase):
        {
            "url": "https://example.com/page",
            "parentPageId": 123,  # Optional
            "hostname": "example.com",  # Optional, for root pages
            "namespace": "default",
            "baseUrl": "https://example.com/section",  # Filter discovered links
            "requestDelay": 2.0
        }

        Returns (camelCase via renderer):
        {
            "success": true,
            "page": {
                "id": 123,
                "slug": "page-slug",
                "title": "Page Title",
                "url": "https://example.com/page",
                "skipped": false
            },
            "discoveredUrls": ["https://example.com/page1", ...],
            "error": null
        }
        """
        # Get parameters
        url = request.data.get("url")
        parent_page_id = request.data.get("parent_page_id")
        hostname = request.data.get("hostname")
        namespace_slug = request.data.get("namespace", "default")
        base_url = request.data.get("base_url")
        request_delay = request.data.get("request_delay", 2.0)

        # Validate
        if not url:
            return Response(
                {"error": "URL is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get parent page if specified
        parent_page = None
        if parent_page_id:
            try:
                parent_page = WebPage.objects.get(id=parent_page_id, is_deleted=False)
            except WebPage.DoesNotExist:
                return Response(
                    {"error": "Parent page not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

        # Get namespace
        try:
            if namespace_slug == "default":
                namespace = Namespace.get_default()
            else:
                namespace = Namespace.objects.get(slug=namespace_slug)
        except Namespace.DoesNotExist:
            return Response(
                {"error": "Invalid namespace"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Import single page
        try:
            importer = SinglePageImporter(request.user, namespace, request_delay)
            result = importer.import_page(
                url=url,
                parent_page=parent_page,
                hostname=hostname,
                base_url=base_url,
            )

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Single page import failed: {e}")
            return Response(
                {"error": f"Import failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
