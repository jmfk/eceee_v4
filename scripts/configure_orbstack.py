#!/usr/bin/env python3
"""Configure ECEEE as a consumer of the shared OrbStack services.

This helper reads provider-managed secret files internally and atomically updates
only the known local-development keys in the ignored repo-root .env file. It
never prints credential values.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import socket
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROVIDER = Path(
    os.environ.get(
        "SHARED_LOCAL_INFRA_ROOT", ROOT.parent / "shared-local-infrastructure"
    )
).expanduser()
ENV_FILE = ROOT / ".env"
TEMPLATE = ROOT / ".env.template"
DEFAULT_PORT_REGISTRY_SCRIPT = Path(
    os.environ.get(
        "PORT_SPACE_REGISTRY_SCRIPT",
        Path.home()
        / ".codex"
        / "skills"
        / "port-space-registry"
        / "scripts"
        / "port_space_registry.py",
    )
).expanduser()


def load_registered_ports(
    project_root: Path = ROOT,
    registry_script: Path = DEFAULT_PORT_REGISTRY_SCRIPT,
) -> dict[str, int]:
    if not registry_script.is_file():
        raise SystemExit(
            "machine port registry helper not found; set PORT_SPACE_REGISTRY_SCRIPT"
        )

    result = subprocess.run(
        [
            sys.executable,
            str(registry_script),
            "get",
            "--project",
            str(project_root.resolve()),
            "--json",
        ],
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(
            "this checkout has no readable machine port registry reservation"
        )

    try:
        payload = json.loads(result.stdout)
        ports = {name: int(port) for name, port in payload["ports"].items()}
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise SystemExit("machine port registry returned invalid project data") from exc

    missing = {"frontend", "backend", "imgproxy", "playwright-renderer"} - ports.keys()
    if missing:
        raise SystemExit(
            "machine port registry is missing required labels: "
            + ", ".join(sorted(missing))
        )
    return ports


def validate_registered_ports(
    frontend_port: int,
    backend_port: int,
    registered_ports: dict[str, int],
) -> None:
    expected = {
        "frontend": registered_ports["frontend"],
        "backend": registered_ports["backend"],
    }
    actual = {"frontend": frontend_port, "backend": backend_port}
    mismatches = [
        f"{name}={actual[name]} (registered {expected[name]})"
        for name in expected
        if actual[name] != expected[name]
    ]
    if mismatches:
        raise SystemExit(
            "ECEEE host ports are fixed by the machine port registry: "
            + ", ".join(mismatches)
        )


def checkout_redis_namespace(project_root: Path = ROOT) -> str:
    """Return an ACL-compatible Redis namespace unique to this checkout."""
    checkout = re.sub(r"[^a-z0-9_-]+", "-", project_root.name.lower()).strip("-_")
    if not checkout:
        raise SystemExit("cannot derive a Redis namespace from the checkout path")
    return f"eceee_v4:{checkout}"


def checkout_postgres_identity(project_root: Path = ROOT) -> tuple[str, str]:
    """Return the conventional database and role names for an isolated checkout."""
    database = re.sub(r"[^a-z0-9_]+", "_", project_root.name.lower()).strip("_")
    if not database:
        raise SystemExit("cannot derive a PostgreSQL identity from the checkout path")
    return database, f"local_{database}"


def has_isolated_postgres_config(
    present: dict[str, str], project_root: Path = ROOT
) -> bool:
    """Check whether the current env already targets this checkout's clone."""
    database, user = checkout_postgres_identity(project_root)
    return (
        database != "eceee_v4"
        and present.get("POSTGRES_DB") == database
        and present.get("POSTGRES_USER") == user
        and bool(present.get("POSTGRES_PASSWORD"))
    )


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


