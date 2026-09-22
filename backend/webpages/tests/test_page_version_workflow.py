from datetime import timedelta

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Tenant
from webpages.models import PageVersion, WebPage
from webpages.services.page_version_workflow import PageVersionWorkflowService


class PageVersionWorkflowTest(TestCase):
    def setUp(self):
        if connection.vendor == "sqlite":
            self.skipTest("ArrayField is not supported on SQLite")
        self.user = User.objects.create_user("workflow-user", password="test")
        self.tenant = Tenant.objects.create(name="Workflow tenant", identifier="workflow", created_by=self.user)
        self.page = WebPage.objects.create(
            title="Workflow page",
            slug="workflow-page",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def publish_initial(self):
        version = self.page.create_version(self.user, "Initial")
        version.page_data = {"title": "Live title", "description": "Live"}
        version.save()
        return PageVersionWorkflowService(self.page, self.user).publish(version)

    def test_working_copy_is_idempotent_and_does_not_change_live(self):
        live = self.publish_initial()
        service = PageVersionWorkflowService(self.page, self.user)

        first, created = service.get_or_create_working_copy()
        second, created_again = service.get_or_create_working_copy()

        self.assertTrue(created)
        self.assertFalse(created_again)
        self.assertEqual(first.id, second.id)
        self.assertIsNone(first.effective_date)
        self.page.refresh_from_db()
        self.assertEqual(self.page.current_published_version_id, live.id)

    def test_published_and_older_drafts_are_not_editable(self):
        live = self.publish_initial()
        older_draft = self.page.create_version(self.user, "Older draft")
        current_draft = self.page.create_version(self.user, "Current draft")

        for version in (live, older_draft):
            url = reverse("api:pageversion-save-working-copy", kwargs={"pk": version.pk})
            response = self.client.patch(
                url,
                {"clientUpdatedAt": version.updated_at.isoformat(), "metaTitle": "Changed"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        url = reverse("api:pageversion-save-working-copy", kwargs={"pk": current_draft.pk})
        response = self.client.patch(
            url,
            {
                "clientUpdatedAt": current_draft.updated_at.isoformat(),
                "metaTitle": "Safe change",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_stale_save_returns_conflict(self):
        draft = self.page.create_version(self.user, "Draft")
        observed_at = draft.updated_at
        draft.meta_title = "Other editor"
        draft.save()
        url = reverse("api:pageversion-save-working-copy", kwargs={"pk": draft.pk})

        response = self.client.patch(
            url,
            {"clientUpdatedAt": observed_at.isoformat(), "metaTitle": "Stale"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        draft.refresh_from_db()
        self.assertEqual(draft.meta_title, "Other editor")

    def test_publish_targets_only_the_explicit_canonical_working_copy(self):
        live = self.publish_initial()
        older_draft = self.page.create_version(self.user, "Older draft")
        working_draft = self.page.create_version(self.user, "Working draft")

        rejected = self.client.post(
            reverse("api:pageversion-publish", kwargs={"pk": older_draft.pk}),
            format="json",
        )
        published = self.client.post(
            reverse("api:pageversion-publish", kwargs={"pk": working_draft.pk}),
            format="json",
        )

        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(published.status_code, status.HTTP_200_OK)
        live.refresh_from_db()
        working_draft.refresh_from_db()
        self.assertIsNotNone(live.expiry_date)
        self.assertTrue(working_draft.is_current_published())

    def test_legacy_publishing_update_cannot_mutate_live_history(self):
        live = self.publish_initial()

        response = self.client.patch(
            reverse("api:pageversion-update-publishing", kwargs={"pk": live.pk}),
            {"expiryDate": (timezone.now() + timedelta(days=5)).isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        live.refresh_from_db()
        self.assertIsNone(live.expiry_date)

    def test_schedule_is_editable_and_second_schedule_is_rejected(self):
        draft = self.page.create_version(self.user, "Scheduled working copy")
        schedule_url = reverse("api:pageversion-schedule", kwargs={"pk": draft.pk})
        response = self.client.post(
            schedule_url,
            {"effectiveDate": (timezone.now() + timedelta(days=1)).isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        draft.refresh_from_db()

        save_url = reverse("api:pageversion-save-working-copy", kwargs={"pk": draft.pk})
        response = self.client.patch(
            save_url,
            {
                "clientUpdatedAt": draft.updated_at.isoformat(),
                "metaTitle": "Still editable",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        legacy_schedule = PageVersion.objects.create(
            page=self.page,
            version_number=draft.version_number + 1,
            version_title="Legacy second schedule",
            page_data={},
            widgets={},
            effective_date=timezone.now() + timedelta(days=2),
            created_by=self.user,
        )
        response = self.client.post(
            reverse("api:pageversion-schedule", kwargs={"pk": legacy_schedule.pk}),
            {"effectiveDate": (timezone.now() + timedelta(days=3)).isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error"], "schedule_conflict")

    def test_restore_copies_history_into_working_copy_only(self):
        live = self.publish_initial()
        draft, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        draft.page_data = {"title": "Work", "description": "Work"}
        draft.save()

        response = self.client.post(reverse("api:pageversion-restore", kwargs={"pk": live.pk}), format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        draft.refresh_from_db()
        self.page.refresh_from_db()
        self.assertEqual(draft.page_data["title"], "Live title")
        self.assertEqual(self.page.current_published_version_id, live.id)

    def test_unpublish_expires_live_without_creating_draft(self):
        live = self.publish_initial()
        count_before = self.page.versions.count()

        response = self.client.post(
            reverse("api:page-unpublish-explicit", kwargs={"page_id": self.page.pk}),
            {"versionId": live.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        live.refresh_from_db()
        self.page.refresh_from_db()
        self.assertIsNotNone(live.expiry_date)
        self.assertEqual(self.page.versions.count(), count_before)
        self.assertIsNone(self.page.current_published_version_id)

    def test_bulk_publish_stops_a_working_copy_changed_after_review(self):
        draft = self.page.create_version(self.user, "Reviewed draft")
        observed_at = draft.updated_at
        draft.meta_title = "Changed after review"
        draft.save()

        response = self.client.post(
            reverse("api:pageversion-bulk-publish-explicit"),
            {
                "items": [
                    {
                        "pageId": self.page.id,
                        "versionId": draft.id,
                        "clientUpdatedAt": observed_at.isoformat(),
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_207_MULTI_STATUS)
        self.assertFalse(response.data["atomic"])
        self.assertEqual(response.data["results"][0]["error"], "version_conflict")
        draft.refresh_from_db()
        self.assertIsNone(draft.effective_date)

    def test_workflow_reports_legacy_conflicts(self):
        self.page.create_version(self.user, "Old draft")
        latest = self.page.create_version(self.user, "Working draft")
        PageVersion.objects.create(
            page=self.page,
            version_number=latest.version_number + 1,
            version_title="Schedule one",
            page_data={},
            widgets={},
            effective_date=timezone.now() + timedelta(days=1),
            created_by=self.user,
        )
        PageVersion.objects.create(
            page=self.page,
            version_number=latest.version_number + 2,
            version_title="Schedule two",
            page_data={},
            widgets={},
            effective_date=timezone.now() + timedelta(days=2),
            created_by=self.user,
        )

        response = self.client.get(reverse("api:page-version-workflow", kwargs={"page_id": self.page.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["legacy_conflicts"]["additional_scheduled_count"], 1)
        self.assertGreaterEqual(response.data["legacy_conflicts"]["older_draft_count"], 2)

    def test_pages_list_and_editor_workflow_use_the_same_aggregate_state(self):
        self.publish_initial()
        self.page.create_version(self.user, "Unpublished changes")
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])

        workflow_response = self.client.get(reverse("api:page-version-workflow", kwargs={"page_id": self.page.pk}))
        pages_response = self.client.get(reverse("api:webpage-list"))
        pages = pages_response.data.get("results", pages_response.data)
        listed_page = next(page for page in pages if page["id"] == self.page.id)

        self.assertEqual(workflow_response.status_code, status.HTTP_200_OK)
        self.assertEqual(pages_response.status_code, status.HTTP_200_OK)
        self.assertEqual(listed_page["workflow_state"], workflow_response.data["state"])
