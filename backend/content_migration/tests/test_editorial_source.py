from unittest.mock import patch

from django.test import SimpleTestCase

from content_migration.legacy_content.source import RESOURCES, EditorialSource
from content_migration.legacy_news.api import LegacyMigrationApiError

from .test_editorial_import import record


class EditorialSourceTests(SimpleTestCase):
    def setUp(self):
        self.source = EditorialSource(base_url="https://legacy.example/api/migration/v1/", token="test-only")

    def page(self, rows, cursor=None, site=2):
        return {"contentContract": "1", "sourceSite": site, "results": rows, "nextCursor": cursor}

    def test_resource_discovery_keeps_old_news_api_separate(self):
        self.assertEqual(self.source.available({"resources": ["news"]}), set())
        self.assertEqual(
            self.source.available({"contentContract": "1", "contentResources": list(RESOURCES)}), set(RESOURCES)
        )
        with self.assertRaises(LegacyMigrationApiError):
            self.source.available({"contentContract": "1", "contentResources": ["accounts"]})

    @patch.object(EditorialSource, "_request")
    def test_counts_include_unpublished_inventory_without_fetching_the_records(self, request):
        request.return_value = {
            "contentContract": "1",
            "sourceSite": 2,
            "summary": {"total": 9, "published": 7, "excludedUnpublished": 2},
        }
        self.assertEqual(
            self.source.content_summary("events"),
            {"sourceSite": 2, "total": 9, "published": 7, "excludedUnpublished": 2},
        )
        request.assert_called_once_with("content/events/summary/")
        request.return_value["summary"]["total"] = 8
        with self.assertRaisesRegex(LegacyMigrationApiError, "reconcile"):
            self.source.content_summary("events")

    @patch.object(EditorialSource, "_request")
    def test_sample_limit_and_cursor_are_sent_to_the_same_resource(self, request):
        request.side_effect = [self.page([record(pk=3)], "next"), self.page([record(pk=2)])]
        self.assertEqual([row["legacyId"] for row in self.source.iter_content("news", limit=2)], [3, 2])
        self.assertEqual(request.call_args_list[0].kwargs["params"]["limit"], 2)
        self.assertEqual(
            request.call_args_list[1].kwargs["params"], {"limit": 1, "newestFirst": "true", "cursor": "next"}
        )

    @patch.object(EditorialSource, "_request")
    def test_duplicate_or_out_of_order_records_fail_before_staging(self, request):
        for second in [3, 4]:
            request.side_effect = [self.page([record(pk=3)], "next"), self.page([record(pk=second)])]
            with self.assertRaises(LegacyMigrationApiError):
                list(self.source.iter_content("news"))

    @patch.object(EditorialSource, "_request")
    def test_mixed_sites_are_rejected_even_if_the_endpoint_is_unchanged(self, request):
        request.side_effect = [self.page([record(pk=3)], "next"), self.page([record(pk=2, sourceSite=9)], site=9)]
        with self.assertRaisesRegex(LegacyMigrationApiError, "source site"):
            list(self.source.iter_content("news"))

    @patch.object(EditorialSource, "_request")
    def test_dependency_selection_cannot_expand_to_other_columnists(self, request):
        request.return_value = self.page([record("columnists", pk=9)])
        with self.assertRaises(LegacyMigrationApiError):
            list(self.source.iter_content("columnists", ids=[1]))
        request.assert_called_once_with("content/columnists/", params={"limit": 500, "newestFirst": "true", "ids": "1"})

    @patch.object(EditorialSource, "_request")
    def test_invalid_selections_are_rejected_without_a_request(self, request):
        for options in [{"limit": 0}, {"limit": True}, {"ids": [1]}, {"ids": []}]:
            with self.assertRaises(ValueError):
                list(self.source.iter_content("news", **options))
        request.assert_not_called()
