import io
from pathlib import Path
from types import SimpleNamespace

from django.test import SimpleTestCase
from PIL import Image

from content_migration.legacy_news.extractor import extract_news_html
from content_migration.legacy_news.media import LegacyMediaImporter, placeholder_png
from content_migration.legacy_news.transformer import build_payload

FIXTURES = Path(__file__).parents[1] / "legacy_news" / "samples"


class LegacyNewsTransformerTests(SimpleTestCase):
    def setUp(self):
        html = (FIXTURES / "synthetic-edge-case.html").read_text(encoding="utf-8")
        self.article = extract_news_html(
            html,
            "https://www.eceee.org/__migration-fixtures__/synthetic-edge-case/",
            "synthetic-legacy-news-edge-case",
        )

    def test_builds_deterministic_content_and_table_widgets(self):
        media = {
            url: SimpleNamespace(id=index, file_url=f"https://media.example/{index}.png")
            for index, url in enumerate(self.article.image_urls, start=1)
        }
        first = build_payload(
            self.article,
            media_by_url=media,
            taxonomy={"sources": [self.article.source_name]},
        )
        second = build_payload(
            self.article,
            media_by_url=media,
            taxonomy={"sources": [self.article.source_name]},
        )

        self.assertEqual(first.widgets, second.widgets)
        self.assertEqual(
            [widget["type"] for widget in first.widgets["main"]],
            [
                "easy_widgets.ContentWidget",
                "easy_widgets.TableWidget",
                "easy_widgets.ContentWidget",
            ],
        )
        combined = str(first.widgets)
        self.assertIn("data-media-id", combined)
        self.assertNotIn("onclick", combined)
        self.assertEqual(first.data["summary"], self.article.summary)
        self.assertEqual(first.data["externalUrl"], "https://example.org/original")

    def test_placeholder_is_deterministic_and_informative_size(self):
        first = placeholder_png("https://legacy.example/missing/photo.jpg", "http-404")
        second = placeholder_png("https://legacy.example/missing/photo.jpg", "http-404")
        self.assertEqual(first, second)
        with Image.open(io.BytesIO(first)) as image:
            self.assertEqual(image.size, (1200, 675))
            self.assertEqual(image.format, "PNG")

    def test_placeholder_is_unique_per_source_url(self):
        first = placeholder_png("https://legacy.example/first/photo.jpg", "http-404")
        second = placeholder_png("https://legacy.example/second/photo.jpg", "http-404")

        self.assertNotEqual(first, second)

    def test_media_fetch_rejects_loopback_urls(self):
        with self.assertRaisesMessage(ValueError, "non-public-image-host"):
            LegacyMediaImporter._validate_remote_url("http://127.0.0.1/private.png")
