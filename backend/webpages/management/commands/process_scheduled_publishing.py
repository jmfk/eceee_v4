"""
Django management command to process scheduled publishing tasks.

This refactored command follows OOP principles and uses service objects
to handle business logic, addressing code smells identified in review.

Usage:
    python manage.py process_scheduled_publishing
    python manage.py process_scheduled_publishing --dry-run
    python manage.py process_scheduled_publishing --verbose
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.contrib.auth.models import User
from webpages.publishing import PublishingService
import logging


class Command(BaseCommand):
    help = "Process scheduled publishing tasks for web pages"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without actually making changes",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Show detailed information about processing",
        )
        parser.add_argument(
            "--user-id",
            type=int,
            help="User ID to use for automated changes (defaults to system user)",
        )

    def handle(self, *args, **options):
        """
        Single responsibility: Coordinate the publishing process.

        Business logic has been moved to PublishingService.
        """
        self.dry_run = options["dry_run"]
        self.verbose = options["verbose"]
        now = timezone.now()

        # Get system user (single responsibility method)
        system_user = self._get_system_user(options.get("user_id"))

        # Create publishing service
        publishing_service = PublishingService(system_user)

        if self.verbose:
            self._log_start(now)

        # Process publications and expirations using service
        if not self.dry_run:
            results = self._process_publications(publishing_service, now)
        else:
            results = self._simulate_processing(publishing_service, now)

        # Report results
        self._report_results(results)

    def _get_system_user(self, user_id):
        """
        Single responsibility: Get or create the system user for automation.

        Keeps user management logic separate from main command logic.
        """
        try:
            if user_id:
                return User.objects.get(id=user_id)
            else:
                system_user, created = User.objects.get_or_create(
                    username="system_publisher",
                    defaults={
                        "email": "system@localhost",
                        "first_name": "System",
                        "last_name": "Publisher",
                        "is_active": True,
                        "is_staff": True,
                    },
                )
                if created and self.verbose:
                    self.stdout.write(
                        self.style.SUCCESS("Created system publisher user")
                    )
                return system_user
        except User.DoesNotExist:
            raise CommandError(f"User with ID {user_id} does not exist")

    def _log_start(self, now):
        """Single responsibility: Log the start of processing."""
        self.stdout.write(f"Processing scheduled publishing at {now}")
        if self.dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be made")
            )

    def _process_publications(self, publishing_service, now):
        """
        Single responsibility: Process actual publications and expirations.

        Uses service object to handle business logic.
        """
        (
            published_count,
            publish_errors,
        ) = publishing_service.process_scheduled_publications(now)
        expired_count, expire_errors = publishing_service.process_expired_pages(now)

        # Log any errors
        for error in publish_errors + expire_errors:
            self.stdout.write(self.style.ERROR(error))

        # Update publication cache for all pages (since publication status can change based on time)
        if published_count > 0 or expired_count > 0:
            from webpages.models import WebPage
            from webpages.signals import update_page_publication_cache
            
            if self.verbose:
                self.stdout.write("Updating publication cache for all pages...")
            
            # Update cache for all pages to reflect time-based publication changes
            for page in WebPage.objects.all():
                update_page_publication_cache(page)
            
            if self.verbose:
                self.stdout.write(self.style.SUCCESS("Publication cache updated"))

        return {
            "published": published_count,
            "expired": expired_count,
            "errors": publish_errors + expire_errors,
        }

    def _simulate_processing(self, publishing_service, now):
        """
        Single responsibility: Simulate processing for dry-run mode.

        Shows what would be done without making changes.
        """
        from webpages.models import WebPage

        # Count what would be processed
        scheduled_pages = WebPage.objects.filter(publication_status="scheduled")
        published_pages = WebPage.objects.filter(publication_status="published")

        publish_count = sum(
            1 for page in scheduled_pages if page.should_be_published_now(now)
        )
        expire_count = sum(
            1 for page in published_pages if page.should_be_expired_now(now)
        )

        if self.verbose:
            self.stdout.write(f"Would publish {publish_count} pages")
            self.stdout.write(f"Would expire {expire_count} pages")

        return {"published": publish_count, "expired": expire_count, "errors": []}

    def _report_results(self, results):
        """Single responsibility: Report the results of processing."""
        total_changes = results["published"] + results["expired"]

        if total_changes > 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Processed {total_changes} pages: "
                    f"{results['published']} published, "
                    f"{results['expired']} expired"
                )
            )
        else:
            self.stdout.write("No pages required processing")

        if results["errors"]:
            self.stdout.write(
                self.style.ERROR(f"Encountered {len(results['errors'])} errors")
            )
