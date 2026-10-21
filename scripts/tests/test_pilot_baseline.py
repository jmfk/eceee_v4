"""Prove the comparator rejects regressions instead of normalizing them away."""

import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("pilot_baseline", Path(__file__).parents[1] / "pilot_baseline.py")
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


class PilotComparisonTests(unittest.TestCase):
    def setUp(self):
        self.reference = {
            "formatVersion": 1,
            "casesSha256": "fixture-1",
            "observations": {
                "save": {"status": 200, "body": {"revision": 2, "allowed": True, "widgets": ["left", "right"]}},
                "unauthorized": {"status": 403},
            },
        }

    def test_identical_contracts_ignore_object_key_order(self):
        self.assertEqual(pilot.compare(self.reference, copy.deepcopy(self.reference)), [])

    def test_mandatory_scenarios_cannot_be_replaced_or_skipped(self):
        result = {"scenarios": [{"id": name, "status": "passed"} for name in pilot.REQUIRED_BACKEND_SCENARIOS]}
        self.assertTrue(pilot.backend_passes(result))
        candidate = copy.deepcopy(result)
        candidate["scenarios"][0]["id"] = "unrelated-passing-test"
        self.assertFalse(pilot.backend_passes(candidate))
        for key in ("skipped", "expectedFailures", "unexpectedSuccesses", "failures", "errors"):
            with self.subTest(key=key):
                self.assertFalse(pilot.backend_passes({**result, key: 1}))

    def test_missing_case_field_and_extra_field_are_detected(self):
        for change in ("case", "field", "extra"):
            with self.subTest(change=change):
                candidate = copy.deepcopy(self.reference)
                if change == "case":
                    del candidate["observations"]["unauthorized"]
                elif change == "field":
                    del candidate["observations"]["save"]["body"]["revision"]
                else:
                    candidate["observations"]["save"]["body"]["unexpected"] = "value"
                self.assertTrue(pilot.compare(self.reference, candidate))

    def test_permissions_revision_order_type_and_fixture_changes_are_detected(self):
        for change in ("permission", "revision", "order", "bool-as-int", "fixture"):
            with self.subTest(change=change):
                candidate = copy.deepcopy(self.reference)
                body = candidate["observations"]["save"]["body"]
                if change == "permission":
                    candidate["observations"]["unauthorized"]["status"] = 200
                elif change == "revision":
                    body["revision"] = 3
                elif change == "order":
                    body["widgets"].reverse()
                elif change == "bool-as-int":
                    body["allowed"] = 1
                else:
                    candidate["casesSha256"] = "fixture-2"
                self.assertTrue(pilot.compare(self.reference, candidate))


if __name__ == "__main__":
    unittest.main()
