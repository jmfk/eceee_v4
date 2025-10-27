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
        self.downloaded_files.append({
            'original_url': original_url,
            'media_file': media_file,
        })
        self.url_mapping[original_url] = media_file.file_url
    
    def add_failure(self, original_url: str, error: str):
        """Add failed download."""
        self.failed_files.append({
            'url': original_url,
            'error': error,
        })


class MediaDownloader:
    """Download and import media files from external sources."""
    
    def __init__(self, user: User, namespace: Namespace):
        """
        Initialize media downloader.
        
        Args:
            user: User performing the import
            namespace: Namespace for imported media
        """
        self.user = user
        self.namespace = namespace
        self.upload_service = FileUploadService()
        self.openai_service = OpenAIService()
        self.total_downloaded = 0
    
    def download_image(
        self,
        image_data: Dict[str, Any],
        base_url: str = ""
    ) -> Optional[MediaFile]:
        """
        Download and import an image.
        
        Args:
            image_data: Dictionary with image information (src, alt, title, context)
            base_url: Base URL for resolving relative URLs
        
        Returns:
            MediaFile object or None if download failed
        """
        src = image_data.get('src', '')
        if not src:
            logger.warning("Image has no src attribute")
            return None
        
        # Resolve relative URLs
        if base_url and not src.startswith(('http://', 'https://', 'data:')):
            src = urljoin(base_url, src)
        
        # Skip data URLs for now
        if src.startswith('data:'):
            logger.info("Skipping data URL image")
            return None
        
        try:
            # Download image
            response = requests.get(src, timeout=30, stream=True)
            response.raise_for_status()
            
            # Check size
            content_length = int(response.headers.get('content-length', 0))
            if content_length > MAX_FILE_SIZE:
                logger.warning(f"Image too large: {content_length} bytes")
                return None
            
            # Check total size limit
            if self.total_downloaded + content_length > MAX_TOTAL_SIZE:
                logger.warning(f"Total download size limit exceeded")
                return None
            
            # Get filename from URL
            filename = self._get_filename_from_url(src)
            
            # Read content
            content = response.content
            self.total_downloaded += len(content)
            
            # Create uploaded file
            uploaded_file = SimpleUploadedFile(
                filename,
                content,
                content_type=response.headers.get('content-type', 'image/jpeg')
            )
            
            # Generate metadata with AI
            metadata = None
            if self.openai_service.is_available():
                metadata = self.openai_service.generate_image_metadata(
                    alt_text=image_data.get('alt', ''),
                    filename=filename,
                    context=image_data.get('context', '')
                )
            
            # Upload to media manager
            upload_result = self.upload_service.upload(
                uploaded_file,
                folder_path="imported",
                namespace=self.namespace,
                user=self.user,
            )
            
            if upload_result.files:
                media_file = upload_result.files[0]
                
                # Update with AI metadata if available
                if metadata:
                    if not media_file.title or media_file.title == filename:
                        media_file.title = metadata.get('title', filename)
                    if not media_file.description:
                        media_file.description = metadata.get('description', '')
                    media_file.ai_suggested_title = metadata.get('title', '')
                    media_file.save()
                    
                    # Add AI tags
                    self._add_tags(media_file, metadata.get('tags', []))
                
                # Always add "imported" tag
                self._add_tags(media_file, ['imported'])
                
                logger.info(f"Successfully imported image: {filename}")
                return media_file
            
        except Exception as e:
            logger.error(f"Failed to download image from {src}: {e}")
        
        return None
    
    def download_file(
        self,
        file_data: Dict[str, Any],
        base_url: str = ""
    ) -> Optional[MediaFile]:
        """
        Download and import a file.
        
        Args:
            file_data: Dictionary with file information (url, text, extension, context)
            base_url: Base URL for resolving relative URLs
        
        Returns:
            MediaFile object or None if download failed
        """
        url = file_data.get('url', '')
        if not url:
            logger.warning("File has no URL")
            return None
        
        # Resolve relative URLs
        if base_url and not url.startswith(('http://', 'https://')):
            url = urljoin(base_url, url)
        
        try:
            # Download file
            response = requests.get(url, timeout=60, stream=True)
            response.raise_for_status()
            
            # Check size
            content_length = int(response.headers.get('content-length', 0))
            if content_length > MAX_FILE_SIZE:
                logger.warning(f"File too large: {content_length} bytes")
                return None
            
            # Check total size limit
            if self.total_downloaded + content_length > MAX_TOTAL_SIZE:
                logger.warning(f"Total download size limit exceeded")
                return None
            
            # Get filename from URL
            filename = self._get_filename_from_url(url)
            
            # Read content
            content = response.content
            self.total_downloaded += len(content)
            
            # Create uploaded file
            uploaded_file = SimpleUploadedFile(
                filename,
                content,
                content_type=response.headers.get('content-type', 'application/octet-stream')
            )
            
            # Generate metadata with AI
            metadata = None
            if self.openai_service.is_available():
                metadata = self.openai_service.generate_file_metadata(
                    link_text=file_data.get('text', ''),
                    filename=filename,
                    context=file_data.get('context', '')
                )
            
            # Upload to media manager
            upload_result = self.upload_service.upload(
                uploaded_file,
                folder_path="imported",
                namespace=self.namespace,
                user=self.user,
            )
            
            if upload_result.files:
                media_file = upload_result.files[0]
                
                # Update with AI metadata if available
                if metadata:
                    if not media_file.title or media_file.title == filename:
                        media_file.title = metadata.get('title', filename)
                    if not media_file.description:
                        media_file.description = metadata.get('description', '')
                    media_file.ai_suggested_title = metadata.get('title', '')
                    media_file.save()
                    
                    # Add AI tags
                    self._add_tags(media_file, metadata.get('tags', []))
                
                # Always add "imported" tag
                self._add_tags(media_file, ['imported'])
                
                logger.info(f"Successfully imported file: {filename}")
                return media_file
            
        except Exception as e:
            logger.error(f"Failed to download file from {url}: {e}")
        
        return None
    
    def _get_filename_from_url(self, url: str) -> str:
        """Extract filename from URL."""
        parsed = urlparse(url)
        filename = os.path.basename(parsed.path)
        
        if not filename:
            filename = 'downloaded_file'
        
        return filename
    
    def _add_tags(self, media_file: MediaFile, tag_names: List[str]):
        """
        Add tags to a media file.
        
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
                defaults={'created_by': self.user}
            )
            
            # Add tag to media file
            media_file.tags.add(tag)

