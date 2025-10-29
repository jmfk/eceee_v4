"""Media processing views for content import."""

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from content.models import Namespace
from ..services.openai_service import OpenAIService
from ..services.media_downloader import MediaDownloader
from ..utils.image_resolution import find_highest_resolution


logger = logging.getLogger(__name__)


class GenerateMediaMetadataView(APIView):
    """Generate metadata for an image or file using AI."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Generate AI metadata for a media file.

        POST /api/content-import/generate-metadata/
        {
            "type": "image",  // or "file"
            "src": "https://example.com/image.jpg",
            "alt": "Image description",
            "context": "Surrounding text...",
            "parent_classes": "img-center full-width",
            "parent_html": "<div>...</div>"
        }

        Returns:
        {
            "title": "Generated title",
            "description": "Generated description",
            "tags": ["tag1", "tag2"],
            "layout": {  // For images only
                "alignment": "center",
                "size": "medium",
                "caption": "",
                "display": "block"
            }
        }
        """
        media_type = request.data.get("type")

        if media_type not in ["image", "file"]:
            return Response(
                {"error": "Type must be 'image' or 'file'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            openai_service = OpenAIService(user=request.user)

            if not openai_service.is_available():
                return Response(
                    {
                        "title": request.data.get("alt", "Imported media"),
                        "description": "",
                        "tags": ["imported"],
                        "layout": None,
                        "ai_generated": False,
                    }
                )

            if media_type == "image":
                # Generate image metadata
                metadata = openai_service.generate_image_metadata(
                    alt_text=request.data.get("alt", ""),
                    filename=request.data.get("filename", ""),
                    filepath=request.data.get("filepath", ""),
                    context=request.data.get("context", ""),
                    page_title="",  # Not available in this endpoint (used during bulk import)
                    page_tags=[],
                    image_url=request.data.get("url", ""),
                    text=request.data.get("text", ""),
                )

                # Generate layout config
                layout = openai_service.analyze_image_layout(
                    img_element_html=request.data.get("html", ""),
                    surrounding_html=request.data.get("parent_html", ""),
                    parent_classes=request.data.get("parent_classes", ""),
                )

                # Detect high-resolution version
                resolution_info = None
                image_url = request.data.get("url", "")
                if image_url:
                    try:
                        resolution_data = find_highest_resolution(
                            base_url=image_url,
                            srcset=None,  # Could be passed from frontend if available
                            check_patterns=True,
                            max_checks=10,
                        )
                        if (
                            resolution_data
                            and resolution_data.get("multiplier", 1.0) > 1.0
                        ):
                            resolution_info = {
                                "multiplier": (
                                    f"{int(resolution_data['multiplier'])}x"
                                    if resolution_data["multiplier"]
                                    == int(resolution_data["multiplier"])
                                    else f"{resolution_data['multiplier']:.1f}x"
                                ),
                                "source": resolution_data.get("source", ""),
                                "dimensions": (
                                    f"{resolution_data['dimensions'][0]}x{resolution_data['dimensions'][1]}"
                                    if resolution_data.get("dimensions")
                                    else None
                                ),
                            }
                    except Exception as e:
                        logger.debug(
                            f"Resolution detection failed for {image_url}: {e}"
                        )

                if metadata:
                    metadata["layout"] = layout
                    metadata["resolution"] = resolution_info
                    metadata["ai_generated"] = True
                    return Response(metadata)

            else:  # file
                metadata = openai_service.generate_file_metadata(
                    link_text=request.data.get("text", ""),
                    filename=request.data.get("filename", ""),
                    context=request.data.get("context", ""),
                )

                if metadata:
                    metadata["ai_generated"] = True
                    return Response(metadata)

            # Fallback if AI generation fails - use provided text
            fallback_title = (
                request.data.get("alt", "")
                or request.data.get("text", "")
                or request.data.get("filename", "")
                or "Imported media"
            )

            return Response(
                {
                    "title": fallback_title,
                    "description": f"Imported from {request.data.get('url', 'external source')[:100]}",
                    "tags": ["imported"],
                    "layout": None,
                    "ai_generated": False,
                }
            )

        except Exception as e:
            logger.error(f"Failed to generate metadata: {e}")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UploadMediaFileView(APIView):
    """Upload a single media file from external URL."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """
        Download and upload a media file.

        POST /api/content-import/upload-media/
        {
            "type": "image",  // or "file"
            "url": "https://example.com/image.jpg",
            "namespace": "default",
            "metadata": {
                "title": "Generated title",
                "description": "Description",
                "tags": ["tag1", "tag2"],
                "layout": {...}  // For images only
            }
        }

        Returns:
        {
            "id": "uuid",
            "title": "Title",
            "url": "media-manager-url",
            "file_hash": "sha256hash",
            "was_reused": false,
            "tags": ["tag1", "tag2"]
        }
        """
        media_type = request.data.get("type")
        url = request.data.get("url")
        namespace_slug = request.data.get("namespace", "default")
        metadata = request.data.get("metadata", {})

        if not url:
            return Response(
                {"error": "URL is required"}, status=status.HTTP_400_BAD_REQUEST
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
            # Pass metadata with pre-approved tags to MediaDownloader
            page_metadata = {
                "title": metadata.get("title", ""),
                "tags": metadata.get("tags", []),  # Pre-approved tags from frontend
            }
            media_downloader = MediaDownloader(request.user, namespace, page_metadata)

            if media_type == "image":
                image_data = {
                    "src": url,
                    "alt": metadata.get("title", ""),
                    "title": metadata.get("title", ""),
                    "context": metadata.get("description", ""),
                    "html": f'<img src="{url}" alt="{metadata.get("title", "")}" />',
                    "parent_html": "",
                    "parent_classes": "",
                    "use_provided_tags": True,  # Signal to use provided tags instead of AI generation
                }

                media_file = media_downloader.download_image(image_data, base_url="")

            else:  # file
                file_data = {
                    "url": url,
                    "text": metadata.get("title", ""),
                    "title": metadata.get("title", ""),
                    "extension": url.split(".")[-1] if "." in url else "",
                    "context": metadata.get("description", ""),
                }

                media_file = media_downloader.download_file(file_data, base_url="")

            if not media_file:
                return Response(
                    {"error": "Failed to upload media file"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

            # Note: metadata and tags are already handled by media_downloader

            # Check if reused
            from django.utils import timezone

            was_reused = (timezone.now() - media_file.created_at).total_seconds() > 10

            tags = [tag.name for tag in media_file.tags.all()[:10]]

            return Response(
                {
                    "id": str(media_file.id),
                    "title": media_file.title,
                    "url": media_file.file_url,
                    "file_hash": media_file.file_hash,
                    "was_reused": was_reused,
                    "tags": tags,
                    "description": media_file.description,
                }
            )

        except Exception as e:
            logger.error(f"Failed to upload media file: {e}")
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
