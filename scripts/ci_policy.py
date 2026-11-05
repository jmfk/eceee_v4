"""Select CI work from the complete PR diff and reject incomplete merge gates."""

import argparse
import json
import os
import subprocess
from pathlib import Path


def high_risk(paths):
    """Keep persisted data, authorization, shared runtime and controls conservative."""
    for path in paths:
        if path == "AGENTS.md":
            return True
        if path.startswith(("docs/", "manuals/", "specs/", "ToDo/")) or path.endswith(".md"):
            continue
        if path.startswith("frontend/src/"):
            relative = path.removeprefix("frontend/src/")
            if relative.startswith(("components/", "pages/", "locales/")) and not any(
                word in relative.lower()
                for word in ("auth", "login", "permission", "tenant", "session", "editor", "publish", "designer/")
            ):
                continue
            return True
        if path.startswith("frontend/public/"):
            continue
        # Backend changes may affect persistence/security across Django apps.
        # Unknown paths and dependency/build/CI/deploy changes always go full.
        return True
    return False


def select(paths, mode, base):
    selected = {"backend": False, "frontend": False, "publisher": False}
    for path in paths:
        if path.startswith(
            ("backend/widget_contracts/", "backend/webpages/tests/fixtures/pilot_baseline/")
        ) or path == ("frontend/src/rendering/generated/render-manifest.json"):
            selected = dict.fromkeys(selected, True)
        elif path.startswith("backend/"):
            selected["backend"] = True
        elif path.startswith("frontend/"):
            selected["frontend"] = True
        elif path.startswith("publisher/"):
            selected["publisher"] = True
        elif path.startswith(("docs/", "manuals/", "specs/", "ToDo/")) or path.endswith(".md"):
            continue
        else:
            # CI, deployment, dependencies and unknown paths conservatively affect all packages.
            selected = dict.fromkeys(selected, True)
    if mode == "full":
        selected = dict.fromkeys(selected, True)
    return {**{key: str(value).lower() for key, value in selected.items()}, "base": base}


def historical_migrations_required(paths):
    """Replay old schemas for schema/fixture changes, retaining conservative controls."""
    for path in paths:
        if path.startswith(("frontend/", "publisher/", "docs/", "manuals/", "specs/", "ToDo/")):
            continue
        if path.endswith(".md") and path != "AGENTS.md":
            continue
        if not path.startswith("backend/"):
            return True
        if path.startswith("backend/config/"):
            return True
        if any(part in path for part in ("/migrations/", "/models/", "/fixtures/", "/requirements/")):
            return True
        if Path(path).name in {"models.py", "settings.py", "conftest.py"} or "migration" in Path(path).name:
            return True
        if path in {"backend/kanban/tests.py", "backend/webpages/tests/test_theme_versions.py"}:
            return True
    return False


def verify_gate(needs, full):
    required = {"detect", "python-tests"}
    outputs = needs.get("detect", {}).get("outputs", {})
    if full:
        required.update(
            {
                "backend-lint",
                "frontend-lint",
                "backend-tests",
                "frontend-tests",
                "publisher-checks",
            }
        )
    else:
        for package, jobs in {
            "backend": {"backend-lint"},
            "frontend": {"frontend-lint", "frontend-tests"},
            "publisher": {"publisher-unit-tests"},
        }.items():
            if outputs.get(package) not in {"true", "false"}:
                raise ValueError(f"Missing or invalid selection for {package}")
            if outputs[package] == "true":
                required.update(jobs)
    failed = sorted(job for job in required if needs.get(job, {}).get("result") != "success")
    if failed:
        raise ValueError("Required CI jobs did not succeed: " + ", ".join(failed))
    # Fail even if an optional/unexpected job ran and failed.
    if any(job.get("result") not in {"success", "skipped"} for job in needs.values()):
        raise ValueError("A CI job failed, was cancelled, or has not completed")


def verify_workflow_gate(needs):
    """One stable branch-protection check for the conditional reusable callers."""
    mode = needs.get("policy", {}).get("outputs", {}).get("full")
    if mode not in {"true", "false"} or needs.get("policy", {}).get("result") != "success":
        raise ValueError("CI risk/cadence plan did not succeed")
    selected, skipped = ("full", "checks") if mode == "true" else ("checks", "full")
    if needs.get(selected, {}).get("result") != "success" or needs.get(skipped, {}).get("result") != "skipped":
        raise ValueError("The planned CI caller did not succeed exclusively")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    selection = sub.add_parser("select")
    selection.add_argument("--base", required=True)
    selection.add_argument("--head", default="HEAD")
    selection.add_argument("--mode", choices=("fast", "full"), required=True)
    selection.add_argument("--github-output", type=Path)
    sub.add_parser("gate")
    sub.add_parser("workflow-gate")
    backend = sub.add_parser("backend-test-args")
    backend.add_argument("--base", required=True)
    backend.add_argument("--historical", choices=("true", "false"), required=True)
    args = parser.parse_args()
    if args.command == "backend-test-args":
        paths = subprocess.check_output(
            ["git", "diff", "--name-only", "--no-renames", args.base, "HEAD"], text=True
        ).splitlines()
        if args.historical == "false" and not historical_migrations_required(paths):
            print("--exclude-tag=historical_migration")
        return
    if args.command == "workflow-gate":
        try:
            verify_workflow_gate(json.loads(os.environ["NEEDS_JSON"]))
        except (ValueError, KeyError) as error:
            parser.exit(1, f"{error}\n")
        print("The planned CI verification succeeded")
        return
    if args.command == "gate":
        try:
            verify_gate(json.loads(os.environ["NEEDS_JSON"]), os.environ["FULL_CI"] == "true")
        except (ValueError, KeyError) as error:
            parser.exit(1, f"{error}\n")
        print("All required CI jobs succeeded")
        return
    # Never silently narrow the diff when history or the event base is unavailable.
    if not args.base or set(args.base) == {"0"}:
        parser.error("A nonzero event base SHA is required")
    for ref in (args.base, args.head):
        subprocess.run(["git", "rev-parse", "--verify", f"{ref}^{{commit}}"], check=True, stdout=subprocess.DEVNULL)
    paths = subprocess.check_output(
        ["git", "diff", "--name-only", "--no-renames", "-z", args.base, args.head], text=True
    ).split("\0")
    result = select([path for path in paths if path], args.mode, args.base)
    print(json.dumps(result))
    if args.github_output:
        with args.github_output.open("a") as output:
            output.writelines(f"{key}={value}\n" for key, value in result.items())


if __name__ == "__main__":
    main()
