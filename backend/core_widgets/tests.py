"""
Tests for the core_widgets Django app.

These tests verify that the built-in widget types work correctly
in the modular architecture.
"""

from django.test import TestCase, override_settings
from webpages.widget_registry import widget_type_registry
from .widgets import (
    TextBlockWidget, ImageWidget, ButtonWidget, SpacerWidget, HTMLBlockWidget,
    NewsWidget, EventsWidget, CalendarWidget, FormsWidget, GalleryWidget, DefaultWidget
)
from .widget_models import (
    TextBlockConfig, ImageConfig, ButtonConfig, SpacerConfig, HTMLBlockConfig,
    NewsConfig, EventConfig, CalendarConfig, FormsConfig, GalleryConfig, DefaultConfig
)
from pydantic import ValidationError
import datetime


class CoreWidgetsRegistrationTest(TestCase):
    """Test that core widgets are properly registered"""

    def test_all_core_widgets_registered(self):
        """Test that all expected core widgets are registered"""
        expected_widgets = [
            "Text Block", "Image", "Button", "Spacer", "HTML Block",
            "News", "Events", "Calendar", "Forms", "Gallery", "Default"
        ]
        
        registered_names = widget_type_registry.get_widget_names()
        
        for widget_name in expected_widgets:
            self.assertIn(widget_name, registered_names, 
                         f"Widget '{widget_name}' not found in registered widgets")

    def test_widget_instances_are_correct_types(self):
        """Test that registered widgets are instances of expected classes"""
        widget_class_mapping = {
            "Text Block": TextBlockWidget,
            "Image": ImageWidget,
            "Button": ButtonWidget,
            "Spacer": SpacerWidget,
            "HTML Block": HTMLBlockWidget,
            "News": NewsWidget,
            "Events": EventsWidget,
            "Calendar": CalendarWidget,
            "Forms": FormsWidget,
            "Gallery": GalleryWidget,
            "Default": DefaultWidget,
        }
        
        for widget_name, expected_class in widget_class_mapping.items():
            widget_instance = widget_type_registry.get_widget_type(widget_name)
            self.assertIsInstance(widget_instance, expected_class,
                                f"Widget '{widget_name}' is not instance of {expected_class.__name__}")

    def test_widgets_are_active(self):
        """Test that all core widgets are active by default"""
        widget_names = [
            "Text Block", "Image", "Button", "Spacer", "HTML Block",
            "News", "Events", "Calendar", "Forms", "Gallery", "Default"
        ]
        
        for widget_name in widget_names:
            widget = widget_type_registry.get_widget_type(widget_name)
            self.assertTrue(widget.is_active, f"Widget '{widget_name}' should be active")


class TextBlockWidgetTest(TestCase):
    """Test Text Block widget functionality"""

    def setUp(self):
        self.widget = widget_type_registry.get_widget_type("Text Block")

    def test_valid_configuration(self):
        """Test valid text block configuration"""
        valid_config = {
            "content": "Hello World",
            "alignment": "center",
            "style": "bold"
        }
        
        is_valid, errors = self.widget.validate_configuration(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_minimal_valid_configuration(self):
        """Test minimal valid configuration (only required fields)"""
        minimal_config = {"content": "Hello World"}
        
        is_valid, errors = self.widget.validate_configuration(minimal_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_invalid_configuration_missing_content(self):
        """Test invalid configuration with missing required content"""
        invalid_config = {"alignment": "center"}
        
        is_valid, errors = self.widget.validate_configuration(invalid_config)
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) > 0)

    def test_invalid_alignment_value(self):
        """Test invalid alignment value"""
        invalid_config = {
            "content": "Hello World",
            "alignment": "invalid_alignment"
        }
        
        is_valid, errors = self.widget.validate_configuration(invalid_config)
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) > 0)

    def test_configuration_defaults(self):
        """Test default configuration values"""
        defaults = self.widget.get_configuration_defaults()
        
        self.assertEqual(defaults.get("alignment"), "left")
        self.assertEqual(defaults.get("style"), "normal")

    def test_css_injection_properties(self):
        """Test CSS injection properties"""
        self.assertTrue(self.widget.enable_css_injection)
        self.assertEqual(self.widget.css_scope, "widget")
        self.assertIsInstance(self.widget.widget_css, str)
        self.assertGreater(len(self.widget.widget_css), 0)
        self.assertIsInstance(self.widget.css_variables, dict)


