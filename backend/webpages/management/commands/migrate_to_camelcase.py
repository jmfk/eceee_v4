"""
Management command to migrate all existing schemas and pageData from snake_case to camelCase.

This command:
1. Migrates PageDataSchema.schema fields to camelCase
2. Migrates PageVersion.page_data fields to camelCase
3. Migrates PageVersion.widgets fields to camelCase
4. Provides dry-run mode for safe testing
5. Creates backups before migration
6. Provides detailed progress reporting
"""

import json
import re
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
import logging

from webpages.models import PageDataSchema, PageVersion

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Migrate all schemas and pageData from snake_case to camelCase"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be migrated without making changes",
        )
        parser.add_argument(
            "--backup",
            action="store_true",
            help="Create JSON backup files before migration",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force migration even if no changes detected",
        )
        parser.add_argument(
            "--schemas-only",
            action="store_true",
            help="Only migrate PageDataSchema records",
        )
        parser.add_argument(
            "--pagedata-only",
            action="store_true",
            help="Only migrate PageVersion.page_data records",
        )
        parser.add_argument(
            "--widgets-only",
            action="store_true",
            help="Only migrate PageVersion.widgets records",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=100,
            help="Number of records to process in each batch (default: 100)",
        )

    def handle(self, *args, **options):
        self.dry_run = options["dry_run"]
        self.create_backup = options["backup"]
        self.force = options["force"]
        self.batch_size = options["batch_size"]

        # Determine what to migrate
        self.migrate_schemas = not (options["pagedata_only"] or options["widgets_only"])
        self.migrate_pagedata = not (options["schemas_only"] or options["widgets_only"])
        self.migrate_widgets = not (options["schemas_only"] or options["pagedata_only"])

        if self.dry_run:
            self.stdout.write(
                self.style.WARNING("🔍 DRY RUN MODE - No changes will be made")
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"🚀 Starting camelCase migration (batch size: {self.batch_size})"
            )
        )

        try:
            with transaction.atomic():
                stats = {
                    "schemas_migrated": 0,
                    "pagedata_migrated": 0,
                    "widgets_migrated": 0,
                    "schemas_total": 0,
                    "pagedata_total": 0,
                    "widgets_total": 0,
                }

                if self.create_backup and not self.dry_run:
                    self._create_backups()

                if self.migrate_schemas:
                    stats.update(self._migrate_schemas())

                if self.migrate_pagedata:
                    pagedata_stats = self._migrate_pagedata()
                    stats["pagedata_migrated"] = pagedata_stats["migrated"]
                    stats["pagedata_total"] = pagedata_stats["total"]

                if self.migrate_widgets:
                    widgets_stats = self._migrate_widgets()
                    stats["widgets_migrated"] = widgets_stats["migrated"]
                    stats["widgets_total"] = widgets_stats["total"]

                self._print_summary(stats)

                if self.dry_run:
                    # Rollback the transaction in dry-run mode
                    transaction.set_rollback(True)

        except Exception as e:
            logger.error(f"Migration failed: {str(e)}")
            raise CommandError(f"Migration failed: {str(e)}")

    def _create_backups(self):
        """Create JSON backup files before migration"""
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")

        self.stdout.write("📦 Creating backups...")

        # Backup schemas
        if self.migrate_schemas:
            schemas = list(PageDataSchema.objects.all().values())
            backup_file = f"pagedata_schemas_backup_{timestamp}.json"
            with open(backup_file, "w") as f:
                json.dump(schemas, f, cls=DjangoJSONEncoder, indent=2)
            self.stdout.write(f"   ✅ Schemas backed up to {backup_file}")

        # Backup page versions
        if self.migrate_pagedata or self.migrate_widgets:
            versions = list(PageVersion.objects.all().values())
            backup_file = f"page_versions_backup_{timestamp}.json"
            with open(backup_file, "w") as f:
                json.dump(versions, f, cls=DjangoJSONEncoder, indent=2)
            self.stdout.write(f"   ✅ Page versions backed up to {backup_file}")

    def _migrate_schemas(self):
        """Migrate PageDataSchema.schema fields to camelCase"""
        self.stdout.write("🔄 Migrating schemas...")

        queryset = PageDataSchema.objects.exclude(schema__isnull=True)
        total_count = queryset.count()
        migrated_count = 0

        for i in range(0, total_count, self.batch_size):
            batch = queryset[i : i + self.batch_size]

            for schema_obj in batch:
                if self._migrate_schema_object(schema_obj):
                    migrated_count += 1

            self.stdout.write(
                f"   📊 Processed {min(i + self.batch_size, total_count)}/{total_count} schemas"
            )

        return {"schemas_migrated": migrated_count, "schemas_total": total_count}

    def _migrate_pagedata(self):
        """Migrate PageVersion.page_data fields to camelCase"""
        self.stdout.write("🔄 Migrating pageData...")

        queryset = PageVersion.objects.exclude(page_data__isnull=True)
        total_count = queryset.count()
        migrated_count = 0

        for i in range(0, total_count, self.batch_size):
            batch = queryset[i : i + self.batch_size]

            for version in batch:
                if self._migrate_pagedata_object(version):
                    migrated_count += 1

            self.stdout.write(
                f"   📊 Processed {min(i + self.batch_size, total_count)}/{total_count} page versions"
            )

        return {"migrated": migrated_count, "total": total_count}

    def _migrate_widgets(self):
        """Migrate PageVersion.widgets fields to camelCase"""
        self.stdout.write("🔄 Migrating widgets...")

        queryset = PageVersion.objects.exclude(widgets__isnull=True)
        total_count = queryset.count()
        migrated_count = 0

        for i in range(0, total_count, self.batch_size):
            batch = queryset[i : i + self.batch_size]

            for version in batch:
                if self._migrate_widgets_object(version):
                    migrated_count += 1

            self.stdout.write(
                f"   📊 Processed {min(i + self.batch_size, total_count)}/{total_count} widget versions"
            )

        return {"migrated": migrated_count, "total": total_count}

    def _migrate_schema_object(self, schema_obj):
        """Migrate a single schema object"""
        original_schema = schema_obj.schema
        if not isinstance(original_schema, dict):
            return False

        migrated_schema = self._convert_schema_to_camelcase(original_schema)

        if migrated_schema != original_schema or self.force:
            if not self.dry_run:
                schema_obj.schema = migrated_schema
                schema_obj.save(update_fields=["schema"])

            if self.dry_run or self.force:
                self.stdout.write(
                    f"   🔄 Schema {schema_obj.id} ({schema_obj.name or 'unnamed'}): "
                    f"{'would be updated' if self.dry_run else 'updated'}"
                )
            return True
        return False

    def _migrate_pagedata_object(self, version):
        """Migrate a single pageData object"""
        original_data = version.page_data
        if not isinstance(original_data, dict):
            return False

        migrated_data = self._convert_dict_to_camelcase(original_data)

        if migrated_data != original_data or self.force:
            if not self.dry_run:
                version.page_data = migrated_data
                version.save(update_fields=["page_data"])

            if self.dry_run or self.force:
                self.stdout.write(
                    f"   🔄 PageData version {version.id}: "
                    f"{'would be updated' if self.dry_run else 'updated'}"
                )
            return True
        return False

    def _migrate_widgets_object(self, version):
        """Migrate a single widgets object"""
        original_widgets = version.widgets
        if not isinstance(original_widgets, dict):
            return False

        migrated_widgets = self._convert_widgets_to_camelcase(original_widgets)

        if migrated_widgets != original_widgets or self.force:
            if not self.dry_run:
                version.widgets = migrated_widgets
                version.save(update_fields=["widgets"])

            if self.dry_run or self.force:
                self.stdout.write(
                    f"   🔄 Widgets version {version.id}: "
                    f"{'would be updated' if self.dry_run else 'updated'}"
                )
            return True
        return False

    def _convert_schema_to_camelcase(self, schema):
        """Convert schema object to camelCase"""
        if not isinstance(schema, dict):
            return schema

        converted = {}
        for key, value in schema.items():
            if key == "properties" and isinstance(value, dict):
                # Convert property names to camelCase
                converted_properties = {}
                for prop_key, prop_value in value.items():
                    camel_key = self._snake_to_camel(prop_key)
                    converted_properties[camel_key] = prop_value
                converted["properties"] = converted_properties
            elif key == "required" and isinstance(value, list):
                # Convert required field names to camelCase
                converted["required"] = [self._snake_to_camel(field) for field in value]
            elif key in ["property_order", "propertyOrder"] and isinstance(value, list):
                # Convert property order field names to camelCase and use camelCase key
                converted["propertyOrder"] = [
                    self._snake_to_camel(field) for field in value
                ]
            elif key == "groups" and isinstance(value, dict):
                # Handle grouped schemas
                converted_groups = {}
                for group_key, group_data in value.items():
                    converted_groups[group_key] = self._convert_schema_to_camelcase(
                        group_data
                    )
                converted["groups"] = converted_groups
            else:
                # Convert key itself if it's property_order -> propertyOrder
                converted_key = "propertyOrder" if key == "property_order" else key
                converted[converted_key] = value

        return converted

    def _convert_dict_to_camelcase(self, obj):
        """Convert dictionary keys to camelCase recursively"""
        if not isinstance(obj, dict):
            return obj

        converted = {}
        for key, value in obj.items():
            camel_key = self._snake_to_camel(key)
            if isinstance(value, dict):
                converted[camel_key] = self._convert_dict_to_camelcase(value)
            elif isinstance(value, list):
                converted[camel_key] = [
                    (
                        self._convert_dict_to_camelcase(item)
                        if isinstance(item, dict)
                        else item
                    )
                    for item in value
                ]
            else:
                converted[camel_key] = value
        return converted

    def _convert_widgets_to_camelcase(self, widgets):
        """Convert widgets structure to camelCase"""
        if not isinstance(widgets, dict):
            return widgets

        converted = {}
        for slot_name, widget_list in widgets.items():
            if isinstance(widget_list, list):
                converted_widgets = []
                for widget in widget_list:
                    if isinstance(widget, dict):
                        converted_widget = self._convert_dict_to_camelcase(widget)
                        converted_widgets.append(converted_widget)
                    else:
                        converted_widgets.append(widget)
                converted[slot_name] = converted_widgets
            else:
                converted[slot_name] = widget_list
        return converted

    def _snake_to_camel(self, name):
        """Convert snake_case to camelCase"""
        if not isinstance(name, str) or "_" not in name:
            return name
        components = name.split("_")
        return components[0] + "".join(word.capitalize() for word in components[1:])

    def _print_summary(self, stats):
        """Print migration summary"""
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("📈 MIGRATION SUMMARY"))
        self.stdout.write("=" * 60)

        if self.migrate_schemas:
            self.stdout.write(
                f"📋 Schemas: {stats['schemas_migrated']}/{stats['schemas_total']} migrated"
            )

        if self.migrate_pagedata:
            self.stdout.write(
                f"📄 PageData: {stats['pagedata_migrated']}/{stats['pagedata_total']} migrated"
            )

        if self.migrate_widgets:
            self.stdout.write(
                f"🧩 Widgets: {stats['widgets_migrated']}/{stats['widgets_total']} migrated"
            )

        total_migrated = (
            stats["schemas_migrated"]
            + stats["pagedata_migrated"]
            + stats["widgets_migrated"]
        )

        if self.dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"\n🔍 DRY RUN: {total_migrated} records would be updated"
                )
            )
            self.stdout.write("Run without --dry-run to perform the actual migration")
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n✅ Successfully migrated {total_migrated} records!"
                )
            )

        self.stdout.write("=" * 60)
