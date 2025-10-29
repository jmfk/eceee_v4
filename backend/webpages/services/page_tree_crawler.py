"""Page tree crawler service for discovering and crawling website hierarchies."""

import logging
import time
from typing import Dict, Any, List, Set
from urllib.parse import urljoin, urlparse, urlunparse
from collections import deque
from bs4 import BeautifulSoup
import requests


logger = logging.getLogger(__name__)


class CrawledPage:
    """Represents a crawled page in the tree."""

    def __init__(self, url: str, parent_url: str = None, depth: int = 0):
        self.url = url
        self.parent_url = parent_url
        self.depth = depth
        self.children = []
        self.metadata = {}
        self.error = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "url": self.url,
            "parent_url": self.parent_url,
            "depth": self.depth,
            "metadata": self.metadata,
            "error": self.error,
            "children": [child.to_dict() for child in self.children],
        }


class PageTreeCrawler:
    """Crawl a website and build a hierarchical page tree."""

    def __init__(
        self, max_depth: int = 5, max_pages: int = 100, request_delay: float = 2.0
    ):
        """
        Initialize crawler.

        Args:
            max_depth: Maximum depth to crawl
            max_pages: Maximum number of pages to crawl
            request_delay: Delay in seconds between requests (default 2.0)
        """
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.request_delay = request_delay
        self.visited_urls: Set[str] = set()
        self.url_to_page: Dict[str, CrawledPage] = {}

    def crawl(self, start_url: str) -> CrawledPage:
        """
        Crawl website starting from start_url.

        Only crawls pages that are subpaths of start_url.

        Args:
            start_url: The starting URL to crawl from

        Returns:
            Root CrawledPage with children hierarchy
        """
        # Normalize start URL
        start_url = self._normalize_url(start_url)
        start_path = self._get_url_path(start_url)
        start_domain = self._get_domain(start_url)

        logger.info(f"Starting crawl from {start_url}")
        logger.info(f"Will only crawl subpaths of: {start_path}")

        # Create root page
        root_page = CrawledPage(start_url, None, 0)
        self.url_to_page[start_url] = root_page

        # Queue for breadth-first crawling
        queue = deque([root_page])
        self.visited_urls.add(start_url)

        pages_crawled = 0

        while queue and pages_crawled < self.max_pages:
            current_page = queue.popleft()

            # Skip if max depth reached
            if current_page.depth >= self.max_depth:
                logger.debug(f"Max depth reached for {current_page.url}")
                continue

            # Fetch and parse the page
            try:
                html = self._fetch_page(current_page.url)
                links = self._extract_links(html, current_page.url)

                # Process each link
                for link_url in links:
                    # Normalize the link
                    link_url = self._normalize_url(link_url)

                    # Skip if already visited
                    if link_url in self.visited_urls:
                        continue

                    # Check if link is on same domain
                    if self._get_domain(link_url) != start_domain:
                        logger.debug(f"Skipping external link: {link_url}")
                        continue

                    # Check if link is subpath of start URL
                    link_path = self._get_url_path(link_url)
                    if not self._is_subpath(link_path, start_path):
                        logger.debug(
                            f"Skipping non-subpath: {link_path} not under {start_path}"
                        )
                        continue

                    # Check page limit
                    if pages_crawled >= self.max_pages:
                        logger.warning(f"Reached max pages limit ({self.max_pages})")
                        break

                    # Create child page
                    child_page = CrawledPage(
                        link_url, current_page.url, current_page.depth + 1
                    )
                    current_page.children.append(child_page)
                    self.url_to_page[link_url] = child_page

                    # Mark as visited and add to queue
                    self.visited_urls.add(link_url)
                    queue.append(child_page)

                    logger.debug(f"Queued page: {link_url} (depth {child_page.depth})")

                pages_crawled += 1

            except Exception as e:
                logger.error(f"Failed to crawl {current_page.url}: {e}")
                current_page.error = str(e)

        logger.info(f"Crawl complete. Visited {pages_crawled} pages")
        return root_page

    def _fetch_page(self, url: str) -> str:
        """
        Fetch HTML content from URL with rate limiting and retry logic.

        Args:
            url: The URL to fetch

        Returns:
            HTML content as string

        Raises:
            Exception: If fetch fails after all retries
        """
        # Add delay before request to avoid overwhelming server
        time.sleep(self.request_delay)

        # Better headers to appear more like a real browser
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

        # Retry logic for server errors
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = requests.get(
                    url,
                    timeout=30,
                    headers=headers,
                )
                response.raise_for_status()
                return response.text

            except requests.HTTPError as e:
                # Check if it's a server error that we should retry
                if e.response is not None and e.response.status_code in [
                    503,
                    502,
                    504,
                    429,
                ]:
                    if attempt < max_retries - 1:
                        # Exponential backoff
                        wait_time = self.request_delay * (2**attempt)
                        logger.warning(
                            f"HTTP {e.response.status_code} for {url}, "
                            f"retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(wait_time)
                        continue
                    else:
                        logger.error(
                            f"Failed to fetch {url} after {max_retries} attempts: {e}"
                        )
                        raise
                else:
                    # Client error or other error - don't retry
                    logger.error(f"Failed to fetch {url}: {e}")
                    raise

            except Exception as e:
                logger.error(f"Failed to fetch {url}: {e}")
                raise

    def _extract_links(self, html: str, base_url: str) -> List[str]:
        """
        Extract all links from HTML.

        Args:
            html: HTML content
            base_url: Base URL for resolving relative links

        Returns:
            List of absolute URLs
        """
        soup = BeautifulSoup(html, "html.parser")
        links = []

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
            links.append(absolute_url)

        return links

    def _normalize_url(self, url: str) -> str:
        """
        Normalize URL by removing fragments and trailing slashes.

        Args:
            url: URL to normalize

        Returns:
            Normalized URL
        """
        parsed = urlparse(url)
        # Remove fragment
        normalized = urlunparse(
            (parsed.scheme, parsed.netloc, parsed.path, parsed.params, parsed.query, "")
        )
        # Remove trailing slash (except for root)
        if normalized.endswith("/") and parsed.path != "/":
            normalized = normalized[:-1]

        return normalized

    def _get_domain(self, url: str) -> str:
        """
        Get domain from URL.

        Args:
            url: URL to parse

        Returns:
            Domain (scheme + netloc)
        """
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}"

    def _get_url_path(self, url: str) -> str:
        """
        Get path component from URL.

        Args:
            url: URL to parse

        Returns:
            Path component
        """
        parsed = urlparse(url)
        path = parsed.path

        # Remove trailing slash for consistency
        if path.endswith("/") and path != "/":
            path = path[:-1]

        return path

    def _is_subpath(self, path: str, parent_path: str) -> bool:
        """
        Check if path is a subpath of parent_path.

        Args:
            path: Path to check
            parent_path: Parent path

        Returns:
            True if path is under parent_path
        """
        # Root path includes everything
        if parent_path == "/" or parent_path == "":
            return True

        # Ensure trailing slash for proper comparison
        if not parent_path.endswith("/"):
            parent_path_slash = parent_path + "/"
        else:
            parent_path_slash = parent_path

        # Check if path starts with parent path
        # Also accept exact match
        return path == parent_path or path.startswith(parent_path_slash)
