from importlib import import_module

from django.test import SimpleTestCase

migration = import_module("webpages.migrations.0083_clarify_layout_structure")


class ClarifyLayoutStructureMigrationTests(SimpleTestCase):
    def test_normalizes_seeded_structure_without_overwriting_custom_labels(self):
        document = {
            "items": [
                {
                    "key": "main_layout",
                    "root": {
                        "type": "container",
                        "label": "Root",
                        "class_names": ["main-layout-container"],
                        "children": [
                            {
                                "type": "container",
                                "label": "Conference page",
                                "class_names": ["main-layout-wrapper"],
                                "children": [
                                    {
                                        "type": "semantic",
                                        "tag": "footer",
                                        "label": "Footer",
                                        "class_names": ["main-layout-footer"],
                                        "children": [],
                                    }
                                ],
                            }
                        ],
                    },
                }
            ],
        }

        normalized, changed = migration.normalize_document(document)
        root = normalized["items"][0]["root"]
        surface = root["children"][0]
        footer = surface["children"][0]

        self.assertTrue(changed)
        self.assertEqual(root["label"], "Viewport background")
        self.assertEqual(surface["label"], "Conference page")
        self.assertEqual(footer["label"], "Footer wrapper")
        self.assertEqual(footer["type"], "container")
        self.assertNotIn("tag", footer)
        self.assertEqual(document["items"][0]["root"]["label"], "Root")

        repeated, changed_again = migration.normalize_document(normalized)
        self.assertFalse(changed_again)
        self.assertEqual(repeated, normalized)
