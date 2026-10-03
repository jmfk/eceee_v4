from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from content.models import Namespace
from core.models import Tenant
from webpages.models import WebPage
from webpages.services.page_version_workflow import PageVersionWorkflowService


class ProcessImportVersionSafetyTest(TestCase):
    def setUp(self):
        if connection.vendor == "sqlite":
            self.skipTest("ArrayField is not supported on SQLite")

        self.user = User.objects.create_user("import-user", password="test")
        self.tenant = Tenant.objects.create(
            name="Import tenant",
            identifier="import-tenant",
            created_by=self.user,
        )
        self.namespace = Namespace.objects.create(
            name="Import namespace",
            slug="import-namespace",
            is_default=True,
            created_by=self.user,
            tenant=self.tenant,
        )
        self.page = WebPage.objects.create(
            title="Published title",
            slug="published-page",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        draft = self.page.create_version(self.user, "Published title")
        draft.page_data = {"page_attributes": {"title": "Published title"}}
        draft.save()
        self.live = PageVersionWorkflowService(self.page, self.user).publish(draft)

        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)

    @patch("content_import.views.process.create_widgets", return_value=[])
    @patch("content_import.views.process.ContentParser.parse", return_value=[])
    @patch("content_import.views.process.identify_content_types", return_value={})
    def test_metadata_import_updates_working_copy_without_rewriting_live_version(
        self,
        _identify_content_types,
        _parse,
        _create_widgets,
    ):
        with patch("webpages.consumers.broadcast_version_update") as broadcast:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.post(
                    reverse("api:content_import:process"),
                    {
                        "html": "<p>Imported content</p>",
                        "uploaded_media_urls": [],
                        "slot_name": "main_content",
                        "page_id": self.page.pk,
                        "mode": "replace",
                        "namespace": self.namespace.slug,
                        "page_metadata": {
                            "title": "Imported working title",
                            "tags": [],
                            "saveToPage": True,
                        },
                    },
                    format="json",
                )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["page_was_updated"])

        self.live.refresh_from_db()
        self.page.refresh_from_db()
        self.assertEqual(self.live.version_title, "Published title")
        self.assertEqual(
            self.live.page_data,
            {"page_attributes": {"title": "Published title"}},
        )
        self.assertEqual(self.page.title, "Published title")

        working = self.page.versions.get(effective_date__isnull=True)
        self.assertEqual(working.version_title, "Imported working title")
        self.assertEqual(
            working.page_data["page_attributes"]["title"],
            "Imported working title",
        )
        self.assertEqual(working.edit_revision, 2)
        self.assertEqual(working.last_edited_by, self.user)
        broadcast.assert_called_once()
        self.assertEqual(broadcast.call_args.kwargs["revision"], 2)
        self.assertEqual(broadcast.call_args.kwargs["mutation_type"], "content_import")

        stale_response = self.client.patch(
            reverse("api:page-working-copy-save", kwargs={"page_id": self.page.pk}),
            {
                "expectedVersionId": working.id,
                "expectedRevision": 1,
                "versionTitle": "Stale editor title",
            },
            format="json",
        )

        self.assertEqual(stale_response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(stale_response.data["error"], "version_conflict")
        working.refresh_from_db()
        self.assertEqual(working.version_title, "Imported working title")