class ImageWidgetTest(TestCase):
    """Test Image widget functionality"""

    def setUp(self):
        self.widget = widget_type_registry.get_widget_type("Image")

    def test_valid_configuration(self):
        """Test valid image configuration"""
        valid_config = {
            "image_url": "https://example.com/image.jpg",
            "alt_text": "Example image",
            "caption": "This is an example",
            "size": "large",
            "alignment": "center"
        }
        
        is_valid, errors = self.widget.validate_configuration(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_minimal_valid_configuration(self):
        """Test minimal valid configuration"""
        minimal_config = {
            "image_url": "https://example.com/image.jpg",
            "alt_text": "Example image"
        }
        
        is_valid, errors = self.widget.validate_configuration(minimal_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_invalid_url(self):
        """Test invalid URL format"""
        invalid_config = {
            "image_url": "not-a-valid-url",
            "alt_text": "Example image"
        }
        
        is_valid, errors = self.widget.validate_configuration(invalid_config)
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) > 0)

    def test_configuration_defaults(self):
        """Test default configuration values"""
        defaults = self.widget.get_configuration_defaults()
        
        self.assertEqual(defaults.get("size"), "medium")
        self.assertEqual(defaults.get("alignment"), "center")


class ButtonWidgetTest(TestCase):
    """Test Button widget functionality"""

    def setUp(self):
        self.widget = widget_type_registry.get_widget_type("Button")

    def test_valid_configuration(self):
        """Test valid button configuration"""
        valid_config = {
            "text": "Click Me",
            "url": "https://example.com",
            "style": "primary",
            "size": "large",
            "open_in_new_tab": True
        }
        
        is_valid, errors = self.widget.validate_configuration(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_css_properties(self):
        """Test that button widget has comprehensive CSS"""
        self.assertIn("button-widget", self.widget.widget_css)
        self.assertIn("primary", self.widget.widget_css)
        self.assertIn("secondary", self.widget.widget_css)
        self.assertIn("outline", self.widget.widget_css)


class NewsWidgetTest(TestCase):
    """Test News widget functionality"""

    def setUp(self):
        self.widget = widget_type_registry.get_widget_type("News")

    def test_valid_configuration_with_date(self):
        """Test valid news configuration with publication date"""
        valid_config = {
            "title": "Breaking News",
            "content": "This is the news content",
            "author": "John Doe",
            "publication_date": "2024-01-15",
            "category": "technology"
        }
        
        is_valid, errors = self.widget.validate_configuration(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_minimal_valid_configuration(self):
        """Test minimal valid news configuration"""
        minimal_config = {
            "title": "Breaking News",
            "content": "This is the news content"
        }
        
        is_valid, errors = self.widget.validate_configuration(minimal_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])


class EventsWidgetTest(TestCase):
    """Test Events widget functionality"""

    def setUp(self):
        self.widget = widget_type_registry.get_widget_type("Events")

    def test_valid_configuration(self):
        """Test valid event configuration"""
        valid_config = {
            "event_title": "Tech Conference 2024",
            "start_date": "2024-06-15T09:00:00Z",
            "end_date": "2024-06-15T17:00:00Z",
            "location": "San Francisco, CA",
            "registration_url": "https://example.com/register",
            "price": "$299",
            "capacity": 500,
            "event_type": "conference"
        }
        
        is_valid, errors = self.widget.validate_configuration(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_minimal_valid_configuration(self):
        """Test minimal valid event configuration"""
        minimal_config = {
            "event_title": "Tech Conference 2024",
            "start_date": "2024-06-15T09:00:00Z"
        }
        
        is_valid, errors = self.widget.validate_configuration(minimal_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])


class CalendarWidgetTest(TestCase):
    """Test Calendar widget functionality"""

    def setUp(self):
        self.widget = widget_type_registry.get_widget_type("Calendar")

    def test_valid_configuration_with_events(self):
        """Test valid calendar configuration with manual events"""
        valid_config = {
            "title": "Event Calendar",
            "view_type": "month",
            "events": [
                {
                    "title": "Meeting",
                    "date": "2024-01-15",
                    "time": "10:00 AM",
                    "description": "Team meeting"
                }
            ],
            "show_navigation": True,
            "highlight_today": True
        }
        
        is_valid, errors = self.widget.validate_configuration(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])

    def test_empty_configuration(self):
        """Test empty calendar configuration (should be valid with defaults)"""
        empty_config = {}
        
        is_valid, errors = self.widget.validate_configuration(empty_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])


