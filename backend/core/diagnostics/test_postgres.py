"""Real PostgreSQL privileges and view isolation; run with postgres_test_settings only."""

import os
from io import StringIO
from unittest import skipUnless
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import DatabaseError, connections
from django.test import TransactionTestCase
from rest_framework.test import APIClient

from core.diagnostics.catalog import projections
from core.machine_api_keys import DIAGNOSTICS_DATA_READ, DIAGNOSTICS_GLOBAL_READ, generate_machine_api_key
from core.models import MachineAPIKey, Tenant

RUN_DIAGNOSTIC_POSTGRES = settings.SETTINGS_MODULE == "core.diagnostics.postgres_test_settings"


@skipUnless(
    RUN_DIAGNOSTIC_POSTGRES,
    "Dedicated disposable PostgreSQL settings required",
)
class PostgreSQLDiagnosticTests(TransactionTestCase):
    databases = {"default", "diagnostics"} if RUN_DIAGNOSTIC_POSTGRES else set()

    @classmethod
    def _databases_names(cls, include_mirrors=True):
        # Only flush the disposable application's database, never the read-only connection.
        return ["default"]

    def setUp(self):
        self.output = StringIO()
        with patch.dict(os.environ, {"DIAGNOSTICS_DB_PASSWORD": "test-diagnostics-only-password-00000000"}):
            call_command("provision_diagnostics_database", stdout=self.output)
            call_command("provision_diagnostics_database", stdout=self.output)
        self.user = User.objects.create_user(username="private@example.org", email="private@example.org", password=None)
        self.tenant = Tenant.objects.create(name="Private One", identifier="private-one", created_by=self.user)
        self.other = Tenant.objects.create(name="Private Two", identifier="private-two", created_by=self.user)
        secret, digest, prefix = generate_machine_api_key()
        self.key = MachineAPIKey.objects.create(
            name="pg-key",
            principal=self.user,
            created_by=self.user,
            key_hash=digest,
            key_prefix=prefix,
            environment="development",
            scopes=[DIAGNOSTICS_DATA_READ],
        )
        self.key.tenants.set([self.tenant])
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION="ApiKey " + secret)
        connections["diagnostics"].close()
        connections["diagnostics"].settings_dict["NAME"] = connections["default"].settings_dict["NAME"]

    def tearDown(self):
        connections["diagnostics"].close()

    def query(self, **extra):
        return self.client.post(
            "/api/v1/diagnostics/data/query/",
            {"table": "core_tenant", "tenants": "all_allowed", **extra},
            format="json",
        )

    def test_masked_queries_single_multi_tenant_and_filter_non_inference(self):
        response = self.query()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([str(row["id"]) for row in response.data["results"]], [str(self.tenant.pk)])
        self.assertEqual(response.data["results"][0]["name"], "[masked]")
        self.assertEqual(
            self.query(filters=[{"column": "name", "operator": "eq", "value": "Private One"}]).data["results"], []
        )
        self.key.tenants.set([self.tenant, self.other])
        self.assertEqual(len(self.query().data["results"]), 2)
        self.assertEqual(self.query(columns=["created_by_id"]).status_code, 400)
        self.assertEqual(
            self.query(filters=[{"column": "created_by_id", "operator": "eq", "value": 1}]).status_code, 400
        )

    def test_global_requires_scope_and_never_returns_original_personal_data(self):
        self.assertEqual(self.query(table="auth_user").status_code, 403)
        self.key.scopes.append(DIAGNOSTICS_GLOBAL_READ)
        self.key.save()
        response = self.query(table="auth_user", columns=["id", "username", "email"])
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["results"][0]["email"], "[masked]")
        self.assertEqual(self.query(table="auth_user", columns=["password"]).status_code, 400)
        self.assertEqual(self.query(table="core_machineapikey").status_code, 400)

    def test_read_role_cannot_read_raw_data_write_or_see_unset_context(self):
        connection = connections["diagnostics"]
        with connection.cursor() as cursor:
            for statement in (
                "SELECT password FROM public.auth_user",
                "SELECT name FROM public.core_tenant",
                "UPDATE public.core_tenant SET name='bad'",
                "CREATE TABLE public.diagnostic_forbidden(id int)",
            ):
                with self.assertRaises(DatabaseError):
                    cursor.execute(statement)
            cursor.execute("SELECT * FROM eceee_diagnostics.core_tenant")
            self.assertEqual(cursor.fetchall(), [])
        self.assertEqual(self.query().status_code, 200)
        with connection.cursor() as cursor:
            cursor.execute("SELECT NULLIF(current_setting('eceee_diagnostics.tenant_ids', true), '')")
            self.assertIsNone(cursor.fetchone()[0])
        self.assertEqual(
            self.query(filters=[{"column": "id", "operator": "eq", "value": "invalid-uuid"}]).status_code, 503
        )
        self.assertEqual(self.query().status_code, 200)
        with connection.cursor() as cursor:
            cursor.execute("SELECT NULLIF(current_setting('eceee_diagnostics.tenant_ids', true), '')")
            self.assertIsNone(cursor.fetchone()[0])

    def test_indirect_page_version_ownership_and_masked_content(self):
        from webpages.models import PageVersion, WebPage

        pages = []
        for tenant in (self.tenant, self.other):
            page = WebPage.objects.create(
                title="private@example.org",
                slug="private",
                tenant=tenant,
                created_by=self.user,
                last_modified_by=self.user,
            )
            version = PageVersion.objects.create(
                page=page,
                version_number=1,
                created_by=self.user,
                version_title="secret-original",
                page_data={"private": "private@example.org"},
            )
            pages.append((page, version))
        response = self.query(table="webpages_pageversion")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data["results"]), 1)
        row = response.data["results"][0]
        self.assertEqual(str(row["tenant_id"]), str(self.tenant.pk))
        self.assertEqual(row["version_title"], "[masked]")
        self.assertEqual(self.query(table="webpages_pageversion", columns=["page_data"]).status_code, 400)
        self.key.tenants.set([self.tenant, self.other])
        self.assertEqual(len(self.query(table="webpages_pageversion").data["results"]), 2)

    def test_pagination_and_injection_cannot_bypass_projected_columns(self):
        self.key.tenants.set([self.tenant, self.other])
        first = self.query(limit=1)
        self.assertEqual(first.status_code, 200)
        following = self.query(limit=1, cursor=first.data["next_cursor"])
        self.assertEqual(following.status_code, 200)
        self.assertNotEqual(first.data["results"][0]["id"], following.data["results"][0]["id"])
        self.assertEqual(self.query(table="core_tenant; SELECT password FROM auth_user").status_code, 400)
        self.assertEqual(self.query(sort=[{"column": "id;--", "direction": "asc"}]).status_code, 400)
        self.assertEqual(self.query(sql="SELECT password FROM auth_user").status_code, 400)

    def test_role_timeout_and_unsafe_public_grants_are_refused(self):
        with connections["diagnostics"].cursor() as cursor:
            cursor.execute("SHOW statement_timeout")
            self.assertEqual(cursor.fetchone()[0], "5s")
            cursor.execute("SET statement_timeout = '20ms'")
            with self.assertRaises(DatabaseError):
                cursor.execute("SELECT pg_sleep(0.1)")
        with connections["default"].cursor() as cursor:
            cursor.execute("GRANT SELECT ON public.core_tenant TO PUBLIC")
        try:
            with (
                patch.dict(os.environ, {"DIAGNOSTICS_DB_PASSWORD": "test-diagnostics-only-password-00000000"}),
                self.assertRaises(CommandError),
            ):
                call_command("provision_diagnostics_database", stdout=StringIO())
        finally:
            with connections["default"].cursor() as cursor:
                cursor.execute("REVOKE SELECT ON public.core_tenant FROM PUBLIC")

    def test_reprovision_removes_retired_views_and_columns(self):
        reviewed = projections()
        reviewed.pop("auth_user")
        tenant = reviewed["core_tenant"].copy()
        tenant["columns"] = {key: value for key, value in tenant["columns"].items() if key != "is_active"}
        reviewed["core_tenant"] = tenant
        with (
            patch("core.management.commands.provision_diagnostics_database.projections", return_value=reviewed),
            patch.dict(os.environ, {"DIAGNOSTICS_DB_PASSWORD": "test-diagnostics-only-password-00000000"}),
        ):
            call_command("provision_diagnostics_database", stdout=StringIO())
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT to_regclass('eceee_diagnostics.auth_user')")
            self.assertIsNone(cursor.fetchone()[0])
            cursor.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema='eceee_diagnostics' AND table_name='core_tenant'"
            )
            self.assertNotIn("is_active", [row[0] for row in cursor.fetchall()])
        with self.assertRaises(DatabaseError):
            with connections["diagnostics"].cursor() as cursor:
                cursor.execute("SELECT id FROM eceee_diagnostics.auth_user")

    def test_prepare_schema_change_removes_only_diagnostic_views(self):
        call_command("prepare_diagnostics_schema_change", stdout=StringIO())
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT to_regclass('eceee_diagnostics.core_tenant')")
            self.assertIsNone(cursor.fetchone()[0])
            cursor.execute("SELECT to_regclass('public.core_tenant')")
            self.assertIsNotNone(cursor.fetchone()[0])
