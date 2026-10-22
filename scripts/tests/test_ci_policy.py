"""Protect package selection and the distinction between fast and full success."""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).parents[1] / "ci_policy.py"
SPEC = importlib.util.spec_from_file_location("ci_policy", SCRIPT)
policy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(policy)


class CIPolicyTests(unittest.TestCase):
    def test_package_selection_and_shared_contracts(self):
        result = policy.select(["backend/core/views.py", "frontend/src/App.jsx"], "fast", "base")
        self.assertEqual([result[p] for p in ("backend", "frontend", "publisher")], ["true", "true", "false"])
        for path in ("backend/widget_contracts/catalog.json", "deploy/Caddyfile", ".github/workflows/ci.yml"):
            with self.subTest(path=path):
                self.assertTrue(all(policy.select([path], "fast", "base")[p] == "true" for p in result if p != "base"))

    def test_docs_fast_but_full_runs_every_package(self):
        for mode, expected in (("fast", "false"), ("full", "true")):
            result = policy.select(["specs/adrs/index.md", "docs/ci.md"], mode, "base")
            self.assertTrue(all(result[p] == expected for p in ("backend", "frontend", "publisher")))

    def test_deleted_files_still_select_their_package(self):
        self.assertEqual(policy.select(["frontend/src/Removed.jsx"], "fast", "base")["frontend"], "true")

    def test_full_gate_rejects_skipped_missing_failed_and_cancelled_checks(self):
        names = [
            "detect",
            "python-tests",
            "backend-lint",
            "frontend-lint",
            "backend-tests",
            "frontend-tests",
            "frontend-admin-e2e",
            "publisher-checks",
        ]
        needs = {name: {"result": "success"} for name in names}
        policy.verify_gate(needs, True)
        for name in names:
            for result in ("skipped", "failure", "cancelled", None):
                with self.subTest(name=name, result=result), self.assertRaises(ValueError):
                    policy.verify_gate({**needs, name: {"result": result}}, True)
            with self.subTest(missing=name), self.assertRaises(ValueError):
                policy.verify_gate({key: value for key, value in needs.items() if key != name}, True)

    def test_fast_gate_accepts_only_intentionally_unselected_checks(self):
        needs = {
            "detect": {"result": "success", "outputs": {"backend": "false", "frontend": "true", "publisher": "false"}},
            "python-tests": {"result": "success"},
            "frontend-lint": {"result": "success"},
            "frontend-tests": {"result": "success"},
            "backend-tests": {"result": "skipped"},
        }
        policy.verify_gate(needs, False)
        with self.assertRaises(ValueError):
            policy.verify_gate({**needs, "frontend-tests": {"result": "skipped"}}, False)
        with self.assertRaises(ValueError):
            policy.verify_gate({**needs, "unexpected": {"result": "failure"}}, False)
        with self.assertRaises(ValueError):
            policy.verify_gate({**needs, "detect": {"result": "success", "outputs": {}}}, False)

    def test_complete_pr_diff_includes_an_earlier_commit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            env = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull}

            def git(*args):
                return subprocess.check_output(["git", *args], cwd=root, env=env, text=True).strip()

            git("init", "-q")
            git("config", "user.email", "ci@example.com")
            git("config", "user.name", "CI test")
            (root / "README.md").write_text("base")
            git("add", ".")
            git("commit", "-qm", "base")
            base = git("rev-parse", "HEAD")
            (root / "backend").mkdir()
            (root / "backend/test.py").write_text("first change")
            git("add", ".")
            git("commit", "-qm", "backend change")
            (root / "README.md").write_text("last commit only changes docs")
            git("commit", "-qam", "docs change")
            output = subprocess.check_output(
                [sys.executable, str(SCRIPT.resolve()), "select", "--base", base, "--mode", "fast"], cwd=root, env=env
            )
            self.assertEqual(json.loads(output)["backend"], "true")


if __name__ == "__main__":
    unittest.main()
