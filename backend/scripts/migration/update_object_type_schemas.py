"""
Update ObjectTypeDefinition schemas from JSON files

This script updates existing ObjectTypeDefinition schemas with the latest
JSON schema files. Useful for adding new fields like object_reference.

Usage:
    python manage.py shell
    >>> from scripts.migration.update_object_type_schemas import update_schema, update_all_schemas

    # Update single type
    >>> update_schema('column')

    # Update all types
    >>> update_all_schemas()

    # Dry run (test first)
    >>> update_all_schemas(dry_run=True)
"""

import json
import logging
from pathlib import Path
from django.db import transaction
from object_storage.models import ObjectTypeDefinition

logger = logging.getLogger(__name__)


def get_schemas_dir():
    """Get the schemas directory path"""
    script_dir = Path(__file__).parent
    return script_dir / "schemas"


def load_schema_file(schema_name):
    """
    Load schema from JSON file

    Args:
        schema_name: Name of the schema file (without .json extension)

    Returns:
        dict: Parsed schema
    """
    schemas_dir = get_schemas_dir()
    schema_file = schemas_dir / f"{schema_name}.json"

    if not schema_file.exists():
        raise FileNotFoundError(f"Schema file not found: {schema_file}")

    with open(schema_file, "r") as f:
        schema = json.load(f)

    return schema


def update_schema(object_type_name, dry_run=False):
    """
    Update a single ObjectTypeDefinition schema from its JSON file

    Args:
        object_type_name: Name of the object type (e.g., 'column', 'columnist')
        dry_run: If True, don't save changes (just preview)

    Returns:
        ObjectTypeDefinition instance or None
    """
    logger.info(f"\n{'='*60}")
    logger.info(f"Updating schema for: {object_type_name}")
    logger.info(f"{'='*60}")

    # Get the object type
    try:
        obj_type = ObjectTypeDefinition.objects.get(name=object_type_name)
    except ObjectTypeDefinition.DoesNotExist:
        logger.error(
            f"❌ ObjectTypeDefinition '{object_type_name}' not found in database"
        )
        logger.info(f"   Create it first using create_object_types.py")
        return None

    # Load new schema
    try:
        new_schema = load_schema_file(object_type_name)
    except FileNotFoundError as e:
        logger.error(f"❌ {e}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON in schema file: {e}")
        return None

    # Show changes
    logger.info(
        f"\nCurrent schema properties: {len(obj_type.schema.get('properties', {}))}"
    )
    logger.info(f"New schema properties: {len(new_schema.get('properties', {}))}")

    old_fields = set(obj_type.schema.get("properties", {}).keys())
    new_fields = set(new_schema.get("properties", {}).keys())

    added = new_fields - old_fields
    removed = old_fields - new_fields

    if added:
        logger.info(f"✅ Fields to be added: {', '.join(added)}")
    if removed:
        logger.warning(f"⚠️  Fields to be removed: {', '.join(removed)}")
    if not added and not removed:
        logger.info("ℹ️  No field changes (properties are the same)")

    # Update the schema
    if dry_run:
        logger.info("\n🔍 DRY RUN - No changes saved")
        logger.info(f"Would update {obj_type.label} ({obj_type.name})")
    else:
        obj_type.schema = new_schema
        obj_type.save(update_fields=["schema"])
        logger.info(f"\n✅ Updated {obj_type.label} ({obj_type.name})")

    return obj_type


