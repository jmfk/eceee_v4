"""Risk/cadence policy and fail-closed reuse of GitHub Actions deployment evidence."""

import argparse
import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ci_policy import high_risk, select

REPOSITORY = "jmfk/eceee_v4"
WORKFLOWS = {".github/workflows/ci.yml", ".github/workflows/ci-full.yml"}
EVENTS = {"push", "schedule", "workflow_dispatch"}
FULL_GATE = "Full CI / Full CI gate"
FAST_GATE = "Fast CI / Fast CI gate"


class EvidenceError(ValueError):
    pass


def git(*args):
    return subprocess.check_output(["git", *args], text=True).strip()


def ancestor(base, head):
    result = subprocess.run(["git", "merge-base", "--is-ancestor", base, head], capture_output=True, text=True)
    if result.returncode not in (0, 1):
        raise EvidenceError("Complete Git history is required")
    return result.returncode == 0


def api(path):
    result = subprocess.run(["gh", "api", f"repos/{REPOSITORY}/{path}"], capture_output=True, text=True)
    if result.returncode:
        # Never echo provider diagnostics, headers, or credential configuration.
        raise EvidenceError("GitHub Actions evidence is unavailable")
    return json.loads(result.stdout)


def timestamp(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def changed_paths(base, head):
    output = subprocess.check_output(["git", "diff", "--name-only", "--no-renames", "-z", base, head], text=True)
    return [path for path in output.split("\0") if path]


class Evidence:
    def __init__(self):
        self.runs = [
            run
            for run in api("actions/runs?branch=main&per_page=100")["workflow_runs"]
            if run["path"] in WORKFLOWS and run["event"] in EVENTS and run["head_branch"] == "main"
        ]
        # Reruns keep their original creation time. Order by the attempt's last
        # update so a recently failed rerun cannot hide behind an older success.
        self.runs.sort(key=lambda run: (run["updated_at"], run["id"]), reverse=True)
        self.job_cache = {}

    def jobs(self, run):
        if run["id"] not in self.job_cache:
            data = api(f"actions/runs/{run['id']}/jobs?filter=latest&per_page=100")
            if data["total_count"] > 100:
                raise EvidenceError("Unexpected CI job count")
            self.job_cache[run["id"]] = data["jobs"]
        return self.job_cache[run["id"]]

    def gate_passed(self, run, name):
        if run["status"] != "completed" or run["conclusion"] != "success":
            return False
        jobs = self.jobs(run)
        gates = [job for job in jobs if job["name"] == name]
        passed = (
            len(gates) == 1
            and gates[0]["conclusion"] == "success"
            and all(job["conclusion"] in {"success", "skipped"} for job in jobs)
        )
        if run["path"] == ".github/workflows/ci.yml":
            passed = passed and any(job["name"] == "CI policy gate" and job["conclusion"] == "success" for job in jobs)
        if name == FULL_GATE:
            required = {
                "Select CI checks",
                "Python helper tests",
                "Backend lint",
                "Frontend lint",
                "Backend tests",
                "Frontend unit tests",
                "Publisher checks",
            }
            passed = passed and all(
                any(job["name"] == f"Full CI / {suffix}" and job["conclusion"] == "success" for job in jobs)
                for suffix in required
            )
        return passed

    def baseline(self, head):
        for run in self.runs:
            if run["status"] != "completed" or run["conclusion"] != "success":
                continue
            if ancestor(run["head_sha"], head) and self.gate_passed(run, FULL_GATE):
                completed = next(job["completed_at"] for job in self.jobs(run) if job["name"] == FULL_GATE)
                return {"commit": run["head_sha"], "completed_at": completed, "run_id": run["id"]}
        return None


def merged_pr_count(base, head):
    """Count merged PRs, not commits (the repository uses rebase merges)."""
    if base == head:
        return 0
    cutoff = timestamp(git("show", "-s", "--format=%cI", base))
    count = 0
    page = 1
    while True:
        pulls = api(f"pulls?state=closed&base=main&sort=updated&direction=desc&per_page=100&page={page}")
        for pull in pulls:
            merge = pull.get("merge_commit_sha")
            if pull.get("merged_at") and merge and ancestor(merge, head) and not ancestor(merge, base):
                count += 1
        if len(pulls) < 100 or timestamp(pulls[-1]["updated_at"]) < cutoff:
            return count
        page += 1


def full_reason(paths, baseline, count, now):
    if high_risk(paths):
        return "high-risk or unknown change"
    if not baseline:
        return "no verified full baseline"
    completed = timestamp(baseline["completed_at"])
    if completed > now or now - completed >= timedelta(days=7):
        return "weekly full verification due"
    if count >= 10:
        return "tenth merged PR since full verification"
    return ""


def plan(base, head, prospective=False, now=None):
    now = now or datetime.now(timezone.utc)
    paths = changed_paths(base, head)
    if high_risk(paths):
        return {
            **select(paths, "full", base),
            "full": "true",
            "reason": "high-risk or unknown change",
            "baseline": "",
            "merged_prs": str(int(prospective)),
        }
    try:
        evidence = Evidence()
        baseline = evidence.baseline(head)
        count = merged_pr_count(baseline["commit"], head) if baseline else 0
        # Inspect the cumulative diff too, so an unverified risky change cannot
        # disappear behind a later cosmetic PR.
        cumulative = changed_paths(baseline["commit"], head) if baseline else paths
        reason = full_reason(paths + cumulative, baseline, count + int(prospective), now)
    except (EvidenceError, KeyError, ValueError, subprocess.CalledProcessError):
        baseline, count, reason = None, 0, "evidence unavailable; conservative full verification"
    return {
        **select(paths, "full" if reason else "fast", base),
        "full": str(bool(reason)).lower(),
        "reason": reason or "affected tests",
        "baseline": baseline["commit"] if baseline else "",
        "merged_prs": str(count + int(prospective)),
    }


def verify_deploy(head, now=None):
    now = now or datetime.now(timezone.utc)
    if git("rev-parse", "HEAD") != head or git("status", "--porcelain", "--untracked-files=normal"):
        raise EvidenceError("Deploy from a clean checkout of the exact release commit")
    if not ancestor(head, "origin/main"):
        raise EvidenceError("The release must be merged into origin/main")
    evidence = Evidence()
    matching = [run for run in evidence.runs if run["head_sha"] == head]
    if not matching:
        raise EvidenceError("No main-branch CI evidence for the exact release commit")
    # A later failed, pending, or cancelled attempt must not be hidden by an old
    # success. Check the latest run of every applicable workflow for this commit.
    latest = {}
    for run in matching:
        latest.setdefault(run["path"], run)
    for run in latest.values():
        if run["status"] != "completed" or run["conclusion"] != "success":
            raise EvidenceError("Latest release CI is pending, failed, or cancelled")
    baseline = evidence.baseline(head)
    if not baseline:
        raise EvidenceError("A successful full baseline is required before deployment")
    count = merged_pr_count(baseline["commit"], head)
    reason = full_reason(changed_paths(baseline["commit"], head), baseline, count, now)
    required = FULL_GATE if reason else FAST_GATE
    for run in latest.values():
        for gate in {FULL_GATE, required}:
            if not evidence.gate_passed(run, gate):
                continue
            completed = timestamp(next(job["completed_at"] for job in evidence.jobs(run) if job["name"] == gate))
            if completed <= now and now - completed < timedelta(days=7):
                return {"commit": head, "run_id": run["id"], "url": run["html_url"], "required": required}
    raise EvidenceError("Required fresh CI gate is missing for the release; run CI, not a local duplicate")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    selection = commands.add_parser("plan")
    selection.add_argument("--base", required=True)
    selection.add_argument("--head", default="HEAD")
    selection.add_argument("--prospective-pr", action="store_true")
    selection.add_argument("--github-output", type=Path)
    verification = commands.add_parser("verify-deploy")
    verification.add_argument("--ref", required=True)
    args = parser.parse_args()
    try:
        if git("rev-parse", "--is-shallow-repository") != "false":
            raise EvidenceError("Complete Git history is required")
        if args.command == "verify-deploy":
            result = verify_deploy(git("rev-parse", "--verify", f"{args.ref}^{{commit}}"))
        else:
            if not args.base or set(args.base) == {"0"}:
                raise EvidenceError("A nonzero event base SHA is required")
            result = plan(args.base, args.head, args.prospective_pr)
            if args.github_output:
                with args.github_output.open("a") as output:
                    output.writelines(f"{key}={value}\n" for key, value in result.items())
    except (EvidenceError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"{error}\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
