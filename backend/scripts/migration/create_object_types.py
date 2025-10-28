"""
Create ObjectTypeDefinitions from JSON schemas

This script creates all ObjectTypeDefinition instances in the database
from the JSON schema files.

Usage:
    python manage.py shell
    >>> from scripts.migration.create_object_types import create_all_object_types
    >>> create_all_object_types(dry_run=True)  # Test first
    >>> create_all_object_types(dry_run=False)  # Create for real
"""

import json
import logging
from pathlib import Path
from django.db import transaction
from object_storage.models import ObjectTypeDefinition
from scripts.migration.base_migrator import BaseMigrator

logger = logging.getLogger(__name__)


# Schema configurations
SCHEMA_CONFIGS = [
    {
        "file": "news.json",
        "name": "news",
        "label": "News Article",
        "plural_label": "News Articles",
        "description": "News articles and announcements from various sources",
        "hierarchy_level": "both",
        "priority": 1,
    },
    {
        "file": "event.json",
        "name": "event",
        "label": "Event",
        "plural_label": "Events",
        "description": "Calendar events, conferences, workshops, and webinars",
        "hierarchy_level": "both",
        "priority": 2,
    },
    {
        "file": "job.json",
        "name": "job",
        "label": "Job Posting",
        "plural_label": "Job Postings",
        "description": "Job opportunities and career postings",
        "hierarchy_level": "both",
        "priority": 3,
    },
    {
        "file": "library_item.json",
        "name": "library_item",
        "label": "Library Item",
        "plural_label": "Library Items",
        "description": "Library documents, publications, and resources",
        "hierarchy_level": "both",
        "priority": 4,
    },
    {
        "file": "conference.json",
        "name": "conference",
        "label": "Conference",
        "plural_label": "Conferences",
        "description": "Academic and professional conferences",
        "hierarchy_level": "top_level_only",
        "priority": 5,
    },
    {
        "file": "conference_panel.json",
        "name": "conference_panel",
        "label": "Conference Panel",
        "plural_label": "Conference Panels",
        "description": "Panels and tracks within conferences",
        "hierarchy_level": "sub_object_only",
        "priority": 6,
    },
    {
        "file": "paper.json",
        "name": "paper",
        "label": "Paper",
        "plural_label": "Papers",
        "description": "Conference papers and proceedings",
        "hierarchy_level": "sub_object_only",
        "priority": 7,
    },
    {
        "file": "columnist.json",
        "name": "columnist",
        "label": "Columnist",
        "plural_label": "Columnists",
        "description": "Opinion columnists and regular contributors",
        "hierarchy_level": "both",
        "priority": 8,
    },
    {
        "file": "column.json",
        "name": "column",
        "label": "Column",
        "plural_label": "Columns",
        "description": "Opinion columns and editorial articles",
        "hierarchy_level": "both",
        "priority": 9,
    },
]


