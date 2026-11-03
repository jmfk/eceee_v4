import copy
import importlib
from unittest import TestCase

from webpages.layout_key_names import canonical_theme_snapshot
from webpages.theme_layouts import default_theme_layouts, validate_theme_layouts


migration = importlib.import_module("webpages.migrations.0092_camel_case_layout_keys")


class LayoutKeyMigrationTests(TestCase):
    def legacy_layouts(self):
        document = copy.deepcopy(default_theme_layouts())
        reverse = {new: old for old, new in migration.LAYOUT_KEYS.items()}
        document["default_layout_key"] = reverse[document["default_layout_key"]]
        for item in document["items"]:
            item["key"] = reverse[item["key"]]
            if item["key"] == "landing_page":
                item["slots"]["landing_page"] = item["slots"].pop("landingPage")
        for page in document["special_pages"]:
            page["layout_key"] = reverse[page["layout_key"]]
        return document

    def test_defaults_are_camel_case_and_valid(self):
        document = default_theme_layouts()
        self.assertEqual([item["key"] for item in document["items"]], ["mainLayout", "landingPage", "errorLayout"])
        self.assertEqual(document["default_layout_key"], "mainLayout")
        validate_theme_layouts(document)

    def test_migration_changes_references_without_changing_ids(self):
        old = self.legacy_layouts()
        old_ids = [item["id"] for item in old["items"]]
        migrated = migration.rename_layouts(old)
        self.assertEqual([item["id"] for item in migrated["items"]], old_ids)
        self.assertEqual([item["key"] for item in migrated["items"]], ["mainLayout", "landingPage", "errorLayout"])
        self.assertEqual(migrated["default_layout_key"], "mainLayout")
        self.assertEqual({page["layout_key"] for page in migrated["special_pages"]}, {"errorLayout"})
        self.assertIn("landingPage", migrated["items"][1]["slots"])
        validate_theme_layouts(migrated)
        self.assertEqual(migration.rename_layouts(migrated), migrated)

    def test_historical_snapshot_is_normalized_on_restore(self):
        old = self.legacy_layouts()
        snapshot = {
            "layouts": old,
            "designer_preview": {"views": [{"layout": "main_layout", "content": {"codeLayout": "landing_page"}}]},
        }
        result = canonical_theme_snapshot(snapshot)
        self.assertEqual(result["layouts"]["default_layout_key"], "mainLayout")
        self.assertEqual(result["designer_preview"]["views"][0]["content"]["codeLayout"], "landingPage")
        self.assertEqual(snapshot["layouts"]["default_layout_key"], "main_layout")
        validate_theme_layouts(result["layouts"])

    def test_collision_refuses_to_discard_a_layout(self):
        old = self.legacy_layouts()
        duplicate = copy.deepcopy(old["items"][0])
        duplicate["key"] = "mainLayout"
        old["items"].append(duplicate)
        with self.assertRaisesRegex(RuntimeError, "Both main_layout and mainLayout"):
            migration.rename_layouts(old)

    def test_landing_widgets_are_kept_and_ordered(self):
        old = {"landing_page": [{"id": "old"}], "landingPage": [{"id": "new"}], "main": []}
        migrated = migration.rename_landing_widgets(old)
        self.assertEqual([item["id"] for item in migrated["landingPage"]], ["old", "new"])
        self.assertNotIn("landing_page", migrated)
        self.assertEqual(old["landing_page"][0]["id"], "old")
        self.assertEqual(migration.rename_landing_widgets(migrated), migrated)

    def test_preview_renaming_does_not_add_missing_fields(self):
        preview = {"views": [{"label": "Plain"}, {"layout": "error_layout", "content": {"title": "Error"}}]}
        migrated = migration.rename_preview(preview)
        self.assertEqual(migrated["views"][0], {"label": "Plain"})
        self.assertEqual(migrated["views"][1]["content"], {"title": "Error"})
        self.assertEqual(migrated["views"][1]["layout"], "errorLayout")
