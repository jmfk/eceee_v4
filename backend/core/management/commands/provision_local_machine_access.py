"""Provision a redacted, tenant-bound machine credential for local development."""

import os
from pathlib import Path
import re
import stat
import tempfile
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.machine_api_keys import (
    CONTENT_READ,
    CONTENT_WRITE,
    LAYOUT_READ,
    MEDIA_READ,
    MEDIA_WRITE,
    OBJECT_PUBLISH,
    OBJECT_READ,
    OBJECT_TRANSFER,
    OBJECT_WRITE,
    PAGE_PUBLISH,
    PAGE_READ,
    PAGE_WRITE,
    SITE_READ,
    SITE_TRANSFER,
    SITE_WRITE,
    THEME_READ,
    THEME_TRANSFER,
    THEME_VERSION,
    THEME_WRITE,
    deployment_environment,
    generate_machine_api_key,
)
from core.models import MachineAPIKey, Tenant


DEFAULT_SCOPES = sorted(
    {
        CONTENT_READ,
        CONTENT_WRITE,
        LAYOUT_READ,
        MEDIA_READ,
        MEDIA_WRITE,
        OBJECT_PUBLISH,
        OBJECT_READ,
        OBJECT_TRANSFER,
        OBJECT_WRITE,
        PAGE_PUBLISH,
        PAGE_READ,
        PAGE_WRITE,
        SITE_READ,
        SITE_TRANSFER,
        SITE_WRITE,
        THEME_READ,
        THEME_TRANSFER,
        THEME_VERSION,
        THEME_WRITE,
    }
)


def install_secret(env_file: Path, variable: str, secret: str):
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", variable):
        raise CommandError("variable=invalid")
    env_file = env_file.resolve()
    if env_file.exists():
        mode = stat.S_IMODE(env_file.stat().st_mode)
        if mode & 0o077:
            raise CommandError("env_file=mode_unsafe")
        lines = env_file.read_text(encoding="utf-8").splitlines()
    else:
        env_file.parent.mkdir(parents=True, exist_ok=True)
        lines = []

    matches = []
    for index, line in enumerate(lines):
        name = line.partition("=")[0].strip()
        if name.startswith("export "):
            name = name[7:].strip()
        if name == variable:
            matches.append(index)
    if len(matches) > 1:
        raise CommandError("credential=duplicate_variables")
    replacement = f"{variable}={secret}"
    if matches:
        lines[matches[0]] = replacement
    else:
        lines.append(replacement)

    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=env_file.parent,
            prefix=f".{env_file.name}.",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            os.chmod(temporary_path, 0o600)
            temporary.write("\n".join(lines) + "\n")
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_path, env_file)
        os.chmod(env_file, 0o600)
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()


class Command(BaseCommand):
    help = "Provision or rotate a local Codex machine key and install it without printing the secret."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", default="default", help="Tenant identifier")
        parser.add_argument("--name", default="Codex local CMS access", help="Machine credential name")
        parser.add_argument("--username", default="codex-local", help="Dedicated machine principal username")
        parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
        parser.add_argument("--variable", default="ECEEE_API_KEY")
        parser.add_argument("--expires-days", type=int, default=30)

    @transaction.atomic
    def handle(self, *args, **options):
        environment = deployment_environment()
        if environment == "production":
            raise CommandError("environment=production_denied")
        if options["expires_days"] < 1:
            raise CommandError("expires_days=invalid")

        try:
            tenant = Tenant.objects.get(identifier=options["tenant"], is_active=True)
        except Tenant.DoesNotExist as exc:
            raise CommandError("tenant=missing_or_inactive") from exc

        user_model = get_user_model()
        principal, principal_created = user_model.objects.get_or_create(
            username=options["username"],
            defaults={"is_active": True, "is_staff": True},
        )
        if principal_created:
            principal.set_unusable_password()
            principal.save(update_fields=["password"])
        elif not principal.is_active or not principal.is_staff:
            raise CommandError("principal=existing_account_incompatible")
        tenant.members.add(principal)

        raw_key, key_hash, key_prefix = generate_machine_api_key()
        expires_at = timezone.now() + timedelta(days=options["expires_days"])
        api_key = (
            MachineAPIKey.objects.select_for_update()
            .filter(
                environment=environment,
                name=options["name"],
            )
            .first()
        )
        outcome = "rotated" if api_key else "created"
        if api_key:
            if api_key.principal_id != principal.pk:
                raise CommandError("credential=principal_mismatch")
            api_key.key_hash = key_hash
            api_key.key_prefix = key_prefix
            api_key.scopes = DEFAULT_SCOPES
            api_key.expires_at = expires_at
            api_key.is_active = True
            api_key.last_used_at = None
            api_key.save(update_fields=["key_hash", "key_prefix", "scopes", "expires_at", "is_active", "last_used_at"])
        else:
            api_key = MachineAPIKey.objects.create(
                name=options["name"],
                principal=principal,
                environment=environment,
                scopes=DEFAULT_SCOPES,
                key_hash=key_hash,
                key_prefix=key_prefix,
                expires_at=expires_at,
                created_by=principal,
            )
        api_key.tenants.set([tenant])

        install_secret(options["env_file"], options["variable"], raw_key)
        self.stdout.write(
            f"machine_access={outcome} credential=installed scopes={len(DEFAULT_SCOPES)} "
            f"expires={expires_at.date().isoformat()}"
        )
