#!/usr/bin/env python3
"""Plan or stage production support configuration; never deploy or restart services."""

import argparse
import fcntl
import ipaddress
import json
import os
from pathlib import Path
import re
import shlex
import socket
import stat
import subprocess
import tempfile


DOMAINS = ("app.eceee.org", "admin.eceee.org", "imgproxy.eceee.org")
ROOT = Path(__file__).resolve().parent.parent.parent
PRODUCTION_LOCK = "/mnt/data/.eceee-production-operation.lock"


class SetupError(Exception):
    """A bounded operator message that contains no secret values."""


def production_host():
    addresses = [{entry[4][0] for entry in socket.getaddrinfo(domain, 22, socket.AF_INET)} for domain in DOMAINS]
    if any(len(items) != 1 for items in addresses) or any(items != addresses[0] for items in addresses):
        raise SetupError(
            "Production DNS records disagree or are ambiguous: "
            + "; ".join(domain + "=" + ",".join(sorted(items)) for domain, items in zip(DOMAINS, addresses))
        )
    address = next(iter(addresses[0]))
    if not ipaddress.ip_address(address).is_global:
        raise SetupError("Production DNS must resolve to a public IPv4 address.")
    return address


def settings_for(bucket):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}[a-z0-9]", bucket):
        raise SetupError("Support bucket must be a valid lowercase S3 bucket name.")
    return {
        "SUPPORT_STORAGE_BUCKET_NAME": bucket,
        "SUPPORT_APP_URL": "https://app.eceee.org",
        "SUPPORT_EMAIL_ENABLED": "False",
    }


def prepared_env(path, updates):
    """Read internally; preserve all unrelated lines without returning them to logs."""
    if path.is_symlink() or not path.is_file() or stat.S_IMODE(path.stat().st_mode) != 0o600:
        raise SetupError("Production environment must be a regular, non-symlink mode-0600 file.")
    original = path.read_text()
    existing_buckets = re.findall(r"^(?:export\s+)?SUPPORT_STORAGE_BUCKET_NAME\s*=([^\n]*)$", original, re.M)
    if any(
        value.strip().strip("\"'") not in {"", updates["SUPPORT_STORAGE_BUCKET_NAME"]} for value in existing_buckets
    ):
        raise SetupError("An existing different support bucket requires a separate data migration decision.")
    content = original
    for key, value in updates.items():
        pattern = re.compile(r"^(?:export\s+)?" + re.escape(key) + r"\s*=.*$", re.M)
        if len(pattern.findall(content)) > 1:
            raise SetupError("Duplicate support settings must be resolved before configuration.")
        if pattern.search(content):
            content = pattern.sub(key + "=" + value, content)
        else:
            content = content.rstrip("\n") + "\n" + key + "=" + value + "\n"
    return original, content


def support_credentials(content):
    credentials = {}
    for key in ("SUPPORT_STORAGE_ACCESS_KEY_ID", "SUPPORT_STORAGE_SECRET_ACCESS_KEY", "AWS_ACCESS_KEY_ID"):
        values = re.findall(r"^(?:export\s+)?" + key + r"\s*=([^\n]*)$", content, re.M)
        if len(values) != 1 or not values[0].strip().strip("\"'"):
            raise SetupError("Dedicated support credentials and the media identity must be configured exactly once.")
        credentials[key] = values[0].strip().strip("\"'")
    media_key = credentials.pop("AWS_ACCESS_KEY_ID")
    if credentials["SUPPORT_STORAGE_ACCESS_KEY_ID"] == media_key:
        raise SetupError("Support storage must not reuse the media/imgproxy identity.")
    return credentials


