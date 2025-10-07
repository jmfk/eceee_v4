"""
Management command to migrate widget inheritance from boolean fields to enum.

Converts existing widgets:
- inherit_from_parent=False -> inheritance_behavior="override_parent" (page only)
- inherit_from_parent=True + override_parent=True -> inheritance_behavior="override_parent"
- inherit_from_parent=True + override_parent=False -> inheritance_behavior="insert_after_parent"
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from webpages.models import PageVersion
from webpages.json_models import WidgetInheritanceBehavior


class Command(BaseCommand):
    help = "Migrate widget inheritance from boolean fields to inheritance_behavior enum"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without making changes",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be made")
            )

        # Get all page versions with widgets
        versions = PageVersion.objects.filter(widgets__isnull=False).exclude(widgets={})
        total_versions = versions.count()
        updated_versions = 0
        updated_widgets = 0

        self.stdout.write(f"Found {total_versions} page versions with widgets")

        with transaction.atomic():
            for version in versions:
                version_updated = False
                new_widgets = {}

                for slot_name, widgets in version.widgets.items():
                    new_slot_widgets = []

                    for widget in widgets:
                        if not isinstance(widget, dict):
                            new_slot_widgets.append(widget)
                            continue

                        # Check if already has new inheritance_behavior field
                        if "inheritance_behavior" in widget:
                            new_slot_widgets.append(widget)
                            continue

                        # Convert old boolean fields to new enum
                        updated_widget = widget.copy()
                        inherit_from_parent = widget.get("inherit_from_parent", True)
                        override_parent = widget.get("override_parent", False)

                        if not inherit_from_parent:
                            # Widget only on its own page (treated as override for simplicity)
                            updated_widget["inheritance_behavior"] = (
                                WidgetInheritanceBehavior.OVERRIDE_PARENT.value
                            )
                        elif override_parent:
                            # Override parent widgets
                            updated_widget["inheritance_behavior"] = (
                                WidgetInheritanceBehavior.OVERRIDE_PARENT.value
                            )
                        else:
                            # Default: insert after parent widgets
                            updated_widget["inheritance_behavior"] = (
                                WidgetInheritanceBehavior.INSERT_AFTER_PARENT.value
                            )

                        # Keep old fields for backward compatibility during transition
                        # They will be marked as deprecated in the schema

                        new_slot_widgets.append(updated_widget)
                        updated_widgets += 1
                        version_updated = True

                        self.stdout.write(
                            f'Widget {widget.get("id", "unknown")} -> {updated_widget["inheritance_behavior"]}'
                        )

                    new_widgets[slot_name] = new_slot_widgets

                if version_updated:
                    if not dry_run:
                        version.widgets = new_widgets
                        version.save()
                    updated_versions += 1

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"DRY RUN: Would update {updated_widgets} widgets in {updated_versions} versions"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully updated {updated_widgets} widgets in {updated_versions} versions"
                )
            )
