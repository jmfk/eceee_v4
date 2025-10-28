"""Media downloader service for importing images and files."""

import os
import logging
import tempfile
import requests
from typing import Dict, Any, Optional, List
from urllib.parse import urljoin, urlparse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User

from file_manager.services.upload_service import FileUploadService
from file_manager.models import MediaFile, MediaTag
from content.models import Namespace
from .openai_service import OpenAIService


logger = logging.getLogger(__name__)


# File size limits (in bytes)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB per file
MAX_TOTAL_SIZE = 150 * 1024 * 1024  # 150MB total per import


class MediaDownloadResult:
    """Result of media download operation."""

    def __init__(self):
        self.downloaded_files = []
        self.failed_files = []
        self.total_size = 0
        self.url_mapping = {}  # Maps original URLs to media manager URLs

    def add_success(self, original_url: str, media_file: MediaFile):
        """Add successful download."""
        self.downloaded_files.append(
            {
                "original_url": original_url,
                "media_file": media_file,
            }
        )
        self.url_mapping[original_url] = media_file.file_url

    def add_failure(self, original_url: str, error: str):
        """Add failed download."""
        self.failed_files.append(
            {
                "url": original_url,
                "error": error,
            }
        )


class MediaDownloader:
    """Download and import media files from external sources."""

    def __init__(
        self, user: User, namespace: Namespace, page_metadata: Dict[str, Any] = None
    ):
        """
        Initialize media downloader.

        Args:
            user: User performing the import
            namespace: Namespace for imported media
            page_metadata: Dictionary with page title and tags for context
        """
        self.user = user
        self.namespace = namespace
        self.page_metadata = page_metadata or {}
        self.upload_service = FileUploadService()
        self.openai_service = OpenAIService(user=user)
        self.total_downloaded = 0

    def download_image(
        self, image_data: Dict[str, Any], base_url: str = ""
    ) -> Optional[MediaFile]:
        """
        Download and import an image, or reuse existing if already imported.

        Args:
            image_data: Dictionary with image information (src, alt, title, context)
            base_url: Base URL for resolving relative URLs

        Returns:
            MediaFile object or None if download failed
        """
        src = image_data.get("src", "")
        if not src:
            logger.warning("Image has no src attribute")
            return None

        # Resolve relative URLs
        if base_url and not src.startswith(("http://", "https://", "data:")):
            src = urljoin(base_url, src)

        # Skip data URLs for now
        if src.startswith("data:"):
            return None

        try:
            # Download image to check hash
            response = requests.get(src, timeout=30, stream=True)
            response.raise_for_status()

            # Read content
            content = response.content

            # Check if image already exists by hash
            import hashlib

            file_hash = hashlib.sha256(content).hexdigest()

            existing_file = MediaFile.objects.filter(
                file_hash=file_hash, namespace=self.namespace
            ).first()

            if existing_file:

                # Still apply AI layout analysis for this usage
                if self.openai_service.is_available():
                    layout_config = self.openai_service.analyze_image_layout(
                        img_element_html=image_data.get("html", ""),
                        surrounding_html=image_data.get("parent_html", ""),
                        parent_classes=image_data.get("parent_classes", ""),
                    )
                    existing_file._import_layout_config = layout_config

                return existing_file

            # Check size
            content_length = int(response.headers.get("content-length", 0))
            if content_length > MAX_FILE_SIZE:
                logger.warning(f"Image too large: {content_length} bytes")
                return None

            # Check total size limit
            if self.total_downloaded + content_length > MAX_TOTAL_SIZE:
                logger.warning(f"Total download size limit exceeded")
                return None

            # Get filename from URL
            filename = self._get_filename_from_url(src)

            # Track downloaded size
            self.total_downloaded += len(content)

            # Generate metadata with AI first (before creating file object)
            # UNLESS we're using pre-approved tags from the frontend
            metadata = None
            use_provided_tags = image_data.get("use_provided_tags", False)

            if not use_provided_tags and self.openai_service.is_available():
                # Extract filepath from URL
                from urllib.parse import urlparse, parse_qs

                parsed = urlparse(src)

                # Handle proxy URLs - extract filepath from actual URL
                if "proxy-asset" in parsed.path and parsed.query:
                    query_params = parse_qs(parsed.query)
                    if "url" in query_params:
                        actual_url = query_params["url"][0]
                        actual_parsed = urlparse(actual_url)
                        filepath = os.path.dirname(actual_parsed.path)
                    else:
                        filepath = "/"
                else:
                    filepath = os.path.dirname(parsed.path) if parsed.path else "/"

                metadata = self.openai_service.generate_image_metadata(
                    alt_text=image_data.get("alt", ""),
                    filename=filename,
                    filepath=filepath,  # Directory path with context
                    context=image_data.get("context", ""),
                    page_title=self.page_metadata.get("title", ""),
                    page_tags=self.page_metadata.get("tags", []),
                    image_url=src,  # Include full URL/path for better context
                    text=image_data.get("alt", ""),  # Alt text for generic detection
                )

            # Create uploaded file AFTER AI analysis (fresh file object for upload)
            uploaded_file = SimpleUploadedFile(
                filename,
                content,  # Use the raw content we downloaded
                content_type=response.headers.get("content-type", "image/jpeg"),
            )

            # Upload to media manager (creates PendingMediaFile)
            # Skip FileUploadService AI analysis since we already did better analysis with page context
            upload_result = self.upload_service.upload(
                uploaded_file,
                folder_path="imported",
                namespace=self.namespace,
                user=self.user,
                skip_ai_analysis=True,  # We already did richer AI analysis above
            )

            if upload_result.files:
                pending_file_data = upload_result.files[0]
                pending_file_id = pending_file_data["id"]

                # Get the PendingMediaFile object
                from file_manager.models import PendingMediaFile

                pending_file = PendingMediaFile.objects.get(id=pending_file_id)

                # Prepare title and description
                title = metadata.get("title", filename) if metadata else filename
                description = metadata.get("description", "") if metadata else ""

                # Auto-approve and create MediaFile
                media_file = pending_file.approve_and_create_media_file(
                    title=title, description=description, access_level="public"
                )

                # Handle tags based on whether they're pre-approved or AI-generated
                if use_provided_tags:
                    # Use pre-approved tags from frontend (page tags + approved AI tags + custom tags)
                    # These are already merged and deduplicated in the frontend
                    all_tags = self.page_metadata.get("tags", [])
                    if all_tags:
                        self._add_tags(media_file, all_tags)
                else:
                    # Original AI workflow: Add page tags first, then AI-generated tags
                    page_tags = self.page_metadata.get("tags", [])
                    if page_tags:
                        self._add_tags(media_file, page_tags)

                    # Add AI-selected tags (additional to page tags)
                    # Filter out tags that are already in page_tags to avoid redundant AI calls
                    if metadata and metadata.get("tags"):
                        ai_tags = metadata.get("tags", [])
                        # Remove tags that are already in page_tags (case-insensitive)
                        page_tags_lower = [t.lower() for t in page_tags]
                        unique_ai_tags = [
                            t for t in ai_tags if t.lower() not in page_tags_lower
                        ]

                        if unique_ai_tags:
                            self._select_and_add_tags(
                                media_file,
                                potential_tags=unique_ai_tags,
                                description=description or title,
                            )
                        else:
                            pass  # No unique AI tags to add

                # Always add "imported" tag
                self._add_tags(media_file, ["imported"])

                # Analyze image layout with AI
                layout_config = None
                if self.openai_service.is_available():
                    layout_config = self.openai_service.analyze_image_layout(
                        img_element_html=image_data.get("html", ""),
                        surrounding_html=image_data.get("parent_html", ""),
                        parent_classes=image_data.get("parent_classes", ""),
                    )

                # Store layout config for later use
                media_file._import_layout_config = layout_config

                return media_file

        except Exception as e:
            logger.error(f"Failed to download image from {src}: {e}")

        return None

    def download_file(
        self, file_data: Dict[str, Any], base_url: str = ""
    ) -> Optional[MediaFile]:
        """
        Download and import a file, or reuse existing if already imported.

        Args:
            file_data: Dictionary with file information (url, text, extension, context)
            base_url: Base URL for resolving relative URLs

        Returns:
            MediaFile object or None if download failed
        """
        url = file_data.get("url", "")
        if not url:
            logger.warning("File has no URL")
            return None

        # Resolve relative URLs
        if base_url and not url.startswith(("http://", "https://")):
            url = urljoin(base_url, url)

        try:
            # Download file to check hash
            response = requests.get(url, timeout=60, stream=True)
            response.raise_for_status()

            # Read content
            content = response.content

            # Check if file already exists by hash
            import hashlib

            file_hash = hashlib.sha256(content).hexdigest()

            existing_file = MediaFile.objects.filter(
                file_hash=file_hash, namespace=self.namespace
            ).first()

            if existing_file:
                return existing_file

            # Check size
            content_length = int(response.headers.get("content-length", 0))
            if content_length > MAX_FILE_SIZE:
                logger.warning(f"File too large: {content_length} bytes")
                return None

            # Check total size limit
            if self.total_downloaded + content_length > MAX_TOTAL_SIZE:
                logger.warning(f"Total download size limit exceeded")
                return None

            # Get filename from URL
            filename = self._get_filename_from_url(url)

            # Track downloaded size
            self.total_downloaded += len(content)

            # Create uploaded file
            uploaded_file = SimpleUploadedFile(
                filename,
                content,
                content_type=response.headers.get(
                    "content-type", "application/octet-stream"
                ),
            )

            # Generate metadata with AI
            metadata = None
            if self.openai_service.is_available():
                metadata = self.openai_service.generate_file_metadata(
                    link_text=file_data.get("text", ""),
                    filename=filename,
                    context=file_data.get("context", ""),
                )

            # Upload to media manager (creates PendingMediaFile)
            # Skip FileUploadService AI analysis since we already did our own analysis
            upload_result = self.upload_service.upload(
                uploaded_file,
                folder_path="imported",
                namespace=self.namespace,
                user=self.user,
                skip_ai_analysis=True,  # We already did AI analysis above
            )

            if upload_result.files:
                pending_file_data = upload_result.files[0]
                pending_file_id = pending_file_data["id"]

                # Get the PendingMediaFile object
                from file_manager.models import PendingMediaFile

                pending_file = PendingMediaFile.objects.get(id=pending_file_id)

                # Prepare title and description
                title = metadata.get("title", filename) if metadata else filename
                description = metadata.get("description", "") if metadata else ""

                # Auto-approve and create MediaFile
                media_file = pending_file.approve_and_create_media_file(
                    title=title, description=description, access_level="public"
                )

                # Add page tags first (these are confirmed/selected by user)
                page_tags = self.page_metadata.get("tags", [])
                if page_tags:
                    self._add_tags(media_file, page_tags)

                # Add AI-selected tags (additional to page tags)
                # Filter out tags that are already in page_tags to avoid redundant AI calls
                if metadata and metadata.get("tags"):
                    ai_tags = metadata.get("tags", [])
                    # Remove tags that are already in page_tags (case-insensitive)
                    page_tags_lower = [t.lower() for t in page_tags]
                    unique_ai_tags = [
                        t for t in ai_tags if t.lower() not in page_tags_lower
                    ]

                    if unique_ai_tags:
                        self._select_and_add_tags(
                            media_file,
                            potential_tags=unique_ai_tags,
                            description=description or title,
                        )
                    else:
                        pass  # No unique AI tags to add

                # Always add "imported" tag
                self._add_tags(media_file, ["imported"])

                return media_file

        except Exception as e:
            logger.error(f"Failed to download file from {url}: {e}")

        return None

    def _get_filename_from_url(self, url: str) -> str:
        """Extract filename from URL, handling proxy URLs."""
        from urllib.parse import parse_qs

        parsed = urlparse(url)

        # Check if this is a proxy URL with actual URL in query param
        if "proxy-asset" in parsed.path and parsed.query:
            # Extract the actual URL from the query parameter
            query_params = parse_qs(parsed.query)
            if "url" in query_params:
                actual_url = query_params["url"][0]
                # Parse the actual URL
                actual_parsed = urlparse(actual_url)
                filename = os.path.basename(actual_parsed.path)
                if filename:
                    return filename

        # Normal URL - extract from path
        filename = os.path.basename(parsed.path)

        if not filename:
            filename = "downloaded_file"
            logger.warning(
                f"Could not extract filename from URL: {url[:100]}, using default"
            )

        return filename

    def _find_similar_existing_tags(self, potential_tags: List[str]) -> List[str]:
        """
        Find existing tags in the namespace that are similar to potential tags.

        Args:
            potential_tags: List of potential tag names

        Returns:
            List of existing tag names that might be similar
        """
        # Get all existing tags in this namespace
        existing_tags = MediaTag.objects.filter(namespace=self.namespace).values_list(
            "name", flat=True
        )

        # For simple implementation, return all tags
        # AI will determine which are actually similar and useful
        # Limit to 50 most recently used tags to keep prompt manageable
        return list(existing_tags[:50])

    def _select_and_add_tags(
        self, media_file: MediaFile, potential_tags: List[str], description: str = ""
    ):
        """
        Use AI to select best tags from potential and existing, then add them.

        Args:
            media_file: MediaFile to tag
            potential_tags: AI-generated potential tags
            description: Description of the item for context
        """
        if not potential_tags:
            return

        # Step 1: Get similar existing tags
        existing_tags = self._find_similar_existing_tags(potential_tags)

        # Step 2: Use AI to select best combination
        selected_tags = self.openai_service.select_best_tags(
            potential_tags=potential_tags,
            existing_tags=existing_tags,
            item_description=description or media_file.title or "Media file",
            max_tags=5,
        )

        # Step 3: Add the selected tags
        for tag_name in selected_tags:
            if not tag_name:
                continue

            # Get or create tag in the namespace
            tag, created = MediaTag.objects.get_or_create(
                name=tag_name.lower()[:50],  # Truncate to max length
                namespace=self.namespace,
                defaults={"created_by": self.user},
            )

            # Add tag to media file
            media_file.tags.add(tag)

    def _add_tags(self, media_file: MediaFile, tag_names: List[str]):
        """
        Add tags to a media file (simple version without AI selection).

        Args:
            media_file: MediaFile to tag
            tag_names: List of tag names
        """
        for tag_name in tag_names:
            if not tag_name:
                continue

            # Get or create tag in the namespace
            tag, created = MediaTag.objects.get_or_create(
                name=tag_name.lower()[:50],  # Truncate to max length
                namespace=self.namespace,
                defaults={"created_by": self.user},
            )

            # Add tag to media file
            media_file.tags.add(tag)
