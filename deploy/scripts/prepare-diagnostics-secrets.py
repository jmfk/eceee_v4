#!/usr/bin/env python3
"""Prepare diagnostic secrets without emitting values. Does not enable access or install services."""

import argparse
import os
import re
import secrets
import stat
import tempfile
from pathlib import Path


def read_protected(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "r", encoding="utf-8") as handle:
        mode = os.fstat(handle.fileno()).st_mode
        if not stat.S_ISREG(mode) or stat.S_IMODE(mode) != 0o600:
            raise ValueError()
        return handle.read()


def replace_protected(path, text):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, prefix=".diagnostics-", delete=False
        ) as handle:
            temporary = Path(handle.name)
            os.fchmod(handle.fileno(), 0o600)
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def prepare(env_file, signing_file):
    lines = read_protected(env_file).splitlines()
    values = {}
    positions = {}
    names = {"DIAGNOSTICS_DB_PASSWORD", "DIAGNOSTICS_LOG_SIGNING_KEY", "DIAGNOSTICS_ENABLED"}
    for index, line in enumerate(lines):
        name, separator, value = line.partition("=")
        name = name.strip().removeprefix("export ")
        if separator and name in names:
            if name in values:
                raise ValueError()
            values[name] = value.strip().strip("\"'")
            positions[name] = index
    key = read_protected(signing_file).strip() if signing_file.exists() else None
    configured = values.get("DIAGNOSTICS_LOG_SIGNING_KEY")
    if key and configured and key != configured:
        raise ValueError()
    signing = key or configured or secrets.token_urlsafe(48)
    password = values.get("DIAGNOSTICS_DB_PASSWORD") or secrets.token_urlsafe(48)
    if not re.fullmatch(r"[A-Za-z0-9._~-]{32,128}", signing) or not re.fullmatch(r"[A-Za-z0-9._~-]{32,128}", password):
        raise ValueError()
    updates = {"DIAGNOSTICS_DB_PASSWORD": password, "DIAGNOSTICS_LOG_SIGNING_KEY": signing}
    if "DIAGNOSTICS_ENABLED" not in values:
        updates["DIAGNOSTICS_ENABLED"] = "0"
    for name, value in updates.items():
        replacement = name + "=" + value
        if name in positions:
            lines[positions[name]] = replacement
        else:
            lines.append(replacement)
    if not key:
        replace_protected(signing_file, signing + "\n")
    replace_protected(env_file, "\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", required=True, type=Path)
    parser.add_argument("--signing-key-file", required=True, type=Path)
    args = parser.parse_args()
    try:
        prepare(args.env_file, args.signing_key_file)
        print("diagnostics_secrets=prepared")
    except Exception:
        print("diagnostics_secrets=failed")
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
