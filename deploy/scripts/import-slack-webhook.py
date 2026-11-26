#!/usr/bin/env python3
"""Import one explicitly authorized clipboard credential, without returning its value."""

import argparse
import os
import re
import stat
import subprocess
import tempfile
from pathlib import Path

KEYS = {"reports": "SLACK_REPORTS_WEBHOOK_URL", "server": "SLACK_SERVER_WEBHOOK_URL"}
WEBHOOK = re.compile(r"https://hooks\.slack\.com/services/[A-Za-z0-9]+/[A-Za-z0-9]+/[A-Za-z0-9]+\Z")


class ImportFailure(Exception):
    pass


def store_webhook(path, kind, value):
    """Values and existing file content must never appear in errors or output."""
    if not isinstance(value, str) or not WEBHOOK.fullmatch(value.strip()):
        raise ImportFailure("clipboard_not_webhook")
    value = value.strip()
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "r", encoding="utf-8") as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o600 or info.st_size > 16384:
            raise ImportFailure("file_not_protected")
        original = handle.read(16385)
    key = KEYS[kind]
    other_key = next(candidate for candidate in KEYS.values() if candidate != key)
    lines = original.splitlines()
    target_rows = [i for i, line in enumerate(lines) if line.startswith(key + "=")]
    other_rows = [line.split("=", 1)[1].strip().strip("\"'") for line in lines if line.startswith(other_key + "=")]
    if len(target_rows) != 1 or len(other_rows) != 1:
        raise ImportFailure("file_keys_not_unique")
    if other_rows[0] and other_rows[0] == value:
        raise ImportFailure("destinations_not_separate")
    lines[target_rows[0]] = key + "=" + value
    temporary = None
    try:
        fd, temporary = tempfile.mkstemp(prefix=".env.slack-import-", suffix=".local", dir=path.parent)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            os.fchmod(handle.fileno(), 0o600)
            handle.write("\n".join(lines) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        temporary = None
    finally:
        if temporary is not None:
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=KEYS)
    parser.add_argument("--from-clipboard", action="store_true", required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    path = root / ".env.slack.local"
    try:
        ignored = subprocess.run(
            ["git", "check-ignore", "-q", "--", str(path)],
            cwd=root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=5,
        )
        if ignored.returncode:
            raise ImportFailure("file_not_ignored")
        copied = subprocess.run(
            ["/usr/bin/pbpaste"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
            timeout=5,
        )
        if copied.returncode or len(copied.stdout) > 8192:
            raise ImportFailure("clipboard_unavailable")
        store_webhook(path, args.kind, copied.stdout.decode("utf-8"))
    except ImportFailure as error:
        print("slack_import=" + str(error))
        return 1
    except Exception:
        print("slack_import=failed")
        return 1
    print("slack_import=stored_" + args.kind)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
