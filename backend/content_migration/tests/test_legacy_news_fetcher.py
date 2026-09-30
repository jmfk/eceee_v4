from pathlib import Path
from unittest.mock import Mock

import requests
from django.test import SimpleTestCase

from content_migration.legacy_news.fetcher import USER_AGENT, ManifestFetcher


class LegacyNewsFetcherTests(SimpleTestCase):
    def test_rejects_non_eceee_remote_hosts(self):
        with self.assertRaisesMessage(ValueError, "outside the approved"):
            ManifestFetcher().fetch(url="https://example.org/article")

    def test_uses_identifiable_agent_and_bounded_retries(self):
        session = Mock()
        session.headers = {}
        failure = requests.ConnectionError("offline")
        session.get.side_effect = failure
        sleeps = []
        fetcher = ManifestFetcher(session=session, sleeper=sleeps.append, retries=2)

        with self.assertRaises(RuntimeError):
            fetcher.fetch(url="https://www.eceee.org/article")

        self.assertEqual(session.get.call_count, 3)
        self.assertEqual(session.headers["User-Agent"], USER_AGENT)
        self.assertEqual(sleeps, [1, 2])

    def test_fixture_read_does_not_use_network(self):
        session = Mock()
        session.headers = {}
        sample_dir = Path(__file__).parents[1] / "legacy_news" / "samples"
        html = ManifestFetcher(session=session).fetch(fixture="synthetic-edge-case.html", manifest_dir=sample_dir)
        self.assertIn("Synthetic legacy News", html)
        session.get.assert_not_called()
