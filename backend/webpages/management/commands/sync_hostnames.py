"""
Management command to sync and manage dynamic hostnames.
"""

from django.core.management.base import BaseCommand, CommandError
from django.core.cache import cache
from django.conf import settings
from webpages.models import WebPage
from webpages.middleware import (
    DynamicHostValidationMiddleware,
    get_dynamic_allowed_hosts,
)


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
            help="Add hostname to a root page (requires --page-id)",
        )
        parser.add_argument(
            "--remove-hostname",
            type=str,
            help="Remove hostname from a root page (requires --page-id)",
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
                self.add_hostname(options["add_hostname"], options.get("page_id"))
            elif options["remove_hostname"]:
                self.remove_hostname(options["remove_hostname"], options.get("page_id"))
            elif options["stats"]:
                self.show_stats()
            else:
                self.stdout.write(
                    self.style.WARNING("No action specified. Use --help for options.")
                )

        except Exception as e:
            raise CommandError(f"Error: {str(e)}")

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

    def add_hostname(self, hostname, page_id):
        """Add hostname to a root page."""
        if not page_id:
            raise CommandError("--page-id is required when adding hostname")

        try:
            page = WebPage.objects.get(id=page_id)
        except WebPage.DoesNotExist:
            raise CommandError(f"Page with ID {page_id} not found")

        if not page.is_root_page():
            raise CommandError("Only root pages can have hostnames")

        try:
            page.add_hostname(hostname)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully added hostname "{hostname}" to page "{page.title}"'
                )
            )
        except Exception as e:
            raise CommandError(f"Failed to add hostname: {str(e)}")

    def remove_hostname(self, hostname, page_id):
        """Remove hostname from a root page."""
        if not page_id:
            raise CommandError("--page-id is required when removing hostname")

        try:
            page = WebPage.objects.get(id=page_id)
        except WebPage.DoesNotExist:
            raise CommandError(f"Page with ID {page_id} not found")

        try:
            page.remove_hostname(hostname)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully removed hostname "{hostname}" from page "{page.title}"'
                )
            )
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
