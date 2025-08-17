"""
Management command to recover widgets that were lost during page version compaction.

This command looks for pages that have empty widgets but have a description mentioning
"Admin compaction" and attempts to recover widgets from any remaining older versions.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from webpages.models import WebPage, PageVersion


class Command(BaseCommand):
    help = "Recover widgets that were lost during page version compaction"

    def add_arguments(self, parser):
        parser.add_argument(
            "--page-id",
            type=int,
            help="Specific page ID to recover (optional)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be recovered without making changes",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force recovery even if current version has widgets",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        force = options["force"]
        page_id = options.get("page_id")

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be made")
            )

        # Find pages that might need recovery
        if page_id:
            pages = WebPage.objects.filter(id=page_id)
        else:
            pages = WebPage.objects.all()

        recovered_count = 0
        checked_count = 0
        errors = []

        for page in pages:
            checked_count += 1
            current_version = page.get_current_version()

            if not current_version:
                continue

            # Check if this page might have been affected by compaction
            has_compaction_description = (
                "Admin compaction" in current_version.meta_description
            )
            has_empty_widgets = (
                not current_version.widgets
                or current_version.widgets == {}
                or current_version.widgets == []
            )

            if not force and not (has_compaction_description and has_empty_widgets):
                continue

            self.stdout.write(f"Checking page: {page.title} (ID: {page.id})")

            if has_empty_widgets:
                self.stdout.write(
                    self.style.WARNING(f"  - Current version has empty widgets")
                )

            if has_compaction_description:
                self.stdout.write(
                    self.style.WARNING(
                        f"  - Found compaction description: {current_version.meta_description}"
                    )
                )

            # Look for widgets in any previous versions
            all_versions = page.versions.exclude(id=current_version.id).order_by(
                "-version_number"
            )
            widgets_found = None
            source_version = None

            for version in all_versions:
                if version.widgets and version.widgets != {} and version.widgets != []:
                    widgets_found = version.widgets
                    source_version = version
                    break

            if widgets_found:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  - Found widgets in version {source_version.version_number}"
                    )
                )
                self.stdout.write(
                    f"  - Widget slots found: {list(widgets_found.keys())}"
                )

                if not dry_run:
                    try:
                        with transaction.atomic():
                            # Update current version with recovered widgets
                            current_version.widgets = widgets_found
                            current_version.meta_description += f" [Widgets recovered from v{source_version.version_number}]"
                            current_version.save()

                            recovered_count += 1
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f"  - ✅ Widgets recovered successfully!"
                                )
                            )
                    except Exception as e:
                        error_msg = (
                            f"Error recovering widgets for page {page.id}: {str(e)}"
                        )
                        errors.append(error_msg)
                        self.stdout.write(self.style.ERROR(f"  - ❌ {error_msg}"))
                else:
                    recovered_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"  - 🔄 Would recover widgets (dry run)")
                    )
            else:
                self.stdout.write(
                    self.style.ERROR(
                        f"  - ❌ No widgets found in any previous versions"
                    )
                )

        # Summary
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(f"RECOVERY SUMMARY:")
        self.stdout.write(f"  Pages checked: {checked_count}")
        if dry_run:
            self.stdout.write(f"  Pages that would be recovered: {recovered_count}")
        else:
            self.stdout.write(f"  Pages recovered: {recovered_count}")

        if errors:
            self.stdout.write(f"  Errors: {len(errors)}")
            for error in errors:
                self.stdout.write(f"    - {error}")

        if dry_run and recovered_count > 0:
            self.stdout.write(
                "\n"
                + self.style.WARNING(
                    "To actually perform the recovery, run this command without --dry-run"
                )
            )
        elif not dry_run and recovered_count > 0:
            self.stdout.write(
                "\n"
                + self.style.SUCCESS(
                    "✅ Recovery completed! Your widgets should now be restored."
                )
            )
