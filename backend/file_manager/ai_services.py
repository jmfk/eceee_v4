"""
AI services for media file analysis and metadata generation.

This module provides AI-powered services for analyzing media files,
including features like:
- Content analysis
- Tag suggestions
- Title generation
- Text extraction (OCR)
"""

import logging
import os
import time
from typing import List, Dict, Any, Optional
from django.conf import settings
from django.utils.text import slugify
from django.core.cache import cache
from PIL import Image
import io
import requests
from .models import MediaTag

logger = logging.getLogger(__name__)


class MediaAIService:
    """Service for AI-powered media file analysis."""

    def __init__(self):
        """Initialize AI service with settings."""
        self.api_key = settings.AI_SERVICE_API_KEY
        self.api_url = settings.AI_SERVICE_URL
        self.confidence_threshold = getattr(settings, "AI_CONFIDENCE_THRESHOLD", 0.7)
        self.cache_timeout = getattr(settings, "AI_CACHE_TIMEOUT", 3600)  # 1 hour
        self.request_timeout = getattr(settings, "AI_REQUEST_TIMEOUT", 30)  # 30 seconds
        self.max_retries = getattr(settings, "AI_MAX_RETRIES", 3)
        self.retry_delay = getattr(settings, "AI_RETRY_DELAY", 1)  # 1 second

    def _make_request(
        self, endpoint: str, data: Dict[str, Any], files: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Make API request with retry logic.

        Args:
            endpoint: API endpoint
            data: Request data
            files: Optional files to upload

        Returns:
            API response data
        """
        headers = {"Authorization": f"Bearer {self.api_key}"}
        url = f"{self.api_url}/{endpoint}"

        for attempt in range(self.max_retries):
            try:
                if files:
                    response = requests.post(
                        url,
                        headers=headers,
                        data=data,
                        files=files,
                        timeout=self.request_timeout,
                    )
                else:
                    response = requests.post(
                        url,
                        headers=headers,
                        json=data,
                        timeout=self.request_timeout,
                    )

                response.raise_for_status()
                return response.json()

            except requests.exceptions.RequestException as e:
                logger.warning(f"AI service request failed (attempt {attempt + 1}): {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                else:
                    raise

    def _get_cache_key(self, method: str, **kwargs) -> str:
        """
        Generate cache key for AI results.

        Args:
            method: AI method name
            **kwargs: Method arguments

        Returns:
            Cache key
        """
        key_parts = [method]
        for k, v in sorted(kwargs.items()):
            if isinstance(v, (str, int, float, bool)):
                key_parts.append(f"{k}:{v}")
            elif isinstance(v, (bytes, bytearray)):
                # Hash binary content
                import hashlib
                key_parts.append(f"{k}:{hashlib.sha256(v).hexdigest()}")
        return "ai_service:" + ":".join(key_parts)

    def analyze_image_content(self, image_content: bytes) -> Dict[str, Any]:
        """
        Analyze image content using AI.

        Args:
            image_content: Image file content

        Returns:
            Analysis results including tags, description, etc.
        """
        cache_key = self._get_cache_key("analyze_image", content=image_content)
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            files = {"image": ("image.jpg", image_content)}
            result = self._make_request("analyze/image", {}, files=files)

            if result.get("confidence", 0) >= self.confidence_threshold:
                cache.set(cache_key, result, self.cache_timeout)
                return result
            return {}

        except Exception as e:
            logger.error(f"Failed to analyze image content: {e}")
            return {}

    def extract_text_from_image(self, image_content: bytes) -> str:
        """
        Extract text from image using OCR.

        Args:
            image_content: Image file content

        Returns:
            Extracted text
        """
        cache_key = self._get_cache_key("extract_text", content=image_content)
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            files = {"image": ("image.jpg", image_content)}
            result = self._make_request("ocr", {}, files=files)

            if result.get("confidence", 0) >= self.confidence_threshold:
                text = result.get("text", "")
                cache.set(cache_key, text, self.cache_timeout)
                return text
            return ""

        except Exception as e:
            logger.error(f"Failed to extract text from image: {e}")
            return ""

    def suggest_tags_from_content(
        self, content: str, namespace_id: str
    ) -> List[Dict[str, str]]:
        """
        Suggest tags based on content.

        Args:
            content: Text content to analyze
            namespace_id: Namespace ID for tag context

        Returns:
            List of suggested tags with names and confidence scores
        """
        cache_key = self._get_cache_key(
            "suggest_tags", content=content, namespace=namespace_id
        )
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            data = {"content": content, "namespace_id": namespace_id}
            result = self._make_request("suggest/tags", data)

            suggestions = [
                tag
                for tag in result.get("tags", [])
                if tag.get("confidence", 0) >= self.confidence_threshold
            ]

            if suggestions:
                cache.set(cache_key, suggestions, self.cache_timeout)
                return suggestions
            return []

        except Exception as e:
            logger.error(f"Failed to suggest tags: {e}")
            return []

    def generate_title_from_filename(self, filename: str) -> str:
        """
        Generate human-readable title from filename.

        Args:
            filename: Original filename

        Returns:
            Generated title
        """
        cache_key = self._get_cache_key("generate_title", filename=filename)
        cached = cache.get(cache_key)
        if cached:
            return cached

        try:
            data = {"filename": filename}
            result = self._make_request("generate/title", data)

            if result.get("confidence", 0) >= self.confidence_threshold:
                title = result.get("title", "")
                cache.set(cache_key, title, self.cache_timeout)
                return title
            return ""

        except Exception as e:
            logger.error(f"Failed to generate title: {e}")
            return ""

    def generate_slug_from_title(self, title: str) -> str:
        """
        Generate SEO-friendly slug from title.

        Args:
            title: File title

        Returns:
            Generated slug
        """
        try:
            # First try basic slugify
            slug = slugify(title)
            if len(slug) >= 3:
                return slug

            # If too short, try AI enhancement
            data = {"title": title}
            result = self._make_request("generate/slug", data)

            if result.get("confidence", 0) >= self.confidence_threshold:
                enhanced_slug = result.get("slug", "")
                if enhanced_slug:
                    return enhanced_slug

            # Fallback to basic slug with prefix
            return f"file-{slug}" if slug else "media-file"

        except Exception as e:
            logger.error(f"Failed to generate slug: {e}")
            return "media-file"

    def analyze_file_complete_workflow(
        self, file_content: bytes, filename: str, namespace_id: str
    ) -> Dict[str, Any]:
        """
        Run complete AI analysis workflow on a file.

        Args:
            file_content: File content
            filename: Original filename
            namespace_id: Namespace ID for context

        Returns:
            Complete analysis results
        """
        results = {
            "title": "",
            "tags": [],
            "extracted_text": "",
            "confidence_score": 0.0,
        }

        try:
            # Generate title
            title = self.generate_title_from_filename(filename)
            if title:
                results["title"] = title

            # Image-specific analysis
            try:
                Image.open(io.BytesIO(file_content))
                # It's an image, do image analysis
                image_analysis = self.analyze_image_content(file_content)
                if image_analysis:
                    results["tags"].extend(image_analysis.get("tags", []))
                    results["confidence_score"] = max(
                        results["confidence_score"],
                        image_analysis.get("confidence", 0),
                    )

                # Extract text from image
                extracted_text = self.extract_text_from_image(file_content)
                if extracted_text:
                    results["extracted_text"] = extracted_text
                    # Suggest additional tags from extracted text
                    text_tags = self.suggest_tags_from_content(extracted_text, namespace_id)
                    results["tags"].extend(text_tags)

            except Exception:
                # Not an image or image processing failed
                pass

            # Deduplicate tags
            seen_tags = set()
            unique_tags = []
            for tag in results["tags"]:
                tag_name = tag["name"].lower()
                if tag_name not in seen_tags:
                    seen_tags.add(tag_name)
                    unique_tags.append(tag)
            results["tags"] = unique_tags

            return results

        except Exception as e:
            logger.error(f"Failed to run complete analysis workflow: {e}")
            return results