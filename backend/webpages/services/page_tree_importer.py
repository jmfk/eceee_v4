"""Page tree importer service for creating WebPage objects from crawled trees."""

import logging
from typing import Dict, Any, List, Optional
from django.db import transaction
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.cache import cache

from ..models import WebPage, PageVersion
from content.models import Namespace, Tag
from .page_metadata_extractor import PageMetadataExtractor
from .page_tree_crawler import CrawledPage, PageTreeCrawler


logger = logging.getLogger(__name__)


class ImportProgress:
    """Track import progress."""

    def __init__(self):
        self.pages_discovered = 0
        self.pages_created = 0
        self.pages_skipped = 0
        self.errors = []
        self.current_url = None
        self.status = "pending"  # pending, running, completed, failed
        # Enhanced tracking
        self.urls_completed = []  # List of successfully processed URLs
        self.urls_in_queue = []  # List of discovered but not yet processed URLs
        self.urls_failed = []  # List of {"url": "...", "error": "..."} dicts
        self.slug_warnings = (
            []
        )  # List of {"url": "...", "original_slug": "...", "new_slug": "..."} dicts

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "pages_discovered": self.pages_discovered,
            "pages_created": self.pages_created,
            "pages_skipped": self.pages_skipped,
            "errors": self.errors,
            "current_url": self.current_url,
            "status": self.status,
            "urls_completed": self.urls_completed,
            "urls_in_queue": self.urls_in_queue,
            "urls_failed": self.urls_failed,
            "slug_warnings": self.slug_warnings,
        }


