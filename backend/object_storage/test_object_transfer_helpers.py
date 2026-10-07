import hashlib
import io
import json
import zipfile
from types import SimpleNamespace

from django.test import SimpleTestCase

from object_storage.services.object_transfer import PACKAGE_VERSION, _remap, type_is_compatible, validate_package


class ObjectTransferHelperTests(SimpleTestCase):
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
