"""
Test cases for layout-based default widgets system
"""

from django.test import TestCase
from webpages.utils.template_parser import TemplateParser
from webpages.layouts import SingleColumnLayout, TwoColumnLayout, SidebarLayout


class TestLayoutBasedDefaults(TestCase):
    """Test that default widgets come from slot_configuration instead of template comments"""

    def test_single_column_layout_default_widgets(self):
        """Test that SingleColumnLayout provides default widgets from slot_configuration"""
        layout = SingleColumnLayout()
        parser = TemplateParser(layout=layout)

        # Test that the parser can get default widgets from the layout
        main_defaults = parser._get_default_widgets_from_layout("main")
        sidebar_defaults = parser._get_default_widgets_from_layout("sidebar")

        # Verify main slot has default widgets
        self.assertIsNotNone(main_defaults)
        self.assertIsInstance(main_defaults, list)
        self.assertEqual(len(main_defaults), 2)  # text + image
        self.assertEqual(main_defaults[0]["type"], "text")
        self.assertEqual(main_defaults[1]["type"], "image")

        # Verify sidebar slot has default widgets
        self.assertIsNotNone(sidebar_defaults)
        self.assertIsInstance(sidebar_defaults, list)
        self.assertEqual(len(sidebar_defaults), 2)  # recent_posts + social_media
        self.assertEqual(sidebar_defaults[0]["type"], "recent_posts")
        self.assertEqual(sidebar_defaults[1]["type"], "social_media")

        # Verify non-existent slot returns None
        nonexistent_defaults = parser._get_default_widgets_from_layout("nonexistent")
        self.assertIsNone(nonexistent_defaults)

    def test_sidebar_layout_default_widgets(self):
        """Test that SidebarLayout provides default widgets from slot_configuration"""
        layout = SidebarLayout()
        parser = TemplateParser(layout=layout)

        # Test sidebar-top slot
        sidebar_top_defaults = parser._get_default_widgets_from_layout("sidebar-top")
        self.assertIsNotNone(sidebar_top_defaults)
        self.assertEqual(len(sidebar_top_defaults), 1)
        self.assertEqual(sidebar_top_defaults[0]["type"], "recent_posts")

        # Test sidebar-bottom slot (has multiple defaults)
        sidebar_bottom_defaults = parser._get_default_widgets_from_layout(
            "sidebar-bottom"
        )
        self.assertIsNotNone(sidebar_bottom_defaults)
        self.assertEqual(len(sidebar_bottom_defaults), 2)
        self.assertEqual(sidebar_bottom_defaults[0]["type"], "tag_cloud")
        self.assertEqual(sidebar_bottom_defaults[1]["type"], "newsletter")

    def test_parser_without_layout_returns_none(self):
        """Test that parser without layout returns None for default widgets"""
        parser = TemplateParser()  # No layout provided

        defaults = parser._get_default_widgets_from_layout("main")
        self.assertIsNone(defaults)

    def test_template_parsing_with_layout(self):
        """Test that template parsing works with layout-based default widgets"""
        layout = SingleColumnLayout()
        parser = TemplateParser(layout=layout)

        # Parse the template - this should work without template comments
        result = parser.parse_template("webpages/layouts/single_column.html")

        # Verify parsing was successful
        self.assertIsNotNone(result)
        self.assertIsInstance(result, dict)

        # The result should contain slot information
        # (specific structure depends on the template parsing logic)
        self.assertTrue(any(key in result for key in ["type", "tag", "children"]))

    def test_slot_configuration_validation(self):
        """Test that slot configurations are properly validated"""
        layout = SingleColumnLayout()

        # This should not raise an exception
        layout.validate_slot_configuration()

        # Verify the slot configuration structure
        config = layout.slot_configuration
        self.assertIsInstance(config, dict)
        self.assertIn("slots", config)
        self.assertIsInstance(config["slots"], list)

        # Check that slots with default_widgets have valid structure
        for slot in config["slots"]:
            if "default_widgets" in slot:
                self.assertIsInstance(slot["default_widgets"], list)
                for widget in slot["default_widgets"]:
                    self.assertIsInstance(widget, dict)
                    self.assertIn("type", widget)
                    self.assertIn("config", widget)
