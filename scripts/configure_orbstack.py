#!/usr/bin/env python3
"""Configure ECEEE as a consumer of the shared OrbStack services.

This helper reads provider-managed secret files internally and atomically updates
only the known local-development keys in the ignored repo-root .env file. It
never prints credential values.
"""

from __future__ import annotations

import argparse
import os
import re
import socket
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROVIDER = ROOT.parent / "shared-local-infrastructure"
ENV_FILE = ROOT / ".env"
TEMPLATE = ROOT / ".env.template"


def read_secret(path: Path) -> str:
    if not path.is_file() or path.is_symlink():
        raise SystemExit(f"missing or unsafe provider secret file: {path}")
    if path.stat().st_mode & 0o077:
        raise SystemExit(f"provider secret file must be mode 0600: {path}")
    value = path.read_text(encoding="utf-8").strip()
    if not value:
        raise SystemExit(f"provider secret file is empty: {path}")
    return value


def replace_dotenv_values(original: str, updates: dict[str, str]) -> str:
    remaining = dict(updates)
    output: list[str] = []
    for raw_line in original.splitlines():
        match = re.match(r"^(?:export\s+)?([A-Z][A-Z0-9_]*)=", raw_line)
        if match and match.group(1) in remaining:
            key = match.group(1)
            output.append(f"{key}={remaining.pop(key)}")
        else:
            output.append(raw_line)
    if remaining:
        if output and output[-1]:
            output.append("")
        output.append("# Shared OrbStack local development services")
        output.extend(f"{key}={value}" for key, value in remaining.items())
    return "\n".join(output) + "\n"


def atomic_write(path: Path, content: str) -> None:
    fd, temporary = tempfile.mkstemp(prefix=".env.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def check_port(name: str, port: int) -> None:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=2):
            pass
    except OSError as exc:
        raise SystemExit(f"shared {name} is not reachable on 127.0.0.1:{port}") from exc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider-root", type=Path, default=DEFAULT_PROVIDER)
    parser.add_argument("--backend-port", type=int, default=10101)
    parser.add_argument("--frontend-port", type=int, default=10100)
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--demo", action="store_true")
    args = parser.parse_args()
    provider = args.provider_root.resolve()

    context = subprocess.run(
        ["docker", "context", "show"], text=True, capture_output=True, check=False
    ).stdout.strip()
    if context != "orbstack":
        raise SystemExit("local ECEEE development requires the orbstack Docker context")

    password_root = provider / "secrets" / "projects"
    postgres_password = read_secret(
        password_root / ("eceee-v4-demo.password" if args.demo else "eceee-v4.password")
    )
    redis_password = read_secret(password_root / "eceee-v4.redis.password")
    minio_secret = read_secret(password_root / "eceee-v4.minio.secret-key")

    check_port("PostgreSQL", 10300)
    check_port("Redis", 10301)
    check_port("MinIO", 10302)

    postgres_database = "eceee_demo" if args.demo else "eceee_v4"
    postgres_user = "local_eceee_demo" if args.demo else "local_eceee_v4"
    updates = {
        "COMPOSE_PROJECT_NAME": "eceee-v4",
        "FRONTEND_PORT": str(args.frontend_port),
        "BACKEND_PORT": str(args.backend_port),
        "ECEEE_IMGPROXY_PORT": "10106",
        "ECEEE_PLAYWRIGHT_PORT": "10107",
        "POSTGRES_DB": postgres_database,
        "POSTGRES_USER": postgres_user,
        "POSTGRES_PASSWORD": postgres_password,
        "POSTGRES_HOST": "host.docker.internal",
        "POSTGRES_PORT": "10300",
        "DATABASE_URL": (
            f"postgresql://{postgres_user}:"
            f"{quote(postgres_password, safe='')}@host.docker.internal:10300/{postgres_database}"
        ),
        "REDIS_URL": (
            "redis://eceee_v4:"
            f"{quote(redis_password, safe='')}@host.docker.internal:10301/0"
        ),
        "ECEEE_REDIS_NAMESPACE": "eceee_v4",
        "AWS_ACCESS_KEY_ID": "eceee-v4",
        "AWS_SECRET_ACCESS_KEY": minio_secret,
        "AWS_STORAGE_BUCKET_NAME": "eceee-media",
        "AWS_S3_ENDPOINT_URL": "http://localhost:10302",
        "AWS_S3_INTERNAL_ENDPOINT_URL": "http://host.docker.internal:10302",
    }

    if ENV_FILE.exists():
        if not ENV_FILE.is_file() or ENV_FILE.is_symlink():
            raise SystemExit(f"unsafe local env path: {ENV_FILE}")
        original = ENV_FILE.read_text(encoding="utf-8")
    elif TEMPLATE.is_file():
        original = TEMPLATE.read_text(encoding="utf-8")
    else:
        original = ""
    if args.check_only:
        if not ENV_FILE.exists() or ENV_FILE.stat().st_mode & 0o077:
            raise SystemExit("local .env is missing or is not mode 0600")
        present: dict[str, str] = {}
        for line in original.splitlines():
            match = re.match(r"^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$", line)
            if match:
                present[match.group(1)] = match.group(2)
        if any(present.get(key) != value for key, value in updates.items()):
            raise SystemExit(
                "local .env needs reconfiguration; run make configure-local-infra"
            )
        print("eceee-local-runtime=orbstack")
        print("eceee-shared-services=postgres,redis,minio:reachable")
        print("eceee-env=current:mode-0600")
        return 0

    atomic_write(ENV_FILE, replace_dotenv_values(original, updates))
    print("eceee-local-runtime=orbstack")
    print("eceee-shared-services=postgres,redis,minio:configured")
    print("eceee-env=updated:mode-0600")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
