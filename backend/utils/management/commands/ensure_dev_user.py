"""
Management command to ensure development auto-login user exists.

This command creates or verifies the existence of the dev_auto_user
used by DevAutoLoginMiddleware for automatic authentication in development.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = "Ensure development auto-login user exists"

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-password",
            action="store_true",
            help="Reset password to default (dev123)",
        )

    def handle(self, *args, **options):
        reset_password = options.get("reset_password", False)

        user, created = User.objects.get_or_create(
            username="dev_auto_user",
            defaults={
                "email": "dev@localhost.local",
                "first_name": "Dev",
                "last_name": "User",
                "is_staff": True,
                "is_superuser": True,
            },
        )

        if created:
            user.set_password("dev123")
            user.save()
            self.stdout.write(
                self.style.SUCCESS(f"✓ Created dev user: {user.username}")
            )
            self.stdout.write(self.style.SUCCESS(f"  Email: {user.email}"))
            self.stdout.write(self.style.SUCCESS(f"  Password: dev123"))
        else:
            self.stdout.write(
                self.style.SUCCESS(f"✓ Dev user already exists: {user.username}")
            )

            if reset_password:
                user.set_password("dev123")
                user.save()
                self.stdout.write(self.style.SUCCESS(f"✓ Password reset to: dev123"))

        # Verify user has correct permissions
        if not user.is_staff or not user.is_superuser:
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(
                self.style.WARNING(f"⚠ Updated permissions for {user.username}")
            )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Dev auto-login is ready!"))
        self.stdout.write(
            "All requests will be automatically authenticated when DEBUG=True"
        )