class ObjectTypeCreator(BaseMigrator):
    """Creates ObjectTypeDefinition instances from schemas"""

    def __init__(self, dry_run=False, schemas_dir=None):
        super().__init__(dry_run)

        if schemas_dir is None:
            # Default to schemas directory in migration folder
            current_dir = Path(__file__).parent
            self.schemas_dir = current_dir / "schemas"
        else:
            self.schemas_dir = Path(schemas_dir)

        if not self.schemas_dir.exists():
            raise FileNotFoundError(f"Schemas directory not found: {self.schemas_dir}")

        self.created_types = {}

    def load_schema(self, filename):
        """Load a JSON schema file"""
        schema_path = self.schemas_dir / filename

        if not schema_path.exists():
            raise FileNotFoundError(f"Schema file not found: {schema_path}")

        try:
            with open(schema_path, "r") as f:
                schema = json.load(f)
            return schema
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in {filename}: {e}")
            raise

    def create_object_type(self, config):
        """Create a single ObjectTypeDefinition"""
        name = config["name"]

        # Check if already exists
        existing = ObjectTypeDefinition.objects.filter(name=name).first()
        if existing:
            logger.warning(
                f"ObjectTypeDefinition '{name}' already exists (ID: {existing.id})"
            )
            self.stats["skipped"] += 1
            return existing

        # Load schema
        try:
            schema = self.load_schema(config["file"])
        except Exception as e:
            logger.error(f"Failed to load schema for '{name}': {e}")
            self.stats["errors"] += 1
            return None

        # Get migration user
        user = self.get_migration_user()

        # Get default namespace
        namespace = self.get_or_create_default_namespace()

        # Create ObjectTypeDefinition
        try:
            obj_type = ObjectTypeDefinition(
                name=config["name"],
                label=config["label"],
                plural_label=config["plural_label"],
                description=config["description"],
                schema=schema,
                hierarchy_level=config["hierarchy_level"],
                namespace=namespace,
                is_active=True,
                created_by=user,
            )

            # Validate before saving
            obj_type.full_clean()

            if not self.dry_run:
                obj_type.save()
            else:

            self.stats["created"] += 1
            return obj_type

        except Exception as e:
            logger.error(f"Failed to create ObjectTypeDefinition '{name}': {e}")
            self.stats["errors"] += 1
            return None

    def setup_parent_child_relationships(self):
        """Set up allowed_child_types relationships"""

        relationships = [
            ("conference", ["conference_panel"]),  # Conference can have panels
            ("conference_panel", ["paper"]),  # Panel can have papers
        ]

        for parent_name, child_names in relationships:
            try:
                parent = ObjectTypeDefinition.objects.get(name=parent_name)

                for child_name in child_names:
                    child = ObjectTypeDefinition.objects.get(name=child_name)

                    if not self.dry_run:
                        parent.allowed_child_types.add(child)
                    else:

            except ObjectTypeDefinition.DoesNotExist as e:
                logger.error(f"Failed to set up relationship: {e}")
                self.stats["errors"] += 1

    def run(self):
        """Create all ObjectTypeDefinitions"""

        try:
            with transaction.atomic():
                # Sort by priority
                sorted_configs = sorted(SCHEMA_CONFIGS, key=lambda x: x["priority"])

                # Create each object type
                for config in sorted_configs:
                    obj_type = self.create_object_type(config)
                    if obj_type:
                        self.created_types[config["name"]] = obj_type

                # Set up relationships
                if self.stats["created"] > 0:
                    self.setup_parent_child_relationships()

                # Log results
                self.log_stats()

                if self.dry_run:
                    logger.warning("\nDRY RUN - Rolling back all changes")
                    raise Exception("Dry run - rolling back")


        except Exception as e:
            if not self.dry_run or str(e) != "Dry run - rolling back":
                logger.error(f"Failed to create ObjectTypeDefinitions: {e}")
                raise
            else:

    def list_created_types(self):
        """List all created ObjectTypeDefinitions"""

        for name, obj_type in self.created_types.items():


def create_all_object_types(dry_run=True, schemas_dir=None):
    """
    Helper function to create all object types

    Args:
        dry_run: If True, run in dry-run mode (no changes committed)
        schemas_dir: Optional path to schemas directory

    Returns:
        ObjectTypeCreator instance
    """
    # Configure logging
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
    )

    creator = ObjectTypeCreator(dry_run=dry_run, schemas_dir=schemas_dir)
    creator.run()

    if not dry_run:
        creator.list_created_types()

    return creator


def verify_object_types():
    """Verify all object types were created correctly"""

    for config in SCHEMA_CONFIGS:
        try:
            obj_type = ObjectTypeDefinition.objects.get(name=config["name"])

            # Check schema is valid JSON
            if not isinstance(obj_type.schema, dict):
                logger.warning(f"   ⚠️  Schema is not a dictionary")

            # Check namespace
            if not obj_type.namespace:
                logger.warning(f"   ⚠️  No namespace assigned")

        except ObjectTypeDefinition.DoesNotExist:
            logger.error(f"❌ {config['label']:25} - NOT FOUND")



if __name__ == "__main__":
    # Run in dry-run mode by default
    create_all_object_types(dry_run=True)
