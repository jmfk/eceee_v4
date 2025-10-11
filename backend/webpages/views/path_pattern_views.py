"""
Path Pattern ViewSet

API endpoints for accessing path pattern registry information.
"""

from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import Http404

from ..path_pattern_registry import path_pattern_registry


class PathPatternViewSet(viewsets.ViewSet):
    """
    ViewSet for path pattern operations.

    Provides read-only access to registered path patterns.
    """

    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        """
        List all registered path patterns with their metadata.

        Query Parameters:
            page_id: Optional page ID to contextualize example URLs

        Returns:
            List of pattern dictionaries containing:
            - key: unique identifier
            - name: human-readable name
            - description: when to use this pattern
            - regex_pattern: the actual regex
            - example_url: example matching URL
            - contextualized_example: full URL with page context (if page_id provided)
            - extracted_variables: metadata about captured variables
        """
        patterns = path_pattern_registry.to_dict()

        # Check if page_id is provided for contextualization
        page_id = request.query_params.get("page_id")
        if page_id:
            from ..models import WebPage

            try:
                page = WebPage.objects.select_related("parent").get(id=page_id)
                patterns = self._contextualize_patterns(patterns, page, request)
            except WebPage.DoesNotExist:
                pass  # Return patterns without contextualization

        return Response(
            {
                "count": len(patterns),
                "patterns": patterns,
            }
        )

    def _contextualize_patterns(self, patterns, page, request):
        """
        Add contextualized example URLs to patterns based on the page.

        Args:
            patterns: List of pattern dictionaries
            page: WebPage instance
            request: HTTP request

        Returns:
            List of patterns with contextualized_example added
        """
        # Get hostname from root page
        root_page = page
        while root_page.parent:
            root_page = root_page.parent

        # Get first hostname from root page (or use request host as fallback)
        if root_page.hostnames:
            hostname = root_page.hostnames[0]
        else:
            hostname = request.get_host()

        # Build page path (slug hierarchy)
        page_path = page.get_absolute_url()
        if page_path.startswith("/"):
            page_path = page_path[1:]  # Remove leading slash
        if not page_path.endswith("/") and page_path:
            page_path += "/"

        # Build base URL
        protocol = "https" if request.is_secure() else "http"
        # Handle empty page_path (root page with silent slug)
        if page_path:
            base_url = f"{protocol}://{hostname}/{page_path}"
        else:
            base_url = f"{protocol}://{hostname}/"

        # Add contextualized examples to each pattern
        # Using snake_case - DRF camelCase renderer will convert it
        for pattern in patterns:
            example_url = pattern.get("example_url", "")
            pattern["contextualized_example"] = f"{base_url}{example_url}"

        return patterns

    def retrieve(self, request, pk=None):
        """
        Get details for a specific path pattern.

        Args:
            pk: The pattern key

        Returns:
            Pattern dictionary with all metadata
        """
        pattern = path_pattern_registry.get_pattern(pk)
        if not pattern:
            raise Http404(f"Path pattern '{pk}' not found")

        return Response(pattern.to_dict())

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        """
        Validate a path against a specific pattern.

        Args:
            pk: The pattern key
            path: The URL path to validate (in request body)

        Returns:
            Dict with:
            - valid: boolean
            - variables: extracted variables if valid
            - error: error message if invalid
        """
        pattern = path_pattern_registry.get_pattern(pk)
        if not pattern:
            raise Http404(f"Path pattern '{pk}' not found")

        path = request.data.get("path", "")
        if not path:
            return Response(
                {
                    "valid": False,
                    "error": "No path provided",
                }
            )

        try:
            variables = pattern.validate_match(path)
            if variables is not None:
                return Response(
                    {
                        "valid": True,
                        "variables": variables,
                    }
                )
            else:
                return Response(
                    {
                        "valid": False,
                        "error": "Path does not match pattern",
                    }
                )
        except Exception as e:
            return Response(
                {
                    "valid": False,
                    "error": str(e),
                }
            )
