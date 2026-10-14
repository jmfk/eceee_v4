import io
import json
from copy import deepcopy
from importlib import import_module
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase
from django.utils.safestring import mark_safe
from djangorestframework_camel_case.parser import CamelCaseJSONParser

from core.models import Tenant
from webpages.inheritance_tree import InheritanceTreeBuilder
from webpages.models import PageTheme, WebPage
from webpages.public_views import HostnamePageView
from webpages.serializers import PageDataSchemaSerializer, PageVersionSerializer
from webpages.theme_layout_renderer import render_theme_layout
from webpages.theme_layouts import (
    default_theme_layouts,
    legacy_compatibility_layout,
    theme_layout_usage,
    validate_layout_compatibility,
    validate_layout_widgets,
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

    def test_default_page_layouts_use_descriptive_structure_and_plain_footer_wrappers(self):
        layouts = {layout["key"]: layout for layout in default_theme_layouts()["items"]}

        for key in ("main_layout", "landing_page"):
            root = layouts[key]["root"]
            self.assertEqual(root["label"], "Viewport background")
            self.assertEqual(root["children"][0]["label"], "Page surface")
            footer = next(node for node in root["children"][0]["children"] if "Footer wrapper" == node.get("label"))
            self.assertEqual(footer["type"], "container")
            self.assertNotIn("tag", footer)

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

    def test_default_error_pages_are_theme_owned_and_contain_editable_widgets(self):
        document = default_theme_layouts()
        error_pages = {page["status_code"]: page for page in document["special_pages"]}

        self.assertEqual(set(error_pages), {403, 404, 500, 503})
        self.assertEqual(error_pages[404]["layout_key"], "error_layout")
        self.assertEqual(error_pages[404]["widgets"]["message"][0]["type"], "easy_widgets.HeadlineWidget")

    def test_special_route_pages_validate_layout_slots_and_widget_limits(self):
        document = deepcopy(default_theme_layouts())
        document["special_pages"].append(
            {
                "id": "e34d440b-36f9-479e-880d-ef9a898cab75",
                "key": "login",
                "label": "Log in",
                "kind": "route",
                "route": "login",
                "layout_key": "main_layout",
                "widgets": {
                    "main": [
                        {
                            "id": "widget-79dbecbb-087b-4fbf-a818-782a0238991d",
                            "type": "easy_widgets.ContentWidget",
                            "config": {"content": "<p>Log in</p>"},
                        }
                    ]
                },
            }
        )

        self.assertIs(validate_theme_layouts(document), document)

        document["special_pages"][-1]["widgets"] = {"missing": []}
        with self.assertRaisesMessage(ValidationError, "declared layout slot"):
            validate_theme_layouts(document)

    def test_special_routes_cannot_use_reserved_error_subtrees(self):
        for route in ("403", "404/help", "500/details", "503/status", "theme-error-status/403"):
            document = deepcopy(default_theme_layouts())
            document["special_pages"].append(
                {
                    "id": "e34d440b-36f9-479e-880d-ef9a898cab75",
                    "key": "reserved_route",
                    "label": "Reserved",
                    "kind": "route",
                    "route": route,
                    "layout_key": "main_layout",
                    "widgets": {},
                }
            )

            with self.subTest(route=route), self.assertRaisesMessage(ValidationError, "reserved error path"):
                validate_theme_layouts(document)

    def test_required_theme_error_pages_cannot_be_removed(self):
        document = deepcopy(default_theme_layouts())
        document["special_pages"] = [page for page in document["special_pages"] if page["status_code"] != 503]

        with self.assertRaisesMessage(ValidationError, "Required error pages cannot be removed: 503"):
            validate_theme_layouts(document)

    def test_public_error_and_route_lookup_uses_theme_special_pages(self):
        document = default_theme_layouts()
        document["special_pages"].append(
            {
                "id": "3f288deb-5487-47c4-84da-3d69a65b7384",
                "key": "login",
                "label": "Log in",
                "kind": "route",
                "route": "account/login",
                "layout_key": "main_layout",
                "widgets": {},
            }
        )
        theme = SimpleNamespace(layouts=document)
        root = SimpleNamespace(
            get_current_published_version=lambda: SimpleNamespace(theme_id=1, theme=theme),
        )
        view = HostnamePageView()

        self.assertEqual(view._get_error_page(root, 404)["key"], "error_404")
        self.assertEqual(view._get_special_page(root, kind="route", route="/account/login/")["key"], "login")

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

    def test_grid_nodes_can_expose_designer_parameters(self):
        document = deepcopy(default_theme_layouts())
        grid = next(node for node in document["items"][0]["root"]["children"][0]["children"] if node["type"] == "grid")
        grid["editable_parameters"] = ["gap"]

        self.assertIs(validate_theme_layouts(document), document)

    def test_non_editable_structural_nodes_cannot_expose_designer_parameters(self):
        document = deepcopy(default_theme_layouts())
        grid = next(node for node in document["items"][0]["root"]["children"][0]["children"] if node["type"] == "grid")
        grid["type"] = "row"
        grid["editable_parameters"] = ["gap"]

        with self.assertRaisesMessage(ValidationError, "only container, grid, semantic, and slot"):
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

    def test_layouts_accept_theme_fonts_palette_tokens_and_https_background_images(self):
        document = deepcopy(default_theme_layouts())
        styles = document["items"][0]["root"]["styles"]["base"]
        styles.update(
            {
                "background_color": "token:surface",
                "background_image": "https://cdn.example.test/theme/hero.webp",
                "background_position": "center center",
                "background_repeat": "no-repeat",
                "background_size": "cover",
                "font_family": "Inter, sans-serif",
            }
        )

        self.assertIs(validate_theme_layouts(document), document)

        styles["background_image"] = "javascript:alert(1)"
        with self.assertRaisesMessage(ValidationError, "unsafe background image URL"):
            validate_theme_layouts(document)

        styles["background_image"] = "https://[invalid"
        with self.assertRaisesMessage(ValidationError, "unsafe background image URL"):
            validate_theme_layouts(document)

    def test_server_renderer_ignores_malformed_background_image_urls(self):
        layout = deepcopy(default_theme_layouts()["items"][0])
        layout["root"]["styles"]["base"]["background_image"] = "https://[invalid"

        html = str(render_theme_layout(layout, {}))

        self.assertNotIn("background-image", html)

    def test_server_renderer_matches_theme_layout_styles_and_slot_placement(self):
        layout = deepcopy(default_theme_layouts()["items"][0])
        layout["root"]["styles"]["base"].update(
            {
                "background_color": "token:surface",
                "background_image": "https://cdn.example.test/hero.webp",
                "font_family": "Inter, sans-serif",
            }
        )
        html = str(
            render_theme_layout(
                layout,
                {"main": [{"html": mark_safe('<div data-widget-id="widget-1">Hello</div>')}]},
                {"sm": 700},
            )
        )

        self.assertIn("background-color:var(--surface)", html)
        self.assertIn('background-image:url("https://cdn.example.test/hero.webp")', html)
        self.assertIn("font-family:Inter, sans-serif", html)
        self.assertIn('data-slot-name="main"', html)
        self.assertIn('data-widget-id="widget-1"', html)

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
    def test_inheritance_tree_uses_custom_theme_layout_slot_policies(self):
        user = User.objects.create_user("layout-tree-policy", password="test")
        tenant = Tenant.objects.create(name="Layout tree policy", identifier="layout-tree-policy", created_by=user)
        layouts = default_theme_layouts()
        custom_layout = legacy_compatibility_layout("article_layout", {"body"})
        custom_layout["slots"]["body"]["allows_inheritance"] = False
        custom_layout["slots"]["body"]["allow_merge"] = False
        layouts["items"].append(custom_layout)
        theme = PageTheme.objects.create(
            tenant=tenant, name="Policy theme", is_default=True, created_by=user, layouts=layouts
        )
        page = WebPage.objects.create(
            tenant=tenant, title="Article", slug="article", created_by=user, last_modified_by=user
        )
        version = page.create_version(user, "Article draft")
        version.theme = theme
        version.layout_key = "article_layout"
        version.save(update_fields=["theme", "layout_key"])
        builder = InheritanceTreeBuilder()

        builder.build_tree(page, target_version=version)

        body = next(slot for slot in builder.effective_slot_configuration()["slots"] if slot["name"] == "body")
        self.assertFalse(body["allows_inheritance"])
        self.assertFalse(body["allow_merge"])

    def test_usage_lookup_does_not_assign_or_version_a_default_theme(self):
        user = User.objects.create_user("layout-usage-read-only", password="test")
        tenant = Tenant.objects.create(
            name="Layout usage read only", identifier="layout-usage-read-only", created_by=user
        )
        theme = PageTheme.objects.create(tenant=tenant, name="Only active theme", created_by=user)
        original_sync_version = theme.sync_version

        theme_layout_usage(theme)

        theme.refresh_from_db()
        self.assertFalse(theme.is_default)
        self.assertEqual(theme.sync_version, original_sync_version)

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

        payload = CamelCaseJSONParser().parse(io.BytesIO(json.dumps({"layoutKey": "main_layout"}).encode()))
        serializer = PageVersionSerializer(version, data=payload, partial=True)

        self.assertFalse(serializer.is_valid())
        self.assertIn("widgets", serializer.errors)

    def test_schema_serializer_accepts_layout_key_after_http_case_conversion(self):
        payload = CamelCaseJSONParser().parse(
            io.BytesIO(
                json.dumps(
                    {
                        "scope": "layout",
                        "layoutKey": "landing_page",
                        "schema": {"type": "object", "properties": {}},
                    }
                ).encode()
            )
        )
        serializer = PageDataSchemaSerializer(data=payload)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["layout_key"], "landing_page")

    def test_layout_policy_cannot_invalidate_widgets_already_in_use(self):
        user = User.objects.create_user("layout-policy-change", password="test")
        tenant = Tenant.objects.create(name="Layout policy change", identifier="layout-policy-change", created_by=user)
        theme = PageTheme.objects.create(tenant=tenant, name="Policy theme", is_default=True, created_by=user)
        page = WebPage.objects.create(
            tenant=tenant, title="Policy page", slug="policy-existing", created_by=user, last_modified_by=user
        )
        version = page.create_version(user, "Policy draft")
        version.theme = theme
        version.layout_key = "main_layout"
        version.widgets = {
            "main": [
                {"type": "easy_widgets.ContentWidget", "config": {}},
                {"type": "easy_widgets.ContentWidget", "config": {}},
            ]
        }
        version.save(update_fields=["theme", "layout_key", "widgets"])

        limited = deepcopy(theme.layouts)
        limited["items"][0]["slots"]["main"]["max_widgets"] = 1
        with self.assertRaisesMessage(ValidationError, "cannot be limited to 1"):
            validate_layout_compatibility(theme, limited)

        restricted = deepcopy(theme.layouts)
        restricted["items"][0]["slots"]["main"]["allowed_widget_types"] = ["easy_widgets.HeadlineWidget"]
        restricted["items"][0]["slots"]["main"].pop("disallowed_widget_types", None)
        with self.assertRaisesMessage(ValidationError, "ContentWidget"):
            validate_layout_compatibility(theme, restricted)
