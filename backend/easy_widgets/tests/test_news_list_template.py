from types import SimpleNamespace
from unittest.mock import patch

from django.template.loader import render_to_string
from django.test import SimpleTestCase

from easy_widgets.widgets.news_list import NewsListWidget


class NewsListTemplateTests(SimpleTestCase):
    def test_renders_prepared_items_and_links_to_the_dynamic_page(self):
        item = SimpleNamespace(
            id=41,
            title="Rendered object",
            slug="rendered-object",
            object_type=SimpleNamespace(name="article", label="Article"),
            is_pinned=False,
            publish_date=None,
            excerpt_text="Prepared excerpt",
            featured_image_url=None,
        )
        html = render_to_string(
            "easy_widgets/widgets/news_list.html",
            {
                "widget_type": SimpleNamespace(css_class_name="newslistwidget"),
                "config": SimpleNamespace(
                    show_featured_image=False,
                    show_publish_date=True,
                    show_excerpts=True,
                ),
                "news_items": [item],
                "current_page": SimpleNamespace(cached_path="/objects/"),
            },
        )

        self.assertIn("Rendered object", html)
        self.assertIn("Prepared excerpt", html)
        self.assertIn('href="/objects/rendered-object/"', html)

    @patch("object_storage.models.ObjectInstance.get_published_objects")
    def test_prepared_items_use_published_version_metadata(self, published_objects):
        effective_date = object()
        version = SimpleNamespace(
            data={"summary": "Summary"},
            effective_date=effective_date,
            is_featured=True,
        )
        item = SimpleNamespace(get_current_published_version=lambda: version)
        published_objects.return_value = [item]

        config = SimpleNamespace(
            object_types=[1],
            limit=10,
            sort_order="-publish_date",
            show_excerpts=True,
            excerpt_length=150,
            show_featured_image=False,
        )

        result = NewsListWidget()._get_news_items(config)

        self.assertEqual(result, [item])
        self.assertIs(item.publish_date, effective_date)
        self.assertTrue(item.is_pinned)
