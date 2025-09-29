"""
Management command to clear layout-related caches.

This command is useful for development when you need to force refresh
layout data without restarting the Django server.
"""

from django.core.management.base import BaseCommand
from django.core.cache import cache

from webpages.layout_registry import layout_registry


class Command(BaseCommand):
    help = "Clear layout-related caches to force refresh of layout data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--layout",
            type=str,
            help="Clear cache for specific layout only",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Clear all caches (not just layout-related)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be cleared without actually clearing",
        )

    def handle(self, *args, **options):
        layout_name = options.get("layout")
        clear_all = options.get("all")
        dry_run = options.get("dry_run")

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN: No caches will actually be cleared")
            )

        if clear_all:
            self.stdout.write("Clearing ALL caches...")
            if not dry_run:
                cache.clear()
                self.stdout.write(
                    self.style.SUCCESS("✅ All caches cleared successfully")
                )

        elif layout_name:
            self.stdout.write(f"Clearing cache for layout: {layout_name}")
            if not dry_run:
                layout_registry._invalidate_layout_caches(layout_name)
                self.stdout.write(
                    self.style.SUCCESS(f"✅ Cache cleared for layout: {layout_name}")
                )

        else:
            self.stdout.write("Clearing all layout-related caches...")
            if not dry_run:
                layout_registry._invalidate_all_layout_caches()
                self.stdout.write(
                    self.style.SUCCESS("✅ All layout caches cleared successfully")
                )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "DRY RUN COMPLETE: Use without --dry-run to actually clear caches"
                )
            )

        # Show current registered layouts
        layouts = layout_registry.list_layouts(active_only=False)
        self.stdout.write(f"\nCurrently registered layouts ({len(layouts)}):")
        for layout in layouts:
            status = "✅ Active" if layout.is_active else "❌ Inactive"
            self.stdout.write(f"  • {layout.name} - {status}")
