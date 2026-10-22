import os
import stat
import tempfile
from io import StringIO
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import SimpleTestCase, TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.settings import api_settings
from rest_framework.test import APIClient
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from config.celery import app
from core.machine_api_keys import (
    CONTENT_READ,
    CONTENT_WRITE,
    LAYOUT_READ,
    MEDIA_READ,
    MEDIA_WRITE,
    OBJECT_DEFINITION_WRITE,
    OBJECT_PUBLISH,
    OBJECT_READ,
    OBJECT_TRANSFER,
    OBJECT_WRITE,
    PAGE_PUBLISH,
    PAGE_READ,
    PAGE_WRITE,
    SERVER_FULL_ACCESS,
    SITE_READ,
    SITE_TRANSFER,
    THEME_READ,
    THEME_TRANSFER,
    THEME_VERSION,
    _required_scope,
    generate_machine_api_key,
)
from core.models import MachineAPIKey, Tenant
from webpages.models import PageTheme, WebPage


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


class RedisChannelLayerConfigurationTest(SimpleTestCase):
    def test_idle_channel_receives_have_no_socket_timeout(self):
        host = settings.CHANNEL_LAYERS["default"]["CONFIG"]["hosts"][0]

        self.assertIsNone(host["socket_timeout"])


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

    def test_page_read_key_can_list_pages_but_cannot_create_them(self):
        raw_key, _ = self.create_key([PAGE_READ])
        self.authorize(raw_key)

        listed = self.client.get("/api/v1/webpages/pages/")
        created = self.client.post("/api/v1/webpages/pages/", {}, format="json")

        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(created.status_code, status.HTTP_403_FORBIDDEN)

    def test_machine_read_routes_cannot_contextualize_another_tenant(self):
        raw_key, api_key = self.create_key([PAGE_READ, SITE_READ])
        api_key.tenants.add(self.other_tenant)
        foreign_site = WebPage.objects.create(
            title="Foreign machine site",
            slug="foreign-machine-site",
            hostnames=["foreign-machine.example.test"],
            tenant=self.other_tenant,
            created_by=self.admin,
            last_modified_by=self.admin,
        )
        foreign_site.create_version(self.admin, "Foreign machine version")
        self.authorize(raw_key, self.tenant)

        resolved = self.client.get(
            "/api/v1/webpages/pages/resolve-render-path/",
            {"site_id": foreign_site.id, "path": ""},
        )
        patterns = self.client.get(
            "/api/v1/webpages/path-patterns/",
            {"page_id": foreign_site.id},
        )

        self.assertEqual(resolved.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(patterns.status_code, status.HTTP_200_OK)
        self.assertTrue(all("contextualized_example" not in pattern for pattern in patterns.data["patterns"]))

    def test_media_read_key_cannot_reach_pages(self):
        raw_key, _ = self.create_key([MEDIA_READ])
        self.authorize(raw_key)

        response = self.client.get("/api/v1/webpages/pages/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_object_write_key_cannot_change_publication_state(self):
        raw_key, _ = self.create_key([OBJECT_WRITE])
        self.authorize(raw_key)

        scheduled = self.client.post(
            "/api/v1/objects/versions/1/schedule/",
            {"effective_date": "2030-01-01T00:00:00Z"},
            format="json",
        )
        bulk_published = self.client.post(
            "/api/v1/objects/objects/bulk-operations/",
            {"operation": "publish", "object_ids": [1]},
            format="json",
        )

        self.assertEqual(scheduled.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(bulk_published.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_scoped_keys_cannot_mutate_global_configuration(self):
        raw_key, _ = self.create_key([OBJECT_WRITE, SITE_READ])
        self.authorize(raw_key)

        object_type = self.client.patch(
            "/api/v1/objects/object-types/1/",
            {"label": "Changed"},
            format="json",
        )
        page_schema = self.client.post(
            "/api/v1/webpages/page-data-schemas/",
            {"scope": "system", "schema": {}},
            format="json",
        )

        self.assertEqual(object_type.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(page_schema.status_code, status.HTTP_403_FORBIDDEN)

    def test_definition_write_is_scoped_to_selected_tenant_and_never_deletes(self):
        from content.models import Namespace
        from object_storage.models import ObjectTypeDefinition

        own = Namespace.objects.create(
            name="Definition own", slug="definitions-own", tenant=self.tenant, created_by=self.admin
        )
        foreign = Namespace.objects.create(
            name="Definition foreign", slug="definitions-foreign", tenant=self.other_tenant, created_by=self.admin
        )
        definition = ObjectTypeDefinition.objects.create(
            name="scoped_definition", label="Scoped", plural_label="Scoped", namespace=own, created_by=self.admin
        )
        other = ObjectTypeDefinition.objects.create(
            name="foreign_definition", label="Foreign", plural_label="Foreign", namespace=foreign, created_by=self.admin
        )
        raw_key, _ = self.create_key([OBJECT_DEFINITION_WRITE])
        self.authorize(raw_key)
        updated = self.client.patch(
            f"/api/v1/objects/object-types/{definition.pk}/", {"label": "Updated"}, format="json"
        )
        moved = self.client.patch(
            f"/api/v1/objects/object-types/{definition.pk}/", {"namespace_id": foreign.pk}, format="json"
        )
        foreign_edit = self.client.patch(f"/api/v1/objects/object-types/{other.pk}/", {"label": "Wrong"}, format="json")
        deleted = self.client.delete(f"/api/v1/objects/object-types/{definition.pk}/")
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(moved.status_code, 400)
        self.assertEqual(foreign_edit.status_code, 404)
        self.assertEqual(deleted.status_code, 403)
        definition.refresh_from_db()
        self.assertEqual(definition.namespace_id, own.pk)

    def test_definition_write_create_rejects_foreign_and_global_child_types(self):
        from content.models import Namespace
        from object_storage.models import ObjectTypeDefinition

        own = Namespace.objects.create(
            name="Own definitions", slug="own-definitions", tenant=self.tenant, created_by=self.admin
        )
        foreign = Namespace.objects.create(
            name="Foreign definitions", slug="foreign-definitions", tenant=self.other_tenant, created_by=self.admin
        )
        own_child = ObjectTypeDefinition.objects.create(
            name="own_child", label="Own child", plural_label="Own children", namespace=own, created_by=self.admin
        )
        foreign_child = ObjectTypeDefinition.objects.create(
            name="foreign_child",
            label="Foreign child",
            plural_label="Foreign children",
            namespace=foreign,
            created_by=self.admin,
        )
        global_child = ObjectTypeDefinition.objects.create(
            name="global_child", label="Global child", plural_label="Global children", created_by=self.admin
        )
        raw_key, _ = self.create_key([OBJECT_DEFINITION_WRITE])
        self.authorize(raw_key)

        for child in (foreign_child, global_child):
            with self.subTest(child=child.name):
                name = f"parent_for_{child.name}"
                response = self.client.post(
                    "/api/v1/objects/object-types/",
                    {
                        "name": name,
                        "label": "Parent",
                        "plural_label": "Parents",
                        "namespace_id": own.pk,
                        "allowed_child_types_input": [child.name],
                    },
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("allowed_child_types_input", response.data)
                self.assertFalse(ObjectTypeDefinition.objects.filter(name=name).exists())

        accepted = self.client.post(
            "/api/v1/objects/object-types/",
            {
                "name": "same_tenant_parent",
                "label": "Parent",
                "plural_label": "Parents",
                "namespace_id": own.pk,
                "allowed_child_types_input": [own_child.name],
            },
            format="json",
        )
        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED)
        parent = ObjectTypeDefinition.objects.get(name="same_tenant_parent")
        self.assertEqual(list(parent.allowed_child_types.values_list("pk", flat=True)), [own_child.pk])

    def test_definition_write_update_rejects_foreign_and_global_child_types_without_mutation(self):
        from content.models import Namespace
        from object_storage.models import ObjectTypeDefinition

        own = Namespace.objects.create(
            name="Own definitions", slug="own-definitions", tenant=self.tenant, created_by=self.admin
        )
        foreign = Namespace.objects.create(
            name="Foreign definitions", slug="foreign-definitions", tenant=self.other_tenant, created_by=self.admin
        )
        parent = ObjectTypeDefinition.objects.create(
            name="own_parent", label="Original", plural_label="Parents", namespace=own, created_by=self.admin
        )
        own_child = ObjectTypeDefinition.objects.create(
            name="own_child", label="Own child", plural_label="Own children", namespace=own, created_by=self.admin
        )
        next_child = ObjectTypeDefinition.objects.create(
            name="next_child", label="Next child", plural_label="Next children", namespace=own, created_by=self.admin
        )
        foreign_child = ObjectTypeDefinition.objects.create(
            name="foreign_child",
            label="Foreign child",
            plural_label="Foreign children",
            namespace=foreign,
            created_by=self.admin,
        )
        global_child = ObjectTypeDefinition.objects.create(
            name="global_child", label="Global child", plural_label="Global children", created_by=self.admin
        )
        parent.allowed_child_types.add(own_child)
        raw_key, _ = self.create_key([OBJECT_DEFINITION_WRITE])
        self.authorize(raw_key)

        for child in (foreign_child, global_child):
            with self.subTest(child=child.name):
                response = self.client.patch(
                    f"/api/v1/objects/object-types/{parent.pk}/",
                    {"label": "Rejected", "allowed_child_types_input": [child.name]},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("allowed_child_types_input", response.data)
                parent.refresh_from_db()
                self.assertEqual(parent.label, "Original")
                self.assertEqual(list(parent.allowed_child_types.values_list("pk", flat=True)), [own_child.pk])

        accepted = self.client.patch(
            f"/api/v1/objects/object-types/{parent.pk}/",
            {"label": "Updated", "allowed_child_types_input": [next_child.name]},
            format="json",
        )
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        parent.refresh_from_db()
        self.assertEqual(parent.label, "Updated")
        self.assertEqual(list(parent.allowed_child_types.values_list("pk", flat=True)), [next_child.pk])

    def test_owner_machine_key_installs_fresh_editorial_profile_without_superuser(self):
        import importlib.util
        import json

        from content.models import Namespace
        from content_migration.legacy_content.profile import initial_bundle
        from taxonomy.models import ClassificationType, Tag

        path = Path(__file__).resolve().parents[2] / "scripts" / "eceee_content_definitions.py"
        if not path.exists():
            path = Path("/definition-tooling/scripts/eceee_content_definitions.py")
        spec = importlib.util.spec_from_file_location("profile_install_test", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.admin.is_superuser = False
        self.admin.save(update_fields=["is_superuser"])
        namespace = Namespace.objects.create(
            name="Editorial profile", slug="editorial-profile", tenant=self.tenant, created_by=self.admin
        )
        raw_key, _ = self.create_key([OBJECT_DEFINITION_WRITE, OBJECT_READ, CONTENT_READ, CONTENT_WRITE])
        self.authorize(raw_key)
        test = self

        class ClientAPI(module.Api):
            def __init__(self):
                pass

            def request(self, path, method="GET", data=None):
                response = getattr(test.client, method.lower())("/api/v1/" + path, data=data, format="json")
                test.assertLess(response.status_code, 300, response.data)
                return module.normalize_wire(json.loads(response.content))

        api = ClientAPI()
        module.apply_bundle(api, {"id": namespace.pk}, initial_bundle(), apply=True)
        self.assertEqual(
            ClassificationType.objects.filter(namespace=namespace).count(),
            len(initial_bundle()["classification_types"]),
        )
        self.assertEqual(
            set(Tag.objects.filter(namespace=namespace).values_list("slug", flat=True)),
            {"news", "column", "press-release"},
        )
        self.assertEqual(module.apply_bundle(api, {"id": namespace.pk}, initial_bundle())["changes"], [])

    def test_definition_writer_member_does_not_gain_taxonomy_owner_rights(self):
        from content.models import Namespace

        member = User.objects.create_user("profile-member", is_staff=True)
        self.tenant.members.add(member)
        namespace = Namespace.objects.create(
            name="Member profile", slug="member-profile", tenant=self.tenant, created_by=self.admin
        )
        raw_key, key = self.create_key([OBJECT_DEFINITION_WRITE, CONTENT_WRITE])
        key.principal = member
        key.save(update_fields=["principal"])
        self.authorize(raw_key)
        response = self.client.post(
            "/api/v1/taxonomy/types/",
            {"namespace": namespace.pk, "key": "editorial", "name": "Editorial", "allowed_uses": ["pages"]},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_theme_read_key_can_reach_designer_theme_list(self):
        raw_key, _ = self.create_key([THEME_READ])
        self.authorize(raw_key)

        response = self.client.get("/api/v1/webpages/designer/themes/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_theme_read_key_can_compare_themes_via_read_only_post(self):
        left = PageTheme.objects.create(name="Left theme", tenant=self.tenant, created_by=self.admin)
        right = PageTheme.objects.create(name="Right theme", tenant=self.tenant, created_by=self.admin)
        raw_key, _ = self.create_key([THEME_READ])
        self.authorize(raw_key)

        response = self.client.post(
            "/api/v1/webpages/designer/themes/compare/",
            {"leftThemeId": left.pk, "rightThemeId": right.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @override_settings(THEME_SYNC_ENABLED=True)
    def test_theme_transfer_key_can_post_sync_pull_without_csrf(self):
        self.client = APIClient(enforce_csrf_checks=True)
        raw_key, _ = self.create_key([THEME_TRANSFER])
        self.authorize(raw_key)

        response = self.client.post("/api/v1/webpages/themes/sync/pull/", {}, format="json")

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

    def test_staff_user_cannot_manage_machine_keys(self):
        staff = User.objects.create_user("machine-staff", password="test", is_staff=True)
        staff_tenant = Tenant.objects.create(name="Staff tenant", identifier="staff-tenant", created_by=staff)
        self.client.force_login(staff)
        self.client.credentials(HTTP_X_TENANT_ID=staff_tenant.identifier)

        response = self.client.post(
            "/api/v1/core/machine-api-keys/",
            {
                "name": "Escalated key",
                "principalId": self.admin.id,
                "tenantIds": [str(self.tenant.id)],
                "scopes": [SERVER_FULL_ACCESS],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_machine_key_is_not_accepted_outside_the_application_api(self):
        raw_key, _ = self.create_key([SERVER_FULL_ACCESS])
        self.authorize(raw_key)

        response = self.client.get("/admin/")

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/admin/login/", response["Location"])

    def test_full_access_key_cannot_read_data_connection_credentials(self):
        raw_key, _ = self.create_key([SERVER_FULL_ACCESS])
        self.authorize(raw_key)

        response = self.client.get("/api/v1/data-connections/connections/")

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
            "/api/v1/data-connections/connections/",
            "/api/v1/utils/change-password/",
            "/api/v1/utils/current-workspace/",
            "/api/v1/utils/users/2/reset-password/",
            "/api/v1/webpages/designer/remote-connections/",
            "/api/v1/webpages/remote-sites/access-keys/",
        ):
            with self.subTest(path=path):
                request.path = path
                self.assertIsNone(_required_scope(request))

    def test_effective_rest_framework_settings_include_default_throttles(self):
        self.assertEqual(api_settings.DEFAULT_THROTTLE_CLASSES, [AnonRateThrottle, UserRateThrottle])

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
        request.path = "/api/v1/webpages/site-packages/remote-source/sites/"
        self.assertEqual(_required_scope(request), SITE_TRANSFER)
        request.path = "/api/v1/objects/remote-source/catalog/"
        self.assertEqual(_required_scope(request), OBJECT_READ)
        request.path = "/api/v1/objects/remote-source/exports/job/download/"
        self.assertEqual(_required_scope(request), OBJECT_TRANSFER)
        request.path = "/api/v1/webpages/designer/theme-exports/job/download/"
        self.assertEqual(_required_scope(request), THEME_READ)
        request.method = "POST"
        request.path = "/api/v1/webpages/designer/themes/compare/"
        self.assertEqual(_required_scope(request), THEME_READ)
        request.path = "/api/v1/webpages/designer/themes/2/export/"
        self.assertEqual(_required_scope(request), THEME_READ)

    def test_supported_cms_routes_have_resource_specific_scopes(self):
        request = type("Request", (), {})()
        cases = (
            ("GET", "/api/v1/webpages/pages/", PAGE_READ),
            ("POST", "/api/v1/webpages/pages/", PAGE_WRITE),
            ("PATCH", "/api/v1/webpages/versions/2/widgets/", PAGE_WRITE),
            ("POST", "/api/v1/webpages/versions/2/publish/", PAGE_PUBLISH),
            ("POST", "/api/v1/webpages/pages/2/unpublish-explicit/", PAGE_PUBLISH),
            ("GET", "/api/v1/media/files/", MEDIA_READ),
            ("POST", "/api/v1/media/upload/", MEDIA_WRITE),
            ("GET", "/api/v1/objects/objects/", OBJECT_READ),
            ("PATCH", "/api/v1/objects/objects/2/", OBJECT_WRITE),
            ("GET", "/api/v1/objects/object-types/", OBJECT_READ),
            ("PATCH", "/api/v1/objects/object-types/2/", OBJECT_DEFINITION_WRITE),
            ("DELETE", "/api/v1/objects/object-types/2/", SERVER_FULL_ACCESS),
            ("POST", "/api/v1/objects/versions/2/publish/", OBJECT_PUBLISH),
            ("POST", "/api/v1/objects/versions/2/schedule/", OBJECT_PUBLISH),
            ("POST", "/api/v1/objects/objects/bulk-operations/", SERVER_FULL_ACCESS),
            ("GET", "/api/v1/webpages/layouts/", LAYOUT_READ),
            ("POST", "/api/v1/webpages/widget-types/easy_widgets.ContentWidget/validate/", LAYOUT_READ),
            ("GET", "/api/v1/webpages/page-data-schemas/", SITE_READ),
            ("POST", "/api/v1/webpages/page-data-schemas/validate/", SITE_READ),
            ("POST", "/api/v1/webpages/page-data-schemas/", SERVER_FULL_ACCESS),
            ("POST", "/api/v1/webpages/preview-sizes/", SERVER_FULL_ACCESS),
            ("POST", "/api/v1/utils/value-lists/", SERVER_FULL_ACCESS),
            ("GET", "/api/v1/content/namespaces/", CONTENT_READ),
            ("POST", "/api/v1/content/tags/", CONTENT_WRITE),
        )
        for method, path, expected in cases:
            with self.subTest(method=method, path=path):
                request.method = method
                request.path = path
                self.assertEqual(_required_scope(request), expected)

    def test_operational_layout_reload_still_requires_full_access(self):
        request = type("Request", (), {"method": "POST", "path": "/api/v1/webpages/layouts/reload/"})()

        self.assertEqual(_required_scope(request), SERVER_FULL_ACCESS)


@override_settings(DEPLOYMENT_ENVIRONMENT="test")
class ProvisionLocalMachineAccessTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_superuser("local-owner", password="test")
        self.tenant = Tenant.objects.create(name="Local tenant", identifier="local", created_by=self.owner)

    def test_command_installs_and_rotates_secret_without_printing_it(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env.local"
            env_file.write_text("PUBLIC_SETTING=preserved\nexport ECEEE_API_KEY=old-secret\n", encoding="utf-8")
            os.chmod(env_file, 0o600)
            first_output = StringIO()

            call_command(
                "provision_local_machine_access",
                tenant=self.tenant.identifier,
                env_file=env_file,
                stdout=first_output,
            )
            first_key = MachineAPIKey.objects.get(name="Codex local CMS access")
            first_digest = first_key.key_hash
            first_contents = env_file.read_text(encoding="utf-8")

            second_output = StringIO()
            call_command(
                "provision_local_machine_access",
                tenant=self.tenant.identifier,
                env_file=env_file,
                stdout=second_output,
            )
            first_key.refresh_from_db()
            second_contents = env_file.read_text(encoding="utf-8")

            self.assertIn("machine_access=created credential=installed", first_output.getvalue())
            self.assertIn("machine_access=rotated credential=installed", second_output.getvalue())
            self.assertNotIn("mapi_", first_output.getvalue() + second_output.getvalue())
            self.assertIn("PUBLIC_SETTING=preserved", second_contents)
            self.assertEqual(second_contents.count("ECEEE_API_KEY="), 1)
            self.assertNotEqual(first_contents, second_contents)
            self.assertNotEqual(first_digest, first_key.key_hash)
            self.assertEqual(stat.S_IMODE(env_file.stat().st_mode), 0o600)
            self.assertEqual(MachineAPIKey.objects.filter(name="Codex local CMS access").count(), 1)

    def test_command_accepts_tenant_uuid(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env.local"

            call_command(
                "provision_local_machine_access",
                tenant=str(self.tenant.id),
                env_file=env_file,
            )

            credential = MachineAPIKey.objects.get(name="Codex local CMS access")
            self.assertEqual(list(credential.tenants.all()), [self.tenant])

    def test_command_rejects_an_unsafe_env_file_mode(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env.local"
            env_file.write_text("PUBLIC_SETTING=value\n", encoding="utf-8")
            os.chmod(env_file, 0o644)

            with self.assertRaisesMessage(CommandError, "env_file=mode_unsafe"):
                call_command(
                    "provision_local_machine_access",
                    tenant=self.tenant.identifier,
                    env_file=env_file,
                )

    def test_command_rejects_a_password_bearing_staff_principal(self):
        User.objects.create_user(username="codex-local", password="human-password", is_staff=True)

        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / ".env.local"

            with self.assertRaisesMessage(CommandError, "principal=existing_account_incompatible"):
                call_command(
                    "provision_local_machine_access",
                    tenant=self.tenant.identifier,
                    env_file=env_file,
                )

            self.assertFalse(env_file.exists())
            self.assertFalse(MachineAPIKey.objects.filter(name="Codex local CMS access").exists())
            self.assertFalse(self.tenant.members.filter(username="codex-local").exists())
