"""
Unit tests for template parser security fixes
"""

import json
import unittest
from unittest.mock import patch, mock_open, MagicMock
from django.test import TestCase
from django.core.cache import cache
from django.template.loader import get_template
from django.template import Template

from webpages.utils.template_parser import (
    TemplateParser,
    validate_default_widgets_json,
    sanitize_widget_content,
    LayoutSerializer,
)


class TestSecurityValidation(TestCase):
    """Test security validation functions"""

    def setUp(self):
        self.parser = TemplateParser()

    def test_validate_default_widgets_json_valid(self):
        """Test validation with valid widget data"""
        valid_widgets = [
            {"type": "text", "config": {"content": "Hello"}},
            {"type": "image", "config": {"url": "test.jpg"}, "id": "img1", "order": 1},
        ]

        self.assertTrue(validate_default_widgets_json(valid_widgets))

    def test_validate_default_widgets_json_invalid_structure(self):
        """Test validation with invalid structure"""
        # Not a list
        self.assertFalse(validate_default_widgets_json({"type": "text"}))

        # Too many widgets
        many_widgets = [{"type": "text"} for _ in range(25)]
        self.assertFalse(validate_default_widgets_json(many_widgets))

        # Missing required field
        invalid_widgets = [{"config": {"content": "Hello"}}]
        self.assertFalse(validate_default_widgets_json(invalid_widgets))

        # Invalid type field
        invalid_widgets = [{"type": 123}]
        self.assertFalse(validate_default_widgets_json(invalid_widgets))

        # Invalid widget object
        invalid_widgets = ["not_an_object"]
        self.assertFalse(validate_default_widgets_json(invalid_widgets))

    def test_validate_default_widgets_json_size_limits(self):
        """Test validation enforces size limits"""
        # Type too long
        long_type_widget = [{"type": "x" * 101}]
        self.assertFalse(validate_default_widgets_json(long_type_widget))

        # ID too long
        long_id_widget = [{"type": "text", "id": "x" * 51}]
        self.assertFalse(validate_default_widgets_json(long_id_widget))

        # Negative order
        negative_order_widget = [{"type": "text", "order": -1}]
        self.assertFalse(validate_default_widgets_json(negative_order_widget))

    def test_sanitize_widget_content_basic(self):
        """Test basic widget content sanitization"""
        widget = {
            "type": "text",
            "config": {"content": "<script>alert('xss')</script>Hello"},
            "id": "test_widget",
            "order": 1,
        }

        sanitized = sanitize_widget_content(widget)

        self.assertEqual(sanitized["type"], "text")
        self.assertIn("&lt;script&gt;", sanitized["config"]["content"])
        self.assertNotIn("<script>", sanitized["config"]["content"])
        self.assertEqual(sanitized["id"], "test_widget")
        self.assertEqual(sanitized["order"], 1)

    def test_sanitize_widget_content_limits(self):
        """Test sanitization enforces content limits"""
        widget = {
            "type": "x" * 200,  # Too long
            "config": {"key" * 20: "value" * 500},  # Key too long, value too long
            "id": "x" * 100,  # Too long
            "order": 99999,  # Too large
        }

        sanitized = sanitize_widget_content(widget)

        self.assertEqual(len(sanitized["type"]), 100)  # Truncated
        self.assertEqual(len(sanitized["id"]), 50)  # Truncated
        self.assertEqual(sanitized["order"], 9999)  # Capped

    def test_sanitize_widget_content_filters_dangerous_types(self):
        """Test that dangerous config types are filtered out"""
        widget = {
            "type": "text",
            "config": {
                "safe_string": "hello",
                "safe_number": 42,
                "safe_bool": True,
                "dangerous_object": {"nested": "object"},
                "dangerous_list": ["list", "items"],
            },
        }

        sanitized = sanitize_widget_content(widget)

        self.assertIn("safe_string", sanitized["config"])
        self.assertIn("safe_number", sanitized["config"])
        self.assertIn("safe_bool", sanitized["config"])
        self.assertNotIn("dangerous_object", sanitized["config"])
        self.assertNotIn("dangerous_list", sanitized["config"])


