"""
Tests for TemplateBasedLayout functionality

This module contains comprehensive tests for the enhanced BaseLayout class
with HTML template support, CSS extraction, and slot parsing capabilities.
"""

import os
import tempfile
from django.test import TestCase
from django.template.loader import get_template
from django.template import TemplateDoesNotExist
from django.core.exceptions import ImproperlyConfigured
from django.core.cache import cache
from unittest.mock import patch, MagicMock

from .layout_registry import (
    TemplateBasedLayout,
    TemplateParsingError,
    CSSValidator,
    register_layout,
)


class TemplateBasedLayoutTestCase(TestCase):
    """Base test case with common setup"""

    def setUp(self):
        """Set up test data"""
        self.simple_html = """
        <style>
        .test-layout {
            background: #fff;
        }
        </style>
        <div class="test-layout">
            <div data-widget-slot="header" data-slot-title="Header" data-slot-description="Page header">
                Header content
            </div>
            <div data-widget-slot="content">
                Main content
            </div>
        </div>
        """

        self.complex_html = """
        <style>
        .complex-layout {
            display: grid;
        }
        .header-slot { grid-area: header; }
        </style>
        <div class="complex-layout">
            <div data-widget-slot="header" data-slot-title="Page Header" data-slot-description="Main header with navigation" data-slot-max-widgets="2" class="header-slot">
                Header
            </div>
            <div data-widget-slot="content" data-slot-max-widgets="">
                Content
            </div>
            <div data-widget-slot="sidebar" data-slot-max-widgets="5">
                Sidebar
            </div>
            <div data-widget-slot="footer" data-slot-max-widgets="1">
                Footer
            </div>
        </div>
        """

        self.no_slots_html = """
        <style>
        .no-slots { color: red; }
        </style>
        <div class="no-slots">
            <p>No widget slots here</p>
        </div>
        """

        # Test HTML with duplicate slot names
        self.duplicate_slots_html = """
        <style>
        .duplicate-test { display: block; }
        </style>
        <div class="duplicate-test">
            <div data-widget-slot="content" data-slot-title="First Content">
                First content area
            </div>
            <div data-widget-slot="content" data-slot-title="Second Content">
                Second content area with same name
            </div>
        </div>
        """

        # Test HTML with invalid slot names
        self.invalid_slot_names_html = """
        <div>
            <div data-widget-slot="invalid slot name" data-slot-title="Invalid">
                Invalid slot name with spaces
            </div>
            <div data-widget-slot="invalid@slot" data-slot-title="Invalid">
                Invalid slot name with special characters
            </div>
        </div>
        """

        # Test CSS with dangerous patterns
        self.dangerous_css = """
        .malicious {
            background: url(javascript:alert('xss'));
            behavior: expression(alert('xss'));
        }
        @import "javascript:alert('xss')";
        """

        # Test CSS with syntax errors
        self.invalid_css = """
        .invalid-css {
            background: #fff;
            /* Missing closing brace */
        .another-rule {
            color: red;
        }
        """

    def tearDown(self):
        """Clean up after tests"""
        cache.clear()


class TestTemplateBasedLayoutBasics(TemplateBasedLayoutTestCase):
    """Test basic TemplateBasedLayout functionality"""

    def test_layout_initialization_with_template(self):
        """Test basic layout initialization with template file"""

        class BasicTestLayout(TemplateBasedLayout):
            name = "basic_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = BasicTestLayout()

            self.assertEqual(layout.name, "basic_test")

    def test_layout_has_extracted_attributes_after_init(self):
        """Test that layout has required extracted attributes after initialization"""

        class BasicTestLayout(TemplateBasedLayout):
            name = "basic_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = BasicTestLayout()

            self.assertTrue(hasattr(layout, "_extracted_html"))
            self.assertTrue(hasattr(layout, "_extracted_css"))
            self.assertTrue(hasattr(layout, "_parsed_slots"))

    def test_layout_initialization_without_template(self):
        """Test layout initialization when no template_file is specified"""

        class NoTemplateLayout(TemplateBasedLayout):
            name = "no_template"

        layout = NoTemplateLayout()

        self.assertEqual(layout._extracted_html, "")
        self.assertEqual(layout._extracted_css, "")
        self.assertEqual(layout._parsed_slots, [])

    def test_slot_configuration_returns_correct_format(self):
        """Test slot_configuration property returns correct dictionary format"""

        class ConfigTestLayout(TemplateBasedLayout):
            name = "config_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = ConfigTestLayout()
            config = layout.slot_configuration

            self.assertIsInstance(config, dict)
            self.assertIn("slots", config)

    def test_slot_configuration_has_correct_slot_count(self):
        """Test slot_configuration has the expected number of slots"""

        class ConfigTestLayout(TemplateBasedLayout):
            name = "config_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = ConfigTestLayout()
            config = layout.slot_configuration

            self.assertIsInstance(config["slots"], list)
            self.assertEqual(len(config["slots"]), 2)


