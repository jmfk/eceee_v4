#!/usr/bin/env python3
"""Prepare the local deployment environment for both ECEEE Slack streams; never contact production."""

import argparse
import fcntl
import os
import re
import stat
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOOK_KEYS = ("SLACK_REPORTS_WEBHOOK_URL", "SLACK_SERVER_WEBHOOK_URL")
WEBHOOK = re.compile(r"https://hooks\.slack\.com/services/[A-Za-z0-9]+/[A-Za-z0-9]+/[A-Za-z0-9]+\Z")


class SetupError(Exception):
    """Only bounded operator messages, never environment content."""


def protected_text(path):
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "r", encoding="utf-8") as handle:
            info = os.fstat(handle.fileno())
            if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600 or info.st_size > 1024 * 1024:
                raise SetupError("Environment files must be regular mode-0600 files.")
            return handle.read()
    except (OSError, UnicodeError):
        raise SetupError("A protected environment file could not be read.") from None


def setting(content, key):
    values = re.findall(r"^(?:export\s+)?" + re.escape(key) + r"\s*=([^\n]*)$", content, re.M)
    if len(values) > 1:
        raise SetupError("Duplicate Slack or application settings must be resolved first.")
    return values[0].strip().strip("\"'") if values else ""


def prepared_environment(original, source):
    hooks = {key: setting(source, key) for key in HOOK_KEYS}
    if any(not WEBHOOK.fullmatch(value) for value in hooks.values()) or len(set(hooks.values())) != 2:
        raise SetupError("Two valid, distinct Slack webhook destinations are required.")
    if setting(original, "SUPPORT_APP_URL") not in {"", "https://app.eceee.org"}:
        raise SetupError("The deployment environment must belong to the ECEEE production CMS origin.")
    if any(setting(original, key) not in {"", value} for key, value in hooks.items()):
        raise SetupError("Existing different webhook credentials require a separate rotation decision.")
    updates = {
        **hooks,
        "SLACK_REPORTS_ENABLED": "True",
        "SLACK_SERVER_ERRORS_ENABLED": "True",
        "SLACK_ENVIRONMENT": "production",
        "SUPPORT_APP_URL": "https://app.eceee.org",
    }
    result = original
    for key, value in updates.items():
        setting(original, key)  # Reject duplicate flags as well as duplicate credentials.
        pattern = re.compile(r"^(?:export\s+)?" + re.escape(key) + r"\s*=.*$", re.M)
        if pattern.search(result):
            result = pattern.sub(lambda match: key + "=" + value, result)
        else:
            result = result.rstrip("\n") + "\n" + key + "=" + value + "\n"
    return result


def stage(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    # Stable lock survives the atomic replacement. No credentials enter the lock file.
    lock_path = target.parent / ".slack-config.lock"
    fd = os.open(lock_path, os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        original = protected_text(target)
        result = prepared_environment(original, protected_text(source))
        if result == original:
            return False
        temporary = None
        try:
            fd, temporary = tempfile.mkstemp(prefix=".env.slack-stage-", suffix=".local", dir=target.parent)
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                os.fchmod(handle.fileno(), 0o600)
                handle.write(result)
                handle.flush()
                os.fsync(handle.fileno())
            if protected_text(target) != original:
                raise SetupError("The deployment environment changed concurrently; retry after resolving the writer.")
            os.replace(temporary, target)
            temporary = None
        finally:
            if temporary is not None:
                os.unlink(temporary)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--webhooks-env", type=Path, default=ROOT / ".env.slack.local")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    print("Scope: local deploy/.env; enable report and server-error notices; no SSH, restart or deployment.")
    if not args.apply:
        print("Plan only. Re-run with --apply after preparing the protected deployment environment.")
        return 0
    source = args.webhooks_env.absolute()
    target = ROOT / "deploy/.env"
    try:
        for path in (source, target):
            ignored = subprocess.run(
                ["git", "check-ignore", "-q", "--", str(path)],
                cwd=path.parent,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
                check=False,
            )
            if ignored.returncode:
                raise SetupError("Both credential files must be Git-ignored in their owning checkout.")
        changed = stage(source, target)
    except SetupError as error:
        print("slack_configuration=failed: " + str(error))
        return 1
    except Exception:
        print("slack_configuration=failed")
        return 1
    print("slack_configuration=" + ("staged" if changed else "unchanged"))
    print("Next: reviewed tagged make prod-deploy; production has not been contacted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