def parse_dotenv_values(content: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in content.splitlines():
        match = re.match(r"^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$", line)
        if match:
            values[match.group(1)] = match.group(2)
    return values


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
    parser.add_argument("--backend-port", type=int)
    parser.add_argument("--frontend-port", type=int)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check-only", action="store_true")
    mode.add_argument("--runtime-check", action="store_true")
    parser.add_argument("--demo", action="store_true")
    args = parser.parse_args()
    provider = args.provider_root.resolve()
    registered_ports = load_registered_ports()
    frontend_port = args.frontend_port or registered_ports["frontend"]
    backend_port = args.backend_port or registered_ports["backend"]

    validate_registered_ports(frontend_port, backend_port, registered_ports)

    context = subprocess.run(
        ["docker", "context", "show"], text=True, capture_output=True, check=False
    ).stdout.strip()
    if context != "orbstack":
        raise SystemExit("local ECEEE development requires the orbstack Docker context")

    check_port("PostgreSQL", 10300)
    check_port("Redis", 10301)
    check_port("MinIO", 10302)

    if ENV_FILE.exists():
        if not ENV_FILE.is_file() or ENV_FILE.is_symlink():
            raise SystemExit(f"unsafe local env path: {ENV_FILE}")
        original = ENV_FILE.read_text(encoding="utf-8")
    elif TEMPLATE.is_file():
        original = TEMPLATE.read_text(encoding="utf-8")
    else:
        original = ""
    present = parse_dotenv_values(original)

    if args.runtime_check:
        if not ENV_FILE.exists() or ENV_FILE.stat().st_mode & 0o077:
            raise SystemExit("local .env is missing or is not mode 0600")
        required_keys = {
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_STORAGE_BUCKET_NAME",
            "DATABASE_URL",
            "IMGPROXY_KEY",
            "IMGPROXY_SALT",
            "POSTGRES_DB",
            "POSTGRES_PASSWORD",
            "POSTGRES_USER",
            "REDIS_URL",
        }
        missing_keys = sorted(key for key in required_keys if not present.get(key))
        if missing_keys:
            raise SystemExit(
                "local .env is missing required runtime variables: "
                + ", ".join(missing_keys)
            )
        expected_public_values = {
            "COMPOSE_PROJECT_NAME": ROOT.name.replace("_", "-"),
            "ECEEE_REDIS_NAMESPACE": checkout_redis_namespace(),
            "FRONTEND_PORT": str(frontend_port),
            "BACKEND_PORT": str(backend_port),
            "ECEEE_IMGPROXY_PORT": str(registered_ports["imgproxy"]),
            "ECEEE_PLAYWRIGHT_PORT": str(
                registered_ports["playwright-renderer"]
            ),
        }
        mismatched_keys = sorted(
            key
            for key, value in expected_public_values.items()
            if present.get(key) != value
        )
        if mismatched_keys:
            raise SystemExit(
                "local .env does not match this checkout's registered runtime for: "
                + ", ".join(mismatched_keys)
            )
        print("eceee-local-runtime=orbstack")
        print("eceee-shared-services=postgres,redis,minio:reachable")
        print("eceee-env=runtime-ready:mode-0600")
        return 0

    password_root = provider / "secrets" / "projects"
    redis_password = read_secret(password_root / "eceee-v4.redis.password")
    minio_secret = read_secret(password_root / "eceee-v4.minio.secret-key")

    if args.check_only and not all(
        present.get(key) for key in ("IMGPROXY_KEY", "IMGPROXY_SALT")
    ):
        raise SystemExit(
            "local .env needs imgproxy credentials; run make configure-local-infra"
        )

    checkout_database, checkout_user = checkout_postgres_identity()
    preserve_isolated_database = not args.demo and has_isolated_postgres_config(
        present
    )
    if preserve_isolated_database:
        postgres_database = checkout_database
        postgres_user = checkout_user
        postgres_password = present["POSTGRES_PASSWORD"]
    else:
        postgres_database = "eceee_demo" if args.demo else "eceee_v4"
        postgres_user = "local_eceee_demo" if args.demo else "local_eceee_v4"
        postgres_password = read_secret(
            password_root
            / ("eceee-v4-demo.password" if args.demo else "eceee-v4.password")
        )
    updates = {
        "COMPOSE_PROJECT_NAME": ROOT.name.replace("_", "-"),
        "FRONTEND_PORT": str(frontend_port),
        "BACKEND_PORT": str(backend_port),
        "ECEEE_IMGPROXY_PORT": str(registered_ports["imgproxy"]),
        "ECEEE_PLAYWRIGHT_PORT": str(registered_ports["playwright-renderer"]),
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
        "ECEEE_REDIS_NAMESPACE": checkout_redis_namespace(),
        "AWS_ACCESS_KEY_ID": "eceee-v4",
        "AWS_SECRET_ACCESS_KEY": minio_secret,
        "AWS_STORAGE_BUCKET_NAME": "eceee-media",
        "AWS_S3_ENDPOINT_URL": "http://localhost:10302",
        "AWS_S3_INTERNAL_ENDPOINT_URL": "http://host.docker.internal:10302",
        "IMGPROXY_KEY": present.get("IMGPROXY_KEY") or secrets.token_hex(32),
        "IMGPROXY_SALT": present.get("IMGPROXY_SALT") or secrets.token_hex(32),
    }

    if args.check_only:
        if not ENV_FILE.exists() or ENV_FILE.stat().st_mode & 0o077:
            raise SystemExit("local .env is missing or is not mode 0600")
        mismatched_keys = [
            key for key, value in updates.items() if present.get(key) != value
        ]
        if mismatched_keys:
            raise SystemExit(
                "local .env needs reconfiguration for: "
                + ", ".join(sorted(mismatched_keys))
                + "; run make configure-local-infra"
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