class TestTemplateParserSecurity(TestCase):
    """Test template parser security features"""

    def setUp(self):
        self.parser = TemplateParser()
        cache.clear()

    def tearDown(self):
        cache.clear()

    @patch("webpages.utils.template_parser.get_template")
    def test_parse_template_with_malicious_json(self, mock_get_template):
        """Test parser handles malicious JSON safely"""
        # Mock template with malicious JSON
        malicious_template = """
        {% block content %}
        <div data-widget-slot="main">
            {# default: [{"type": "<script>alert('xss')</script>", "config": {"evil": true}}] #}
        </div>
        {% endblock %}
        """

        mock_template = MagicMock()
        mock_template.template.source = malicious_template
        mock_get_template.return_value = mock_template

        result = self.parser.parse_template("test.html")

        # Check that XSS is escaped
        slot_config = result["slot"]
        if "defaultWidgets" in slot_config:
            widget_type = slot_config["defaultWidgets"][0]["type"]
            self.assertIn("&lt;script&gt;", widget_type)
            self.assertNotIn("<script>", widget_type)

    @patch("webpages.utils.template_parser.get_template")
    def test_parse_template_oversized_json_rejected(self, mock_get_template):
        """Test parser rejects oversized JSON"""
        # Create oversized JSON (over 10KB)
        oversized_json = json.dumps(
            [{"type": "x" * 5000, "config": {}} for _ in range(10)]
        )

        oversized_template = f"""
        {{% block content %}}
        <div data-widget-slot="main">
            {{# default: {oversized_json} #}}
        </div>
        {{% endblock %}}
        """

        mock_template = MagicMock()
        mock_template.template.source = oversized_template
        mock_get_template.return_value = mock_template

        result = self.parser.parse_template("test.html")

        # Should not include default widgets due to size limit
        self.assertNotIn("defaultWidgets", result.get("slot", {}))

    @patch("webpages.utils.template_parser.get_template")
    def test_parse_template_invalid_json_handled(self, mock_get_template):
        """Test parser handles invalid JSON gracefully"""
        invalid_template = """
        {% block content %}
        <div data-widget-slot="main">
            {# default: [invalid json syntax #}
        </div>
        {% endblock %}
        """

        mock_template = MagicMock()
        mock_template.template.source = invalid_template
        mock_get_template.return_value = mock_template

        result = self.parser.parse_template("test.html")

        # Should handle gracefully without crashing
        self.assertIn("slot", result)
        self.assertNotIn("defaultWidgets", result["slot"])

    @patch("webpages.utils.template_parser.get_template")
    def test_parse_template_html_content_escaped(self, mock_get_template):
        """Test that HTML content is properly escaped"""
        template_with_html = """
        {% block content %}
        <div class="<script>alert('xss')</script>container" data-test="<img src=x onerror=alert(1)>">
            <p>Normal text with <script>dangerous()</script> content</p>
        </div>
        {% endblock %}
        """

        mock_template = MagicMock()
        mock_template.template.source = template_with_html
        mock_get_template.return_value = mock_template

        result = self.parser.parse_template("test.html")

        # Check that HTML is escaped in classes and attributes
        self.assertIn("&lt;script&gt;", result["classes"])
        self.assertNotIn("<script>", result["classes"])

        # Check that text content is escaped
        if "children" in result:
            for child in result["children"]:
                if child.get("type") == "text":
                    self.assertIn("&lt;script&gt;", child["content"])
                    self.assertNotIn("<script>", child["content"])

    @patch("webpages.utils.template_parser.get_template")
    def test_parse_template_caching_works(self, mock_get_template):
        """Test that template parsing results are cached"""
        template_content = """
        {% block content %}
        <div data-widget-slot="main"></div>
        {% endblock %}
        """

        mock_template = MagicMock()
        mock_template.template.source = template_content
        mock_get_template.return_value = mock_template

        # First call
        result1 = self.parser.parse_template("test.html")

        # Second call should use cache
        result2 = self.parser.parse_template("test.html")

        # Should only call get_template once due to caching
        self.assertEqual(mock_get_template.call_count, 1)
        self.assertEqual(result1, result2)

    @patch("webpages.utils.template_parser.get_template")
    def test_parse_template_error_handling(self, mock_get_template):
        """Test that template parsing errors are handled securely"""
        # Mock template loading error
        mock_get_template.side_effect = Exception("Template not found")

        with self.assertRaises(Exception) as context:
            self.parser.parse_template("nonexistent.html")

        # Should not expose internal error details
        self.assertEqual(str(context.exception), "Template parsing failed")


class TestLayoutSerializerSecurity(TestCase):
    """Test layout serializer security"""

    def setUp(self):
        self.serializer = LayoutSerializer()

    @patch("webpages.utils.template_parser.TemplateParser.parse_template")
    def test_serialize_layout_error_handling(self, mock_parse):
        """Test that layout serialization errors are handled securely"""
        # Mock parsing error
        mock_parse.side_effect = Exception("Internal parsing error")

        # Mock layout object
        mock_layout = MagicMock()
        mock_layout.id = 1
        mock_layout.name = "test"
        mock_layout.description = "test layout"
        mock_layout.template_name = "test.html"

        with self.assertRaises(Exception) as context:
            self.serializer.serialize_layout(mock_layout)

        # Should propagate the generic error message
        self.assertEqual(str(context.exception), "Template parsing failed")


class TestSecurityRegression(TestCase):
    """Regression tests for security issues"""

    def test_no_code_execution_in_json_parsing(self):
        """Ensure JSON parsing cannot execute arbitrary code"""
        # This would be dangerous if not properly validated
        dangerous_widgets = [
            {"type": "text", "__class__": {"__module__": "os", "__name__": "system"}},
            {"type": "eval", "config": {"code": "import os; os.system('rm -rf /')"}},
        ]

        # Should fail validation
        self.assertFalse(validate_default_widgets_json(dangerous_widgets))

    def test_html_injection_prevention(self):
        """Ensure HTML injection is prevented"""
        malicious_widget = {
            "type": "text",
            "config": {
                "content": "</script><script>alert('XSS')</script><script>",
                "title": "<img src=x onerror=alert('XSS2')>",
            },
            "id": "<svg onload=alert('XSS3')>",
        }

        sanitized = sanitize_widget_content(malicious_widget)

        # All HTML should be escaped
        for key, value in sanitized["config"].items():
            self.assertNotIn("<script>", value)
            self.assertNotIn("<img", value)
            self.assertIn("&lt;", value)  # Should be HTML escaped

        self.assertNotIn("<svg", sanitized["id"])
        self.assertIn("&lt;", sanitized["id"])  # Should be HTML escaped

    def test_json_bomb_prevention(self):
        """Ensure JSON bombs are prevented"""
        # Create deeply nested structure that could cause issues
        nested_config = {"level": {}}
        current = nested_config["level"]
        for i in range(100):
            current["next"] = {}
            current = current["next"]

        widget = {"type": "text", "config": nested_config}

        # Should handle this gracefully by filtering out complex objects
        sanitized = sanitize_widget_content(widget)
        self.assertEqual(sanitized["config"], {})  # Complex objects filtered out


if __name__ == "__main__":
    unittest.main()
