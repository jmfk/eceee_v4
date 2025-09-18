"""
Utility functions for file manager operations.
"""

import re
from bs4 import BeautifulSoup
from typing import Set, Dict, List, Tuple
from django.db import transaction
from .models import MediaFile


def extract_media_references(html_content: str) -> Set[str]:
    """
    Extract all media file IDs referenced in HTML content.

    Args:
        html_content: HTML string to parse

    Returns:
        Set of media file IDs found in the content
    """
    if not html_content:
        return set()

    soup = BeautifulSoup(html_content, "html.parser")
    media_ids = set()

    # Find all img tags
    for img in soup.find_all("img"):
        src = img.get("src", "")
        # Extract UUID from media URLs
        uuid_match = re.search(r"/media/([0-9a-f-]{36})/", src)
        if uuid_match:
            media_ids.add(uuid_match.group(1))

    return media_ids


def update_media_references(
    content_type: str, content_id: str, old_content: str, new_content: str
) -> Tuple[List[str], List[str]]:
    """
    Update media references when content changes.

    Args:
        content_type: Type of content being updated (e.g., 'webpage', 'widget')
        content_id: ID of the content being updated
        old_content: Previous HTML content
        new_content: New HTML content

    Returns:
        Tuple of (added_refs, removed_refs) - lists of media IDs
    """
    old_refs = extract_media_references(old_content)
    new_refs = extract_media_references(new_content)

    added_refs = new_refs - old_refs
    removed_refs = old_refs - new_refs

    with transaction.atomic():
        # Add new references
        for media_id in added_refs:
            try:
                media = MediaFile.objects.get(id=media_id)
                media.add_reference(content_type, content_id)
            except MediaFile.DoesNotExist:
                continue

        # Remove old references
        for media_id in removed_refs:
            try:
                media = MediaFile.objects.get(id=media_id)
                media.remove_reference(content_type, content_id)
            except MediaFile.DoesNotExist:
                continue

    return list(added_refs), list(removed_refs)


def cleanup_content_references(content_type: str, content_id: str) -> None:
    """
    Remove all media references for a piece of content (e.g., when content is deleted).

    Args:
        content_type: Type of content being deleted
        content_id: ID of the content being deleted
    """
    with transaction.atomic():
        media_files = MediaFile.objects.filter(
            referenced_in__contains={content_type: [content_id]}
        )
        for media in media_files:
            media.remove_reference(content_type, content_id)
