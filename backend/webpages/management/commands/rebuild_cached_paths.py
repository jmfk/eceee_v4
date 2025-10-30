"""
Management command to rebuild cached_path for all WebPages.

This command recalculates and updates the cached_path field for all pages
in the hierarchy. Useful for:
- Recovering from data inconsistencies
- After bulk imports or migrations
- Maintenance and verification

Usage:
    python manage.py rebuild_cached_paths
    python manage.py rebuild_cached_paths --verify-only
    python manage.py rebuild_cached_paths --page-id 123
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from webpages.models import WebPage


class Command(BaseCommand):
    help = "Rebuild cached_path for all WebPages"

    def add_arguments(self, parser):
        parser.add_argument(
            "--verify-only",
            action="store_true",
            help="Only verify cached paths without updating them",
        )
        parser.add_argument(
            "--page-id",
            type=int,
            help="Only rebuild cached path for a specific page and its descendants",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be updated without making changes",
        )

    def handle(self, *args, **options):
        verify_only = options["verify_only"]
        page_id = options.get("page_id")
        dry_run = options["dry_run"]

        if verify_only:
            self.stdout.write(self.style.WARNING("Running in verify-only mode..."))
            self.verify_cached_paths()
        elif page_id:
            self.stdout.write(f"Rebuilding cached paths for page {page_id} and descendants...")
            self.rebuild_page_tree(page_id, dry_run)
        else:
            self.stdout.write("Rebuilding cached paths for all pages...")
            self.rebuild_all_pages(dry_run)

    def rebuild_all_pages(self, dry_run=False):
        """Rebuild cached paths for all pages starting from roots"""
        root_pages = WebPage.objects.filter(parent__isnull=True)
        total_updated = 0
        
        self.stdout.write(f"Found {root_pages.count()} root pages")
        
        for root in root_pages:
            updated = self.update_tree(root, dry_run)
            total_updated += updated
        
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry run complete. Would update {total_updated} pages"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully rebuilt cached paths for {total_updated} pages"
                )
            )

    def rebuild_page_tree(self, page_id, dry_run=False):
        """Rebuild cached paths for a specific page and its descendants"""
        try:
            page = WebPage.objects.get(id=page_id)
        except WebPage.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"Page with ID {page_id} not found"))
            return
        
        updated = self.update_tree(page, dry_run)
        
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry run complete. Would update {updated} pages"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully rebuilt cached paths for {updated} pages"
                )
            )

    def update_tree(self, page, dry_run=False, root_page=None):
        """Recursively update page and its children, returns count of updated pages"""
        count = 0
        
        # Determine root page
        if root_page is None:
            root_page = page if not page.parent else None
        
        # Calculate new path
        if page.parent:
            parent_path = page.parent.cached_path
            slug_part = (page.slug or "").strip("/")
            new_path = f"{parent_path.rstrip('/')}/{slug_part}/"
        else:
            # Root page
            if page.hostnames:
                new_path = "/"
            else:
                slug_part = (page.slug or "").strip("/")
                new_path = f"/{slug_part}/"
        
        # Calculate root info
        if root_page:
            new_root_id = root_page.id
            new_root_hostnames = root_page.hostnames or []
        else:
            new_root_id = page.id
            new_root_hostnames = page.hostnames or []
        
        # Check if update needed
        needs_update = (
            page.cached_path != new_path or
            page.cached_root_id != new_root_id or
            page.cached_root_hostnames != new_root_hostnames
        )
        
        if needs_update:
            if dry_run:
                self.stdout.write(
                    f"  Would update page {page.id} ({page.slug}): "
                    f"path: '{page.cached_path}' → '{new_path}', "
                    f"root_id: {page.cached_root_id} → {new_root_id}"
                )
            else:
                page.cached_path = new_path
                page.cached_root_id = new_root_id
                page.cached_root_hostnames = new_root_hostnames
                page.save(update_fields=['cached_path', 'cached_root_id', 'cached_root_hostnames'])
                self.stdout.write(
                    f"  Updated page {page.id} ({page.slug}): "
                    f"path: '{new_path}', root_id: {new_root_id}"
                )
            count += 1
        
        # Update children with same root
        for child in page.children.all():
            count += self.update_tree(child, dry_run, root_page or page)
        
        return count

    def verify_cached_paths(self):
        """Verify that all cached paths are correct"""
        self.stdout.write("Verifying cached paths...")
        
        all_pages = WebPage.objects.all()
        total = all_pages.count()
        incorrect = 0
        
        for page in all_pages:
            # Calculate expected path
            if page.parent:
                parent_path = page.parent.cached_path
                slug_part = (page.slug or "").strip("/")
                expected_path = f"{parent_path.rstrip('/')}/{slug_part}/"
            else:
                # Root page
                if page.hostnames:
                    expected_path = "/"
                else:
                    slug_part = (page.slug or "").strip("/")
                    expected_path = f"/{slug_part}/"
            
            # Compare
            if page.cached_path != expected_path:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Incorrect: Page {page.id} ({page.slug}): "
                        f"cached='{page.cached_path}' expected='{expected_path}'"
                    )
                )
                incorrect += 1
        
        if incorrect == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ All {total} pages have correct cached paths"
                )
            )
        else:
            self.stdout.write(
                self.style.ERROR(
                    f"✗ Found {incorrect} pages with incorrect cached paths out of {total}"
                )
            )
            self.stdout.write(
                self.style.WARNING(
                    "Run 'python manage.py rebuild_cached_paths' to fix them"
                )
            )