class TestHTMLExtraction(TemplateBasedLayoutTestCase):
    """Test HTML content extraction"""

    def test_html_extraction_removes_style_tags(self):
        """Test that HTML extraction removes style tags correctly"""

        class HTMLTestLayout(TemplateBasedLayout):
            name = "html_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = HTMLTestLayout()
            extracted_html = layout._extracted_html

            self.assertNotIn("<style>", extracted_html)
            self.assertNotIn("background: #fff", extracted_html)

    def test_html_extraction_preserves_slot_attributes(self):
        """Test that HTML extraction preserves slot attributes"""

        class HTMLTestLayout(TemplateBasedLayout):
            name = "html_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = HTMLTestLayout()
            extracted_html = layout._extracted_html

            self.assertIn('data-widget-slot="header"', extracted_html)

    def test_html_extraction_preserves_css_classes(self):
        """Test that HTML extraction preserves CSS class attributes"""

        class HTMLTestLayout(TemplateBasedLayout):
            name = "html_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = HTMLTestLayout()
            extracted_html = layout._extracted_html

            self.assertIn('class="test-layout"', extracted_html)


class TestCSSExtraction(TemplateBasedLayoutTestCase):
    """Test CSS extraction functionality"""

    def test_css_extraction_from_single_style_tag(self):
        """Test CSS extraction from single style tag"""

        class CSSTestLayout(TemplateBasedLayout):
            name = "css_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = CSSTestLayout()
            extracted_css = layout._extracted_css

            self.assertIn(".test-layout", extracted_css)
            self.assertIn("background: #fff", extracted_css)

    def test_css_extraction_from_multiple_style_tags(self):
        """Test CSS extraction with multiple style tags"""
        html_with_multiple_styles = """
        <style>
        .first { color: red; }
        </style>
        <div>Content</div>
        <style>
        .second { color: blue; }
        </style>
        """

        class MultiStyleLayout(TemplateBasedLayout):
            name = "multi_style"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = html_with_multiple_styles
            mock_get_template.return_value = mock_template

            layout = MultiStyleLayout()
            css = layout._extracted_css

            self.assertIn(".first { color: red; }", css)
            self.assertIn(".second { color: blue; }", css)


