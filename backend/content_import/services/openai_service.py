"""OpenAI service for generating metadata for imported content."""

import json
import logging
from typing import Dict, List, Optional
from django.conf import settings
from openai import OpenAI
from ai_tracking.services import AIClient


logger = logging.getLogger(__name__)


class OpenAIService:
    """Service for generating metadata using OpenAI."""

    def __init__(self, user=None, content_object=None):
        """
        Initialize OpenAI service with API key.

        Args:
            user: Django user for tracking AI usage
            content_object: Optional object to link AI usage to (e.g., import job)
        """
        self.api_key = getattr(settings, "OPENAI_API_KEY", None)
        self.user = user
        self.content_object = content_object

        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None
            logger.warning(
                "OPENAI_API_KEY not configured. AI metadata generation will be disabled."
            )

    def is_available(self) -> bool:
        """Check if OpenAI service is available."""
        return bool(self.api_key and self.api_key.strip())

    def _track_ai_call(self, prompt, task_description, model="gpt-4o-mini", **kwargs):
        """
        Make OpenAI API call with tracking via AIClient.

        Args:
            prompt: The prompt (string or messages list)
            task_description: Description of what this AI call is for
            model: OpenAI model to use
            **kwargs: Additional parameters for OpenAI API

        Returns:
            Response from OpenAI (or raises exception)
        """
        # Create AI tracking client
        ai_client = AIClient(provider="openai", model=model, user=self.user)

        try:
            # Make tracked AI call
            result = ai_client.call(
                prompt=prompt,
                task_description=task_description,
                content_object=self.content_object,
                store_full_data=False,  # Don't store prompts/responses by default
                **kwargs,
            )

            return result["response"]

        except Exception as e:
            logger.error(f"AI call failed: {e}")
            raise

    def analyze_image_layout(
        self,
        img_element_html: str,
        surrounding_html: str = "",
        parent_classes: str = "",
    ) -> Optional[Dict[str, any]]:
        """
        Analyze image layout and determine optimal configuration.

        Args:
            img_element_html: The img tag HTML
            surrounding_html: HTML of surrounding container
            parent_classes: Classes from parent elements

        Returns:
            Dictionary with layout preferences or None if analysis fails
        """
        if not self.is_available():
            return None

        prompt = f"""Analyze this image element and its context to determine optimal layout:

Image HTML: {img_element_html}
Parent container: {surrounding_html[:200]}
Parent classes: {parent_classes}

Respond with ONLY valid JSON (no markdown) with this structure:
{{
  "alignment": "left|center|right|full-width",
  "size": "small|medium|large|original",
  "caption": "extracted caption or empty string",
  "display": "inline|block|float-left|float-right"
}}

Determine based on:
- Classes like "center", "full-width", "float-left", "align-right"
- Parent container width and styling
- Image position in content flow"""

        try:
            messages = [
                {
                    "role": "system",
                    "content": "You analyze HTML image contexts and determine optimal layout. Always respond with valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ]

            content = self._track_ai_call(
                prompt=messages,
                task_description="Analyze image layout",
                model="gpt-4o-mini",
                temperature=0.3,
                max_tokens=150,
            )

            layout = json.loads(content)
            return layout

        except Exception as e:
            logger.error(f"Failed to analyze image layout: {e}")
            return None

    def extract_page_metadata(
        self, html: str, existing_tags: List[str] = None
    ) -> Optional[Dict[str, any]]:
        """
        Extract page title and tag suggestions from HTML content.

        Args:
            html: HTML content to analyze
            existing_tags: List of existing tag names in the system

        Returns:
            Dictionary with title, suggested_tags, and confidence, or None if extraction fails
        """
        if not self.is_available():
            logger.debug("OpenAI not available, skipping page metadata extraction")
            return None

        existing_tags = existing_tags or []

        # Parse HTML to extract head metadata
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        # Extract structured metadata from <head>
        head_metadata = {}

        # Title tag
        title_tag = soup.find("title")
        if title_tag:
            head_metadata["title_tag"] = title_tag.get_text(strip=True)

        # Meta description
        meta_desc = soup.find("meta", attrs={"name": "description"}) or soup.find(
            "meta", attrs={"property": "og:description"}
        )
        if meta_desc:
            head_metadata["description"] = meta_desc.get("content", "")

        # Meta keywords
        meta_keywords = soup.find("meta", attrs={"name": "keywords"})
        if meta_keywords:
            head_metadata["keywords"] = meta_keywords.get("content", "")

        # Open Graph title
        og_title = soup.find("meta", attrs={"property": "og:title"})
        if og_title:
            head_metadata["og_title"] = og_title.get("content", "")

        # Open Graph type
        og_type = soup.find("meta", attrs={"property": "og:type"})
        if og_type:
            head_metadata["og_type"] = og_type.get("content", "")

        # Article tags (if present)
        article_tags = soup.find_all("meta", attrs={"property": "article:tag"})
        if article_tags:
            head_metadata["article_tags"] = [
                tag.get("content", "") for tag in article_tags
            ]

        # First H1 for context
        h1 = soup.find("h1")
        if h1:
            head_metadata["h1"] = h1.get_text(strip=True)

        # Truncate body HTML to reasonable size for API
        html_preview = html[:3000] if len(html) > 3000 else html

        # Format head metadata for prompt
        head_info = []
        if head_metadata.get("title_tag"):
            head_info.append(f"<title>: {head_metadata['title_tag']}")
        if head_metadata.get("og_title"):
            head_info.append(f"OpenGraph Title: {head_metadata['og_title']}")
        if head_metadata.get("description"):
            head_info.append(f"Meta Description: {head_metadata['description']}")
        if head_metadata.get("keywords"):
            head_info.append(f"Meta Keywords: {head_metadata['keywords']}")
        if head_metadata.get("og_type"):
            head_info.append(f"Content Type: {head_metadata['og_type']}")
        if head_metadata.get("article_tags"):
            head_info.append(
                f"Article Tags: {', '.join(head_metadata['article_tags'])}"
            )
        if head_metadata.get("h1"):
            head_info.append(f"Main Heading (H1): {head_metadata['h1']}")

        head_metadata_text = (
            "\n".join(head_info) if head_info else "No structured metadata found"
        )

        prompt = f"""Analyze this HTML page content and extract meaningful metadata.

STRUCTURED METADATA FROM HTML <HEAD>:
{head_metadata_text}

HTML BODY CONTENT (first 3000 chars):
{html_preview}

EXISTING TAGS IN SYSTEM:
{', '.join(f'"{tag}"' for tag in existing_tags[:50]) if existing_tags else 'None yet'}

TASK: Extract and suggest metadata for this page.

Respond with ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{{
  "title": "descriptive page title based on <title>, <h1>, or main heading",
  "suggested_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "confidence": 0.85,
  "reasoning": "brief explanation of how tags were chosen"
}}

CRITICAL TAG GUIDELINES - BALANCE SPECIFIC + GENERAL:

PRIORITY 1 - Use Structured Metadata First:
- <title> tag is the authoritative source for page title
- Meta keywords provide pre-existing tag suggestions
- Meta description gives topic context
- Article tags (if present) should be used
- H1 heading is often the best title source

PRIORITY 2 - Extract SPECIFIC identifying information:
- Event/Conference names (e.g., "Summer Study", "eceee 2026")
- Years (e.g., "2026", "2024")
- Locations (e.g., "Center Parcs", "Lac d'Ailette", "Paris", "Stockholm")
- Organization names if mentioned prominently
- Specific program names

PRIORITY 3 - Include GENERAL topic tags:
- Main subject areas (e.g., "energy efficiency", "sustainability")
- Content type (e.g., "conference", "research", "partners")
- Prefer existing tags when they match (helps consistency)

OUTPUT:
- Suggest 5-10 tags total, mixing specific and general
- Specific tags help users find exact content; general tags help with categorization
- For sections like "Partners" or "Sponsors" - include those as tags too

EXAMPLES of good tag combinations:
- Conference page: ["Summer Study", "2026", "Lac d'Ailette", "conference", "energy efficiency"]
- Partners section: ["partners", "sponsors", "2024 Summer Study", "organizations"]
- News article: ["news", "2025", "Stockholm", "policy", "buildings"]

Confidence should be 0.0-1.0 based on how clear the content is."""

        logger.info("=" * 80)
        logger.info("📝 EXTRACT PAGE METADATA - PROMPT")
        logger.info("=" * 80)
        logger.info(f"HTML Preview Length: {len(html_preview)} chars")
        logger.info(f"Existing Tags Count: {len(existing_tags)}")
        logger.info(f"\n🏷️  EXTRACTED HEAD METADATA:")
        for key, value in head_metadata.items():
            if isinstance(value, list):
                logger.info(f"  {key}: {', '.join(value)}")
            else:
                logger.info(
                    f"  {key}: {value[:100] if len(str(value)) > 100 else value}"
                )
        logger.info(f"\nFull Prompt:\n{prompt}")
        logger.info("=" * 80)

        try:
            messages = [
                {
                    "role": "system",
                    "content": "You are an expert metadata extraction specialist for content management systems. You excel at identifying both specific details (names, dates, locations) and general topics from web content. Always respond with valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ]

            content = self._track_ai_call(
                prompt=messages,
                task_description="Extract page metadata",
                model="gpt-4o-mini",
                temperature=0.2,
                max_tokens=400,
                response_format={"type": "json_object"},
            )

            metadata = json.loads(content)

            logger.info("=" * 80)
            logger.info("✅ EXTRACT PAGE METADATA - RESPONSE")
            logger.info("=" * 80)
            logger.info(f"Raw Response:\n{content}")
            logger.info(f"\nParsed Metadata:")
            logger.info(f"  Title: {metadata.get('title', 'N/A')}")
            logger.info(f"  Suggested Tags: {metadata.get('suggested_tags', [])}")
            logger.info(f"  Confidence: {metadata.get('confidence', 'N/A')}")
            logger.info(f"  Reasoning: {metadata.get('reasoning', 'N/A')}")
            logger.info("=" * 80)

            # Validate structure
            required_keys = ["title", "suggested_tags"]
            if not all(key in metadata for key in required_keys):
                logger.error("Invalid page metadata structure from OpenAI")
                return None

            # Ensure tags is a list
            if not isinstance(metadata["suggested_tags"], list):
                metadata["suggested_tags"] = []

            logger.info(
                f"Extracted page metadata: {metadata['title']} with {len(metadata['suggested_tags'])} tags"
            )
            return metadata

        except Exception as e:
            logger.error(f"Failed to extract page metadata: {e}")
            return None

    def generate_image_metadata(
        self,
        alt_text: str = "",
        filename: str = "",
        context: str = "",
        page_title: str = "",
        page_tags: List[str] = None,
    ) -> Optional[Dict[str, any]]:
        """
        Generate metadata for an image using AI with page context.

        Args:
            alt_text: Image alt text
            filename: Image filename
            context: Surrounding text context (nearby headings, paragraphs)
            page_title: Title of the page being imported
            page_tags: Tags associated with the page

        Returns:
            Dictionary with title, description, and tags, or None if generation fails
        """
        if not self.is_available():
            logger.debug("OpenAI not available, skipping metadata generation")
            return None

        page_tags = page_tags or []

        # Build context with page information
        page_context = ""
        if page_title:
            page_context += f'\n- Page title: "{page_title}"'
        if page_tags:
            page_context += f"\n- Page tags: {', '.join(page_tags)}"

        prompt = f"""Given an image with the following attributes:
- Alt text: "{alt_text}"
- Filename: "{filename}"
- Surrounding text: "{context[:300]}"
{page_context}

Generate metadata for this image.

CRITICAL GUIDELINES:
1. EXTRACT SPECIFICS FROM FILENAME:
   - Filenames often encode valuable info (e.g., "centerparcs2026.jpg" → location, year)
   - Look for: names, places, years, abbreviations
   - Example: "summit_speakers_2024.jpg" → ["speakers", "2024", "summit"]

2. USE SURROUNDING TEXT CONTEXT:
   - Section headings are gold (e.g., "Partners", "Sponsors", "Venue")
   - Event names mentioned nearby
   - Descriptive text around the image

3. INHERIT PAGE CONTEXT:
   - If page is about "Summer Study 2026" → include in image tags
   - Use page tags when relevant to this specific image
   - Balance inherited tags with image-specific tags

4. TAG STRATEGY:
   - 3-5 tags mixing specific (names, dates, places) + general (type, category)
   - Example: ["Center Parcs", "venue", "2026", "conference location"]

Respond with ONLY valid JSON (no markdown, no code blocks):
{{
  "title": "descriptive title (max 100 chars)",
  "description": "brief description (max 200 chars)",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}}"""

        logger.info("=" * 80)
        logger.info("🖼️  GENERATE IMAGE METADATA - PROMPT")
        logger.info("=" * 80)
        logger.info(f"Alt Text: {alt_text[:100] if alt_text else 'None'}")
        logger.info(f"Filename: {filename}")
        logger.info(f"Context: {context[:200] if context else 'None'}")
        logger.info(f"Page Title: {page_title if page_title else 'None'}")
        logger.info(f"Page Tags: {page_tags if page_tags else 'None'}")
        logger.info(f"\nFull Prompt:\n{prompt}")
        logger.info("=" * 80)

        try:
            messages = [
                {
                    "role": "system",
                    "content": "You are an expert at generating descriptive metadata for images in a content management system. Always respond with valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ]

            content = self._track_ai_call(
                prompt=messages,
                task_description="Generate image metadata",
                model="gpt-4o-mini",
                temperature=0.7,
                max_tokens=250,
                response_format={"type": "json_object"},
            )

            # Parse JSON response
            metadata = json.loads(content)

            logger.info("=" * 80)
            logger.info("✅ GENERATE IMAGE METADATA - RESPONSE")
            logger.info("=" * 80)
            logger.info(f"Raw Response:\n{content}")
            logger.info(f"\nParsed Metadata:")
            logger.info(f"  Title: {metadata.get('title', 'N/A')}")
            logger.info(f"  Description: {metadata.get('description', 'N/A')}")
            logger.info(f"  Tags: {metadata.get('tags', [])}")
            logger.info("=" * 80)

            # Validate structure
            if not all(key in metadata for key in ["title", "description", "tags"]):
                logger.error("Invalid metadata structure from OpenAI")
                return None

            # Ensure tags is a list
            if not isinstance(metadata["tags"], list):
                metadata["tags"] = []

            logger.info(
                f"Generated image metadata: {metadata['title']} (tags: {', '.join(metadata['tags'][:3])})"
            )
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
            messages = [
                {
                    "role": "system",
                    "content": "You are a helpful assistant that generates metadata for files. Always respond with valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ]

            content = self._track_ai_call(
                prompt=messages,
                task_description="Generate file metadata",
                model="gpt-4o-mini",
                temperature=0.7,
                max_tokens=200,
            )

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

    def select_best_tags(
        self,
        potential_tags: list,
        existing_tags: list,
        item_description: str,
        max_tags: int = 5,
    ) -> list:
        """
        Use AI to select the best combination of potential and existing tags.

        Args:
            potential_tags: Newly generated tag suggestions
            existing_tags: Similar tags that already exist in the system
            item_description: Description of the item being tagged
            max_tags: Maximum number of tags to return

        Returns:
            List of selected tag names, or potential_tags if AI fails
        """
        if not self.is_available():
            logger.debug("OpenAI not available, using potential tags only")
            return potential_tags[:max_tags]

        prompt = f"""You are helping to tag a media item in a content management system.

ITEM DESCRIPTION: "{item_description}"

POTENTIAL NEW TAGS (AI-generated for this item):
{', '.join(f'"{tag}"' for tag in potential_tags)}

EXISTING SIMILAR TAGS (already in the system):
{', '.join(f'"{tag}"' for tag in existing_tags) if existing_tags else 'None'}

TASK: Select the best {max_tags} tags that:
1. Most accurately describe the item
2. Prefer existing tags over new ones when they mean the same thing (helps consistency)
3. Only use new tags if they add unique value not covered by existing tags
4. Maintain good taxonomy and avoid redundancy

Respond with ONLY valid JSON (no markdown) in this format:
{{
  "selected_tags": ["tag1", "tag2", "tag3"],
  "reasoning": "brief explanation of why these tags were chosen"
}}"""

        try:
            messages = [
                {
                    "role": "system",
                    "content": "You are a media librarian expert at creating consistent, useful tag taxonomies. Always respond with valid JSON only.",
                },
                {"role": "user", "content": prompt},
            ]

            content = self._track_ai_call(
                prompt=messages,
                task_description="Select best tags",
                model="gpt-4o-mini",
                temperature=0.3,
                max_tokens=200,
            )

            result = json.loads(content)

            selected_tags = result.get("selected_tags", [])
            reasoning = result.get("reasoning", "")

            logger.info(f"AI tag selection: {selected_tags} - {reasoning}")

            return (
                selected_tags[:max_tags] if selected_tags else potential_tags[:max_tags]
            )

        except Exception as e:
            logger.error(f"Failed to select best tags: {e}")
            # Fallback: return potential tags
            return potential_tags[:max_tags]
