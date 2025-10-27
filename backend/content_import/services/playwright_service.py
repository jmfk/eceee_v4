"""Playwright service integration for content import."""

import requests
import logging
from typing import Dict, Any, Optional
from django.conf import settings


logger = logging.getLogger(__name__)


class PlaywrightService:
    """Service for interacting with Playwright service."""

    def __init__(self):
        """Initialize Playwright service with configured URL."""
        self.base_url = getattr(
            settings, "PLAYWRIGHT_SERVICE_URL", "http://localhost:5000"
        )

    def capture_screenshot(
        self,
        url: str,
        viewport_width: int = 1920,
        viewport_height: int = 1080,
        full_page: bool = False,
    ) -> bytes:
        """
        Capture a screenshot of a webpage.

        Args:
            url: The URL to capture
            viewport_width: Width of viewport
            viewport_height: Height of viewport
            full_page: Whether to capture full page

        Returns:
            PNG image bytes

        Raises:
            Exception: If screenshot capture fails
        """
        endpoint = f"{self.base_url}/render"

        payload = {
            "url": url,
            "viewport_width": viewport_width,
            "viewport_height": viewport_height,
            "full_page": full_page,
            "remove_cookie_warnings": True,
        }

        try:
            response = requests.post(endpoint, json=payload, timeout=60)
            response.raise_for_status()

            return response.content

        except requests.RequestException as e:
            logger.error(f"Failed to capture screenshot for {url}: {e}")
            raise Exception(f"Screenshot capture failed: {str(e)}")

    def extract_element(
        self, url: str, x: int, y: int, timeout: int = 30000
    ) -> Dict[str, Any]:
        """
        Extract HTML element at coordinates.

        Args:
            url: The URL to extract from
            x: X coordinate
            y: Y coordinate
            timeout: Timeout in milliseconds

        Returns:
            Dictionary with element information

        Raises:
            Exception: If extraction fails
        """
        endpoint = f"{self.base_url}/extract-element"

        payload = {
            "url": url,
            "x": x,
            "y": y,
            "timeout": timeout,
        }

        try:
            response = requests.post(endpoint, json=payload, timeout=60)
            response.raise_for_status()

            return response.json()

        except requests.RequestException as e:
            logger.error(f"Failed to extract element from {url} at ({x}, {y}): {e}")
            raise Exception(f"Element extraction failed: {str(e)}")

    def validate_url(self, url: str) -> bool:
        """
        Validate if URL can be rendered.

        Args:
            url: The URL to validate

        Returns:
            True if URL is valid

        Raises:
            Exception: If URL is invalid
        """
        endpoint = f"{self.base_url}/validate"

        payload = {"url": url}

        try:
            response = requests.post(endpoint, json=payload, timeout=10)

            if response.status_code == 200:
                return True
            else:
                error_data = response.json()
                raise Exception(error_data.get("error", "URL validation failed"))

        except requests.RequestException as e:
            logger.error(f"Failed to validate URL {url}: {e}")
            raise Exception(f"URL validation failed: {str(e)}")
