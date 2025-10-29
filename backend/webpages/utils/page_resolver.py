"""
Utilities for safely resolving pages and handling duplicates.

This module provides functions for retrieving pages while handling the case
where multiple pages with the same slug exist under the same parent.
"""

import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


def get_page_safely(slug: str, parent=None, log_duplicates: bool = True):
    """
    Safely get a page by slug and parent, handling multiple matches.

    This function replaces the problematic .get() calls that throw
    MultipleObjectsReturned errors. It returns the first non-deleted match
    and optionally logs when duplicates are found.

    Args:
        slug: The page slug to search for
        parent: The parent page (None for root pages)
        log_duplicates: Whether to log duplicate occurrences

    Returns:
        WebPage instance or None if not found

    Example:
        page = get_page_safely('about', parent=root_page)
        if page:
            # Use the page
            pass
    """
    from webpages.models import WebPage
    from webpages.models.duplicate_page_log import DuplicatePageLog

    # Build the query
    queryset = WebPage.objects.filter(slug=slug, parent=parent, is_deleted=False)

    # Check for duplicates
    count = queryset.count()

    if count == 0:
        return None

    if count > 1 and log_duplicates:
        # Log the duplicate occurrence
        page_ids = list(queryset.values_list("id", flat=True))
        try:
            DuplicatePageLog.log_duplicate(slug=slug, parent=parent, page_ids=page_ids)
            logger.warning(
                f"Multiple pages found for slug '{slug}' "
                f"under parent {parent.id if parent else 'root'}: "
                f"IDs {page_ids}. Using first match."
            )
        except Exception as e:
            # Don't let logging errors break page resolution
            logger.error(f"Failed to log duplicate page: {e}")

    # Return the first match (ordered by ID to be deterministic)
    return queryset.order_by("id").first()


def get_page_safely_with_context(
    slug: str, parent=None, log_duplicates: bool = True
) -> Tuple[Optional[object], bool]:
    """
    Get a page safely and return whether duplicates were found.

    This variant returns both the page and a boolean indicating if
    duplicates were detected, which can be useful for additional handling.

    Args:
        slug: The page slug to search for
        parent: The parent page (None for root pages)
        log_duplicates: Whether to log duplicate occurrences

    Returns:
        Tuple of (WebPage instance or None, has_duplicates boolean)

    Example:
        page, has_duplicates = get_page_safely_with_context('about', root_page)
        if has_duplicates:
            # Handle duplicate situation specially
            pass
    """
    from webpages.models import WebPage
    from webpages.models.duplicate_page_log import DuplicatePageLog

    # Build the query
    queryset = WebPage.objects.filter(slug=slug, parent=parent, is_deleted=False)

    # Check for duplicates
    count = queryset.count()

    if count == 0:
        return None, False

    has_duplicates = count > 1

    if has_duplicates and log_duplicates:
        # Log the duplicate occurrence
        page_ids = list(queryset.values_list("id", flat=True))
        try:
            DuplicatePageLog.log_duplicate(slug=slug, parent=parent, page_ids=page_ids)
            logger.warning(
                f"Multiple pages found for slug '{slug}' "
                f"under parent {parent.id if parent else 'root'}: "
                f"IDs {page_ids}. Using first match."
            )
        except Exception as e:
            # Don't let logging errors break page resolution
            logger.error(f"Failed to log duplicate page: {e}")

    # Return the first match (ordered by ID to be deterministic)
    return queryset.order_by("id").first(), has_duplicates
