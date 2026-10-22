import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("ci_ruleset", Path(__file__).parents[1] / "ci_ruleset.py")
rules = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(rules)


class CIRulesetTests(unittest.TestCase):
    def checks(self, conclusion="success"):
        return {
            "check_runs": [
                {"name": name, "app": {"id": rules.ACTIONS_APP_ID}, "status": "completed", "conclusion": conclusion}
                for name in rules.CHECKS
            ]
        }

    def test_only_main_and_both_exact_actions_checks_are_required(self):
        desired = rules.desired_ruleset()
        self.assertEqual(desired["conditions"]["ref_name"]["include"], ["refs/heads/main"])
        self.assertEqual(desired["bypass_actors"], [])
        params = desired["rules"][0]["parameters"]
        self.assertTrue(params["strict_required_status_checks_policy"])
        self.assertEqual([item["context"] for item in params["required_status_checks"]], list(rules.CHECKS))

    def test_refuses_missing_or_skipped_verification(self):
        for checks in ({"check_runs": []}, self.checks("skipped")):
            with patch.object(rules, "api", side_effect=[{}, {}, checks]) as api:
                with self.assertRaises(ValueError):
                    rules.install("owner/repo", "a" * 40)
                self.assertTrue(all(call.args[1:] == () for call in api.call_args_list))

    def test_idempotent_readback_preserves_other_rulesets(self):
        desired = rules.desired_ruleset()
        with patch.object(
            rules,
            "api",
            side_effect=[
                {},
                {},
                self.checks(),
                [{"id": 1, "name": "Other policy"}, {"id": 2, "name": rules.RULESET_NAME}],
                desired,
            ],
        ) as api:
            self.assertIn("no changes", rules.install("owner/repo", "a" * 40))
            self.assertTrue(all(call.args[1:] == () for call in api.call_args_list))

    def test_creates_only_its_own_ruleset_and_verifies_readback(self):
        desired = rules.desired_ruleset()
        with patch.object(rules, "api", side_effect=[{}, {}, self.checks(), [], {"id": 3}, desired]) as api:
            self.assertIn("created and verified", rules.install("owner/repo", "a" * 40))
            self.assertEqual(api.call_args_list[4].args, ("repos/owner/repo/rulesets", desired))

    def test_refuses_to_replace_drifted_policy(self):
        desired = rules.desired_ruleset()
        desired["enforcement"] = "disabled"
        with patch.object(
            rules, "api", side_effect=[{}, {}, self.checks(), [{"id": 2, "name": rules.RULESET_NAME}], desired]
        ) as api:
            with self.assertRaises(ValueError):
                rules.install("owner/repo", "a" * 40)
            self.assertTrue(all(call.args[1:] == () for call in api.call_args_list))


if __name__ == "__main__":
    unittest.main()
