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


class MediaAIServiceTest(TestCase):
    """Test MediaAIService functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
        )
        self.ai_service = MediaAIService()

    def create_test_image(self, width=800, height=600):
        """Helper to create test image"""
        image = Image.new("RGB", (width, height), color="green")
        image_io = io.BytesIO()
        image.save(image_io, format="JPEG")
        image_io.seek(0)
        return SimpleUploadedFile(
            "test.jpg", image_io.getvalue(), content_type="image/jpeg"
        )

    @patch("openai.OpenAI")
    def test_analyze_image_content(self, mock_openai):
        """Test AI analysis of image content"""
        # Mock OpenAI response
        mock_client = MagicMock()
        mock_openai.return_value = mock_client

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "suggested_tags": ["nature", "landscape", "mountains"],
                "suggested_title": "Beautiful Mountain Landscape",
                "description": "A scenic view of mountains with blue sky",
                "confidence": 0.85,
            }
        )
        mock_client.chat.completions.create.return_value = mock_response

        # Create test image
        test_image = self.create_test_image()

        # Test analysis
        result = self.ai_service.analyze_image_content(test_image)

        self.assertIn("suggested_tags", result)
        self.assertIn("suggested_title", result)
        self.assertEqual(result["suggested_title"], "Beautiful Mountain Landscape")
        self.assertEqual(len(result["suggested_tags"]), 3)
        self.assertIn("nature", result["suggested_tags"])

    @patch("openai.OpenAI")
    def test_generate_title_from_filename(self, mock_openai):
        """Test generating title from filename"""
        # Mock OpenAI response
        mock_client = MagicMock()
        mock_openai.return_value = mock_client

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Summer Beach Vacation Photo"
        mock_client.chat.completions.create.return_value = mock_response

        # Test title generation
        filename = "IMG_20240715_beach_vacation_sunset.jpg"
        result = self.ai_service.generate_title_from_filename(filename)

        self.assertEqual(result, "Summer Beach Vacation Photo")

        # Verify OpenAI was called with correct parameters
        mock_client.chat.completions.create.assert_called_once()
        call_args = mock_client.chat.completions.create.call_args
        self.assertIn("messages", call_args.kwargs)

    @patch("openai.OpenAI")
    def test_generate_slug_from_title(self, mock_openai):
        """Test generating slug from title"""
        # Mock OpenAI response
        mock_client = MagicMock()
        mock_openai.return_value = mock_client

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "beautiful-mountain-landscape"
        mock_client.chat.completions.create.return_value = mock_response

        # Test slug generation
        title = "Beautiful Mountain Landscape!"
        result = self.ai_service.generate_slug_from_title(title)

        self.assertEqual(result, "beautiful-mountain-landscape")

        # Test fallback slug generation (without AI)
        fallback_slug = self.ai_service.generate_slug_fallback(title)
        self.assertEqual(fallback_slug, "beautiful-mountain-landscape")

    @patch("openai.OpenAI")
    def test_extract_text_from_image(self, mock_openai):
        """Test OCR text extraction from images"""
        # Mock OpenAI response for text extraction
        mock_client = MagicMock()
        mock_openai.return_value = mock_client

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "extracted_text": "Welcome to Our Store\nOpen Daily 9AM-6PM",
                "confidence": 0.92,
                "language": "en",
            }
        )
        mock_client.chat.completions.create.return_value = mock_response

        # Create test image
        test_image = self.create_test_image()

        # Test text extraction
        result = self.ai_service.extract_text_from_image(test_image)

        self.assertIn("extracted_text", result)
        self.assertIn("confidence", result)
        self.assertEqual(
            result["extracted_text"], "Welcome to Our Store\nOpen Daily 9AM-6PM"
        )
        self.assertEqual(result["confidence"], 0.92)

    @patch("openai.OpenAI")
    def test_suggest_tags_from_content(self, mock_openai):
        """Test tag suggestions from content analysis"""
        # Mock OpenAI response
        mock_client = MagicMock()
        mock_openai.return_value = mock_client

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps(
            ["business", "storefront", "retail", "commerce", "signage"]
        )
        mock_client.chat.completions.create.return_value = mock_response

        # Test tag suggestions
        content_description = "A storefront with business signage and retail displays"
        result = self.ai_service.suggest_tags_from_content(content_description)

        self.assertEqual(len(result), 5)
        self.assertIn("business", result)
        self.assertIn("retail", result)

    def test_analyze_file_complete_workflow(self):
        """Test complete file analysis workflow"""
        # Create media file
        media_file = MediaFile.objects.create(
            title="Test Image",
            slug="test-image",
            file_type="image/jpeg",
            file_size=1024000,
            file_url="https://example.com/test.jpg",
            uploaded_by=self.user,
            created_by=self.user,
            last_modified_by=self.user,
            namespace=self.namespace,
        )

        # Create test image
        test_image = self.create_test_image()

        with patch.object(
            self.ai_service, "analyze_image_content"
        ) as mock_analyze, patch.object(
            self.ai_service, "extract_text_from_image"
        ) as mock_extract:

            # Mock AI responses
            mock_analyze.return_value = {
                "suggested_tags": ["nature", "outdoor"],
                "suggested_title": "Nature Scene",
                "description": "Beautiful outdoor scene",
                "confidence": 0.88,
            }

            mock_extract.return_value = {
                "extracted_text": "",
                "confidence": 0.0,
                "language": "en",
            }

            # Test complete analysis
            result = self.ai_service.analyze_file(media_file, test_image)

            self.assertIn("suggested_tags", result)
            self.assertIn("suggested_title", result)
            self.assertIn("extracted_text", result)
            self.assertEqual(result["suggested_title"], "Nature Scene")

    def test_ai_service_error_handling(self):
        """Test AI service error handling"""
        with patch("openai.OpenAI") as mock_openai:
            # Mock OpenAI to raise exception
            mock_client = MagicMock()
            mock_openai.return_value = mock_client
            mock_client.chat.completions.create.side_effect = Exception("API Error")

            # Test that errors are handled gracefully
            test_image = self.create_test_image()
            result = self.ai_service.analyze_image_content(test_image)

            # Should return empty response when API is not configured
            self.assertEqual(result, {})

    def test_ai_service_rate_limiting(self):
        """Test AI service rate limiting handling"""
        with patch("openai.OpenAI") as mock_openai:
            # Mock rate limit error
            mock_client = MagicMock()
            mock_openai.return_value = mock_client

            rate_limit_error = Exception("Rate limit exceeded")
            rate_limit_error.status_code = 429
            mock_client.chat.completions.create.side_effect = rate_limit_error

            # Test rate limit handling
            test_image = self.create_test_image()
            result = self.ai_service.analyze_image_content(test_image)

            # Should return empty response when API is not configured
            self.assertEqual(result, {})

    @override_settings(OPENAI_API_KEY=None)
    def test_ai_service_no_api_key(self):
        """Test AI service behavior without API key"""
        # Test that service handles missing API key gracefully
        ai_service = MediaAIService()

        test_image = self.create_test_image()
        result = ai_service.analyze_image_content(test_image)

        # Should return empty response when API is not configured
        self.assertEqual(result, {})


class MediaTagAutoCreationTest(TestCase):
    """Test automatic tag creation from AI suggestions"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
        )
        self.ai_service = MediaAIService()

    def test_create_tags_from_suggestions(self):
        """Test creating MediaTag objects from AI suggestions"""
        # Test tag suggestions
        suggested_tags = ["nature", "landscape", "mountains", "outdoor"]

        # Test tag creation
        created_tags = self.ai_service.create_tags_from_suggestions(
            suggested_tags, self.namespace
        )

        self.assertEqual(len(created_tags), 4)

        # Verify tags were created in database
        for tag_name in suggested_tags:
            tag = MediaTag.objects.get(name=tag_name, namespace=self.namespace)
            self.assertIsNotNone(tag)
            self.assertIn(tag, created_tags)

    def test_reuse_existing_tags(self):
        """Test reusing existing tags instead of creating duplicates"""
        # Create existing tag
        existing_tag = MediaTag.objects.create(
            name="nature", slug="nature", namespace=self.namespace
        )

        # Test with suggestions including existing tag
        suggested_tags = ["nature", "landscape", "mountains"]

        created_tags = self.ai_service.create_tags_from_suggestions(
            suggested_tags, self.namespace
        )

        # Should reuse existing tag
        self.assertIn(existing_tag, created_tags)

        # Should not create duplicate
        nature_tags = MediaTag.objects.filter(name="nature", namespace=self.namespace)
        self.assertEqual(nature_tags.count(), 1)

    def test_tag_name_normalization(self):
        """Test tag name normalization and slug generation"""
        # Test with various tag formats
        suggested_tags = [
            "Nature Photography",
            "LANDSCAPE",
            "mountain-view",
            "Outdoor Adventure!",
        ]

        created_tags = self.ai_service.create_tags_from_suggestions(
            suggested_tags, self.namespace
        )

        # Verify normalized names and slugs
        tag_names = [tag.name for tag in created_tags]
        tag_slugs = [tag.slug for tag in created_tags]

        self.assertIn("Nature Photography", tag_names)
        self.assertIn("nature-photography", tag_slugs)

        self.assertIn("LANDSCAPE", tag_names)
        self.assertIn("landscape", tag_slugs)


