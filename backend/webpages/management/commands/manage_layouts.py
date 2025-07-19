"""
Management command for layout system operations.

Provides commands to list, migrate, validate, and manage both database and code-based layouts.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from webpages.models import PageLayout, WebPage
from webpages.layout_registry import layout_registry
from webpages.layout_autodiscovery import (
    autodiscover_layouts,
    validate_layout_configuration,
    get_layout_summary,
    reload_layouts,
)
import json


class Command(BaseCommand):
    help = "Manage layout system - list, migrate, validate layouts"

    def add_arguments(self, parser):
        subparsers = parser.add_subparsers(dest="action", help="Available actions")

        # List layouts command
        list_parser = subparsers.add_parser("list", help="List all layouts")
        list_parser.add_argument(
            "--type",
            choices=["all", "code", "database"],
            default="all",
            help="Type of layouts to list",
        )
        list_parser.add_argument(
            "--active-only", action="store_true", help="Only show active layouts"
        )

        # Validate layouts command
        validate_parser = subparsers.add_parser("validate", help="Validate all layouts")

        # Reload layouts command
        reload_parser = subparsers.add_parser(
            "reload", help="Reload code-based layouts"
        )

        # Summary command
        summary_parser = subparsers.add_parser(
            "summary", help="Show layout system summary"
        )

        # Migrate command
        migrate_parser = subparsers.add_parser(
            "migrate", help="Migrate database layouts to code"
        )
        migrate_parser.add_argument(
            "--layout-id", type=int, help="Specific layout ID to migrate"
        )
        migrate_parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be migrated without making changes",
        )

        # Export command
        export_parser = subparsers.add_parser(
            "export", help="Export database layouts as code templates"
        )
        export_parser.add_argument(
            "--output-file",
            default="exported_layouts.py",
            help="Output file for exported layouts",
        )

        # Convert pages command
        convert_parser = subparsers.add_parser(
            "convert-pages", help="Convert pages from database to code layouts"
        )
        convert_parser.add_argument(
            "--from-layout", help="Database layout name to convert from"
        )
        convert_parser.add_argument(
            "--to-layout", help="Code layout name to convert to"
        )
        convert_parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be converted without making changes",
        )

    def handle(self, *args, **options):
        action = options["action"]

        if action == "list":
            self.handle_list(options)
        elif action == "validate":
            self.handle_validate(options)
        elif action == "reload":
            self.handle_reload(options)
        elif action == "summary":
            self.handle_summary(options)
        elif action == "migrate":
            self.handle_migrate(options)
        elif action == "export":
            self.handle_export(options)
        elif action == "convert-pages":
            self.handle_convert_pages(options)
        else:
            self.stdout.write(
                self.style.ERROR(
                    "Please specify an action: list, validate, reload, summary, migrate, export, convert-pages"
                )
            )

    def handle_list(self, options):
        """List layouts"""
        layout_type = options["type"]
        active_only = options["active_only"]

        if layout_type in ["all", "code"]:
            self.stdout.write(self.style.SUCCESS("\nCode-based Layouts:"))
            code_layouts = layout_registry.list_layouts(active_only=active_only)

            if code_layouts:
                for layout in code_layouts:
                    status = "✓ Active" if layout.is_active else "✗ Inactive"
                    self.stdout.write(
                        f"  • {layout.name}: {layout.description} ({status})"
                    )
            else:
                self.stdout.write("  No code layouts found")

        if layout_type in ["all", "database"]:
            self.stdout.write(self.style.SUCCESS("\nDatabase Layouts:"))
            db_layouts = PageLayout.objects.all()
            if active_only:
                db_layouts = db_layouts.filter(is_active=True)

            if db_layouts.exists():
                for layout in db_layouts:
                    status = "✓ Active" if layout.is_active else "✗ Inactive"
                    self.stdout.write(
                        f"  • {layout.name}: {layout.description} ({status})"
                    )
            else:
                self.stdout.write("  No database layouts found")

    def handle_validate(self, options):
        """Validate all layouts"""
        self.stdout.write("Validating layout configurations...")

        try:
            validate_layout_configuration()
            self.stdout.write(self.style.SUCCESS("✓ All layouts are valid"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ Layout validation failed: {e}"))

    def handle_reload(self, options):
        """Reload code-based layouts"""
        self.stdout.write("Reloading code-based layouts...")

        try:
            reload_layouts()
            summary = get_layout_summary()
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ Layouts reloaded successfully. "
                    f"Found {summary['total_layouts']} layouts "
                    f"({summary['active_layouts']} active)"
                )
            )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ Layout reload failed: {e}"))

    def handle_summary(self, options):
        """Show layout system summary"""
        summary = get_layout_summary()
        db_layouts = PageLayout.objects.count()
        db_active = PageLayout.objects.filter(is_active=True).count()

        self.stdout.write(self.style.SUCCESS("\nLayout System Summary:"))
        self.stdout.write(
            f"Code Layouts: {summary['total_layouts']} total, {summary['active_layouts']} active"
        )
        self.stdout.write(f"Database Layouts: {db_layouts} total, {db_active} active")

        # Show usage statistics
        pages_with_code_layout = WebPage.objects.exclude(code_layout="").count()
        pages_with_db_layout = WebPage.objects.filter(layout__isnull=False).count()
        pages_with_no_layout = WebPage.objects.filter(
            layout__isnull=True, code_layout=""
        ).count()

        self.stdout.write(f"\nPage Layout Usage:")
        self.stdout.write(f"  Pages using code layouts: {pages_with_code_layout}")
        self.stdout.write(f"  Pages using database layouts: {pages_with_db_layout}")
        self.stdout.write(f"  Pages with no layout: {pages_with_no_layout}")

    def handle_migrate(self, options):
        """Migrate database layouts to code"""
        layout_id = options.get("layout_id")
        dry_run = options["dry_run"]

        if layout_id:
            try:
                layout = PageLayout.objects.get(id=layout_id)
                self.migrate_single_layout(layout, dry_run)
            except PageLayout.DoesNotExist:
                raise CommandError(f"Layout with ID {layout_id} not found")
        else:
            # Migrate all database layouts
            layouts = PageLayout.objects.all()
            for layout in layouts:
                self.migrate_single_layout(layout, dry_run)

    def migrate_single_layout(self, layout, dry_run=False):
        """Migrate a single database layout to code format"""
        self.stdout.write(f"\nMigrating layout: {layout.name}")

        # Generate Python code for the layout
        code = self.generate_layout_code(layout)

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN - Generated code:"))
            self.stdout.write(code)
        else:
            # For now, just output the code - in a real implementation,
            # you might write to a file or create a migration
            self.stdout.write(self.style.SUCCESS("Generated layout code:"))
            self.stdout.write(code)

    def generate_layout_code(self, layout):
        """Generate Python code for a database layout"""
        class_name = self.to_class_name(layout.name)

        template = f'''
@register_layout
class {class_name}(BaseLayout):
    """Migrated from database layout: {layout.name}"""
    
    name = "{layout.name}"
    description = "{layout.description}"
    template_name = "{layout.template_name}"
    css_classes = "{layout.css_classes}"
    
    @property
    def slot_configuration(self):
        return {json.dumps(layout.slot_configuration, indent=8)}
'''
        return template.strip()

    def to_class_name(self, layout_name):
        """Convert layout name to Python class name"""
        # Remove special characters and convert to PascalCase
        clean_name = "".join(c for c in layout_name if c.isalnum() or c == "_")
        parts = clean_name.split("_")
        return "".join(word.capitalize() for word in parts) + "Layout"

    def handle_export(self, options):
        """Export database layouts as code templates"""
        output_file = options["output_file"]
        layouts = PageLayout.objects.all()

        if not layouts.exists():
            self.stdout.write(self.style.WARNING("No database layouts to export"))
            return

        with open(output_file, "w") as f:
            f.write('"""\n')
            f.write("Exported Database Layouts\n")
            f.write("Generated by manage_layouts export command\n")
            f.write('"""\n\n')
            f.write(
                "from webpages.layout_registry import BaseLayout, register_layout\n\n"
            )

            for layout in layouts:
                code = self.generate_layout_code(layout)
                f.write(code + "\n\n")

        self.stdout.write(
            self.style.SUCCESS(f"✓ Exported {layouts.count()} layouts to {output_file}")
        )

    def handle_convert_pages(self, options):
        """Convert pages from database to code layouts"""
        from_layout = options.get("from_layout")
        to_layout = options.get("to_layout")
        dry_run = options["dry_run"]

        if not from_layout or not to_layout:
            raise CommandError("Both --from-layout and --to-layout are required")

        # Find database layout
        try:
            db_layout = PageLayout.objects.get(name=from_layout)
        except PageLayout.DoesNotExist:
            raise CommandError(f"Database layout '{from_layout}' not found")

        # Check if code layout exists
        if not layout_registry.is_registered(to_layout):
            raise CommandError(f"Code layout '{to_layout}' not found")

        # Find pages using the database layout
        pages = WebPage.objects.filter(layout=db_layout)

        if not pages.exists():
            self.stdout.write(f"No pages found using layout '{from_layout}'")
            return

        self.stdout.write(f"Found {pages.count()} pages using layout '{from_layout}'")

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN - Pages that would be converted:")
            )
            for page in pages:
                self.stdout.write(f"  • {page.title} (ID: {page.id})")
        else:
            with transaction.atomic():
                for page in pages:
                    page.code_layout = to_layout
                    page.layout = None  # Remove database layout reference
                    page.save()

            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ Converted {pages.count()} pages to use code layout '{to_layout}'"
                )
            )
