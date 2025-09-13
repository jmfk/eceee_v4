"""
Website rendering service for capturing screenshots of external websites.

This service uses Playwright to render websites and capture them as PNG images.
It includes security measures, URL validation, and configurable options.
"""

import asyncio
import io
import logging
from typing import Optional, Dict, Any
from urllib.parse import urlparse
import tempfile
import os

from django.conf import settings
from django.core.files.base import ContentFile
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

logger = logging.getLogger(__name__)


class WebsiteRenderingError(Exception):
    """Custom exception for website rendering errors."""

    pass


class WebsiteRenderer:
    """
    Service class for rendering external websites to PNG images.

    Features:
    - Asynchronous rendering using Playwright
    - Configurable viewport sizes
    - Security restrictions on allowed domains
    - Timeout handling
    - Error handling and logging
    """

    # Default configuration
    DEFAULT_CONFIG = {
        "viewport_width": 1920,
        "viewport_height": 1080,
        "timeout": 30000,  # 30 seconds
        "wait_for_load_state": "networkidle",
        "full_page": False,
        "quality": 90,
    }

    # Security: List of blocked domains/patterns
    BLOCKED_DOMAINS = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "10.",  # Private IP ranges
        "172.",
        "192.168.",
        "internal",
        ".local",
    ]

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the website renderer with optional configuration."""
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None

    def _validate_url(self, url: str) -> bool:
        """
        Validate URL for security and format compliance.

        Args:
            url: The URL to validate

        Returns:
            bool: True if URL is valid and safe

        Raises:
            WebsiteRenderingError: If URL is invalid or blocked
        """
        try:
            parsed = urlparse(url)

            # Check if URL has a valid scheme
            if parsed.scheme not in ["http", "https"]:
                raise WebsiteRenderingError(
                    f"Invalid URL scheme: {parsed.scheme}. Only HTTP and HTTPS are allowed."
                )

            # Check if URL has a valid hostname
            if not parsed.netloc:
                raise WebsiteRenderingError("URL must have a valid hostname.")

            # Security check: Block internal/private domains
            hostname = parsed.netloc.lower()
            for blocked in self.BLOCKED_DOMAINS:
                if blocked in hostname:
                    raise WebsiteRenderingError(
                        f"Access to domain '{hostname}' is not allowed for security reasons."
                    )

            return True

        except Exception as e:
            if isinstance(e, WebsiteRenderingError):
                raise
            raise WebsiteRenderingError(f"Invalid URL format: {str(e)}")

    async def _setup_browser(self) -> None:
        """Set up the Playwright browser and context."""
        if self.browser is None:
            playwright = await async_playwright().start()
            self.browser = await playwright.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--disable-web-security",
                    "--disable-features=VizDisplayCompositor",
                ],
            )
            self.context = await self.browser.new_context(
                viewport={
                    "width": self.config["viewport_width"],
                    "height": self.config["viewport_height"],
                },
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            )

    async def _cleanup_browser(self) -> None:
        """Clean up browser resources."""
        if self.context:
            await self.context.close()
            self.context = None
        if self.browser:
            await self.browser.close()
            self.browser = None

    async def render_website_async(
        self, url: str, custom_config: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Asynchronously render a website to PNG bytes.

        Args:
            url: The URL of the website to render
            custom_config: Optional custom configuration overrides

        Returns:
            bytes: PNG image data

        Raises:
            WebsiteRenderingError: If rendering fails
        """
        # Validate URL first
        self._validate_url(url)

        # Merge custom config
        config = {**self.config, **(custom_config or {})}

        try:
            await self._setup_browser()

            if not self.context:
                raise WebsiteRenderingError("Failed to initialize browser context")

            page: Page = await self.context.new_page()

            # Set additional page configurations
            await page.set_extra_http_headers(
                {
                    "Accept-Language": "en-US,en;q=0.9",
                }
            )

            logger.info(f"Navigating to URL: {url}")

            # Navigate to the page with timeout
            await page.goto(
                url, wait_until=config["wait_for_load_state"], timeout=config["timeout"]
            )

            # Wait a bit more for any dynamic content
            await page.wait_for_timeout(2000)

            # Take screenshot
            screenshot_options = {
                "type": "png",
                "quality": config["quality"],
                "full_page": config["full_page"],
            }

            logger.info("Taking screenshot...")
            screenshot_bytes = await page.screenshot(**screenshot_options)

            await page.close()

            logger.info(f"Successfully rendered website: {url}")
            return screenshot_bytes

        except Exception as e:
            logger.error(f"Failed to render website {url}: {str(e)}")
            if isinstance(e, WebsiteRenderingError):
                raise
            raise WebsiteRenderingError(f"Failed to render website: {str(e)}")

        finally:
            await self._cleanup_browser()

    def render_website(
        self, url: str, custom_config: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Synchronous wrapper for website rendering.

        Args:
            url: The URL of the website to render
            custom_config: Optional custom configuration overrides

        Returns:
            bytes: PNG image data

        Raises:
            WebsiteRenderingError: If rendering fails
        """
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        try:
            return loop.run_until_complete(
                self.render_website_async(url, custom_config)
            )
        finally:
            # Clean up the loop if we created it
            if loop.is_running():
                pass  # Don't close if it's still running
            else:
                loop.close()

    def render_to_file(
        self, url: str, output_path: str, custom_config: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Render website and save to file.

        Args:
            url: The URL of the website to render
            output_path: Path where to save the PNG file
            custom_config: Optional custom configuration overrides

        Returns:
            str: Path to the saved file

        Raises:
            WebsiteRenderingError: If rendering or saving fails
        """
        try:
            screenshot_bytes = self.render_website(url, custom_config)

            with open(output_path, "wb") as f:
                f.write(screenshot_bytes)

            logger.info(f"Screenshot saved to: {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"Failed to save screenshot to {output_path}: {str(e)}")
            raise WebsiteRenderingError(f"Failed to save screenshot: {str(e)}")

    def render_to_django_file(
        self,
        url: str,
        filename: Optional[str] = None,
        custom_config: Optional[Dict[str, Any]] = None,
    ) -> ContentFile:
        """
        Render website and return as Django ContentFile.

        Args:
            url: The URL of the website to render
            filename: Optional filename for the ContentFile
            custom_config: Optional custom configuration overrides

        Returns:
            ContentFile: Django file object containing the PNG data

        Raises:
            WebsiteRenderingError: If rendering fails
        """
        screenshot_bytes = self.render_website(url, custom_config)

        if not filename:
            # Generate filename from URL
            parsed = urlparse(url)
            domain = parsed.netloc.replace(".", "_").replace(":", "_")
            filename = f"screenshot_{domain}.png"

        return ContentFile(screenshot_bytes, name=filename)


# Convenience function for one-off rendering
def render_website_to_png(url: str, config: Optional[Dict[str, Any]] = None) -> bytes:
    """
    Convenience function to render a website to PNG bytes.

    Args:
        url: The URL of the website to render
        config: Optional configuration overrides

    Returns:
        bytes: PNG image data

    Raises:
        WebsiteRenderingError: If rendering fails
    """
    renderer = WebsiteRenderer(config)
    return renderer.render_website(url)