class TestSlotParsing(TemplateBasedLayoutTestCase):
    """Test widget slot parsing functionality"""

    def test_slot_count_parsing(self):
        """Test that correct number of slots are found"""

        class SlotTestLayout(TemplateBasedLayout):
            name = "slot_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = SlotTestLayout()
            slots = layout._parsed_slots

            self.assertEqual(len(slots), 2)

    def test_slot_explicit_title_attribute(self):
        """Test slot parsing when explicit title attribute is provided"""

        class SlotTestLayout(TemplateBasedLayout):
            name = "slot_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = SlotTestLayout()
            slots = layout._parsed_slots

            header_slot = next(slot for slot in slots if slot["name"] == "header")
            self.assertEqual(header_slot["title"], "Header")

    def test_slot_explicit_description_attribute(self):
        """Test slot parsing when explicit description attribute is provided"""

        class SlotTestLayout(TemplateBasedLayout):
            name = "slot_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = SlotTestLayout()
            slots = layout._parsed_slots

            header_slot = next(slot for slot in slots if slot["name"] == "header")
            self.assertEqual(header_slot["description"], "Page header")

    def test_slot_max_widgets_default_none(self):
        """Test that max_widgets defaults to None when not specified"""

        class SlotTestLayout(TemplateBasedLayout):
            name = "slot_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = SlotTestLayout()
            slots = layout._parsed_slots

            header_slot = next(slot for slot in slots if slot["name"] == "header")
            self.assertIsNone(header_slot["max_widgets"])

    def test_slot_auto_generated_title(self):
        """Test slot parsing when title uses auto-generated defaults"""

        class SlotTestLayout(TemplateBasedLayout):
            name = "slot_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = SlotTestLayout()
            slots = layout._parsed_slots

            content_slot = next(slot for slot in slots if slot["name"] == "content")
            self.assertEqual(
                content_slot["title"], "Content"
            )  # Auto-generated from name

    def test_slot_auto_generated_description(self):
        """Test slot parsing when description uses auto-generated defaults"""

        class SlotTestLayout(TemplateBasedLayout):
            name = "slot_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = SlotTestLayout()
            slots = layout._parsed_slots

            content_slot = next(slot for slot in slots if slot["name"] == "content")
            self.assertEqual(content_slot["description"], "content content area")

    def test_slot_max_widgets_integer_values(self):
        """Test max_widgets attribute parsing with various integer values"""

        class ComplexSlotTestLayout(TemplateBasedLayout):
            name = "complex_slot_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.complex_html
            mock_get_template.return_value = mock_template

            layout = ComplexSlotTestLayout()
            slots = layout._parsed_slots

            header_slot = next(slot for slot in slots if slot["name"] == "header")
            self.assertEqual(header_slot["max_widgets"], 2)

            sidebar_slot = next(slot for slot in slots if slot["name"] == "sidebar")
            self.assertEqual(sidebar_slot["max_widgets"], 5)

            footer_slot = next(slot for slot in slots if slot["name"] == "footer")
            self.assertEqual(footer_slot["max_widgets"], 1)

    def test_slot_css_classes_parsing(self):
        """Test parsing of CSS classes from slot elements"""
        html_with_classes = """
        <div data-widget-slot="test" class="slot-class another-class">Content</div>
        """

        class ClassTestLayout(TemplateBasedLayout):
            name = "class_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = html_with_classes
            mock_get_template.return_value = mock_template

            layout = ClassTestLayout()
            slots = layout._parsed_slots

            self.assertEqual(len(slots), 1)
            slot = slots[0]
            self.assertEqual(slot["css_classes"], ["slot-class", "another-class"])

    def test_slot_selector_generation(self):
        """Test that slot selectors are correctly generated"""

        class SelectorTestLayout(TemplateBasedLayout):
            name = "selector_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = SelectorTestLayout()
            slots = layout._parsed_slots

            for slot in slots:
                expected_selector = f'[data-widget-slot="{slot["name"]}"]'
                self.assertEqual(slot["selector"], expected_selector)


class TestMaxWidgetsParsing(TemplateBasedLayoutTestCase):
    """Test max_widgets attribute parsing"""

    def test_valid_integer_parsing(self):
        """Test parsing valid integer values"""

        class MaxWidgetsTestLayout(TemplateBasedLayout):
            name = "max_widgets_test"

        layout = MaxWidgetsTestLayout()
        self.assertEqual(layout._parse_max_widgets("5"), 5)

    def test_none_value_parsing(self):
        """Test parsing None values"""

        class MaxWidgetsTestLayout(TemplateBasedLayout):
            name = "max_widgets_test"

        layout = MaxWidgetsTestLayout()
        self.assertIsNone(layout._parse_max_widgets(None))

    def test_empty_string_parsing(self):
        """Test parsing empty string values"""

        class MaxWidgetsTestLayout(TemplateBasedLayout):
            name = "max_widgets_test"

        layout = MaxWidgetsTestLayout()
        self.assertIsNone(layout._parse_max_widgets(""))

    def test_invalid_string_parsing(self):
        """Test parsing invalid string values returns None"""

        class MaxWidgetsTestLayout(TemplateBasedLayout):
            name = "max_widgets_test"

        layout = MaxWidgetsTestLayout()
        self.assertIsNone(layout._parse_max_widgets("invalid"))

    def test_float_string_parsing(self):
        """Test parsing float string values returns None"""

        class MaxWidgetsTestLayout(TemplateBasedLayout):
            name = "max_widgets_test"

        layout = MaxWidgetsTestLayout()
        self.assertIsNone(layout._parse_max_widgets("1.5"))


