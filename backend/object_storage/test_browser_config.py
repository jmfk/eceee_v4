"""Focused validation tests for editor-controlled Object browsing."""

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.db.models import Q
from django.test import SimpleTestCase
from rest_framework.exceptions import PermissionDenied, ValidationError

from content_migration.legacy_content.profile import initial_bundle
from object_storage.browser_config import (
    apply_browser_filters,
    available_filters,
    available_list_fields,
    field_kind,
    parse_browser_filters,
    validate_browser_config,
)
from object_storage.serializers import ObjectInstanceListSerializer, ObjectTypeDefinitionListSerializer
from object_storage.views import ObjectTypeDefinitionViewSet, filter_browser_statuses


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

    def test_list_serializer_includes_only_configured_schema_details(self):
        self.definition.metadata = {"browser": {"list_fields": ["status", "field:summary"]}}
        instance = SimpleNamespace(object_type=self.definition, data={"summary": "Visible", "private_note": "Hidden"})
        self.assertEqual(ObjectInstanceListSerializer().get_data(instance), {"summary": "Visible"})

    def test_type_list_exposes_selected_field_labels_without_full_schema(self):
        self.definition.metadata = {"browser": {"list_fields": ["status", "field:summary"]}}
        self.definition.schema["properties"]["summary"]["title"] = "Ingress"
        self.assertEqual(
            ObjectTypeDefinitionListSerializer().get_browser_list_fields(self.definition)[1]["label"], "Ingress"
        )

    @patch("object_storage.browser_config.available_filters")
    def test_json_datetime_filter_includes_the_entire_to_date(self, options):
        options.return_value = {"field:source_date": {"key": "field:source_date", "kind": "date"}}
        self.definition.metadata = {"browser": {"filters": [{"key": "field:source_date"}]}}
        request = SimpleNamespace(
            query_params={
                "browser_filters": json.dumps([{"key": "field:source_date", "values": ["2026-10-01", "2026-10-27"]}])
            },
            tenant=None,
        )

        class RecordingQueryset:
            def __init__(self):
                self.calls = []

            def filter(self, *args, **kwargs):
                self.calls.append((args, kwargs))
                return self

        queryset = RecordingQueryset()
        apply_browser_filters(request, queryset, self.definition)
        self.assertEqual(queryset.calls[0][1], {"current_version__data__source_date__gte": "2026-10-01"})
        self.assertEqual(queryset.calls[1][1], {"current_version__data__source_date__lt": "2026-10-28"})

    @patch("object_storage.browser_config.available_filters")
    def test_invalid_calendar_date_returns_validation_error(self, options):
        options.return_value = {"created_at": {"key": "created_at", "kind": "date"}}
        self.definition.metadata = {"browser": {"filters": [{"key": "created_at"}]}}
        request = SimpleNamespace(
            query_params={"browser_filters": json.dumps([{"key": "created_at", "values": ["", "2026-13-10"]}])},
            tenant=None,
        )
        with self.assertRaises(ValidationError):
            apply_browser_filters(request, None, self.definition)

    @patch("object_storage.browser_config.ClassificationType.objects.filter")
    def test_single_reference_filter_uses_scalar_value_despite_array_schema_type(self, classifications):
        classifications.return_value.order_by.return_value = []
        self.definition.schema["properties"]["authors"] = {
            "componentType": "object_reference",
            "type": "array",
            "multiple": False,
        }
        self.definition.metadata = {"browser": {"filters": [{"key": "field:authors"}]}}
        self.assertFalse(available_filters(self.definition, None)["field:authors"]["multiple"])
        request = SimpleNamespace(
            query_params={"browser_filters": json.dumps([{"key": "field:authors", "values": ["7"]}])},
            tenant=None,
        )
        queryset = MagicMock()
        apply_browser_filters(request, queryset, self.definition)
        self.assertEqual(queryset.filter.call_args.args[0].children, [("current_version__data__authors", 7)])
        self.definition.schema["properties"]["authors"]["multiple"] = True
        self.assertTrue(available_filters(self.definition, None)["field:authors"]["multiple"])

    @patch("object_storage.browser_config.available_filters")
    def test_unhashable_filter_keys_return_validation_errors(self, options):
        options.return_value = self.options
        invalid_filter = {"key": [], "label": "Invalid", "overview": False}
        with self.assertRaises(ValidationError):
            validate_browser_config(self.definition, None, {"search_fields": [], "filters": [invalid_filter]})
        self.definition.metadata = {"browser": {"filters": [{"key": "field:summary"}]}}
        request = SimpleNamespace(
            query_params={"browser_filters": json.dumps([{"key": [], "values": ["x"]}])},
            tenant=None,
        )
        with self.assertRaises(ValidationError):
            parse_browser_filters(request, self.definition)

    def test_regular_definition_write_cannot_change_global_browser_settings(self):
        view = ObjectTypeDefinitionViewSet()
        view.request = SimpleNamespace(user=SimpleNamespace(is_superuser=False))
        global_type = SimpleNamespace(namespace=None, namespace_id=None, metadata={"browser": {"filters": []}})
        serializer = SimpleNamespace(
            instance=global_type,
            validated_data={"metadata": {"browser": {"filters": [{"key": "created_at"}]}}},
        )
        with self.assertRaises(PermissionDenied):
            view._validate_global_browser_write(serializer)

        serializer.validated_data = {"metadata": None}
        with self.assertRaises(PermissionDenied):
            view._validate_global_browser_write(serializer)

        tenant_type = SimpleNamespace(namespace_id=1, namespace=object(), metadata={"browser": {"filters": []}})
        serializer.instance = tenant_type
        serializer.validated_data = {"namespace": None}
        with self.assertRaises(PermissionDenied):
            view._validate_global_browser_write(serializer)

        serializer.validated_data = {"metadata": {"browser": {"filters": [{"key": "created_at"}]}}}
        view._validate_global_browser_write(serializer)
        serializer.instance = global_type
        view.request.user.is_superuser = True
        view._validate_global_browser_write(serializer)

    def test_archived_objects_can_be_filtered_by_status(self):
        queryset = MagicMock()
        request = SimpleNamespace(query_params={"statuses": "archived"})
        self.assertIs(filter_browser_statuses(queryset, request), queryset.filter.return_value)
        queryset.filter.assert_called_once_with(status="archived")

    @patch("object_storage.views.ObjectVersion.objects.filter")
    def test_mixed_statuses_keep_archived_separate_from_drafts(self, versions):
        queryset = MagicMock()
        queryset.annotate.return_value = queryset
        request = SimpleNamespace(query_params={"statuses": "draft,archived"})
        filter_browser_statuses(queryset, request)
        self.assertEqual(
            queryset.filter.call_args.args[0],
            Q(status="archived") | (~Q(status="archived") & Q(_has_live_version=False, _has_scheduled_version=False)),
        )
