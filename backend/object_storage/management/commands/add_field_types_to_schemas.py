"""
Management command to add fieldType to existing schema properties.
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from object_storage.models import ObjectTypeDefinition
from utils.schema_system import field_registry


class Command(BaseCommand):
    help = "Add fieldType to existing schema properties for hybrid JSON Schema support"

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
                f"{'[DRY RUN] ' if dry_run else ''}Adding fieldType to schema properties..."
            )
        )

        # Find all object types that need fieldType migration
        object_types_to_migrate = []

        for obj_type in ObjectTypeDefinition.objects.all():
            if obj_type.schema and "properties" in obj_type.schema:
                needs_migration = False

                for prop_name, prop_def in obj_type.schema["properties"].items():
                    if "fieldType" not in prop_def:
                        needs_migration = True
                        break

                if needs_migration:
                    object_types_to_migrate.append(obj_type)

        if not object_types_to_migrate:
            self.stdout.write(
                self.style.SUCCESS(
                    "✅ No object types need migration - all properties already have fieldType"
                )
            )
            return

        self.stdout.write(
            f"Found {len(object_types_to_migrate)} object types to migrate:"
        )

        for obj_type in object_types_to_migrate:
            props_count = len(obj_type.schema.get("properties", {}))
            self.stdout.write(
                f"  - {obj_type.label} ({obj_type.name}): {props_count} properties"
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

        # Get available field types for mapping
        available_field_types = field_registry.get_all_field_types()

        # Create type mapping from JSON Schema type to fieldType
        type_mapping = {}
        for field_key, field_info in available_field_types.items():
            json_type = field_info["json_schema_type"]
            if json_type not in type_mapping:
                type_mapping[json_type] = field_key

        with transaction.atomic():
            for obj_type in object_types_to_migrate:
                try:
                    updated_properties = {}
                    migration_log = []

                    for prop_name, prop_def in obj_type.schema["properties"].items():
                        updated_prop = prop_def.copy()

                        if "fieldType" not in updated_prop:
                            # Infer fieldType from existing type and format
                            json_type = updated_prop.get("type", "string")
                            format_hint = updated_prop.get("format", "")

                            # Smart mapping based on type and format
                            if json_type == "string":
                                if (
                                    format_hint == "textarea"
                                    or "rich" in prop_name.lower()
                                ):
                                    field_type = "rich_text"
                                elif format_hint == "date":
                                    field_type = "date"
                                elif format_hint == "date-time":
                                    field_type = "datetime"
                                elif format_hint == "email":
                                    field_type = "email"
                                elif format_hint == "uri" or "url" in prop_name.lower():
                                    field_type = "url"
                                elif "image" in prop_name.lower():
                                    field_type = "image"
                                elif "file" in prop_name.lower():
                                    field_type = "file"
                                elif "enum" in updated_prop:
                                    field_type = "choice"
                                else:
                                    field_type = "text"
                            elif json_type == "number" or json_type == "integer":
                                field_type = "number"
                            elif json_type == "boolean":
                                field_type = "boolean"
                            elif json_type == "array":
                                field_type = "multi_choice"
                            else:
                                field_type = "text"  # Default fallback

                            updated_prop["fieldType"] = field_type
                            migration_log.append(
                                f"{prop_name}: {json_type} -> {field_type}"
                            )

                        updated_properties[prop_name] = updated_prop

                    # Update the schema
                    obj_type.schema["properties"] = updated_properties
                    obj_type.save()

                    migrated_count += 1
                    self.stdout.write(f"✅ Migrated: {obj_type.label}")
                    for log_entry in migration_log:
                        self.stdout.write(f"    {log_entry}")

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
