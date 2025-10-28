"""Widget creator service for generating widgets from content segments."""

import logging
import re
import uuid
from html import unescape
from typing import List, Dict, Any

from .content_parser import ContentSegment
from ..utils.html_sanitizer import deep_clean_html


logger = logging.getLogger(__name__)


def create_widgets(
    segments: List[ContentSegment], url_mapping: Dict[str, str] = None
) -> List[Dict[str, Any]]:
    """
    Create widgets from content segments.

    Args:
        segments: List of ContentSegment objects
        url_mapping: Mapping of original URLs to media manager URLs

    Returns:
        List of widget configurations
    """
    widgets = []
    url_mapping = url_mapping or {}

    for segment in segments:
        widget = None

        if segment.type == "content":
            widget = _create_content_widget(segment, url_mapping)
        elif segment.type == "table":
            widget = _create_table_widget(segment)
        elif segment.type == "file":
            # Skip standalone file links - they're handled inline in content
            continue

        if widget:
            widgets.append(widget)

    return widgets


def _create_content_widget(
    segment: ContentSegment, url_mapping: Dict[str, str]
) -> Dict[str, Any]:
    """
    Create a content widget from HTML content.

    Args:
        segment: ContentSegment with HTML content
        url_mapping: URL mapping for media files

    Returns:
        Widget configuration or None if content is empty
    """
    content = segment.content

    # Skip if content is empty
    if not content or not content.strip():
        return None

    # Replace image URLs with media manager URLs
    if url_mapping:
        content = _replace_urls(content, url_mapping)
    else:
        logger.warning("No url_mapping provided, images won't be replaced")

    return {
        "id": f"widget-{uuid.uuid4()}",
        "type": "eceee_widgets.ContentWidget",
        "name": "Imported Content",
        "config": {
            "content": content,
        },
    }


def _create_table_widget(segment: ContentSegment) -> Dict[str, Any]:
    """
    Create a table widget.

    Args:
        segment: ContentSegment with table HTML

    Returns:
        Widget configuration
    """
    return {
        "id": f"widget-{uuid.uuid4()}",
        "type": "eceee_widgets.TableWidget",
        "name": "Imported Table",
        "config": {
            "tableHtml": segment.content,
            "responsive": True,
            "striped": False,
            "bordered": True,
        },
    }


def _replace_urls(html: str, url_mapping: Dict[str, str]) -> str:
    """
    Replace images and file links with configured HTML/URLs.

    Two-pass approach:
    1. Replace <img> tags with media-insert containers or new URLs
    2. Apply deep_clean_html to handle file links and final cleanup

    Args:
        html: HTML content
        url_mapping: Mapping of original URLs to configured HTML or new URLs

    Returns:
        HTML with replaced images and links
    """

    if not url_mapping:
        return deep_clean_html(html, url_mapping={})

    # Step 1: Replace images with media-insert containers
    # Pattern matches img tags and extracts src attribute
    img_pattern = re.compile(
        r'<img\s+[^>]*?src=["\']([^"\']+)["\'][^>]*?/?>', re.IGNORECASE | re.DOTALL
    )

    replaced_count = 0

    def replace_img(match):
        nonlocal replaced_count
        full_img_tag = match.group(0)
        src = unescape(match.group(1))  # Unescape HTML entities (e.g., &amp; -> &)

        if src in url_mapping:
            replacement = url_mapping[src]

            if not replacement:
                return full_img_tag

            # If replacement is HTML (media-insert container), use it directly
            if "<" in replacement and ">" in replacement:
                replaced_count += 1
                return replacement

            # Otherwise it's a simple URL - replace just the src attribute
            replaced_count += 1
            return re.sub(
                r'src=["\'][^"\']+["\']', f'src="{replacement}"', full_img_tag
            )
        else:
            logger.warning(f"Image not in URL mapping: {src[:120]}")
            return full_img_tag

    html = img_pattern.sub(replace_img, html)

    # Step 2: Collect file URLs for deep cleaning (exclude HTML replacements)
    file_url_mapping = {
        original: new
        for original, new in url_mapping.items()
        if new and not ("<" in new and ">" in new)
    }

    # Step 3: Apply deep_clean_html to handle file links and final cleanup
    cleaned_html = deep_clean_html(html, url_mapping=file_url_mapping)

    # Check for any remaining unreplaced images
    remaining_imgs = re.findall(r'<img\s+[^>]*?src=["\']([^"\']+)["\']', cleaned_html)
    if remaining_imgs:
        logger.warning(f"{len(remaining_imgs)} images remain unreplaced")

    return cleaned_html