def write_private(path, content):
    fd, temporary = tempfile.mkstemp(prefix=".support-config-", dir=path.parent)
    try:
        with os.fdopen(fd, "w") as target:
            os.fchmod(target.fileno(), 0o600)
            target.write(content)
            target.flush()
            os.fsync(target.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def run_bounded(command, payload=None):
    result = subprocess.run(command, input=payload, capture_output=True, timeout=180)
    if result.returncode:
        raise SetupError("Production support step failed; command output suppressed to protect credentials.")


def stage_remote(directory, updates):
    os.chdir(directory)
    env = Path("deploy/.env").absolute()
    with open(PRODUCTION_LOCK, "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        original, content = prepared_env(env, updates)
        compose = ["docker", "compose", "-f", "deploy/docker-compose.prod.yml", "--env-file", str(env)]
        # Verify the staged identity, which may differ from the running process.
        # Credentials travel only through stdin, never command arguments or output.
        staged = dict(updates)
        staged["SUPPORT_EMAIL_ENABLED"] = False
        staged.update(support_credentials(original))
        payload = json.dumps(staged).encode()
        # Only public settings enter argv; the dedicated identity uses stdin.
        overrides = [item for key, value in updates.items() for item in ("-e", key + "=" + value)]
        check = (
            "import django,sys,json; django.setup(); "
            "from django.conf import settings; "
            "assert not settings.DEBUG; "
            "assert hasattr(settings,'SUPPORT_STORAGE_ACCESS_KEY_ID'); "
            "assert hasattr(settings,'SUPPORT_STORAGE_SECRET_ACCESS_KEY'); "
            "values=json.load(sys.stdin); "
            "[setattr(settings,key,value) for key,value in values.items()]; "
            "from urllib.parse import urlsplit; "
            "assert urlsplit(settings.AWS_S3_ENDPOINT_URL).scheme == 'https'; "
            "from tenant_support.management.commands.provision_support_storage import Command; "
            "from tenant_support.storage import bucket_name; bucket_name()"
        )
        run_bounded(compose + ["exec", "-T"] + overrides + ["backend", "python", "-c", check], payload)
        # Keep a protected recovery copy before creating a bucket or changing config.
        fd, backup = tempfile.mkstemp(prefix=".env.before-support-", dir=env.parent)
        with os.fdopen(fd, "w") as target:
            os.fchmod(target.fileno(), 0o600)
            target.write(original)
            target.flush()
            os.fsync(target.fileno())
        print("Protected previous environment saved in deploy/.env.before-support-*.", flush=True)
        provision = (
            "import django,sys,json; django.setup(); "
            "from django.conf import settings; "
            "values=json.load(sys.stdin); "
            "[setattr(settings,key,value) for key,value in values.items()]; "
            "from django.core.management import call_command; "
            "call_command('provision_support_storage')"
        )
        run_bounded(compose + ["exec", "-T"] + overrides + ["backend", "python", "-c", provision], payload)
        write_private(env, content)
        print("Private bucket verified; production environment staged. No services restarted.", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bucket", default=os.environ.get("SUPPORT_BUCKET", "w8c4m2-prod-support"))
    parser.add_argument("--directory", default="/srv/eceee_v4")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--remote", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    updates = settings_for(args.bucket)
    if args.remote:
        stage_remote(args.directory, updates)
        return
    host = production_host()
    print("Production SSH target: root@" + host, flush=True)
    for key, value in updates.items():
        print(key + "=" + value, flush=True)
    print(
        "Scope: lock, check running backend compatibility, back up remote deploy/.env, "
        "create/verify private bucket, patch only these three remote/local settings.",
        flush=True,
    )
    print(
        "No deployment, migration, service restart, object deletion, or email sending. "
        "Add ACTIVATE=yes for a same-image configuration reload; code/schema upgrades use tagged deployment.",
        flush=True,
    )
    if not args.apply:
        print(
            "Plan only; no SSH connection. After the explicit owner gate: "
            f"SUPPORT_EXPECTED_HOST={host} make prod-configure-support APPLY=yes",
            flush=True,
        )
        return
    if os.environ.get("SUPPORT_EXPECTED_HOST") != host:
        raise SetupError("SUPPORT_EXPECTED_HOST must match the public IP reported in the owner gate.")
    local_env = ROOT / "deploy" / ".env"
    ignored = subprocess.run(
        ["git", "-C", str(ROOT), "check-ignore", "-q", "deploy/.env"],
        capture_output=True,
    )
    if ignored.returncode:
        raise SetupError("Local deploy/.env must be Git-ignored.")
    original, content = prepared_env(local_env, updates)
    support_credentials(original)
    remote_command = shlex.join(
        [
            "python3",
            "-",
            "--remote",
            "--bucket",
            args.bucket,
            "--directory",
            args.directory,
        ]
    )
    result = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "root@" + host, remote_command],
        input=Path(__file__).read_bytes(),
        capture_output=True,
        timeout=240,
    )
    if result.returncode:
        raise SetupError(
            "Remote setup failed; output suppressed. No restart was attempted. "
            "A private empty bucket or protected environment backup may remain; "
            "request a fresh diagnostic gate before retrying."
        )
    if local_env.read_text() != original:
        raise SetupError(
            "Remote configuration staged, but local deploy/.env changed concurrently. "
            "Reconcile its support settings before the next deployment."
        )
    write_private(local_env, content)
    print("Remote and local production configuration staged; private storage verified.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except SetupError as exc:
        print(str(exc))
        raise SystemExit(1)
    except (OSError, ValueError, subprocess.SubprocessError):
        # Do not allow provider, process or filesystem exceptions to expose secrets.
        print(
            "Support configuration failed. Check DNS agreement, protected env files, "
            "running backend support compatibility and storage permissions. "
            "No restart or deployment was attempted; partial staging may remain."
        )
        raise SystemExit(1)
