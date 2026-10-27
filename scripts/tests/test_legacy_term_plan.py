import sys
import unittest
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from content_migration.legacy_content import term_plan  # noqa: E402

compile_plan = term_plan.compile_plan
identity = term_plan.identity
load_plan = term_plan.load_plan


class LegacyTermPlanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.result = compile_plan()

    def test_all_reviewed_source_terms_resolve_to_one_typed_term(self):
        refs = self.result["mapping"]["termRefs"]
        self.assertEqual(len(refs), 698)
        self.assertEqual(len(self.result["reviewRows"]), 698)
        self.assertEqual(len(self.result["bundle"]["terms"]), 703)
        self.assertEqual(
            refs[identity(2, "sources", "eceeenews.eceeenewssource", 4)],
            refs[identity(2, "sources", "eceeenews.eceeenewssource", 17)],
        )
        self.assertNotEqual(
            refs[identity(2, "sources", "eceeenews.eceeenewssource", 3)],
            refs[identity(2, "sources", "eceeenews.eceeenewssource", 6)],
        )

    def test_reviewed_hierarchy_and_same_name_dimensions(self):
        refs = self.result["mapping"]["termRefs"]
        terms = {(term["type"], term["slug"]): term for term in self.result["bundle"]["terms"]}

        def term(dimension, model, source_id):
            ref = refs[identity(2, dimension, model, source_id)]
            return terms[ref["type"], ref["slug"]]

        self.assertEqual(term("topics", "eceeenews.relatednews", 62)["parent"], "group-un-climate-conferences")
        self.assertEqual(
            term("topics", "eceeenews.relatednews", 76)["parent"],
            term("topics", "eceeenews.relatednews", 129)["slug"],
        )
        self.assertIsNone(term("topics", "eceeenews.relatednews", 52)["parent"])
        self.assertNotEqual(
            term("topics", "eceeenews.relatednews", 132)["type"],
            term("categories", "eceeenews.eceeenewscategory", 15)["type"],
        )

    def test_changed_inventory_or_group_is_rejected(self):
        inventory, decisions = load_plan()
        altered = deepcopy(inventory)
        altered["terms"].append({**altered["terms"][0], "id": "99999"})
        with self.assertRaisesRegex(ValueError, "inventory_count_changed"):
            compile_plan(altered, decisions)
        altered = deepcopy(decisions)
        altered["groups"]["topics"]["Energy"].append(41)
        with self.assertRaisesRegex(ValueError, "missing_or_duplicate_group_term"):
            compile_plan(inventory, altered)
        altered = deepcopy(inventory)
        next(term for term in altered["terms"] if term["dimension"] == "sources")["uses"] = {"events": 1}
        with self.assertRaisesRegex(ValueError, "invalid_target_use"):
            compile_plan(altered, decisions)


if __name__ == "__main__":
    unittest.main()
