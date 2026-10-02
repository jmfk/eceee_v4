from django.contrib.auth import get_user_model
from django.test import TestCase

from content_migration.legacy_news.preview import PREVIEW_HOSTNAME, ensure_news_preview_page
from core.models import Tenant
from webpages.models import WebPage


class LegacyNewsPreviewTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="legacy-news-preview")
        self.tenant = Tenant.objects.create(
            name="Legacy News Preview",
            identifier="legacy-news-preview",
            created_by=self.user,
        )

    def test_creates_routable_preview_hierarchy_idempotently(self):
        detail = ensure_news_preview_page(tenant=self.tenant, user=self.user, news_object_type_id=42)

        self.assertEqual(detail.slug, "news")
        self.assertEqual(detail.path_pattern_key, "news_slug")
        self.assertEqual(detail.parent.slug, "migration-preview")
        self.assertEqual(detail.parent.parent.slug, "migration-preview-site")
        self.assertEqual(detail.parent.parent.hostnames, [PREVIEW_HOSTNAME])
        version = detail.get_current_published_version()
        self.assertIsNotNone(version)
        self.assertEqual(
            version.widgets["main"][0]["config"]["emptyMessage"],
            "Select a golden sample by opening its article slug under this preview URL.",
        )

        repeated = ensure_news_preview_page(tenant=self.tenant, user=self.user, news_object_type_id=42)

        self.assertEqual(repeated.pk, detail.pk)
        self.assertEqual(WebPage.objects.filter(tenant=self.tenant, is_deleted=False).count(), 3)

    def test_reparents_the_original_hostname_less_preview_root(self):
        legacy_root = WebPage.objects.create(
            tenant=self.tenant,
            parent=None,
            slug="migration-preview",
            title="Migration preview",
            created_by=self.user,
            last_modified_by=self.user,
            hostnames=[],
        )

        detail = ensure_news_preview_page(tenant=self.tenant, user=self.user, news_object_type_id=42)

        legacy_root.refresh_from_db()
        self.assertEqual(detail.parent_id, legacy_root.pk)
        self.assertEqual(legacy_root.parent.slug, "migration-preview-site")
        self.assertEqual(legacy_root.hostnames, [])
