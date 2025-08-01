"""
Management command to sync and manage dynamic hostnames.

Security Features:
- Authentication required for hostname modification operations
- Requires --unsafe flag for dangerous operations without confirmation
- Comprehensive logging of all hostname modifications
"""

import getpass
import sys
from django.core.management.base import BaseCommand, CommandError
from django.core.cache import cache
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from webpages.models import WebPage
from webpages.middleware import (
    DynamicHostValidationMiddleware,
    get_dynamic_allowed_hosts,
)

User = get_user_model()


class Command(BaseCommand):
    help = "Sync and manage dynamic hostnames for ALLOWED_HOSTS validation"

    def add_arguments(self, parser):
        parser.add_argument(
            "--list",
            action="store_true",
            help="List all hostnames (static + database)",
        )
        parser.add_argument(
            "--list-db",
            action="store_true",
            help="List only database hostnames",
        )
        parser.add_argument(
            "--list-static",
            action="store_true",
            help="List only static ALLOWED_HOSTS",
        )
        parser.add_argument(
            "--clear-cache",
            action="store_true",
            help="Clear the hostname cache",
        )
        parser.add_argument(
            "--validate",
            type=str,
            help="Validate if a specific hostname is allowed",
        )
        parser.add_argument(
            "--add-hostname",
            type=str,
            help="Add hostname to a root page (requires --page-id and authentication)",
        )
        parser.add_argument(
            "--remove-hostname",
            type=str,
            help="Remove hostname from a root page (requires --page-id and authentication)",
        )
        parser.add_argument(
            "--page-id",
            type=int,
            help="Page ID for hostname operations",
        )
        parser.add_argument(
            "--stats",
            action="store_true",
            help="Show hostname statistics",
        )
        parser.add_argument(
            "--username",
            type=str,
            help="Username for authentication (required for add/remove operations)",
        )
        parser.add_argument(
            "--unsafe",
            action="store_true",
            help="Skip interactive confirmation prompts (USE WITH CAUTION)",
        )

    def handle(self, *args, **options):
        try:
            if options["list"]:
                self.list_all_hostnames()
            elif options["list_db"]:
                self.list_database_hostnames()
            elif options["list_static"]:
                self.list_static_hostnames()
            elif options["clear_cache"]:
                self.clear_cache()
            elif options["validate"]:
                self.validate_hostname(options["validate"])
            elif options["add_hostname"]:
                # Require authentication for hostname modification
                user = self.authenticate_user(options.get("username"))
                self.add_hostname(options["add_hostname"], options.get("page_id"), user, options.get("unsafe", False))
            elif options["remove_hostname"]:
                # Require authentication for hostname modification
                user = self.authenticate_user(options.get("username"))
                self.remove_hostname(options["remove_hostname"], options.get("page_id"), user, options.get("unsafe", False))
            elif options["stats"]:
                self.show_stats()
            else:
                self.stdout.write(
                    self.style.WARNING("No action specified. Use --help for options.")
                )

        except Exception as e:
            raise CommandError(f"Error: {str(e)}")

    def authenticate_user(self, username):
        """Authenticate user for sensitive operations."""
        if not username:
            raise CommandError(
                "Username required for hostname modification operations. Use --username <username>"
            )

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise CommandError(f"User '{username}' not found")

        if not user.is_staff:
            raise CommandError(
                f"User '{username}' must be staff to perform hostname operations"
            )

        # Prompt for password
        password = getpass.getpass(f"Password for {username}: ")
        
        if not check_password(password, user.password):
            raise CommandError("Authentication failed: Invalid password")

        self.stdout.write(
            self.style.SUCCESS(f"✓ Authenticated as {username}")
        )
        return user

    def confirm_action(self, message, unsafe=False):
        """Confirm potentially dangerous actions."""
        if unsafe:
            return True
            
        self.stdout.write(self.style.WARNING(f"⚠ {message}"))
        response = input("Are you sure? (yes/no): ").lower().strip()
        
        if response not in ['yes', 'y']:
            self.stdout.write(self.style.ERROR("Operation cancelled"))
            return False
            
        return True

    def list_all_hostnames(self):
        """List all hostnames (static + database)."""
        self.stdout.write(self.style.SUCCESS("All Allowed Hostnames:"))

        all_hosts = get_dynamic_allowed_hosts()
        static_hosts = list(settings.ALLOWED_HOSTS)
        db_hosts = WebPage.get_all_hostnames()

        for host in all_hosts:
            source = []
            if host in static_hosts:
                source.append("static")
            if host in db_hosts:
                source.append("database")

            self.stdout.write(f'  {host} ({", ".join(source)})')

        self.stdout.write(f"\nTotal: {len(all_hosts)} hostnames")

    def list_database_hostnames(self):
        """List database hostnames only."""
        self.stdout.write(self.style.SUCCESS("Database Hostnames:"))

        db_hosts = WebPage.get_all_hostnames()

        if not db_hosts:
            self.stdout.write("  (No database hostnames found)")
            return

        # Group by pages
        pages_with_hostnames = WebPage.objects.filter(
            parent__isnull=True, hostnames__isnull=False
        ).exclude(hostnames=[])

        for page in pages_with_hostnames:
            self.stdout.write(f"\n  Page: {page.title} (ID: {page.id})")
            for hostname in page.hostnames:
                self.stdout.write(f"    - {hostname}")

        self.stdout.write(
            f"\nTotal: {len(db_hosts)} hostnames from {pages_with_hostnames.count()} pages"
        )

    def list_static_hostnames(self):
        """List static ALLOWED_HOSTS only."""
        self.stdout.write(self.style.SUCCESS("Static ALLOWED_HOSTS:"))

        static_hosts = list(settings.ALLOWED_HOSTS)

        if not static_hosts:
            self.stdout.write("  (No static hosts configured)")
            return

        for host in static_hosts:
            self.stdout.write(f"  {host}")

        self.stdout.write(f"\nTotal: {len(static_hosts)} static hostnames")

    def clear_cache(self):
        """Clear the hostname cache."""
        DynamicHostValidationMiddleware.clear_hostname_cache()
        self.stdout.write(self.style.SUCCESS("Hostname cache cleared successfully."))

    def validate_hostname(self, hostname):
        """Validate if a hostname is allowed."""
        self.stdout.write(f"Validating hostname: {hostname}")

        # Check static hosts
        from django.http.request import validate_host

        static_allowed = validate_host(hostname, settings.ALLOWED_HOSTS)

        # Check database hosts
        normalized = WebPage.normalize_hostname(hostname)
        db_hosts = WebPage.get_all_hostnames()
        db_allowed = normalized in db_hosts or "*" in db_hosts

        # Overall result
        allowed = static_allowed or db_allowed

        self.stdout.write(f"  Normalized: {normalized}")
        self.stdout.write(f'  Static ALLOWED_HOSTS: {"✓" if static_allowed else "✗"}')
        self.stdout.write(f'  Database hostnames: {"✓" if db_allowed else "✗"}')

        if allowed:
            self.stdout.write(self.style.SUCCESS(f'✓ Hostname "{hostname}" is ALLOWED'))
        else:
            self.stdout.write(
                self.style.ERROR(f'✗ Hostname "{hostname}" is NOT ALLOWED')
            )

    def add_hostname(self, hostname, page_id, user, unsafe=False):
        """Add hostname to a root page with authentication and confirmation."""
        if not page_id:
            raise CommandError("--page-id is required when adding hostname")

        try:
            page = WebPage.objects.get(id=page_id)
        except WebPage.DoesNotExist:
            raise CommandError(f"Page with ID {page_id} not found")

        if not page.is_root_page():
            raise CommandError("Only root pages can have hostnames")

        # Confirm the action
        if not self.confirm_action(
            f'This will add hostname "{hostname}" to page "{page.title}" (ID: {page_id}). '
            f'This affects site security and access control.',
            unsafe
        ):
            return

        try:
            page.add_hostname(hostname)
            # Log the action
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Successfully added hostname "{hostname}" to page "{page.title}"'
                )
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'  Action performed by: {user.username} ({user.email})'
                )
            )
            
            # Clear cache to ensure immediate effect
            DynamicHostValidationMiddleware.clear_hostname_cache()
            self.stdout.write(self.style.SUCCESS("  Hostname cache cleared"))
            
        except Exception as e:
            raise CommandError(f"Failed to add hostname: {str(e)}")

    def remove_hostname(self, hostname, page_id, user, unsafe=False):
        """Remove hostname from a root page with authentication and confirmation."""
        if not page_id:
            raise CommandError("--page-id is required when removing hostname")

        try:
            page = WebPage.objects.get(id=page_id)
        except WebPage.DoesNotExist:
            raise CommandError(f"Page with ID {page_id} not found")

        # Verify hostname exists on this page
        if hostname not in (page.hostnames or []):
            raise CommandError(f'Hostname "{hostname}" not found on page "{page.title}"')

        # Confirm the action
        if not self.confirm_action(
            f'This will remove hostname "{hostname}" from page "{page.title}" (ID: {page_id}). '
            f'This may make the site inaccessible via this hostname.',
            unsafe
        ):
            return

        try:
            page.remove_hostname(hostname)
            # Log the action
            self.stdout.write(
                self.style.SUCCESS(
                    f'✓ Successfully removed hostname "{hostname}" from page "{page.title}"'
                )
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f'  Action performed by: {user.username} ({user.email})'
                )
            )
            
            # Clear cache to ensure immediate effect
            DynamicHostValidationMiddleware.clear_hostname_cache()
            self.stdout.write(self.style.SUCCESS("  Hostname cache cleared"))
            
        except Exception as e:
            raise CommandError(f"Failed to remove hostname: {str(e)}")

    def show_stats(self):
        """Show hostname statistics."""
        self.stdout.write(self.style.SUCCESS("Hostname Statistics:"))

        static_hosts = list(settings.ALLOWED_HOSTS)
        db_hosts = WebPage.get_all_hostnames()
        all_hosts = get_dynamic_allowed_hosts()

        # Pages with hostnames
        pages_with_hostnames = WebPage.objects.filter(
            parent__isnull=True, hostnames__isnull=False
        ).exclude(hostnames=[])

        # Cache status
        cache_key = DynamicHostValidationMiddleware.CACHE_KEY
        cache_data = cache.get(cache_key)
        cache_status = "HIT" if cache_data is not None else "MISS"

        self.stdout.write(f"  Static hostnames: {len(static_hosts)}")
        self.stdout.write(f"  Database hostnames: {len(db_hosts)}")
        self.stdout.write(f"  Total unique hostnames: {len(all_hosts)}")
        self.stdout.write(
            f"  Root pages with hostnames: {pages_with_hostnames.count()}"
        )
        self.stdout.write(f"  Cache status: {cache_status}")
        self.stdout.write(
            f"  Cache timeout: {DynamicHostValidationMiddleware.CACHE_TIMEOUT} seconds"
        )

        # Check for wildcards
        if "*" in db_hosts:
            self.stdout.write(
                self.style.WARNING(
                    "  ⚠ Wildcard hostname (*) found - allows all hosts!"
                )
            )

        if "default" in db_hosts:
            self.stdout.write("  Default fallback hostname configured")