class FormsWidgetTest(TestCase):
    """Test Forms widget functionality"""

    def setUp(self):
        self.widget = widget_type_registry.get_widget_type("Forms")

    def test_valid_configuration(self):
        """Test valid form configuration"""
        valid_config = {
            "form_title": "Contact Us",
            "form_description": "Get in touch with our team",
            "submit_url": "https://example.com/submit",
            "fields": [
                {
                    "name": "name",
                    "label": "Full Name",
                    "type": "text",
                    "required": True
                },
                {
                    "name": "email",
                    "label": "Email Address",
                    "type": "email",
                    "required": True
                },
                {
                    "name": "message",
                    "label": "Message",
                    "type": "textarea",
                    "required": True
                }
            ]
        }
        
        is_valid, errors = self.widget.validate_configuration(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])


class GalleryWidgetTest(TestCase):
    """Test Gallery widget functionality"""

    def setUp(self):
        self.widget = widget_type_registry.get_widget_type("Gallery")

    def test_valid_configuration(self):
        """Test valid gallery configuration"""
        valid_config = {
            "title": "Photo Gallery",
            "layout": "grid",
            "columns": 3,
            "images": [
                {
                    "url": "https://example.com/image1.jpg",
                    "alt_text": "Image 1",
                    "caption": "First image"
                },
                {
                    "url": "https://example.com/image2.jpg",
                    "alt_text": "Image 2",
                    "caption": "Second image"
                }
            ],
            "show_captions": True,
            "enable_lightbox": True
        }
        
        is_valid, errors = self.widget.validate_configuration(valid_config)
        self.assertTrue(is_valid)
        self.assertEqual(errors, [])


class WidgetConfigurationModelsTest(TestCase):
    """Test Pydantic configuration models directly"""

    def test_text_block_config_model(self):
        """Test TextBlockConfig model"""
        config = TextBlockConfig(content="Hello World")
        self.assertEqual(config.content, "Hello World")
        self.assertEqual(config.alignment, "left")  # default
        self.assertEqual(config.style, "normal")  # default

    def test_image_config_model(self):
        """Test ImageConfig model"""
        config = ImageConfig(
            image_url="https://example.com/image.jpg",
            alt_text="Test image"
        )
        self.assertEqual(str(config.image_url), "https://example.com/image.jpg")
        self.assertEqual(config.alt_text, "Test image")
        self.assertEqual(config.size, "medium")  # default

    def test_button_config_model(self):
        """Test ButtonConfig model"""
        config = ButtonConfig(
            text="Click Me",
            url="https://example.com"
        )
        self.assertEqual(config.text, "Click Me")
        self.assertTrue(str(config.url).startswith("https://example.com"))  # Account for trailing slash
        self.assertEqual(config.style, "primary")  # default
        self.assertFalse(config.open_in_new_tab)  # default

    def test_invalid_model_validation(self):
        """Test that invalid configurations raise ValidationError"""
        with self.assertRaises(ValidationError):
            TextBlockConfig()  # Missing required content field
            
        with self.assertRaises(ValidationError):
            ImageConfig(image_url="invalid-url", alt_text="Test")  # Invalid URL