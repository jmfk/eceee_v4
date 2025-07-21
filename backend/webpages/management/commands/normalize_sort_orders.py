from django.core.management.base import BaseCommand
from django.db import transaction
from webpages.models import WebPage


class Command(BaseCommand):
    help = "Normalize sort orders for all pages to use positive values with 10-unit spacing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without actually making changes",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be made")
            )

        # Get all unique parent_ids (including None for root pages)
        parent_ids = set(WebPage.objects.values_list("parent_id", flat=True).distinct())

        total_pages_updated = 0

        with transaction.atomic():
            for parent_id in parent_ids:
                if parent_id:
                    # Pages with this parent
                    siblings = WebPage.objects.filter(parent_id=parent_id).order_by(
                        "sort_order", "title"
                    )
                    parent_name = f"parent ID {parent_id}"
                else:
                    # Root pages (no parent)
                    siblings = WebPage.objects.filter(parent__isnull=True).order_by(
                        "sort_order", "title"
                    )
                    parent_name = "root level"

                if not siblings.exists():
                    continue

                self.stdout.write(
                    f"\nNormalizing {siblings.count()} pages under {parent_name}:"
                )

                changes_made = 0
                for index, page in enumerate(siblings):
                    new_sort_order = (index + 1) * 10  # 10, 20, 30, 40, etc.

                    if page.sort_order != new_sort_order:
                        old_sort_order = page.sort_order

                        if not dry_run:
                            page.sort_order = new_sort_order
                            page.save(update_fields=["sort_order"])

                        self.stdout.write(
                            f"  - {page.title}: {old_sort_order} → {new_sort_order}"
                        )
                        changes_made += 1
                        total_pages_updated += 1
                    else:
                        self.stdout.write(
                            f"  ✓ {page.title}: {page.sort_order} (no change needed)"
                        )

                if changes_made == 0:
                    self.stdout.write(f"  No changes needed for {parent_name}")

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nDRY RUN COMPLETE: Would update {total_pages_updated} pages"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nSuccessfully normalized sort orders for {total_pages_updated} pages"
                )
            )

            # Verify normalization worked
            self.stdout.write("\nVerifying normalization...")
            negative_pages = WebPage.objects.filter(sort_order__lt=0)
            if negative_pages.exists():
                self.stdout.write(
                    self.style.ERROR(
                        f"Warning: {negative_pages.count()} pages still have negative sort_order"
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        "✓ All pages now have positive sort_order values"
                    )
                )
