"""OpenAI service for generating metadata for imported content."""

import json
import logging
from typing import Dict, List, Optional
from django.conf import settings
import openai


logger = logging.getLogger(__name__)


class OpenAIService:
    """Service for generating metadata using OpenAI."""

    def __init__(self):
        """Initialize OpenAI service with API key."""
        self.api_key = getattr(settings, "OPENAI_API_KEY", None)
        if self.api_key:
            openai.api_key = self.api_key
        else:
            logger.warning(
                "OPENAI_API_KEY not configured. AI metadata generation will be disabled."
            )

    def is_available(self) -> bool:
        """Check if OpenAI service is available."""
        return self.api_key is not None

    def generate_image_metadata(
        self, alt_text: str = "", filename: str = "", context: str = ""
    ) -> Optional[Dict[str, any]]:
        """
        Generate metadata for an image using AI.

        Args:
            alt_text: Image alt text
            filename: Image filename
            context: Surrounding text context

        Returns:
            Dictionary with title, description, and tags, or None if generation fails
        """
        if not self.is_available():
            logger.debug("OpenAI not available, skipping metadata generation")
            return None

        prompt = f"""Given an image with the following attributes:
- Alt text: "{alt_text}"
- Filename: "{filename}"
- Context: "{context}"

Generate metadata for this image. Respond with ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{{
  "title": "descriptive title (max 100 chars)",
  "description": "brief description (max 200 chars)",
  "tags": ["tag1", "tag2", "tag3"]
}}

Generate 3-5 relevant keywords for tags. Keep title and description concise."""

        try:
            response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that generates metadata for images. Always respond with valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=200,
            )

            content = response.choices[0].message.content.strip()

            # Parse JSON response
            metadata = json.loads(content)

            # Validate structure
            if not all(key in metadata for key in ["title", "description", "tags"]):
                logger.error("Invalid metadata structure from OpenAI")
                return None

            # Ensure tags is a list
            if not isinstance(metadata["tags"], list):
                metadata["tags"] = []

            logger.info(f"Generated image metadata: {metadata['title']}")
            return metadata

        except Exception as e:
            logger.error(f"Failed to generate image metadata: {e}")
            return None

    def generate_file_metadata(
        self, link_text: str = "", filename: str = "", context: str = ""
    ) -> Optional[Dict[str, any]]:
        """
        Generate metadata for a file using AI.

        Args:
            link_text: Text of the link
            filename: Filename from URL
            context: Surrounding text context

        Returns:
            Dictionary with title, description, and tags, or None if generation fails
        """
        if not self.is_available():
            logger.debug("OpenAI not available, skipping metadata generation")
            return None

        prompt = f"""Given a file link with the following attributes:
- Link text: "{link_text}"
- Filename: "{filename}"
- Context: "{context}"

Generate metadata for this file. Respond with ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{{
  "title": "descriptive title (max 100 chars)",
  "description": "brief description (max 200 chars)",
  "tags": ["tag1", "tag2", "tag3"]
}}

Generate 3-5 relevant keywords for tags. Keep title and description concise."""

        try:
            response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that generates metadata for files. Always respond with valid JSON only.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                max_tokens=200,
            )

            content = response.choices[0].message.content.strip()

            # Parse JSON response
            metadata = json.loads(content)

            # Validate structure
            if not all(key in metadata for key in ["title", "description", "tags"]):
                logger.error("Invalid metadata structure from OpenAI")
                return None

            # Ensure tags is a list
            if not isinstance(metadata["tags"], list):
                metadata["tags"] = []

            logger.info(f"Generated file metadata: {metadata['title']}")
            return metadata

        except Exception as e:
            logger.error(f"Failed to generate file metadata: {e}")
            return None
