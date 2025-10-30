"""
Example: Customized Tag Migration with Real Legacy Models

This is an EXAMPLE showing how to customize migrate_tags.py for your actual legacy schema.
Copy the relevant parts to migrate_tags.py after reviewing your legacy models.

BEFORE USING:
1. Review your legacy model files in extracted_models/
2. Identify which apps/models contain your tag/category data
3. Update the imports and field names below
4. Copy customized code into migrate_tags.py
"""

import logging
from django.db import transaction
from scripts.migration.base_migrator import BaseMigrator
from content.models import Tag

logger = logging.getLogger(__name__)


class TagMigratorExample(BaseMigrator):
    """Example migrator showing real legacy model integration"""

    def __init__(self, dry_run=False):
        super().__init__(dry_run)
        self.namespace = None
        self.tag_mapping = {}

    def migrate_normal_tags(self):
        """Example: Migrate easy_category and keywords"""

        # EXAMPLE 1: Migrate eceeeCategory
        try:
            # Import your legacy model - UPDATE THIS PATH
            from base.models import Category

            categories = Category.objects.all()

            for category in categories:
                # Get the tag name - UPDATE FIELD NAME if different
                tag_name = category.title  # or category.name

                tag, created = self.get_or_create_tag(
                    name=tag_name, namespace=self.namespace
                )

                if tag:
                    # Store mapping: old_id -> new Tag
                    self.tag_mapping[f"category_{category.id}"] = tag

                    # Update usage count if you have it
                    # if hasattr(category, 'usage_count'):
                    #     tag.usage_count = category.usage_count
                    #     tag.save()

                    if created:
                        self.stats["created"] += 1
                    else:
                        self.stats["skipped"] += 1
                else:
                    self.stats["errors"] += 1

        except ImportError as e:
            logger.warning(f"Could not import eceeeCategory: {e}")
        except Exception as e:
            logger.error(f"Error migrating categories: {e}")
            self.stats["errors"] += 1

        # EXAMPLE 2: Migrate eceeeKeyword (Mezzanine keywords)
        try:
            from generic.models import Keyword  # or wherever Mezzanine keywords are

            keywords = Keyword.objects.all()

            for keyword in keywords:
                tag, created = self.get_or_create_tag(
                    name=keyword.title,  # Mezzanine uses 'title' field
                    namespace=self.namespace,
                )

                if tag:
                    self.tag_mapping[f"keyword_{keyword.id}"] = tag

                    if created:
                        self.stats["created"] += 1
                    else:
                        self.stats["skipped"] += 1

        except ImportError as e:
            logger.warning(f"Could not import Keyword: {e}")
        except Exception as e:
            logger.error(f"Error migrating keywords: {e}")

    def migrate_news_tags(self):
        """Example: Migrate news-specific tags"""

        # EXAMPLE 1: NewsType
        try:
            from eceeenews.models import eceeeNewsType

            news_types = eceeeNewsType.objects.all()

            for news_type in news_types:
                tag, created = self.get_or_create_tag(
                    name=news_type.title, namespace=self.namespace
                )

                if tag:
                    self.tag_mapping[f"news_type_{news_type.id}"] = tag
                    if created:
                        self.stats["created"] += 1
                    else:
                        self.stats["skipped"] += 1

        except ImportError as e:
            logger.warning(f"Could not import eceeeNewsType: {e}")
        except Exception as e:
            logger.error(f"Error migrating news types: {e}")

        # EXAMPLE 2: NewsCategory
        try:
            from eceeenews.models import eceeeNewsCategory

            news_categories = eceeeNewsCategory.objects.all()

            for news_cat in news_categories:
                tag, created = self.get_or_create_tag(
                    name=news_cat.title, namespace=self.namespace
                )

                if tag:
                    self.tag_mapping[f"news_category_{news_cat.id}"] = tag
                    if created:
                        self.stats["created"] += 1
                    else:
                        self.stats["skipped"] += 1

        except ImportError as e:
            logger.warning(f"Could not import eceeeNewsCategory: {e}")
        except Exception as e:
            logger.error(f"Error migrating news categories: {e}")

        # EXAMPLE 3: NewsSource
        try:
            from eceeenews.models import eceeeNewsSource

            news_sources = eceeeNewsSource.objects.all()

            for source in news_sources:
                tag, created = self.get_or_create_tag(
                    name=source.title, namespace=self.namespace
                )

                if tag:
                    self.tag_mapping[f"news_source_{source.id}"] = tag
                    if created:
                        self.stats["created"] += 1
                    else:
                        self.stats["skipped"] += 1

        except ImportError as e:
            logger.warning(f"Could not import eceeeNewsSource: {e}")
        except Exception as e:
            logger.error(f"Error migrating news sources: {e}")

    def migrate_related_news(self):
        """Example: Migrate RelatedNews relationships"""

        try:
            from eceeenews.models import eceeeNews

            # Get all news items that have related_news field
            news_items = eceeeNews.objects.all()
            relationship_count = 0

            for news in news_items:
                # Check if the model has a related_news field (M2M or similar)
                if hasattr(news, "related_news") and news.related_news.exists():
                    # Store relationships for later use in news content migration
                    related_ids = list(news.related_news.values_list("id", flat=True))

                    # Save to mapping
                    self.tag_mapping[f"related_news_{news.id}"] = related_ids
                    relationship_count += len(related_ids)
                    self.stats["created"] += 1

        except ImportError as e:
            logger.warning(f"Could not import eceeeNews: {e}")
        except AttributeError as e:
            logger.warning(f"No related_news field found: {e}")
        except Exception as e:
            logger.error(f"Error migrating related news: {e}")

    def migrate_event_tags(self):
        """Example: Migrate event-specific tags"""

        try:
            from eceeecalendar.models import EceeeCalenderEvent

            # Get all event types from the events
            # Assuming event_type is a field on the model
            events = EceeeCalenderEvent.objects.all()
            event_types = set()

            for event in events:
                if hasattr(event, "event_type") and event.event_type:
                    event_types.add(event.event_type)

            for event_type in event_types:
                tag, created = self.get_or_create_tag(
                    name=event_type, namespace=self.namespace
                )

                if tag:
                    self.tag_mapping[f"event_type_{event_type}"] = tag
                    if created:
                        self.stats["created"] += 1

        except ImportError as e:
            logger.warning(f"Could not import EceeeCalenderEvent: {e}")
        except Exception as e:
            logger.error(f"Error migrating event tags: {e}")

    def migrate_library_tags(self):
        """Example: Migrate library category tags"""

        try:
            from eceeelibrary.models import LibraryCategory

            categories = LibraryCategory.objects.all()

            for category in categories:
                tag, created = self.get_or_create_tag(
                    name=category.title, namespace=self.namespace
                )

                if tag:
                    self.tag_mapping[f"library_category_{category.id}"] = tag
                    if created:
                        self.stats["created"] += 1
                    else:
                        self.stats["skipped"] += 1

        except ImportError as e:
            logger.warning(f"Could not import LibraryCategory: {e}")
        except Exception as e:
            logger.error(f"Error migrating library tags: {e}")

    def migrate_proceedings_tags(self):
        """Example: Migrate proceedings keyword tags"""

        try:
            from eceeeproceedings.models import ProceedingsKeyword

            keywords = ProceedingsKeyword.objects.all()

            for keyword in keywords:
                tag, created = self.get_or_create_tag(
                    name=keyword.title, namespace=self.namespace
                )

                if tag:
                    self.tag_mapping[f"proceedings_keyword_{keyword.id}"] = tag
                    if created:
                        self.stats["created"] += 1
                    else:
                        self.stats["skipped"] += 1

        except ImportError as e:
            logger.warning(f"Could not import ProceedingsKeyword: {e}")
        except Exception as e:
            logger.error(f"Error migrating proceedings tags: {e}")


# USAGE EXAMPLE:
if __name__ == "__main__":
    import logging

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Run in dry-run mode
    migrator = TagMigratorExample(dry_run=True)

    # Get namespace
    migrator.namespace = migrator.get_or_create_default_namespace()

    # Run individual migration methods
    migrator.migrate_normal_tags()
    migrator.migrate_news_tags()
    migrator.migrate_related_news()
    migrator.migrate_event_tags()
    migrator.migrate_library_tags()
    migrator.migrate_proceedings_tags()

    # Merge duplicates
    migrator.merge_duplicate_tags(migrator.namespace)

    # Show stats
    migrator.log_stats()
