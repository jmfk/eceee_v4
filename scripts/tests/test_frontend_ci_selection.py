"""Exercise dependency selection and conservative fallback without running suites."""

import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("frontend_ci", Path(__file__).parents[1] / "run_frontend_ci.py")
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class FrontendSelectionTests(unittest.TestCase):
    def invoke(self, selection, full=False):
        calls = []

        def execute(args, **kwargs):
            calls.append(args)
            if args[1] == "list":
                Path(args[-1]).write_text(json.dumps(selection))
            return subprocess.CompletedProcess(args, 0)

        with (
            patch.object(sys, "argv", ["runner", "--base", "base", *(["--full"] if full else [])]),
            patch.object(runner.subprocess, "run", side_effect=execute),
        ):
            runner.main()
        return calls

    def test_changed_tests_follow_complete_base_and_use_bounded_workers(self):
        calls = self.invoke(["/frontend/src/test.test.jsx"])
        self.assertEqual(calls[0][1:4], ["list", "--changed", "base"])
        self.assertEqual(calls[-1][1:], ["run", "--changed", "base", "--bail=1", "--maxWorkers=2"])

    def test_empty_selection_falls_back_and_full_does_not_collect_twice(self):
        self.assertEqual(self.invoke([])[-1][1:], ["run", "--bail=1", "--maxWorkers=2"])
        self.assertEqual(len(self.invoke([], full=True)), 1)

    def test_collection_or_test_failure_propagates(self):
        with (
            patch.object(sys, "argv", ["runner", "--base", "base"]),
            patch.object(runner.subprocess, "run", side_effect=subprocess.CalledProcessError(1, ["vitest"])),
            self.assertRaises(subprocess.CalledProcessError),
        ):
            runner.main()


if __name__ == "__main__":
    unittest.main()
