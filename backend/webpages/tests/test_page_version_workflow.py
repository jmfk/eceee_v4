from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Tenant
from webpages.models import PageDataSchema, PageTheme, PageVersion, WebPage
from webpages.services.page_version_workflow import PageVersionWorkflowService
from webpages.tasks import refresh_publication_caches


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
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)

    def publish_initial(self):
        version = self.page.create_version(self.user, "Initial")
        version.page_data = {"title": "Live title", "description": "Live"}
        version.save()
        return PageVersionWorkflowService(self.page, self.user).publish(version)

    def make_page_child(self):
        parent = WebPage.objects.create(
            title="Parent",
            slug="parent",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.page.parent = parent
        self.page.save()
        return parent

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

    def test_unrelated_user_cannot_open_tenant_working_copy(self):
        draft = self.page.create_version(self.user, "Shared draft")
        unrelated_user = User.objects.create_user("workflow-unrelated", password="test")
        self.client.force_authenticate(unrelated_user)

        response = self.client.get(reverse("api:pageversion-detail", kwargs={"pk": draft.pk}))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenant_member_can_open_working_copy_without_being_creator(self):
        member = User.objects.create_user("workflow-member", password="test")
        self.tenant.members.add(member)
        draft = self.page.create_version(self.user, "Shared draft")
        self.client.force_authenticate(member)

        response = self.client.get(reverse("api:pageversion-detail", kwargs={"pk": draft.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_current_version_read_does_not_create_a_draft(self):
        before = self.page.versions.count()

        response = self.client.get(reverse("api:page-current-version", kwargs={"page_id": self.page.pk}))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.page.versions.count(), before)

    def test_save_rejects_moving_a_working_copy_to_another_page(self):
        draft = self.page.create_version(self.user, "Draft")
        other_page = WebPage.objects.create(
            title="Other",
            slug="other",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

        response = self.client.patch(
            reverse("api:pageversion-save-working-copy", kwargs={"pk": draft.pk}),
            {
                "clientUpdatedAt": draft.updated_at.isoformat(),
                "page": other_page.pk,
                "versionTitle": "Moved",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "immutable_field")
        draft.refresh_from_db()
        self.assertEqual(draft.page_id, self.page.pk)

    def test_save_accepts_theme_from_the_page_tenant(self):
        draft = self.page.create_version(self.user, "Draft")
        theme = PageTheme.objects.create(
            name="Workflow theme",
            tenant=self.tenant,
            created_by=self.user,
        )

        response = self.client.patch(
            reverse("api:pageversion-save-working-copy", kwargs={"pk": draft.pk}),
            {
                "clientUpdatedAt": draft.updated_at.isoformat(),
                "theme": theme.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        draft.refresh_from_db()
        self.assertEqual(draft.theme_id, theme.pk)

    def test_save_rejects_theme_from_another_tenant(self):
        draft = self.page.create_version(self.user, "Draft")
        other_tenant = Tenant.objects.create(
            name="Other workflow tenant",
            identifier="other-workflow",
            created_by=self.user,
        )
        other_theme = PageTheme.objects.create(
            name="Private theme",
            tenant=other_tenant,
            created_by=self.user,
        )

        response = self.client.patch(
            reverse("api:pageversion-save-working-copy", kwargs={"pk": draft.pk}),
            {
                "clientUpdatedAt": draft.updated_at.isoformat(),
                "theme": other_theme.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("theme", response.data)
        draft.refresh_from_db()
        self.assertIsNone(draft.theme_id)

    def test_bulk_delete_cannot_mutate_another_tenant(self):
        other_user = User.objects.create_user("bulk-delete-other", password="test")
        other_tenant = Tenant.objects.create(
            name="Bulk delete other tenant",
            identifier="bulk-delete-other",
            created_by=other_user,
        )
        other_page = WebPage.objects.create(
            title="Other tenant page",
            slug="other-tenant-page",
            tenant=other_tenant,
            created_by=other_user,
            last_modified_by=other_user,
        )

        response = self.client.post(
            reverse("api:webpage-bulk-delete"),
            {"pageIds": [other_page.pk]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        other_page.refresh_from_db()
        self.assertFalse(other_page.is_deleted)

    def test_bulk_move_cannot_use_pages_or_parents_from_another_tenant(self):
        own_parent = WebPage.objects.create(
            title="Own parent",
            slug="own-parent",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        other_user = User.objects.create_user("bulk-move-other", password="test")
        other_tenant = Tenant.objects.create(
            name="Bulk move other tenant",
            identifier="bulk-move-other",
            created_by=other_user,
        )
        other_page = WebPage.objects.create(
            title="Other movable page",
            slug="other-movable-page",
            tenant=other_tenant,
            created_by=other_user,
            last_modified_by=other_user,
        )

        foreign_page_response = self.client.post(
            reverse("api:webpage-bulk-move"),
            {"pageIds": [other_page.pk], "parentId": own_parent.pk},
            format="json",
        )
        foreign_parent_response = self.client.post(
            reverse("api:webpage-bulk-move"),
            {"pageIds": [self.page.pk], "parentId": other_page.pk},
            format="json",
        )

        self.assertEqual(foreign_page_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(foreign_parent_response.status_code, status.HTTP_404_NOT_FOUND)
        self.page.refresh_from_db()
        other_page.refresh_from_db()
        self.assertIsNone(self.page.parent_id)
        self.assertIsNone(other_page.parent_id)

    def test_page_parent_cannot_cross_the_selected_tenant(self):
        other_user = User.objects.create_user("parent-other", password="test")
        other_tenant = Tenant.objects.create(
            name="Parent other tenant",
            identifier="parent-other",
            created_by=other_user,
        )
        other_parent = WebPage.objects.create(
            title="Other parent",
            slug="other-parent",
            tenant=other_tenant,
            created_by=other_user,
            last_modified_by=other_user,
        )

        create_response = self.client.post(
            reverse("api:webpage-list"),
            {"title": "Cross-tenant child", "slug": "cross-tenant-child", "parentId": other_parent.pk},
            format="json",
        )
        update_response = self.client.patch(
            reverse("api:webpage-detail", kwargs={"pk": self.page.pk}),
            {"parentId": other_parent.pk},
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(update_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.page.refresh_from_db()
        self.assertIsNone(self.page.parent_id)

    def test_theme_api_is_scoped_to_the_selected_tenant(self):
        own_theme = PageTheme.objects.create(
            name="Own theme",
            tenant=self.tenant,
            created_by=self.user,
        )
        other_user = User.objects.create_user("theme-api-other", password="test")
        other_tenant = Tenant.objects.create(
            name="Theme API other tenant",
            identifier="theme-api-other",
            created_by=other_user,
        )
        other_theme = PageTheme.objects.create(
            name="Other theme",
            tenant=other_tenant,
            created_by=other_user,
        )

        list_response = self.client.get(reverse("api:pagetheme-list"))
        themes = (
            list_response.data.get("results", list_response.data)
            if isinstance(list_response.data, dict)
            else list_response.data
        )
        retrieve_response = self.client.get(reverse("api:pagetheme-detail", kwargs={"pk": other_theme.pk}))
        update_response = self.client.patch(
            reverse("api:pagetheme-detail", kwargs={"pk": other_theme.pk}),
            {"name": "Changed across tenant"},
            format="json",
        )
        delete_response = self.client.delete(reverse("api:pagetheme-detail", kwargs={"pk": other_theme.pk}))

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual([theme["id"] for theme in themes], [own_theme.pk])
        self.assertEqual(retrieve_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)
        other_theme.refresh_from_db()
        self.assertEqual(other_theme.name, "Other theme")

    def test_theme_create_assigns_the_selected_tenant(self):
        response = self.client.post(
            reverse("api:pagetheme-list"),
            {"name": "Created theme"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        theme = PageTheme.objects.get(pk=response.data["id"])
        self.assertEqual(theme.tenant_id, self.tenant.id)

    def test_default_theme_resolution_stays_inside_the_page_tenant(self):
        own_theme = PageTheme.objects.create(
            name="Own default",
            tenant=self.tenant,
            created_by=self.user,
            is_default=True,
        )
        other_tenant = Tenant.objects.create(
            name="Other default tenant",
            identifier="other-default-tenant",
            created_by=self.user,
        )
        other_theme = PageTheme.objects.create(
            name="Other default",
            tenant=other_tenant,
            created_by=self.user,
            is_default=True,
        )

        resolved = self.page.get_effective_theme()

        self.assertEqual(resolved, own_theme)
        other_theme.refresh_from_db()
        self.assertTrue(other_theme.is_default)

    def test_create_default_themes_uses_the_selected_tenant_and_user(self):
        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])

        response = self.client.post(reverse("api:pagetheme-create-defaults"), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        created_ids = [theme["id"] for theme in response.data["themes"]]
        self.assertTrue(created_ids)
        self.assertFalse(PageTheme.objects.filter(pk__in=created_ids).exclude(tenant=self.tenant).exists())
        self.assertFalse(PageTheme.objects.filter(pk__in=created_ids).exclude(created_by=self.user).exists())

    def test_theme_import_rejects_an_unrelated_tenant(self):
        other_user = User.objects.create_user("theme-import-other", password="test")
        other_tenant = Tenant.objects.create(
            name="Theme import other tenant",
            identifier="theme-import-other",
            created_by=other_user,
        )
        self.client.credentials(HTTP_X_TENANT_ID=other_tenant.identifier)

        response = self.client.post(reverse("api:pagetheme-import-theme"), {}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_page_status_and_hostnames_are_scoped_to_the_selected_tenant(self):
        self.page.hostnames = ["own.example"]
        self.page.save(update_fields=["hostnames", "updated_at"])
        other_user = User.objects.create_user("page-summary-other", password="test")
        other_tenant = Tenant.objects.create(
            name="Page summary other tenant",
            identifier="page-summary-other",
            created_by=other_user,
        )
        WebPage.objects.create(
            title="Other root",
            slug="other-root",
            hostnames=["other.example"],
            tenant=other_tenant,
            created_by=other_user,
            last_modified_by=other_user,
        )

        hostnames_response = self.client.get(reverse("api:webpage-hostnames"))
        status_response = self.client.get(reverse("api:webpage-publication-status"))

        self.assertEqual(hostnames_response.status_code, status.HTTP_200_OK)
        self.assertEqual(hostnames_response.data, ["own.example"])
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        self.assertEqual(status_response.data["total_pages"], 1)

    def test_duplicate_keeps_the_source_tenant(self):
        response = self.client.post(reverse("api:webpage-duplicate", kwargs={"pk": self.page.pk}), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        duplicate = WebPage.objects.get(pk=response.data["page"]["id"])
        self.assertEqual(duplicate.tenant_id, self.tenant.id)

    def test_root_page_creation_and_duplication_do_not_reorder_another_tenant(self):
        other_tenant = Tenant.objects.create(
            name="Root ordering other tenant",
            identifier="root-ordering-other",
            created_by=self.user,
        )
        other_root = WebPage.objects.create(
            title="Other ordered root",
            slug="other-ordered-root",
            sort_order=77,
            tenant=other_tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

        create_response = self.client.post(
            reverse("api:webpage-list"),
            {"title": "New own root", "slug": "new-own-root"},
            format="json",
        )
        duplicate_response = self.client.post(
            reverse("api:webpage-duplicate", kwargs={"pk": self.page.pk}),
            {},
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(duplicate_response.status_code, status.HTTP_201_CREATED)
        other_root.refresh_from_db()
        self.assertEqual(other_root.sort_order, 77)

    def test_model_restore_creates_a_working_copy_without_changing_live_page(self):
        historical = self.page.create_version(self.user, "Historical")
        historical.page_data = {"title": "Historical title", "description": "Old"}
        historical.save()
        PageVersionWorkflowService(self.page, self.user).publish(historical)
        current, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        current.page_data = {"title": "Current title", "description": "Current"}
        current.save()
        PageVersionWorkflowService(self.page, self.user).publish(current)

        restored = historical.restore(self.user)

        self.page.refresh_from_db()
        restored.refresh_from_db()
        self.assertEqual(self.page.current_published_version_id, current.id)
        self.assertEqual(self.page.title, "Current title")
        self.assertIsNone(restored.effective_date)
        self.assertEqual(restored.page_data["title"], "Historical title")

    def test_legacy_version_mutation_endpoint_is_gone(self):
        draft = self.page.create_version(self.user, "Draft")

        response = self.client.patch(
            reverse("api:pageversion-detail", kwargs={"pk": draft.pk}),
            {"versionTitle": "Bypass"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response.data["error"], "working_copy_save_required")

    def test_unrelated_user_cannot_schedule_tenant_page_through_legacy_api(self):
        unrelated_user = User.objects.create_user("page-workflow-unrelated", password="test")
        self.client.force_authenticate(unrelated_user)

        response = self.client.post(
            reverse("api:webpage-schedule", kwargs={"pk": self.page.pk}),
            {"effectiveDate": (timezone.now() + timedelta(days=1)).isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_410_GONE)

    def test_scheduled_version_refreshes_the_publication_cache_when_due(self):
        live = self.publish_initial()
        draft, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        draft.page_data = {
            **draft.page_data,
            "page_attributes": {"title": "Scheduled title", "slug": "scheduled-page"},
        }
        draft.save(update_fields=["page_data", "updated_at"])
        scheduled_at = timezone.now() + timedelta(hours=1)
        PageVersionWorkflowService(self.page, self.user).schedule(draft, scheduled_at)

        self.page.refresh_from_db()
        self.assertEqual(self.page.current_published_version_id, live.id)

        updated_count = refresh_publication_caches(now=scheduled_at + timedelta(seconds=1))

        self.page.refresh_from_db()
        self.assertEqual(updated_count, 1)
        self.assertEqual(self.page.current_published_version_id, draft.id)
        self.assertEqual(self.page.title, "Scheduled title")
        self.assertEqual(self.page.slug, "scheduled-page")

    def test_scheduled_expiry_does_not_restore_the_previous_live_version(self):
        live = self.publish_initial()
        draft, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        scheduled_at = timezone.now() + timedelta(hours=1)
        expires_at = scheduled_at + timedelta(hours=1)

        PageVersionWorkflowService(self.page, self.user).schedule(draft, scheduled_at, expires_at)

        live.refresh_from_db()
        self.assertEqual(live.expiry_date, scheduled_at)
        refresh_publication_caches(now=scheduled_at + timedelta(seconds=1))
        refresh_publication_caches(now=expires_at + timedelta(seconds=1))
        self.page.refresh_from_db()
        self.assertIsNone(self.page.current_published_version_id)
        self.assertFalse(self.page.is_currently_published)

    def test_cancel_schedule_restores_the_previous_live_expiry(self):
        live = self.publish_initial()
        draft, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        scheduled_at = timezone.now() + timedelta(hours=1)
        service = PageVersionWorkflowService(self.page, self.user)
        service.schedule(draft, scheduled_at)

        service.cancel_schedule(draft)

        live.refresh_from_db()
        draft.refresh_from_db()
        self.assertIsNone(live.expiry_date)
        self.assertIsNone(draft.effective_date)
        self.assertNotIn(service.SCHEDULE_PREDECESSOR_KEY, draft.change_summary)

    def test_restore_into_scheduled_copy_preserves_cancel_metadata(self):
        live = self.publish_initial()
        draft, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        historical = self.page.create_version(self.user, "Historical content")
        scheduled_at = timezone.now() + timedelta(hours=1)
        service = PageVersionWorkflowService(self.page, self.user)
        service.schedule(historical, scheduled_at)

        restored = service.restore_as_working_copy(
            live,
            expected_updated_at=historical.updated_at,
        )
        service.cancel_schedule(restored)

        live.refresh_from_db()
        restored.refresh_from_db()
        self.assertIsNone(live.expiry_date)
        self.assertIsNone(restored.effective_date)
        self.assertNotIn(service.SCHEDULE_PREDECESSOR_KEY, restored.change_summary)

    def test_expired_version_is_removed_from_the_publication_cache(self):
        live = self.publish_initial()
        expires_at = timezone.now() + timedelta(hours=1)
        live.expiry_date = expires_at
        live.save(update_fields=["expiry_date"])

        self.page.refresh_from_db()
        self.assertEqual(self.page.current_published_version_id, live.id)

        updated_count = refresh_publication_caches(now=expires_at + timedelta(seconds=1))

        self.page.refresh_from_db()
        self.assertEqual(updated_count, 1)
        self.assertIsNone(self.page.current_published_version_id)
        self.assertFalse(self.page.is_currently_published)

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
        self.assertEqual(response.data["details"]["server_version"]["id"], draft.id)
        draft.refresh_from_db()
        self.assertEqual(draft.meta_title, "Other editor")

    def test_future_timestamp_does_not_bypass_save_conflict(self):
        draft = self.page.create_version(self.user, "Draft")
        url = reverse("api:pageversion-save-working-copy", kwargs={"pk": draft.pk})

        response = self.client.patch(
            url,
            {
                "clientUpdatedAt": (draft.updated_at + timedelta(days=1)).isoformat(),
                "metaTitle": "Unreviewed overwrite",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        draft.refresh_from_db()
        self.assertNotEqual(draft.meta_title, "Unreviewed overwrite")

    def test_page_attributes_change_only_when_working_copy_is_published(self):
        live = self.publish_initial()
        draft, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        save_url = reverse("api:pageversion-save-working-copy", kwargs={"pk": draft.pk})

        saved = self.client.patch(
            save_url,
            {
                "clientUpdatedAt": draft.updated_at.isoformat(),
                "pageData": {
                    **draft.page_data,
                    "pageAttributes": {
                        "title": "Draft title",
                        "description": "Draft description",
                        "slug": "draft-slug",
                    },
                },
            },
            format="json",
        )

        self.assertEqual(saved.status_code, status.HTTP_200_OK)
        draft.refresh_from_db()
        self.assertTrue(
            "page_attributes" in draft.page_data or "pageAttributes" in draft.page_data,
            repr(draft.page_data),
        )
        self.page.refresh_from_db()
        self.assertEqual(self.page.title, "Live title")
        self.assertEqual(self.page.slug, "workflow-page")
        published = self.client.post(
            reverse("api:pageversion-publish", kwargs={"pk": draft.pk}),
            {"clientUpdatedAt": draft.updated_at.isoformat()},
            format="json",
        )
        self.assertEqual(published.status_code, status.HTTP_200_OK)
        self.page.refresh_from_db()
        live.refresh_from_db()
        self.assertEqual(self.page.title, "Draft title")
        self.assertEqual(self.page.description, "Draft description")
        self.assertEqual(self.page.slug, "draft-slug")
        self.assertIsNotNone(live.expiry_date)

    def test_save_rejects_a_slug_used_by_a_sibling_page(self):
        parent = self.make_page_child()
        draft = self.page.create_version(self.user, "Conflicting slug")
        WebPage.objects.create(
            title="Sibling",
            slug="occupied",
            parent=parent,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

        response = self.client.patch(
            reverse("api:pageversion-save-working-copy", kwargs={"pk": draft.pk}),
            {
                "clientUpdatedAt": draft.updated_at.isoformat(),
                "pageData": {
                    **draft.page_data,
                    "pageAttributes": {"slug": "occupied"},
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        draft.refresh_from_db()
        self.assertNotEqual(draft.page_data.get("page_attributes", {}).get("slug"), "occupied")

    def test_publish_rechecks_slug_conflicts_created_after_save(self):
        parent = self.make_page_child()
        draft = self.page.create_version(self.user, "Slug reviewed before conflict")
        saved = self.client.patch(
            reverse("api:pageversion-save-working-copy", kwargs={"pk": draft.pk}),
            {
                "clientUpdatedAt": draft.updated_at.isoformat(),
                "pageData": {
                    **draft.page_data,
                    "pageAttributes": {"slug": "claimed-later"},
                },
            },
            format="json",
        )
        self.assertEqual(saved.status_code, status.HTTP_200_OK)
        draft.refresh_from_db()
        WebPage.objects.create(
            title="Sibling",
            slug="claimed-later",
            parent=parent,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

        response = self.client.post(
            reverse("api:pageversion-publish", kwargs={"pk": draft.pk}),
            {"clientUpdatedAt": draft.updated_at.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error"], "slug_conflict")
        draft.refresh_from_db()
        self.page.refresh_from_db()
        self.assertIsNone(draft.effective_date)
        self.assertEqual(self.page.slug, "workflow-page")

    def test_scheduled_activation_rechecks_slug_conflicts(self):
        parent = self.make_page_child()
        live = self.publish_initial()
        draft, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        draft.page_data = {
            **draft.page_data,
            "page_attributes": {"slug": "scheduled-conflict"},
        }
        draft.save(update_fields=["page_data", "updated_at"])
        scheduled_at = timezone.now() + timedelta(hours=1)
        PageVersionWorkflowService(self.page, self.user).schedule(draft, scheduled_at)
        WebPage.objects.create(
            title="Sibling",
            slug="scheduled-conflict",
            parent=parent,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

        with self.assertLogs("webpages.tasks", level="ERROR"):
            updated_count = refresh_publication_caches(now=scheduled_at + timedelta(seconds=1))

        self.page.refresh_from_db()
        draft.refresh_from_db()
        self.assertEqual(updated_count, 0)
        self.assertEqual(self.page.current_published_version_id, live.id)
        self.assertEqual(self.page.slug, "workflow-page")
        self.assertIsNone(draft.effective_date)
        self.assertIsNone(draft.expiry_date)
        self.assertIn("scheduled_activation_failure", draft.change_summary)
        live.refresh_from_db()
        self.assertIsNone(live.expiry_date)

    def test_publish_targets_only_the_explicit_canonical_working_copy(self):
        live = self.publish_initial()
        older_draft = self.page.create_version(self.user, "Older draft")
        working_draft = self.page.create_version(self.user, "Working draft")

        rejected = self.client.post(
            reverse("api:pageversion-publish", kwargs={"pk": older_draft.pk}),
            {"clientUpdatedAt": older_draft.updated_at.isoformat()},
            format="json",
        )
        published = self.client.post(
            reverse("api:pageversion-publish", kwargs={"pk": working_draft.pk}),
            {"clientUpdatedAt": working_draft.updated_at.isoformat()},
            format="json",
        )

        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(published.status_code, status.HTTP_200_OK)
        live.refresh_from_db()
        working_draft.refresh_from_db()
        self.assertIsNotNone(live.expiry_date)
        self.assertTrue(working_draft.is_current_published())

    def test_publish_rejects_a_working_copy_changed_after_review(self):
        draft = self.page.create_version(self.user, "Reviewed draft")
        reviewed_at = draft.updated_at
        draft.meta_title = "Changed after review"
        draft.save(update_fields=["meta_title", "updated_at"])

        response = self.client.post(
            reverse("api:pageversion-publish", kwargs={"pk": draft.pk}),
            {"clientUpdatedAt": reviewed_at.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error"], "version_conflict")
        draft.refresh_from_db()
        self.assertIsNone(draft.effective_date)

    def test_publish_requires_the_reviewed_timestamp(self):
        draft = self.page.create_version(self.user, "Unreviewed draft")

        response = self.client.post(
            reverse("api:pageversion-publish", kwargs={"pk": draft.pk}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "client_updated_at_required")

    def test_legacy_publishing_update_cannot_mutate_live_history(self):
        live = self.publish_initial()

        response = self.client.patch(
            reverse("api:pageversion-update-publishing", kwargs={"pk": live.pk}),
            {"expiryDate": (timezone.now() + timedelta(days=5)).isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        live.refresh_from_db()
        self.assertIsNone(live.expiry_date)

    def test_generic_version_patch_cannot_change_publication_dates(self):
        draft = self.page.create_version(self.user, "Generic patch draft")

        response = self.client.patch(
            reverse("api:pageversion-detail", kwargs={"pk": draft.pk}),
            {"effectiveDate": timezone.now().isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        draft.refresh_from_db()
        self.assertIsNone(draft.effective_date)

    def test_legacy_publishing_update_is_gone_without_side_effects(self):
        live = self.publish_initial()
        draft, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        draft.page_data = {
            **draft.page_data,
            "page_attributes": {"title": "Legacy endpoint title", "slug": "legacy-endpoint"},
        }
        draft.save(update_fields=["page_data", "updated_at"])

        response = self.client.patch(
            reverse("api:pageversion-update-publishing", kwargs={"pk": draft.pk}),
            {
                "effectiveDate": timezone.now().isoformat(),
                "expiryDate": None,
                "clientUpdatedAt": draft.updated_at.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.page.refresh_from_db()
        live.refresh_from_db()
        self.assertEqual(self.page.title, "Live title")
        self.assertEqual(self.page.slug, "workflow-page")
        self.assertIsNone(live.expiry_date)

    def test_descendant_publish_requires_explicit_reviewed_items(self):
        draft = self.page.create_version(self.user, "Reviewed root")
        reviewed_at = draft.updated_at
        draft.meta_title = "Changed after review"
        draft.save(update_fields=["meta_title", "updated_at"])

        response = self.client.patch(
            f'{reverse("api:pageversion-update-publishing", kwargs={"pk": draft.pk})}?include_subpages=true',
            {
                "effectiveDate": timezone.now().isoformat(),
                "expiryDate": None,
                "clientUpdatedAt": reviewed_at.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response.data["error"], "working_copy_save_required")
        draft.refresh_from_db()
        self.assertIsNone(draft.effective_date)

    def test_schedule_is_editable_and_second_schedule_is_rejected(self):
        draft = self.page.create_version(self.user, "Scheduled working copy")
        schedule_url = reverse("api:pageversion-schedule", kwargs={"pk": draft.pk})
        response = self.client.post(
            schedule_url,
            {
                "effectiveDate": (timezone.now() + timedelta(days=1)).isoformat(),
                "clientUpdatedAt": draft.updated_at.isoformat(),
            },
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
            {
                "effectiveDate": (timezone.now() + timedelta(days=3)).isoformat(),
                "clientUpdatedAt": legacy_schedule.updated_at.isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error"], "schedule_conflict")

    def test_schedule_rejects_a_working_copy_changed_after_review(self):
        draft = self.page.create_version(self.user, "Reviewed schedule")
        reviewed_at = draft.updated_at
        draft.meta_title = "Changed after review"
        draft.save(update_fields=["meta_title", "updated_at"])

        response = self.client.post(
            reverse("api:pageversion-schedule", kwargs={"pk": draft.pk}),
            {
                "effectiveDate": (timezone.now() + timedelta(days=1)).isoformat(),
                "clientUpdatedAt": reviewed_at.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error"], "version_conflict")
        draft.refresh_from_db()
        self.assertIsNone(draft.effective_date)

    def test_restore_copies_history_into_working_copy_only(self):
        live = self.publish_initial()
        draft, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        draft.page_data = {"title": "Work", "description": "Work"}
        draft.save()

        response = self.client.post(
            reverse("api:pageversion-restore", kwargs={"pk": live.pk}),
            {"clientUpdatedAt": draft.updated_at.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        draft.refresh_from_db()
        self.page.refresh_from_db()
        self.assertEqual(draft.page_data["title"], "Live title")
        self.assertEqual(self.page.current_published_version_id, live.id)

    def test_restore_rejects_a_working_copy_changed_after_review(self):
        live = self.publish_initial()
        draft, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        reviewed_at = draft.updated_at
        draft.meta_title = "Changed by another editor"
        draft.save(update_fields=["meta_title", "updated_at"])

        response = self.client.post(
            reverse("api:pageversion-restore", kwargs={"pk": live.pk}),
            {"clientUpdatedAt": reviewed_at.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error"], "version_conflict")
        draft.refresh_from_db()
        self.assertEqual(draft.meta_title, "Changed by another editor")

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

    def test_bulk_publish_rejects_a_future_review_timestamp(self):
        draft = self.page.create_version(self.user, "Reviewed draft")

        response = self.client.post(
            reverse("api:pageversion-bulk-publish-explicit"),
            {
                "items": [
                    {
                        "pageId": self.page.id,
                        "versionId": draft.id,
                        "clientUpdatedAt": (draft.updated_at + timedelta(days=1)).isoformat(),
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_207_MULTI_STATUS)
        self.assertEqual(response.data["results"][0]["error"], "version_conflict")
        draft.refresh_from_db()
        self.assertIsNone(draft.effective_date)

    def test_bulk_schedule_stops_a_working_copy_changed_after_review(self):
        draft = self.page.create_version(self.user, "Reviewed draft")
        observed_at = draft.updated_at
        draft.meta_title = "Changed after review"
        draft.save()

        response = self.client.post(
            reverse("api:pageversion-bulk-schedule-explicit"),
            {
                "effectiveDate": (timezone.now() + timedelta(days=1)).isoformat(),
                "items": [
                    {
                        "pageId": self.page.id,
                        "versionId": draft.id,
                        "clientUpdatedAt": observed_at.isoformat(),
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_207_MULTI_STATUS)
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

    def test_unrelated_user_cannot_compare_tenant_history(self):
        first = self.page.create_version(self.user, "First shared version")
        second = self.page.create_version(self.user, "Second shared version")
        unrelated_user = User.objects.create_user("history-unrelated", password="test")
        self.client.force_authenticate(unrelated_user)

        response = self.client.get(
            reverse("api:pageversion-compare"),
            {"version1": first.id, "version2": second.id},
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_compare_handles_slot_mapped_widgets(self):
        first = self.page.create_version(self.user, "First widget version")
        first.widgets = {"main": [{"id": "hero", "type": "Content", "config": {"text": "Before"}}]}
        first.save(update_fields=["widgets", "updated_at"])
        second = self.page.create_version(self.user, "Second widget version")
        second.widgets = {
            "main": [
                {"id": "hero", "type": "Content", "config": {"text": "After"}},
                {"id": "cta", "type": "Button", "config": {"label": "Read more"}},
            ]
        }
        second.save(update_fields=["widgets", "updated_at"])

        response = self.client.get(
            reverse("api:pageversion-compare"),
            {"version1": first.id, "version2": second.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        changes = response.data["changes"]
        self.assertEqual([widget["id"] for widget in changes["widgets_added"]], ["cta"])
        self.assertEqual(changes["widgets_modified"][0]["new"]["config"]["text"], "After")

    def test_invalid_delayed_page_attributes_are_rejected_on_save(self):
        draft = self.page.create_version(self.user, "Invalid delayed attributes")

        response = self.client.patch(
            reverse("api:pageversion-save-working-copy", kwargs={"pk": draft.pk}),
            {
                "clientUpdatedAt": draft.updated_at.isoformat(),
                "pageData": {"pageAttributes": {"title": "x" * 256}},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_atomic_save_enforces_the_effective_page_data_schema(self):
        PageDataSchema.objects.create(
            scope=PageDataSchema.SCOPE_SYSTEM,
            schema={
                "type": "object",
                "properties": {"headline": {"type": "string"}},
                "required": ["headline"],
            },
            created_by=self.user,
        )
        draft = self.page.create_version(self.user, "Schema checked")

        response = self.client.patch(
            reverse("api:pageversion-save-working-copy", kwargs={"pk": draft.pk}),
            {
                "clientUpdatedAt": draft.updated_at.isoformat(),
                "pageData": {"headline": 42},
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_scheduled_transition_rolls_back_cache_when_page_apply_fails(self):
        live = self.publish_initial()
        draft, _ = PageVersionWorkflowService(self.page, self.user).get_or_create_working_copy()
        scheduled_at = timezone.now() + timedelta(hours=1)
        PageVersionWorkflowService(self.page, self.user).schedule(draft, scheduled_at)

        with patch.object(PageVersion, "_apply_version_data", side_effect=RuntimeError("apply failed")):
            with self.assertRaisesRegex(RuntimeError, "apply failed"):
                refresh_publication_caches(now=scheduled_at + timedelta(seconds=1))

        self.page.refresh_from_db()
        self.assertEqual(self.page.current_published_version_id, live.id)

        refresh_publication_caches(now=scheduled_at + timedelta(seconds=1))
        self.page.refresh_from_db()
        self.assertEqual(self.page.current_published_version_id, draft.id)

    def test_compare_rejects_versions_from_different_pages(self):
        first = self.page.create_version(self.user, "First page version")
        other_page = WebPage.objects.create(
            title="Other page",
            slug="other-page",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        second = other_page.create_version(self.user, "Other page version")

        response = self.client.get(
            reverse("api:pageversion-compare"),
            {"version1": first.id, "version2": second.id},
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

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

    def test_not_published_filter_includes_a_new_draft_after_expiry(self):
        from webpages.filters import WebPageFilter

        live = self.publish_initial()
        live.expiry_date = timezone.now() - timedelta(minutes=1)
        live.save(update_fields=["expiry_date", "updated_at"])
        self.page.create_version(self.user, "New draft after expiry")

        filtered = WebPageFilter(
            {"workflow_state": "not_published"},
            queryset=WebPage.objects.filter(pk=self.page.pk),
        ).qs
        self.assertTrue(filtered.exists(), str(filtered.query))

        self.user.is_staff = True
        self.user.save(update_fields=["is_staff"])
        response = self.client.get(reverse("api:webpage-list"), {"workflow_state": "not_published"})
        pages = response.data.get("results", response.data)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        page_ids = [page["id"] for page in pages]
        self.assertIn(self.page.id, page_ids, response.data)
        listed_page = next(page for page in pages if page["id"] == self.page.id)
        self.assertEqual(listed_page["workflow_state"], "not_published")


class PageVersionMutationTransactionTest(TransactionTestCase):
    """Exercise row-locking mutations without TestCase's implicit transaction."""

    def setUp(self):
        self.user = User.objects.create_user("transaction-user", password="test")
        self.tenant = Tenant.objects.create(name="Transaction tenant", identifier="transaction", created_by=self.user)
        self.page = WebPage.objects.create(
            title="Transaction page",
            slug="transaction-page",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.version = self.page.create_version(self.user, "Working copy")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)

    def test_legacy_detail_patch_is_gone(self):
        response = self.client.patch(
            reverse("api:pageversion-detail", kwargs={"pk": self.version.pk}),
            {"metaTitle": "Updated safely"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.version.refresh_from_db()
        self.assertEqual(self.version.meta_title, "")

    def test_working_copy_save_locks_page_before_version(self):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.patch(
                reverse("api:pageversion-save-working-copy", kwargs={"pk": self.version.pk}),
                {
                    "clientUpdatedAt": self.version.updated_at.isoformat(),
                    "metaTitle": "Lock order",
                },
                format="json",
            )

        lock_queries = [query["sql"] for query in queries.captured_queries if "FOR UPDATE" in query["sql"].upper()]
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(lock_queries), 2)
        self.assertIn("webpages_webpage", lock_queries[0])
        self.assertIn("webpages_pageversion", lock_queries[1])

    def test_working_copy_delete_locks_page_before_version(self):
        with CaptureQueriesContext(connection) as queries:
            response = self.client.delete(reverse("api:pageversion-detail", kwargs={"pk": self.version.pk}))

        lock_queries = [query["sql"] for query in queries.captured_queries if "FOR UPDATE" in query["sql"].upper()]
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertGreaterEqual(len(lock_queries), 2)
        self.assertIn("webpages_webpage", lock_queries[0])
        self.assertIn("webpages_pageversion", lock_queries[1])
