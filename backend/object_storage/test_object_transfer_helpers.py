import hashlib
import io
import json
import zipfile
from types import SimpleNamespace

from django.test import SimpleTestCase
from rest_framework import serializers

from object_storage.remote_views import _validate_type_resolutions
from object_storage.services.object_transfer import (
    PACKAGE_VERSION,
    _reference_field_names,
    _remap,
    type_definition_differs,
    type_is_compatible,
    validate_package,
)


class ObjectTransferHelperTests(SimpleTestCase):
    def test_canonical_object_reference_field_is_remapped(self):
        obj_type = SimpleNamespace(
            schema={
                "properties": {
                    "related": {"type": "array", "field_type": "object_reference"},
                    "rating": {"type": "integer", "field_type": "integer"},
                }
            }
        )

        reference_fields = _reference_field_names(obj_type)
        result = _remap({"related": [5], "rating": 5}, {"5": 50}, {}, reference_fields)

        self.assertEqual(reference_fields, {"related"})
        self.assertEqual(result, {"related": [50], "rating": 5})

    def test_remap_changes_only_schema_declared_object_references(self):
        source_media_id = "0f598bec-ad32-486c-98ab-a004d827db08"
        destination_media_id = "686236c1-bb66-4518-992b-9cb36c4de42a"

        result = _remap(
            {"related": [5], "rating": 5, "image": source_media_id},
            {"5": 50},
            {source_media_id: destination_media_id},
            {"related"},
        )

        self.assertEqual(result["related"], [50])
        self.assertEqual(result["rating"], 5)
        self.assertEqual(result["image"], destination_media_id)

    def test_remap_drops_object_references_missing_from_the_import_graph(self):
        result = _remap(
            {"related": [5, 999, {"object_id": 6, "label": "Known"}, {"id": 998, "label": "Missing"}]},
            {"5": 50, "6": 60},
            {},
            {"related"},
        )

        self.assertEqual(result["related"], [50, {"object_id": 60, "label": "Known"}])

    def test_type_resolutions_must_match_reported_conflicts_and_allowed_actions(self):
        conflicts = [{"name": "article", "compatible": False, "usedByOtherTenants": True}]

        _validate_type_resolutions(conflicts, {"article": "skip"})
        with self.assertRaises(serializers.ValidationError):
            _validate_type_resolutions(conflicts, {"unreported": "update"})
        with self.assertRaises(serializers.ValidationError):
            _validate_type_resolutions(conflicts, {"article": "update"})
        with self.assertRaises(serializers.ValidationError):
            _validate_type_resolutions(conflicts, ["article"])

    def test_remap_rewrites_media_ids_embedded_in_html(self):
        source_media_id = "0f598bec-ad32-486c-98ab-a004d827db08"
        destination_media_id = "686236c1-bb66-4518-992b-9cb36c4de42a"
        unrelated_id = "58fd91a6-8a3c-4601-80aa-1085c668aab8"
        html = (
            f'<div data-media-id="{source_media_id}">'
            f'<img src="/media/{source_media_id}/preview/" data-other="{unrelated_id}"></div>'
        )

        result = _remap({"content": html}, {}, {source_media_id: destination_media_id})

        self.assertNotIn(source_media_id, result["content"])
        self.assertEqual(result["content"].count(destination_media_id), 2)
        self.assertIn(unrelated_id, result["content"])

    def test_type_compatibility_accepts_only_safe_local_supersets(self):
        base_field = {"type": "string", "maxLength": 100}
        local = SimpleNamespace(
            hierarchy_level="both",
            schema={
                "type": "object",
                "properties": {"title": base_field, "note": {"type": "string"}},
                "required": ["title"],
            },
            slot_configuration={"slots": [{"name": "body", "widgetControls": [{"widgetType": "content"}]}]},
        )
        remote = {
            "hierarchy_level": "both",
            "schema": {
                "type": "object",
                "properties": {"title": base_field},
                "required": ["title"],
            },
            "slot_configuration": {"slots": [{"name": "body", "widgetControls": [{"widgetType": "content"}]}]},
        }

        self.assertTrue(type_is_compatible(local, remote))

        local.schema["required"].append("note")
        self.assertFalse(type_is_compatible(local, remote))
        local.schema["required"].remove("note")

        remote["schema"]["properties"]["title"] = {"type": "string", "maxLength": 200}
        self.assertFalse(type_is_compatible(local, remote))
        remote["schema"]["properties"]["title"] = base_field

        remote["schema"]["additionalProperties"] = False
        self.assertFalse(type_is_compatible(local, remote))
        remote["schema"].pop("additionalProperties")

        remote["slot_configuration"]["slots"][0]["widgetControls"] = [{"widgetType": "image"}]
        self.assertFalse(type_is_compatible(local, remote))

        remote["slot_configuration"]["slots"][0]["widgetControls"] = [{"widgetType": "content"}]
        local.slot_configuration["slots"].append({"name": "sidebar", "required": True})
        self.assertFalse(type_is_compatible(local, remote))

    def test_type_compatibility_includes_child_and_browser_topology(self):
        children = SimpleNamespace(values_list=lambda *_args, **_kwargs: ["child", "optional-child"])
        local = SimpleNamespace(
            hierarchy_level="both",
            schema={"type": "object", "properties": {}},
            slot_configuration={"slots": []},
            allowed_child_types=children,
            browser_group=SimpleNamespace(name="content"),
        )
        remote = {
            "hierarchy_level": "both",
            "schema": {"type": "object", "properties": {}},
            "slot_configuration": {"slots": []},
            "allowed_child_types": ["child"],
            "browser_group": "content",
        }

        self.assertTrue(type_is_compatible(local, remote))
        self.assertTrue(type_definition_differs(local, remote))

        remote["allowed_child_types"] = ["missing-child"]
        self.assertFalse(type_is_compatible(local, remote))
        remote["allowed_child_types"] = ["child"]
        remote["browser_group"] = "other"
        self.assertFalse(type_is_compatible(local, remote))

    def test_package_requires_a_complete_checksum_manifest(self):
        payload = json.dumps({"types": [], "objects": [], "media": []}).encode()
        file_obj = io.BytesIO()
        with zipfile.ZipFile(file_obj, "w") as package:
            package.writestr("objects.json", payload)
            package.writestr(
                "manifest.json",
                json.dumps(
                    {
                        "package_version": PACKAGE_VERSION,
                        "checksums": {"objects.json": hashlib.sha256(payload).hexdigest()},
                    }
                ),
            )
            package.writestr("media/unlisted.bin", b"unsafe")

        file_obj.seek(0)
        with zipfile.ZipFile(file_obj) as package, self.assertRaisesMessage(ValueError, "checksum manifest"):
            validate_package(package)
