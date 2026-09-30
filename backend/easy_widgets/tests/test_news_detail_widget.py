from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from django.template.loader import render_to_string
from django.test import SimpleTestCase

from easy_widgets.widgets.news_detail import NewsDetailWidget
from easy_widgets.widgets.sidebar_top_news import SidebarTopNewsWidget


class NewsDetailWidgetRenderTests(SimpleTestCase):
    def test_summary_widgets_and_external_action_render_without_duplicate_body(self):
        now = datetime(2026, 9, 30, tzinfo=timezone.utc)
        article = SimpleNamespace(
            id=7,
            title="Golden article",
            object_type=SimpleNamespace(label="News"),
            created_at=now,
            updated_at=now,
        )
        version = SimpleNamespace(
            data={
                "summary": "Lead text",
                "presentationalPublishingDate": "2026-09-29",
                "content": "<p>Duplicate legacy scalar body</p>",
                "externalUrl": "https://example.org/source",
            },
            widgets={"main": [{"id": "body"}]},
            effective_date=now,
        )
        widget = NewsDetailWidget()
        with (
            patch.object(widget, "_get_news_object", return_value=(article, version)),
            patch.object(
                widget,
                "_render_object_widgets_from_version",
                return_value={"main": ["<p>Canonical widget body</p>"]},
            ),
        ):
            context = widget.prepare_template_context(
                {"objectTypes": [1]},
                {
                    "path_variables": {"news_slug": "golden-article"},
                    "renderer": object(),
                },
            )
        html = render_to_string(
            "easy_widgets/widgets/news_detail.html",
            {**context, "widget_type": widget},
        )

        self.assertIn("Lead text", html)
        self.assertIn("Canonical widget body", html)
        self.assertIn("Read the original source", html)
        self.assertNotIn("Duplicate legacy scalar body", html)

    def test_scalar_body_remains_a_backward_compatible_fallback(self):
        now = datetime(2026, 9, 30, tzinfo=timezone.utc)
        article = SimpleNamespace(
            id=8,
            title="Fallback article",
            object_type=SimpleNamespace(label="News"),
            created_at=now,
            updated_at=now,
        )
        version = SimpleNamespace(data={"content": "<p>Fallback body</p>"}, widgets={}, effective_date=now)
        widget = NewsDetailWidget()
        with patch.object(widget, "_get_news_object", return_value=(article, version)):
            context = widget.prepare_template_context(
                {"objectTypes": [1]}, {"path_variables": {"news_slug": "fallback"}}
            )
        html = render_to_string("easy_widgets/widgets/news_detail.html", {**context, "widget_type": widget})
        self.assertIn("Fallback body", html)


class NewsExcerptNormalizationTests(SimpleTestCase):
    def test_sidebar_prefers_summary_to_legacy_excerpt(self):
        excerpt = SidebarTopNewsWidget._get_excerpt({"summary": "Canonical summary", "excerpt": "Legacy excerpt"}, 120)
        self.assertEqual(excerpt, "Canonical summary")
