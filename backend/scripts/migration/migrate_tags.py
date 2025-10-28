"""
Tag Migration Script

Migrates all tags from the legacy system to the new Tag model with default namespace.
Focus on three critical tag types:
1. Normal Tags (eceee_category, keywords, etc.)
2. News Tags (news_type, news_category, news_source)
3. Related News (relationships between news items)

Usage:
    python manage.py shell
    >>> from scripts.migration.migrate_tags import TagMigrator
    >>> migrator = TagMigrator(dry_run=True)
    >>> migrator.run()
"""

import logging
from django.db import transaction
from .base_migrator import BaseMigrator
from content.models import Tag

logger = logging.getLogger(__name__)


class TagMigrator(BaseMigrator):
    """Migrates tags from legacy system to new Tag model"""

    def __init__(self, dry_run=False):
        super().__init__(dry_run)
        self.namespace = None
        self.tag_mapping = {}  # Maps old tag IDs to new Tag objects

    def run(self):
        """Run the complete tag migration"""

        try:
            with transaction.atomic():
                # Step 1: Get or create default namespace
                self.namespace = self.get_or_create_default_namespace()

                # Step 2: Migrate normal tags (eceee_category, keywords)
                self.migrate_normal_tags()

                # Step 3: Migrate news-specific tags
                self.migrate_news_tags()

                # Step 4: Migrate related news relationships
                self.migrate_related_news()

                # Step 5: Merge duplicate tags
                merge_stats = self.merge_duplicate_tags(self.namespace)

                # Step 6: Log final statistics
                self.log_stats()

                if self.dry_run:
                    logger.warning("DRY RUN - Rolling back all changes")
                    raise Exception("Dry run - rolling back")


        except Exception as e:
            if not self.dry_run or str(e) != "Dry run - rolling back":
                logger.error(f"Migration failed: {e}")
                raise
            else:

    def migrate_normal_tags(self):
        """
        Migrate normal tags (eceee_category, keywords, etc.)

        This function should be customized based on your legacy schema.
        Example assumes you have tables like:
        - eceeeKeyword
        - AssignedeceeeKeyword
        - eceeeCategory
        - AssignedeceeeCategory
        """

        # TODO: Implement based on your actual legacy schema
        # Example structure:

        # try:
        #     # Get all keywords from legacy system
        #     from your_legacy_app.models import eceeeKeyword
        #
        #     keywords = eceeeKeyword.objects.all()
        #
        #     for keyword in keywords:
        #         tag, created = self.get_or_create_tag(
        #             name=keyword.title,  # or keyword.name
        #             namespace=self.namespace
        #         )
        #
        #         if tag:
        #             # Store mapping for later use in content migration
        #             self.tag_mapping[f"keyword_{keyword.id}"] = tag
        #
        #             if created:
        #                 self.stats['created'] += 1
        #             else:
        #                 self.stats['skipped'] += 1
        #
        # except ImportError:
        #     logger.warning("Legacy eceeeKeyword model not found - skipping")
        # except Exception as e:
        #     logger.error(f"Error migrating keywords: {e}")
        #     self.stats['errors'] += 1

        # For now, log a placeholder message

    def migrate_news_tags(self):
        """
        Migrate news-specific tags (NewsType, NewsCategory, NewsSource)

        This function should be customized based on your legacy schema.
        Example assumes you have tables like:
        - eceeeNewsType
        - eceeeNewsCategory
        - eceeeNewsSource
        """

        # TODO: Implement based on your actual legacy schema
        # Example structure:

        # News Types
        # try:
        #     from your_legacy_app.models import eceeeNewsType
        #
        #     news_types = eceeeNewsType.objects.all()
        #
        #     for news_type in news_types:
        #         tag, created = self.get_or_create_tag(
        #             name=news_type.title,
        #             namespace=self.namespace
        #         )
        #
        #         if tag:
        #             self.tag_mapping[f"news_type_{news_type.id}"] = tag
        #
        #             if created:
        #                 self.stats['created'] += 1
        #             else:
        #                 self.stats['skipped'] += 1
        #
        # except ImportError:
        #     logger.warning("Legacy eceeeNewsType model not found - skipping")
        # except Exception as e:
        #     logger.error(f"Error migrating news types: {e}")
        #     self.stats['errors'] += 1

        # News Categories
        # Similar structure for eceeeNewsCategory

        # News Sources
        # Similar structure for eceeeNewsSource

        # For now, log a placeholder message

    def migrate_related_news(self):
        """
        Migrate RelatedNews relationships

        This function should be customized based on your legacy schema.
        Related news will be stored in ObjectInstance metadata
        """

        # TODO: Implement based on your actual legacy schema
        # Example structure:

        # try:
        #     from your_legacy_app.models import RelatedNews
        #
        #     relationships = RelatedNews.objects.all()
        #
        #     # Store relationships for later use in news migration
        #     # These will be added to ObjectInstance.metadata['related_news']
        #
        #     for rel in relationships:
        #         # Store in mapping for use during news content migration
        #         if f"news_{rel.from_news_id}" not in self.tag_mapping:
        #             self.tag_mapping[f"news_{rel.from_news_id}"] = []
        #
        #         self.tag_mapping[f"news_{rel.from_news_id}"].append(rel.to_news_id)
        #         self.stats['created'] += 1
        #
        # except ImportError:
        #     logger.warning("Legacy RelatedNews model not found - skipping")
        # except Exception as e:
        #     logger.error(f"Error migrating related news: {e}")
        #     self.stats['errors'] += 1

        # For now, log a placeholder message

    def save_tag_mapping(self, filepath="tag_mapping.json"):
        """
        Save tag mapping to file for use in content migration

        Args:
            filepath: Path to save the mapping JSON file
        """
        import json

        # Convert Tag objects to IDs for JSON serialization
        serializable_mapping = {}
        for key, value in self.tag_mapping.items():
            if isinstance(value, Tag):
                serializable_mapping[key] = {
                    "id": value.id,
                    "name": value.name,
                    "slug": value.slug,
                }
            elif isinstance(value, list):
                serializable_mapping[key] = value

        with open(filepath, "w") as f:
            json.dump(serializable_mapping, f, indent=2)



def run_migration(dry_run=True):
    """
    Helper function to run the tag migration

    Args:
        dry_run: If True, run in dry-run mode (no changes committed)
    """
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    migrator = TagMigrator(dry_run=dry_run)
    migrator.run()

    if not dry_run:
        # Save mapping for content migration
        migrator.save_tag_mapping()

    return migrator


if __name__ == "__main__":
    # Run in dry-run mode by default
    run_migration(dry_run=True)
