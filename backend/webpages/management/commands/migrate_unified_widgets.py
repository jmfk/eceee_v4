"""
Comprehensive migration script for the Unified Widget System.

This command migrates existing widget data to the unified widget system format,
including data transformation, validation, and rollback capabilities.
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction, connection
from django.contrib.auth import get_user_model
from django.conf import settings

from webpages.models import WebPage, PageVersion
from webpages.widget_registry import widget_type_registry

User = get_user_model()
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Migrate existing widget data to unified widget system"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.migration_stats = {
            "pages_processed": 0,
            "pages_migrated": 0,
            "widgets_migrated": 0,
            "errors": [],
            "warnings": [],
        }
        self.backup_data = {"timestamp": datetime.now().isoformat(), "pages": []}

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be migrated without making changes",
        )

        parser.add_argument(
            "--batch-size",
            type=int,
            default=50,
            help="Number of pages to process in each batch",
        )

        parser.add_argument(
            "--page-ids",
            nargs="+",
            type=int,
            help="Specific page IDs to migrate (optional)",
        )

        parser.add_argument(
            "--backup-file",
            type=str,
            default="widget_migration_backup.json",
            help="Path to backup file",
        )

        parser.add_argument(
            "--validate-only",
            action="store_true",
            help="Only validate existing data without migrating",
        )

        parser.add_argument(
            "--force",
            action="store_true",
            help="Force migration even if validation fails",
        )

        parser.add_argument(
            "--rollback", type=str, help="Rollback from specified backup file"
        )

    def handle(self, *args, **options):
        """Main command handler."""
        try:
            if options["rollback"]:
                return self.handle_rollback(options["rollback"])

            if options["validate_only"]:
                return self.validate_existing_data(options)

            return self.migrate_widgets(options)

        except Exception as e:
            logger.exception("Migration failed")
            raise CommandError(f"Migration failed: {e}")

    def migrate_widgets(self, options: Dict[str, Any]) -> None:
        """Main migration logic."""
        dry_run = options["dry_run"]
        batch_size = options["batch_size"]
        page_ids = options.get("page_ids")
        backup_file = options["backup_file"]
        force = options["force"]

        if dry_run:
            self.stdout.write(
                self.style.WARNING("🔍 DRY RUN MODE - No changes will be made")
            )

        # Get pages to migrate
        pages_query = WebPage.objects.all()
        if page_ids:
            pages_query = pages_query.filter(id__in=page_ids)

        # Filter pages that need migration
        pages_to_migrate = []
        for page in pages_query:
            if self.needs_migration(page):
                pages_to_migrate.append(page)

        total_pages = len(pages_to_migrate)

        if total_pages == 0:
            self.stdout.write(self.style.SUCCESS("✅ No pages need migration"))
            return

        self.stdout.write(f"📊 Found {total_pages} pages requiring migration")

        # Validate before migrating
        if not force:
            validation_errors = self.validate_migration_readiness(pages_to_migrate)
            if validation_errors:
                self.stdout.write(self.style.ERROR("❌ Validation failed:"))
                for error in validation_errors:
                    self.stdout.write(f"  - {error}")

                if not dry_run:
                    raise CommandError("Migration aborted due to validation errors")

        # Create backup
        if not dry_run:
            self.create_backup(pages_to_migrate, backup_file)

        # Process pages in batches
        for i in range(0, total_pages, batch_size):
            batch = pages_to_migrate[i : i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total_pages + batch_size - 1) // batch_size

            self.stdout.write(
                f"🔄 Processing batch {batch_num}/{total_batches} "
                f"({len(batch)} pages)..."
            )

            if not dry_run:
                with transaction.atomic():
                    self.migrate_batch(batch, dry_run)
            else:
                self.migrate_batch(batch, dry_run)

        # Print migration summary
        self.print_migration_summary()

    def needs_migration(self, page: WebPage) -> bool:
        """Check if a page needs migration."""
        current_version = page.get_current_version()
        if not current_version or not current_version.widgets:
            return False

        # Check for legacy widget format indicators
        for widget_data in current_version.widgets:
            if self.is_legacy_format(widget_data):
                return True

        return False

    def is_legacy_format(self, widget_data: Dict[str, Any]) -> bool:
        """Check if widget data is in legacy format."""
        legacy_indicators = [
            "widget_type_id",  # Old database ID reference
            "json_config",  # Old configuration format
            "sort_order",  # Old ordering field
            "widget_type_name",  # Old string reference format
        ]

        return any(key in widget_data for key in legacy_indicators)

    def validate_migration_readiness(self, pages: List[WebPage]) -> List[str]:
        """Validate that migration can proceed safely."""
        errors = []

        # Check widget registry is available
        try:
            widget_types = widget_type_registry.get_all_widgets()
            if not widget_types:
                errors.append("Widget registry is empty or unavailable")
        except Exception as e:
            errors.append(f"Widget registry error: {e}")

        # Check database connectivity
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception as e:
            errors.append(f"Database connection error: {e}")

        # Validate sample of pages
        sample_size = min(10, len(pages))
        for page in pages[:sample_size]:
            page_errors = self.validate_page_migration(page)
            errors.extend(page_errors)

        return errors

    def validate_page_migration(self, page: WebPage) -> List[str]:
        """Validate migration for a specific page."""
        errors = []
        current_version = page.get_current_version()

        if not current_version:
            errors.append(f"Page {page.id} has no current version")
            return errors

        if not current_version.widgets:
            return errors  # No widgets to migrate

        for i, widget_data in enumerate(current_version.widgets):
            try:
                migrated_widget = self.migrate_widget_data(widget_data, page)

                # Validate migrated widget
                validation_errors = self.validate_migrated_widget(migrated_widget)
                if validation_errors:
                    errors.extend(
                        [
                            f"Page {page.id}, widget {i}: {error}"
                            for error in validation_errors
                        ]
                    )

            except Exception as e:
                errors.append(f"Page {page.id}, widget {i}: Migration failed - {e}")

        return errors

    def migrate_batch(self, pages: List[WebPage], dry_run: bool) -> None:
        """Migrate a batch of pages."""
        for page in pages:
            try:
                self.migration_stats["pages_processed"] += 1

                if self.migrate_page(page, dry_run):
                    self.migration_stats["pages_migrated"] += 1

            except Exception as e:
                error_msg = f"Failed to migrate page {page.id}: {e}"
                self.migration_stats["errors"].append(error_msg)
                logger.error(error_msg, exc_info=True)

    def migrate_page(self, page: WebPage, dry_run: bool) -> bool:
        """Migrate widgets for a single page."""
        current_version = page.get_current_version()

        if not current_version or not current_version.widgets:
            return False

        migrated_widgets = []
        migration_needed = False

        for widget_data in current_version.widgets:
            if self.is_legacy_format(widget_data):
                try:
                    migrated_widget = self.migrate_widget_data(widget_data, page)
                    migrated_widgets.append(migrated_widget)
                    migration_needed = True
                    self.migration_stats["widgets_migrated"] += 1

                except Exception as e:
                    error_msg = f"Failed to migrate widget in page {page.id}: {e}"
                    self.migration_stats["errors"].append(error_msg)
                    logger.error(error_msg)
                    # Keep original widget data on error
                    migrated_widgets.append(widget_data)
            else:
                # Widget already in new format
                migrated_widgets.append(widget_data)

        if migration_needed:
            if dry_run:
                self.stdout.write(
                    f"🔄 Would migrate page: {page.title} (ID: {page.id})"
                )
            else:
                current_version.widgets = migrated_widgets
                current_version.save()
                self.stdout.write(f"✅ Migrated page: {page.title} (ID: {page.id})")

        return migration_needed

    def migrate_widget_data(
        self, widget_data: Dict[str, Any], page: WebPage
    ) -> Dict[str, Any]:
        """Migrate individual widget data to new format."""
        migrated = widget_data.copy()

        # Generate unique ID if missing
        if "id" not in migrated:
            migrated["id"] = str(uuid.uuid4())

        # Migrate widget type reference
        if "widget_type_id" in widget_data:
            # Convert old database ID to new slug-based reference
            widget_type = self.get_widget_type_by_legacy_id(
                widget_data["widget_type_id"]
            )
            if widget_type:
                migrated["type"] = widget_type.name
                migrated["type_slug"] = widget_type.slug
                del migrated["widget_type_id"]
            else:
                raise ValueError(
                    f"Unknown widget type ID: {widget_data['widget_type_id']}"
                )

        # Migrate widget type name reference
        elif "widget_type_name" in widget_data:
            # Convert old name reference to new format
            widget_type = self.get_widget_type_by_legacy_name(
                widget_data["widget_type_name"]
            )
            if widget_type:
                migrated["type"] = widget_type.name
                migrated["type_slug"] = widget_type.slug
                del migrated["widget_type_name"]
            else:
                raise ValueError(
                    f"Unknown widget type name: {widget_data['widget_type_name']}"
                )

        # Migrate configuration format
        if "json_config" in widget_data:
            try:
                config = json.loads(widget_data["json_config"])
                migrated["config"] = config
                del migrated["json_config"]
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON configuration: {e}")

        # Migrate ordering field
        if "sort_order" in widget_data:
            migrated["order"] = widget_data["sort_order"]
            del migrated["sort_order"]

        # Ensure required fields exist with defaults
        if "slot" not in migrated:
            migrated["slot"] = "main"  # Default slot

        if "order" not in migrated:
            migrated["order"] = 0

        if "config" not in migrated:
            migrated["config"] = {}

        # Apply widget type defaults to configuration
        if "type_slug" in migrated:
            widget_type = widget_type_registry.get_widget(migrated["type_slug"])
            if widget_type and hasattr(widget_type, "configuration_defaults"):
                defaults = widget_type.configuration_defaults or {}
                for key, default_value in defaults.items():
                    if key not in migrated["config"]:
                        migrated["config"][key] = default_value

        return migrated

    def get_widget_type_by_legacy_id(self, widget_type_id: int) -> Optional[Any]:
        """Get widget type by legacy database ID."""
        # This mapping would be based on your actual legacy data
        # You may need to query the old widget_type table or use a predefined mapping
        legacy_id_mapping = {
            1: "text-block",
            2: "image",
            3: "button",
            4: "gallery",
            5: "html-block",
            6: "spacer",
            # Add more mappings as needed
        }

        slug = legacy_id_mapping.get(widget_type_id)
        if slug:
            return widget_type_registry.get_widget(slug)

        return None

    def get_widget_type_by_legacy_name(self, widget_type_name: str) -> Optional[Any]:
        """Get widget type by legacy name."""
        # Mapping of old names to new slugs
        legacy_name_mapping = {
            "TextBlock": "text-block",
            "Text Block": "text-block",
            "ImageWidget": "image",
            "Image Widget": "image",
            "ButtonWidget": "button",
            "Button Widget": "button",
            "GalleryWidget": "gallery",
            "Gallery Widget": "gallery",
            "HTMLBlock": "html-block",
            "HTML Block": "html-block",
            "SpacerWidget": "spacer",
            "Spacer Widget": "spacer",
            # Add more mappings as needed
        }

        slug = legacy_name_mapping.get(widget_type_name)
        if slug:
            return widget_type_registry.get_widget(slug)

        # Try direct slug lookup
        return widget_type_registry.get_widget(
            widget_type_name.lower().replace(" ", "-")
        )

    def validate_migrated_widget(self, widget_data: Dict[str, Any]) -> List[str]:
        """Validate migrated widget data."""
        errors = []

        # Check required fields
        required_fields = ["id", "type", "type_slug", "slot", "order", "config"]
        for field in required_fields:
            if field not in widget_data:
                errors.append(f"Missing required field: {field}")

        # Validate widget type exists
        if "type_slug" in widget_data:
            widget_type = widget_type_registry.get_widget(widget_data["type_slug"])
            if not widget_type:
                errors.append(f"Widget type not found: {widget_data['type_slug']}")
            else:
                # Validate configuration against schema
                try:
                    widget_type.validate_configuration(widget_data["config"])
                except Exception as e:
                    errors.append(f"Configuration validation failed: {e}")

        return errors

    def create_backup(self, pages: List[WebPage], backup_file: str) -> None:
        """Create backup of existing data before migration."""
        self.stdout.write("💾 Creating backup...")

        for page in pages:
            current_version = page.get_current_version()
            if current_version:
                self.backup_data["pages"].append(
                    {
                        "id": page.id,
                        "title": page.title,
                        "slug": page.slug,
                        "version_id": current_version.id,
                        "widgets": current_version.widgets,
                    }
                )

        try:
            with open(backup_file, "w") as f:
                json.dump(self.backup_data, f, indent=2)

            self.stdout.write(f"✅ Backup created: {backup_file}")

        except Exception as e:
            raise CommandError(f"Failed to create backup: {e}")

    def handle_rollback(self, backup_file: str) -> None:
        """Handle rollback from backup file."""
        self.stdout.write(f"🔄 Rolling back from backup: {backup_file}")

        try:
            with open(backup_file, "r") as f:
                backup_data = json.load(f)
        except FileNotFoundError:
            raise CommandError(f"Backup file not found: {backup_file}")
        except json.JSONDecodeError:
            raise CommandError(f"Invalid backup file format: {backup_file}")

        rollback_count = 0

        with transaction.atomic():
            for page_data in backup_data["pages"]:
                try:
                    page = WebPage.objects.get(id=page_data["id"])
                    current_version = page.get_current_version()

                    if current_version:
                        current_version.widgets = page_data["widgets"]
                        current_version.save()
                        rollback_count += 1

                        self.stdout.write(f"✅ Rolled back page: {page.title}")

                except WebPage.DoesNotExist:
                    self.stdout.write(
                        self.style.WARNING(f'⚠️  Page {page_data["id"]} not found')
                    )
                    continue
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f'❌ Error rolling back page {page_data["id"]}: {e}'
                        )
                    )
                    continue

        self.stdout.write(
            self.style.SUCCESS(f"✅ Rollback complete: {rollback_count} pages restored")
        )

    def validate_existing_data(self, options: Dict[str, Any]) -> None:
        """Validate existing data without migrating."""
        self.stdout.write("🔍 Validating existing widget data...")

        page_ids = options.get("page_ids")
        pages_query = WebPage.objects.all()
        if page_ids:
            pages_query = pages_query.filter(id__in=page_ids)

        validation_results = {
            "total_pages": 0,
            "pages_with_widgets": 0,
            "pages_needing_migration": 0,
            "valid_widgets": 0,
            "invalid_widgets": 0,
            "missing_widget_types": set(),
            "configuration_errors": [],
        }

        for page in pages_query:
            validation_results["total_pages"] += 1
            current_version = page.get_current_version()

            if not current_version or not current_version.widgets:
                continue

            validation_results["pages_with_widgets"] += 1

            if self.needs_migration(page):
                validation_results["pages_needing_migration"] += 1

            for widget_data in current_version.widgets:
                if self.validate_widget_data(widget_data, validation_results):
                    validation_results["valid_widgets"] += 1
                else:
                    validation_results["invalid_widgets"] += 1

        self.print_validation_report(validation_results)

    def validate_widget_data(
        self, widget_data: Dict[str, Any], results: Dict[str, Any]
    ) -> bool:
        """Validate individual widget data."""
        # If it's legacy format, try to migrate and validate
        if self.is_legacy_format(widget_data):
            try:
                # Create a dummy page for migration testing
                dummy_page = WebPage(id=0, title="Test", slug="test")
                migrated_widget = self.migrate_widget_data(widget_data, dummy_page)
                errors = self.validate_migrated_widget(migrated_widget)

                if errors:
                    results["configuration_errors"].extend(errors)
                    return False

                return True

            except Exception as e:
                results["configuration_errors"].append(f"Migration failed: {e}")
                return False
        else:
            # Validate current format
            errors = self.validate_migrated_widget(widget_data)
            if errors:
                results["configuration_errors"].extend(errors)
                return False

            return True

    def print_validation_report(self, results: Dict[str, Any]) -> None:
        """Print validation report."""
        self.stdout.write("\n📊 Validation Report")
        self.stdout.write("=" * 40)
        self.stdout.write(f'Total pages: {results["total_pages"]}')
        self.stdout.write(f'Pages with widgets: {results["pages_with_widgets"]}')
        self.stdout.write(
            f'Pages needing migration: {results["pages_needing_migration"]}'
        )
        self.stdout.write(f'Valid widgets: {results["valid_widgets"]}')
        self.stdout.write(f'Invalid widgets: {results["invalid_widgets"]}')

        if results["missing_widget_types"]:
            self.stdout.write("\n❌ Missing widget types:")
            for widget_type in results["missing_widget_types"]:
                self.stdout.write(f"  - {widget_type}")

        if results["configuration_errors"]:
            self.stdout.write("\n❌ Configuration errors:")
            for error in results["configuration_errors"][:10]:  # Show first 10
                self.stdout.write(f"  - {error}")

            if len(results["configuration_errors"]) > 10:
                remaining = len(results["configuration_errors"]) - 10
                self.stdout.write(f"  ... and {remaining} more errors")

        if results["invalid_widgets"] == 0:
            self.stdout.write("\n✅ All widgets are valid!")
        else:
            self.stdout.write(
                f'\n⚠️  {results["invalid_widgets"]} widgets need attention'
            )

    def print_migration_summary(self) -> None:
        """Print migration summary."""
        stats = self.migration_stats

        self.stdout.write("\n📊 Migration Summary")
        self.stdout.write("=" * 40)
        self.stdout.write(f'Pages processed: {stats["pages_processed"]}')
        self.stdout.write(f'Pages migrated: {stats["pages_migrated"]}')
        self.stdout.write(f'Widgets migrated: {stats["widgets_migrated"]}')
        self.stdout.write(f'Errors: {len(stats["errors"])}')
        self.stdout.write(f'Warnings: {len(stats["warnings"])}')

        if stats["errors"]:
            self.stdout.write("\n❌ Errors encountered:")
            for error in stats["errors"][:5]:  # Show first 5 errors
                self.stdout.write(f"  - {error}")

            if len(stats["errors"]) > 5:
                remaining = len(stats["errors"]) - 5
                self.stdout.write(f"  ... and {remaining} more errors")

        if stats["warnings"]:
            self.stdout.write("\n⚠️  Warnings:")
            for warning in stats["warnings"][:5]:  # Show first 5 warnings
                self.stdout.write(f"  - {warning}")

        success_rate = (
            (stats["pages_migrated"] / stats["pages_processed"] * 100)
            if stats["pages_processed"] > 0
            else 0
        )

        if success_rate == 100:
            self.stdout.write(
                f"\n✅ Migration completed successfully! (100% success rate)"
            )
        elif success_rate >= 90:
            self.stdout.write(
                f"\n🟡 Migration mostly successful ({success_rate:.1f}% success rate)"
            )
        else:
            self.stdout.write(
                f"\n❌ Migration had significant issues ({success_rate:.1f}% success rate)"
            )

        self.stdout.write("\n" + "=" * 40)
