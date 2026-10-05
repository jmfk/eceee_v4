from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from config.celery import app
from core.machine_api_keys import (
    SERVER_FULL_ACCESS,
    THEME_READ,
    THEME_TRANSFER,
    THEME_VERSION,
    _required_scope,
    generate_machine_api_key,
)
from core.models import MachineAPIKey, Tenant


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

    def test_staff_user_cannot_select_an_unrelated_tenant(self):
        staff = User.objects.create_user("ordinary-staff", password="test", is_staff=True)
        self.client.force_authenticate(staff)

        response = self.client.get("/api/v1/content-migration/plans/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(DEBUG=True)
    def test_local_dev_user_can_select_an_unrelated_tenant(self):
        dev_user = User.objects.create_user("dev_auto_user", password="test")

        self.assertTrue(self.tenant.user_has_access(dev_user))

    def test_jwt_cannot_select_an_unrelated_tenant(self):
        access_token = RefreshToken.for_user(self.outsider).access_token
        self.client.force_authenticate(user=None)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        response = self.client.get("/api/v1/content/namespaces/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_jwt_can_select_an_owned_tenant(self):
        access_token = RefreshToken.for_user(self.owner).access_token
        self.client.force_authenticate(user=None)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        response = self.client.get("/api/v1/content/namespaces/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_api_token_cannot_select_an_unrelated_tenant(self):
        token = Token.objects.create(user=self.outsider)
        self.client.force_authenticate(user=None)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {token.key}",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        response = self.client.get("/api/v1/content/namespaces/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

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


@override_settings(DEPLOYMENT_ENVIRONMENT="test")
class MachineAPIKeyAuthenticationTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("machine-admin", password="test")
        self.tenant = Tenant.objects.create(name="Machine tenant", identifier="machine-tenant", created_by=self.admin)
        self.other_tenant = Tenant.objects.create(
            name="Other tenant", identifier="other-machine-tenant", created_by=self.admin
        )
        self.client = APIClient()

    def create_key(self, scopes):
        raw_key, key_hash, key_prefix = generate_machine_api_key()
        api_key = MachineAPIKey.objects.create(
            name=f"key-{len(scopes)}-{MachineAPIKey.objects.count()}",
            principal=self.admin,
            environment="test",
            scopes=scopes,
            key_hash=key_hash,
            key_prefix=key_prefix,
            created_by=self.admin,
        )
        api_key.tenants.add(self.tenant)
        return raw_key, api_key

    def authorize(self, raw_key, tenant=None):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"ApiKey {raw_key}",
            HTTP_X_TENANT_ID=(tenant or self.tenant).identifier,
        )

    def test_full_access_key_uses_existing_permissions_and_tenant(self):
        raw_key, api_key = self.create_key([SERVER_FULL_ACCESS])
        self.authorize(raw_key)

        response = self.client.get("/api/v1/content-migration/plans/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        api_key.refresh_from_db()
        self.assertIsNotNone(api_key.last_used_at)

    def test_key_cannot_select_tenant_outside_its_binding_even_for_superuser_principal(self):
        raw_key, _ = self.create_key([SERVER_FULL_ACCESS])
        self.authorize(raw_key, self.other_tenant)

        response = self.client.get("/api/v1/content-migration/plans/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_multi_tenant_key_requires_an_explicit_tenant(self):
        raw_key, api_key = self.create_key([SERVER_FULL_ACCESS])
        api_key.tenants.add(self.other_tenant)
        self.client.credentials(HTTP_AUTHORIZATION=f"ApiKey {raw_key}")

        response = self.client.get("/api/v1/content-migration/plans/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_machine_key_tenant_binding_overrides_an_ambient_session(self):
        raw_key, _ = self.create_key([SERVER_FULL_ACCESS])
        self.client.force_login(self.admin)
        self.authorize(raw_key, self.other_tenant)

        response = self.client.get("/api/v1/content-migration/plans/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_theme_read_key_is_denied_on_non_theme_endpoint(self):
        raw_key, _ = self.create_key([THEME_READ])
        self.authorize(raw_key)

        response = self.client.get("/api/v1/content-migration/plans/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_theme_read_key_can_reach_designer_theme_list(self):
        raw_key, _ = self.create_key([THEME_READ])
        self.authorize(raw_key)

        response = self.client.get("/api/v1/webpages/designer/themes/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_wrong_environment_key_is_rejected(self):
        raw_key, api_key = self.create_key([SERVER_FULL_ACCESS])
        api_key.environment = "production"
        api_key.save(update_fields=["environment"])
        self.authorize(raw_key)

        response = self.client.get("/api/v1/content-migration/plans/")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_human_admin_can_create_and_list_key_with_secret_shown_once(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/v1/core/machine-api-keys/",
            {
                "name": "Codex",
                "principalId": self.admin.id,
                "tenantIds": [str(self.tenant.id)],
                "scopes": [SERVER_FULL_ACCESS],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["secret"].startswith("mapi_"))

        listed = self.client.get("/api/v1/core/machine-api-keys/")
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertNotIn("secret", listed.data[0])

    def test_machine_key_cannot_manage_machine_keys(self):
        raw_key, _ = self.create_key([SERVER_FULL_ACCESS])
        self.authorize(raw_key)

        response = self.client.get("/api/v1/core/machine-api-keys/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_full_access_key_cannot_generate_password_reset_links(self):
        raw_key, _ = self.create_key([SERVER_FULL_ACCESS])
        self.authorize(raw_key)

        response = self.client.post(f"/api/v1/utils/users/{self.admin.pk}/reset-password/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_machine_denied_routes_are_explicit(self):
        request = type("Request", (), {"method": "POST"})()
        for path in (
            "/api/v1/auth/token/",
            "/api/v1/core/machine-api-keys/",
            "/api/v1/utils/change-password/",
            "/api/v1/utils/current-workspace/",
            "/api/v1/utils/users/2/reset-password/",
            "/api/v1/webpages/designer/remote-connections/",
        ):
            with self.subTest(path=path):
                request.path = path
                self.assertIsNone(_required_scope(request))

    def test_rotate_locks_the_key_before_replacing_its_secret(self):
        _, api_key = self.create_key([SERVER_FULL_ACCESS])
        self.client.force_authenticate(self.admin)

        with CaptureQueriesContext(connection) as queries:
            response = self.client.post(f"/api/v1/core/machine-api-keys/{api_key.pk}/rotate/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any("FOR UPDATE" in query["sql"].upper() for query in queries.captured_queries))

    def test_theme_subroutes_have_stable_specific_scopes(self):
        request = type("Request", (), {"method": "GET"})()
        request.path = "/api/v1/webpages/designer/themes/2/versions/"
        self.assertEqual(_required_scope(request), THEME_VERSION)
        request.path = "/api/v1/webpages/themes/sync/pull/"
        self.assertEqual(_required_scope(request), THEME_TRANSFER)
        request.path = "/api/v1/webpages/designer/theme-exports/job/download/"
        self.assertEqual(_required_scope(request), THEME_READ)
