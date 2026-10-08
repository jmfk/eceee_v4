from types import SimpleNamespace

from django.template.loader import render_to_string
from django.test import SimpleTestCase


class SemanticWidgetMarkupTests(SimpleTestCase):
    widget_type = SimpleNamespace(css_class_name="testwidget")

    def test_content_card_header_is_a_heading(self):
        html = render_to_string(
            "easy_widgets/widgets/content_card.html",
            {
                "widget_type": self.widget_type,
                "config": {"header": "Card heading", "content": "", "show_border": True},
            },
        )

        self.assertIn('<h2 class="content-card-header">', html)
        self.assertNotIn('<div class="content-card-header">', html)

    def test_form_description_is_a_paragraph(self):
        html = render_to_string(
            "easy_widgets/widgets/forms.html",
            {
                "widget_type": self.widget_type,
                "config": {
                    "title": "Contact",
                    "description": "How can we help?",
                    "fields": [],
                    "submit_button_text": "Send",
                },
            },
        )

        self.assertIn('<h2 class="form-title">Contact</h2>', html)
        self.assertIn('<p class="form-description">', html)
        self.assertNotIn('<div class="form-description">', html)

    def test_top_news_excerpt_is_a_paragraph(self):
        item = SimpleNamespace(
            id=1,
            title="Article",
            slug="article",
            object_type=SimpleNamespace(name="news", label="News"),
            is_pinned=False,
            featured_image_url=None,
            publish_date=None,
            excerpt_text="A short summary.",
        )
        html = render_to_string(
            "easy_widgets/widgets/top_news_plug.html",
            {
                "widget_type": self.widget_type,
                "config": {"show_excerpts": True, "show_publish_date": False, "show_object_type": False},
                "news_items": [item],
                "layout_class": "layout-1x3",
            },
        )

        self.assertIn('<p class="news-excerpt">', html)
        self.assertNotIn('<div class="news-excerpt">', html)

    def test_image_captions_describe_figures(self):
        base_context = {
            "widget_type": self.widget_type,
            "widget": SimpleNamespace(id="image-1"),
        }

        for display_type in ("single", "gallery", "carousel"):
            with self.subTest(display_type=display_type):
                html = render_to_string(
                    "easy_widgets/widgets/image.html",
                    {
                        **base_context,
                        "config": {
                            "display_type": display_type,
                            "show_captions": True,
                            "media_items": [
                                {
                                    "type": "image",
                                    "src_url": "/image.webp",
                                    "alt_text": "Example image",
                                    "caption": "Image caption",
                                }
                            ],
                        },
                    },
                )

                self.assertIn("<figure", html)
                self.assertIn("<figcaption", html)
                self.assertNotIn('<div class="image-caption">', html)
                self.assertNotIn('<div class="carousel-caption">', html)

    def test_section_collapse_controls_are_buttons(self):
        html = render_to_string(
            "easy_widgets/widgets/section.html",
            {
                "widget_type": self.widget_type,
                "config": {
                    "enable_collapse": True,
                    "start_expanded": False,
                    "rendered_slots": {"content": []},
                },
            },
        )

        self.assertEqual(html.count('<button type="button" class="section-banner'), 2)
        self.assertEqual(html.count('aria-expanded="false"'), 2)
        self.assertNotIn('<div class="section-banner', html)
