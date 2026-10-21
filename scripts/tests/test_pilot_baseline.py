"""Prove the comparator rejects regressions instead of normalizing them away."""

import copy
import importlib.util
import tempfile
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

    def test_output_refuses_existing_directories_without_changing_permissions(self):
        with tempfile.TemporaryDirectory() as temporary:
            private = Path(temporary) / "private"
            private.mkdir(mode=0o700)
            sentinel = private / "unrelated.txt"
            sentinel.write_text("preserved")
            for directory in (private, Path(temporary) / "alias"):
                if directory != private:
                    directory.symlink_to(private, target_is_directory=True)
                with self.subTest(directory=directory):
                    with self.assertRaises(FileExistsError):
                        pilot.create_output(directory)
                    self.assertEqual(private.stat().st_mode & 0o777, 0o700)
                    self.assertEqual(sentinel.read_text(), "preserved")
            created = pilot.create_output(Path(temporary) / "new-artifacts")
            self.assertEqual(created.stat().st_mode & 0o777, 0o777)

    def test_only_pydantic_documentation_minor_version_is_incidental(self):
        reference = copy.deepcopy(self.reference)
        error = {
            "type": "literal_error",
            "loc": ["text_outline"],
            "msg": "Invalid option",
            "input": "invalid",
            "url": "https://errors.pydantic.dev/2.13/v/literal_error",
        }
        reference["observations"]["save"]["body"]["rawErrors"] = [error]
        before = copy.deepcopy(reference)
        candidate = copy.deepcopy(reference)
        candidate_error = candidate["observations"]["save"]["body"]["rawErrors"][0]
        candidate_error["url"] = "https://errors.pydantic.dev/2.14/v/literal_error"
        self.assertEqual(pilot.compare(reference, candidate), [])
        self.assertEqual(reference, before)
        self.assertIn("/2.14/", candidate_error["url"])
        for field, value in {
            "type": "missing",
            "loc": ["other_field"],
            "msg": "Changed meaning",
            "input": "changed",
            "url": "https://errors.pydantic.dev/2.14/v/missing",
        }.items():
            with self.subTest(field=field):
                changed = copy.deepcopy(candidate)
                changed["observations"]["save"]["body"]["rawErrors"][0][field] = value
                self.assertTrue(pilot.compare(reference, changed))
        for url in (
            "https://errors.pydantic.dev/3.14/v/literal_error",
            "https://other.example/2.14/v/literal_error",
            None,
        ):
            with self.subTest(url=url):
                changed = copy.deepcopy(candidate)
                changed["observations"]["save"]["body"]["rawErrors"][0]["url"] = url
                self.assertTrue(pilot.compare(reference, changed))
        del candidate_error["url"]
        self.assertTrue(pilot.compare(reference, candidate))
        # A URL embedded in user content must never be normalized.
        reference["observations"]["save"]["body"]["content"] = error["url"]
        candidate = copy.deepcopy(reference)
        candidate["observations"]["save"]["body"]["content"] = error["url"].replace("2.13", "2.14")
        self.assertTrue(pilot.compare(reference, candidate))

    def test_mandatory_scenarios_cannot_be_replaced_or_skipped(self):
        result = {"scenarios": [{"id": name, "status": "passed"} for name in pilot.REQUIRED_BACKEND_SCENARIOS]}
        self.assertTrue(pilot.backend_passes(result))
        candidate = copy.deepcopy(result)
        candidate["scenarios"][0]["id"] = "unrelated-passing-test"
        self.assertFalse(pilot.backend_passes(candidate))
        for key in ("skipped", "expectedFailures", "unexpectedSuccesses", "failures", "errors"):
            with self.subTest(key=key):
                self.assertFalse(pilot.backend_passes({**result, key: 1}))

    def test_frontend_scenario_identity_is_required_even_when_counts_match(self):
        result = {
            "success": True,
            "numPassedTests": 11,
            "testResults": [
                {
                    "assertionResults": [
                        {"fullName": name, "status": "passed"} for name in pilot.REQUIRED_FRONTEND_SCENARIOS
                    ]
                }
            ],
        }
        self.assertTrue(pilot.frontend_passes(result))
        assertions = result["testResults"][0]["assertionResults"]
        original = assertions[0].copy()
        assertions[0]["fullName"] = "unrelated-passing-test"
        self.assertFalse(pilot.frontend_passes(result))
        assertions[0] = {**original, "status": "skipped"}
        self.assertFalse(pilot.frontend_passes(result))

    def test_browser_scenario_and_project_identity_are_required(self):
        result = {
            "stats": {"expected": 6},
            "suites": [
                {
                    "specs": [
                        {
                            "title": title,
                            "tests": [
                                {
                                    "projectName": project,
                                    "expectedStatus": "passed",
                                    "status": "expected",
                                    "results": [{"status": "passed"}],
                                }
                            ],
                        }
                        for project, title in pilot.REQUIRED_BROWSER_SCENARIOS
                    ]
                }
            ],
        }
        self.assertTrue(pilot.browser_passes(result))
        for change in ("title", "project", "skipped", "expected-failure", "retry", "global-error"):
            with self.subTest(change=change):
                changed = copy.deepcopy(result)
                spec = changed["suites"][0]["specs"][0]
                test = spec["tests"][0]
                if change == "title":
                    spec["title"] = "unrelated passing test"
                elif change == "project":
                    test["projectName"] = "other-browser"
                elif change == "skipped":
                    test["results"][0]["status"] = "skipped"
                elif change == "expected-failure":
                    test["expectedStatus"] = "failed"
                    test["results"][0]["status"] = "failed"
                elif change == "retry":
                    test["results"].insert(0, {"status": "failed"})
                else:
                    changed["errors"] = [{"message": "runner failed"}]
                self.assertFalse(pilot.browser_passes(changed))

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
