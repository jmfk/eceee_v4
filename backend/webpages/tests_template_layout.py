"""
Tests for TemplateBasedLayout functionality

This module contains comprehensive tests for the enhanced BaseLayout class
with HTML template support, CSS extraction, and slot parsing capabilities.
"""

import os
import tempfile
from django.test import TestCase
from django.template.loader import get_template
from django.core.exceptions import ImproperlyConfigured
from unittest.mock import patch, MagicMock

from .layout_registry import TemplateBasedLayout, register_layout


class TestTemplateBasedLayout(TestCase):
    """Test cases for TemplateBasedLayout class"""

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
            grid-template-columns: 1fr 2fr;
        }
        .sidebar { grid-column: 1; }
        .main { grid-column: 2; }
        </style>
        <div class="complex-layout">
            <header data-widget-slot="header" 
                    data-slot-title="Page Header" 
                    data-slot-description="Main header with navigation"
                    data-slot-max-widgets="2"
                    class="header-section">
                Header placeholder
            </header>
            <main data-widget-slot="content" 
                  data-slot-title="Main Content"
                  class="main-content">
                Content placeholder
            </main>
            <aside data-widget-slot="sidebar" 
                   data-slot-title="Sidebar"
                   data-slot-description="Additional content"
                   data-slot-max-widgets="5"
                   class="sidebar-section">
                Sidebar placeholder
            </aside>
            <footer data-widget-slot="footer" 
                    data-slot-max-widgets="1">
                Footer placeholder
            </footer>
        </div>
        """

        self.no_slots_html = """
        <style>
        .simple { color: red; }
        </style>
        <div class="simple">
            <p>No widget slots here</p>
        </div>
        """

    def test_basic_template_parsing(self):
        """Test basic template parsing functionality"""

        class BasicTestLayout(TemplateBasedLayout):
            name = "basic_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = BasicTestLayout()

            # Test that template was parsed
            self.assertEqual(layout.name, "basic_test")
            self.assertTrue(hasattr(layout, "_extracted_html"))
            self.assertTrue(hasattr(layout, "_extracted_css"))
            self.assertTrue(hasattr(layout, "_parsed_slots"))

    def test_html_extraction(self):
        """Test HTML extraction removes style tags correctly"""

        class HTMLTestLayout(TemplateBasedLayout):
            name = "html_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = HTMLTestLayout()
            extracted_html = layout._extracted_html

            # Style tags should be removed
            self.assertNotIn("<style>", extracted_html)
            self.assertNotIn("background: #fff", extracted_html)

            # HTML content should remain
            self.assertIn('data-widget-slot="header"', extracted_html)
            self.assertIn('class="test-layout"', extracted_html)

    def test_css_extraction(self):
        """Test CSS extraction from style tags"""

        class CSSTestLayout(TemplateBasedLayout):
            name = "css_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = CSSTestLayout()
            extracted_css = layout._extracted_css

            # CSS should be extracted
            self.assertIn(".test-layout", extracted_css)
            self.assertIn("background: #fff", extracted_css)

    def test_slot_parsing_basic(self):
        """Test basic slot parsing from data attributes"""

        class SlotTestLayout(TemplateBasedLayout):
            name = "slot_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = SlotTestLayout()
            slots = layout._parsed_slots

            # Should find 2 slots
            self.assertEqual(len(slots), 2)

            # Check header slot
            header_slot = next(slot for slot in slots if slot["name"] == "header")
            self.assertEqual(header_slot["title"], "Header")
            self.assertEqual(header_slot["description"], "Page header")
            self.assertIsNone(header_slot["max_widgets"])

            # Check content slot (defaults)
            content_slot = next(slot for slot in slots if slot["name"] == "content")
            self.assertEqual(
                content_slot["title"], "Content"
            )  # Auto-generated from name
            self.assertEqual(content_slot["description"], "content content area")

    def test_slot_parsing_complex(self):
        """Test complex slot parsing with all attributes"""

        class ComplexSlotTestLayout(TemplateBasedLayout):
            name = "complex_slot_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.complex_html
            mock_get_template.return_value = mock_template

            layout = ComplexSlotTestLayout()
            slots = layout._parsed_slots

            # Should find 4 slots
            self.assertEqual(len(slots), 4)

            # Check header slot with max_widgets
            header_slot = next(slot for slot in slots if slot["name"] == "header")
            self.assertEqual(header_slot["max_widgets"], 2)
            self.assertEqual(header_slot["title"], "Page Header")
            self.assertEqual(header_slot["description"], "Main header with navigation")

            # Check sidebar slot
            sidebar_slot = next(slot for slot in slots if slot["name"] == "sidebar")
            self.assertEqual(sidebar_slot["max_widgets"], 5)

            # Check footer slot
            footer_slot = next(slot for slot in slots if slot["name"] == "footer")
            self.assertEqual(footer_slot["max_widgets"], 1)
            self.assertEqual(footer_slot["title"], "Footer")  # Auto-generated

    def test_max_widgets_parsing(self):
        """Test various max_widgets value parsing"""

        class MaxWidgetsTestLayout(TemplateBasedLayout):
            name = "max_widgets_test"
            # No template_file so it won't try to parse

        layout = MaxWidgetsTestLayout()

        # Test valid integer
        self.assertEqual(layout._parse_max_widgets("5"), 5)

        # Test None/empty
        self.assertIsNone(layout._parse_max_widgets(None))
        self.assertIsNone(layout._parse_max_widgets(""))

        # Test invalid values
        self.assertIsNone(layout._parse_max_widgets("invalid"))
        self.assertIsNone(layout._parse_max_widgets("1.5"))

    def test_slot_configuration_property(self):
        """Test slot_configuration property returns correct format"""

        class ConfigTestLayout(TemplateBasedLayout):
            name = "config_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = ConfigTestLayout()
            config = layout.slot_configuration

            # Should be properly formatted
            self.assertIsInstance(config, dict)
            self.assertIn("slots", config)
            self.assertIsInstance(config["slots"], list)
            self.assertEqual(len(config["slots"]), 2)

    def test_to_dict_enhancement(self):
        """Test enhanced to_dict method includes template data"""

        class DictTestLayout(TemplateBasedLayout):
            name = "dict_test"
            description = "Test layout for dict output"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.simple_html
            mock_get_template.return_value = mock_template

            layout = DictTestLayout()
            layout_dict = layout.to_dict()

            # Should include base fields
            self.assertEqual(layout_dict["name"], "dict_test")
            self.assertEqual(layout_dict["type"], "code")

            # Should include template-specific fields
            self.assertTrue(layout_dict["template_based"])
            self.assertEqual(layout_dict["template_file"], "test_template.html")
            self.assertTrue(layout_dict["has_css"])
            self.assertEqual(layout_dict["parsed_slots_count"], 2)

            # Should include extracted content
            self.assertIn("html", layout_dict)
            self.assertIn("css", layout_dict)

    def test_validation_enhancement(self):
        """Test enhanced validation for template-based layouts"""

        class ValidationTestLayout(TemplateBasedLayout):
            name = "validation_test"
            template_file = "test_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.template.source = self.no_slots_html
            mock_get_template.return_value = mock_template

            with patch("webpages.layout_registry.logger") as mock_logger:
                layout = ValidationTestLayout()
                layout.validate_slot_configuration()

                # Should log warning for no slots
                mock_logger.warning.assert_called_once()

    def test_template_loading_error(self):
        """Test error handling for missing templates"""

        class ErrorTestLayout(TemplateBasedLayout):
            name = "error_test"
            template_file = "nonexistent_template.html"

        with patch("webpages.layout_registry.get_template") as mock_get_template:
            mock_get_template.side_effect = Exception("Template not found")

            with self.assertRaises(ImproperlyConfigured) as context:
                ErrorTestLayout()

            self.assertIn("Could not load template", str(context.exception))
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
                "builtins.__import__", side_effect=ImportError("No module named 'bs4'")
            ):
                with self.assertRaises(ImproperlyConfigured) as context:
                    BSTestLayout()

                self.assertIn("BeautifulSoup4 is required", str(context.exception))

    def test_no_template_file(self):
        """Test layout with no template_file specified"""

        class NoTemplateLayout(TemplateBasedLayout):
            name = "no_template"
            # No template_file specified

        layout = NoTemplateLayout()

        # Should initialize without parsing
        self.assertEqual(layout._extracted_html, "")
        self.assertEqual(layout._extracted_css, "")
        self.assertEqual(layout._parsed_slots, [])

        # slot_configuration should return empty slots
        config = layout.slot_configuration
        self.assertEqual(config, {"slots": []})

    def test_backward_compatibility(self):
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

        # Should not have template_based flag
        self.assertNotIn("template_based", layout_dict)
        self.assertEqual(layout_dict["type"], "code")

    def test_css_extraction_multiple_style_tags(self):
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

            # Should contain both style blocks
            self.assertIn(".first { color: red; }", css)
            self.assertIn(".second { color: blue; }", css)

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
