"""Single page importer service for importing one page at a time."""

import logging
import time
import requests
from typing import Dict, Any, List
from urllib.parse import urljoin, urlparse, urlunparse
from bs4 import BeautifulSoup
from django.db import transaction
from django.contrib.auth.models import User
from django.utils import timezone

from ..models import WebPage, PageVersion
from content.models import Namespace, Tag
from .page_metadata_extractor import PageMetadataExtractor


logger = logging.getLogger(__name__)


class SinglePageImporter:
    """Import a single page and discover its links."""

    def __init__(self, user: User, namespace: Namespace, request_delay: float = 2.0):
        """
        Initialize single page importer.

        Args:
            user: User performing the import
            namespace: Namespace for tags
            request_delay: Delay between requests
        """
        self.user = user
        self.namespace = namespace
        self.request_delay = request_delay
        self.metadata_extractor = PageMetadataExtractor()

    def import_page(
        self,
        url: str,
        parent_page: WebPage = None,
        hostname: str = None,
        base_url: str = None,
        code_layout: str = "",
    ) -> Dict[str, Any]:
        """
        Import a single page and return discovered links.

        Args:
            url: URL to import
            parent_page: Optional parent page
            hostname: Optional hostname for root pages
            base_url: Base URL to filter discovered links
            code_layout: Optional code layout name to apply to imported page

        Returns:
            {
                "success": bool,
                "page": {...} or None,
                "discovered_urls": [...],
                "error": str or None
            }
        """
        result = {
            "success": False,
            "page": None,
            "discovered_urls": [],
            "error": None,
        }

        try:
            # Add delay before request
            time.sleep(self.request_delay)

            # Fetch page
            html = self._fetch_page(url)

            # Extract metadata
            metadata = self.metadata_extractor.extract(html, url)
            slug = metadata["slug"]

            # Check if slug already exists
            existing_page = self._check_existing(slug, parent_page)

            if existing_page:
                # Build full hierarchical path (ignoring silent slugs)
                path_parts = [existing_page.slug]
                current = existing_page.parent
                while current:
                    path_parts.insert(0, current.slug)
                    current = current.parent
                full_path = "/" + "/".join(path_parts) + "/"

                logger.warning(f"Slug '{slug}' already exists, skipping: {url}")
                result["success"] = True
                result["page"] = {
                    "id": existing_page.id,
                    "slug": slug,
                    "title": existing_page.title,  # Use existing page title
                    "url": url,
                    "skipped": True,
                    "reason": f"Page already exists at {full_path}",
                    "use_as_parent_id": existing_page.id,  # Use this for children
                    "full_path": full_path,
                }
            else:
                # Create page
                with transaction.atomic():
                    page, slug_warning = self._create_page(
                        slug=slug,
                        metadata=metadata,
                        url=url,
                        parent_page=parent_page,
                        hostname=hostname,
                        code_layout=code_layout,
                    )

                # Build full path
                path_parts = [page.slug]
                current = page.parent
                while current:
                    path_parts.insert(0, current.slug)
                    current = current.parent
                full_path = "/" + "/".join(path_parts) + "/"

                logger.info(f"Created page: {page.slug} (from {url})")
                result["success"] = True
                result["page"] = {
                    "id": page.id,
                    "slug": page.slug,  # Use actual slug (may be modified)
                    "title": metadata["title"],
                    "url": url,
                    "skipped": False,
                    "use_as_parent_id": page.id,  # Use this for children
                    "full_path": full_path,
                }

                # Add warning if slug was modified
                if slug_warning:
                    result["page"]["warnings"] = [slug_warning]

            # Extract links from the page
            discovered_urls = self._extract_links(html, url, base_url)
            result["discovered_urls"] = discovered_urls

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to import {url}: {error_msg}")
            result["error"] = error_msg

        return result

    def _fetch_page(self, url: str) -> str:
        """
        Fetch HTML content from URL with retry logic.

        Args:
            url: The URL to fetch

        Returns:
            HTML content as string
        """
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.get(url, timeout=30, headers=headers)
                response.raise_for_status()
                return response.text

            except requests.HTTPError as e:
                if e.response is not None and e.response.status_code in [
                    503,
                    502,
                    504,
                    429,
                ]:
                    if attempt < max_retries - 1:
                        wait_time = self.request_delay * (2**attempt)
                        logger.warning(
                            f"HTTP {e.response.status_code} for {url}, "
                            f"retrying in {wait_time}s"
                        )
                        time.sleep(wait_time)
                        continue
                raise

    def _check_existing(self, slug: str, parent_page: WebPage = None) -> WebPage:
        """Check if page with slug already exists."""
        if parent_page:
            return WebPage.objects.filter(
                parent=parent_page, slug=slug, is_deleted=False
            ).first()
        else:
            return WebPage.objects.filter(
                parent__isnull=True, slug=slug, is_deleted=False
            ).first()

    def _create_page(
        self,
        slug: str,
        metadata: Dict[str, Any],
        url: str,
        parent_page: WebPage = None,
        hostname: str = None,
        code_layout: str = "",
    ) -> tuple:
        """
        Create WebPage and PageVersion.

        Args:
            slug: Page slug
            metadata: Extracted page metadata
            url: Source URL
            parent_page: Optional parent page
            hostname: Optional hostname for root pages
            code_layout: Optional code layout name to apply

        Returns:
            tuple: (page, slug_warning_dict or None)
        """
        # Create page instance (don't save yet)
        page = WebPage(
            parent=parent_page,
            slug=slug,
            title=metadata["title"],
            description=metadata["description"],
            created_by=self.user,
            last_modified_by=self.user,
        )

        # Ensure unique slug and track if modified
        slug_info = page.ensure_unique_slug()

        # Set hostname for root pages
        if not parent_page and hostname:
            page.hostnames = [hostname]

        # Save the page
        page.save()

        # Create initial PageVersion (version 1 for new page)
        # Leave effective_date as None to keep the page as unpublished/draft
        page_version = PageVersion.objects.create(
            page=page,
            version_number=1,
            version_title=f"Imported from {url}",
            page_data={
                "metaTitle": metadata["title"],
                "metaDescription": metadata["description"],
            },
            widgets={},
            code_layout=code_layout,  # Use provided layout or empty string for default
            # effective_date is None by default, keeping the page as draft/unpublished
            created_by=self.user,
            tags=metadata["tags"],  # tags is an ArrayField of strings
        )

        # Create tags in the namespace if they don't exist (for future use)
        if metadata["tags"]:
            for tag_name in metadata["tags"]:
                Tag.objects.get_or_create(
                    name=tag_name,
                    namespace=self.namespace,
                    defaults={
                        "slug": tag_name.lower().replace(" ", "-"),
                        "created_by": self.user,
                    },
                )

        # Return page and slug warning if slug was modified
        slug_warning = None
        if slug_info["modified"]:
            slug_warning = {
                "field": "slug",
                "message": f"Slug '{slug_info['original_slug']}' was modified to '{slug_info['new_slug']}' to ensure uniqueness",
                "original_value": slug_info["original_slug"],
                "new_value": slug_info["new_slug"],
            }

        return page, slug_warning

    def _extract_links(
        self, html: str, base_url: str, filter_base_url: str = None
    ) -> List[str]:
        """
        Extract links from HTML.

        Args:
            html: HTML content
            base_url: Base URL for resolving relative links
            filter_base_url: Only return URLs under this base

        Returns:
            List of absolute URLs
        """
        soup = BeautifulSoup(html, "html.parser")
        links = []

        # Parse filter base URL
        if filter_base_url:
            parsed_filter = urlparse(filter_base_url)
            filter_domain = f"{parsed_filter.scheme}://{parsed_filter.netloc}"
            filter_path = parsed_filter.path
            if filter_path.endswith("/") and filter_path != "/":
                filter_path = filter_path[:-1]
        else:
            filter_domain = None
            filter_path = None

        for a_tag in soup.find_all("a", href=True):
            href = a_tag.get("href", "")

            # Skip anchors, javascript, mailto, etc.
            if (
                href.startswith("#")
                or href.startswith("javascript:")
                or href.startswith("mailto:")
                or href.startswith("tel:")
            ):
                continue

            # Convert to absolute URL
            absolute_url = urljoin(base_url, href)

            # Normalize URL (remove fragment, trailing slash)
            parsed = urlparse(absolute_url)
            normalized = urlunparse(
                (
                    parsed.scheme,
                    parsed.netloc,
                    parsed.path,
                    parsed.params,
                    parsed.query,
                    "",
                )
            )
            if normalized.endswith("/") and parsed.path != "/":
                normalized = normalized[:-1]

            # Filter by base URL if provided
            if filter_domain:
                parsed_link = urlparse(normalized)
                link_domain = f"{parsed_link.scheme}://{parsed_link.netloc}"
                link_path = parsed_link.path
                if link_path.endswith("/") and link_path != "/":
                    link_path = link_path[:-1]

                # Check domain match
                if link_domain != filter_domain:
                    continue

                # Check path match
                if filter_path and filter_path != "/":
                    if not (
                        link_path == filter_path
                        or link_path.startswith(filter_path + "/")
                    ):
                        continue

            if normalized not in links:
                links.append(normalized)

        return links
