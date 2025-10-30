"""
Management command to permanently delete soft-deleted WebPages.

This command removes pages marked as is_deleted=True from the database.
Use with caution - this operation cannot be undone.

Usage:
    python manage.py delete_deleted_pages
    python manage.py delete_deleted_pages --older-than-days 30
    python manage.py delete_deleted_pages --page-id 123
    python manage.py delete_deleted_pages --dry-run
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from webpages.models import WebPage


class Command(BaseCommand):
    help = "Permanently delete soft-deleted pages from the database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--older-than-days",
            type=int,
            help="Only delete pages deleted more than N days ago",
        )
        parser.add_argument(
            "--page-id",
            type=int,
            help="Delete a specific page by ID",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting",
        )
        parser.add_argument(
            "--include-children",
            action="store_true",
            help="Also delete all deleted children recursively",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        older_than_days = options.get("older_than_days")
        page_id = options.get("page_id")
        include_children = options["include_children"]

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No deletions will be performed")
            )

        # Build queryset
        queryset = WebPage.objects.filter(is_deleted=True)

        if page_id:
            # Delete specific page
            queryset = queryset.filter(id=page_id)
        elif older_than_days:
            # Filter by deletion date
            cutoff_date = timezone.now() - timedelta(days=older_than_days)
            queryset = queryset.filter(deleted_at__lt=cutoff_date)

        # Get pages to delete
        pages_to_delete = list(queryset)

        if not pages_to_delete:
            self.stdout.write("No deleted pages found matching criteria")
            return

        # Show what will be deleted
        self.stdout.write(f"\nFound {len(pages_to_delete)} deleted page(s):")
        for page in pages_to_delete:
            deleted_at = page.deleted_at.strftime("%Y-%m-%d %H:%M") if page.deleted_at else "Unknown"
            self.stdout.write(
                f"  - ID {page.id}: '{page.slug}' (deleted at {deleted_at})"
            )

        # Count children if requested
        if include_children:
            total_children = 0
            for page in pages_to_delete:
                children_count = self._count_deleted_descendants(page)
                if children_count > 0:
                    self.stdout.write(
                        f"    └─ {children_count} deleted child page(s)"
                    )
                    total_children += children_count
            
            if total_children > 0:
                self.stdout.write(
                    f"\nTotal with children: {len(pages_to_delete)} pages + {total_children} children = {len(pages_to_delete) + total_children} total"
                )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"\nDry run complete. Would delete {len(pages_to_delete)} page(s)"
                )
            )
            return

        # Confirm deletion
        if not options.get("no_input", False):
            confirm = input(
                f"\nAre you sure you want to PERMANENTLY delete {len(pages_to_delete)} page(s)? "
                "This cannot be undone. Type 'yes' to continue: "
            )
            if confirm.lower() != "yes":
                self.stdout.write(self.style.WARNING("Deletion cancelled"))
                return

        # Perform deletion
        deleted_count = 0
        for page in pages_to_delete:
            try:
                page_id = page.id
                slug = page.slug
                
                # Delete the page (CASCADE will handle versions and children)
                page.delete()
                
                deleted_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f"✓ Deleted page {page_id}: '{slug}'")
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f"✗ Failed to delete page {page.id}: {str(e)}"
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\nSuccessfully deleted {deleted_count} page(s)"
            )
        )

    def _count_deleted_descendants(self, page):
        """Recursively count all deleted descendants"""
        count = 0
        for child in page.children.filter(is_deleted=True):
            count += 1
            count += self._count_deleted_descendants(child)
        return count

