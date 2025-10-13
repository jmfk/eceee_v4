# Migration Scripts Documentation Index

Complete guide to the ECEEE tag migration system.

## 📚 Documentation Files

### Quick Start
- **[QUICKSTART.md](QUICKSTART.md)** - Start here! 5-minute setup guide
- **[test_migration_setup.py](test_migration_setup.py)** - Verify your setup works

### Core Documentation
- **[README.md](README.md)** - Complete reference guide
- **[TAG_MIGRATION_SUMMARY.md](TAG_MIGRATION_SUMMARY.md)** - What was built and why
- **[CONTENT_WIDGET_STRATEGY.md](CONTENT_WIDGET_STRATEGY.md)** - How to migrate rich text content
- **[COLUMNISTS_MIGRATION_PLAN.md](COLUMNISTS_MIGRATION_PLAN.md)** - Columnists & columns migration
- **[Migration Plan](../../../extracted_models/eceee-data-migration.plan.md)** - Overall strategy

### Code Files
- **[base_migrator.py](base_migrator.py)** - Base class with utilities
- **[migrate_tags.py](migrate_tags.py)** - Main migration script (customize this)
- **[migrate_tags_example.py](migrate_tags_example.py)** - Worked examples
- **[create_object_types.py](create_object_types.py)** - Create ObjectTypeDefinitions from schemas

### Schemas
- **[schemas/](schemas/)** - JSON schemas for all object types
- **[schemas/README.md](schemas/README.md)** - Schema documentation
- **[schemas/SCHEMAS_INDEX.md](schemas/SCHEMAS_INDEX.md)** - Quick reference

## 🎯 Quick Navigation

### I want to...

#### Get started quickly
→ Go to [QUICKSTART.md](QUICKSTART.md)

#### Understand the architecture
→ Read [TAG_MIGRATION_SUMMARY.md](TAG_MIGRATION_SUMMARY.md)

#### Learn about Content Widget migration
→ Read [CONTENT_WIDGET_STRATEGY.md](CONTENT_WIDGET_STRATEGY.md)

#### See working code examples
→ Look at [migrate_tags_example.py](migrate_tags_example.py)

#### Troubleshoot issues
→ Check [README.md](README.md) troubleshooting section

#### Understand the full strategy
→ Review [eceee-data-migration.plan.md](../../../extracted_models/eceee-data-migration.plan.md)

#### Test my setup
→ Run [test_migration_setup.py](test_migration_setup.py)

#### Customize for my schema
→ Edit [migrate_tags.py](migrate_tags.py) using examples from [migrate_tags_example.py](migrate_tags_example.py)

## 📖 Reading Order

### For First-Time Users
1. **QUICKSTART.md** - Understand the basics
2. **test_migration_setup.py** - Verify setup
3. **migrate_tags_example.py** - See examples
4. **migrate_tags.py** - Customize your migration
5. **README.md** - Reference as needed

### For Understanding the System
1. **TAG_MIGRATION_SUMMARY.md** - High-level overview
2. **eceee-data-migration.plan.md** - Overall strategy
3. **base_migrator.py** - Core utilities
4. **README.md** - Implementation details

### For Implementation
1. **test_migration_setup.py** - Verify ready
2. **migrate_tags_example.py** - Copy patterns
3. **migrate_tags.py** - Implement migration
4. **QUICKSTART.md** - Follow steps
5. **README.md** - Troubleshoot

## 🔑 Key Concepts

### Default Namespace Only
All tags go into the default namespace - no complexity!

### Three Tag Types
1. **Normal Tags** - Categories, keywords
2. **News Tags** - News-specific categorization  
3. **Related News** - Relationship data

### Safe Migration
- Dry-run mode for testing
- Transaction-based (all-or-nothing)
- Duplicate detection & merging
- Comprehensive logging

### Reusable Pattern
The same migration approach works for:
- News tags
- Event tags
- Library tags
- Any other tag type

## 📊 File Overview

| File | Lines | Purpose | Audience |
|------|-------|---------|----------|
| QUICKSTART.md | 350 | Get started fast | Everyone |
| README.md | 207 | Complete reference | Developers |
| TAG_MIGRATION_SUMMARY.md | 291 | What we built | Technical leads |
| CONTENT_WIDGET_STRATEGY.md | 340 | Content migration pattern | Developers |
| COLUMNISTS_MIGRATION_PLAN.md | 490 | Columnists & columns guide | Developers |
| base_migrator.py | 179 | Shared utilities | Developers |
| migrate_tags.py | 286 | Main migration | Developers |
| migrate_tags_example.py | 378 | Working examples | Developers |
| test_migration_setup.py | 183 | Setup verification | Everyone |
| INDEX.md | This file | Navigation | Everyone |

