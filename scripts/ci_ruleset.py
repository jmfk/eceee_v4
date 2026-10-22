"""Preview, or explicitly install, the main-only CI ruleset after workflow rollout."""

import argparse
import json
import re
import subprocess

RULESET_NAME = "ECEEE CI merge gates"
CHECKS = ("Fast CI / Fast CI gate", "Full CI / Full CI gate")
ACTIONS_APP_ID = 15368


def desired_ruleset():
    return {
        "name": RULESET_NAME,
        "target": "branch",
        "enforcement": "active",
        "bypass_actors": [],
        "conditions": {"ref_name": {"include": ["refs/heads/main"], "exclude": []}},
        "rules": [
            {
                "type": "required_status_checks",
                "parameters": {
                    "strict_required_status_checks_policy": True,
                    "required_status_checks": [{"context": name, "integration_id": ACTIONS_APP_ID} for name in CHECKS],
                },
            }
        ],
    }


def api(path, payload=None):
    command = ["gh", "api", path]
    if payload is not None:
        command += ["--method", "POST", "--input", "-"]
    return json.loads(subprocess.check_output(command, input=json.dumps(payload).encode() if payload else None))


def install(repo, verification_sha):
    # This also makes it impossible to enable the required check before its workflow is on main.
    api(f"repos/{repo}/contents/.github/workflows/ci-full.yml?ref=main")
    api(f"repos/{repo}/contents/.github/workflows/ci.yml?ref=main")
    checks = api(f"repos/{repo}/commits/{verification_sha}/check-runs?per_page=100")["check_runs"]
    for name in CHECKS:
        matching = [check for check in checks if check["name"] == name and check["app"]["id"] == ACTIONS_APP_ID]
        if not matching or matching[0]["status"] != "completed" or matching[0]["conclusion"] != "success":
            raise ValueError(f"No successful GitHub Actions check named {name!r} on the verification SHA")
    existing = [rule for rule in api(f"repos/{repo}/rulesets?per_page=100") if rule["name"] == RULESET_NAME]
    desired = desired_ruleset()
    if existing:
        current = api(f"repos/{repo}/rulesets/{existing[0]['id']}")
        if any(current.get(key) != value for key, value in desired.items()):
            raise ValueError("Existing CI ruleset differs; refusing to overwrite repository policy")
        return "CI ruleset already matches; no changes"
    created = api(f"repos/{repo}/rulesets", desired)
    current = api(f"repos/{repo}/rulesets/{created['id']}")
    if any(current.get(key) != value for key, value in desired.items()):
        raise ValueError("Ruleset readback differs; inspect repository rules before merging")
    return "CI ruleset created and verified; existing rulesets preserved"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default="jmfk/eceee_v4")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--verification-sha")
    args = parser.parse_args()
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", args.repo):
        parser.error("Expected owner/repository")
    if not args.apply:
        print(json.dumps(desired_ruleset(), indent=2))
        return
    if not args.verification_sha or not re.fullmatch(r"[0-9a-f]{40}", args.verification_sha):
        parser.error("--apply requires --verification-sha with successful checks from the rollout")
    try:
        print(install(args.repo, args.verification_sha))
    except ValueError as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
