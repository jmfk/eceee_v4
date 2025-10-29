"""Page metadata extraction service for importing external pages."""

import logging
from typing import Dict, Any, List
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from django.utils.text import slugify


logger = logging.getLogger(__name__)


class PageMetadataExtractor:
    """Extract metadata from HTML pages for import."""

    def extract(self, html: str, url: str) -> Dict[str, Any]:
        """
        Extract page metadata from HTML content.

        Args:
            html: The HTML content to parse
            url: The page URL (used for slug fallback)

        Returns:
            Dictionary with:
                - title: Page title
                - description: Page description
                - slug: URL-safe slug
                - tags: List of tag names
        """
        soup = BeautifulSoup(html, "html.parser")

        metadata = {
            "title": self._extract_title(soup, url),
            "description": self._extract_description(soup),
            "slug": self._extract_slug(soup, url),
            "tags": self._extract_tags(soup),
        }

        logger.debug(f"Extracted metadata from {url}: {metadata}")
        return metadata

    def _extract_title(self, soup: BeautifulSoup, url: str) -> str:
        """
        Extract page title with fallback hierarchy.

        Priority:
        1. <title> tag
        2. First <h1> element
        3. URL path segment

        Args:
            soup: BeautifulSoup object
            url: Page URL

        Returns:
            Page title string
        """
        # Try <title> tag
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
            if title:
                return title

        # Try first <h1>
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text().strip()
            if title:
                return title

        # Fallback to URL path segment
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split("/") if p]
        if path_parts:
            return path_parts[-1].replace("-", " ").replace("_", " ").title()

        return "Untitled Page"

    def _extract_description(self, soup: BeautifulSoup) -> str:
        """
        Extract page description with fallback hierarchy.

        Priority:
        1. <meta name="description"> tag
        2. <meta property="og:description"> tag
        3. First <p> text (truncated to 200 chars)

        Args:
            soup: BeautifulSoup object

        Returns:
            Page description string
        """
        # Try meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc and meta_desc.get("content"):
            return meta_desc.get("content").strip()

        # Try Open Graph description
        og_desc = soup.find("meta", attrs={"property": "og:description"})
        if og_desc and og_desc.get("content"):
            return og_desc.get("content").strip()

        # Try first paragraph
        p = soup.find("p")
        if p:
            text = p.get_text().strip()
            if text:
                # Truncate to 200 chars
                if len(text) > 200:
                    return text[:197] + "..."
                return text

        return ""

    def _extract_slug(self, soup: BeautifulSoup, url: str) -> str:
        """
        Extract slug from URL path.

        Args:
            soup: BeautifulSoup object
            url: Page URL

        Returns:
            URL-safe slug
        """
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split("/") if p]

        if path_parts:
            # Use the last path segment as slug
            slug = path_parts[-1]

            # Remove file extensions if present
            if "." in slug:
                slug = slug.rsplit(".", 1)[0]

            # Ensure it's a valid slug
            slug = slugify(slug)

            if slug:
                return slug

        # Fallback: use 'index' for root pages
        return "index"

    def _extract_tags(self, soup: BeautifulSoup) -> List[str]:
        """
        Extract tags from meta keywords and content.

        Priority:
        1. <meta name="keywords"> tag

        Args:
            soup: BeautifulSoup object

        Returns:
            List of tag names
        """
        tags = []

        # Try meta keywords
        meta_keywords = soup.find("meta", attrs={"name": "keywords"})
        if meta_keywords and meta_keywords.get("content"):
            keywords = meta_keywords.get("content")
            # Split by comma and clean up
            tags = [k.strip() for k in keywords.split(",") if k.strip()]

        # Remove duplicates while preserving order
        seen = set()
        unique_tags = []
        for tag in tags:
            tag_lower = tag.lower()
            if tag_lower not in seen:
                seen.add(tag_lower)
                unique_tags.append(tag)

        return unique_tags[:10]  # Limit to 10 tags
