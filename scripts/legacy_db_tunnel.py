#!/usr/bin/env python3
"""Open a loopback-only SSH tunnel to legacy PostgreSQL without exposing secrets."""

from __future__ import annotations

import os
import re
import stat
import subprocess
import sys
from pathlib import Path


def main() -> int:
    env_path = Path(os.environ.get("LEGACY_ENV_FILE", ".env.local")).resolve()
    if not env_path.exists():
        print(f"Missing ignored environment file: {env_path}", file=sys.stderr)
        return 2
    mode = stat.S_IMODE(env_path.stat().st_mode)
    if mode & 0o077:
        print(f"Refusing {env_path}: set permissions to 600 before use", file=sys.stderr)
        return 2

    config = _load_env(env_path)
    try:
        ssh_host = config["LEGACY_SSH_HOST"]
        ssh_user = config["LEGACY_SSH_USER"]
        ssh_port = int(config.get("LEGACY_SSH_PORT", "22"))
        remote_host = config.get("LEGACY_DB_REMOTE_HOST", "127.0.0.1")
        remote_port = int(config.get("LEGACY_DB_REMOTE_PORT", "5432"))
        local_port = int(config.get("LEGACY_DB_PORT", "10110"))
        identity_file = config.get("LEGACY_SSH_IDENTITY_FILE", "")
    except (KeyError, ValueError):
        print("Required LEGACY_SSH_* configuration is missing", file=sys.stderr)
        return 2

    if local_port != 10110:
        print("LEGACY_DB_PORT must use the reserved port 10110", file=sys.stderr)
        return 2
    if not re.fullmatch(r"[A-Za-z0-9._-]+", ssh_host) or not re.fullmatch(r"[A-Za-z0-9._-]+", ssh_user):
        print("LEGACY_SSH_HOST or LEGACY_SSH_USER has an unsafe format", file=sys.stderr)
        return 2
    if not re.fullmatch(r"[A-Za-z0-9._:-]+", remote_host) or not all(
        0 < port < 65536 for port in (ssh_port, remote_port, local_port)
    ):
        print("Legacy tunnel host or port configuration is invalid", file=sys.stderr)
        return 2
    command = [
        "ssh",
        "-N",
        "-T",
        "-o",
        "ExitOnForwardFailure=yes",
        "-o",
        "ServerAliveInterval=30",
        "-o",
        "ServerAliveCountMax=3",
        "-p",
        str(ssh_port),
        "-L",
        f"127.0.0.1:{local_port}:{remote_host}:{remote_port}",
    ]
    if identity_file:
        command.extend(["-i", str(Path(identity_file).expanduser())])
    command.append(f"{ssh_user}@{ssh_host}")
    print(f"Opening legacy PostgreSQL tunnel on 127.0.0.1:{local_port}; press Ctrl-C to close")
    try:
        return subprocess.run(command, check=False).returncode
    except KeyboardInterrupt:
        return 130


def _load_env(path: Path) -> dict[str, str]:
    values = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key] = value
    return values


if __name__ == "__main__":
    raise SystemExit(main())
