"""
Simple Flask web service for website rendering using Playwright.

This service provides a lightweight alternative to the Django implementation,
designed to run in a Docker container with Playwright pre-installed.
"""

import asyncio
import logging
import os
import time
from typing import Optional, Dict, Any
from urllib.parse import urlparse
import json

from flask import Flask, request, jsonify, send_file
from playwright.async_api import async_playwright, Browser, BrowserContext, Page
import tempfile

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
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


class WebsiteRenderingError(Exception):
    """Custom exception for website rendering errors."""

    pass


def validate_url(url: str) -> bool:
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
        for blocked in BLOCKED_DOMAINS:
            if blocked in hostname:
                raise WebsiteRenderingError(
                    f"Access to domain '{hostname}' is not allowed for security reasons."
                )

        return True

    except Exception as e:
        if isinstance(e, WebsiteRenderingError):
            raise
        raise WebsiteRenderingError(f"Invalid URL format: {str(e)}")


async def render_website_async(
    url: str, config: Optional[Dict[str, Any]] = None
) -> bytes:
    """
    Asynchronously render a website to PNG bytes.

    Args:
        url: The URL of the website to render
        config: Optional custom configuration overrides

    Returns:
        bytes: PNG image data

    Raises:
        WebsiteRenderingError: If rendering fails
    """
    # Validate URL first
    validate_url(url)

    # Merge custom config
    render_config = {**DEFAULT_CONFIG, **(config or {})}

    browser = None
    context = None

    try:
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-web-security",
                "--disable-features=VizDisplayCompositor",
            ],
        )
        context = await browser.new_context(
            viewport={
                "width": render_config["viewport_width"],
                "height": render_config["viewport_height"],
            },
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )

        if not context:
            raise WebsiteRenderingError("Failed to initialize browser context")

        page: Page = await context.new_page()

        # Set additional page configurations
        await page.set_extra_http_headers(
            {
                "Accept-Language": "en-US,en;q=0.9",
            }
        )

        logger.info(f"Navigating to URL: {url}")

        # Navigate to the page with timeout
        await page.goto(
            url,
            wait_until=render_config["wait_for_load_state"],
            timeout=render_config["timeout"],
        )

        # Wait a bit more for any dynamic content
        await page.wait_for_timeout(2000)

        # Take screenshot
        screenshot_options = {
            "type": "png",
            "full_page": render_config["full_page"],
        }

        # Quality is only supported for JPEG, not PNG
        # if render_config.get("format") == "jpeg":
        #     screenshot_options["quality"] = render_config["quality"]

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
        if context:
            await context.close()
        if browser:
            await browser.close()


def render_website(url: str, config: Optional[Dict[str, Any]] = None) -> bytes:
    """
    Synchronous wrapper for website rendering.

    Args:
        url: The URL of the website to render
        config: Optional custom configuration overrides

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
        return loop.run_until_complete(render_website_async(url, config))
    finally:
        # Clean up the loop if we created it
        if not loop.is_running():
            loop.close()


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify(
        {
            "status": "healthy",
            "service": "playwright-website-renderer",
            "version": "1.0.0",
        }
    )


@app.route("/render", methods=["POST"])
def render_website_endpoint():
    """
    Render an external website to PNG image.

    POST /render

    Request body:
    {
        "url": "https://example.com",
        "viewport_width": 1920,  // optional
        "viewport_height": 1080,  // optional
        "full_page": false,      // optional
        "timeout": 30000         // optional, in milliseconds
    }

    Returns:
        - PNG image data as binary response with appropriate headers
        - Or JSON error response if rendering fails
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "JSON request body required"}), 400

        # Get URL from request
        url = data.get("url")
        if not url:
            return jsonify({"error": "URL is required"}), 400

        # Get optional configuration parameters
        custom_config = {}
        if "viewport_width" in data:
            custom_config["viewport_width"] = int(data["viewport_width"])
        if "viewport_height" in data:
            custom_config["viewport_height"] = int(data["viewport_height"])
        if "full_page" in data:
            custom_config["full_page"] = bool(data["full_page"])
        if "timeout" in data:
            custom_config["timeout"] = int(data["timeout"])

        logger.info(f"Rendering website to PNG: {url}")

        # Render website
        try:
            png_bytes = render_website(url, custom_config)

            # Save to temporary file and return
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_file:
                tmp_file.write(png_bytes)
                tmp_file_path = tmp_file.name

            logger.info(f"Successfully rendered website: {url}")

            # Return the file and schedule cleanup
            def remove_file(response):
                try:
                    os.unlink(tmp_file_path)
                except OSError:
                    pass
                return response

            response = send_file(
                tmp_file_path,
                mimetype="image/png",
                as_attachment=True,
                download_name="website_screenshot.png",
            )
            response.call_on_close(lambda: os.unlink(tmp_file_path))

            return response

        except WebsiteRenderingError as e:
            logger.warning(f"Website rendering failed for {url}: {str(e)}")
            return jsonify({"error": str(e)}), 400

    except ValueError as e:
        return jsonify({"error": f"Invalid parameter value: {str(e)}"}), 400
    except Exception as e:
        logger.error(f"Unexpected error rendering website: {str(e)}")
        return (
            jsonify({"error": "An unexpected error occurred during website rendering"}),
            500,
        )


@app.route("/validate", methods=["POST"])
def validate_website_endpoint():
    """
    Get information about rendering a website without actually rendering it.
    This endpoint validates the URL and returns configuration options.

    POST /validate

    Request body:
    {
        "url": "https://example.com"
    }

    Returns JSON with validation result and available options.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "JSON request body required"}), 400

        url = data.get("url")
        if not url:
            return jsonify({"error": "URL is required"}), 400

        try:
            # This will raise WebsiteRenderingError if URL is invalid
            validate_url(url)

            return jsonify(
                {
                    "valid": True,
                    "url": url,
                    "message": "URL is valid and can be rendered",
                    "default_config": DEFAULT_CONFIG,
                    "available_options": {
                        "viewport_width": "Width of the browser viewport (default: 1920)",
                        "viewport_height": "Height of the browser viewport (default: 1080)",
                        "full_page": "Capture full page or just viewport (default: false)",
                        "timeout": "Maximum time to wait for page load in milliseconds (default: 30000)",
                    },
                }
            )

        except WebsiteRenderingError as e:
            return jsonify({"valid": False, "url": url, "error": str(e)}), 400

    except Exception as e:
        logger.error(f"Unexpected error validating website URL: {str(e)}")
        return (
            jsonify({"error": "An unexpected error occurred during URL validation"}),
            500,
        )


@app.route("/", methods=["GET"])
def index():
    """API documentation endpoint."""
    return jsonify(
        {
            "service": "Playwright Website Renderer",
            "version": "1.0.0",
            "endpoints": {
                "GET /": "This documentation",
                "GET /health": "Health check",
                "POST /render": "Render website to PNG",
                "POST /validate": "Validate URL without rendering",
            },
            "example_render_request": {
                "url": "https://example.com",
                "viewport_width": 1920,
                "viewport_height": 1080,
                "full_page": False,
                "timeout": 30000,
            },
            "example_validate_request": {"url": "https://example.com"},
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("DEBUG", "false").lower() == "true"

    logger.info(f"Starting Playwright Website Renderer on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
