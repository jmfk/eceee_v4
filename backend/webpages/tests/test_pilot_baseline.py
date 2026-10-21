"""Frozen contracts plus real PostgreSQL save/reload behavior for the four pilot widgets."""

import copy
import json
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import connection
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from core.models import Tenant
from webpages.models import WebPage
from webpages.services.page_version_workflow import PageVersionWorkflowService
from webpages.tests.pilot_baseline_adapter import FIXTURE_DIR, load_cases, observations


class PilotContractBaselineTests(SimpleTestCase):
    def test_frozen_wire_contracts_and_complete_render_catalog(self):
        expected = json.loads((FIXTURE_DIR / "reference.json").read_text())
        actual = observations()
        self.assertEqual(actual["formatVersion"], expected["formatVersion"])
        self.assertEqual(actual["casesSha256"], expected["casesSha256"])
        self.assertEqual(set(actual["observations"]), set(expected["observations"]))
        for case_id, value in expected["observations"].items():
            with self.subTest(case=case_id):
                # Python dict equality alone considers True == 1; the wire contract must not.
                self.assertEqual(
                    json.dumps(actual["observations"][case_id], sort_keys=True), json.dumps(value, sort_keys=True)
                )

    def test_independent_scenario_expectations(self):
        actual = observations()["observations"]
        for case in load_cases()["contracts"]:
            with self.subTest(case=case["id"]):
                result = actual[case["id"]]
                self.assertEqual(result["status"], case["expectStatus"])
                if "expectValid" in case:
                    self.assertIs(result["body"]["isValid"], case["expectValid"])
                for key, value in case.get("expectNormalized", {}).items():
                    self.assertEqual(result["body"]["validatedData"][key], value)


class PilotPersistenceBaselineTests(TestCase):
    def setUp(self):
        # Never report this baseline as passing on SQLite or with skipped DB tests.
        self.assertEqual(connection.vendor, "postgresql", "Pilot persistence requires PostgreSQL")
        self.user = User.objects.create_user("pilot-editor", password="pilot-fixture-only")
        self.tenant = Tenant.objects.create(name="Pilot A", identifier="pilot-a", created_by=self.user)
        self.foreign_user = User.objects.create_user("pilot-other", password="pilot-fixture-only")
        self.foreign_tenant = Tenant.objects.create(name="Pilot B", identifier="pilot-b", created_by=self.foreign_user)
        self.page = WebPage.objects.create(
            title="Pilot page", slug="pilot", tenant=self.tenant, created_by=self.user, last_modified_by=self.user
        )
        live = self.page.create_version(self.user, "Live")
        live.widgets = {"main": []}
        live.save()
        self.live = PageVersionWorkflowService(self.page, self.user).publish(live)
        self.client = APIClient()
        # Exercise actual session authentication and tenant middleware, not force_authenticate.
        self.assertTrue(self.client.login(username="pilot-editor", password="pilot-fixture-only"))
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        self.url = reverse("api:page-working-copy-save", kwargs={"page_id": self.page.pk})

    def save_pilot(self):
        return self.client.patch(
            self.url,
            {
                "expectedVersionId": self.live.pk,
                "expectedRevision": self.live.edit_revision,
                "widgets": copy.deepcopy(load_cases()["widgets"]),
            },
            format="json",
            secure=True,
        )

    def test_save_reload_preserves_pilot_content_order_and_live_snapshot(self):
        saved = self.save_pilot()
        self.assertEqual(saved.status_code, 201, saved.data)
        working = self.page.versions.get(effective_date__isnull=True)
        self.assertEqual(working.widgets, load_cases()["storedWidgets"])
        reloaded = self.client.get(reverse("api:pageversion-detail", kwargs={"pk": working.pk}), secure=True)
        self.assertEqual(reloaded.status_code, 200)
        expected_wire = copy.deepcopy(load_cases()["widgets"])
        # The read serializer enriches top-level widgets with registry variants;
        # these four reference types declare none. Children are not enriched.
        for widget in expected_wire["main"]:
            widget["activeVariants"] = []
        self.assertEqual(json.loads(reloaded.content)["widgets"], expected_wire)
        self.live.refresh_from_db()
        self.page.refresh_from_db()
        self.assertEqual(self.live.widgets, {"main": []})
        self.assertEqual(self.page.current_published_version_id, self.live.pk)
        self.assertEqual(self.page.versions.filter(effective_date__isnull=True).count(), 1)

    def test_stale_save_changes_neither_content_revision_nor_live_and_does_not_broadcast(self):
        self.assertEqual(self.save_pilot().status_code, 201)
        working = self.page.versions.get(effective_date__isnull=True)
        before = (copy.deepcopy(working.widgets), working.edit_revision, working.updated_at)
        with patch("webpages.consumers.broadcast_version_update") as broadcast:
            with self.captureOnCommitCallbacks(execute=True):
                stale = self.save_pilot()
        self.assertEqual(stale.status_code, 409, stale.data)
        self.assertEqual(stale.data["error"], "version_conflict")
        working.refresh_from_db()
        self.assertEqual((working.widgets, working.edit_revision, working.updated_at), before)
        self.live.refresh_from_db()
        self.assertEqual(self.live.widgets, {"main": []})
        broadcast.assert_not_called()

    def test_other_tenant_and_anonymous_requests_cannot_save_pilot(self):
        before = self.page.versions.count()
        self.client.credentials(HTTP_X_TENANT_ID=self.foreign_tenant.identifier)
        rejected = self.save_pilot()
        self.assertEqual(rejected.status_code, 403)
        self.client.logout()
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        rejected = self.save_pilot()
        self.assertEqual(rejected.status_code, 401)
        self.assertEqual(self.page.versions.count(), before)
        self.live.refresh_from_db()
        self.assertEqual(self.live.widgets, {"main": []})

    def test_authenticated_session_without_csrf_cannot_save_pilot(self):
        client = APIClient(enforce_csrf_checks=True)
        self.assertTrue(client.login(username="pilot-editor", password="pilot-fixture-only"))
        client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        before = self.page.versions.count()
        response = client.patch(
            self.url,
            {
                "expectedVersionId": self.live.pk,
                "expectedRevision": self.live.edit_revision,
                "widgets": load_cases()["widgets"],
            },
            format="json",
            secure=True,
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.page.versions.count(), before)
