# ECEEE Data Migration Scripts

This directory contains migration scripts for migrating data from the legacy ECEEE system to the new eceee_v4 architecture.

## Overview

The migration follows a simplified approach:
- **All tags in default namespace** - No namespace complexity
- **Focus on three tag types**: Normal tags, News tags, and Related News
- **Reusable patterns** - Tag migration patterns can be applied to all content types

## Migration Order

1. **Tags** (this script) - Migrate all category/tag data
2. **Object Type Definitions** - Create schemas for content types
3. **Content** - Migrate actual content (news, events, etc.)
4. **Media** - Migrate images and files
5. **Pages** - Migrate hierarchical web pages

## Tag Migration

### Usage

#### From Django Shell

```python
python manage.py shell

# Import the migrator
from scripts.migration.migrate_tags import TagMigrator

# Run in dry-run mode first (recommended)
migrator = TagMigrator(dry_run=True)
migrator.run()

# Check the results, then run for real
migrator = TagMigrator(dry_run=False)
migrator.run()
```

#### Or use the helper function

```python
from scripts.migration.migrate_tags import run_migration

# Dry run
run_migration(dry_run=True)

# Real migration
run_migration(dry_run=False)
```

### Customization Required

The tag migration script provides a template structure but needs to be customized for your specific legacy schema. You'll need to:

1. **Identify your legacy tag models**
   - Find the tables/models containing categories, keywords, tags
   - Example: `eceeeKeyword`, `eceeeCategory`, `eceeeNewsType`, etc.

2. **Import the legacy models**
   - Add imports at the top of the migration functions
   - Example: `from eceeenews.models import eceeeNewsType`

3. **Customize the migration functions**
   - `migrate_normal_tags()` - General categories/keywords
   - `migrate_news_tags()` - News-specific categorization
   - `migrate_related_news()` - News relationship data

4. **Update tag mappings**
   - The script stores mappings from old IDs to new Tags
   - This is used later when migrating content

### Example Customization

Here's an example of how to customize `migrate_news_tags()`:

```python
def migrate_news_tags(self):
    """Migrate news-specific tags"""
    logger.info("Migrating News Tags")
    
    # Import your legacy model
    from eceeenews.models import eceeeNewsType
    
    # Get all legacy news types
    news_types = eceeeNewsType.objects.all()
    logger.info(f"Found {news_types.count()} news types")
    
    # Migrate each one
    for news_type in news_types:
        tag, created = self.get_or_create_tag(
            name=news_type.title,  # or whatever field has the name
            namespace=self.namespace
        )
        
        if tag:
            # Store mapping for content migration
            self.tag_mapping[f"news_type_{news_type.id}"] = tag
            
            if created:
                self.stats['created'] += 1
            else:
                self.stats['skipped'] += 1
    
    # Repeat for NewsCategory, NewsSource, etc.
```

## What the Script Does

1. **Creates/Gets Default Namespace**
   - Ensures a default namespace exists
   - All tags will use this namespace

2. **Migrates Tags**
   - Converts all legacy categories/keywords to simple Tags
   - Normalizes tag names (trimming, etc.)
   - Tracks which tags are created vs reused

3. **Merges Duplicates**
   - Finds tags with similar names
   - Keeps the one with highest usage count
   - Merges usage counts together

4. **Saves Mapping**
   - Creates a JSON file mapping old IDs to new Tags
   - Used by content migration scripts later

5. **Provides Statistics**
   - Counts of created/skipped/error tags
   - Merge statistics
   - Detailed logging

## Tag Model Structure

The new Tag model is simple:

```python
class Tag(models.Model):
    namespace = ForeignKey(Namespace)  # Always default namespace
    name = CharField(max_length=50, unique=True)
    slug = SlugField(max_length=50, unique=True)
    usage_count = PositiveIntegerField(default=0)
    created_at = DateTimeField(auto_now_add=True)
```

## Output Files

When running with `dry_run=False`, the script creates:

- `tag_mapping.json` - Maps legacy tag IDs to new Tag objects
  - Format: `{"news_type_123": {"id": 456, "name": "Policy", "slug": "policy"}}`
  - Used by content migration scripts

## Next Steps

After tag migration is complete:

1. Review the tag mapping file
2. Check for any merge issues
3. Proceed to content migration scripts
4. Update content objects to reference the new tags

## Base Migrator

All migration scripts inherit from `BaseMigrator` which provides:

- `get_or_create_default_namespace()` - Namespace management
- `get_or_create_tag()` - Safe tag creation with normalization
- `merge_duplicate_tags()` - Intelligent tag deduplication
- `get_migration_user()` - System user for migration operations
- `log_stats()` - Statistics tracking
- Dry-run transaction support

## Tips

- **Always run dry-run first** - Check logs before committing
- **Backup your database** - Before running any real migration
- **Check legacy data** - Review your legacy schema first
- **Incremental approach** - Migrate one tag type at a time
- **Verify results** - Query the Tag table after migration

## Troubleshooting

### Issue: Legacy models not found
**Solution**: Make sure legacy app is in INSTALLED_APPS and database accessible

### Issue: Duplicate tag errors
**Solution**: The merge_duplicate_tags() should handle this, but you may need to manually clean up

### Issue: Import errors
**Solution**: Run migrations from project root with proper DJANGO_SETTINGS_MODULE

### Issue: Transaction errors in dry-run
**Solution**: This is expected - dry-run intentionally rolls back

## Support

For questions or issues with migration:
1. Review the migration plan: `extracted_models/eceee-data-migration.plan.md`
2. Check legacy model files in `extracted_models/`
3. Review the base migrator code for utilities

