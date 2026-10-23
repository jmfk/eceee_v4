"""Create an explicitly scoped diagnostic identity without returning credential material."""

import subprocess
from datetime import timedelta
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.machine_api_keys import (
    DIAGNOSTICS_DATA_READ,
    DIAGNOSTICS_GLOBAL_READ,
    DIAGNOSTICS_LOGS_READ,
    deployment_environment,
    generate_machine_api_key,
)
from core.management.commands.provision_local_machine_access import install_secret
from core.models import MachineAPIKey, Tenant


class Command(BaseCommand):
    help = "Create diagnostic machine access in an ignored 0600 env file; --rotate is required to replace a key"

    def add_arguments(self, parser):
        parser.add_argument("--tenant", action="append", required=True, help="Active tenant UUID (repeatable)")
        parser.add_argument("--logs", action="store_true")
        parser.add_argument("--data", action="store_true")
        parser.add_argument("--global-access", action="store_true")
        parser.add_argument("--env-file", type=Path, required=True)
        parser.add_argument("--expires-days", type=int, default=7)
        parser.add_argument("--rotate", action="store_true")
        parser.add_argument(
            "--production", action="store_true", help="Production only after the fresh repository owner gate"
        )

    @transaction.atomic
    def handle(self, *args, **options):
        environment = deployment_environment()
        if (environment == "production") != options["production"]:
            raise CommandError("environment=flag_mismatch")
        if not 1 <= options["expires_days"] <= 30 or not (options["logs"] or options["data"]):
            raise CommandError("Select logs/data and expiry of 1-30 days.")
        path = options["env_file"].absolute()
        if path.is_symlink():
            raise CommandError("env_file=symlink_denied")
        repository = next((parent for parent in path.parents if (parent / ".git").exists()), None)
        if repository is not None:
            result = subprocess.run(["git", "check-ignore", "-q", "--", str(path)], cwd=repository, capture_output=True)
            if result.returncode:
                raise CommandError("env_file=not_git_ignored")
        elif path.name != ".env.local":
            raise CommandError("env_file=runtime_requires_dotenv_local")
        try:
            tenants = list(Tenant.objects.filter(pk__in=options["tenant"], is_active=True))
        except (ValueError, ValidationError):
            # Do not reflect a malformed caller-supplied identifier through an ORM exception.
            raise CommandError("tenant=invalid") from None
        if len(tenants) != len(set(options["tenant"])):
            raise CommandError("tenant=missing_or_inactive")
        principal, created = get_user_model().objects.get_or_create(
            username=f"diagnostics-{environment}", defaults={"is_staff": False}
        )
        if created:
            principal.set_unusable_password()
            principal.save(update_fields=["password"])
        if (
            principal.has_usable_password()
            or principal.is_staff
            or principal.is_superuser
            or not principal.is_active
            or principal.groups.exists()
            or principal.user_permissions.exists()
        ):
            raise CommandError("principal=incompatible")
        name = "Dedicated diagnostic access"
        key = MachineAPIKey.objects.filter(name=name, environment=environment).first()
        if key and (not options["rotate"] or key.principal_id != principal.pk):
            raise CommandError("credential=exists_rotation_required")
        scopes = []
        if options["logs"]:
            scopes.append(DIAGNOSTICS_LOGS_READ)
        if options["data"]:
            scopes.append(DIAGNOSTICS_DATA_READ)
        if options["global_access"]:
            scopes.append(DIAGNOSTICS_GLOBAL_READ)
        secret, digest, prefix = generate_machine_api_key()
        key, _ = MachineAPIKey.objects.update_or_create(
            name=name,
            environment=environment,
            defaults={
                "principal": principal,
                "created_by": principal,
                "key_hash": digest,
                "key_prefix": prefix,
                "scopes": scopes,
                "expires_at": timezone.now() + timedelta(days=options["expires_days"]),
                "is_active": True,
                "last_used_at": None,
            },
        )
        key.tenants.set(tenants)
        variable = "ECEEE_DIAGNOSTICS_PROD_API_KEY" if environment == "production" else "ECEEE_DIAGNOSTICS_DEV_API_KEY"
        install_secret(path, variable, secret)
        self.stdout.write("diagnostics_access=installed")
