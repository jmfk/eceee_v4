"""
Tests for imgproxy template tags.
"""

from django.test import TestCase
from django.template import Context, Template
from file_manager.templatetags.imgproxy_tags import (
    imgproxy,
    imgproxy_img,
    imgproxy_url,
    has_image,
    _extract_url_from_image,
    _extract_metadata,
)
from unittest.mock import Mock, patch


class ImgproxyTagTests(TestCase):
    """Tests for {% imgproxy %} template tag."""

    def setUp(self):
        """Set up test data."""
        self.image_dict = {
            "id": "9dd8ffbb-ab6b-4ae5-95a1-faebb3795015",
            "title": "Test Image",
            "description": "A test image",
            "width": 4032,
            "height": 3024,
            "imgproxy_base_url": "http://minio:9000/eceee-media/test.jpg",
            "file_url": "/api/media/files/uuid/download/",
        }

    def test_imgproxy_with_dict(self):
        """Test imgproxy tag with dictionary image object."""
        url = imgproxy(self.image_dict, width=800, height=600)

        # Should contain imgproxy URL (either localhost or Docker hostname)
        self.assertTrue("imgproxy:8080" in url or "localhost:8080" in url)
        # Should have some length (signature + path)
        self.assertGreater(len(url), 50)

    def test_imgproxy_with_string(self):
        """Test imgproxy tag with plain URL string."""
        url = imgproxy("http://example.com/image.jpg", width=400, height=300)

        self.assertTrue("imgproxy:8080" in url or "localhost:8080" in url)

    def test_imgproxy_with_settings_dict(self):
        """Test imgproxy tag with settings dictionary."""
        settings = {
            "width": 1920,
            "height": 600,
            "resize_type": "fill",
            "gravity": "sm",
            "quality": 90,
        }

        url = imgproxy(self.image_dict, settings=settings)

        self.assertTrue("imgproxy:8080" in url or "localhost:8080" in url)
        self.assertGreater(len(url), 50)

    def test_imgproxy_explicit_params_override_settings(self):
        """Test that explicit params override settings dict."""
        settings = {
            "width": 800,
            "height": 600,
        }

        # Explicit width should override settings width
        url = imgproxy(self.image_dict, settings=settings, width=1920)

        # Both should produce valid URLs, but they should be different
        url_settings_only = imgproxy(self.image_dict, settings=settings)

        self.assertNotEqual(url, url_settings_only)

    def test_imgproxy_with_preset(self):
        """Test imgproxy tag with preset parameter."""
        url = imgproxy(self.image_dict, preset="hero")

        self.assertTrue("imgproxy:8080" in url or "localhost:8080" in url)

    def test_imgproxy_with_gravity(self):
        """Test imgproxy tag with gravity parameter."""
        url = imgproxy(self.image_dict, width=800, height=600, gravity="face")

        self.assertTrue("imgproxy:8080" in url or "localhost:8080" in url)

    def test_imgproxy_with_kwargs(self):
        """Test imgproxy tag with additional kwargs (blur, sharpen, etc.)."""
        url = imgproxy(
            self.image_dict, width=800, height=600, blur=5, sharpen=0.3, brightness=10
        )

        self.assertTrue("imgproxy:8080" in url or "localhost:8080" in url)

    def test_imgproxy_with_none_image(self):
        """Test imgproxy tag with None image returns empty string."""
        url = imgproxy(None, width=800, height=600)

        self.assertEqual(url, "")

    def test_imgproxy_with_empty_dict(self):
        """Test imgproxy tag with empty dict returns empty string."""
        url = imgproxy({}, width=800, height=600)

        self.assertEqual(url, "")

    def test_imgproxy_in_template(self):
        """Test imgproxy tag in actual template rendering."""
        template = Template(
            "{% load imgproxy_tags %}" "{% imgproxy image width=800 height=600 %}"
        )
        context = Context({"image": self.image_dict})
        rendered = template.render(context)

        self.assertTrue("imgproxy:8080" in rendered or "localhost:8080" in rendered)


