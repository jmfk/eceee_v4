"""
Management command to warm inheritance tree cache.

Pre-builds inheritance trees for all pages to improve performance.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from webpages.models import WebPage
from webpages.inheritance_cache import InheritanceTreeCache


class Command(BaseCommand):
    help = "Warm inheritance tree cache for all pages"

    def add_arguments(self, parser):
        parser.add_argument(
            "--pages",
            nargs="+",
            type=int,
            help="Specific page IDs to warm (default: all pages)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force rebuild even if cache exists",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be cached without building",
        )

    def handle(self, *args, **options):
        page_ids = options.get("pages")
        force = options["force"]
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE - No cache warming"))

        # Get pages to warm
        if page_ids:
            pages = WebPage.objects.filter(id__in=page_ids)
            self.stdout.write(f"Warming cache for {len(page_ids)} specific pages")
        else:
            pages = WebPage.objects.all()
            self.stdout.write(f"Warming cache for all {pages.count()} pages")

        warmed_count = 0
        failed_count = 0

        for page in pages:
            if dry_run:
                self.stdout.write(f"Would warm: {page.title} (ID: {page.id})")
                continue

            try:
                # Warm cache (force rebuild if requested)
                success = (
                    InheritanceTreeCache.warm_cache(page.id)
                    if not force
                    else InheritanceTreeCache.get_tree(page.id, force_rebuild=True)
                )

                if success:
                    warmed_count += 1
                    self.stdout.write(f"✅ Warmed: {page.title} (ID: {page.id})")
                else:
                    failed_count += 1
                    self.stdout.write(f"❌ Failed: {page.title} (ID: {page.id})")

            except Exception as e:
                failed_count += 1
                self.stdout.write(f"❌ Error warming {page.title}: {e}")

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Cache warming complete: {warmed_count} success, {failed_count} failed"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"DRY RUN: Would warm {pages.count()} pages")
            )
