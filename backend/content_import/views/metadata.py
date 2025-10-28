"""Metadata extraction view for content import."""

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from content.models import Namespace, Tag
from ..services.openai_service import OpenAIService


logger = logging.getLogger(__name__)


class ExtractMetadataView(APIView):
    """Extract page metadata from HTML content."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Extract page title and tag suggestions from HTML.

        POST /api/content-import/extract-metadata/
        {
            "html": "<div>...</div>",
            "head_html": "<title>...</title><meta...>",
            "namespace": "default"
        }

        Returns:
            {
                "title": "Page Title",
                "suggested_tags": [
                    {
                        "name": "tag1",
                        "exists": true,
                        "usage_count": 5
                    },
                    ...
                ],
                "confidence": 0.85,
                "reasoning": "explanation"
            }
        """
        html = request.data.get("html", "")
        head_html = request.data.get("head_html", "")
        namespace_slug = request.data.get("namespace", "default")

        if not html:
            return Response(
                {"error": "HTML content is required"},
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

        try:
            # Get existing tags from the system (content.Tag, not file_manager.MediaTag)
            existing_tag_names = list(
                Tag.objects.filter(namespace=namespace)
                .order_by("-usage_count")
                .values_list("name", flat=True)[:100]
            )


            # Extract metadata using OpenAI
            openai_service = OpenAIService(user=request.user)
            if not openai_service.is_available():
                return Response(
                    {
                        "error": "AI service not available",
                        "title": "",
                        "suggested_tags": [],
                        "confidence": 0,
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

            metadata = openai_service.extract_page_metadata(
                html=html, head_html=head_html, existing_tags=existing_tag_names
            )

            if not metadata:
                return Response(
                    {
                        "error": "Failed to extract metadata",
                        "title": "",
                        "suggested_tags": [],
                        "confidence": 0,
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # Enrich tag suggestions with database information
            enriched_tags = []
            for tag_name in metadata.get("suggested_tags", []):
                # Check if tag exists in database
                try:
                    existing_tag = Tag.objects.get(
                        name__iexact=tag_name, namespace=namespace
                    )
                    enriched_tags.append(
                        {
                            "name": existing_tag.name,
                            "exists": True,
                            "usage_count": existing_tag.usage_count,
                            "id": existing_tag.id,
                        }
                    )
                except Tag.DoesNotExist:
                    # New tag
                    enriched_tags.append(
                        {
                            "name": tag_name,
                            "exists": False,
                            "usage_count": 0,
                            "id": None,
                        }
                    )

            return Response(
                {
                    "title": metadata.get("title", ""),
                    "suggested_tags": enriched_tags,
                    "confidence": metadata.get("confidence", 0.5),
                    "reasoning": metadata.get("reasoning", ""),
                }
            )

        except Exception as e:
            logger.error(f"Failed to extract metadata: {e}", exc_info=True)
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