class ImgproxyImgTagTests(TestCase):
    """Tests for {% imgproxy_img %} inclusion tag."""

    def setUp(self):
        """Set up test data."""
        self.image_dict = {
            "id": "uuid",
            "title": "Test Image",
            "description": "A test image",
            "width": 4032,
            "height": 3024,
            "imgproxy_base_url": "http://minio:9000/eceee-media/test.jpg",
        }

    def test_imgproxy_img_basic(self):
        """Test imgproxy_img returns proper context."""
        context = imgproxy_img(self.image_dict, width=800, height=600)

        self.assertIn("src", context)
        self.assertIn("alt", context)
        self.assertTrue(
            "imgproxy:8080" in context["src"] or "localhost:8080" in context["src"]
        )

    def test_imgproxy_img_auto_alt_text(self):
        """Test imgproxy_img auto-generates alt text from image title."""
        context = imgproxy_img(self.image_dict, width=800, height=600)

        self.assertEqual(context["alt"], "Test Image")

    def test_imgproxy_img_explicit_alt_text(self):
        """Test imgproxy_img with explicit alt text."""
        context = imgproxy_img(
            self.image_dict, width=800, height=600, alt="Custom Alt Text"
        )

        self.assertEqual(context["alt"], "Custom Alt Text")

    def test_imgproxy_img_with_class(self):
        """Test imgproxy_img with CSS class."""
        context = imgproxy_img(
            self.image_dict, width=800, height=600, class_name="hero-image"
        )

        self.assertEqual(context["class"], "hero-image")

    def test_imgproxy_img_with_settings(self):
        """Test imgproxy_img with settings dict."""
        settings = {
            "width": 1920,
            "height": 600,
            "resize_type": "fill",
            "gravity": "sm",
        }

        context = imgproxy_img(self.image_dict, settings=settings)

        self.assertTrue(
            "imgproxy:8080" in context["src"] or "localhost:8080" in context["src"]
        )

    def test_imgproxy_img_lazy_loading(self):
        """Test imgproxy_img lazy loading flag."""
        context = imgproxy_img(self.image_dict, width=800, lazy=True)

        self.assertTrue(context["lazy"])

        context_no_lazy = imgproxy_img(self.image_dict, width=800, lazy=False)

        self.assertFalse(context_no_lazy["lazy"])

    def test_imgproxy_img_in_template(self):
        """Test imgproxy_img in actual template rendering."""
        template = Template(
            "{% load imgproxy_tags %}"
            "{% imgproxy_img image width=800 height=600 class_name='test' %}"
        )
        context = Context({"image": self.image_dict})
        rendered = template.render(context)

        self.assertIn("<img", rendered)
        self.assertTrue("imgproxy:8080" in rendered or "localhost:8080" in rendered)
        self.assertIn('class="test"', rendered)
        self.assertIn('loading="lazy"', rendered)


class ImgproxyUrlFilterTests(TestCase):
    """Tests for imgproxy_url filter."""

    def setUp(self):
        """Set up test data."""
        self.image_dict = {
            "imgproxy_base_url": "http://minio:9000/eceee-media/test.jpg",
        }

    def test_imgproxy_url_filter_basic(self):
        """Test imgproxy_url filter without size."""
        url = imgproxy_url(self.image_dict)

        self.assertTrue("imgproxy:8080" in url or "localhost:8080" in url)

    def test_imgproxy_url_filter_with_size(self):
        """Test imgproxy_url filter with size string."""
        url = imgproxy_url(self.image_dict, "800x600")

        self.assertTrue("imgproxy:8080" in url or "localhost:8080" in url)

    def test_imgproxy_url_filter_invalid_size(self):
        """Test imgproxy_url filter with invalid size format."""
        url = imgproxy_url(self.image_dict, "invalid")

        # Should still return URL, just without dimensions
        self.assertTrue("imgproxy:8080" in url or "localhost:8080" in url)

    def test_imgproxy_url_filter_in_template(self):
        """Test imgproxy_url filter in template."""
        template = Template(
            "{% load imgproxy_tags %}" "{{ image|imgproxy_url:'1920x1080' }}"
        )
        context = Context({"image": self.image_dict})
        rendered = template.render(context)

        self.assertTrue("imgproxy:8080" in rendered or "localhost:8080" in rendered)


