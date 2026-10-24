#!/usr/bin/env python3
"""Provision a dedicated support-only login without sending mail or bypassing email verification."""

import argparse
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import secrets
import shlex
import stat
import subprocess


DIRECTORY = "/srv/eceee_v4"
PRODUCTION_LOCK = "/mnt/data/.eceee-production-operation.lock"
PREFLIGHT_CODE = r"""
import django
django.setup()
from core.models import TenantRole
from core.roles import permissions_for
from django.contrib.auth import get_user_model
from allauth.account.models import EmailAddress
from django.db import connection
assert hasattr(get_user_model(),'cms_roles')
assert TenantRole._meta.db_table in connection.introspection.table_names()
assert EmailAddress._meta.db_table in connection.introspection.table_names()
print('SUPPORT_RECIPIENT_PREFLIGHT_PASS',flush=True)
"""
ACCOUNT_CODE = r"""
import django,json,sys
django.setup()
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Q
from core.models import Tenant,TenantRole
from core.roles import permissions_for
from tenant_support.access import has_role,support_users
from tenant_support.services import sync_support_inbox
from allauth.account.models import EmailAddress
payload=json.load(sys.stdin)
email=payload['SUPPORT_LOGIN_EMAIL']
password=payload['SUPPORT_BOOTSTRAP_PASSWORD']
validate_email(email)
assert not settings.DEBUG and settings.SUPPORT_EMAIL_ENABLED is False
with transaction.atomic():
    tenants=list(Tenant.objects.select_for_update().filter(is_active=True))
    assert len(tenants)==1, 'workspace_selection_required'
    tenant=tenants[0]
    User=get_user_model()
    matches=list(User.objects.select_for_update().filter(Q(email__iexact=email)|Q(username__iexact=email)))
    if matches:
        # Reuse only this helper's own bootstrap identity; never reset another login.
        assert len(matches)==1
        user=matches[0]
        assert user.email.lower()==email.lower() and user.is_active
        assert not user.is_staff and not user.is_superuser and user.check_password(password)
    else:
        user=User.objects.create_user(username=email,email=email,password=password,
                                      first_name='Support',is_active=True,is_staff=False,is_superuser=False)
    was_support=has_role(user,tenant,'can_support')
    role,_=TenantRole.objects.get_or_create(tenant=tenant,name='Support inbox only',
                                          defaults={'permissions':['support.read']})
    assert set(role.permissions)=={'support.read'}, 'existing_role_requires_review'
    # Explicit support-only permissions prevent implicit CMS member defaults.
    assert not user.cms_roles.exclude(pk=role.pk).exists(), 'existing_roles_require_review'
    tenant.members.add(user)
    role.users.add(user)
    EmailAddress.objects.get_or_create(user=user,email=email,defaults={'primary':True,'verified':False})
    if not was_support: sync_support_inbox(tenant,user)
    assert permissions_for(user,tenant)=={'support.read'}
    assert has_role(user,tenant,'can_support') and not has_role(user,tenant,'can_publish')
    assert any(member.pk==user.pk for member in support_users(tenant))
print('SUPPORT_RECIPIENT_READY',flush=True)
"""


def provision_remote(email):
    os.chdir(DIRECTORY)
    with open(PRODUCTION_LOCK, "a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        compose = ["docker", "compose", "-f", "deploy/docker-compose.prod.yml", "--env-file", "deploy/.env"]
        preflight = subprocess.run(
            compose + ["exec", "-T", "backend", "python", "-c", PREFLIGHT_CODE], capture_output=True, timeout=60
        )
        if preflight.returncode or b"SUPPORT_RECIPIENT_PREFLIGHT_PASS" not in preflight.stdout:
            print(
                "Support-only account requires deployed workspace role controls; no account changes attempted.",
                flush=True,
            )
            raise RuntimeError("workspace_role_controls_not_deployed")
        path = Path("deploy/.env.support-account")
        if path.exists() or path.is_symlink():
            if path.is_symlink() or not path.is_file() or stat.S_IMODE(path.stat().st_mode) != 0o600:
                raise RuntimeError("unsafe_bootstrap_file")
            payload = dict(line.split("=", 1) for line in path.read_text().splitlines() if "=" in line)
            assert payload.get("SUPPORT_LOGIN_EMAIL") == email
        else:
            payload = {"SUPPORT_LOGIN_EMAIL": email, "SUPPORT_BOOTSTRAP_PASSWORD": secrets.token_urlsafe(32)}
            fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w") as target:
                target.write("".join(key + "=" + value + "\n" for key, value in payload.items()))
                target.flush()
                os.fsync(target.fileno())
        result = subprocess.run(
            compose + ["exec", "-T", "backend", "python", "-c", ACCOUNT_CODE],
            input=json.dumps(payload).encode(),
            capture_output=True,
            timeout=120,
        )
        if result.returncode or b"SUPPORT_RECIPIENT_READY" not in result.stdout:
            raise RuntimeError("account_provisioning_failed")
        print(
            "Support-only account provisioned and routing verified. Email verification preserved; no mail sent.",
            flush=True,
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--remote", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    # This bootstrap format deliberately accepts only conventional email addresses.
    import re

    if not re.fullmatch(r"[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", args.email):
        raise RuntimeError("invalid_email")
    if args.remote:
        provision_remote(args.email)
        return
    root = Path(__file__).resolve().parent.parent.parent
    spec = importlib.util.spec_from_file_location("support_config", Path(__file__).with_name("configure-support.py"))
    config = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(config)
    host = config.production_host()
    print("Production target: root@" + host, flush=True)
    print("Recipient: " + args.email, flush=True)
    print(
        "Scope: create a non-staff/non-admin account, join the sole active workspace, grant support.read only, "
        "sync existing support inbox entries, retain unverified email status, save protected bootstrap credentials. "
        "No mail, service restart, deletion, or existing account password reset.",
        flush=True,
    )
    if not args.apply:
        print("Plan only; no SSH connection.")
        return
    if os.environ.get("SUPPORT_EXPECTED_HOST") != host:
        raise RuntimeError("expected_host_mismatch")
    local = root / "deploy/.env.support-account"
    ignored = subprocess.run(["git", "-C", str(root), "check-ignore", "-q", str(local)], capture_output=True)
    assert ignored.returncode == 0
    if local.exists() or local.is_symlink():
        assert not local.is_symlink() and local.is_file() and stat.S_IMODE(local.stat().st_mode) == 0o600
    else:
        fd = os.open(local, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
    command = shlex.join(["python3", "-", "--remote", "--email", args.email])
    result = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "root@" + host, command],
        input=Path(__file__).read_bytes(),
        capture_output=True,
        timeout=150,
    )
    for line in result.stdout.decode(errors="replace").splitlines():
        if line.startswith("Support-only account requires deployed workspace role controls;"):
            print(line, flush=True)
    if result.returncode:
        raise RuntimeError("remote_provisioning_failed")
    result = subprocess.run(
        ["scp", "-q", "-o", "BatchMode=yes", "root@" + host + ":/srv/eceee_v4/deploy/.env.support-account", str(local)],
        capture_output=True,
        timeout=60,
    )
    if result.returncode:
        raise RuntimeError("protected_bootstrap_sync_failed")
    assert stat.S_IMODE(local.stat().st_mode) == 0o600
    print(
        "Support-only account and routing verified; protected bootstrap credentials synchronized locally. No mail sent."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(
            "Support recipient provisioning failed (" + type(exc).__name__ + "). Sensitive details suppressed. "
            "Database changes are atomic; a protected bootstrap file may remain. No mail sent."
        )
        raise SystemExit(1)
