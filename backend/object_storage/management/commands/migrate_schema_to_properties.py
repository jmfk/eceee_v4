"""
Management command to migrate existing object type schemas from 'fields' to 'properties' format.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from object_storage.models import ObjectTypeDefinition


class Command(BaseCommand):
    help = "Migrate existing object type schemas from 'fields' to 'properties' format"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be migrated without making changes",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        self.stdout.write(
            self.style.SUCCESS(
                f"{'[DRY RUN] ' if dry_run else ''}Migrating object type schemas from 'fields' to 'properties' format..."
            )
        )

        # Find all object types with old 'fields' format
        object_types_to_migrate = []

        for obj_type in ObjectTypeDefinition.objects.all():
            if (
                obj_type.schema
                and "fields" in obj_type.schema
                and "properties" not in obj_type.schema
            ):
                object_types_to_migrate.append(obj_type)

        if not object_types_to_migrate:
            self.stdout.write(
                self.style.SUCCESS(
                    "✅ No object types need migration - all are already using 'properties' format"
                )
            )
            return

        self.stdout.write(
            f"Found {len(object_types_to_migrate)} object types to migrate:"
        )

        for obj_type in object_types_to_migrate:
            fields_count = len(obj_type.schema.get("fields", []))
            self.stdout.write(
                f"  - {obj_type.label} ({obj_type.name}): {fields_count} fields"
            )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "\n[DRY RUN] Use --no-dry-run to actually perform the migration"
                )
            )
            return

        # Perform the migration
        migrated_count = 0

        with transaction.atomic():
            for obj_type in object_types_to_migrate:
                try:
                    # Convert fields array to properties array
                    old_fields = obj_type.schema.get("fields", [])

                    # Create new schema with properties
                    new_schema = {
                        **obj_type.schema,  # Keep other schema properties
                        "properties": old_fields,  # Move fields to properties
                    }

                    # Remove the old fields key
                    if "fields" in new_schema:
                        del new_schema["fields"]

                    # Update the object type
                    obj_type.schema = new_schema
                    obj_type.save()

                    migrated_count += 1
                    self.stdout.write(f"✅ Migrated: {obj_type.label}")

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f"❌ Failed to migrate {obj_type.label}: {str(e)}"
                        )
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n🎉 Migration completed! {migrated_count}/{len(object_types_to_migrate)} object types migrated successfully."
            )
        )

        if migrated_count < len(object_types_to_migrate):
            self.stdout.write(
                self.style.WARNING(
                    f"⚠️  {len(object_types_to_migrate) - migrated_count} object types failed to migrate. Check the errors above."
                )
            )
