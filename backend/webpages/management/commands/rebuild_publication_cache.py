"""
Management command to rebuild publication cache for all WebPages.

This command recalculates and updates the cached publication fields for all pages.
Useful for:
- Recovering from data inconsistencies
- After bulk imports or migrations
- Maintenance and verification

Usage:
    python manage.py rebuild_publication_cache
    python manage.py rebuild_publication_cache --verify-only
    python manage.py rebuild_publication_cache --page-id 123
"""

from django.core.management.base import BaseCommand
from webpages.models import WebPage
from webpages.signals import update_page_publication_cache


class Command(BaseCommand):
    help = "Rebuild publication cache for all pages"

    def add_arguments(self, parser):
        parser.add_argument(
            "--verify-only",
            action="store_true",
            help="Only verify publication cache without updating",
        )
        parser.add_argument(
            "--page-id",
            type=int,
            help="Only rebuild publication cache for a specific page",
        )

    def handle(self, *args, **options):
        verify_only = options["verify_only"]
        page_id = options.get("page_id")

        if verify_only:
            self.stdout.write(self.style.WARNING("Running in verify-only mode..."))
            self.verify_publication_cache()
        elif page_id:
            self.stdout.write(f"Rebuilding publication cache for page {page_id}...")
            self.rebuild_page_cache(page_id)
        else:
            self.stdout.write("Rebuilding publication cache for all pages...")
            self.rebuild_all_pages()

    def rebuild_all_pages(self):
        """Rebuild publication cache for all pages"""
        pages = WebPage.objects.all()
        total = pages.count()

        self.stdout.write(f"Found {total} pages")

        for i, page in enumerate(pages, 1):
            update_page_publication_cache(page)
            if i % 100 == 0:
                self.stdout.write(f"Processed {i}/{total} pages")

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully rebuilt publication cache for {total} pages"
            )
        )

    def rebuild_page_cache(self, page_id):
        """Rebuild publication cache for a specific page"""
        try:
            page = WebPage.objects.get(id=page_id)
        except WebPage.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Page with ID {page_id} not found"))
            return

        update_page_publication_cache(page)

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully rebuilt publication cache for page {page_id}"
            )
        )

    def verify_publication_cache(self):
        """Verify that all publication caches are correct"""
        from django.utils import timezone
        from django.db.models import Q

        self.stdout.write("Verifying publication caches...")

        now = timezone.now()
        all_pages = WebPage.objects.all()
        total = all_pages.count()
        incorrect = 0

        for page in all_pages:
            # Calculate expected values
            published_version = (
                page.versions.filter(effective_date__lte=now)
                .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
                .order_by("-version_number")
                .first()
            )

            latest = page.versions.order_by("-version_number").first()

            expected_is_published = published_version is not None

            # Compare
            if page.is_currently_published != expected_is_published:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Incorrect is_currently_published: Page {page.id} ({page.slug}): "
                        f"cached={page.is_currently_published} expected={expected_is_published}"
                    )
                )
                incorrect += 1
            elif page.current_published_version != published_version:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Incorrect current_published_version: Page {page.id} ({page.slug}): "
                        f"cached={page.current_published_version_id} expected={published_version.id if published_version else None}"
                    )
                )
                incorrect += 1
            elif page.latest_version != latest:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Incorrect latest_version: Page {page.id} ({page.slug}): "
                        f"cached={page.latest_version_id} expected={latest.id if latest else None}"
                    )
                )
                incorrect += 1

        if incorrect == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ All {total} pages have correct publication caches"
                )
            )
        else:
            self.stdout.write(
                self.style.ERROR(
                    f"✗ Found {incorrect} pages with incorrect caches out of {total}"
                )
            )
            self.stdout.write(
                self.style.WARNING(
                    "Run 'python manage.py rebuild_publication_cache' to fix them"
                )
            )
