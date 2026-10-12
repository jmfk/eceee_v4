from unittest.mock import patch

from bs4 import BeautifulSoup
from django.test import SimpleTestCase

from content_migration.legacy_news.extractor import extract_news_html
from content_migration.legacy_news.links import ExternalHeadChecker, LegacyNewsLinkRewriter
from content_migration.legacy_news.remote import HeadResponse, head_public_url
from content_migration.legacy_news.transformer import build_payload


class _StatusChecker:
    def __init__(self, statuses):
        self.statuses = statuses

    def status(self, url):
        return self.statuses[url]

    def prime(self, _urls):
        return None


class _HeadRequest:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    def __call__(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return next(self.responses)


class LegacyNewsLinkRewriterTests(SimpleTestCase):
    def test_rewrites_internal_targets_and_disables_missing_or_dead_links(self):
        article = extract_news_html(
            """
            <div class="mainContentColumn">
              <h1>Links</h1>
              <p>
                <a href="/known/?view=all#details" title="Known" target="_blank" class="cta" id="known">Known</a>
                <a href="/missing/" title="Missing" class="old">Missing</a>
                <a href="https://external.example/ok" title="External">External</a>
                <a href="https://external.example/gone" target="_blank">Gone</a>
                <a href="mailto:info@example.org">Mail</a>
              </p>
            </div>
            """,
            "https://www.eceee.org/all-news/news/news-2026/links/",
            "links",
        )
        checker = _StatusChecker(
            {
                "https://external.example/ok": "ok",
                "https://external.example/gone": "external-head-404",
            }
        )
        rewritten = LegacyNewsLinkRewriter(
            tenant=None,
            news_object_type=None,
            checker=checker,
            internal_targets={"/known/": "/new-place/"},
        ).rewrite(article)
        soup = BeautifulSoup(rewritten.body_html, "html.parser")

        known = soup.find(id="known")
        self.assertEqual(known.name, "a")
        self.assertEqual(known["href"], "/new-place/?view=all#details")
        self.assertEqual(known["title"], "Known")
        self.assertEqual(known["target"], "_blank")
        self.assertIn("cta", known["class"])

        missing = soup.find(string="Missing").parent
        self.assertEqual(missing.name, "span")
        self.assertEqual(missing["href"], "https://www.eceee.org/missing/")
        self.assertEqual(missing["title"], "Missing")
        self.assertIn("old", missing["class"])
        self.assertEqual(missing["data-legacy-link-status"], "missing-internal-target")

        self.assertEqual(soup.find(string="External").parent.name, "a")
        gone = soup.find(string="Gone").parent
        self.assertEqual(gone.name, "span")
        self.assertEqual(gone["href"], "https://external.example/gone")
        self.assertEqual(gone["target"], "_blank")
        self.assertEqual(gone["data-legacy-link-status"], "external-head-404")
        self.assertEqual(soup.find(string="Mail").parent.name, "a")
        self.assertNotEqual(rewritten.content_checksum, article.content_checksum)

    def test_disabled_link_survives_widget_cleaning_with_reparse_attributes(self):
        article = extract_news_html(
            '<div class="mainContentColumn"><h1>Missing</h1>'
            '<p><a href="/missing/" title="Try later">Missing</a></p></div>',
            "https://www.eceee.org/news/source/",
            "missing",
        )
        rewritten = LegacyNewsLinkRewriter(
            tenant=None,
            news_object_type=None,
            checker=_StatusChecker({}),
            internal_targets={},
        ).rewrite(article)

        payload = build_payload(rewritten, media_by_url={})
        content = payload.widgets["main"][0]["config"]["content"]

        self.assertIn('<span class="legacy-link-unresolved"', content)
        self.assertIn('href="https://www.eceee.org/missing/"', content)
        self.assertIn('title="Try later"', content)
        self.assertIn('data-legacy-link-status="missing-internal-target"', content)

    def test_top_level_live_and_disabled_links_keep_their_markup(self):
        article = extract_news_html(
            '<div class="mainContentColumn"><h1>Inline</h1>'
            '<a href="https://external.example/ok" title="Live">Live</a>'
            '<a href="/missing/" title="Missing">Missing</a></div>',
            "https://www.eceee.org/news/source/",
            "inline",
        )
        rewritten = LegacyNewsLinkRewriter(
            tenant=None,
            news_object_type=None,
            checker=_StatusChecker({"https://external.example/ok": "ok"}),
            internal_targets={},
        ).rewrite(article)

        payload = build_payload(rewritten, media_by_url={})
        content = payload.widgets["main"][0]["config"]["content"]

        self.assertIn('<a href="https://external.example/ok"', content)
        self.assertIn('<span class="legacy-link-unresolved"', content)
        self.assertIn('data-legacy-link-status="missing-internal-target"', content)


class ExternalHeadCheckerTests(SimpleTestCase):
    def test_follows_validated_redirects_and_requires_exact_200(self):
        request = _HeadRequest(
            [
                HeadResponse(302, {"location": "/final"}),
                HeadResponse(200, {}),
            ]
        )
        checker = ExternalHeadChecker(head_request=request)

        self.assertEqual(checker.status("https://external.example/start"), "ok")
        self.assertEqual(checker.status("https://external.example/start"), "ok")
        self.assertEqual(
            [call[0] for call in request.calls],
            ["https://external.example/start", "https://external.example/final"],
        )

    def test_non_200_is_not_a_live_link(self):
        checker = ExternalHeadChecker(head_request=_HeadRequest([HeadResponse(204, {})]))

        self.assertEqual(checker.status("https://external.example/no-content"), "external-head-204")

    @patch("content_migration.legacy_news.remote.http.client.HTTPConnection")
    @patch("content_migration.legacy_news.remote.socket.getaddrinfo")
    def test_public_head_connects_to_the_validated_address(self, getaddrinfo, connection_class):
        getaddrinfo.return_value = [(2, 1, 6, "", ("93.184.216.34", 80))]
        response = connection_class.return_value.getresponse.return_value
        response.status = 200
        response.getheaders.return_value = []

        result = head_public_url("http://external.example/research?source=legacy", timeout=3)

        self.assertEqual(result.status_code, 200)
        connection_class.assert_called_once_with("93.184.216.34", port=80, timeout=3)
        connection_class.return_value.request.assert_called_once_with(
            "HEAD",
            "/research?source=legacy",
            headers={
                "Host": "external.example",
                "User-Agent": "ECEEE-v4-Legacy-News-Migrator/1.0 (+https://www.eceee.org/)",
            },
        )