## ✅ Pre-flight Checklist

Before migrating:

- [ ] Read QUICKSTART.md
- [ ] Run test_migration_setup.py (all tests pass)
- [ ] Review legacy models in `extracted_models/`
- [ ] Customize migrate_tags.py functions
- [ ] Test with dry_run=True
- [ ] Backup database
- [ ] Run real migration with dry_run=False
- [ ] Verify results in database
- [ ] Save tag_mapping.json for content migration

## 🎓 Learning Path

### Beginner
**Goal**: Get tags migrated successfully

1. Quick start guide
2. Run test script
3. Copy-paste from examples
4. Run migration
5. Verify results

**Time**: 1-2 hours

### Intermediate
**Goal**: Understand the system

1. Read summary document
2. Review migration plan
3. Understand base utilities
4. Customize migration logic
5. Handle edge cases

**Time**: 3-4 hours

### Advanced
**Goal**: Extend for other content types

1. Master tag migration
2. Apply pattern to news content
3. Extend to events, library, etc.
4. Build content migration scripts
5. Complete full migration

**Time**: 1-2 weeks

## 🔍 Code Examples

### Simple Tag Creation
```python
from scripts.migration.base_migrator import BaseMigrator

migrator = BaseMigrator()
namespace = migrator.get_or_create_default_namespace()
tag, created = migrator.get_or_create_tag("Energy Efficiency", namespace)
```

### Run Full Migration
```python
from scripts.migration.migrate_tags import TagMigrator

# Test first
migrator = TagMigrator(dry_run=True)
migrator.run()

# Then for real
migrator = TagMigrator(dry_run=False)
migrator.run()
```

### Partial Migration
```python
migrator = TagMigrator()
migrator.namespace = migrator.get_or_create_default_namespace()
migrator.migrate_news_tags()  # Just news tags
```

### Check Results
```python
from content.models import Tag

# Count tags
total = Tag.objects.filter(namespace__is_default=True).count()
print(f"Total tags: {total}")

# Most used
top_tags = Tag.objects.filter(
    usage_count__gt=0
).order_by('-usage_count')[:10]
```

## 🆘 Support Resources

### Documentation
- This directory: Complete migration guides
- `docs/`: Overall system documentation
- `extracted_models/`: Legacy schema reference

### Code
- `backend/content/models.py`: Tag model
- `backend/object_storage/models.py`: Content system
- `backend/scripts/migration/`: All migration scripts

### Help
- Review troubleshooting in README.md
- Check examples in migrate_tags_example.py
- Test setup with test_migration_setup.py

## 📈 Progress Tracking

### Phase 1: Tag Migration (YOU ARE HERE)
- [x] Plan simplified (no namespaces)
- [x] Base utilities created
- [x] Migration script created
- [x] Examples provided
- [x] Documentation written
- [ ] Customize for your schema
- [ ] Run migration
- [ ] Verify results

### Phase 2: Content Migration (NEXT)
- [ ] Create ObjectTypeDefinitions
- [ ] Migrate news content
- [ ] Assign tags to content
- [ ] Migrate events, library, etc.

### Phase 3: Verification (LATER)
- [ ] Validate all content
- [ ] Check tag assignments
- [ ] Generate redirects
- [ ] Performance testing

## 🎯 Success Metrics

How to know it worked:

✅ All tests pass (test_migration_setup.py)  
✅ No linting errors  
✅ Dry run completes successfully  
✅ Real migration creates tags  
✅ tag_mapping.json file generated  
✅ No duplicate tags in database  
✅ Statistics look reasonable  
✅ Can query tags successfully  

## 🚀 Next Steps

After tag migration:

1. **Review results** - Check tag_mapping.json
2. **Create schemas** - Define ObjectTypeDefinitions
3. **Migrate content** - Start with news
4. **Assign tags** - Link content to tags
5. **Continue** - Events, library, pages, etc.

---

**Start here**: [QUICKSTART.md](QUICKSTART.md)

**Questions?**: Check [README.md](README.md) troubleshooting section

