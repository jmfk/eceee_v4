"""
Base migrator class with common utilities for all migration scripts.
"""

import logging
from django.db import transaction
from django.contrib.auth.models import User
from content.models import Namespace, Tag
from django.utils.text import slugify

logger = logging.getLogger(__name__)


class BaseMigrator:
    """Base class for all migrators with common functionality"""

    def __init__(self, dry_run=False):
        """
        Initialize migrator

        Args:
            dry_run: If True, perform migrations in a rolled-back transaction
        """
        self.dry_run = dry_run
        self.stats = {
            "created": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 0,
        }

    def get_or_create_default_namespace(self):
        """Get or create the default namespace"""
        try:
            namespace = Namespace.get_default()
            if namespace:
                logger.info(f"Using default namespace: {namespace.name}")
                return namespace

            # Create default namespace if it doesn't exist
            logger.warning("Default namespace not found, creating one")
            namespace = Namespace.objects.create(
                name="default",
                slug="default",
                is_default=True,
                description="Default namespace for migrated content",
            )
            logger.info(f"Created default namespace: {namespace.name}")
            return namespace
        except Exception as e:
            logger.error(f"Error getting/creating default namespace: {e}")
            raise

    def get_or_create_tag(self, name, namespace=None):
        """
        Get or create a tag with the given name

        Args:
            name: Tag name (will be normalized)
            namespace: Namespace object (uses default if None)

        Returns:
            tuple: (tag, created) where created is True if tag was created
        """
        if not name or not name.strip():
            return None, False

        # Normalize name
        normalized_name = name.strip()

        # Use default namespace if none provided
        if not namespace:
            namespace = self.get_or_create_default_namespace()

        try:
            tag, created = Tag.get_or_create_tag(normalized_name, namespace=namespace)
            if created:
                logger.debug(f"Created tag: {tag.name}")
            else:
                logger.debug(f"Found existing tag: {tag.name}")
            return tag, created
        except Exception as e:
            logger.error(f"Error creating tag '{normalized_name}': {e}")
            return None, False

    def merge_duplicate_tags(self, namespace=None):
        """
        Merge tags with similar names (case-insensitive, handling plurals, etc.)

        Args:
            namespace: Namespace to search in (uses default if None)

        Returns:
            dict: Statistics about merged tags
        """
        if not namespace:
            namespace = self.get_or_create_default_namespace()

        merged_stats = {"total_merged": 0, "groups": 0}

        # Get all tags in namespace
        tags = Tag.objects.filter(namespace=namespace).order_by("name")

        # Group tags by normalized slug
        slug_groups = {}
        for tag in tags:
            slug = slugify(tag.name.lower())
            if slug not in slug_groups:
                slug_groups[slug] = []
            slug_groups[slug].append(tag)

        # Merge groups with multiple tags
        for slug, tag_list in slug_groups.items():
            if len(tag_list) > 1:
                # Keep the one with highest usage_count
                keeper = max(tag_list, key=lambda t: (t.usage_count, t.id))
                logger.info(f"Merging {len(tag_list)} tags into '{keeper.name}':")

                for tag in tag_list:
                    if tag.id != keeper.id:
                        logger.info(
                            f"  - Merging '{tag.name}' (usage: {tag.usage_count})"
                        )
                        # Update keeper's usage count
                        keeper.usage_count += tag.usage_count
                        keeper.save()

                        # TODO: Update references when we have tag relationships
                        # This will be done when we migrate content

                        # Delete the duplicate
                        if not self.dry_run:
                            tag.delete()

                        merged_stats["total_merged"] += 1

                merged_stats["groups"] += 1

        logger.info(
            f"Merged {merged_stats['total_merged']} tags into {merged_stats['groups']} groups"
        )
        return merged_stats

    def get_migration_user(self):
        """
        Get or create a system user for migration operations

        Returns:
            User: The migration user
        """
        username = "migration_system"
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": "migration@eceee.org",
                "first_name": "Migration",
                "last_name": "System",
                "is_active": False,  # System user, not for login
            },
        )
        if created:
            logger.info(f"Created migration system user: {username}")
        return user

    def log_stats(self):
        """Log current migration statistics"""
        logger.info("Migration Statistics:")
        for key, value in self.stats.items():
            logger.info(f"  {key.capitalize()}: {value}")

    def run(self):
        """
        Run the migration. Should be overridden by subclasses.
        """
        raise NotImplementedError("Subclasses must implement run()")
