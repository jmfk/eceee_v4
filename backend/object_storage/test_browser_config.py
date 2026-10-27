"""Focused validation tests for editor-controlled Object browsing."""

import json
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from content_migration.legacy_content.profile import initial_bundle
from object_storage.browser_config import field_kind, parse_browser_filters, validate_browser_config


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
