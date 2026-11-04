import copy
import importlib
from types import SimpleNamespace

from django.apps import apps
from django.contrib.auth.models import User
from django.db import connection
from django.test import SimpleTestCase, TestCase

from core.models import Tenant
from webpages.layout_key_names import canonical_layout_document, canonical_preview, canonical_slot_widgets
from webpages.models import PageTheme, WebPage
from webpages.theme_layouts import default_theme_layouts, validate_theme_layouts

migration = importlib.import_module("webpages.migrations.0093_camel_case_slot_keys")


class SlotKeyMigrationHelpersTests(SimpleTestCase):
    def test_layout_preview_and_special_pages_keep_widgets_and_ids(self):
        document = copy.deepcopy(default_theme_layouts())
        landing = next(item for item in document["items"] if item["key"] == "landingPage")
        landing["slots"]["landing_page"] = landing["slots"].pop("landingPage")

        def use_legacy_slot(node):
            if node.get("slot_key") == "landingPage":
                node["slot_key"] = "landing_page"
            for child in node.get("children", []):
                use_legacy_slot(child)

        use_legacy_slot(landing["root"])
        validate_theme_layouts(migration.rename_layouts(document))
        document["special_pages"][0]["layout_key"] = "landingPage"
        document["special_pages"][0]["widgets"] = {"landing_page": [{"id": "special"}]}
        preview = {"views": [{"layout": "landingPage", "content": {"widgets": {"landing_page": [{"id": "preview"}]}}}]}

        migrated = migration.rename_layouts(document)
        migrated_preview = migration.rename_preview(preview, migrated)

        self.assertEqual(migrated["items"][1]["id"], landing["id"])
        self.assertIn("landingPage", migrated["items"][1]["slots"])
        self.assertEqual(migrated["special_pages"][0]["widgets"]["landingPage"], [{"id": "special"}])
        self.assertEqual(migrated_preview["views"][0]["content"]["widgets"]["landingPage"], [{"id": "preview"}])
        self.assertEqual(migration.rename_layouts(migrated), migrated)

    def test_widget_merge_is_ordered_and_declared_slot_collision_aborts(self):
        widgets = {"landing_page": [{"id": "old"}], "landingPage": [{"id": "new"}]}
        self.assertEqual(
            migration.rename_widgets(widgets, {"landingPage"})["landingPage"],
            [{"id": "old"}, {"id": "new"}],
        )
        self.assertEqual(migration.rename_widgets(widgets, set()), widgets)
        self.assertEqual(migration.rename_widgets({"slot_2": [{"id": "generated"}]})["slot2"], [{"id": "generated"}])
        document = copy.deepcopy(default_theme_layouts())
        document["items"][1]["slots"]["landing_page"] = copy.deepcopy(document["items"][1]["slots"]["landingPage"])
        with self.assertRaisesRegex(RuntimeError, "both landing_page and landingPage"):
            migration.rename_layouts(document)

    def test_restoring_historical_snapshots_normalizes_known_slots(self):
        document = copy.deepcopy(default_theme_layouts())
        landing = document["items"][1]
        landing["slots"]["landing_page"] = landing["slots"].pop("landingPage")
        normalized = canonical_layout_document(document)
        self.assertIn("landingPage", normalized["items"][1]["slots"])
        self.assertEqual(canonical_slot_widgets({"content_grid": [{"id": "one"}]})["contentGrid"], [{"id": "one"}])
        self.assertEqual(canonical_slot_widgets({"slot_2": [{"id": "generated"}]})["slot2"], [{"id": "generated"}])
        normalized["items"][0]["slots"]["secondarySidebar"] = {}
        preview = {"views": [{"layout": "mainLayout", "content": {"widgets": {"secondary_sidebar": [{"id": "two"}]}}}]}
        self.assertEqual(
            canonical_preview(preview, normalized)["views"][0]["content"]["widgets"]["secondarySidebar"],
            [{"id": "two"}],
        )


class SlotKeyMigrationDatabaseTests(TestCase):
    def test_upgrade_moves_residual_landing_widgets_when_only_code_layout_is_set(self):
        user = User.objects.create_user("slot-migration", password="test")
        tenant = Tenant.objects.create(name="Slot migration", identifier="slot-migration", created_by=user)
        theme = PageTheme.objects.create(tenant=tenant, name="Slot migration theme", is_default=True, created_by=user)
        page = WebPage.objects.create(
            tenant=tenant, title="Landing", slug="landing", created_by=user, last_modified_by=user
        )
        version = page.create_version(user, "Legacy landing")
        second = page.create_version(user, "Inherited layout")
        widgets = {"landing_page": [{"id": "legacy", "type": "easy_widgets.ContentWidget", "config": {}}]}
        type(version).objects.filter(pk=version.pk).update(layout_key="", code_layout="landingPage", widgets=widgets)

        legacy_layouts = copy.deepcopy(theme.layouts)
        main = next(item for item in legacy_layouts["items"] if item["key"] == "mainLayout")
        main["slots"]["content_grid"] = main["slots"].pop("main")

        def use_legacy_slot(node):
            if node.get("slot_key") == "main":
                node["slot_key"] = "content_grid"
            for child in node.get("children", []):
                use_legacy_slot(child)

        use_legacy_slot(main["root"])
        PageTheme.objects.filter(pk=theme.pk).update(layouts=legacy_layouts)
        type(second).objects.filter(pk=second.pk).update(
            layout_key="mainLayout",
            code_layout="mainLayout",
            theme=None,
            widgets={"content_grid": [{"id": "inherited", "type": "easy_widgets.ContentWidget", "config": {}}]},
        )

        migration.migrate_slot_keys(apps, SimpleNamespace(connection=connection))

        version.refresh_from_db()
        second.refresh_from_db()
        theme.refresh_from_db()
        self.assertEqual(version.widgets, {"landingPage": widgets["landing_page"]})
        self.assertIn("contentGrid", theme.layouts["items"][0]["slots"])
        self.assertEqual(second.widgets["contentGrid"][0]["id"], "inherited")
        migration.migrate_slot_keys(apps, SimpleNamespace(connection=connection))
        second.refresh_from_db()
        self.assertEqual(len(second.widgets["contentGrid"]), 1)
