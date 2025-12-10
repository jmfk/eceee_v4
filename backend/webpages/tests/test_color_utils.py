"""
Tests for color utility functions.
"""

from django.test import TestCase
from webpages.utils.color_utils import resolve_color_value


class ColorUtilsTestCase(TestCase):
    """Test color resolution utilities"""

    def test_resolve_theme_color_name(self):
        """Theme color names should be converted to CSS variables"""
        theme_colors = {
            "primary": "#3b82f6",
            "secondary": "#64748b",
            "accent": "#10b981",
        }

        result = resolve_color_value("primary", theme_colors)
        self.assertEqual(result, "var(--primary)")

        result = resolve_color_value("secondary", theme_colors)
        self.assertEqual(result, "var(--secondary)")

        result = resolve_color_value("accent", theme_colors)
        self.assertEqual(result, "var(--accent)")

    def test_resolve_hex_color(self):
        """Hex colors should pass through unchanged"""
        theme_colors = {"primary": "#3b82f6"}

        result = resolve_color_value("#ff0000", theme_colors)
        self.assertEqual(result, "#ff0000")

        result = resolve_color_value("#123", theme_colors)
        self.assertEqual(result, "#123")

    def test_resolve_rgb_color(self):
        """RGB colors should pass through unchanged"""
        theme_colors = {"primary": "#3b82f6"}

        result = resolve_color_value("rgb(255, 0, 0)", theme_colors)
        self.assertEqual(result, "rgb(255, 0, 0)")

        result = resolve_color_value("rgba(255, 0, 0, 0.5)", theme_colors)
        self.assertEqual(result, "rgba(255, 0, 0, 0.5)")

    def test_resolve_hsl_color(self):
        """HSL colors should pass through unchanged"""
        theme_colors = {"primary": "#3b82f6"}

        result = resolve_color_value("hsl(0, 100%, 50%)", theme_colors)
        self.assertEqual(result, "hsl(0, 100%, 50%)")

    def test_resolve_named_css_color(self):
        """Named CSS colors should pass through unchanged (unless they match theme colors)"""
        theme_colors = {"primary": "#3b82f6"}

        # CSS color name that's not in theme colors
        result = resolve_color_value("red", theme_colors)
        self.assertEqual(result, "red")

        result = resolve_color_value("transparent", theme_colors)
        self.assertEqual(result, "transparent")

    def test_resolve_none_value(self):
        """None values should return None"""
        theme_colors = {"primary": "#3b82f6"}

        result = resolve_color_value(None, theme_colors)
        self.assertIsNone(result)

    def test_resolve_empty_string(self):
        """Empty strings should return empty string"""
        theme_colors = {"primary": "#3b82f6"}

        result = resolve_color_value("", theme_colors)
        self.assertEqual(result, "")

    def test_resolve_with_empty_theme_colors(self):
        """Should work with empty theme colors dict"""
        theme_colors = {}

        result = resolve_color_value("#ff0000", theme_colors)
        self.assertEqual(result, "#ff0000")

        result = resolve_color_value("primary", theme_colors)
        self.assertEqual(result, "primary")

    def test_resolve_case_sensitive(self):
        """Color name matching should be case-sensitive"""
        theme_colors = {"primary": "#3b82f6"}

        # Exact match - should convert
        result = resolve_color_value("primary", theme_colors)
        self.assertEqual(result, "var(--primary)")

        # Different case - should NOT convert
        result = resolve_color_value("Primary", theme_colors)
        self.assertEqual(result, "Primary")

        result = resolve_color_value("PRIMARY", theme_colors)
        self.assertEqual(result, "PRIMARY")

