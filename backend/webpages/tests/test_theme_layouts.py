from copy import deepcopy
from importlib import import_module
from types import SimpleNamespace
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase

from core.models import Tenant
from webpages.models import PageTheme, WebPage
from webpages.serializers import PageVersionSerializer

from webpages.theme_layouts import (
    default_theme_layouts,
    legacy_compatibility_layout,
    theme_layout_usage,
    validate_layout_widgets,
    validate_layout_compatibility,
    validate_theme_layouts,
)


class ThemeLayoutValidationTests(SimpleTestCase):
    def test_default_layouts_are_valid_and_portable(self):
        document = default_theme_layouts()

        self.assertIs(validate_theme_layouts(document), document)

        self.assertEqual(document["default_layout_key"], "main_layout")
        self.assertEqual(
            {item["key"] for item in document["items"]},
            {"main_layout", "landing_page", "error_layout"},
        )

    def test_every_declared_slot_must_have_exactly_one_leaf(self):
        document = default_theme_layouts()
        document["items"][0]["slots"]["orphan"] = {"label": "Orphan"}

        with self.assertRaisesMessage(ValidationError, "exactly one node"):
            validate_theme_layouts(document)

    def test_required_layouts_cannot_be_removed(self):
        document = default_theme_layouts()
        document["items"] = [item for item in document["items"] if item["key"] != "landing_page"]

        with self.assertRaisesMessage(ValidationError, "Required layouts cannot be removed: landing_page"):
            validate_theme_layouts(document)

    def test_error_layout_has_visual_message_and_action_slots(self):
        layout = next(item for item in default_theme_layouts()["items"] if item["key"] == "error_layout")

        self.assertEqual(set(layout["slots"]), {"visual", "message", "actions"})
        self.assertEqual(layout["root"]["tag"], "main")

    def test_nodes_containing_slots_cannot_be_hidden(self):
        document = deepcopy(default_theme_layouts())
        document["items"][0]["root"]["styles"]["sm"] = {"display": "none"}

        with self.assertRaisesMessage(ValidationError, "cannot hide"):
            validate_theme_layouts(document)

    def test_hidden_slot_detection_normalizes_css_keywords(self):
        document = deepcopy(default_theme_layouts())
        document["items"][0]["root"]["styles"]["sm"] = {"display": " NONE "}

        with self.assertRaisesMessage(ValidationError, "cannot hide"):
            validate_theme_layouts(document)

    def test_named_layout_nodes_can_expose_allowlisted_designer_parameters(self):
        document = deepcopy(default_theme_layouts())
        root = document["items"][0]["root"]
        root["label"] = "Site frame"
        root["editable_parameters"] = ["width", "background_color"]

        self.assertIs(validate_theme_layouts(document), document)

        root["editable_parameters"] = ["position"]
        with self.assertRaisesMessage(ValidationError, "unsupported editable parameter"):
            validate_theme_layouts(document)

    def test_structural_nodes_cannot_expose_designer_parameters(self):
        document = deepcopy(default_theme_layouts())
        grid = next(node for node in document["items"][0]["root"]["children"][0]["children"] if node["type"] == "grid")
        grid["editable_parameters"] = ["gap"]

        with self.assertRaisesMessage(ValidationError, "only container, semantic, and slot"):
            validate_theme_layouts(document)

    def test_validates_editor_only_presentation_colours(self):
        document = deepcopy(default_theme_layouts())
        document["items"][0]["root"]["presentation_color"] = "#14b8a6"
        self.assertIs(validate_theme_layouts(document), document)

        document["items"][0]["root"]["presentation_color"] = "not-a-colour"
        with self.assertRaisesMessage(ValidationError, "presentation_color"):
            validate_theme_layouts(document)

    def test_raw_css_and_markup_are_rejected(self):
        document = deepcopy(default_theme_layouts())
        document["items"][0]["root"]["styles"]["base"]["background_color"] = "red;}</style><script>"

        with self.assertRaisesMessage(ValidationError, "unsafe structured style"):
            validate_theme_layouts(document)

    @patch("webpages.theme_layouts.theme_layout_usage", return_value={})
    def test_existing_layout_id_is_immutable(self, _usage):
        original = default_theme_layouts()
        updated = deepcopy(original)
        updated["items"][0]["id"] = "2cd4c8cc-fb24-44c1-9657-79f478166b79"

        with self.assertRaisesMessage(ValidationError, "immutable id"):
            validate_layout_compatibility(SimpleNamespace(layouts=original), updated)

    def test_referenced_legacy_layout_can_be_seeded_with_its_observed_slots(self):
        document = default_theme_layouts()
        document["items"].append(legacy_compatibility_layout("article_layout", {"lead", "main"}))

        self.assertIs(validate_theme_layouts(document), document)

    def test_widget_policies_reject_disallowed_types_and_enforce_finite_limits(self):
        theme = SimpleNamespace(layouts=default_theme_layouts())

        with self.assertRaisesMessage(ValidationError, "not allowed"):
            validate_layout_widgets(
                theme,
                "main_layout",
                {"main": [{"type": "easy_widgets.HeaderWidget"}]},
            )
        with self.assertRaisesMessage(ValidationError, "at most 1"):
            validate_layout_widgets(
                theme,
                "main_layout",
                {"header": [{"type": "easy_widgets.HeaderWidget"}, {"type": "easy_widgets.HeaderWidget"}]},
            )

        widgets = {"main": [{"type": "easy_widgets.ContentWidget"}] * 21}
        self.assertEqual(len(validate_layout_widgets(theme, "main_layout", widgets)["main"]), 21)

    def test_widget_policies_reject_malformed_slot_and_widget_shapes(self):
        theme = SimpleNamespace(layouts=default_theme_layouts())

        with self.assertRaisesMessage(ValidationError, "must be a list"):
            validate_layout_widgets(theme, "main_layout", {"main": {}})
        with self.assertRaisesMessage(ValidationError, "must have a type"):
            validate_layout_widgets(theme, "main_layout", {"main": [{"config": {}}]})

    def test_error_schema_consolidation_rejects_distinct_active_contracts(self):
        migration = import_module("webpages.migrations.0082_consolidate_error_layouts")
        schemas = [
            SimpleNamespace(is_active=True, schema={"properties": {"code": {"type": "string"}}}),
            SimpleNamespace(is_active=True, schema={"properties": {"retry": {"type": "boolean"}}}),
        ]

        with self.assertRaisesMessage(RuntimeError, "different page-data schemas"):
            migration.ensure_compatible_error_schemas(schemas)

        schemas[1].schema = deepcopy(schemas[0].schema)
        migration.ensure_compatible_error_schemas(schemas)


