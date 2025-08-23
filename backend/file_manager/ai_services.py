"""
AI-powered media analysis and suggestion service.

This module provides AI integration for automatic tagging, title generation,
text extraction, and content analysis of uploaded media files.
"""

import os
import io
import logging
from typing import List, Dict, Any, Optional, Tuple
from django.conf import settings
from django.utils.text import slugify
import openai
from PIL import Image

# import pytesseract  # Temporarily commented out - needs tesseract system package

logger = logging.getLogger(__name__)


class MediaAIService:
    """AI-powered media analysis and suggestion service."""

    def __init__(self):
        """Initialize AI service with OpenAI configuration."""
        self.openai_client = None
        self.ai_enabled = getattr(settings, "AI_TAGGING_ENABLED", True)

        if self.ai_enabled:
            api_key = getattr(settings, "OPENAI_API_KEY", "")
            if api_key:
                openai.api_key = api_key
                self.openai_client = openai
            else:
                logger.warning("OpenAI API key not configured, AI features disabled")
                self.ai_enabled = False

    def analyze_media_file(
        self, file_content: bytes, filename: str, content_type: str
    ) -> Dict[str, Any]:
        """
        Comprehensive analysis of media file for AI suggestions.

        Args:
            file_content: Raw file content
            filename: Original filename
            content_type: MIME type

        Returns:
            Dict containing AI analysis results
        """
        analysis_result = {
            "suggested_tags": [],
            "suggested_title": "",
            "suggested_slug": "",
            "extracted_text": "",
            "confidence_score": 0.0,
            "analysis_metadata": {},
        }

        if not self.ai_enabled:
            # Fallback to basic analysis
            return self._basic_analysis(filename, content_type)

        try:
            # Analyze based on content type
            if content_type.startswith("image/"):
                analysis_result = self._analyze_image(file_content, filename)
            elif content_type == "application/pdf":
                analysis_result = self._analyze_document(file_content, filename)
            elif content_type.startswith("video/"):
                analysis_result = self._analyze_video_metadata(filename)
            elif content_type.startswith("audio/"):
                analysis_result = self._analyze_audio_metadata(filename)
            else:
                analysis_result = self._basic_analysis(filename, content_type)

            # Generate slug from suggested title
            if analysis_result["suggested_title"]:
                analysis_result["suggested_slug"] = slugify(
                    analysis_result["suggested_title"]
                )

        except Exception as e:
            logger.error(f"AI analysis failed for {filename}: {e}")
            analysis_result = self._basic_analysis(filename, content_type)

        return analysis_result

    def _analyze_image(self, image_content: bytes, filename: str) -> Dict[str, Any]:
        """Analyze image content using AI and OCR."""
        result = {
            "suggested_tags": [],
            "suggested_title": "",
            "extracted_text": "",
            "confidence_score": 0.0,
            "analysis_metadata": {"type": "image"},
        }

        try:
            # Extract text using OCR
            extracted_text = self._extract_text_from_image(image_content)
            result["extracted_text"] = extracted_text

            # Analyze image content with OpenAI Vision (if available)
            if self.openai_client:
                vision_analysis = self._analyze_image_with_vision(
                    image_content, filename
                )
                result.update(vision_analysis)

            # If no AI analysis, use OCR text for suggestions
            if not result["suggested_tags"] and extracted_text:
                result["suggested_tags"] = self._extract_keywords_from_text(
                    extracted_text
                )
                result["suggested_title"] = self._generate_title_from_text(
                    extracted_text, filename
                )
                result["confidence_score"] = 0.6

        except Exception as e:
            logger.error(f"Image analysis failed: {e}")

        return result

    def _extract_text_from_image(self, image_content: bytes) -> str:
        """Extract text from image using OCR."""
        try:
            with Image.open(io.BytesIO(image_content)) as img:
                # Convert to RGB if necessary
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGB")

                # Extract text using pytesseract
                # TODO: Install tesseract system package
                # extracted_text = pytesseract.image_to_string(img, lang='eng')
                # return extracted_text.strip()
                return ""  # Temporary fallback

        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return ""

    def _analyze_image_with_vision(
        self, image_content: bytes, filename: str
    ) -> Dict[str, Any]:
        """Analyze image using OpenAI Vision API."""
        result = {"suggested_tags": [], "suggested_title": "", "confidence_score": 0.0}

        try:
            # Convert image to base64 for API
            import base64

            image_base64 = base64.b64encode(image_content).decode("utf-8")

            # Create vision prompt
            prompt = """
            Analyze this image and provide:
            1. A descriptive title (max 50 characters)
            2. 5-8 relevant tags for categorization
            3. Brief description of what you see
            
            Focus on:
            - Main subjects/objects
            - Colors and style
            - Context and setting
            - Any text visible
            
            Respond in JSON format:
            {
                "title": "descriptive title",
                "tags": ["tag1", "tag2", "tag3"],
                "description": "brief description"
            }
            """

            response = self.openai_client.ChatCompletion.create(
                model="gpt-4-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_base64}",
                                    "detail": "low",
                                },
                            },
                        ],
                    }
                ],
                max_tokens=300,
                temperature=0.3,
            )

            # Parse response
            import json

            ai_response = json.loads(response.choices[0].message.content)

            result["suggested_title"] = ai_response.get("title", "")
            result["suggested_tags"] = ai_response.get("tags", [])
            result["confidence_score"] = 0.85
            result["analysis_metadata"] = {
                "description": ai_response.get("description", ""),
                "model": "gpt-4-vision-preview",
            }

        except Exception as e:
            logger.error(f"OpenAI Vision analysis failed: {e}")

        return result

    def _analyze_document(
        self, document_content: bytes, filename: str
    ) -> Dict[str, Any]:
        """Analyze document content for metadata extraction."""
        result = {
            "suggested_tags": [],
            "suggested_title": "",
            "extracted_text": "",
            "confidence_score": 0.0,
            "analysis_metadata": {"type": "document"},
        }

        try:
            # For PDF documents, extract text
            if filename.lower().endswith(".pdf"):
                extracted_text = self._extract_text_from_pdf(document_content)
                result["extracted_text"] = extracted_text

                if extracted_text:
                    result["suggested_tags"] = self._extract_keywords_from_text(
                        extracted_text
                    )
                    result["suggested_title"] = self._generate_title_from_text(
                        extracted_text, filename
                    )
                    result["confidence_score"] = 0.7

        except Exception as e:
            logger.error(f"Document analysis failed: {e}")

        return result

    def _extract_text_from_pdf(self, pdf_content: bytes) -> str:
        """Extract text from PDF document."""
        try:
            import PyPDF2

            pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_content))

            text_content = []
            for page in pdf_reader.pages[:5]:  # Limit to first 5 pages
                text_content.append(page.extract_text())

            return "\n".join(text_content).strip()

        except Exception as e:
            logger.error(f"PDF text extraction failed: {e}")
            return ""

    def _analyze_video_metadata(self, filename: str) -> Dict[str, Any]:
        """Analyze video file metadata."""
        return self._basic_analysis(filename, "video")

    def _analyze_audio_metadata(self, filename: str) -> Dict[str, Any]:
        """Analyze audio file metadata."""
        return self._basic_analysis(filename, "audio")

    def _basic_analysis(self, filename: str, content_type: str) -> Dict[str, Any]:
        """Basic analysis without AI - extract info from filename."""
        # Remove file extension and clean filename
        base_name = os.path.splitext(filename)[0]
        cleaned_name = base_name.replace("_", " ").replace("-", " ")

        # Generate basic tags from filename
        words = cleaned_name.lower().split()
        tags = [word for word in words if len(word) > 2][:5]

        # Determine file type tag
        if content_type.startswith("image/"):
            tags.append("image")
        elif content_type.startswith("video/"):
            tags.append("video")
        elif content_type.startswith("audio/"):
            tags.append("audio")
        elif "pdf" in content_type:
            tags.append("document")

        return {
            "suggested_tags": tags,
            "suggested_title": cleaned_name.title(),
            "suggested_slug": slugify(cleaned_name),
            "extracted_text": "",
            "confidence_score": 0.3,
            "analysis_metadata": {"type": "basic", "source": "filename"},
        }

    def _extract_keywords_from_text(
        self, text: str, max_keywords: int = 8
    ) -> List[str]:
        """Extract keywords from text content."""
        if not text:
            return []

        # Simple keyword extraction (can be enhanced with NLP libraries)
        import re

        # Remove common stop words
        stop_words = {
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with",
            "by",
            "is",
            "are",
            "was",
            "were",
            "be",
            "been",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "could",
            "should",
            "this",
            "that",
            "these",
            "those",
            "i",
            "you",
            "he",
            "she",
            "it",
            "we",
            "they",
            "me",
            "him",
            "her",
            "us",
            "them",
        }

        # Extract words (alphanumeric, 3+ characters)
        words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())

        # Filter out stop words and count frequency
        word_freq = {}
        for word in words:
            if word not in stop_words:
                word_freq[word] = word_freq.get(word, 0) + 1

        # Sort by frequency and return top keywords
        keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        return [word for word, freq in keywords[:max_keywords]]

    def _generate_title_from_text(self, text: str, filename: str) -> str:
        """Generate a title from extracted text."""
        if not text:
            return (
                os.path.splitext(filename)[0]
                .replace("_", " ")
                .replace("-", " ")
                .title()
            )

        # Use first meaningful sentence or phrase
        sentences = text.split(".")
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) > 10 and len(sentence) < 100:
                return sentence.title()

        # Fallback to filename
        return os.path.splitext(filename)[0].replace("_", " ").replace("-", " ").title()

    def generate_slug_suggestions(
        self, title: str, existing_slugs: List[str] = None
    ) -> List[str]:
        """Generate SEO-friendly slug suggestions with conflict resolution."""
        if not title:
            return []

        base_slug = slugify(title)
        suggestions = [base_slug]

        # Generate variations
        if existing_slugs:
            existing_slugs = set(existing_slugs)
            counter = 1

            while base_slug in existing_slugs:
                base_slug = f"{slugify(title)}-{counter}"
                counter += 1

            suggestions = [base_slug]

        # Add alternative suggestions
        words = title.lower().split()
        if len(words) > 1:
            # Abbreviated version
            abbreviated = "-".join([word[:3] for word in words if len(word) > 2])
            if abbreviated and abbreviated not in suggestions:
                suggestions.append(slugify(abbreviated))

            # Key words only
            key_words = [word for word in words if len(word) > 3][:3]
            if key_words:
                key_slug = slugify(" ".join(key_words))
                if key_slug and key_slug not in suggestions:
                    suggestions.append(key_slug)

        return suggestions[:3]  # Return top 3 suggestions

    def suggest_collections(
        self, tags: List[str], existing_collections: List[str] = None
    ) -> List[str]:
        """Suggest collections based on tags and existing collections."""
        if not tags:
            return []

        suggestions = []

        # Group related tags
        tag_groups = {
            "photos": ["image", "photo", "picture", "photography"],
            "documents": ["document", "pdf", "text", "report"],
            "media": ["video", "audio", "music", "sound"],
            "graphics": ["design", "logo", "icon", "graphic"],
        }

        for collection_name, keywords in tag_groups.items():
            if any(keyword in tag.lower() for tag in tags for keyword in keywords):
                suggestions.append(collection_name)

        # Add tag-based suggestions
        for tag in tags[:3]:  # Use first 3 tags
            if len(tag) > 3:
                suggestions.append(f"{tag}-collection")

        return list(set(suggestions))[:5]  # Return unique suggestions, max 5


# Global AI service instance
ai_service = MediaAIService()
