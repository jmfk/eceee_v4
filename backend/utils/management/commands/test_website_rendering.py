"""
Django management command to test website rendering functionality.

Usage:
    python manage.py test_website_rendering
    python manage.py test_website_rendering --url https://example.com
    python manage.py test_website_rendering --url https://example.com --save-file /tmp/screenshot.png
"""

import logging
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from utils.website_renderer import WebsiteRenderer, WebsiteRenderingError

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Test website rendering functionality"

    def add_arguments(self, parser):
        parser.add_argument(
            "--url",
            type=str,
            default="https://www.example.com",
            help="URL to render (default: https://www.example.com)",
        )
        parser.add_argument(
            "--save-file",
            type=str,
            help="Optional path to save the screenshot file",
        )
        parser.add_argument(
            "--viewport-width",
            type=int,
            default=1920,
            help="Viewport width (default: 1920)",
        )
        parser.add_argument(
            "--viewport-height",
            type=int,
            default=1080,
            help="Viewport height (default: 1080)",
        )
        parser.add_argument(
            "--full-page",
            action="store_true",
            help="Capture full page instead of just viewport",
        )
        parser.add_argument(
            "--timeout",
            type=int,
            default=30000,
            help="Timeout in milliseconds (default: 30000)",
        )

    def handle(self, *args, **options):
        url = options["url"]
        save_file = options.get("save_file")

        self.stdout.write(
            self.style.SUCCESS("Website Rendering Test")
        )
        self.stdout.write("=" * 50)

        # Test URL validation
        self.stdout.write("\n1. Testing URL validation...")
        try:
            renderer = WebsiteRenderer()
            renderer._validate_url(url)
            self.stdout.write(
                self.style.SUCCESS(f"✓ URL validation passed: {url}")
            )
        except WebsiteRenderingError as e:
            self.stdout.write(
                self.style.ERROR(f"✗ URL validation failed: {e}")
            )
            return

        # Test rendering configuration
        self.stdout.write("\n2. Setting up rendering configuration...")
        config = {
            "viewport_width": options["viewport_width"],
            "viewport_height": options["viewport_height"],
            "full_page": options["full_page"],
            "timeout": options["timeout"],
        }
        self.stdout.write(f"Configuration: {config}")

        # Test actual rendering
        self.stdout.write("\n3. Testing website rendering...")
        try:
            renderer = WebsiteRenderer(config)
            self.stdout.write(f"Rendering {url}...")
            
            png_bytes = renderer.render_website(url)
            
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ Successfully rendered website! "
                    f"Screenshot size: {len(png_bytes)} bytes"
                )
            )

            # Save file if requested
            if save_file:
                try:
                    with open(save_file, "wb") as f:
                        f.write(png_bytes)
                    self.stdout.write(
                        self.style.SUCCESS(f"✓ Screenshot saved to: {save_file}")
                    )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"✗ Failed to save file: {e}")
                    )

        except WebsiteRenderingError as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Website rendering failed: {e}")
            )
            return
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Unexpected error: {e}")
            )
            return

        # Test summary
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(
            self.style.SUCCESS("✓ Website rendering test completed successfully!")
        )
        self.stdout.write("\nAPI endpoints are available at:")
        self.stdout.write("  POST /api/v1/utils/render-website/")
        self.stdout.write("  POST /api/v1/utils/render-website-info/")