import io
import json
import uuid
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
from easy_widgets.widgets.content import ContentWidget
from webpages.inheritance_tree import InheritanceTreeBuilder
from webpages.models import PageTheme, WebPage
from webpages.public_views import HostnamePageView
from webpages.renderers import WebPageRenderer
from webpages.serializers import PageDataSchemaSerializer, PageVersionSerializer
from webpages.serializers.version import validate_page_data_for_version
from webpages.theme_layout_renderer import render_theme_layout
from webpages.theme_layouts import (
    default_theme_layouts,
    legacy_compatibility_layout,
    theme_layout_usage,
    validate_layout_compatibility,
    validate_layout_widgets,
    validate_theme_layouts,
)
from webpages.views.page_version_views import PageVersionJSONParser, PageVersionJSONRenderer, PageVersionViewSet


class ThemeLayoutValidationTests(SimpleTestCase):
    @patch("webpages.serializers.version.PageDataSchema.get_effective_schema_for_layout")
    def test_page_data_schema_mismatch_is_a_reviewable_content_warning(self, get_schema):
        get_schema.return_value = {"groups": {"content": {"properties": {"headline": {"type": "string"}}}}}
        version = SimpleNamespace(code_layout="main_layout")
        warnings = []

        value = validate_page_data_for_version(version, {"headline": 42}, warnings=warnings)

        self.assertEqual(value, {"headline": 42})
        self.assertIn("Schema validation failed", warnings[0])

    @patch("webpages.renderers.InheritanceTreeHelpers")
    @patch("webpages.renderers.InheritanceTreeBuilder")
    def test_python_public_renderer_skips_disallowed_widgets(self, builder, helpers):
        disallowed = SimpleNamespace(type="easy_widgets.ContentWidget", config={})
        allowed = SimpleNamespace(
            id="allowed",
            type="easy_widgets.HeadlineWidget",
            config={},
            order=0,
            is_local=True,
            inheritance_behavior=SimpleNamespace(value="append"),
        )
        helpers.return_value.get_merged_widgets.return_value = [disallowed, allowed]
        renderer = WebPageRenderer()
        renderer.render_widget_json = lambda widget, context: widget["type"]
        page = SimpleNamespace()
        version = SimpleNamespace()
        context = {
            "theme_layout_definition": {"slots": {"main": {"allowed_widget_types": ["easy_widgets.HeadlineWidget"]}}}
        }

        result = renderer._render_widgets_by_slot(page, version, context)

        self.assertEqual([item["widget_data"]["type"] for item in result["main"]], ["easy_widgets.HeadlineWidget"])
        builder.return_value.build_tree.assert_called_once()

    def test_page_version_wire_preserves_widget_slot_identifiers(self):
        payload = {
            "version": {
                "version_number": 2,
                "widgets": {"landing_page": [{"type": "easy_widgets.ContentWidget", "config": {"fontSize": 14}}]},
            }
        }

        rendered = json.loads(PageVersionJSONRenderer().render(payload))

        self.assertEqual(rendered["version"]["versionNumber"], 2)
        self.assertEqual(list(rendered["version"]["widgets"]), ["landing_page"])
        self.assertEqual(rendered["version"]["widgets"]["landing_page"][0]["config"]["fontSize"], 14)

        incoming = {
            "expectedVersionId": 12,
            "pageData": {"ignoredSlotWarnings": ["landingPage:landing_page"]},
            "widgets": {
                "landingPage": [{"type": "easy_widgets.ContentWidget", "config": {"fontSize": 14, "showBorder": True}}]
            },
        }
        parsed = PageVersionJSONParser().parse(io.BytesIO(json.dumps(incoming).encode()))

        self.assertIn(PageVersionJSONParser, PageVersionViewSet.parser_classes)
        self.assertEqual(parsed["expected_version_id"], 12)
        self.assertEqual(parsed["page_data"]["ignored_slot_warnings"], ["landingPage:landing_page"])
        self.assertEqual(list(parsed["widgets"]), ["landingPage"])
        config = parsed["widgets"]["landingPage"][0]["config"]
        self.assertEqual(config["font_size"], 14)
        self.assertTrue(ContentWidget().prepare_template_context(config)["show_border"])

    def test_default_layouts_are_valid_and_portable(self):
        document = default_theme_layouts()

        self.assertIs(validate_theme_layouts(document), document)

        self.assertEqual(document["default_layout_key"], "mainLayout")
        self.assertEqual(
            {item["key"] for item in document["items"]},
            {"mainLayout", "landingPage", "errorLayout"},
        )

    def test_legacy_slot_warning_offers_safe_camel_case_conversion(self):
        theme = SimpleNamespace(layouts=default_theme_layouts())
        widgets = {"landing_page": [{"type": "easy_widgets.ContentWidget", "config": {}}]}
        warnings = []

        validate_layout_widgets(theme, "landingPage", widgets, previous_widgets=widgets, warnings=warnings)

        self.assertIn("Convert this slot to 'landingPage'", warnings[0])

        warnings = []
        validate_layout_widgets(
            theme,
            "landingPage",
            {**widgets, "landingPage": [{"type": "easy_widgets.HeadlineWidget", "config": {}}]},
            previous_widgets=widgets,
            warnings=warnings,
        )
        self.assertIn("Convert this slot to 'landingPage'", warnings[0])

    @patch("webpages.serializers.version.PageDataSchema.get_effective_schema_for_layout", return_value=None)
    @patch("webpages.theme_widgets.version_widget_theme")
    def test_ignored_slot_warning_stays_dismissed_for_the_page_version(self, resolve_theme, _get_schema):
        theme = SimpleNamespace(pk=1, id=1, layouts=default_theme_layouts())
        resolve_theme.return_value = theme
        widgets = {"landing_page": [{"id": str(uuid.uuid4()), "type": "easy_widgets.HeadlineWidget"}]}
        version = SimpleNamespace(
            theme=theme,
            theme_id=1,
            page=SimpleNamespace(parent=None),
            layout_key="landingPage",
            code_layout="landingPage",
            effective_date=None,
            widgets=widgets,
            page_data={},
        )
        parsed = CamelCaseJSONParser().parse(
            io.BytesIO(json.dumps({"pageData": {"ignoredSlotWarnings": ["landingPage:landing_page"]}}).encode())
        )
        self.assertEqual(parsed["page_data"]["ignored_slot_warnings"], ["landingPage:landing_page"])
        rendered = json.loads(PageVersionJSONRenderer().render({"page_data": parsed["page_data"]}))
        self.assertEqual(rendered["pageData"]["ignoredSlotWarnings"], ["landingPage:landing_page"])
        reviewed = PageVersionSerializer(
            version, data={"widgets": widgets, **parsed}, partial=True, context={"review_content_warnings": True}
        )
        self.assertTrue(reviewed.is_valid(), reviewed.errors)
        version.page_data = reviewed.validated_data["page_data"]
        reviewed_again = PageVersionSerializer(
            version, data={"widgets": widgets}, partial=True, context={"review_content_warnings": True}
        )
        self.assertTrue(reviewed_again.is_valid(), reviewed_again.errors)

    def test_default_page_layouts_use_descriptive_structure_and_plain_footer_wrappers(self):
        layouts = {layout["key"]: layout for layout in default_theme_layouts()["items"]}

        for key in ("mainLayout", "landingPage"):
            root = layouts[key]["root"]
            self.assertEqual(root["label"], "Viewport background")
            self.assertEqual(root["children"][0]["label"], "Page surface")
            footer = next(node for node in root["children"][0]["children"] if "Footer wrapper" == node.get("label"))
            self.assertEqual(footer["type"], "container")
            self.assertNotIn("tag", footer)

    def test_default_page_layouts_own_the_structural_rules_previously_supplied_by_legacy_css(self):
        layouts = {layout["key"]: layout for layout in default_theme_layouts()["items"]}
        main_nodes = list(self._walk_nodes(layouts["mainLayout"]["root"]))
        main = next(node for node in main_nodes if "main-layout-main" in node.get("class_names", []))

        self.assertEqual(main["styles"]["base"]["min_width"], "0")
        self.assertEqual(main["styles"]["base"]["padding"], "0")
        for layout in (layouts["mainLayout"], layouts["landingPage"]):
            footer = next(
                node for node in self._walk_nodes(layout["root"]) if "slot-footer" in node.get("class_names", [])
            )
            self.assertEqual(
                footer["styles"]["base"],
                {
                    "min_height": "310px",
                    "display": "flex",
                    "flex_direction": "column",
                    "flex_grow": "1",
                },
            )

    @staticmethod
    def _walk_nodes(node):
        yield node
        for child in node.get("children", []):
            yield from ThemeLayoutValidationTests._walk_nodes(child)

    def test_every_declared_slot_must_have_exactly_one_leaf(self):
        document = default_theme_layouts()
        document["items"][0]["slots"]["orphan"] = {"label": "Orphan"}

        with self.assertRaisesMessage(ValidationError, "exactly one node"):
            validate_theme_layouts(document)

    def test_required_layouts_cannot_be_removed(self):
        document = default_theme_layouts()
        document["items"] = [item for item in document["items"] if item["key"] != "landingPage"]

        with self.assertRaisesMessage(ValidationError, "Required layouts cannot be removed: landingPage"):
            validate_theme_layouts(document)

    def test_error_layout_has_visual_message_and_action_slots(self):
        layout = next(item for item in default_theme_layouts()["items"] if item["key"] == "errorLayout")

        self.assertEqual(set(layout["slots"]), {"visual", "message", "actions"})
        self.assertEqual(layout["root"]["tag"], "main")

    def test_default_error_pages_are_theme_owned_and_contain_editable_widgets(self):
        document = default_theme_layouts()
        error_pages = {page["status_code"]: page for page in document["special_pages"]}

        self.assertEqual(set(error_pages), {403, 404, 500, 503})
        self.assertEqual(error_pages[404]["layout_key"], "errorLayout")
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
                "layout_key": "mainLayout",
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
                    "layout_key": "mainLayout",
                    "widgets": {},
                }
            )

            with self.subTest(route=route), self.assertRaisesMessage(ValidationError, "reserved error path"):
                validate_theme_layouts(document)

    def test_special_routes_reject_ambiguous_path_segments(self):
        for route in ("account//login", "account/./login", "account/../login"):
            document = deepcopy(default_theme_layouts())
            document["special_pages"].append(
                {
                    "id": "e34d440b-36f9-479e-880d-ef9a898cab75",
                    "key": "ambiguous_route",
                    "label": "Ambiguous",
                    "kind": "route",
                    "route": route,
                    "layout_key": "mainLayout",
                    "widgets": {},
                }
            )

            with self.subTest(route=route), self.assertRaisesMessage(ValidationError, ".route is invalid"):
                validate_theme_layouts(document)

    def test_special_routes_cannot_shadow_system_routes(self):
        for route in ("api/health", "icon.svg", "admin/login", "static/site.css", "webpages/search"):
            document = deepcopy(default_theme_layouts())
            document["special_pages"].append(
                {
                    "id": "e34d440b-36f9-479e-880d-ef9a898cab75",
                    "key": "system_route",
                    "label": "System route",
                    "kind": "route",
                    "route": route,
                    "layout_key": "mainLayout",
                    "widgets": {},
                }
            )

            with self.subTest(route=route), self.assertRaisesMessage(ValidationError, "reserved system path"):
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
                "layout_key": "mainLayout",
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

    def test_public_renderer_resolves_theme_layout_without_injecting_python_layout_css(self):
        document = default_theme_layouts()
        theme = SimpleNamespace(layouts=document)
        page_version = SimpleNamespace(code_layout="mainLayout", page_custom_css="", page_css_variables={})
        python_layout = SimpleNamespace(name="mainLayout", css_content=".legacy-python-layout{height:310px}")
        renderer = WebPageRenderer()

        resolved = renderer._theme_layout_definition(theme, page_version, python_layout)
        css = renderer._collect_page_css(
            SimpleNamespace(),
            page_version,
            python_layout,
            None,
            {},
            include_legacy_layout_css=False,
        )

        self.assertEqual(resolved["key"], "mainLayout")
        self.assertNotIn("legacy-python-layout", css)

    def test_public_renderer_keeps_python_layout_css_disabled_even_if_requested(self):
        theme = SimpleNamespace(layouts={"default_layout_key": "mainLayout", "items": []})
        page_version = SimpleNamespace(code_layout="mainLayout", page_custom_css="", page_css_variables={})
        python_layout = SimpleNamespace(name="mainLayout", css_content=".legacy-python-layout{display:grid}")
        renderer = WebPageRenderer()

        self.assertIsNone(renderer._theme_layout_definition(theme, page_version, python_layout))
        css = renderer._collect_page_css(
            SimpleNamespace(),
            page_version,
            python_layout,
            None,
            {},
            include_legacy_layout_css=True,
        )
        self.assertNotIn("legacy-python-layout", css)

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

    def test_layout_height_accepts_safe_css_values(self):
        document = deepcopy(default_theme_layouts())
        root = document["items"][0]["root"]
        root["editable_parameters"] = ["height"]
        root["styles"]["base"]["height"] = "auto"
        root["styles"].setdefault("md", {})["height"] = "clamp(20rem, 60vh, 48rem)"

        self.assertIs(validate_theme_layouts(document), document)
        html = str(render_theme_layout(document["items"][0], {}))
        self.assertIn("height:auto", html)
        self.assertIn("height:clamp(20rem, 60vh, 48rem)", html)

    def test_layout_unitless_dimensions_render_as_pixels(self):
        document = deepcopy(default_theme_layouts())
        root = document["items"][0]["root"]
        root["styles"]["base"]["width"] = 960
        root["styles"]["base"]["height"] = "112"
        root["styles"].setdefault("md", {})["min_height"] = "240.5"
        root["styles"]["base"]["min_width"] = "0"

        self.assertIs(validate_theme_layouts(document), document)
        html = str(render_theme_layout(document["items"][0], {}))
        self.assertIn("width:960px", html)
        self.assertIn("height:112px", html)
        self.assertIn("min-height:240.5px", html)
        self.assertIn("min-width:0px", html)

    def test_legacy_layout_style_transfer_preserves_content_growth(self):
        migration = import_module("webpages.migrations.0085_transfer_legacy_layout_styles")
        document = default_theme_layouts()
        layout = next(item for item in document["items"] if item["key"] == "mainLayout")
        layout["key"] = "main_layout"  # This historical migration only saw pre-0092 documents.
        main_slot = next(
            node for node in self._walk_nodes(layout["root"]) if "slot-main" in node.get("class_names", [])
        )
        main_slot["styles"] = {"base": {"height": "310px"}}

        transferred, changed = migration.transfer_document(document)
        transferred_layout = next(item for item in transferred["items"] if item["key"] == "main_layout")
        transferred_main = next(
            node for node in self._walk_nodes(transferred_layout["root"]) if "slot-main" in node.get("class_names", [])
        )

        self.assertTrue(changed)
        self.assertNotIn("height", transferred_main["styles"]["base"])
        self.assertEqual(transferred_main["styles"]["base"]["min_height"], "310px")
        self.assertFalse(migration.transfer_document(transferred)[1])

    def test_grid_nodes_can_expose_designer_parameters(self):
        document = deepcopy(default_theme_layouts())
        grid = next(node for node in document["items"][0]["root"]["children"][0]["children"] if node["type"] == "grid")
        grid["editable_parameters"] = ["gap"]

        self.assertIs(validate_theme_layouts(document), document)

    def test_all_structural_nodes_can_expose_designer_parameters(self):
        document = deepcopy(default_theme_layouts())
        grid = next(node for node in document["items"][0]["root"]["children"][0]["children"] if node["type"] == "grid")
        grid["type"] = "row"
        grid["editable_parameters"] = ["gap"]

        self.assertIs(validate_theme_layouts(document), document)

    def test_validates_editor_only_presentation_colours(self):
        document = deepcopy(default_theme_layouts())
        document["items"][0]["root"]["type"] = "row"
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

    def test_widget_policies_allow_disallowed_types_on_save_and_enforce_finite_limits(self):
        theme = SimpleNamespace(layouts=default_theme_layouts())

        disallowed = {"main": [{"type": "easy_widgets.HeaderWidget"}]}
        warnings = []
        self.assertEqual(validate_layout_widgets(theme, "mainLayout", disallowed, warnings=warnings), disallowed)
        self.assertEqual(warnings, [])
        with self.assertRaisesMessage(ValidationError, "at most 1"):
            validate_layout_widgets(
                theme,
                "mainLayout",
                {"header": [{"type": "easy_widgets.HeaderWidget"}, {"type": "easy_widgets.HeaderWidget"}]},
            )

        widgets = {"main": [{"type": "easy_widgets.ContentWidget"}] * 21}
        self.assertEqual(len(validate_layout_widgets(theme, "mainLayout", widgets)["main"]), 21)

    def test_widget_policies_reject_malformed_slot_and_widget_shapes(self):
        theme = SimpleNamespace(layouts=default_theme_layouts())

        with self.assertRaisesMessage(ValidationError, "must be a list"):
            validate_layout_widgets(theme, "mainLayout", {"main": {}})
        with self.assertRaisesMessage(ValidationError, "must have a type"):
            validate_layout_widgets(theme, "mainLayout", {"main": [{"config": {}}]})
        warnings = []
        with self.assertRaisesMessage(ValidationError, "must have a type"):
            validate_layout_widgets(theme, "mainLayout", {"unused": [42]}, warnings=warnings)

    def test_disallowed_widget_remains_editable_in_any_declared_slot(self):
        theme = SimpleNamespace(layouts=default_theme_layouts())
        legacy = {"main": [{"id": "legacy", "type": "easy_widgets.HeaderWidget", "config": {}}]}

        edited = {"main": [{**legacy["main"][0], "config": {"label": "Edited"}}]}
        self.assertEqual(validate_layout_widgets(theme, "mainLayout", edited, previous_widgets=legacy), edited)

        added = {"main": [*legacy["main"], {"id": "new", "type": "easy_widgets.HeaderWidget"}]}
        self.assertEqual(validate_layout_widgets(theme, "mainLayout", added, previous_widgets=legacy), added)

        moved = {"footer": legacy["main"]}
        self.assertEqual(validate_layout_widgets(theme, "mainLayout", moved, previous_widgets=legacy), moved)

    def test_legacy_over_limit_slot_can_be_saved_but_not_expanded(self):
        theme = SimpleNamespace(layouts=default_theme_layouts())
        legacy = {
            "header": [
                {"id": "old-1", "type": "easy_widgets.HeaderWidget"},
                {"id": "old-2", "type": "easy_widgets.HeaderWidget"},
            ]
        }
        self.assertEqual(validate_layout_widgets(theme, "mainLayout", legacy, previous_widgets=legacy), legacy)
        with self.assertRaisesMessage(ValidationError, "at most 1"):
            validate_layout_widgets(
                theme,
                "mainLayout",
                {"header": [*legacy["header"], {"id": "new", "type": "easy_widgets.HeaderWidget"}]},
                previous_widgets=legacy,
            )

    @patch("webpages.theme_widgets.version_widget_theme")
    def test_version_serializer_keeps_legacy_widget_when_other_version_data_changes(self, resolve_theme):
        theme = SimpleNamespace(pk=1, id=1, layouts=default_theme_layouts())
        resolve_theme.return_value = theme
        existing = {"landingPage": [{"id": str(uuid.uuid4()), "type": "easy_widgets.ContentWidget", "config": {}}]}
        version = SimpleNamespace(
            theme=theme,
            theme_id=1,
            page=SimpleNamespace(parent=None),
            layout_key="landingPage",
            code_layout="landingPage",
            effective_date=None,
            widgets=existing,
        )

        unchanged = PageVersionSerializer(version, data={"widgets": existing}, partial=True)
        self.assertTrue(unchanged.is_valid(), unchanged.errors)

        reviewed_existing = PageVersionSerializer(
            version,
            data={"widgets": existing},
            partial=True,
            context={"review_content_warnings": True},
        )
        self.assertTrue(reviewed_existing.is_valid(), reviewed_existing.errors)

        changed_layout = PageVersionSerializer(
            version, data={"layout_key": "mainLayout", "widgets": existing}, partial=True
        )
        self.assertTrue(changed_layout.is_valid(), changed_layout.errors)

        added_to_inactive_slot = {
            "landingPage": [*existing["landingPage"], {"id": str(uuid.uuid4()), "type": "easy_widgets.ContentWidget"}]
        }
        added = PageVersionSerializer(
            version, data={"layout_key": "mainLayout", "widgets": added_to_inactive_slot}, partial=True
        )
        self.assertFalse(added.is_valid())
        self.assertIn("widgets", added.errors)

        new_widget = {
            "landingPage": [
                *existing["landingPage"],
                {"id": str(uuid.uuid4()), "type": "easy_widgets.ContentWidget", "config": {}},
            ]
        }
        added = PageVersionSerializer(version, data={"widgets": new_widget}, partial=True)
        self.assertTrue(added.is_valid(), added.errors)

        reviewed = PageVersionSerializer(
            version,
            data={"widgets": new_widget},
            partial=True,
            context={"review_content_warnings": True},
        )
        self.assertTrue(reviewed.is_valid(), reviewed.errors)

        acknowledged = PageVersionSerializer(
            version,
            data={"widgets": new_widget},
            partial=True,
            context={"review_content_warnings": True, "acknowledge_content_warnings": True},
        )
        self.assertTrue(acknowledged.is_valid(), acknowledged.errors)

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
    def test_new_page_version_inherits_ignored_slot_warnings(self):
        user = User.objects.create_user("slot-warning-owner", password="test")
        tenant = Tenant.objects.create(name="Slot warnings", identifier="slot-warnings", created_by=user)
        page = WebPage.objects.create(
            tenant=tenant, title="Test page", slug="test-page", created_by=user, last_modified_by=user
        )
        first = page.create_version(user, "Published version", auto_publish=True)
        second = page.create_version(user, "Second draft")
        second.page_data["ignored_slot_warnings"] = ["landingPage:landing_page"]
        second.save(update_fields=["page_data"])

        copied = page.create_version(user, "New version")
        self.assertEqual(copied.page_data["ignored_slot_warnings"], ["landingPage:landing_page"])
        third = first.create_draft_from_published(user, "Draft from published")
        self.assertEqual(third.page_data["ignored_slot_warnings"], ["landingPage:landing_page"])

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
        parent_version.layout_key = "mainLayout"
        parent_version.save(update_fields=["theme", "layout_key"])
        child.create_version(user, "Child draft")

        self.assertNotIn("mainLayout", theme_layout_usage(unrelated))
        self.assertIn(str(child.id), theme_layout_usage(inherited)["mainLayout"]["page_ids"])

    def test_page_version_serializer_saves_disallowed_widget_in_database_layout(self):
        user = User.objects.create_user("layout-policy", password="test")
        tenant = Tenant.objects.create(name="Layout policy", identifier="layout-policy", created_by=user)
        theme = PageTheme.objects.create(tenant=tenant, name="Policy theme", is_default=True, created_by=user)
        page = WebPage.objects.create(
            tenant=tenant, title="Policy page", slug="policy", created_by=user, last_modified_by=user
        )
        version = page.create_version(user, "Policy draft")
        version.theme = theme
        version.layout_key = "mainLayout"
        version.save(update_fields=["theme", "layout_key"])

        serializer = PageVersionSerializer(
            version,
            data={"widgets": {"main": [{"type": "easy_widgets.HeaderWidget", "config": {}}]}},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_page_version_serializer_preserves_existing_widgets_when_layout_changes(self):
        user = User.objects.create_user("layout-change-policy", password="test")
        tenant = Tenant.objects.create(name="Layout change policy", identifier="layout-change-policy", created_by=user)
        theme = PageTheme.objects.create(tenant=tenant, name="Policy theme", is_default=True, created_by=user)
        page = WebPage.objects.create(
            tenant=tenant, title="Policy page", slug="policy-change", created_by=user, last_modified_by=user
        )
        version = page.create_version(user, "Policy draft")
        version.theme = theme
        version.layout_key = "errorLayout"
        version.widgets = {"visual": [{"type": "easy_widgets.ImageWidget", "config": {}}]}
        version.save(update_fields=["theme", "layout_key", "widgets"])

        payload = CamelCaseJSONParser().parse(io.BytesIO(json.dumps({"layoutKey": "mainLayout"}).encode()))
        serializer = PageVersionSerializer(version, data=payload, partial=True)

        self.assertTrue(serializer.is_valid(), serializer.errors)

        reviewed = PageVersionSerializer(version, data=payload, partial=True, context={"review_content_warnings": True})
        self.assertFalse(reviewed.is_valid())
        self.assertIn("contentWarnings", reviewed.errors)

        acknowledged = PageVersionSerializer(
            version,
            data=payload,
            partial=True,
            context={"review_content_warnings": True, "acknowledge_content_warnings": True},
        )
        self.assertTrue(acknowledged.is_valid(), acknowledged.errors)

    def test_schema_serializer_accepts_layout_key_after_http_case_conversion(self):
        payload = CamelCaseJSONParser().parse(
            io.BytesIO(
                json.dumps(
                    {
                        "scope": "layout",
                        "layoutKey": "landingPage",
                        "schema": {"type": "object", "properties": {}},
                    }
                ).encode()
            )
        )
        serializer = PageDataSchemaSerializer(data=payload)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["layout_key"], "landingPage")

    def test_layout_policy_cannot_invalidate_widgets_already_in_use(self):
        user = User.objects.create_user("layout-policy-change", password="test")
        tenant = Tenant.objects.create(name="Layout policy change", identifier="layout-policy-change", created_by=user)
        theme = PageTheme.objects.create(tenant=tenant, name="Policy theme", is_default=True, created_by=user)
        page = WebPage.objects.create(
            tenant=tenant, title="Policy page", slug="policy-existing", created_by=user, last_modified_by=user
        )
        version = page.create_version(user, "Policy draft")
        version.theme = theme
        version.layout_key = "mainLayout"
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

        renamed = deepcopy(theme.layouts)
        renamed["items"][0]["slots"]["mainContent"] = renamed["items"][0]["slots"].pop("main")

        def rename_node(node):
            if node.get("slot_key") == "main":
                node["slot_key"] = "mainContent"
            for child in node.get("children", []):
                rename_node(child)

        rename_node(renamed["items"][0]["root"])
        self.assertIs(validate_layout_compatibility(theme, renamed), renamed)
