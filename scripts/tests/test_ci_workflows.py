"""Prevent unrelated label events from cancelling an explicit full CI request."""

import importlib.util
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("ci_workflows", Path(__file__).parents[1] / "validate_ci_workflows.py")
workflows = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(workflows)


class FullCIConcurrencyTests(unittest.TestCase):
    def test_requires_both_pr_and_label_isolation(self):
        for group in ("full-ci-${{ github.event.pull_request.number }}", "full-ci-${{ github.event.label.name }}"):
            with self.subTest(group=group), self.assertRaises(ValueError):
                workflows.validate_full_concurrency({"concurrency": {"group": group}})
        workflows.validate_full_concurrency(
            {"concurrency": {"group": "full-ci-${{ github.event.pull_request.number }}-${{ github.event.label.name }}"}}
        )


if __name__ == "__main__":
    unittest.main()