class ThemeLayoutUsageTests(TestCase):
    def test_inherited_versions_are_counted_only_for_their_effective_theme(self):
        user = User.objects.create_user("layout-usage", password="test")
        tenant = Tenant.objects.create(name="Layout usage", identifier="layout-usage", created_by=user)
        unrelated = PageTheme.objects.create(tenant=tenant, name="Unrelated", is_default=True, created_by=user)
        inherited = PageTheme.objects.create(tenant=tenant, name="Inherited", created_by=user)
        parent = WebPage.objects.create(
            tenant=tenant, title="Parent", slug="parent", created_by=user, last_modified_by=user
        )
        child = WebPage.objects.create(
            tenant=tenant, parent=parent, title="Child", slug="child", created_by=user, last_modified_by=user
        )
        parent_version = parent.create_version(user, "Parent draft")
        parent_version.theme = inherited
        parent_version.layout_key = "main_layout"
        parent_version.save(update_fields=["theme", "layout_key"])
        child.create_version(user, "Child draft")

        self.assertNotIn("main_layout", theme_layout_usage(unrelated))
        self.assertIn(str(child.id), theme_layout_usage(inherited)["main_layout"]["page_ids"])

    def test_page_version_serializer_enforces_database_layout_widget_policy(self):
        user = User.objects.create_user("layout-policy", password="test")
        tenant = Tenant.objects.create(name="Layout policy", identifier="layout-policy", created_by=user)
        theme = PageTheme.objects.create(tenant=tenant, name="Policy theme", is_default=True, created_by=user)
        page = WebPage.objects.create(
            tenant=tenant, title="Policy page", slug="policy", created_by=user, last_modified_by=user
        )
        version = page.create_version(user, "Policy draft")
        version.theme = theme
        version.layout_key = "main_layout"
        version.save(update_fields=["theme", "layout_key"])

        serializer = PageVersionSerializer(
            version,
            data={"widgets": {"main": [{"type": "easy_widgets.HeaderWidget", "config": {}}]}},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("widgets", serializer.errors)

    def test_page_version_serializer_revalidates_existing_widgets_when_layout_changes(self):
        user = User.objects.create_user("layout-change-policy", password="test")
        tenant = Tenant.objects.create(name="Layout change policy", identifier="layout-change-policy", created_by=user)
        theme = PageTheme.objects.create(tenant=tenant, name="Policy theme", is_default=True, created_by=user)
        page = WebPage.objects.create(
            tenant=tenant, title="Policy page", slug="policy-change", created_by=user, last_modified_by=user
        )
        version = page.create_version(user, "Policy draft")
        version.theme = theme
        version.layout_key = "error_layout"
        version.widgets = {"visual": [{"type": "easy_widgets.ImageWidget", "config": {}}]}
        version.save(update_fields=["theme", "layout_key", "widgets"])

        serializer = PageVersionSerializer(version, data={"layoutKey": "main_layout"}, partial=True)

        self.assertFalse(serializer.is_valid())
        self.assertIn("widgets", serializer.errors)
