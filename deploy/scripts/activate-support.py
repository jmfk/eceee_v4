#!/usr/bin/env python3
"""Reload production support settings using exactly the currently running images."""

import argparse
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time


SERVICES = ("backend", "celery-worker", "celery-beat")
DIRECTORY = "/srv/eceee_v4"


def checked(command, **kwargs):
    result = subprocess.run(command, capture_output=True, timeout=180, **kwargs)
    if result.returncode:
        raise RuntimeError("command_failed")
    return result.stdout


VERIFY = r"""
import django,json
django.setup()
from django.conf import settings
from tenant_support import storage
assert not settings.DEBUG
assert settings.SUPPORT_STORAGE_BUCKET_NAME=='w8c4m2-prod-support'
assert settings.SUPPORT_APP_URL=='https://app.eceee.org'
assert settings.SUPPORT_EMAIL_ENABLED is False
assert settings.SUPPORT_STORAGE_ACCESS_KEY_ID and settings.SUPPORT_STORAGE_SECRET_ACCESS_KEY
assert settings.SUPPORT_STORAGE_ACCESS_KEY_ID != settings.AWS_ACCESS_KEY_ID
storage.client().head_bucket(Bucket=settings.SUPPORT_STORAGE_BUCKET_NAME)
storage.assert_private(storage.client())
from config.celery import app
assert any(s.get('task')=='tenant_support.tasks.deliver_pending' for s in app.conf.beat_schedule.values())
print('SUPPORT_RUNTIME_PASS',flush=True)
"""


def activate():
    os.chdir(DIRECTORY)
    with open("/mnt/data/.eceee-production-operation.lock", "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        compose = ["docker", "compose", "-f", "deploy/docker-compose.prod.yml", "--env-file", "deploy/.env"]
        overrides = {"services": {}}
        baseline = {}
        for service in SERVICES:
            container = checked(compose + ["ps", "-q", service]).decode().strip()
            if not container or "\n" in container:
                raise RuntimeError("expected_one_running_container_per_service")
            info = json.loads(checked(["docker", "inspect", container]))[0]
            if not info["State"]["Running"]:
                raise RuntimeError("service_not_running")
            image = info["Image"]
            baseline[service] = image
            overrides["services"][service] = {"image": image}
            # Preserve the release display metadata while changing configuration.
            for item in info["Config"].get("Env", []):
                if item.startswith("APP_VERSION="):
                    overrides["services"][service]["environment"] = {"APP_VERSION": item.split("=", 1)[1]}
        assert len(set(baseline.values())) == 1, "application_images_must_match"
        # Ensure the deployed database is already up to date. Never migrate here.
        checked(compose + ["exec", "-T", "backend", "python", "manage.py", "migrate", "--check"])
        fd, path = tempfile.mkstemp(prefix=".support-images-", suffix=".json", dir="deploy")
        try:
            with os.fdopen(fd, "w") as target:
                os.fchmod(target.fileno(), 0o600)
                json.dump(overrides, target)
            pinned = compose + ["-f", path]
            # Check the staged env_file with the pinned image before changing
            # running services. In particular, fail before a worker can send mail.
            output = checked(
                pinned + ["run", "--rm", "--no-deps", "--pull", "never", "backend", "python", "-c", VERIFY]
            )
            if b"SUPPORT_RUNTIME_PASS" not in output:
                raise RuntimeError("staged_support_configuration_invalid")
            print(
                "Schema current; staged configuration verified; existing images pinned. Reloading backend, worker, and scheduler only.",
                flush=True,
            )
            # Worker/Beat intentionally disable image HTTP healthchecks. Verify
            # their state independently instead of Compose's shared --wait gate.
            checked(pinned + ["up", "-d", "--no-deps", "--no-build", "--pull", "never", "--force-recreate", *SERVICES])
            print("Support activation: services started; checking runtime readiness.", flush=True)
            deadline = time.monotonic() + 120
            for service in SERVICES:
                while True:
                    container = checked(pinned + ["ps", "-q", service]).decode().strip()
                    info = json.loads(checked(["docker", "inspect", container]))[0]
                    assert info["Image"] == baseline[service] and info["State"]["Running"]
                    if service != "backend" or info["State"].get("Health", {}).get("Status") == "healthy":
                        break
                    if time.monotonic() >= deadline:
                        raise RuntimeError("backend_health_timeout")
                    time.sleep(2)
                output = checked(pinned + ["exec", "-T", service, "python", "-c", VERIFY])
                assert b"SUPPORT_RUNTIME_PASS" in output
            print(
                "Support activation: runtime settings, storage and schedules verified in all three services.",
                flush=True,
            )
            worker = checked(pinned + ["ps", "-q", "celery-worker"]).decode().strip()
            hostname = json.loads(checked(["docker", "inspect", worker]))[0]["Config"]["Hostname"]
            # Compose checks that workers are running; the broker connection may
            # need a few more seconds before targeted control requests can reply.
            for attempt in range(3):
                try:
                    checked(
                        pinned
                        + [
                            "exec",
                            "-T",
                            "celery-worker",
                            "celery",
                            "-A",
                            "config.celery",
                            "inspect",
                            "ping",
                            "-d",
                            "celery@" + hostname,
                            "--timeout",
                            "5",
                        ]
                    )
                    break
                except RuntimeError:
                    if attempt == 2:
                        raise
                    time.sleep(2)
            print(
                "Support runtime and private storage verified; worker responded; scheduler running; email disabled.",
                flush=True,
            )
        finally:
            os.unlink(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--remote", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.remote:
        activate()
        return
    spec = importlib.util.spec_from_file_location("support_config", Path(__file__).with_name("configure-support.py"))
    support_config = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(support_config)
    host = support_config.production_host()
    if (
        os.environ.get("PROD_DIR", DIRECTORY) != DIRECTORY
        or os.environ.get("SUPPORT_BUCKET", "w8c4m2-prod-support") != "w8c4m2-prod-support"
    ):
        raise RuntimeError("activation_requires_canonical_production_checkout_and_bucket")
    print("Production target: root@" + host, flush=True)
    print(
        "Scope: verify schema, pin existing images, reload backend/worker/scheduler, verify support. "
        "No image builds, migrations, frontend restarts, or email enablement.",
        flush=True,
    )
    if not args.apply:
        print("Plan only; no SSH connection.")
        return
    if os.environ.get("SUPPORT_EXPECTED_HOST") != host:
        raise RuntimeError("expected_host_mismatch")
    result = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "root@" + host, "python3 - --remote"],
        input=Path(__file__).read_bytes(),
        capture_output=True,
        timeout=300,
    )
    for line in result.stdout.decode(errors="replace").splitlines():
        if line.startswith(
            ("Schema current;", "Support activation:", "Support runtime and", "Support activation failed")
        ):
            print(line, flush=True)
    if result.returncode:
        raise RuntimeError("remote_activation_failed")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(
            "Support activation failed (" + type(exc).__name__ + "). Details suppressed; "
            "no automatic rollback or database mutation was attempted."
        )
        raise SystemExit(1)
