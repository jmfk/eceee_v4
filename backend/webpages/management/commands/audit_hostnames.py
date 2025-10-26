"""
Management command to audit and diagnose hostname configurations.

This command helps identify:
- Which hostnames are currently recognized by the middleware
- Pages with invalid hostname configurations (non-root pages with hostnames)
- Root pages with hostnames
- How to fix configuration issues

Usage:
    python manage.py audit_hostnames
    python manage.py audit_hostnames --show-invalid-only
    python manage.py audit_hostnames --verbose
"""

from django.core.management.base import BaseCommand
from django.conf import settings
from webpages.models import WebPage
from webpages.middleware import DynamicHostValidationMiddleware


class Command(BaseCommand):
    help = "Audit hostname configurations and identify issues"

    def add_arguments(self, parser):
        parser.add_argument(
            "--show-invalid-only",
            action="store_true",
            help="Only show pages with invalid hostname configurations",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Show detailed information about each page",
        )

    def handle(self, *args, **options):
        show_invalid_only = options["show_invalid_only"]
        verbose = options["verbose"]

        self.stdout.write(self.style.SUCCESS("=== Hostname Configuration Audit ===\n"))

        # 1. Show currently active hostnames (what middleware will recognize)
        self._show_active_hostnames()

        # 2. Show static allowed hosts
        self._show_static_hosts()

        # 3. Audit all pages with hostnames
        self._audit_pages_with_hostnames(show_invalid_only, verbose)

        # 4. Show summary and recommendations
        self._show_recommendations()

    def _show_active_hostnames(self):
        """Show hostnames that are currently recognized by the middleware."""
        self.stdout.write(
            self.style.HTTP_INFO("\n1. Currently Active Database Hostnames:")
        )
        self.stdout.write("   (These are the hostnames the middleware will accept)\n")

        try:
            active_hostnames = WebPage.get_all_hostnames()
            if active_hostnames:
                for hostname in active_hostnames:
                    self.stdout.write(f"   ✓ {hostname}")
            else:
                self.stdout.write(
                    self.style.WARNING("   ⚠ No hostnames found in database")
                )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"   ✗ Error loading hostnames: {e}"))

    def _show_static_hosts(self):
        """Show static allowed hosts from settings."""
        self.stdout.write(self.style.HTTP_INFO("\n2. Static Allowed Hosts:"))
        self.stdout.write("   (From STATIC_ALLOWED_HOSTS setting)\n")

        static_hosts = getattr(settings, "STATIC_ALLOWED_HOSTS", [])
        if static_hosts:
            for host in static_hosts:
                self.stdout.write(f"   ✓ {host}")
        else:
            self.stdout.write(
                self.style.WARNING("   ⚠ No static allowed hosts configured")
            )

    def _audit_pages_with_hostnames(self, show_invalid_only, verbose):
        """Audit all pages that have hostnames configured."""
        self.stdout.write(self.style.HTTP_INFO("\n3. Pages with Hostnames:\n"))

        # Get all pages with hostnames (both valid and invalid)
        pages_with_hostnames = WebPage.objects.exclude(hostnames=[]).order_by("id")

        if not pages_with_hostnames.exists():
            self.stdout.write(
                self.style.WARNING("   ⚠ No pages have hostnames configured")
            )
            return

        invalid_count = 0
        valid_count = 0

        for page in pages_with_hostnames:
            is_root = page.parent is None
            is_valid = is_root

            if show_invalid_only and is_valid:
                continue

            if is_valid:
                valid_count += 1
                status = self.style.SUCCESS("✓ VALID")
            else:
                invalid_count += 1
                status = self.style.ERROR("✗ INVALID")

            # Basic info
            title = (
                page.get_latest_version().page_data.get("title", "Untitled")
                if page.get_latest_version() and page.get_latest_version().page_data
                else page.slug
            )
            self.stdout.write(f"\n   {status} | ID: {page.id} | {title}")
            self.stdout.write(f"      Slug: {page.slug}")
            self.stdout.write(f"      Hostnames: {', '.join(page.hostnames)}")
            self.stdout.write(f"      Is Root Page: {is_root}")

            if not is_root:
                parent_title = "Unknown"
                if page.parent:
                    parent_version = page.parent.get_latest_version()
                    if parent_version and parent_version.page_data:
                        parent_title = parent_version.page_data.get(
                            "title", page.parent.slug
                        )
                    else:
                        parent_title = page.parent.slug

                self.stdout.write(
                    self.style.ERROR(
                        f"      ⚠ ERROR: This page has a parent (ID: {page.parent_id}, '{parent_title}')"
                    )
                )
                self.stdout.write(
                    self.style.WARNING(
                        f"      FIX: Either set parent=None to make it a root page, or remove hostnames"
                    )
                )

            if verbose:
                self.stdout.write(f"      Created: {page.created_at}")
                if page.site_icon:
                    self.stdout.write(f"      Site Icon: {page.site_icon}")

        # Summary
        self.stdout.write(f"\n   Summary:")
        self.stdout.write(
            self.style.SUCCESS(f"   ✓ Valid configurations: {valid_count}")
        )
        if invalid_count > 0:
            self.stdout.write(
                self.style.ERROR(f"   ✗ Invalid configurations: {invalid_count}")
            )

    def _show_recommendations(self):
        """Show recommendations for fixing issues."""
        self.stdout.write(self.style.HTTP_INFO("\n4. Recommendations:\n"))

        # Check for invalid configurations
        invalid_pages = WebPage.objects.exclude(hostnames=[]).exclude(
            parent__isnull=True
        )

        if invalid_pages.exists():
            self.stdout.write(
                self.style.ERROR(
                    f"   ⚠ Found {invalid_pages.count()} page(s) with invalid hostname configuration"
                )
            )
            self.stdout.write("\n   To fix invalid configurations:")
            self.stdout.write(
                "   1. Make the page a root page (set parent=None in admin)"
            )
            self.stdout.write("   2. Or remove the hostnames from the page")
            self.stdout.write(
                "\n   Example Django shell command to fix page with ID 3:"
            )
            self.stdout.write("   >>> page = WebPage.objects.get(id=3)")
            self.stdout.write("   >>> page.parent = None")
            self.stdout.write("   >>> page.save()  # This makes it a root page")
            self.stdout.write("\n   Or to remove hostnames:")
            self.stdout.write("   >>> page = WebPage.objects.get(id=3)")
            self.stdout.write("   >>> page.hostnames = []")
            self.stdout.write("   >>> page.save()")

        else:
            self.stdout.write(
                self.style.SUCCESS("   ✓ All hostname configurations are valid!")
            )

        # Show cache clear command
        self.stdout.write("\n   After making changes, clear the hostname cache:")
        self.stdout.write(
            "   >>> from webpages.middleware import DynamicHostValidationMiddleware"
        )
        self.stdout.write(
            "   >>> DynamicHostValidationMiddleware.clear_hostname_cache()"
        )
        self.stdout.write(
            "   Or restart the server to automatically reload hostnames.\n"
        )
