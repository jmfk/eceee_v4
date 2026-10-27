import importlib.util
import unittest
from copy import deepcopy
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "editorial_definitions", Path(__file__).resolve().parents[1] / "eceee_content_definitions.py"
)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class MemoryAPI:
    def __init__(self, bundle):
        self.objects = {}
        ids = {item["name"]: index + 1 for index, item in enumerate(bundle["definitions"])}
        for item in bundle["definitions"]:
            row = deepcopy(item)
            group = row.pop("browser_group_name", None)
            row.update(id=ids[row["name"]], namespace={"id": 2}, browser_group=ids.get(group))
            self.objects[row["id"]] = row
        self.types = [
            dict(
                id=index + 1,
                key=t["key"],
                name=t["name"],
                description=t.get("description", ""),
                allowed_uses=[f"object:{ids[name]}" for name in t["object_types"]] + t.get("resource_uses", []),
            )
            for index, t in enumerate(bundle["classification_types"])
        ]
        self.terms = []
        for index, t in enumerate(bundle["terms"]):
            parent = next((old["id"] for old in self.terms if old["slug"] == t.get("parent")), None)
            self.terms.append(
                dict(
                    id=str(index + 1),
                    tag_type=t["type"],
                    slug=t["slug"],
                    name=t["name"],
                    parent=parent,
                    status="approved",
                    classification_type=next(row["id"] for row in self.types if row["key"] == t["type"]),
                )
            )

    def list(self, path):
        if path.startswith("objects/"):
            return list(self.objects.values())
        return self.types if path.startswith("taxonomy/types/") else self.terms

    def request(self, path, method="GET", data=None):
        assert method == "GET", "Diff must never mutate"
        return self.objects[int(path.rstrip("/").split("/")[-1])]


class DefinitionDiffTests(unittest.TestCase):
    def setUp(self):
        self.bundle = module.profile.initial_bundle()
        self.api = MemoryAPI(self.bundle)

    def diff(self):
        return module.apply_bundle(self.api, {"id": 2}, self.bundle)["changes"]

    def test_export_contains_only_core_terms_and_preserves_live_labels(self):
        self.api.terms[0]["name"] = "News"
        self.api.terms.append({**self.api.terms[0], "id": "99", "slug": "extra", "name": "Extra"})
        exported = module.export_bundle(self.api, {"id": 2})
        self.assertEqual({t["slug"] for t in exported["terms"]}, {"news", "column", "press-release"})
        self.assertEqual(next(t["name"] for t in exported["terms"] if t["slug"] == "news"), "News")
        article = next(item for item in exported["definitions"] if item["name"] == "article")
        self.assertIn("summary", article["metadata"]["browser"]["search_fields"])

    def test_target_browser_configuration_takes_precedence_over_profile_default(self):
        self.api.objects[1]["metadata"]["browser"] = {"search_fields": [], "filters": []}
        self.assertFalse(any(change.get("type") == "article" for change in self.diff()))

    def test_export_requires_approved_core_terms_and_expected_hierarchy(self):
        self.api.terms[-1]["status"] = "proposed"
        with self.assertRaisesRegex(ValueError, "incomplete_core_terms"):
            module.export_bundle(self.api, {"id": 2})
        self.api.terms[-1]["status"] = "approved"
        self.api.terms[-1]["parent"] = None
        with self.assertRaisesRegex(ValueError, "invalid_core_hierarchy"):
            module.export_bundle(self.api, {"id": 2})

    def test_equal_profile_has_no_changes(self):
        self.assertEqual(self.diff(), [])

    def test_reports_classification_configuration_and_term_changes(self):
        self.api.types[0]["description"] = "Changed in destination"
        self.api.terms[-1]["parent"] = None
        changes = self.diff()
        self.assertTrue(any("classificationType" in change for change in changes))
        self.assertTrue(any("term" in change for change in changes))

    def test_reports_group_clear_without_writing(self):
        columnist = next(item for item in self.bundle["definitions"] if item["name"] == "columnist")
        self.assertIsNone(columnist["browser_group_name"])
        self.api.objects[2]["browser_group"] = 1
        self.assertIn({"type": "columnist", "fields": ["browser_group"]}, self.diff())

    def test_rejects_definition_owned_by_another_namespace(self):
        self.api.objects[1]["namespace"] = {"id": 99}
        with self.assertRaisesRegex(ValueError, "definition_namespace=conflict"):
            self.diff()

    def test_apply_rejects_conflicting_term_before_mutation(self):
        self.api.terms[0]["name"] = "Conflicting name"
        with self.assertRaisesRegex(ValueError, "bundle_term=conflict"):
            module.apply_bundle(self.api, {"id": 2}, self.bundle, apply=True)


if __name__ == "__main__":
    unittest.main()
