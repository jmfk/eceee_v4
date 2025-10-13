# Tag Migration Quick Start Guide

Get started with tag migration in 5 minutes.

## Prerequisites

- Django environment set up
- Database accessible
- Legacy models available (or ready to mock)

## Step 1: Verify Setup (2 minutes)

```bash
# Start Django shell
python manage.py shell

# Run test script
exec(open('scripts/migration/test_migration_setup.py').read())
```

**Expected Output**: All tests pass ✅

If tests fail, check:
- Django settings configured correctly
- Database connection working
- content app in INSTALLED_APPS

## Step 2: Review Legacy Schema (5 minutes)

Check your legacy model files:

```bash
ls extracted_models/*_models.py
```

Key files to review:
- `eceeenews_models.py` - News tags
- `eceeebase_models.py` - General categories
- `eceeelibrary_models.py` - Library tags
- `eceeeproceedings_models.py` - Proceedings keywords

## Step 3: Customize Migration (10 minutes)

Open `migrate_tags.py` and customize the three main functions:

### Example: Migrate News Tags

```python
def migrate_news_tags(self):
    """Migrate news-specific tags"""
    logger.info("Migrating News Tags")
    
    # Copy from migrate_tags_example.py
    try:
        from eceeenews.models import eceeeNewsType
        
        news_types = eceeeNewsType.objects.all()
        logger.info(f"Found {news_types.count()} news types")
        
        for news_type in news_types:
            tag, created = self.get_or_create_tag(
                name=news_type.title,
                namespace=self.namespace
            )
            
            if tag:
                self.tag_mapping[f"news_type_{news_type.id}"] = tag
                if created:
                    self.stats['created'] += 1
                else:
                    self.stats['skipped'] += 1
                    
    except ImportError as e:
        logger.warning(f"Could not import eceeeNewsType: {e}")
    except Exception as e:
        logger.error(f"Error migrating news types: {e}")
```

**Tips**:
- Start with one tag type
- Copy patterns from `migrate_tags_example.py`
- Test each section individually

## Step 4: Dry Run (5 minutes)

```python
python manage.py shell

from scripts.migration.migrate_tags import TagMigrator

# Test run (won't commit anything)
migrator = TagMigrator(dry_run=True)
migrator.run()
```

**Review the output**:
- How many tags created?
- Any errors?
- Duplicate merge stats?

## Step 5: Real Migration (2 minutes)

When satisfied with dry run:

```python
# Real migration (commits to database)
migrator = TagMigrator(dry_run=False)
migrator.run()
```

**Output files**:
- `tag_mapping.json` - Maps old IDs to new tags

## Step 6: Verify Results (3 minutes)

```python
from content.models import Tag, Namespace

# Check default namespace
ns = Namespace.get_default()
print(f"Default namespace: {ns.name}")

# Count tags
total_tags = Tag.objects.filter(namespace=ns).count()
print(f"Total tags migrated: {total_tags}")

# Sample tags
print("\nSample tags:")
for tag in Tag.objects.filter(namespace=ns)[:10]:
    print(f"  - {tag.name} (usage: {tag.usage_count})")

# Check for duplicates (should be none)
from django.db.models import Count
dupes = Tag.objects.values('name').annotate(
    count=Count('name')
).filter(count__gt=1)
print(f"\nDuplicate tags: {dupes.count()}")
```

## Common Scenarios

### Scenario 1: Simple Migration (No Legacy)

If you don't have legacy models yet:

```python
# Just create some example tags
migrator = TagMigrator()
namespace = migrator.get_or_create_default_namespace()

# Create tags manually
tag1, _ = migrator.get_or_create_tag("Policy", namespace)
tag2, _ = migrator.get_or_create_tag("Energy Efficiency", namespace)
tag3, _ = migrator.get_or_create_tag("Renovation", namespace)

print(f"Created {Tag.objects.count()} tags")
```

### Scenario 2: Partial Migration

Migrate one type at a time:

```python
migrator = TagMigrator(dry_run=True)
migrator.namespace = migrator.get_or_create_default_namespace()

# Just migrate news tags
migrator.migrate_news_tags()
migrator.log_stats()
```

### Scenario 3: Re-run After Errors

If migration fails partway:

```python
# Check what was created
existing = Tag.objects.filter(namespace__is_default=True).count()
print(f"Existing tags: {existing}")

# The script handles duplicates, so safe to re-run
migrator = TagMigrator(dry_run=False)
migrator.run()
```

## Troubleshooting

### Import Error: Legacy Model Not Found

```python
ImportError: No module named 'eceeenews'
```

**Solutions**:
1. Check if legacy app in INSTALLED_APPS
2. Update import path in migration script
3. Comment out that section if not needed

### Duplicate Tag Error

```python
ValidationError: A tag with this name already exists
```

**Solutions**:
1. Run `merge_duplicate_tags()` function
2. Check database manually: `Tag.objects.filter(name__iexact='Policy')`
3. Delete duplicates if needed

### Transaction Error in Dry Run

```python
TransactionManagementError...
```

**This is expected!** Dry run intentionally rolls back.

### No Tags Created

**Check**:
1. Legacy models have data?
2. Field names correct? (e.g., `title` vs `name`)
3. Filters excluding data?
4. Check logs for skip reasons

## Next Steps After Tag Migration

1. **Review tag_mapping.json**
   - Check old ID → new Tag mappings
   - Ensure all important tags migrated

2. **Create ObjectTypeDefinitions**
   - Define schemas for news, events, etc.
   - See: `docs/OBJECT_STORAGE_SYSTEM.md`

3. **Migrate Content**
   - Use `tag_mapping.json` to link content to tags
   - Start with news migration

4. **Update References**
   - Old code using categories → Update to use tags
   - Templates using category queries → Update

## Useful Commands

```python
# Count tags by namespace
from content.models import Tag, Namespace
for ns in Namespace.objects.all():
    count = Tag.objects.filter(namespace=ns).count()
    print(f"{ns.name}: {count} tags")

# Find most used tags
Tag.objects.filter(usage_count__gt=0).order_by('-usage_count')[:10]

# Search for a tag
Tag.objects.filter(name__icontains='energy')

# Get all tags (default namespace)
Tag.objects.filter(namespace__is_default=True)

# Delete all tags (careful!)
# Tag.objects.filter(namespace__is_default=True).delete()
```

## Getting Help

- **Documentation**: `README.md` in this directory
- **Examples**: `migrate_tags_example.py`
- **Migration Plan**: `extracted_models/eceee-data-migration.plan.md`
- **Summary**: `TAG_MIGRATION_SUMMARY.md`

## Success Checklist

- [ ] Test script passes
- [ ] Legacy schema reviewed
- [ ] Migration script customized
- [ ] Dry run successful
- [ ] Real migration completed
- [ ] tag_mapping.json created
- [ ] Results verified in database
- [ ] No duplicate tags
- [ ] Ready for content migration

## Time Estimate

- Setup & testing: 10 minutes
- Customization: 30-60 minutes (depending on schema complexity)
- Running migration: 5 minutes
- Verification: 10 minutes

**Total**: ~1-2 hours for complete tag migration

---

🎉 **You're ready to migrate!** Start with Step 1 above.

