"""Validate the CI split without running containers or a browser."""

import subprocess
from pathlib import Path


def validate_full_concurrency(workflow):
    group = workflow["concurrency"]["group"]
    if "github.event.pull_request.number" not in group or "github.event.label.name" not in group:
        raise ValueError("Full CI concurrency must isolate both the PR and the triggering label")


def main():
    import yaml

    root = Path(__file__).resolve().parents[1]
    workflows = {}
    for path in (root / ".github/workflows").glob("ci*.yml"):
        workflow = yaml.safe_load(path.read_text())
        workflows[path.name] = workflow
        jobs = workflow["jobs"]
        for job in jobs.values():
            needs = job.get("needs", [])
            if isinstance(needs, str):
                needs = [needs]
            assert all(name in jobs for name in needs), f"Unknown dependency in {path.name}"
            for step in job.get("steps", []):
                if "run" in step:
                    subprocess.run(["bash", "-n"], input=step["run"], text=True, check=True)
    fast = workflows["ci.yml"]
    full = workflows["ci-full.yml"]
    validate_full_concurrency(full)
    reusable = workflows["ci-checks.yml"]
    # PyYAML's YAML 1.1 parser treats the Actions `on` key as the boolean True.
    full_events = full.get("on", full.get(True))
    fast_events = fast.get("on", fast.get(True))
    assert full_events["pull_request"] == {"types": ["labeled"]}
    assert full_events["schedule"] == [{"cron": "0 3 * * 1"}]
    assert "workflow_dispatch" in full_events
    assert "github.ref" in full["concurrency"]["group"]
    assert "labeled" not in fast_events["pull_request"]["types"]
    assert fast["jobs"]["checks"]["with"]["full"] is False
    assert full["jobs"]["checks"]["with"]["full"] is True
    assert full["jobs"]["checks"]["if"] == "github.event_name != 'pull_request' || github.event.label.name == 'full-ci'"
    assert fast["jobs"]["checks"]["needs"] == "policy"
    assert fast["jobs"]["checks"]["if"] == "needs.policy.outputs.full == 'false'"
    assert fast["jobs"]["full"]["if"] == "needs.policy.outputs.full == 'true'"
    assert fast["jobs"]["full"]["with"]["full"] is True
    assert fast["jobs"]["full"]["name"] == "Full CI"
    assert fast["permissions"]["actions"] == "read"
    assert fast["permissions"]["pull-requests"] == "read"
    assert reusable["jobs"]["frontend-tests"]["steps"][0]["with"]["fetch-depth"] == 0
    assert fast["jobs"]["gate"]["name"] == "CI policy gate"
    assert fast["jobs"]["gate"]["if"] == "always()"
    assert set(fast["jobs"]["gate"]["needs"]) == {"policy", "checks", "full"}
    for workflow in (fast, full):
        assert workflow["jobs"]["checks"]["uses"] == "./.github/workflows/ci-checks.yml"
    for job in ("backend-tests", "publisher-checks", "frontend-admin-e2e"):
        assert reusable["jobs"][job]["if"].startswith("inputs.full &&")
    gate = reusable["jobs"]["ci-gate"]
    assert gate["if"] == "always()"
    assert gate["name"] == "${{ inputs.full && 'Full CI gate' || 'Fast CI gate' }}"
    print("CI workflow YAML, dependencies and shell syntax are valid")


if __name__ == "__main__":
    main()
