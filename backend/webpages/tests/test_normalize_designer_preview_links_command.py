from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase

from core.models import Tenant
from webpages.models import PageTheme, ThemeDesignerDraft, ThemeDesignerRevision, WebPage


class NormalizeDesignerPreviewLinksCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("preview-link-owner", password="test")
        self.tenant = Tenant.objects.create(
            name="Preview link tenant",
            identifier="preview-link-tenant",
            created_by=self.user,
        )
        self.root = WebPage.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
            title="Industry",
            slug="industry",
            hostnames=["industry.localhost"],
        )
        preview = {
            "views": [
                {
                    "id": "landing",
                    "content": {
                        "widgets": {
                            "navbar": [
                                {
                                    "config": {
                                        "link": {
                                            "type": "external",
                                            "url": "http://industry.localhost:10101/",
                                        }
                                    }
                                }
                            ]
                        }
                    },
                }
            ]
        }
        self.theme = PageTheme.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            name="Legacy preview links",
            designer_preview=preview,
        )
        self.draft = ThemeDesignerDraft.objects.create(
            theme=self.theme,
            created_by=self.user,
            updated_by=self.user,
            base_sync_version=self.theme.sync_version,
            snapshot={"designer_preview": preview},
            has_changes=True,
        )

    def _stored_link(self, preview):
        return preview["views"][0]["content"]["widgets"]["navbar"][0]["config"]["link"]

    def test_dry_run_reports_without_mutating(self):
        output = StringIO()

        call_command("normalize_designer_preview_links", theme_id=[self.theme.id], stdout=output)

        self.theme.refresh_from_db()
        self.draft.refresh_from_db()
        self.assertEqual(self._stored_link(self.theme.designer_preview)["type"], "external")
        self.assertEqual(self._stored_link(self.draft.snapshot["designer_preview"])["type"], "external")
        self.assertIn("Would update 1 live theme(s) and 1 draft(s)", output.getvalue())

    def test_apply_updates_live_and_draft_with_recovery_points(self):
        original_draft_version = self.draft.version

        call_command("normalize_designer_preview_links", theme_id=[self.theme.id], apply=True)

        self.theme.refresh_from_db()
        self.draft.refresh_from_db()
        for link in (
            self._stored_link(self.theme.designer_preview),
            self._stored_link(self.draft.snapshot["designer_preview"]),
        ):
            self.assertEqual(link["type"], "internal")
            self.assertEqual(link["path"], "/")
            self.assertEqual(link["siteHostname"], "industry.localhost")
            self.assertNotIn("url", link)
        self.assertEqual(self.draft.version, original_draft_version + 1)
        self.assertEqual(self.draft.base_sync_version, self.theme.sync_version)
        self.assertTrue(self.theme.versions.filter(name="Before normalizing Designer preview links").exists())
        self.assertTrue(
            ThemeDesignerRevision.objects.filter(
                theme=self.theme,
                summary="Before normalizing Designer preview links",
            ).exists()
        )