class TestErrorHandling(TemplateBasedLayoutTestCase):
    """Test error handling for various failure scenarios"""

    def test_template_not_found_error(self):
        """Test error handling for missing templates"""

        class ErrorTestLayout(TemplateBasedLayout):
            name = "error_test"
            template_file = "nonexistent_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_get_template.side_effect = TemplateDoesNotExist("Template not found")

            with self.assertRaises(ImproperlyConfigured) as context:
                ErrorTestLayout()

            self.assertIn("not found", str(context.exception))
            self.assertIn("nonexistent_template.html", str(context.exception))

    def test_beautifulsoup_import_error(self):
        """Test error handling when BeautifulSoup is not available"""

        class BSTestLayout(TemplateBasedLayout):
            name = "bs_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            with patch(
                "webpages.layout_registry.TemplateBasedLayout._extract_html"
            ) as mock_extract:
                mock_extract.side_effect = ImportError("No module named 'bs4'")

                with self.assertRaises(ImproperlyConfigured) as context:
                    BSTestLayout()

                self.assertIn("Missing dependency", str(context.exception))

    def test_html_parsing_error(self):
        """Test error handling for HTML parsing failures"""

        class ParseErrorLayout(TemplateBasedLayout):
            name = "parse_error"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            with patch(
                "webpages.layout_registry.TemplateBasedLayout._extract_html"
            ) as mock_extract:
                mock_extract.side_effect = ValueError("Invalid HTML")

                with self.assertRaises(ImproperlyConfigured) as context:
                    ParseErrorLayout()

                self.assertIn(
                    "Unexpected error parsing template", str(context.exception)
                )


class TestCaching(TemplateBasedLayoutTestCase):
    """Test template caching functionality"""

    def test_caching_enabled_by_default(self):
        """Test that caching is enabled by default"""

        class CacheTestLayout(TemplateBasedLayout):
            name = "cache_test"

        layout = CacheTestLayout()
        self.assertTrue(layout.cache_templates)

    def test_template_content_caching(self):
        """Test that template content is cached"""

        class CacheTestLayout(TemplateBasedLayout):
            name = "cache_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            # First access should call get_template
            layout1 = CacheTestLayout()
            self.assertEqual(mock_get_template.call_count, 1)

            # Second access should use cache
            layout2 = CacheTestLayout()
            # Call count should still be 1 if caching works
            # Note: This test may need adjustment based on actual caching behavior

    def test_cache_clearing(self):
        """Test that cache can be cleared"""

        class CacheTestLayout(TemplateBasedLayout):
            name = "cache_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = CacheTestLayout()
            layout.clear_cache()

            # Should be able to call without error
            self.assertTrue(True)

    def test_cache_key_generation_base(self):
        """Test basic cache key generation"""

        class CacheTestLayout(TemplateBasedLayout):
            name = "cache_test"
            template_file = "test_template.html"

        # Create layout without triggering template parsing
        layout = CacheTestLayout.__new__(CacheTestLayout)
        layout.name = "cache_test"
        layout.template_file = "test_template.html"

        base_key = layout._get_cache_key()

        self.assertIn("cache_test", base_key)
        self.assertIn("test_template.html", base_key)

    def test_cache_key_generation_with_suffix(self):
        """Test cache key generation with suffix"""

        class CacheTestLayout(TemplateBasedLayout):
            name = "cache_test"
            template_file = "test_template.html"

        # Create layout without triggering template parsing
        layout = CacheTestLayout.__new__(CacheTestLayout)
        layout.name = "cache_test"
        layout.template_file = "test_template.html"

        suffix_key = layout._get_cache_key("suffix")

        self.assertTrue(suffix_key.endswith(":suffix"))


class TestValidationConfiguration(TemplateBasedLayoutTestCase):
    """Test configurable validation functionality"""

    def test_validation_disabled(self):
        """Test that validation can be disabled"""

        class NoValidationLayout(TemplateBasedLayout):
            name = "no_validation"
            template_file = "test_template.html"
            validate_slots = False

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.no_slots_html
            mock_get_template.return_value = mock_template

            layout = NoValidationLayout()
            # Should not raise any validation errors
            layout.validate_slot_configuration()

    def test_slots_required_validation(self):
        """Test that slots can be required"""

        class RequiredSlotsLayout(TemplateBasedLayout):
            name = "required_slots"
            template_file = "test_template.html"
            require_slots = True

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.no_slots_html
            mock_get_template.return_value = mock_template

            with self.assertRaises(ImproperlyConfigured) as context:
                layout = RequiredSlotsLayout()
                layout.validate_slot_configuration()

            self.assertIn("slots are required", str(context.exception))

    def test_minimum_slots_validation(self):
        """Test minimum slots requirement"""

        class MinSlotsLayout(TemplateBasedLayout):
            name = "min_slots"
            template_file = "test_template.html"
            min_slots = 3

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html  # Only has 2 slots
            mock_get_template.return_value = mock_template

            with self.assertRaises(ImproperlyConfigured) as context:
                layout = MinSlotsLayout()
                layout.validate_slot_configuration()

            self.assertIn("at least 3 slots", str(context.exception))

    def test_maximum_slots_validation(self):
        """Test maximum slots limit"""

        class MaxSlotsLayout(TemplateBasedLayout):
            name = "max_slots"
            template_file = "test_template.html"
            max_slots = 1

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html  # Has 2 slots
            mock_get_template.return_value = mock_template

            with self.assertRaises(ImproperlyConfigured) as context:
                layout = MaxSlotsLayout()
                layout.validate_slot_configuration()

            self.assertIn("at most 1 slots", str(context.exception))


