"""
Management command to migrate schemas to proper JSON Schema format with properties as object.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from object_storage.models import ObjectTypeDefinition


class Command(BaseCommand):
    help = "Migrate schemas to proper JSON Schema format with properties as object"

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
                f"{'[DRY RUN] ' if dry_run else ''}Migrating schemas to JSON Schema format..."
            )
        )

        # Find all object types that need migration
        object_types_to_migrate = []

        for obj_type in ObjectTypeDefinition.objects.all():
            if obj_type.schema:
                # Check if schema has properties as array (needs migration)
                if "properties" in obj_type.schema and isinstance(
                    obj_type.schema["properties"], list
                ):
                    object_types_to_migrate.append(obj_type)
                # Or if schema still has old fields format
                elif (
                    "fields" in obj_type.schema and "properties" not in obj_type.schema
                ):
                    object_types_to_migrate.append(obj_type)

        if not object_types_to_migrate:
            self.stdout.write(
                self.style.SUCCESS(
                    "✅ No object types need migration - all are already using proper JSON Schema format"
                )
            )
            return

        self.stdout.write(
            f"Found {len(object_types_to_migrate)} object types to migrate:"
        )

        for obj_type in object_types_to_migrate:
            if "fields" in obj_type.schema:
                fields_count = len(obj_type.schema.get("fields", []))
                self.stdout.write(
                    f"  - {obj_type.label} ({obj_type.name}): {fields_count} fields (old format)"
                )
            else:
                props_count = len(obj_type.schema.get("properties", []))
                self.stdout.write(
                    f"  - {obj_type.label} ({obj_type.name}): {props_count} properties (array format)"
                )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "\n[DRY RUN] Use without --dry-run to actually perform the migration"
                )
            )
            return

        # Perform the migration
        migrated_count = 0

        with transaction.atomic():
            for obj_type in object_types_to_migrate:
                try:
                    new_schema = {
                        "type": "object",
                        "properties": {},
                        "propertyOrder": [],
                        "required": [],
                    }

                    # Handle different source formats
                    if "fields" in obj_type.schema:
                        # Convert from old fields array format
                        for field in obj_type.schema.get("fields", []):
                            if "name" in field:
                                prop_name = field["name"]
                                prop_def = {
                                    k: v
                                    for k, v in field.items()
                                    if k != "name" and k != "required"
                                }

                                new_schema["properties"][prop_name] = prop_def
                                new_schema["propertyOrder"].append(prop_name)

                                if field.get("required", False):
                                    new_schema["required"].append(prop_name)

                    elif "properties" in obj_type.schema and isinstance(
                        obj_type.schema["properties"], list
                    ):
                        # Convert from properties array format
                        for prop in obj_type.schema["properties"]:
                            if "name" in prop:
                                prop_name = prop["name"]
                                prop_def = {
                                    k: v
                                    for k, v in prop.items()
                                    if k != "name" and k != "required"
                                }

                                new_schema["properties"][prop_name] = prop_def
                                new_schema["propertyOrder"].append(prop_name)

                                if prop.get("required", False):
                                    new_schema["required"].append(prop_name)

                    # Preserve other schema properties
                    for key, value in obj_type.schema.items():
                        if key not in [
                            "fields",
                            "properties",
                            "propertyOrder",
                            "required",
                            "type",
                        ]:
                            new_schema[key] = value

                    # Update the object type
                    obj_type.schema = new_schema
                    obj_type.save()

                    migrated_count += 1
                    props_count = len(new_schema["properties"])
                    self.stdout.write(
                        f"✅ Migrated: {obj_type.label} ({props_count} properties)"
                    )

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
