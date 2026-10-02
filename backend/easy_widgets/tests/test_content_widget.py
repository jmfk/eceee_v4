"""
Regression tests for ContentWidget.prepare_template_context.
"""

from types import SimpleNamespace
from unittest.mock import patch

from bs4 import BeautifulSoup
from django.template.loader import render_to_string
from django.test import SimpleTestCase

from easy_widgets.widgets.content import ContentWidget


class ContentWidgetPrepareTemplateContextTest(SimpleTestCase):
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
            "<ul><li>Item 1</li><li>Item 2</li></ul>"
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
            "<p>Before</p>"
            '<div data-media-insert="true" data-media-id="999" '
            'data-media-type="image" data-width="full" data-align="center">'
            "</div>"
            "<p>After</p>"
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

    def test_media_insert_uses_authored_image_alt_text(self):
        content = (
            '<div data-media-insert="true" data-media-id="999" data-media-type="image" '
            'data-width="full" data-align="center"><img src="legacy.jpg" alt="Migration diagram"></div>'
        )
        with patch.object(self.widget, "_render_media_insert_with_style", return_value="<figure></figure>") as render:
            self.widget.prepare_template_context({"content": content}, {})

        self.assertEqual(render.call_args.args[5], "Migration diagram")

    def test_media_insert_escapes_alt_and_caption_in_public_html(self):
        content = (
            '<div data-media-insert="true" data-media-id="999" data-media-type="image" '
            'data-caption="Caption &quot; onmouseover=&quot;bad()">'
            '<img src="legacy.jpg" alt="Diagram &quot; onerror=&quot;bad()"></div>'
        )
        media = SimpleNamespace(
            id=999, width=100, height=100, title="", file_url="/safe.jpg", get_file_url=lambda: "/derived.jpg"
        )
        with (
            patch("file_manager.models.MediaFile.objects.get", return_value=media),
            patch(
                "file_manager.imgproxy.imgproxy_service.generate_responsive_urls",
                return_value={"1x": {"url": "/safe.jpg", "width": 100, "height": 100}, "srcset": ""},
            ) as generate,
        ):
            config = self.widget.prepare_template_context({"content": content}, {})

        rendered = render_to_string(
            self.widget.template_name,
            {"config": config, "widget_type": SimpleNamespace(css_class_name="content")},
        )
        figure = BeautifulSoup(rendered, "html.parser").find("figure")
        image = figure.find("img")
        self.assertEqual(image["alt"], 'Diagram " onerror="bad()')
        self.assertEqual(image["width"], "100")
        self.assertEqual(image["height"], "100")
        self.assertEqual(generate.call_args.kwargs["source_url"], "/safe.jpg")
        self.assertEqual(figure.find("figcaption").text, 'Caption " onmouseover="bad()')
        self.assertNotIn("onerror", image.attrs)
        self.assertNotIn("onmouseover", figure.attrs)