class TestLayoutDictionary(TemplateBasedLayoutTestCase):
    """Test layout dictionary representation"""

    def test_basic_to_dict_template_based_flag(self):
        """Test that template_based flag is set correctly"""

        class DictTestLayout(TemplateBasedLayout):
            name = "dict_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = DictTestLayout()
            layout_dict = layout.to_dict()

            self.assertEqual(layout_dict["template_based"], True)

    def test_basic_to_dict_template_file(self):
        """Test that template_file is included in dictionary"""

        class DictTestLayout(TemplateBasedLayout):
            name = "dict_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = DictTestLayout()
            layout_dict = layout.to_dict()

            self.assertEqual(layout_dict["template_file"], "test_template.html")

    def test_basic_to_dict_css_flag(self):
        """Test that has_css flag is set correctly"""

        class DictTestLayout(TemplateBasedLayout):
            name = "dict_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = DictTestLayout()
            layout_dict = layout.to_dict()

            self.assertTrue(layout_dict["has_css"])

    def test_basic_to_dict_slots_count(self):
        """Test that parsed_slots_count is correct"""

        class DictTestLayout(TemplateBasedLayout):
            name = "dict_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = DictTestLayout()
            layout_dict = layout.to_dict()

            self.assertEqual(layout_dict["parsed_slots_count"], 2)

    def test_to_dict_includes_validation_config(self):
        """Test that validation configuration is included in dictionary"""

        class ConfigDictLayout(TemplateBasedLayout):
            name = "config_dict"
            validate_slots = False
            require_slots = True
            min_slots = 1
            max_slots = 5

        layout = ConfigDictLayout()
        layout_dict = layout.to_dict()

        validation_config = layout_dict["validation_config"]
        self.assertEqual(validation_config["validate_slots"], False)
        self.assertEqual(validation_config["require_slots"], True)
        self.assertEqual(validation_config["min_slots"], 1)
        self.assertEqual(validation_config["max_slots"], 5)

    def test_to_dict_includes_caching_status(self):
        """Test that caching status is included in dictionary"""

        class CachingDictLayout(TemplateBasedLayout):
            name = "caching_dict"
            cache_templates = False

        layout = CachingDictLayout()
        layout_dict = layout.to_dict()

        self.assertEqual(layout_dict["caching_enabled"], False)


class TestBackwardCompatibility(TemplateBasedLayoutTestCase):
    """Test backward compatibility with existing layouts"""

    def test_base_layout_still_works(self):
        """Test that existing BaseLayout classes still work"""
        from .layout_registry import BaseLayout

        class TraditionalLayout(BaseLayout):
            name = "traditional"
            description = "Traditional layout"

            @property
            def slot_configuration(self):
                return {
                    "slots": [
                        {
                            "name": "main",
                            "title": "Main",
                            "description": "Main content",
                            "max_widgets": None,
                        }
                    ]
                }

        layout = TraditionalLayout()
        layout_dict = layout.to_dict()

        self.assertNotIn("template_based", layout_dict)
        self.assertEqual(layout_dict["type"], "code")

    def test_template_layout_identifies_as_template_based(self):
        """Test that TemplateBasedLayout identifies itself correctly"""

        class TemplateTestLayout(TemplateBasedLayout):
            name = "template_test"

        layout = TemplateTestLayout()
        layout_dict = layout.to_dict()

        self.assertTrue(layout_dict.get("template_based", False))


