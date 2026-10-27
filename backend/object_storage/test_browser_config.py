"""Focused validation tests for editor-controlled Object browsing."""

import json
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from content_migration.legacy_content.profile import initial_bundle
from object_storage.browser_config import (
    available_list_fields,
    field_kind,
    parse_browser_filters,
    validate_browser_config,
)


class BrowserConfigurationTests(SimpleTestCase):
    def setUp(self):
        self.definition = SimpleNamespace(
            schema={
                "properties": {
                    "summary": {"componentType": "textarea", "type": "string"},
                    "photo": {"componentType": "image", "type": "string"},
                    "authors": {"componentType": "object_reference", "type": "array"},
                }
            },
            metadata={},
        )
        self.options = {
            "field:summary": {"key": "field:summary", "kind": "choice"},
            "field:authors": {"key": "field:authors", "kind": "reference"},
        }

    def test_profile_defaults_only_reference_matching_schema_fields(self):
        for definition in initial_bundle()["definitions"]:
            properties = {
                "".join("_" + char.lower() if char.isupper() else char for char in key): value
                for key, value in definition["schema"]["properties"].items()
            }
            config = definition["metadata"]["browser"]
            for key in config["search_fields"]:
                self.assertIn(key, properties)
                self.assertEqual(field_kind(properties[key]), "choice")
            for item in config["filters"]:
                self.assertEqual(item["quick"], item["control"] == "date_range")
                if item["key"].startswith("field:"):
                    self.assertIn(item["key"][6:], properties)

    @patch("object_storage.browser_config.available_filters")
    def test_rejects_non_text_search_and_duplicate_filters(self, options):
        options.return_value = self.options
        with self.assertRaises(ValidationError):
            validate_browser_config(self.definition, None, {"search_fields": ["photo"], "filters": []})
        item = {"key": "field:authors", "label": "Author", "overview": True}
        with self.assertRaises(ValidationError):
            validate_browser_config(self.definition, None, {"search_fields": [], "filters": [item, item]})
        with self.assertRaises(ValidationError):
            validate_browser_config(
                self.definition,
                None,
                {
                    "search_fields": [],
                    "filters": [{**item, "control": "date_range"}],
                },
            )

    @patch("object_storage.browser_config.available_filters")
    def test_request_only_uses_saved_filters(self, options):
        options.return_value = self.options
        self.definition.metadata = {
            "browser": {
                "filters": [
                    {"key": "field:summary", "label": "Summary", "overview": False},
                ]
            }
        }
        request = SimpleNamespace(
            query_params={
                "browser_filters": json.dumps(
                    [
                        {"key": "field:authors", "values": ["1"]},
                    ]
                )
            },
            tenant=None,
        )
        with self.assertRaises(ValidationError):
            parse_browser_filters(request, self.definition)

    @patch("object_storage.browser_config.available_filters")
    def test_quick_button_must_be_boolean_and_date_defaults_to_quick(self, options):
        options.return_value = {
            "effective_date": {"key": "effective_date", "kind": "date"},
        }
        item = {"key": "effective_date", "label": "Publication date", "overview": True}
        saved = validate_browser_config(self.definition, None, {"search_fields": [], "filters": [item]})
        self.assertTrue(saved["filters"][0]["quick"])
        with self.assertRaises(ValidationError):
            validate_browser_config(self.definition, None, {"search_fields": [], "filters": [{**item, "quick": "yes"}]})

    @patch("object_storage.browser_config.available_filters")
    def test_list_fields_keep_order_and_reject_unsupported_or_duplicate_fields(self, options):
        options.return_value = self.options
        self.assertIn("field:summary", available_list_fields(self.definition))
        self.assertNotIn("field:photo", available_list_fields(self.definition))
        value = {"search_fields": [], "filters": [], "list_fields": ["field:summary", "status", "updated_at"]}
        self.assertEqual(validate_browser_config(self.definition, None, value)["list_fields"], value["list_fields"])
        for invalid in (["field:photo"], ["status", "status"], ["field:authors"]):
            with self.subTest(invalid=invalid), self.assertRaises(ValidationError):
                validate_browser_config(self.definition, None, {**value, "list_fields": invalid})
