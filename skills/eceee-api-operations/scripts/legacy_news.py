#!/usr/bin/env python3
"""Run the existing legacy News API importer against this checkout's dev backend."""

import argparse
import json
from pathlib import Path
import subprocess
import sys

from eceee_api import read_env_file, resolve_profile

REPO_ROOT = Path(__file__).resolve().parents[3]
CONTAINER = "eceee-v4-backend-1"
DOCKER = ["docker", "--context", "orbstack"]


def verify_mount():
    result = subprocess.run(
        DOCKER + ["inspect", CONTAINER, "--format", "{{json .Mounts}}"],
        capture_output=True, text=True, check=True,
    )
    mounts = json.loads(result.stdout)
    expected = str(REPO_ROOT / "backend")
    if not any(mount.get("Destination") == "/app" and mount.get("Source") == expected for mount in mounts):
        raise ValueError("backend=checkout_mismatch")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=("dev",), default="dev")
    parser.add_argument("--env-file", type=Path, default=REPO_ROOT / ".env.local")
    parser.add_argument("--tenant")
    parser.add_argument("--namespace")
    parser.add_argument("--limit", type=int, default=100)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Check only the local target; no legacy API request")
    mode.add_argument("--apply", action="store_true", help="Import after the existing golden-sample gate passes")
    args = parser.parse_args()
    if not 1 <= args.limit <= 500:
        parser.error("--limit must be between 1 and 500")
    if args.apply and not args.namespace:
        parser.error("--apply requires an explicit --namespace")
    try:
        values = read_env_file(args.env_file)
        _base, tenant, _key = resolve_profile(values, "dev", tenant=args.tenant)
        payload = {
            "mode": "check" if args.check else "apply" if args.apply else "dry-run",
            "tenant": tenant, "namespace": args.namespace, "limit": args.limit,
        }
        if not args.check:
            base = values.get("LEGACY_API_BASE_URL")
            token = values.get("LEGACY_API_ACCESS_KEY")
            if not base or not token:
                raise ValueError("legacy_configuration=missing")
            payload["api_config"] = {"base_url": base, "token": token}
        verify_mount()
        worker = Path(__file__).with_name("legacy_news_worker.py").read_text()
        result = subprocess.run(
            DOCKER + ["exec", "-i", CONTAINER, "python", "-c", worker],
            input=json.dumps(payload), capture_output=True, text=True,
        )
        # Parse only the worker's bounded result; never forward container logs or exceptions.
        if result.stdout.strip():
            try:
                output = json.loads(result.stdout)
            except ValueError:
                raise ValueError("legacy_import=invalid_worker_response") from None
            print(json.dumps(output))
        else:
            print("legacy_import=failed", file=sys.stderr)
        return 0 if result.returncode == 0 else 1
    except (ValueError, OSError, subprocess.SubprocessError):
        print("legacy_import=failed configuration_or_backend_check", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