def update_all_schemas(dry_run=True, schema_names=None):
    """
    Update all ObjectTypeDefinition schemas from JSON files

    Args:
        dry_run: If True, don't save changes (just preview)
        schema_names: Optional list of schema names to update (defaults to all)

    Returns:
        dict: Statistics about the update
    """
    logger.info("\n" + "=" * 60)
    logger.info("Updating ObjectTypeDefinition Schemas from JSON")
    logger.info("=" * 60)
    logger.info(f"Mode: {'DRY RUN' if dry_run else 'LIVE UPDATE'}")

    # Default to all schema files
    if schema_names is None:
        schemas_dir = get_schemas_dir()
        schema_files = list(schemas_dir.glob("*.json"))
        # Filter out README and index files
        schema_names = [
            f.stem
            for f in schema_files
            if f.stem not in ["README", "SCHEMAS_INDEX", "SCHEMA_UPDATE_SUMMARY"]
        ]

    stats = {"total": len(schema_names), "updated": 0, "skipped": 0, "errors": 0}

    for schema_name in schema_names:
        try:
            result = update_schema(schema_name, dry_run=dry_run)
            if result:
                stats["updated"] += 1
            else:
                stats["skipped"] += 1
        except Exception as e:
            logger.error(f"❌ Error updating {schema_name}: {e}")
            stats["errors"] += 1

    # Print summary
    logger.info("\n" + "=" * 60)
    logger.info("Summary")
    logger.info("=" * 60)
    logger.info(f"Total schemas: {stats['total']}")
    logger.info(f"Updated: {stats['updated']}")
    logger.info(f"Skipped: {stats['skipped']}")
    logger.info(f"Errors: {stats['errors']}")

    if dry_run:
        logger.info("\n🔍 This was a DRY RUN - no changes were saved")
        logger.info("Run with dry_run=False to apply changes")
    else:
        logger.info("\n✅ All updates complete!")

    return stats


def show_schema_diff(object_type_name):
    """
    Show detailed diff between current and new schema

    Args:
        object_type_name: Name of the object type
    """
    try:
        obj_type = ObjectTypeDefinition.objects.get(name=object_type_name)
    except ObjectTypeDefinition.DoesNotExist:
        print(f"❌ ObjectTypeDefinition '{object_type_name}' not found")
        return

    try:
        new_schema = load_schema_file(object_type_name)
    except Exception as e:
        print(f"❌ Error loading schema: {e}")
        return

    print(f"\n{'='*60}")
    print(f"Schema Diff for: {obj_type.label}")
    print(f"{'='*60}\n")

    old_props = obj_type.schema.get("properties", {})
    new_props = new_schema.get("properties", {})

    all_fields = set(old_props.keys()) | set(new_props.keys())

    for field in sorted(all_fields):
        old_field = old_props.get(field)
        new_field = new_props.get(field)

        if field not in old_props:
            print(f"➕ NEW FIELD: {field}")
            print(f"   Type: {new_field.get('componentType')}")
            print(f"   Title: {new_field.get('title')}")
            print()
        elif field not in new_props:
            print(f"➖ REMOVED: {field}")
            print(f"   Was: {old_field.get('componentType')}")
            print()
        elif old_field != new_field:
            print(f"📝 MODIFIED: {field}")
            if old_field.get("componentType") != new_field.get("componentType"):
                print(
                    f"   Type: {old_field.get('componentType')} → {new_field.get('componentType')}"
                )

            # Check for new config options
            old_keys = set(old_field.keys())
            new_keys = set(new_field.keys())
            added_keys = new_keys - old_keys
            if added_keys:
                print(f"   New options: {', '.join(added_keys)}")
            print()


if __name__ == "__main__":
    # Configure logging for direct execution
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    print("\n" + "=" * 60)
    print("ObjectType Schema Updater")
    print("=" * 60)
    print("\nThis script updates existing ObjectTypeDefinition schemas")
    print("from JSON files in the schemas directory.")
    print("\nUsage:")
    print("  python manage.py shell")
    print("  >>> from scripts.migration.update_object_type_schemas import *")
    print("\nCommands:")
    print("  update_schema('column')              # Update single type")
    print("  update_all_schemas(dry_run=True)     # Test all updates")
    print("  update_all_schemas(dry_run=False)    # Apply all updates")
    print("  show_schema_diff('column')           # Show detailed diff")
    print("\n" + "=" * 60 + "\n")
