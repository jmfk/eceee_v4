"""
Management command to test imgproxy integration.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from file_manager.imgproxy import validate_imgproxy_config, imgproxy_service
from file_manager.models import MediaFile


class Command(BaseCommand):
    help = "Test imgproxy integration and generate sample URLs"

    def add_arguments(self, parser):
        parser.add_argument(
            "--media-id",
            type=str,
            help="Test with specific media file ID",
        )
        parser.add_argument(
            "--test-url",
            type=str,
            default="https://picsum.photos/800/600",
            help="Test URL for imgproxy processing (default: random image)",
        )
        parser.add_argument(
            "--validate-only",
            action="store_true",
            help="Only validate configuration without generating URLs",
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS(f"Testing imgproxy integration at {timezone.now()}")
        )

        # Validate configuration
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.HTTP_INFO("IMGPROXY CONFIGURATION"))
        self.stdout.write("=" * 60)

        config_result = validate_imgproxy_config()

        self.stdout.write(
            f"Configured: {self._format_status(config_result['configured'])}"
        )
        self.stdout.write(
            f"Signed URLs: {self._format_status(config_result['signed'])}"
        )
        self.stdout.write(
            f"Service Health: {self._format_status(config_result['healthy'])}"
        )
        self.stdout.write(f"Base URL: {config_result['url']}")

        if config_result["errors"]:
            self.stdout.write("\nErrors:")
            for error in config_result["errors"]:
                self.stdout.write(f"  - {self.style.ERROR(error)}")

        if options["validate_only"]:
            return

        if not config_result["configured"]:
            self.stdout.write(
                self.style.ERROR(
                    "\nCannot test URL generation - imgproxy not configured"
                )
            )
            return

        # Test URL generation
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.HTTP_INFO("URL GENERATION TESTS"))
        self.stdout.write("=" * 60)

        # Test with provided URL or media file
        if options["media_id"]:
            self._test_media_file(options["media_id"])
        else:
            self._test_sample_url(options["test_url"])

    def _test_media_file(self, media_id):
        """Test imgproxy URLs with a specific media file."""
        try:
            media_file = MediaFile.objects.get(id=media_id)
            self.stdout.write(f"\nTesting with media file: {media_file.title}")
            self.stdout.write(f"Original file: {media_file.original_filename}")
            self.stdout.write(f"File type: {media_file.file_type}")

            if media_file.file_type != "image":
                self.stdout.write(
                    self.style.WARNING(
                        "Note: File is not an image, URLs will fallback to original"
                    )
                )

            source_url = media_file.get_file_url()
            self._generate_test_urls(source_url, f"Media File: {media_file.title}")

        except MediaFile.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f"Media file with ID {media_id} not found")
            )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error testing media file: {e}"))

    def _test_sample_url(self, test_url):
        """Test imgproxy URLs with a sample URL."""
        self.stdout.write(f"\nTesting with sample URL: {test_url}")
        self._generate_test_urls(test_url, "Sample Image")

    def _generate_test_urls(self, source_url, title):
        """Generate and display various imgproxy URLs."""

        # Basic resize
        self.stdout.write(f"\n{self.style.HTTP_INFO('Basic Resize (300x200):')}")
        basic_url = imgproxy_service.generate_url(
            source_url=source_url, width=300, height=200, resize_type="fit"
        )
        self.stdout.write(f"  {basic_url}")

        # Thumbnail
        self.stdout.write(f"\n{self.style.HTTP_INFO('Thumbnail (150x150):')}")
        thumbnail_url = imgproxy_service.generate_url(
            source_url=source_url,
            width=150,
            height=150,
            resize_type="fill",
            gravity="sm",
        )
        self.stdout.write(f"  {thumbnail_url}")

        # WebP format
        self.stdout.write(f"\n{self.style.HTTP_INFO('WebP Format (600x400):')}")
        webp_url = imgproxy_service.generate_url(
            source_url=source_url, width=600, height=400, format="webp", quality=85
        )
        self.stdout.write(f"  {webp_url}")

        # Preset URLs
        self.stdout.write(f"\n{self.style.HTTP_INFO('Preset URLs:')}")
        presets = ["thumbnail", "small", "medium", "large", "hero", "avatar"]
        for preset in presets:
            preset_url = imgproxy_service.get_preset_url(source_url, preset)
            self.stdout.write(f"  {preset}: {preset_url}")

        # Responsive URLs
        self.stdout.write(f"\n{self.style.HTTP_INFO('Responsive URLs:')}")
        responsive_urls = imgproxy_service.get_responsive_urls(source_url)
        for size_name, url in responsive_urls.items():
            self.stdout.write(f"  {size_name}: {url}")

        # Advanced options
        self.stdout.write(f"\n{self.style.HTTP_INFO('Advanced Processing:')}")

        # Blur effect
        blur_url = imgproxy_service.generate_url(
            source_url=source_url, width=400, height=300, blur=5
        )
        self.stdout.write(f"  Blur: {blur_url}")

        # Sharpen
        sharpen_url = imgproxy_service.generate_url(
            source_url=source_url, width=400, height=300, sharpen=0.5
        )
        self.stdout.write(f"  Sharpen: {sharpen_url}")

        # Grayscale
        grayscale_url = imgproxy_service.generate_url(
            source_url=source_url, width=400, height=300, grayscale=True
        )
        self.stdout.write(f"  Grayscale: {grayscale_url}")

    def _format_status(self, status):
        """Format status with appropriate styling."""
        if status:
            return self.style.SUCCESS("✓ Yes")
        else:
            return self.style.ERROR("✗ No")

    def _test_health_check(self):
        """Test imgproxy health endpoint."""
        self.stdout.write(f"\n{self.style.HTTP_INFO('Health Check:')}")

        try:
            is_healthy = imgproxy_service.health_check()
            if is_healthy:
                self.stdout.write(
                    f"  {self.style.SUCCESS('✓ imgproxy service is healthy')}"
                )
            else:
                self.stdout.write(
                    f"  {self.style.ERROR('✗ imgproxy service is not responding')}"
                )
        except Exception as e:
            self.stdout.write(f"  {self.style.ERROR(f'✗ Health check failed: {e}')}")

        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(f"imgproxy test completed at {timezone.now()}")
        self.stdout.write("=" * 60)
