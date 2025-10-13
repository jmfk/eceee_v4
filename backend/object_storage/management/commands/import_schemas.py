"""
Django management command to import JSON schemas into ObjectTypeDefinitions.

This command:
- Imports JSON schemas from a directory
- Creates new ObjectTypeDefinitions or updates existing ones
- Handles both camelCase and snake_case property names (converts to camelCase)
- Validates schemas before import
- Provides detailed feedback on operations

Usage:
    python manage.py import_schemas --schemas-dir backend/scripts/migration/schemas
    python manage.py import_schemas --schemas-dir backend/scripts/migration/schemas --dry-run
    python manage.py import_schemas --file backend/scripts/migration/schemas/news.json --name news
"""

import json
import re
from pathlib import Path
from typing import Dict, Any, Optional, List

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from django.db import transaction
from django.utils.text import slugify

from object_storage.models import ObjectTypeDefinition


class Command(BaseCommand):
    help = "Import JSON schemas into ObjectTypeDefinitions (creates or updates)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--schemas-dir",
            type=str,
            help="Directory containing JSON schema files",
            default="scripts/migration/schemas",
        )
        parser.add_argument(
            "--file",
            type=str,
            help="Import a single schema file (requires --name). Path relative to Django project root.",
        )
        parser.add_argument(
            "--name",
            type=str,
            help="Object type name (required when using --file)",
        )
        parser.add_argument(
            "--label",
            type=str,
            help="Object type label (optional, derived from name if not provided)",
        )
        parser.add_argument(
            "--plural-label",
            type=str,
            help="Object type plural label (optional)",
        )
        parser.add_argument(
            "--description",
            type=str,
            help="Object type description (optional)",
        )
        parser.add_argument(
            "--hierarchy-level",
            type=str,
            choices=["top_level_only", "sub_object_only", "both"],
            default="both",
            help="Where this object type can appear in hierarchy",
        )
        parser.add_argument(
            "--user",
            type=str,
            help="Username to use as creator (defaults to first superuser)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without saving to database",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Update existing object types without confirmation",
        )
        parser.add_argument(
            "--convert-snake-case",
            action="store_true",
            default=True,
            help="Convert snake_case property names to camelCase (default: True)",
        )

    def handle(self, *args, **options):
        self.dry_run = options["dry_run"]
        self.force = options["force"]
        self.convert_snake_case = options["convert_snake_case"]

        # Get user
        self.user = self._get_user(options.get("user"))

        if self.dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be saved")
            )

        # Import single file or directory
        if options["file"]:
            if not options["name"]:
                raise CommandError("--name is required when using --file")
            self._import_single_schema(options)
        else:
            self._import_schemas_from_directory(options)

    def _get_user(self, username: Optional[str]) -> User:
        """Get user for created_by field"""
        if username:
            try:
                return User.objects.get(username=username)
            except User.DoesNotExist:
                raise CommandError(f'User "{username}" not found')

        user = User.objects.filter(is_superuser=True).first()
        if not user:
            raise CommandError(
                "No superuser found. Please create one first or specify --user"
            )
        return user

    def _import_single_schema(self, options: Dict[str, Any]):
        """Import a single schema file"""
        file_path = Path(options["file"])

        if not file_path.exists():
            raise CommandError(f"File not found: {file_path}")

        if not file_path.suffix == ".json":
            raise CommandError(f"File must be a JSON file: {file_path}")

        # Load schema
        schema = self._load_json_file(file_path)
        if not schema:
            return

        # Convert snake_case to camelCase if needed
        if self.convert_snake_case:
            schema = self._convert_schema_to_camel_case(schema)

        # Prepare object type data
        name = options["name"]
        label = options.get("label") or self._derive_label(name)
        plural_label = options.get("plural_label") or f"{label}s"
        description = options.get("description") or f"{label} objects"
        hierarchy_level = options.get("hierarchy_level", "both")

        # Create or update
        self._create_or_update_object_type(
            name=name,
            label=label,
            plural_label=plural_label,
            description=description,
            schema=schema,
            hierarchy_level=hierarchy_level,
            file_path=str(file_path),
        )

    def _import_schemas_from_directory(self, options: Dict[str, Any]):
        """Import all schema files from a directory"""
        schemas_dir = Path(options["schemas_dir"])

        if not schemas_dir.exists():
            raise CommandError(f"Directory not found: {schemas_dir}")

        if not schemas_dir.is_dir():
            raise CommandError(f"Not a directory: {schemas_dir}")

        # Find all JSON files
        json_files = sorted(schemas_dir.glob("*.json"))

        if not json_files:
            self.stdout.write(
                self.style.WARNING(f"No JSON files found in {schemas_dir}")
            )
            return

        self.stdout.write(f"\nFound {len(json_files)} schema file(s) in {schemas_dir}")

        # Import each schema
        success_count = 0
        error_count = 0
        skipped_count = 0

        for json_file in json_files:
            try:
                result = self._import_schema_from_file(json_file)
                if result == "success":
                    success_count += 1
                elif result == "skipped":
                    skipped_count += 1
            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(f"✗ Error processing {json_file.name}: {str(e)}")
                )

        # Summary
        self.stdout.write("\n" + "=" * 70)
        self.stdout.write(
            self.style.SUCCESS(f"✓ Successfully processed: {success_count}")
        )
        if skipped_count:
            self.stdout.write(self.style.WARNING(f"⊘ Skipped: {skipped_count}"))
        if error_count:
            self.stdout.write(self.style.ERROR(f"✗ Errors: {error_count}"))
        self.stdout.write("=" * 70)

    def _import_schema_from_file(self, file_path: Path) -> str:
        """Import schema from a single file. Returns 'success', 'skipped', or raises exception"""
        # Load schema
        schema = self._load_json_file(file_path)
        if not schema:
            return "skipped"

        # Convert snake_case to camelCase if needed
        if self.convert_snake_case:
            original_schema = json.dumps(schema, indent=2)
            schema = self._convert_schema_to_camel_case(schema)
            converted_schema = json.dumps(schema, indent=2)

            if original_schema != converted_schema:
                self.stdout.write(
                    self.style.WARNING(
                        f"  → Converted snake_case to camelCase in {file_path.name}"
                    )
                )

        # Derive object type name from filename
        name = file_path.stem  # filename without extension

        # Try to get metadata from schema's additionalInfo
        additional_info = schema.get("additionalInfo", {})
        label = self._derive_label(name)
        plural_label = f"{label}s"
        description = additional_info.get("description", f"{label} objects")

        # Determine hierarchy level from name patterns
        hierarchy_level = self._guess_hierarchy_level(name)

        # Create or update
        self._create_or_update_object_type(
            name=name,
            label=label,
            plural_label=plural_label,
            description=description,
            schema=schema,
            hierarchy_level=hierarchy_level,
            file_path=str(file_path),
        )

        return "success"

    def _load_json_file(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """Load and validate JSON file"""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Invalid JSON in {file_path.name}: {str(e)}")
            )
            return None
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Error reading {file_path.name}: {str(e)}")
            )
            return None

    def _convert_schema_to_camel_case(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Convert snake_case property names to camelCase"""
        if not isinstance(schema, dict):
            return schema

        # Don't convert if it's already in camelCase
        properties = schema.get("properties", {})
        if not properties:
            return schema

        # Check if conversion is needed
        needs_conversion = any("_" in key for key in properties.keys())
        if not needs_conversion:
            return schema

        # Create new schema with converted property names
        new_schema = schema.copy()
        new_properties = {}

        for key, value in properties.items():
            if "_" in key:
                new_key = self._snake_to_camel(key)
                new_properties[new_key] = value
            else:
                new_properties[key] = value

        new_schema["properties"] = new_properties

        # Update required array if present
        if "required" in new_schema and isinstance(new_schema["required"], list):
            new_schema["required"] = [
                self._snake_to_camel(field) if "_" in field else field
                for field in new_schema["required"]
            ]

        # Update propertyOrder array if present
        if "propertyOrder" in new_schema and isinstance(
            new_schema["propertyOrder"], list
        ):
            new_schema["propertyOrder"] = [
                self._snake_to_camel(field) if "_" in field else field
                for field in new_schema["propertyOrder"]
            ]

        return new_schema

    def _snake_to_camel(self, snake_str: str) -> str:
        """Convert snake_case to camelCase"""
        components = snake_str.split("_")
        return components[0] + "".join(x.title() for x in components[1:])

    def _derive_label(self, name: str) -> str:
        """Derive a human-readable label from object type name"""
        # Handle special cases
        labels = {
            "news": "News Article",
            "event": "Event",
            "job": "Job Posting",
            "library_item": "Library Item",
            "conference": "Conference",
            "conference_panel": "Conference Panel",
            "paper": "Paper",
            "columnist": "Columnist",
            "column": "Column",
        }

        if name in labels:
            return labels[name]

        # Default: Title case with underscores replaced
        return name.replace("_", " ").title()

    def _guess_hierarchy_level(self, name: str) -> str:
        """Guess appropriate hierarchy level from name"""
        # Conference panels and papers are sub-objects only
        if name in ["conference_panel", "paper"]:
            return "sub_object_only"

        # Conferences are typically top-level
        if name == "conference":
            return "top_level_only"

        # Default to both
        return "both"

    def _create_or_update_object_type(
        self,
        name: str,
        label: str,
        plural_label: str,
        description: str,
        schema: Dict[str, Any],
        hierarchy_level: str,
        file_path: str,
    ):
        """Create or update an ObjectTypeDefinition"""

        # Check if exists
        existing = ObjectTypeDefinition.objects.filter(name=name).first()

        if existing:
            action = "UPDATE"
            self.stdout.write(
                f"\n{self.style.WARNING('⟳')} {name} - Exists (will update)"
            )
        else:
            action = "CREATE"
            self.stdout.write(f"\n{self.style.SUCCESS('+')} {name} - New")

        # Display info
        self.stdout.write(f"  Label: {label}")
        self.stdout.write(f"  Plural: {plural_label}")
        self.stdout.write(f"  Description: {description}")
        self.stdout.write(f"  Hierarchy: {hierarchy_level}")
        self.stdout.write(f"  File: {file_path}")

        # Show schema field count
        field_count = len(schema.get("properties", {}))
        self.stdout.write(f"  Fields: {field_count}")

        # Show some field names
        if field_count > 0:
            field_names = list(schema.get("properties", {}).keys())[:5]
            fields_display = ", ".join(field_names)
            if field_count > 5:
                fields_display += f", ... ({field_count - 5} more)"
            self.stdout.write(f"  → {fields_display}")

        # Dry run - skip actual save
        if self.dry_run:
            self.stdout.write(self.style.WARNING(f"  [DRY RUN] Would {action}"))
            return

        # Confirm if updating and not forced
        if existing and not self.force:
            confirm = input(f"  Update existing '{name}'? [y/N]: ")
            if confirm.lower() != "y":
                self.stdout.write(self.style.WARNING(f"  Skipped"))
                return

        # Save to database
        try:
            with transaction.atomic():
                if existing:
                    # Update existing
                    existing.label = label
                    existing.plural_label = plural_label
                    existing.description = description
                    existing.schema = schema
                    existing.hierarchy_level = hierarchy_level
                    existing.save()
                    self.stdout.write(
                        self.style.SUCCESS(f"  ✓ Updated {name} (ID: {existing.id})")
                    )
                else:
                    # Create new
                    obj_type = ObjectTypeDefinition.objects.create(
                        name=name,
                        label=label,
                        plural_label=plural_label,
                        description=description,
                        schema=schema,
                        hierarchy_level=hierarchy_level,
                        is_active=True,
                        created_by=self.user,
                    )
                    self.stdout.write(
                        self.style.SUCCESS(f"  ✓ Created {name} (ID: {obj_type.id})")
                    )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ✗ Failed to save: {str(e)}"))
            raise