class PageTreeImporter:
    """Import page trees from external websites."""

    def __init__(self, user: User, namespace: Namespace, task_id: str = None):
        """
        Initialize importer.

        Args:
            user: User performing the import
            namespace: Namespace for tags
            task_id: Optional task ID for cache updates
        """
        self.user = user
        self.namespace = namespace
        self.task_id = task_id
        self.metadata_extractor = PageMetadataExtractor()
        self.progress = ImportProgress()
        self.url_to_webpage: Dict[str, WebPage] = {}

    def import_tree(
        self,
        start_url: str,
        parent_page: Optional[WebPage] = None,
        hostname: Optional[str] = None,
        max_depth: int = 5,
        max_pages: int = 100,
        request_delay: float = 2.0,
    ) -> ImportProgress:
        """
        Import page tree from external website.

        Args:
            start_url: Starting URL to crawl
            parent_page: Optional parent page (for subpage import)
            hostname: Optional hostname (for root page import)
            max_depth: Maximum crawl depth
            max_pages: Maximum pages to crawl
            request_delay: Delay between requests in seconds

        Returns:
            ImportProgress object with results
        """
        try:
            self.progress.status = "running"

            # Step 1: Crawl the website
            logger.info(f"Crawling {start_url}...")
            crawler = PageTreeCrawler(
                max_depth=max_depth, max_pages=max_pages, request_delay=request_delay
            )
            root_page = crawler.crawl(start_url)

            # Count discovered pages
            self.progress.pages_discovered = self._count_pages(root_page)
            logger.info(f"Discovered {self.progress.pages_discovered} pages")

            # Step 2: Build queue of URLs to import
            self._build_url_queue(root_page)
            self._update_cache()  # Update cache with initial queue

            # Step 3: Import pages
            logger.info("Importing pages...")
            with transaction.atomic():
                self._import_page_recursive(root_page, parent_page, hostname)

            self.progress.status = "completed"
            logger.info(
                f"Import complete. Created {self.progress.pages_created} pages, "
                f"skipped {self.progress.pages_skipped} pages"
            )

        except Exception as e:
            logger.error(f"Import failed: {e}")
            self.progress.status = "failed"
            self.progress.errors.append(f"Import failed: {str(e)}")

        return self.progress

    def _update_cache(self):
        """Update progress in cache for real-time updates."""
        if self.task_id:
            cache.set(f"import_progress_{self.task_id}", self.progress.to_dict(), 3600)

    def _build_url_queue(self, page: CrawledPage):
        """
        Build list of URLs to be imported.

        Args:
            page: Root CrawledPage
        """
        self.progress.urls_in_queue.append(page.url)
        for child in page.children:
            self._build_url_queue(child)

    def _import_page_recursive(
        self,
        crawled_page: CrawledPage,
        parent_page: Optional[WebPage],
        hostname: Optional[str] = None,
        html: Optional[str] = None,
    ):
        """
        Recursively import pages.

        Args:
            crawled_page: CrawledPage to import
            parent_page: Parent WebPage (None for root)
            hostname: Hostname for root page
            html: Optional cached HTML content
        """
        self.progress.current_url = crawled_page.url

        # Remove from queue
        if crawled_page.url in self.progress.urls_in_queue:
            self.progress.urls_in_queue.remove(crawled_page.url)

        try:
            # Fetch page if not provided
            if html is None:
                import requests

                response = requests.get(
                    crawled_page.url,
                    timeout=30,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    },
                )
                response.raise_for_status()
                html = response.text

            # Extract metadata
            metadata = self.metadata_extractor.extract(html, crawled_page.url)
            slug = metadata["slug"]

            # Check if slug already exists under same parent
            existing_page = None
            if parent_page:
                existing_page = WebPage.objects.filter(
                    parent=parent_page, slug=slug, is_deleted=False
                ).first()
            else:
                # Root page
                existing_page = WebPage.objects.filter(
                    parent__isnull=True, slug=slug, is_deleted=False
                ).first()

            if existing_page:
                # Build full hierarchical path (ignoring silent slugs)
                path_parts = [existing_page.slug]
                current = existing_page.parent
                while current:
                    path_parts.insert(0, current.slug)
                    current = current.parent
                full_path = "/" + "/".join(path_parts) + "/"

                logger.warning(
                    f"Page already exists at {full_path}, skipping: {crawled_page.url}"
                )
                self.progress.pages_skipped += 1
                # Use existing page as parent for children
                webpage = existing_page
            else:
                # Create new page instance (don't save yet)
                webpage = WebPage(
                    parent=parent_page,
                    slug=slug,
                    title=metadata["title"],
                    description=metadata["description"],
                    created_by=self.user,
                    last_modified_by=self.user,
                )

                # Ensure unique slug and track if modified
                slug_info = webpage.ensure_unique_slug()

                # Set hostname for root pages
                if not parent_page and hostname:
                    webpage.hostnames = [hostname]

                # Save the page
                webpage.save()

                # Track slug warning if modified
                if slug_info["modified"]:
                    self.progress.slug_warnings.append(
                        {
                            "url": crawled_page.url,
                            "original_slug": slug_info["original_slug"],
                            "new_slug": slug_info["new_slug"],
                            "message": f"Slug '{slug_info['original_slug']}' was modified to '{slug_info['new_slug']}' to ensure uniqueness",
                        }
                    )
                    logger.info(
                        f"Slug auto-renamed: '{slug_info['original_slug']}' -> '{slug_info['new_slug']}' "
                        f"for {crawled_page.url}"
                    )

                # Create initial PageVersion with metadata (version 1 for new page)
                page_version = PageVersion.objects.create(
                    page=webpage,
                    version_number=1,
                    version_title=f"Imported from {crawled_page.url}",
                    page_data={
                        "metaTitle": metadata["title"],
                        "metaDescription": metadata["description"],
                    },
                    widgets={},
                    code_layout="",
                    effective_date=timezone.now(),
                    created_by=self.user,
                    tags=metadata["tags"],  # tags is an ArrayField of strings
                )

                # Create tags in namespace if they don't exist
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

                self.progress.pages_created += 1
                logger.info(f"Created page: {webpage.slug} (from {crawled_page.url})")

            # Store mapping
            self.url_to_webpage[crawled_page.url] = webpage

            # Mark as completed
            if crawled_page.url not in self.progress.urls_completed:
                self.progress.urls_completed.append(crawled_page.url)

            # Update cache to show progress
            self._update_cache()

            # Import children
            for child in crawled_page.children:
                self._import_page_recursive(child, webpage)

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to import {crawled_page.url}: {error_msg}")

            # Add to failed URLs
            self.progress.urls_failed.append(
                {"url": crawled_page.url, "error": error_msg}
            )

            self.progress.errors.append(
                f"Failed to import {crawled_page.url}: {error_msg}"
            )
            self.progress.pages_skipped += 1

    def _count_pages(self, page: CrawledPage) -> int:
        """
        Count total pages in tree.

        Args:
            page: Root page

        Returns:
            Total page count
        """
        count = 1
        for child in page.children:
            count += self._count_pages(child)
        return count
