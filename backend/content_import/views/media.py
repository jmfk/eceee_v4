"""Media processing views for content import."""

import hashlib
import logging
import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from content.models import Namespace
from file_manager.models import MediaFile
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
            "parent_html": "<div>...</div>",
            "namespace": "default"
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
            },
            "alreadyImported": false,
            "existingFileId": null,
            "existingFileTitle": null,
            "fileHash": "sha256hash"
        }
        """
        media_type = request.data.get("type")
        media_url = request.data.get("url") or request.data.get("src")
        namespace_slug = request.data.get("namespace", "default")

        if media_type not in ["image", "file"]:
            return Response(
                {"error": "Type must be 'image' or 'file'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not media_url:
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

        # Download file and compute hash to check for duplicates
        file_hash = None
        existing_file = None
        try:
            response = requests.get(media_url, timeout=30)
            response.raise_for_status()
            content = response.content

            # Compute SHA-256 hash
            file_hash = hashlib.sha256(content).hexdigest()

            # Check if file already exists in this namespace
            existing_file = MediaFile.objects.filter(
                file_hash=file_hash, namespace=namespace, is_deleted=False
            ).first()

        except Exception as e:
            logger.warning(f"Failed to download file for hash check: {e}")
            # Continue without hash check - file will be processed normally

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
                        "alreadyImported": existing_file is not None,
                        "existingFileId": (
                            str(existing_file.id) if existing_file else None
                        ),
                        "existingFileTitle": (
                            existing_file.title if existing_file else None
                        ),
                        "fileHash": file_hash,
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

                # Detect resolution (including 1x for standard images)
                # Always provide resolution info, defaulting to 1x if detection fails
                resolution_info = {
                    "multiplier": "1x",
                    "source": "original",
                    "dimensions": None,
                }
                image_url = request.data.get("url", "")
                if image_url:
                    try:
                        resolution_data = find_highest_resolution(
                            base_url=image_url,
                            srcset=None,  # Could be passed from frontend if available
                            check_patterns=True,
                            max_checks=10,
                        )
                        if resolution_data:
                            multiplier = resolution_data.get("multiplier", 1.0)
                            resolution_info = {
                                "multiplier": (
                                    f"{int(multiplier)}x"
                                    if multiplier == int(multiplier)
                                    else f"{multiplier:.1f}x"
                                ),
                                "source": resolution_data.get("source", "original"),
                                "dimensions": (
                                    f"{resolution_data['dimensions'][0]}x{resolution_data['dimensions'][1]}"
                                    if resolution_data.get("dimensions")
                                    else None
                                ),
                            }
                    except Exception as e:
                        logger.debug(
                            f"Resolution detection failed for {image_url}: {e}, using 1x"
                        )

                if metadata:
                    metadata["layout"] = layout
                    metadata["resolution"] = resolution_info
                    metadata["ai_generated"] = True
                    metadata["alreadyImported"] = existing_file is not None
                    metadata["existingFileId"] = (
                        str(existing_file.id) if existing_file else None
                    )
                    metadata["existingFileTitle"] = (
                        existing_file.title if existing_file else None
                    )
                    metadata["fileHash"] = file_hash
                    return Response(metadata)

            else:  # file
                metadata = openai_service.generate_file_metadata(
                    link_text=request.data.get("text", ""),
                    filename=request.data.get("filename", ""),
                    context=request.data.get("context", ""),
                )

                if metadata:
                    metadata["ai_generated"] = True
                    metadata["alreadyImported"] = existing_file is not None
                    metadata["existingFileId"] = (
                        str(existing_file.id) if existing_file else None
                    )
                    metadata["existingFileTitle"] = (
                        existing_file.title if existing_file else None
                    )
                    metadata["fileHash"] = file_hash
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
                    "description": f"Imported from {media_url[:100]}",
                    "tags": ["imported"],
                    "layout": None,
                    "ai_generated": False,
                    "alreadyImported": existing_file is not None,
                    "existingFileId": str(existing_file.id) if existing_file else None,
                    "existingFileTitle": existing_file.title if existing_file else None,
                    "fileHash": file_hash,
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
            "existingFileId": "uuid",  // Optional: if file already exists
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
            "was_reused": true/false,
            "tags": ["tag1", "tag2"]
        }
        """
        media_type = request.data.get("type")
        url = request.data.get("url")
        namespace_slug = request.data.get("namespace", "default")
        metadata = request.data.get("metadata", {})
        existing_file_id = request.data.get("existingFileId")

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

        # If existingFileId is provided, reuse the existing file and update tags
        if existing_file_id:
            try:
                existing_file = MediaFile.objects.get(
                    id=existing_file_id, namespace=namespace, is_deleted=False
                )

                # Update tags by merging with existing tags
                new_tags = metadata.get("tags", [])
                if new_tags:
                    from content.models import Tag

                    for tag_name in new_tags:
                        tag, _ = Tag.objects.get_or_create(
                            name=tag_name, namespace=namespace
                        )
                        if tag not in existing_file.tags.all():
                            existing_file.tags.add(tag)
                            tag.usage_count += 1
                            tag.save()

                tags = [tag.name for tag in existing_file.tags.all()[:10]]

                return Response(
                    {
                        "id": str(existing_file.id),
                        "title": existing_file.title,
                        "url": existing_file.file_url,
                        "file_hash": existing_file.file_hash,
                        "was_reused": True,
                        "tags": tags,
                        "description": existing_file.description,
                    }
                )

            except MediaFile.DoesNotExist:
                return Response(
                    {"error": "Existing file not found"},
                    status=status.HTTP_404_NOT_FOUND,
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
