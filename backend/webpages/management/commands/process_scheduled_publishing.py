"""
Django management command to process scheduled publishing tasks.

This command should be run periodically (e.g., via cron) to:
1. Publish pages that are scheduled and have reached their effective_date
2. Expire pages that have reached their expiry_date
3. Update publication status based on current time

Usage:
    python manage.py process_scheduled_publishing
    python manage.py process_scheduled_publishing --dry-run
    python manage.py process_scheduled_publishing --verbose
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.db import transaction
from django.contrib.auth.models import User
from webpages.models import WebPage
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
        self.dry_run = options["dry_run"]
        self.verbose = options["verbose"]

        # Get or create system user for automated publishing
        try:
            if options["user_id"]:
                system_user = User.objects.get(id=options["user_id"])
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
        except User.DoesNotExist:
            raise CommandError(f'User with ID {options["user_id"]} does not exist')

        now = timezone.now()

        if self.verbose:
            self.stdout.write(f"Processing scheduled publishing at {now}")
            if self.dry_run:
                self.stdout.write(
                    self.style.WARNING("DRY RUN MODE - No changes will be made")
                )

        # Process scheduled publications
        scheduled_pages = self.process_scheduled_publications(now, system_user)

        # Process page expirations
        expired_pages = self.process_page_expirations(now, system_user)

        # Update status for pages that should be automatically expired
        auto_expired_pages = self.process_auto_expired_pages(now, system_user)

        # Summary
        total_changes = scheduled_pages + expired_pages + auto_expired_pages
        if total_changes > 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Processed {total_changes} pages: "
                    f"{scheduled_pages} published, "
                    f"{expired_pages} manually expired, "
                    f"{auto_expired_pages} auto-expired"
                )
            )
        else:
            self.stdout.write("No pages required processing")

    def process_scheduled_publications(self, now, system_user):
        """Process pages scheduled for publication"""
        # Find pages that should be published
        pages_to_publish = WebPage.objects.filter(
            publication_status="scheduled", effective_date__lte=now
        )

        if self.verbose:
            self.stdout.write(
                f"Found {pages_to_publish.count()} pages ready for publication"
            )

        published_count = 0

        for page in pages_to_publish:
            if self.verbose:
                self.stdout.write(f"  Publishing: {page.title} (/{page.slug})")

            if not self.dry_run:
                try:
                    with transaction.atomic():
                        # Update page status
                        page.publication_status = "published"
                        page.last_modified_by = system_user
                        page.save()

                        # Create version record
                        page.create_version(
                            system_user,
                            f'Automatically published at {now.strftime("%Y-%m-%d %H:%M")}',
                            status="published",
                            auto_publish=True,
                        )

                        published_count += 1

                        if self.verbose:
                            self.stdout.write(
                                self.style.SUCCESS(f"    ✓ Published successfully")
                            )

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"    ✗ Failed to publish: {str(e)}")
                    )
            else:
                published_count += 1

        return published_count

    def process_page_expirations(self, now, system_user):
        """Process pages that have manually set expiry dates"""
        # Find published pages that have reached their expiry date
        pages_to_expire = WebPage.objects.filter(
            publication_status="published", expiry_date__lte=now
        )

        if self.verbose:
            self.stdout.write(
                f"Found {pages_to_expire.count()} pages that should be expired"
            )

        expired_count = 0

        for page in pages_to_expire:
            if self.verbose:
                self.stdout.write(
                    f"  Expiring: {page.title} (/{page.slug}) - "
                    f"expired at {page.expiry_date}"
                )

            if not self.dry_run:
                try:
                    with transaction.atomic():
                        # Update page status
                        page.publication_status = "expired"
                        page.last_modified_by = system_user
                        page.save()

                        # Create version record
                        page.create_version(
                            system_user,
                            f'Automatically expired at {now.strftime("%Y-%m-%d %H:%M")} '
                            f'(expiry date: {page.expiry_date.strftime("%Y-%m-%d %H:%M")})',
                            status="draft",
                        )

                        expired_count += 1

                        if self.verbose:
                            self.stdout.write(
                                self.style.SUCCESS(f"    ✓ Expired successfully")
                            )

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"    ✗ Failed to expire: {str(e)}")
                    )
            else:
                expired_count += 1

        return expired_count

    def process_auto_expired_pages(self, now, system_user):
        """Process pages that should be auto-expired due to status mismatch"""
        # Find pages marked as published but with past expiry dates
        # This handles cases where the expiry process might have been missed
        auto_expire_pages = WebPage.objects.filter(
            publication_status="published",
            expiry_date__lt=now - timezone.timedelta(hours=1),  # 1-hour grace period
        )

        if self.verbose and auto_expire_pages.exists():
            self.stdout.write(
                f"Found {auto_expire_pages.count()} pages with past expiry dates that need status correction"
            )

        auto_expired_count = 0

        for page in auto_expire_pages:
            if self.verbose:
                self.stdout.write(
                    f"  Auto-expiring: {page.title} (/{page.slug}) - "
                    f"should have expired at {page.expiry_date}"
                )

            if not self.dry_run:
                try:
                    with transaction.atomic():
                        # Update page status
                        page.publication_status = "expired"
                        page.last_modified_by = system_user
                        page.save()

                        # Create version record
                        page.create_version(
                            system_user,
                            f'Status corrected - expired at {now.strftime("%Y-%m-%d %H:%M")} '
                            f'(original expiry: {page.expiry_date.strftime("%Y-%m-%d %H:%M")})',
                            status="draft",
                        )

                        auto_expired_count += 1

                        if self.verbose:
                            self.stdout.write(
                                self.style.SUCCESS(f"    ✓ Status corrected")
                            )

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"    ✗ Failed to correct status: {str(e)}")
                    )
            else:
                auto_expired_count += 1

        return auto_expired_count

    def log_activity(self, message, level="info"):
        """Log activity to Django logging system"""
        logger = logging.getLogger("webpages.publishing")

        if level == "error":
            logger.error(message)
        elif level == "warning":
            logger.warning(message)
        else:
            logger.info(message)