class HasImageFilterTests(TestCase):
    """Tests for has_image filter."""

    def test_has_image_with_valid_dict(self):
        """Test has_image filter with valid image dict."""
        image = {"imgproxy_base_url": "http://example.com/image.jpg"}

        self.assertTrue(has_image(image))

    def test_has_image_with_string(self):
        """Test has_image filter with string URL."""
        self.assertTrue(has_image("http://example.com/image.jpg"))

    def test_has_image_with_none(self):
        """Test has_image filter with None."""
        self.assertFalse(has_image(None))

    def test_has_image_with_empty_dict(self):
        """Test has_image filter with empty dict."""
        self.assertFalse(has_image({}))

    def test_has_image_in_template(self):
        """Test has_image filter in template conditional."""
        template = Template(
            "{% load imgproxy_tags %}"
            "{% if image|has_image %}HAS_IMAGE{% else %}NO_IMAGE{% endif %}"
        )

        # With valid image
        context = Context({"image": {"imgproxy_base_url": "http://test.jpg"}})
        rendered = template.render(context)
        self.assertEqual(rendered, "HAS_IMAGE")

        # Without image
        context = Context({"image": None})
        rendered = template.render(context)
        self.assertEqual(rendered, "NO_IMAGE")


class HelperFunctionTests(TestCase):
    """Tests for helper functions."""

    def test_extract_url_from_dict(self):
        """Test URL extraction from dictionary."""
        # With imgproxy_base_url
        image = {
            "imgproxy_base_url": "http://minio:9000/test.jpg",
            "file_url": "/api/media/files/uuid/download/",
        }
        url = _extract_url_from_image(image)
        self.assertEqual(url, "http://minio:9000/test.jpg")

        # Without imgproxy_base_url
        image = {"file_url": "/api/media/files/uuid/download/"}
        url = _extract_url_from_image(image)
        self.assertEqual(url, "/api/media/files/uuid/download/")

    def test_extract_url_from_string(self):
        """Test URL extraction from string."""
        url = _extract_url_from_image("http://example.com/image.jpg")
        self.assertEqual(url, "http://example.com/image.jpg")

    def test_extract_url_from_none(self):
        """Test URL extraction from None."""
        url = _extract_url_from_image(None)
        self.assertEqual(url, "")

    def test_extract_url_from_model_instance(self):
        """Test URL extraction from model instance."""
        mock_instance = Mock()
        mock_instance.imgproxy_base_url = "http://minio:9000/test.jpg"

        url = _extract_url_from_image(mock_instance)
        self.assertEqual(url, "http://minio:9000/test.jpg")

    def test_extract_metadata_from_dict(self):
        """Test metadata extraction from dictionary."""
        image = {
            "width": 4032,
            "height": 3024,
            "title": "Test Image",
            "description": "A test image",
        }

        metadata = _extract_metadata(image)

        self.assertEqual(metadata["width"], 4032)
        self.assertEqual(metadata["height"], 3024)
        self.assertEqual(metadata["title"], "Test Image")
        self.assertEqual(metadata["description"], "A test image")

    def test_extract_metadata_from_model_instance(self):
        """Test metadata extraction from model instance."""
        mock_instance = Mock()
        mock_instance.width = 1920
        mock_instance.height = 1080
        mock_instance.title = "Model Image"
        mock_instance.__dict__ = {"width": 1920, "height": 1080, "title": "Model Image"}

        metadata = _extract_metadata(mock_instance)

        self.assertEqual(metadata["width"], 1920)
        self.assertEqual(metadata["height"], 1080)
        self.assertEqual(metadata["title"], "Model Image")

    def test_extract_metadata_from_none(self):
        """Test metadata extraction from None."""
        metadata = _extract_metadata(None)

        self.assertEqual(metadata, {})