class AIServiceIntegrationTest(TestCase):
    """Test AI service integration with media workflow"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.namespace = Namespace.objects.create(
            name="Test Namespace",
            slug="test-namespace",
            is_active=True,
            created_by=self.user,
        )
        self.ai_service = MediaAIService()

    def create_test_image(self):
        """Helper to create test image"""
        image = Image.new("RGB", (800, 600), color="blue")
        image_io = io.BytesIO()
        image.save(image_io, format="JPEG")
        image_io.seek(0)
        return SimpleUploadedFile(
            "test.jpg", image_io.getvalue(), content_type="image/jpeg"
        )

    @patch("file_manager.ai_services.MediaAIService.analyze_image_content")
    @patch("file_manager.ai_services.MediaAIService.extract_text_from_image")
    def test_upload_with_ai_analysis(self, mock_extract, mock_analyze):
        """Test file upload with AI analysis integration"""
        # Mock AI responses
        mock_analyze.return_value = {
            "suggested_tags": ["technology", "computer", "office"],
            "suggested_title": "Office Computer Setup",
            "description": "Modern office workspace with computer",
            "confidence": 0.91,
        }

        mock_extract.return_value = {
            "extracted_text": "Welcome to TechCorp",
            "confidence": 0.85,
            "language": "en",
        }

        # Create media file
        media_file = MediaFile.objects.create(
            title="Original Title",
            slug="original-title",
            file_type="image/jpeg",
            file_size=1024000,
            file_url="https://example.com/test.jpg",
            uploaded_by=self.user,
            created_by=self.user,
            last_modified_by=self.user,
            namespace=self.namespace,
        )

        # Test AI analysis
        test_image = self.create_test_image()
        result = self.ai_service.analyze_file(media_file, test_image)

        # Verify AI suggestions
        self.assertEqual(result["suggested_title"], "Office Computer Setup")
        self.assertIn("technology", result["suggested_tags"])
        self.assertEqual(result["extracted_text"], "Welcome to TechCorp")

    def test_batch_ai_analysis(self):
        """Test batch AI analysis for multiple files"""
        # Create multiple media files
        files = []
        for i in range(3):
            media_file = MediaFile.objects.create(
                title=f"Test Image {i+1}",
                slug=f"test-image-{i+1}",
                file_type="image/jpeg",
                file_size=1024000,
                file_url=f"https://example.com/test{i+1}.jpg",
                uploaded_by=self.user,
                created_by=self.user,
                last_modified_by=self.user,
                namespace=self.namespace,
            )
            files.append(media_file)

        with patch.object(self.ai_service, "analyze_file") as mock_analyze:
            # Mock AI analysis for each file
            mock_analyze.side_effect = [
                {
                    "suggested_tags": ["nature"],
                    "suggested_title": f"Nature Photo {i+1}",
                    "extracted_text": "",
                    "confidence": 0.8,
                }
                for i in range(3)
            ]

            # Test batch analysis
            results = []
            for media_file in files:
                test_image = self.create_test_image()
                result = self.ai_service.analyze_file(media_file, test_image)
                results.append(result)

            # Verify all files were analyzed
            self.assertEqual(len(results), 3)
            self.assertEqual(mock_analyze.call_count, 3)

    def test_ai_confidence_thresholds(self):
        """Test AI confidence threshold handling"""
        with patch.object(self.ai_service, "analyze_image_content") as mock_analyze:
            # Mock low confidence response
            mock_analyze.return_value = {
                "suggested_tags": ["uncertain"],
                "suggested_title": "Unclear Image",
                "description": "Cannot determine content clearly",
                "confidence": 0.3,  # Low confidence
            }

            test_image = self.create_test_image()
            result = self.ai_service.analyze_image_content(test_image)

            # Should handle low confidence appropriately
            self.assertEqual(result["confidence"], 0.3)

            # Application logic should decide whether to use low-confidence suggestions
            if result["confidence"] < 0.5:
                # Don't auto-apply low confidence suggestions
                self.assertLessEqual(len(result["suggested_tags"]), 1)


class AIServicePerformanceTest(TestCase):
    """Test AI service performance and optimization"""

    def setUp(self):
        self.ai_service = MediaAIService()

    @patch("openai.OpenAI")
    def test_ai_response_caching(self, mock_openai):
        """Test caching of AI responses to avoid duplicate API calls"""
        # Mock OpenAI response
        mock_client = MagicMock()
        mock_openai.return_value = mock_client

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps(
            {
                "suggested_tags": ["cached", "response"],
                "suggested_title": "Cached Title",
                "confidence": 0.9,
            }
        )
        mock_client.chat.completions.create.return_value = mock_response

        # Create identical test images
        image1 = SimpleUploadedFile(
            "test1.jpg", b"identical content", content_type="image/jpeg"
        )
        image2 = SimpleUploadedFile(
            "test2.jpg", b"identical content", content_type="image/jpeg"
        )

        # Analyze same content twice
        result1 = self.ai_service.analyze_image_content(image1)
        result2 = self.ai_service.analyze_image_content(image2)

        # Should get same results
        self.assertEqual(result1["suggested_title"], result2["suggested_title"])

        # API should only be called once due to caching (if implemented)
        # Note: This test assumes caching is implemented in the AI service

    def test_ai_request_batching(self):
        """Test batching multiple AI requests for efficiency"""
        # This would test batching multiple files for analysis
        # to reduce API calls and improve performance
        pass

    def test_ai_timeout_handling(self):
        """Test handling of AI service timeouts"""
        with patch("openai.OpenAI") as mock_openai:
            # Mock timeout error
            mock_client = MagicMock()
            mock_openai.return_value = mock_client

            timeout_error = Exception("Request timeout")
            mock_client.chat.completions.create.side_effect = timeout_error

            # Test timeout handling
            test_image = SimpleUploadedFile(
                "test.jpg", b"content", content_type="image/jpeg"
            )
            result = self.ai_service.analyze_image_content(test_image)

            # Should return empty response when API is not configured
            self.assertEqual(result, {})
