from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from webpages.theme_layouts import (
    default_theme_layouts,
    legacy_compatibility_layout,
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
