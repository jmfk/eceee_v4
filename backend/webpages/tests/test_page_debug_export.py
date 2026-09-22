import json

from django.contrib.auth.models import User
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from content.models import Namespace
from content_import.models import ImportLog
from core.models import Tenant
from webpages.models import PageVersion, WebPage
from webpages.views.page_debug_views import MAX_EXPORT_PAYLOAD_BYTES


class PageDebugExportTests(APITestCase):
    def setUp(self):
        self.editor = User.objects.create_user(username="debug-editor", password="test-password")
        self.staff_user = User.objects.create_user(username="debug-staff", password="test-password", is_staff=True)
        self.admin = User.objects.create_user(
            username="debug-admin",
            password="test-password",
            is_staff=True,
            is_superuser=True,
        )
        self.tenant = Tenant.objects.create(
            name="Debug Tenant",
            identifier="debug-tenant",
            created_by=self.admin,
        )
        self.namespace = Namespace.objects.create(
            name="Debug Namespace",
            slug="debug-namespace",
            created_by=self.admin,
            tenant=self.tenant,
        )
        self.page = WebPage.objects.create(
            title="Debug Page",
            slug="debug-page",
            tenant=self.tenant,
            created_by=self.admin,
            last_modified_by=self.editor,
        )
        self.version = PageVersion.objects.create(
            page=self.page,
            version_number=1,
            version_title="Initial debug version",
            page_data={"title": "Stored title"},
            widgets={
                "main": [
                    {
                        "id": "content-1",
                        "type": "easy_widgets.ContentWidget",
                        "config": {"content": "<p>Debug content</p>"},
                    }
                ]
            },
            effective_date=timezone.now(),
            created_by=self.editor,
        )
        self.import_log = ImportLog.objects.create(
            source_url="https://source-user:source-password@example.com/source?token=secret-token#private",
            slot_name="main",
            page_id=self.page.id,
            namespace=self.namespace,
            mode="replace",
            status="completed",
            widgets_created=1,
            errors=["Provider rejected https://example.com?token=error-secret"],
            html_content="<main>Imported private source</main>",
            ip_address="192.0.2.10",
            created_by=self.editor,
        )
        self.url = reverse("api:page-debug-export", kwargs={"page_id": self.page.id})

    def test_debug_export_rejects_anonymous_users(self):
        response = self.client.get(self.url)

        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_debug_export_rejects_non_staff_users(self):
        self.client.force_authenticate(user=self.editor)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_debug_export_rejects_non_superuser_staff(self):
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_debug_export_allows_authenticated_admins(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(response.data["page"]["id"], self.page.id)
        self.assertEqual(response.data["generated_by"]["username"], "debug-admin")
        self.assertEqual(response.data["schema_version"], 2)
        self.assertNotIn("widgets", response.data["versions"]["items"][0])
        self.assertEqual(response.data["versions"]["total_count"], 1)
        self.assertFalse(response.data["versions"]["truncated"])
        self.assertIsNone(response.data["selected_version"])
        self.assertEqual(response.data["import_logs"]["total_count"], 1)
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")

    def test_debug_export_returns_full_data_for_one_selected_version(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url, {"version_id": self.version.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["selected_version"]["id"], self.version.id)
        self.assertEqual(response.data["selected_version"]["widgets"], self.version.widgets)
        self.assertEqual(
            response.data["selected_version"]["widget_summary"]["top_level_widget_count"],
            1,
        )

    def test_debug_export_rejects_staff_user_selecting_victim_tenant(self):
        staff_tenant = Tenant.objects.create(
            name="Staff Tenant",
            identifier="staff-tenant",
            created_by=self.staff_user,
        )
        self.assertNotEqual(staff_tenant.id, self.tenant.id)
        self.client.force_authenticate(user=self.staff_user)

        response = self.client.get(self.url, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_debug_export_allows_admins_to_see_unpublished_versions(self):
        private_version = PageVersion.objects.create(
            page=self.page,
            version_number=2,
            version_title="Private draft",
            effective_date=None,
            created_by=self.editor,
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        returned_ids = {item["id"] for item in response.data["versions"]["items"]}
        self.assertIn(private_version.id, returned_ids)

    def test_debug_export_respects_tenant_context(self):
        other_tenant = Tenant.objects.create(
            name="Other Tenant",
            identifier="other-tenant",
            created_by=self.admin,
        )
        other_page = WebPage.objects.create(
            title="Other Tenant Page",
            slug="other-tenant-page",
            tenant=other_tenant,
            created_by=self.admin,
            last_modified_by=self.admin,
        )
        other_url = reverse("api:page-debug-export", kwargs={"page_id": other_page.id})
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(
            other_url,
            HTTP_X_TENANT_ID=str(self.tenant.id),
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_debug_export_excludes_cross_tenant_import_logs(self):
        other_tenant = Tenant.objects.create(
            name="Other Import Tenant",
            identifier="other-import-tenant",
            created_by=self.admin,
        )
        other_namespace = Namespace.objects.create(
            name="Other Namespace",
            slug="other-namespace",
            created_by=self.admin,
            tenant=other_tenant,
        )
        other_log = ImportLog.objects.create(
            source_url="https://other.example.com/private",
            slot_name="main",
            page_id=self.page.id,
            namespace=other_namespace,
            created_by=self.admin,
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url, HTTP_X_TENANT_ID=str(self.tenant.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data["import_logs"]["items"]}
        self.assertNotIn(other_log.id, returned_ids)
        self.assertEqual(response.data["import_logs"]["total_count"], 1)

    def test_debug_export_redacts_sensitive_import_fields(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        log = response.data["import_logs"]["items"][0]
        self.assertEqual(log["source_url"], "https://example.com/source")
        self.assertNotIn("html_content", log)
        self.assertNotIn("ip_address", log)
        self.assertNotIn("errors", log)
        self.assertNotIn("error_count", log)
        self.assertNotIn("has_html_content", log)
        self.assertNotIn("html_content_length", log)
        rendered_response = response.render().content.decode("utf-8")
        self.assertNotIn("secret-token", rendered_response)
        self.assertNotIn("source-user", rendered_response)
        self.assertNotIn("source-password", rendered_response)
        self.assertNotIn("error-secret", rendered_response)
        self.assertNotIn("Imported private source", rendered_response)
        self.assertNotIn("192.0.2.10", rendered_response)

    def test_debug_export_caps_import_log_results(self):
        self.client.force_authenticate(user=self.admin)
        for index in range(2):
            ImportLog.objects.create(
                source_url=f"https://example.com/source-{index}",
                slot_name="main",
                page_id=self.page.id,
                namespace=self.namespace,
                created_by=self.editor,
            )

        response = self.client.get(self.url, {"import_limit": 1})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["import_logs"]["total_count"], 3)
        self.assertEqual(response.data["import_logs"]["returned_count"], 1)
        self.assertTrue(response.data["import_logs"]["truncated"])
        self.assertEqual(len(response.data["import_logs"]["items"]), 1)

    def test_debug_export_caps_version_results(self):
        self.client.force_authenticate(user=self.admin)
        for version_number in range(2, 4):
            PageVersion.objects.create(
                page=self.page,
                version_number=version_number,
                version_title=f"Version {version_number}",
                created_by=self.editor,
            )

        response = self.client.get(self.url, {"version_limit": 1})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["versions"]["total_count"], 3)
        self.assertEqual(response.data["versions"]["returned_count"], 1)
        self.assertTrue(response.data["versions"]["truncated"])
        self.assertEqual(len(response.data["versions"]["items"]), 1)

    def test_debug_export_truncates_large_version_summary_text(self):
        large_version = PageVersion.objects.create(
            page=self.page,
            version_number=2,
            version_title="v" * 600,
            meta_title="t" * 600,
            meta_description="d" * 1200,
            created_by=self.editor,
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        summary = next(item for item in response.data["versions"]["items"] if item["id"] == large_version.id)
        self.assertEqual(len(summary["version_title"]), 500)
        self.assertTrue(summary["version_title_truncated"])
        self.assertEqual(len(summary["meta_title"]), 500)
        self.assertTrue(summary["meta_title_truncated"])
        self.assertEqual(len(summary["meta_description"]), 1000)
        self.assertTrue(summary["meta_description_truncated"])

    def test_debug_export_can_be_downloaded(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(
            self.url,
            {"download": "true"},
            HTTP_ACCEPT="text/html,application/xhtml+xml",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(
            response["Content-Disposition"],
            f'attachment; filename="page-{self.page.id}-debug.json"',
        )
        self.assertEqual(json.loads(response.content)["schemaVersion"], 2)

    def test_debug_export_rejects_oversized_page_payload(self):
        self.page.page_custom_css = "x" * (MAX_EXPORT_PAYLOAD_BYTES + 1)
        self.page.save(update_fields=["page_custom_css"])
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        self.assertEqual(response.data["max_bytes"], MAX_EXPORT_PAYLOAD_BYTES)

    def test_debug_export_rejects_oversized_selected_version_before_export(self):
        oversized_version = PageVersion.objects.create(
            page=self.page,
            version_number=2,
            version_title="Oversized version",
            page_custom_css="x" * (MAX_EXPORT_PAYLOAD_BYTES + 1),
            created_by=self.editor,
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url, {"version_id": oversized_version.id})

        self.assertEqual(response.status_code, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)
        self.assertEqual(response.data["max_bytes"], MAX_EXPORT_PAYLOAD_BYTES)

    def test_debug_export_does_not_select_excluded_large_related_fields(self):
        self.namespace.description = "n" * 1000
        self.namespace.save(update_fields=["description"])
        self.page.deletion_metadata = {"private": "p" * 1000}
        self.page.save(update_fields=["deletion_metadata"])
        self.client.force_authenticate(user=self.admin)

        with CaptureQueriesContext(connection) as captured_queries:
            response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        executed_sql = "\n".join(query["sql"] for query in captured_queries.captured_queries)
        self.assertNotIn('"webpages_webpage"."deletion_metadata"', executed_sql)
        self.assertNotIn('"content_namespace"."description"', executed_sql)
        self.assertNotIn('"password"', executed_sql)
        self.assertNotIn('"email"', executed_sql)
        self.assertNotIn('"first_name"', executed_sql)
        self.assertNotIn('"last_name"', executed_sql)
        self.assertNotIn('LENGTH("webpages_pageversion"."version_title")', executed_sql)
        self.assertNotIn('LENGTH("webpages_pageversion"."meta_title")', executed_sql)
        self.assertNotIn('LENGTH("webpages_pageversion"."meta_description")', executed_sql)
        self.assertNotIn("jsonb_array_length", executed_sql)
        self.assertNotIn('LENGTH("content_import_importlog"."html_content")', executed_sql)

    def test_debug_export_preserves_keys_inside_stored_json(self):
        self.page.page_css_variables = {"snake_key": "page value"}
        self.page.save(update_fields=["page_css_variables"])
        self.version.page_data = {"snake_key": "page data value"}
        self.version.change_summary = {"snake_key": "change value"}
        self.version.page_css_variables = {"snake_key": "version value"}
        self.version.widgets = {"main": [{"config": {"snake_key": "widget value"}}]}
        self.version.save(
            update_fields=[
                "page_data",
                "change_summary",
                "page_css_variables",
                "widgets",
            ]
        )
        self.import_log.stats = {"snake_key": 1}
        self.import_log.save(update_fields=["stats"])
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(self.url, {"version_id": self.version.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rendered = json.loads(response.content)
        self.assertEqual(rendered["page"]["pageCssVariables"]["snake_key"], "page value")
        self.assertEqual(rendered["selectedVersion"]["pageData"]["snake_key"], "page data value")
        self.assertEqual(rendered["selectedVersion"]["changeSummary"]["snake_key"], "change value")
        self.assertEqual(rendered["selectedVersion"]["pageCssVariables"]["snake_key"], "version value")
        self.assertEqual(
            rendered["selectedVersion"]["widgets"]["main"][0]["config"]["snake_key"],
            "widget value",
        )
        self.assertEqual(rendered["importLogs"]["items"][0]["stats"]["snake_key"], 1)

    def test_debug_export_is_rate_limited(self):
        rate_limited_admin = User.objects.create_user(
            username="rate-limited-admin",
            password="test-password",
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_authenticate(user=rate_limited_admin)

        for _ in range(10):
            response = self.client.get(self.url)
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
