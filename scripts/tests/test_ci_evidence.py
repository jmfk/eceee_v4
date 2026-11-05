"""CI evidence must bound selection risk without permitting a deploy bypass."""

import importlib.util
import subprocess
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1]))
SPEC = importlib.util.spec_from_file_location("ci_evidence", Path(__file__).parents[1] / "ci_evidence.py")
policy = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(policy)

NOW = datetime(2026, 11, 5, 12, tzinfo=timezone.utc)
FRESH = "2026-11-05T11:00:00Z"
BASELINE = {"commit": "base", "completed_at": FRESH, "run_id": 1}


def run(identity=2, head="head", conclusion="success", status="completed"):
    return {
        "id": identity,
        "head_sha": head,
        "status": status,
        "conclusion": conclusion,
        "path": ".github/workflows/ci.yml",
        "event": "push",
        "head_branch": "main",
        "created_at": FRESH,
        "updated_at": FRESH,
        "html_url": "https://github.com/jmfk/eceee_v4/actions/runs/2",
    }


def full_jobs():
    return [{"name": "CI policy gate", "conclusion": "success", "completed_at": FRESH}] + [
        {"name": f"Full CI / {name}", "conclusion": "success", "completed_at": FRESH}
        for name in (
            "Full CI gate",
            "Select CI checks",
            "Python helper tests",
            "Backend lint",
            "Frontend lint",
            "Backend tests",
            "Frontend unit tests",
            "Frontend admin Playwright",
            "Publisher checks",
        )
    ]


class FakeEvidence(policy.Evidence):
    def __init__(self, runs=None, jobs=None, baseline=BASELINE):
        self.runs = runs if runs is not None else [run()]
        self.job_cache = {item["id"]: jobs if jobs is not None else full_jobs() for item in self.runs}
        self.saved_baseline = baseline

    def baseline(self, head):
        return self.saved_baseline


class CadenceTests(unittest.TestCase):
    def test_full_at_ten_prs_or_one_week_and_on_unknown_evidence(self):
        paths = ["frontend/src/pages/TagsPage.jsx"]
        self.assertEqual(policy.full_reason(paths, BASELINE, 9, NOW), "")
        self.assertIn("tenth", policy.full_reason(paths, BASELINE, 10, NOW))
        self.assertIn("weekly", policy.full_reason(paths, {**BASELINE, "completed_at": "2026-10-29T12:00:00Z"}, 0, NOW))
        self.assertIn("baseline", policy.full_reason(paths, None, 0, NOW))
        self.assertIn("weekly", policy.full_reason(paths, {**BASELINE, "completed_at": "2027-01-01T00:00:00Z"}, 0, NOW))

    def test_classifies_shared_runtime_data_security_and_unknown_as_high_risk(self):
        for path in (
            "backend/file_manager/serializers.py",
            "backend/core/migrations/0001.py",
            "frontend/src/rendering/RenderFrame.tsx",
            "frontend/src/contexts/AuthContext.jsx",
            "frontend/src/pages/LoginPage.jsx",
            "frontend/src/components/designer/LayoutDesignerWorkspace.jsx",
            "publisher/src/app/page.tsx",
            "frontend/package-lock.json",
            "AGENTS.md",
            "unknown/path",
        ):
            with self.subTest(path=path):
                self.assertTrue(policy.high_risk([path]))
        for path in ("docs/ci.md", "frontend/src/pages/TagsPage.jsx", "frontend/src/components/Modal.jsx"):
            with self.subTest(path=path):
                self.assertFalse(policy.high_risk([path]))

    def test_prospective_tenth_pr_runs_full_before_merge(self):
        with (
            patch.object(policy, "Evidence", return_value=FakeEvidence()),
            patch.object(policy, "changed_paths", return_value=["frontend/src/pages/TagsPage.jsx"]),
            patch.object(policy, "merged_pr_count", return_value=9),
        ):
            self.assertEqual(policy.plan("base", "head", prospective=True, now=NOW)["full"], "true")
            self.assertEqual(policy.plan("base", "head", prospective=False, now=NOW)["full"], "false")

    def test_cumulative_risk_and_provider_failure_choose_full(self):
        with (
            patch.object(policy, "Evidence", return_value=FakeEvidence()),
            patch.object(policy, "changed_paths", side_effect=[["docs/ci.md"], ["backend/core/views.py"]]),
            patch.object(policy, "merged_pr_count", return_value=1),
        ):
            self.assertEqual(policy.plan("base", "head", now=NOW)["full"], "true")
        with (
            patch.object(policy, "changed_paths", return_value=["docs/ci.md"]),
            patch.object(policy, "Evidence", side_effect=policy.EvidenceError("unavailable")),
        ):
            self.assertEqual(policy.plan("base", "head", now=NOW)["full"], "true")

    def test_counts_prs_by_merge_ancestry_not_number_of_commits(self):
        pulls = [
            {"number": 1, "merged_at": FRESH, "merge_commit_sha": "before"},
            {"number": 2, "merged_at": FRESH, "merge_commit_sha": "merge-two"},
            {"number": 3, "merged_at": FRESH, "merge_commit_sha": "future"},
        ]

        def ancestor(base, head):
            return base == "before" or base == "merge-two" and head == "head"

        with (
            patch.object(policy, "api", return_value=pulls),
            patch.object(policy, "git", return_value=FRESH),
            patch.object(policy, "ancestor", side_effect=ancestor),
        ):
            self.assertEqual(policy.merged_pr_count("base", "head"), 1)


class DeploymentEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.patches = [
            patch.object(policy, "git", side_effect=lambda *args: "" if args[0] == "status" else "head"),
            patch.object(policy, "ancestor", return_value=True),
            patch.object(policy, "changed_paths", return_value=["frontend/src/pages/TagsPage.jsx"]),
            patch.object(policy, "merged_pr_count", return_value=1),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def verify(self, evidence):
        with patch.object(policy, "Evidence", return_value=evidence):
            return policy.verify_deploy("head", now=NOW)

    def test_accepts_exact_clean_release_with_complete_full_gate(self):
        self.assertEqual(self.verify(FakeEvidence())["commit"], "head")

    def test_accepts_selected_gate_only_inside_fresh_low_risk_baseline(self):
        jobs = [
            {"name": name, "conclusion": "success", "completed_at": FRESH}
            for name in (policy.FAST_GATE, "CI policy gate")
        ]
        self.assertEqual(self.verify(FakeEvidence(jobs=jobs))["required"], policy.FAST_GATE)
        for changes in (["backend/core/views.py"], ["frontend/src/rendering/RenderFrame.tsx"]):
            with patch.object(policy, "changed_paths", return_value=changes), self.assertRaises(policy.EvidenceError):
                self.verify(FakeEvidence(jobs=jobs))
        with patch.object(policy, "merged_pr_count", return_value=10), self.assertRaises(policy.EvidenceError):
            self.verify(FakeEvidence(jobs=jobs))

    def test_rejects_different_commit_dirty_checkout_and_missing_full_baseline(self):
        with self.assertRaises(policy.EvidenceError):
            self.verify(FakeEvidence(runs=[run(head="other")]))
        with patch.object(policy, "git", return_value="dirty"), self.assertRaises(policy.EvidenceError):
            self.verify(FakeEvidence())
        with self.assertRaises(policy.EvidenceError):
            self.verify(FakeEvidence(baseline=None))
        with patch.object(policy, "ancestor", return_value=False), self.assertRaises(policy.EvidenceError):
            self.verify(FakeEvidence())

    def test_rejects_newer_failed_cancelled_or_pending_attempt_over_old_success(self):
        for status, conclusion in (("in_progress", None), ("completed", "failure"), ("completed", "cancelled")):
            with self.subTest(status=status, conclusion=conclusion), self.assertRaises(policy.EvidenceError):
                self.verify(FakeEvidence(runs=[run(3, status=status, conclusion=conclusion), run(2)]))

    def test_older_run_rerun_after_newer_success_blocks_deployment(self):
        older = {**run(1, conclusion="failure"), "created_at": "2026-11-05T09:00:00Z", "updated_at": FRESH}
        newer = {**run(2), "created_at": "2026-11-05T10:00:00Z", "updated_at": "2026-11-05T10:30:00Z"}
        with patch.object(policy, "api", return_value={"workflow_runs": [newer, older]}):
            evidence = policy.Evidence()
        evidence.job_cache = {1: full_jobs(), 2: full_jobs()}
        with patch.object(evidence, "baseline", return_value=BASELINE), self.assertRaises(policy.EvidenceError):
            self.verify(evidence)

    def test_rejects_skipped_required_full_job_and_stale_or_future_gate(self):
        for name in ("Backend tests", "Frontend admin Playwright", "Publisher checks", "Full CI gate"):
            jobs = full_jobs()
            next(job for job in jobs if job["name"] == f"Full CI / {name}")["conclusion"] = "skipped"
            with self.subTest(name=name), self.assertRaises(policy.EvidenceError):
                self.verify(FakeEvidence(jobs=jobs))
        for date in ("2026-10-29T12:00:00Z", "2027-01-01T00:00:00Z"):
            jobs = full_jobs()
            for job in jobs:
                job["completed_at"] = date
            with self.subTest(date=date), self.assertRaises(policy.EvidenceError):
                self.verify(FakeEvidence(jobs=jobs))

    def test_filters_untrusted_workflows_branches_and_pr_events(self):
        candidates = [
            run(),
            {**run(3), "event": "pull_request"},
            {**run(4), "path": "untrusted.yml"},
            {**run(5), "head_branch": "feature"},
        ]
        with patch.object(policy, "api", return_value={"workflow_runs": candidates}):
            self.assertEqual([item["id"] for item in policy.Evidence().runs], [2])

    def test_unknown_git_history_fails_closed(self):
        with patch.object(policy.subprocess, "run", return_value=subprocess.CompletedProcess([], 128)):
            with self.assertRaises(policy.EvidenceError):
                # Use the real implementation, not setUp's ancestry stub.
                original = self.patches[1]
                original.stop()
                policy.ancestor("missing", "head")


if __name__ == "__main__":
    unittest.main()
