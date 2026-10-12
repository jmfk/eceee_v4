from pathlib import Path

from django.test import SimpleTestCase

from content_migration.legacy_news.extractor import extract_news_html

FIXTURES = Path(__file__).parents[1] / "legacy_news" / "samples"


class LegacyNewsExtractorTests(SimpleTestCase):
    def test_extracts_only_article_content_and_semantic_fields(self):
        html = (FIXTURES / "synthetic-edge-case.html").read_text(encoding="utf-8")

        article = extract_news_html(
            html,
            "https://www.eceee.org/__migration-fixtures__/synthetic-edge-case/",
            "synthetic-legacy-news-edge-case",
        )

        self.assertEqual(article.title, "Synthetic legacy News migration edge case")
        self.assertEqual(article.source_name, "ECEEE migration fixture")
        self.assertEqual(article.source_date.isoformat(), "2026-09-30")
        self.assertTrue(article.summary.startswith("A labelled synthetic article"))
        self.assertEqual(article.external_url, "https://example.org/original")
        self.assertIn("<table>", article.body_html)
        self.assertIn("<ul>", article.body_html)
        self.assertIn('href="https://www.eceee.org/about-eceee/"', article.body_html)
        self.assertIn('rel="noopener noreferrer"', article.body_html)
        self.assertNotIn("share-on-social", article.body_html)
        self.assertNotIn("sidebar-promo", article.body_html)
        self.assertNotIn("link.gif", article.body_html)
        self.assertNotIn("onclick", article.body_html)
        self.assertNotIn("style=", article.body_html)
        self.assertNotIn("id=", article.body_html)
        self.assertEqual(len(article.image_urls), 2)

    def test_parses_empty_source_and_leaves_unparseable_date_nonfatal(self):
        html = """
          <div class="mainContentColumn">
            <h1>Old item</h1>
            <p class="news_intro">(, not a date) Summary text</p>
            <p>Body.</p>
          </div>
        """
        article = extract_news_html(html, "https://www.eceee.org/news/old/")
        self.assertEqual(article.source_name, "")
        self.assertIsNone(article.source_date)
        self.assertEqual(article.summary, "Summary text")

    def test_rejects_pages_without_the_content_boundary(self):
        with self.assertRaisesMessage(ValueError, ".mainContentColumn"):
            extract_news_html("<h1>Outside</h1>", "https://www.eceee.org/news/outside/")

    def test_source_checksum_ignores_dynamic_page_chrome(self):
        article_template = """
          <div class="mainContentColumn">
            <h1>Stable article</h1>
            <div class="share-on-social">{share_state}</div>
            <p>Stable body.</p>
          </div>
        """

        first_article = article_template.format(share_state="Share one")
        second_article = article_template.format(share_state="Share two")
        first_html = f'<html data-request="one"><nav>Dynamic one</nav>{first_article}</html>'
        second_html = f'<html data-request="two"><nav>Dynamic two</nav>{second_article}</html>'

        first = extract_news_html(first_html, "https://www.eceee.org/news/stable/")
        second = extract_news_html(second_html, "https://www.eceee.org/news/stable/")

        self.assertEqual(first.source_checksum, second.source_checksum)
        self.assertEqual(first.content_checksum, second.content_checksum)
