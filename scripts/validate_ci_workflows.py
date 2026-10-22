"""Validate the CI split without running containers or a browser."""

import subprocess
from pathlib import Path

import yaml


def main():
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
    reusable = workflows["ci-checks.yml"]
    # PyYAML's YAML 1.1 parser treats the Actions `on` key as the boolean True.
    full_events = full.get("on", full.get(True))
    fast_events = fast.get("on", fast.get(True))
    assert full_events == {"pull_request": {"types": ["labeled"]}}
    assert "labeled" not in fast_events["pull_request"]["types"]
    assert fast["jobs"]["checks"]["with"]["full"] is False
    assert full["jobs"]["checks"]["with"]["full"] is True
    assert full["jobs"]["checks"]["if"] == "github.event.label.name == 'full-ci'"
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
