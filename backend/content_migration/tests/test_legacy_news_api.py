import json
from unittest.mock import patch

from django.test import SimpleTestCase

from content_migration.legacy_news.api import LegacyMigrationApiError, LegacyNewsApi
from content_migration.legacy_news.remote import GetResponse


def response(payload, status=200, content_type="application/json"):
    return GetResponse(
        status_code=status,
        headers={"content-type": content_type},
        content=json.dumps(payload).encode(),
    )


class LegacyNewsApiTests(SimpleTestCase):
    def test_requires_https_and_an_access_key(self):
        with self.assertRaises(LegacyMigrationApiError):
            LegacyNewsApi(base_url="http://legacy.example/api/migration/v1", token="secret")
        with self.assertRaises(LegacyMigrationApiError):
            LegacyNewsApi(base_url="https://legacy.example/api/migration/v1", token="")
        with self.assertRaises(LegacyMigrationApiError):
            LegacyNewsApi(base_url="https://legacy.example/api/migration/v1", token=123)

    @patch("content_migration.legacy_news.api.get_public_json")
    def test_summary_normalizes_the_source_contract(self, get):
        get.return_value = response(
            {
                "apiVersion": "1",
                "summary": {"published": 10, "withExpiry": 2, "typeAssignments": 4},
            }
        )
        api = LegacyNewsApi(base_url="https://legacy.example/api/migration/v1", token="secret")

        summary = api.summary()

        self.assertEqual(summary, {"published": 10, "with_expiry": 2, "type_assignments": 4})
        self.assertEqual(get.call_args.kwargs["authorization"], "Bearer secret")

    @patch("content_migration.legacy_news.api.get_public_json")
    def test_iterates_bounded_pages_and_maps_news(self, get):
        item = {
            "legacyId": 42,
            "title": "News",
            "slug": "news",
            "summary": "Summary",
            "content": "<p>Body</p>",
            "presentationalPublishingDate": "2026-10-14T12:00:00+00:00",
            "sourceDate": None,
            "publishDate": None,
            "expiryDate": None,
            "externalUrl": "",
            "featured": True,
            "taxonomy": {"types": ["Type"]},
        }
        get.side_effect = [
            response({"apiVersion": "1", "results": [item], "nextCursor": "1"}),
            response({"apiVersion": "1", "results": [], "nextCursor": None}),
        ]
        api = LegacyNewsApi(base_url="https://legacy.example/api/migration/v1", token="secret")

        rows = list(api.iter_published(newest_first=True))

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].legacy_id, 42)
        self.assertEqual(rows[0].taxonomy["types"], ["Type"])
        self.assertEqual(get.call_count, 2)

    @patch("content_migration.legacy_news.api.get_public_json")
    def test_rejects_redirects_and_incompatible_versions(self, get):
        api = LegacyNewsApi(base_url="https://legacy.example/api/migration/v1", token="secret")
        get.return_value = response({}, status=302)
        with self.assertRaises(LegacyMigrationApiError):
            api.health()

        get.return_value = response({"apiVersion": "2"})
        with self.assertRaises(LegacyMigrationApiError):
            api.health()

    @patch("content_migration.legacy_news.api.get_public_json")
    def test_rejects_oversized_pages_and_repeated_cursors(self, get):
        api = LegacyNewsApi(base_url="https://legacy.example/api/migration/v1", token="secret")
        get.return_value = response({"apiVersion": "1", "results": [{}, {}], "nextCursor": None})
        with self.assertRaises(LegacyMigrationApiError):
            list(api.iter_published(limit=1))

        item = {
            "legacyId": 42,
            "title": "News",
            "slug": "news",
            "taxonomy": {},
        }
        get.side_effect = [
            response({"apiVersion": "1", "results": [item], "nextCursor": "same"}),
            response({"apiVersion": "1", "results": [item], "nextCursor": "same"}),
        ]
        with self.assertRaises(LegacyMigrationApiError):
            list(api.iter_published())

    def test_rejects_invalid_news_field_types(self):
        valid = {
            "legacyId": 42,
            "title": "News",
            "slug": "news",
            "featured": False,
            "taxonomy": {},
        }

        for invalid in (
            {**valid, "legacyId": True},
            {key: value for key, value in valid.items() if key != "slug"},
            {**valid, "title": None},
            {**valid, "featured": "false"},
            {**valid, "presentationalPublishingDate": 123},
            {**valid, "taxonomy": {"types": "Type"}},
        ):
            with self.subTest(invalid=invalid):
                with self.assertRaises(LegacyMigrationApiError):
                    LegacyNewsApi._news(invalid)
