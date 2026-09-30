from datetime import datetime, timezone

from django.test import SimpleTestCase

from content_migration.legacy_news.database import LegacyDatabaseNews
from content_migration.legacy_news.transformer import LegacyNewsPayload
from content_migration.management.commands.migrate_legacy_news import Command


class _Database:
    def __init__(self, rows):
        self.rows = rows

    def iter_published(self, *, limit=None):
        yield from self.rows[:limit]


class MigrateLegacyNewsCommandTests(SimpleTestCase):
    def setUp(self):
        published_at = datetime(2026, 9, 30, 12, 0, tzinfo=timezone.utc)
        self.row = LegacyDatabaseNews(
            legacy_id=42,
            title="Legacy title",
            slug="legacy-title",
            summary="Legacy summary",
            content='<p>Body</p><img src="https://cdn.example/photo.jpg" alt="Photo">',
            presentational_publishing_date=published_at,
            source_date=published_at,
            publish_date=published_at,
            expiry_date=published_at,
            external_url="https://example.org/source",
            featured=True,
            taxonomy={
                "types": ["News"],
                "categories": ["Policy"],
                "sources": ["Example"],
                "topics": ["Efficiency"],
                "keywords": ["Buildings"],
            },
        )

    def test_database_source_date_is_serialized_as_date_only(self):
        payload = LegacyNewsPayload("Title", "slug", {}, {}, {})

        data = Command._database_payload_data(payload, self.row)

        self.assertEqual(data["sourceDate"], "2026-09-30")
        self.assertEqual(data["presentationalPublishingDate"], "2026-09-30T12:00:00+00:00")

    def test_database_dry_run_transforms_and_reconciles_rows(self):
        summary = {
            "published": 1,
            "with_expiry": 1,
            "featured": 1,
            "with_images": 1,
            "with_source_date": 1,
            "with_external_url": 1,
            "type_assignments": 1,
            "category_assignments": 1,
            "source_assignments": 1,
            "topic_assignments": 1,
            "keyword_assignments": 1,
        }

        Command()._reconcile_database_rows(_Database([self.row]), summary)
