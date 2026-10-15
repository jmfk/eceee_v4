from unittest.mock import patch
from uuid import uuid4

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from content.models import Namespace
from core.models import Tenant
from data_connections.credentials import encrypt_connection_secrets, resolved_connection_config
from data_connections.models import DataConnection
from tenant_plugins.models import TenantPluginActivation


@override_settings(THEME_REMOTE_CREDENTIAL_KEYS=[Fernet.generate_key().decode()])
class TenantPluginApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("eceee-owner", password="test")
        self.other_owner = User.objects.create_user("other-owner", password="test")
        self.tenant = Tenant.objects.create(name="ECEEE", identifier="eceee_org", created_by=self.owner)
        self.other_tenant = Tenant.objects.create(name="Other", identifier="other", created_by=self.other_owner)
        self.namespace = Namespace.objects.create(
            name="ECEEE content",
            slug="eceee-content",
            tenant=self.tenant,
            created_by=self.owner,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)

    def test_catalog_lists_separate_legacy_and_proceedings_plugins(self):
        response = self.client.get("/api/v1/content-migration/plugins/")

        self.assertEqual(response.status_code, 200)
        plugins = {item["id"]: item for item in response.data["results"]}
        self.assertEqual(plugins["org.eceee.legacy_import"]["kind"], "import")
        self.assertEqual(plugins["org.eceee.proceedings"]["kind"], "feature")
        self.assertEqual(plugins["org.eceee.proceedings"]["status"], "foundation")

    def test_activation_is_tenant_scoped_and_exposes_registered_importer(self):
        response = self.client.post("/api/v1/content-migration/plugins/org.eceee.legacy_import/activation/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            TenantPluginActivation.objects.filter(
                tenant=self.tenant,
                plugin_id="org.eceee.legacy_import",
                is_active=True,
            ).exists()
        )
        importers = self.client.get("/api/v1/content-migration/importers/")
        self.assertEqual(importers.status_code, 200)
        self.assertEqual(importers.data["results"][0]["id"], "org.eceee.legacy_import.news")
        namespace_field = next(
            field for field in importers.data["results"][0]["fields"] if field["name"] == "namespace"
        )
        self.assertEqual(namespace_field["options"], [{"value": self.namespace.slug, "label": self.namespace.name}])

    def test_eceee_plugin_cannot_be_activated_for_another_tenant(self):
        self.client.force_authenticate(self.other_owner)
        self.client.credentials(HTTP_X_TENANT_ID=self.other_tenant.identifier)

        response = self.client.post("/api/v1/content-migration/plugins/org.eceee.legacy_import/activation/")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(TenantPluginActivation.objects.filter(tenant=self.other_tenant).exists())

    def test_stale_activation_does_not_expose_importer_to_incompatible_tenant(self):
        TenantPluginActivation.objects.create(
            tenant=self.other_tenant,
            plugin_id="org.eceee.legacy_import",
            plugin_version="1",
            activated_by=self.other_owner,
        )
        self.client.force_authenticate(self.other_owner)
        self.client.credentials(HTTP_X_TENANT_ID=self.other_tenant.identifier)

        response = self.client.get("/api/v1/content-migration/importers/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"], [])

    def test_eceee_plugin_is_compatible_with_production_copy_workspace(self):
        production_copy = Tenant.objects.create(
            name="ECEEE Production Copy",
            identifier="eceee-production-copy",
            created_by=self.owner,
        )
        self.client.credentials(HTTP_X_TENANT_ID=production_copy.identifier)

        response = self.client.get("/api/v1/content-migration/plugins/")

        self.assertEqual(response.status_code, 200)
        plugins = {item["id"]: item for item in response.data["results"]}
        self.assertTrue(plugins["org.eceee.legacy_import"]["compatible"])

    def test_eceee_plugin_is_compatible_with_default_production_workspace(self):
        default_tenant = Tenant.objects.create(
            name="Default Tenant",
            identifier="default",
            created_by=self.owner,
        )
        self.client.credentials(HTTP_X_TENANT_ID=default_tenant.identifier)

        response = self.client.get("/api/v1/content-migration/plugins/")

        self.assertEqual(response.status_code, 200)
        plugins = {item["id"]: item for item in response.data["results"]}
        self.assertTrue(plugins["org.eceee.legacy_import"]["compatible"])

    def test_connection_secrets_are_write_only_and_connections_are_tenant_scoped(self):
        response = self.client.post(
            "/api/v1/data-connections/connections/",
            {
                "name": "Legacy source",
                "connectionType": "LEGACY_API",
                "pluginId": "org.eceee.legacy_import",
                "config": {
                    "baseUrl": "https://www.eceee.org/api/migration/v1",
                },
                "secretConfig": {"token": "never-return-this"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertNotContains(response, "never-return-this", status_code=201)
        connection = DataConnection.objects.get(id=response.data["id"])
        self.assertEqual(connection.tenant, self.tenant)
        self.assertEqual(resolved_connection_config(connection)["token"], "never-return-this")

        self.client.force_authenticate(self.other_owner)
        self.client.credentials(HTTP_X_TENANT_ID=self.other_tenant.identifier)
        self.assertEqual(self.client.get("/api/v1/data-connections/connections/").data["results"], [])
        self.assertEqual(
            self.client.get(f"/api/v1/data-connections/connections/{connection.id}/").status_code,
            404,
        )

    def test_legacy_api_connection_requires_https_key_and_rejects_postgres(self):
        endpoint = "/api/v1/data-connections/connections/"
        common = {"name": "Legacy source", "pluginId": "org.eceee.legacy_import"}

        insecure = self.client.post(
            endpoint,
            {
                **common,
                "connectionType": "LEGACY_API",
                "config": {"baseUrl": "http://legacy.example/api/migration/v1"},
                "secretConfig": {"token": "test-token"},
            },
            format="json",
        )
        missing_key = self.client.post(
            endpoint,
            {
                **common,
                "connectionType": "LEGACY_API",
                "config": {"baseUrl": "https://legacy.example/api/migration/v1"},
            },
            format="json",
        )
        invalid_key = self.client.post(
            endpoint,
            {
                **common,
                "connectionType": "LEGACY_API",
                "config": {"baseUrl": "https://legacy.example/api/migration/v1"},
                "secretConfig": {"token": 123},
            },
            format="json",
        )
        deprecated = self.client.post(
            endpoint,
            {**common, "connectionType": "LEGACY_POSTGRES", "config": {}},
            format="json",
        )

        self.assertEqual(insecure.status_code, 400)
        self.assertEqual(missing_key.status_code, 400)
        self.assertEqual(invalid_key.status_code, 400)
        self.assertEqual(deprecated.status_code, 400)
        self.assertEqual(DataConnection.objects.filter(tenant=self.tenant).count(), 0)

    def test_legacy_api_connection_requires_a_token_secret_and_object_config(self):
        connection = DataConnection.objects.create(
            tenant=self.tenant,
            name="REST source",
            connection_type="EXTERNAL_REST",
            config={"baseUrl": "https://legacy.example/api/migration/v1"},
            encrypted_secrets=encrypt_connection_secrets({"password": "not-a-token"}),
            created_by=self.owner,
        )
        endpoint = f"/api/v1/data-connections/connections/{connection.id}/"

        converted = self.client.patch(endpoint, {"connectionType": "LEGACY_API"}, format="json")
        malformed = self.client.patch(endpoint, {"config": ["not", "an", "object"]}, format="json")

        self.assertEqual(converted.status_code, 400)
        self.assertEqual(malformed.status_code, 400)

    def test_existing_legacy_api_key_is_reused_and_deprecated_connection_can_be_deactivated(self):
        legacy_api = DataConnection.objects.create(
            tenant=self.tenant,
            name="Legacy API",
            connection_type="LEGACY_API",
            config={"baseUrl": "https://legacy.example/api/migration/v1"},
            encrypted_secrets=encrypt_connection_secrets({"token": "saved-token"}),
            created_by=self.owner,
        )
        deprecated = DataConnection.objects.create(
            tenant=self.tenant,
            name="Deprecated PostgreSQL",
            connection_type="LEGACY_POSTGRES",
            config={},
            created_by=self.owner,
        )

        api_response = self.client.patch(
            f"/api/v1/data-connections/connections/{legacy_api.id}/",
            {"description": "Updated without resubmitting the key"},
            format="json",
        )
        invalid_key_response = self.client.patch(
            f"/api/v1/data-connections/connections/{legacy_api.id}/",
            {"secretConfig": {"token": 0}},
            format="json",
        )
        deprecated_response = self.client.patch(
            f"/api/v1/data-connections/connections/{deprecated.id}/",
            {"isActive": False},
            format="json",
        )

        self.assertEqual(api_response.status_code, 200)
        self.assertEqual(invalid_key_response.status_code, 400)
        self.assertEqual(deprecated_response.status_code, 200)
        deprecated.refresh_from_db()
        self.assertFalse(deprecated.is_active)

    @patch("content_migration.views.run_plugin_import_job.delay")
    def test_job_creation_is_idempotent(self, delay):
        TenantPluginActivation.objects.create(
            tenant=self.tenant,
            plugin_id="org.eceee.legacy_import",
            plugin_version="2",
            activated_by=self.owner,
        )
        connection = DataConnection.objects.create(
            tenant=self.tenant,
            name="Legacy source",
            connection_type="LEGACY_API",
            created_by=self.owner,
        )
        key = str(uuid4())
        payload = {
            "importerId": "org.eceee.legacy_import.news",
            "connectionId": connection.id,
            "idempotencyKey": key,
            "options": {"namespace": self.namespace.slug, "limit": 100, "newestFirst": False, "resume": True},
        }

        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post("/api/v1/content-migration/plugin-jobs/", payload, format="json")
            second = self.client.post("/api/v1/content-migration/plugin-jobs/", payload, format="json")
            conflicting = self.client.post(
                "/api/v1/content-migration/plugin-jobs/",
                {**payload, "options": {**payload["options"], "limit": 2}},
                format="json",
            )

        self.assertEqual(first.status_code, 202)
        self.assertEqual(second.status_code, 202)
        self.assertEqual(first.data["id"], second.data["id"])
        self.assertEqual(first.data["options"]["newest_first"], False)
        self.assertEqual(conflicting.status_code, 409)
        delay.assert_called_once()