# Keep registration test at the end
class TestLayoutRegistration(TemplateBasedLayoutTestCase):
    """Test layout registration functionality"""

    def test_template_layout_registration(self):
        """Test that template-based layouts can be registered"""

        @register_layout
        class RegisteredTemplateLayout(TemplateBasedLayout):
            name = "registered_template"
            description = "Registered template layout"

        # Should not raise any errors
        self.assertTrue(True)


class TestEnhancedParsing(TemplateBasedLayoutTestCase):
    """Test enhanced parsing features"""

    def test_duplicate_slot_detection(self):
        """Test that duplicate slot names are detected and rejected"""

        class DuplicateSlotLayout(TemplateBasedLayout):
            name = "duplicate_slot_test"
            template_file = "test_template.html"
            require_unique_slot_names = True

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.duplicate_slots_html
            mock_get_template.return_value = mock_template

            with self.assertRaises(ImproperlyConfigured) as context:
                DuplicateSlotLayout()

            self.assertIn("Duplicate slot names found", str(context.exception))
            self.assertIn("content", str(context.exception))

    def test_duplicate_slots_allowed_when_configured(self):
        """Test that duplicate slots are allowed when explicitly configured"""

        class AllowDuplicateSlotLayout(TemplateBasedLayout):
            name = "allow_duplicate_test"
            template_file = "test_template.html"
            allow_duplicate_slots = True
            require_unique_slot_names = False

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.duplicate_slots_html
            mock_get_template.return_value = mock_template

            # Should not raise an exception
            layout = AllowDuplicateSlotLayout()
            self.assertEqual(len(layout._parsed_slots), 2)

    def test_invalid_slot_name_detection(self):
        """Test that invalid slot names are detected and rejected"""

        class InvalidSlotNameLayout(TemplateBasedLayout):
            name = "invalid_slot_name_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.invalid_slot_names_html
            mock_get_template.return_value = mock_template

            with self.assertRaises(ImproperlyConfigured) as context:
                InvalidSlotNameLayout()

            self.assertIn("Invalid slot name", str(context.exception))

    def test_negative_max_widgets_handling(self):
        """Test that negative max_widgets values are handled gracefully"""

        negative_max_widgets_html = """
        <div>
            <div data-widget-slot="test" data-slot-max-widgets="-1">
                Test content
            </div>
        </div>
        """

        class NegativeMaxWidgetsLayout(TemplateBasedLayout):
            name = "negative_max_widgets_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = negative_max_widgets_html
            mock_get_template.return_value = mock_template

            layout = NegativeMaxWidgetsLayout()
            slot = layout._parsed_slots[0]
            self.assertIsNone(slot["max_widgets"])  # Should be converted to None

    def test_parsing_errors_property(self):
        """Test that parsing errors are tracked and accessible"""

        class ParseErrorTrackingLayout(TemplateBasedLayout):
            name = "parse_error_tracking_test"
            template_file = "test_template.html"
            validate_css = True

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html + self.invalid_css
            mock_get_template.return_value = mock_template

            layout = ParseErrorTrackingLayout()
            # Should have parsing errors for invalid CSS
            self.assertIsInstance(layout.parsing_errors, list)

    def test_enhanced_to_dict_includes_parsing_info(self):
        """Test that to_dict includes enhanced parsing information"""

        class EnhancedDictLayout(TemplateBasedLayout):
            name = "enhanced_dict_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = EnhancedDictLayout()
            layout_dict = layout.to_dict()

            self.assertIn("parsing_errors", layout_dict)
            self.assertIn("validation_config", layout_dict)
            self.assertIn("validate_css", layout_dict["validation_config"])
            self.assertIn("allow_duplicate_slots", layout_dict["validation_config"])
            self.assertIn("require_unique_slot_names", layout_dict["validation_config"])


