from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from config.celery import app
from core.models import Tenant


@override_settings(APP_VERSION="build-123")
class ApplicationVersionTest(TestCase):
    def test_version_endpoint_and_header_match_deployed_build(self):
        response = self.client.get("/api/v1/app-version/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"version": "build-123"})
        self.assertEqual(response["X-App-Version"], "build-123")
        self.assertEqual(response["Cache-Control"], "no-store")


class CeleryScheduleTest(TestCase):
    def test_scheduled_publication_refresh_is_in_effective_beat_schedule(self):
        task = app.conf.beat_schedule["refresh-scheduled-publication-caches"]

        self.assertEqual(task["task"], "webpages.tasks.refresh_scheduled_publication_caches")


class TenantAccessPermissionTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("tenant-owner", password="test")
        self.outsider = User.objects.create_user("tenant-outsider", password="test")
        self.tenant = Tenant.objects.create(
            name="Protected tenant",
            identifier="protected-tenant",
            created_by=self.owner,
        )
        self.client = APIClient()
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)

    def test_tenant_administration_rejects_an_authenticated_non_member(self):
        self.client.force_authenticate(self.outsider)

        response = self.client.get("/api/v1/content-migration/plans/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["detail"], "You do not have access to this tenant.")

    def test_tenant_administration_allows_the_tenant_owner(self):
        self.client.force_authenticate(self.owner)

        response = self.client.get("/api/v1/content-migration/plans/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_invalid_explicit_tenant_does_not_fall_back(self):
        self.client.force_authenticate(self.owner)
        self.client.credentials(HTTP_X_TENANT_ID="missing-tenant")

        response = self.client.get("/api/v1/content-migration/plans/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertContains(
            response,
            "The selected tenant does not exist or is inactive.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    def test_superuser_session_workspace_is_used_without_explicit_header(self):
        superuser = User.objects.create_superuser("workspace-switcher", password="test")
        selected = Tenant.objects.create(
            name="Selected workspace",
            identifier="selected-workspace",
            created_by=superuser,
        )
        client = APIClient()
        client.force_login(superuser)
        session = client.session
        session["selected_tenant_identifier"] = selected.identifier
        session.save()

        response = client.get("/api/v1/utils/current-user/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["current_workspace"]["identifier"], selected.identifier)
