"""Pure contract tests; no database or infrastructure required."""

import copy
import unittest
from types import SimpleNamespace

from django.core.exceptions import ValidationError

from webpages.theme_widgets import (
    compile_css,
    compile_definition,
    empty_widget_types,
    find_definition,
    publish_widget_types,
    retain_released_history,
    validate_instances,
    validate_widget_types,
)

TYPE_ID = "2bf85f1b-26cc-4801-8cfa-bb680f93e256"
TYPE = f"theme_widgets.{TYPE_ID}"


def working_document():
    return {
        "version": 1,
        "items": [
            {
                "id": TYPE_ID,
                "name": "Person card",
                "active_version": 0,
                "releases": [],
                "working": {
                    "schema": {
                        "type": "object",
                        "properties": {"personName": {"type": "string"}},
                        "required": ["personName"],
                    },
                    "template": '<article class="person"><h2>{{personName}}</h2></article>',
                    "css": ".person { color: red; }",
                },
            }
        ],
    }


class ThemeWidgetContractTests(unittest.TestCase):
    def test_rejects_external_schema_references_and_unsupported_field_controls(self):
        for schema in [
            {"type": "object", "additionalProperties": {"$ref": "https://example.test/schema"}},
            {"type": "object", "required": "not-an-array"},
            {"type": "object", "properties": {"title": {"type": "string", "controlType": "custom_code"}}},
        ]:
            with self.subTest(schema=schema), self.assertRaises(ValidationError):
                compile_definition({"schema": schema, "template": "<p>Example</p>"}, TYPE_ID, 1)

    def test_releases_are_pinned_and_working_definitions_are_not_public(self):
        draft = working_document()
        self.assertIsNone(find_definition(SimpleNamespace(widget_types=draft), TYPE, 1))
        first = publish_widget_types(draft, empty_widget_types())
        second_draft = copy.deepcopy(first)
        second_draft["items"][0]["working"] = {**first["items"][0]["releases"][0], "template": "<p>{{personName}}</p>"}
        second = publish_widget_types(second_draft, first)
        self.assertEqual(
            find_definition(SimpleNamespace(widget_types=second), TYPE, 1).render({"personName": "Alex"}),
            '<article class="person"><h2>Alex</h2></article>',
        )
        self.assertEqual(
            find_definition(SimpleNamespace(widget_types=second), TYPE, 2).render({"personName": "Alex"}), "<p>Alex</p>"
        )
        self.assertEqual(second["items"][0]["active_version"], 2)

    def test_unchanged_working_definition_does_not_append_release(self):
        first = publish_widget_types(working_document(), empty_widget_types())
        draft = copy.deepcopy(first)
        draft["items"][0]["working"] = copy.deepcopy(first["items"][0]["releases"][0])
        self.assertEqual(publish_widget_types(draft, first), first)

    def test_released_history_cannot_be_mutated_or_deleted(self):
        first = publish_widget_types(working_document(), empty_widget_types())
        mutated = copy.deepcopy(first)
        mutated["items"][0]["releases"][0] = compile_definition(
            {**first["items"][0]["releases"][0], "template": "<p>Changed</p>"}, TYPE_ID, 1
        )
        for document in [mutated, empty_widget_types()]:
            with self.subTest(document=document), self.assertRaises(ValidationError):
                validate_widget_types(document, previous=first)

    def test_restore_retains_and_archives_releases_missing_from_snapshot(self):
        first = publish_widget_types(working_document(), empty_widget_types())
        restored = retain_released_history(empty_widget_types(), first)
        self.assertEqual(restored["items"][0]["status"], "archived")
        self.assertIsNotNone(find_definition(SimpleNamespace(widget_types=restored), TYPE, 1))
        validate_widget_types(restored, previous=first)

    def test_nested_instances_require_explicit_revision_and_validate_config(self):
        theme = SimpleNamespace(widget_types=publish_widget_types(working_document(), empty_widget_types()))
        widget = {"id": "person", "type": TYPE, "type_version": 1, "config": {"person_name": "Alex"}}
        validate_instances(theme, {"main": [{"type": "container", "config": {"slots": {"left": [widget]}}}]})
        self.assertEqual(widget["config"], {"personName": "Alex"})
        for invalid in [
            {**widget, "type_version": None},
            {**widget, "typeVersion": 2},
            {**widget, "type_version": 2},
            {**widget, "config": {}},
            {**widget, "type_version": True},
        ]:
            with self.subTest(widget=invalid), self.assertRaises(ValidationError):
                validate_instances(theme, {"main": [invalid]})

    def test_theme_switch_requires_identical_releases(self):
        first = publish_widget_types(working_document(), empty_widget_types())
        other = copy.deepcopy(first)
        other["items"][0]["releases"][0] = compile_definition(
            {**first["items"][0]["releases"][0], "css": ".person { color: blue }"}, TYPE_ID, 1
        )
        widget = {"type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}
        with self.assertRaises(ValidationError):
            validate_instances(
                SimpleNamespace(widget_types=other), [widget], previous_theme=SimpleNamespace(widget_types=first)
            )

    def test_new_instances_during_theme_switch_need_only_the_target_definition(self):
        theme = SimpleNamespace(widget_types=publish_widget_types(working_document(), empty_widget_types()))
        widget = {"id": "new-person", "type": TYPE, "type_version": 1, "config": {"personName": "Alex"}}
        validate_instances(
            theme, [widget], previous_theme=SimpleNamespace(widget_types=empty_widget_types()), previous_widgets=[]
        )

    def test_css_scopes_comma_selectors_and_media_without_external_resources(self):
        css = compile_css(
            ".person, :is(h2, p) { color: var(--accent); } @media (min-width: 600px) { p { padding: 2px; } }",
            TYPE_ID,
            1,
        )
        self.assertIn(f'[data-theme-widget="{TYPE_ID}:1"] .person', css)
        self.assertIn(f'[data-theme-widget="{TYPE_ID}:1"] :is(h2, p)', css)
        for unsafe in [
            '@import "https://evil.test/style.css";',
            "+ * { color: red; }",
            "/* sibling */ ~ p { display: none; }",
            "p {background: url(https://evil.test)}",
            ":root { color:red }",
            "@font-face { font-family:x; }",
            "p {color:red}</style>",
        ]:
            with self.subTest(css=unsafe), self.assertRaises(ValidationError):
                compile_css(unsafe, TYPE_ID, 1)

    def test_template_rejects_executable_markup_and_external_partials(self):
        for template in [
            "<script>alert(1)</script>",
            '<img onerror="alert(1)" src="x">',
            '<a href="javascript:alert(1)">x</a>',
            "{{>external}}",
            "{{#missing}}",
        ]:
            with self.subTest(template=template), self.assertRaises(ValidationError):
                compile_definition({"template": template}, TYPE_ID, 1)

    def test_raw_substitutions_are_sanitized_after_render(self):
        draft = working_document()
        draft["items"][0]["working"]["template"] = "<article>{{{personName}}}</article>"
        definition = find_definition(
            SimpleNamespace(widget_types=publish_widget_types(draft, empty_widget_types())), TYPE, 1
        )
        html = definition.render({"personName": '<img src="x" onerror="alert(1)"><script>alert(1)</script>'})
        self.assertNotIn("onerror", html)
        self.assertNotIn("<script", html)
