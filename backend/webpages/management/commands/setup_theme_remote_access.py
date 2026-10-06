"""Create or rotate a scoped remote access key for one workspace."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import Tenant
from webpages.models import ThemeRemoteAccessKey
from webpages.models.theme_remote import SITE_TRANSFER_CAPABILITY, THEME_TRANSFER_CAPABILITY
from webpages.services.theme_remote_credentials import generate_access_key


class Command(BaseCommand):
    help = "Create or rotate a scoped remote access key and print the new key once"

    def add_arguments(self, parser):
        parser.add_argument("--workspace", required=True, help="Workspace identifier")
        parser.add_argument("--name", default="Designer theme sync", help="Access key name")
        parser.add_argument("--created-by", required=True, help="Username of the workspace administrator")
        parser.add_argument(
            "--capability",
            action="append",
            choices=(THEME_TRANSFER_CAPABILITY, SITE_TRANSFER_CAPABILITY),
            dest="capabilities",
            help="Allowed transfer capability. Repeat to grant both. Defaults to theme.transfer.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        try:
            tenant = Tenant.objects.get(identifier=options["workspace"])
        except Tenant.DoesNotExist as exc:
            raise CommandError("Workspace not found.") from exc
        try:
            user = get_user_model().objects.get(username=options["created_by"], is_active=True)
        except get_user_model().DoesNotExist as exc:
            raise CommandError("Active user not found.") from exc
        if not tenant.user_has_access(user):
            raise CommandError("The selected user is not a workspace administrator.")

        raw_key, key_hash, key_prefix = generate_access_key()
        capabilities = sorted(set(options["capabilities"] or [THEME_TRANSFER_CAPABILITY]))
        access_key, _ = ThemeRemoteAccessKey.objects.update_or_create(
            tenant=tenant,
            name=options["name"],
            defaults={
                "key_hash": key_hash,
                "key_prefix": key_prefix,
                "is_active": True,
                "created_by": user,
                "last_used_at": None,
                "capabilities": capabilities,
            },
        )
        self.stdout.write(f"Access key '{access_key.name}' created for workspace '{tenant.identifier}'.")
        self.stdout.write("Copy the next line now. It cannot be displayed again:")
        self.stdout.write(raw_key)