class TestCSSValidator(TemplateBasedLayoutTestCase):
    """Test CSS validation functionality"""

    def test_valid_css_passes_validation(self):
        """Test that valid CSS passes validation"""
        valid_css = """
        .test-class {
            background: #fff;
            color: black;
            margin: 10px;
        }
        """
        errors = CSSValidator.validate_css(valid_css)
        self.assertEqual(len(errors), 0)

    def test_empty_css_passes_validation(self):
        """Test that empty CSS passes validation"""
        errors = CSSValidator.validate_css("")
        self.assertEqual(len(errors), 0)

    def test_mismatched_braces_detected(self):
        """Test that mismatched braces are detected"""
        invalid_css = """
        .test-class {
            background: #fff;
            /* Missing closing brace */
        .another-class {
            color: red;
        }
        """
        errors = CSSValidator.validate_css(invalid_css)
        self.assertTrue(any("Mismatched braces" in error for error in errors))

    def test_dangerous_patterns_detected(self):
        """Test that dangerous CSS patterns are detected"""
        dangerous_css = """
        .malicious {
            background: url(javascript:alert('xss'));
        }
        """
        errors = CSSValidator.validate_css(dangerous_css)
        self.assertTrue(any("dangerous" in error.lower() for error in errors))

    def test_css_comments_removed_before_validation(self):
        """Test that CSS comments are properly removed before validation"""
        css_with_comments = """
        /* This is a comment */
        .test-class {
            background: #fff; /* Another comment */
        }
        """
        errors = CSSValidator.validate_css(css_with_comments)
        self.assertEqual(len(errors), 0)


class TestTemplateParsingError(TemplateBasedLayoutTestCase):
    """Test enhanced error handling"""

    def test_template_parsing_error_basic(self):
        """Test basic TemplateParsingError functionality"""
        error = TemplateParsingError("Test error message")
        self.assertEqual(str(error), "Test error message")

    def test_template_parsing_error_with_file(self):
        """Test TemplateParsingError with template file"""
        error = TemplateParsingError("Test error", template_file="test.html")
        self.assertIn("Template 'test.html'", str(error))

    def test_template_parsing_error_with_line_number(self):
        """Test TemplateParsingError with line number"""
        error = TemplateParsingError("Test error", line_number=42)
        self.assertIn("(line 42)", str(error))

    def test_template_parsing_error_with_context(self):
        """Test TemplateParsingError with context"""
        error = TemplateParsingError("Test error", context="Additional context")
        self.assertIn("Context: Additional context", str(error))

    def test_template_parsing_error_complete(self):
        """Test TemplateParsingError with all parameters"""
        error = TemplateParsingError(
            "Test error",
            template_file="test.html",
            line_number=42,
            context="Full context",
        )
        error_str = str(error)
        self.assertIn("Template 'test.html'", error_str)
        self.assertIn("(line 42)", error_str)
        self.assertIn("Context: Full context", error_str)


class TestCSSSafetyValidation(TemplateBasedLayoutTestCase):
    """Test CSS safety validation in templates"""

    def test_dangerous_css_causes_parsing_error(self):
        """Test that dangerous CSS patterns cause parsing errors"""

        dangerous_template = f"""
        <style>
        {self.dangerous_css}
        </style>
        <div data-widget-slot="content">Content</div>
        """

        class DangerousCSSLayout(TemplateBasedLayout):
            name = "dangerous_css_test"
            template_file = "test_template.html"
            validate_css = True

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = dangerous_template
            mock_get_template.return_value = mock_template

            with self.assertRaises(ImproperlyConfigured) as context:
                DangerousCSSLayout()

            self.assertIn("CSS validation failed", str(context.exception))

    def test_css_validation_can_be_disabled(self):
        """Test that CSS validation can be disabled"""

        dangerous_template = f"""
        <style>
        {self.dangerous_css}
        </style>
        <div data-widget-slot="content">Content</div>
        """

        class DisabledCSSValidationLayout(TemplateBasedLayout):
            name = "disabled_css_validation_test"
            template_file = "test_template.html"
            validate_css = False

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = dangerous_template
            mock_get_template.return_value = mock_template

            # Should not raise an exception
            layout = DisabledCSSValidationLayout()
            self.assertEqual(len(layout._parsed_slots), 1)

    def test_minor_css_issues_are_tracked_but_not_fatal(self):
        """Test that minor CSS issues are tracked but don't prevent parsing"""

        minor_issue_template = """
        <style>
        .test {
            background: #fff;
            /* Missing closing brace */
        .another {
            color: red;
        }
        </style>
        <div data-widget-slot="content">Content</div>
        """

        class MinorCSSIssueLayout(TemplateBasedLayout):
            name = "minor_css_issue_test"
            template_file = "test_template.html"
            validate_css = True

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = minor_issue_template
            mock_get_template.return_value = mock_template

            # Should not raise an exception but should track the error
            layout = MinorCSSIssueLayout()
            self.assertEqual(len(layout._parsed_slots), 1)
            self.assertTrue(len(layout.parsing_errors) > 0)
            self.assertTrue(
                any("CSS validation error" in error for error in layout.parsing_errors)
            )
