"""Replay the layout-column installation against PostgreSQL's catalog limits."""

from importlib import import_module

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase, tag

from webpages.theme_layouts import default_theme_layouts


@tag("historical_migration")
class ThemeLayoutInstallationTests(TransactionTestCase):
    def test_installs_defaults_for_existing_themes_without_large_sql_default(self):
        if connection.vendor != "postgresql":
            self.skipTest("PostgreSQL column-default catalog regression")

        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        before = [("webpages", "0079_remote_site_transfer")]
        after = [("webpages", "0080_theme_owned_layouts")]
        try:
            executor.migrate(before)
            old_apps = executor.loader.project_state(before).apps
            user = old_apps.get_model("auth", "User").objects.create(username="layout-migration-owner")
            Tenant = old_apps.get_model("core", "Tenant")
            Theme = old_apps.get_model("webpages", "PageTheme")
            theme_ids = []
            for index in range(2):
                tenant = Tenant.objects.create(
                    name=f"Tenant {index}", identifier=f"layout-migration-{index}", created_by_id=user.pk
                )
                theme_ids.append(
                    Theme.objects.create(name="Existing theme", tenant_id=tenant.pk, created_by_id=user.pk).pk
                )

            executor = MigrationExecutor(connection)
            executor.migrate(after)
            apps = executor.loader.project_state(after).apps
            Theme = apps.get_model("webpages", "PageTheme")
            for theme_id in theme_ids:
                self.assertEqual(Theme.objects.get(pk=theme_id).layouts, default_theme_layouts())
            self.assertEqual(Theme._meta.get_field("layouts").get_default(), default_theme_layouts())

            custom = default_theme_layouts()
            custom["items"][0]["label"] = "Custom tenant layout"
            Theme.objects.filter(pk=theme_ids[0]).update(layouts=custom)
            migration = import_module("webpages.migrations.0080_theme_owned_layouts")
            migration.backfill_layout_keys(apps, None)
            migration.backfill_layout_keys(apps, None)
            self.assertEqual(Theme.objects.get(pk=theme_ids[0]).layouts, custom)
            self.assertEqual(Theme.objects.get(pk=theme_ids[1]).layouts, default_theme_layouts())
        finally:
            MigrationExecutor(connection).migrate(latest)
