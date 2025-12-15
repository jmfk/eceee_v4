"""
Management command to create a new tenant.
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from core.models import Tenant

User = get_user_model()


class Command(BaseCommand):
    """Create a new tenant."""

    help = "Create a new tenant for multi-tenancy"

    def add_arguments(self, parser):
        parser.add_argument(
            "--name",
            type=str,
            required=True,
            help="Human-readable name for the tenant",
        )
        parser.add_argument(
            "--identifier",
            type=str,
            required=True,
            help="URL-safe identifier for the tenant (used for theme-sync directory)",
        )
        parser.add_argument(
            "--created-by",
            type=str,
            help="Username of the user creating this tenant (defaults to first superuser)",
        )
        parser.add_argument(
            "--inactive",
            action="store_true",
            help="Create the tenant as inactive (default: active)",
        )

    def handle(self, *args, **options):
        name = options["name"]
        identifier = options["identifier"]
        created_by_username = options.get("created_by")
        is_active = not options["inactive"]

        # Get or default created_by user
        if created_by_username:
            try:
                created_by = User.objects.get(username=created_by_username)
            except User.DoesNotExist:
                raise CommandError(f"User '{created_by_username}' does not exist")
        else:
            created_by = User.objects.filter(is_superuser=True).first()
            if not created_by:
                created_by = User.objects.first()
            if not created_by:
                raise CommandError(
                    "No users found. Create a user first or specify --created-by"
                )

        # Check if tenant with this identifier already exists
        if Tenant.objects.filter(identifier=identifier).exists():
            raise CommandError(f"Tenant with identifier '{identifier}' already exists")

        # Create tenant
        tenant = Tenant.objects.create(
            name=name,
            identifier=identifier,
            is_active=is_active,
            created_by=created_by,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully created tenant '{name}' (identifier: {identifier}, ID: {tenant.id})"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Theme-sync directory: themes/{identifier}/"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Use TENANT_ID={identifier} in docker-compose.dev.yml"
            )
        )
