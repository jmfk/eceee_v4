"""
Regression tests for ContentWidget.prepare_template_context.
"""

from django.test import TestCase

from easy_widgets.widgets.content import ContentWidget


class ContentWidgetPrepareTemplateContextTest(TestCase):
    def setUp(self):
        self.widget = ContentWidget()

    def test_plain_html_no_media_inserts(self):
        """No NameError when content has no data-media-insert divs."""
        config = {"content": "<p>Hello world</p>"}
        result = self.widget.prepare_template_context(config, {})
        self.assertIn("processed_content", result)
        self.assertFalse(result["allow_scripts"])
        self.assertTrue(result["sanitize_html"])

    def test_defaults_without_optional_fields(self):
        """Missing optional config keys use sensible defaults."""
        config = {"content": "<h1>Title</h1>"}
        result = self.widget.prepare_template_context(config, {})
        self.assertEqual(result["allow_scripts"], False)
        self.assertEqual(result["sanitize_html"], True)
        self.assertEqual(result["show_border"], False)
        self.assertEqual(result["use_content_margins"], True)

    def test_empty_content_returns_early(self):
        """Empty content returns config without crashing."""
        config = {"content": ""}
        result = self.widget.prepare_template_context(config, {})
        self.assertNotIn("processed_content", result)

    def test_large_html_no_media_inserts(self):
        """Realistic page content without media inserts does not raise."""
        content = (
            "<h1>eceee 2026 Summer Study</h1>"
            "<p>The eceee Summer Studies are a cornerstone in our mission.</p>"
            '<ul><li>Item 1</li><li>Item 2</li></ul>'
        )
        config = {"content": content}
        try:
            result = self.widget.prepare_template_context(config, {})
        except NameError as exc:
            self.fail(f"prepare_template_context raised NameError: {exc}")
        self.assertIn("processed_content", result)

    def test_content_with_media_insert(self):
        """Content with a data-media-insert div is processed without error."""
        content = (
            '<p>Before</p>'
            '<div data-media-insert="true" data-media-id="999" '
            'data-media-type="image" data-width="full" data-align="center">'
            '</div>'
            '<p>After</p>'
        )
        config = {"content": content}
        # Should not raise even if media_id 999 doesn't exist in DB
        try:
            result = self.widget.prepare_template_context(config, {})
        except Exception as exc:
            # Only NameError / AttributeError indicate the regression; DB errors are ok
            if isinstance(exc, (NameError, AttributeError)):
                self.fail(f"prepare_template_context raised {type(exc).__name__}: {exc}")
        self.assertIn("allow_scripts", result)
