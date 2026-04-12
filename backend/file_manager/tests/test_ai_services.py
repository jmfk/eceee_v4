"""
Tests for Media System AI Services

Tests cover:
- MediaAIService functionality
- Content analysis and tagging
- Title and slug generation
- Text extraction (OCR)
- Error handling and fallbacks
- API integration
"""

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth.models import User
from unittest.mock import patch, MagicMock
import json
import io
from PIL import Image

from file_manager.ai_services import MediaAIService
from file_manager.models import MediaFile, MediaTag
from content.models import Namespace


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
class MediaAIServiceTest(TestCase):
    """Test MediaAIService functionality"""

    def setUp(self):
        from core.models import Tenant
        self.user = User.objects.create_user(
            username="testuser_ai", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            identifier="test-tenant-ai",
            created_by=self.user
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
            tenant=self.tenant
        )
        self.ai_service = MediaAIService()
        # Mock settings for AI service
        self.ai_service.api_key = "fake-key"
        self.ai_service.api_url = "https://api.example.com"

    def create_test_image(self, width=800, height=600):
        """Helper to create test image"""
        image = Image.new("RGB", (width, height), color="green")
        image_io = io.BytesIO()
        image.save(image_io, format="JPEG")
        image_io.seek(0)
        return image_io.getvalue()

    @patch("requests.post")
    def test_analyze_image_content(self, mock_post):
        """Test AI analysis of image content"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tags": ["nature", "landscape", "mountains"],
            "title": "Beautiful Mountain Landscape",
            "description": "A scenic view of mountains with blue sky",
            "confidence": 0.85,
        }
        mock_post.return_value = mock_response

        # Create test image
        test_image = self.create_test_image()

        # Test analysis
        result = self.ai_service.analyze_image_content(test_image)

        self.assertIn("tags", result)
        self.assertIn("title", result)
        self.assertEqual(result["title"], "Beautiful Mountain Landscape")
        self.assertEqual(len(result["tags"]), 3)
        self.assertIn("nature", result["tags"])

    @patch("requests.post")
    def test_generate_title_from_filename(self, mock_post):
        """Test generating title from filename"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "title": "Summer Beach Vacation Photo",
            "confidence": 0.9,
        }
        mock_post.return_value = mock_response

        # Test title generation
        filename = "IMG_20240715_beach_vacation_sunset.jpg"
        result = self.ai_service.generate_title_from_filename(filename)

        self.assertEqual(result, "Summer Beach Vacation Photo")

    @patch("requests.post")
    def test_generate_slug_from_title(self, mock_post):
        """Test generating slug from title"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "slug": "beautiful-mountain-landscape",
            "confidence": 0.9,
        }
        mock_post.return_value = mock_response

        # Test slug generation
        title = "Beautiful Mountain Landscape!"
        result = self.ai_service.generate_slug_from_title(title)

        self.assertEqual(result, "beautiful-mountain-landscape")

    @patch("requests.post")
    def test_extract_text_from_image(self, mock_post):
        """Test OCR text extraction from images"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "text": "Welcome to Our Store\nOpen Daily 9AM-6PM",
            "confidence": 0.92,
        }
        mock_post.return_value = mock_response

        # Create test image
        test_image = self.create_test_image()

        # Test text extraction
        result = self.ai_service.extract_text_from_image(test_image)

        self.assertEqual(result, "Welcome to Our Store\nOpen Daily 9AM-6PM")

    @patch("requests.post")
    def test_suggest_tags_from_content(self, mock_post):
        """Test tag suggestions from content analysis"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tags": [
                {"name": "business", "confidence": 0.9},
                {"name": "retail", "confidence": 0.8},
            ]
        }
        mock_post.return_value = mock_response

        # Test tag suggestions
        content_description = "A storefront with business signage and retail displays"
        result = self.ai_service.suggest_tags_from_content(content_description, str(self.namespace.id))

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["name"], "business")

    def test_analyze_media_file_fallback(self):
        """Test basic analysis fallback when AI is not available"""
        self.ai_service.api_key = None
        
        filename = "mountain_climbing_trip.jpg"
        content_type = "image/jpeg"
        
        result = self.ai_service.analyze_media_file(b"fake content", filename, content_type)
        
        self.assertEqual(result["suggested_title"], "Mountain Climbing Trip")
        self.assertIn("image", result["suggested_tags"])
        self.assertIn("mountain", result["suggested_tags"])

    def test_ai_service_error_handling(self):
        """Test AI service error handling"""
        with patch("requests.post") as mock_post:
            mock_post.side_effect = Exception("API Error")

            test_image = self.create_test_image()
            result = self.ai_service.analyze_image_content(test_image)

            self.assertEqual(result, {})

    def test_ai_service_rate_limiting(self):
        """Test AI service rate limiting handling"""
        with patch("requests.post") as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 429
            mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("429 Client Error")
            mock_post.return_value = mock_response

            # Set small retry delay for tests
            self.ai_service.retry_delay = 0.01
            
            test_image = self.create_test_image()
            result = self.ai_service.analyze_image_content(test_image)

            self.assertEqual(result, {})

    def test_ai_service_no_api_key(self):
        """Test AI service behavior without API key"""
        self.ai_service.api_key = None
        
        test_image = self.create_test_image()
        result = self.ai_service.analyze_image_content(test_image)

        self.assertEqual(result, {})


class MediaTagAutoCreationTest(TestCase):
    """Test automatic tag creation from AI suggestions"""

    def setUp(self):
        from core.models import Tenant
        self.user = User.objects.create_user(
            username="testuser_tag", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            identifier="test-tenant-tag",
            created_by=self.user
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
            tenant=self.tenant
        )
        self.ai_service = MediaAIService()

    def test_reuse_existing_tags(self):
        """Test reusing existing tags instead of creating duplicates"""
        # Create existing tag
        existing_tag = MediaTag.objects.create(
            name="nature", 
            slug="nature", 
            namespace=self.namespace,
            created_by=self.user
        )

        # This test would normally test a method that uses MediaTag.objects.get_or_create
        # Since create_tags_from_suggestions was removed, we'll just verify MediaTag creation
        tag, created = MediaTag.objects.get_or_create(
            name="nature",
            namespace=self.namespace,
            defaults={"created_by": self.user}
        )
        
        self.assertFalse(created)
        self.assertEqual(tag, existing_tag)


class AIServiceIntegrationTest(TestCase):
    """Test AI service integration with media workflow"""

    def setUp(self):
        from core.models import Tenant
        self.user = User.objects.create_user(
            username="testuser_int", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            identifier="test-tenant-int",
            created_by=self.user
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
            tenant=self.tenant
        )
        self.ai_service = MediaAIService()
        self.ai_service.api_key = "fake-key"
        self.ai_service.api_url = "https://api.example.com"

    def create_test_image(self):
        """Helper to create test image"""
        image = Image.new("RGB", (800, 600), color="blue")
        image_io = io.BytesIO()
        image.save(image_io, format="JPEG")
        image_io.seek(0)
        return image_io.getvalue()

    @patch("file_manager.ai_services.MediaAIService.analyze_image_content")
    @patch("file_manager.ai_services.MediaAIService.extract_text_from_image")
    @patch("file_manager.ai_services.MediaAIService.generate_title_from_filename")
    def test_analyze_media_file_complete(self, mock_title, mock_extract, mock_analyze):
        """Test complete file analysis integration"""
        # Mock AI responses
        mock_title.return_value = "Office Computer Setup"
        mock_analyze.return_value = {
            "tags": ["technology", "computer", "office"],
            "confidence": 0.91,
        }
        mock_extract.return_value = "Welcome to TechCorp"

        # Test AI analysis
        test_image = self.create_test_image()
        result = self.ai_service.analyze_media_file(test_image, "test.jpg", "image/jpeg")

        # Verify AI suggestions
        self.assertEqual(result["suggested_title"], "Office Computer Setup")
        self.assertIn("technology", result["suggested_tags"])
        self.assertEqual(result["extracted_text"], "Welcome to TechCorp")


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
class AIServicePerformanceTest(TestCase):
    """Test AI service performance and optimization"""

    def setUp(self):
        self.ai_service = MediaAIService()
        self.ai_service.api_key = "fake-key"
        self.ai_service.api_url = "https://api.example.com"

    @patch("requests.post")
    def test_ai_response_caching(self, mock_post):
        """Test caching of AI responses to avoid duplicate API calls"""
        # Mock API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "title": "Cached Title",
            "confidence": 0.9,
        }
        mock_post.return_value = mock_response

        # Analyze same filename twice
        result1 = self.ai_service.generate_title_from_filename("test.jpg")
        result2 = self.ai_service.generate_title_from_filename("test.jpg")

        # Should get same results
        self.assertEqual(result1, result2)
        self.assertEqual(result1, "Cached Title")

        # API should only be called once due to caching
        self.assertEqual(mock_post.call_count, 1)

    @patch("requests.post")
    def test_ai_timeout_handling(self, mock_post):
        """Test handling of AI service timeouts"""
        import requests
        mock_post.side_effect = requests.exceptions.Timeout("Request timeout")

        # Test timeout handling with a different filename to avoid cache hits
        result = self.ai_service.generate_title_from_filename("timeout_test.jpg")

        # Should return empty response on timeout
        self.assertEqual(result, "")

import requests
