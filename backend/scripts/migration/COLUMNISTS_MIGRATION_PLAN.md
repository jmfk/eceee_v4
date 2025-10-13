# Columnists & Columns Migration Plan

## Overview

This document outlines the migration strategy for columnists and their columns from the legacy `eceeecolumnists` app to the new ObjectStorage system.

## Source Models

### EceeeColumnist
**Path**: `eceeecolumnists.models.EceeeColumnist`

A columnist is a person who writes opinion columns. They have:
- Personal information (name, affiliation, homepage)
- Multiple photos (horizontal, vertical, square)
- A biographical RichText field (inherited from Mezzanine RichText)
- Categories for organization
- A relationship to their published columns

### EceeeColumn
**Path**: `eceeecolumnists.models.EceeeColumn`

A column is an opinion article written by one or more columnists. They have:
- Standard article fields (title, slug, content)
- Many-to-many relationship with columnists
- Publishing date with priority flag
- Categories and keywords
- Related news items

## Target Architecture

### Two ObjectTypeDefinitions

1. **"columnist"** - Represents individual columnists
2. **"column"** - Represents their opinion articles

### Relationship Strategy

Columns are linked to columnists via:
- **Option A**: Store columnist IDs in column's metadata `{"columnist_ids": [1, 2, 3]}`
- **Option B**: Use parent/child relationship (column.parent = columnist)
- **Recommended**: Option A for flexibility (a column can have multiple columnists)

## Field Mapping

### EceeeColumnist → columnist ObjectTypeDefinition

#### Schema Fields (Structured Data)
```json
{
  "first_name": "string",
  "last_name": "string",
  "prefix": "string",          // e.g., "Dr.", "Prof."
  "affiliation": "string",     // Organization/institution
  "home_page": "url",
  "photo_url": "url",          // Choose best available: square > horizontal > vertical
  "last_column_date": "datetime"  // Date of most recent column
}
```

#### Content Widget (Unstructured Content)
- **Source**: `content` field (RichText from Mezzanine)
- **Destination**: Content Widget with biographical information

#### Migration Steps

```python
def migrate_columnist(legacy_columnist):
    # 1. Create ObjectInstance
    columnist_obj = ObjectInstance.objects.create(
        object_type=get_columnist_type(),
        title=legacy_columnist.title,  # Usually full name
        slug=legacy_columnist.slug,
        created_by=migration_user
    )
    
    # 2. Choose best photo
    photo = (
        legacy_columnist.square_photo or 
        legacy_columnist.horizontal_photo or 
        legacy_columnist.vertical_photo
    )
    
    # 3. Create ObjectVersion with metadata
    version = ObjectVersion.objects.create(
        object_instance=columnist_obj,
        data={
            "first_name": legacy_columnist.first_name,
            "last_name": legacy_columnist.last_name,
            "prefix": legacy_columnist.prefix,
            "affiliation": legacy_columnist.affiliation,
            "home_page": legacy_columnist.home_page,
            "photo_url": migrate_photo(photo),  # Upload to new media system
            "last_column_date": legacy_columnist.last_column_date
        },
        effective_date=legacy_columnist.publish_date,
        created_by=migration_user
    )
    
    # 4. Migrate bio to Content Widget
    if legacy_columnist.content:
        ObjectWidget.objects.create(
            object_version=version,
            widget_type="content",
            configuration={
                "content": clean_html(legacy_columnist.content)
            },
            order=0,
            created_by=migration_user
        )
    
    # 5. Migrate tags
    migrate_categories_to_tags(
        legacy_columnist.categories.all(),
        columnist_obj
    )
    migrate_categories_to_tags(
        legacy_columnist.eceee_categories.all(),
        columnist_obj
    )
    
    # 6. Set current version
    columnist_obj.current_version = version
    columnist_obj.save()
    
    return columnist_obj
```

### EceeeColumn → column ObjectTypeDefinition

#### Schema Fields (Structured Data)
```json
{
  "title": "string",
  "slug": "string",
  "presentational_publishing_date": "datetime",
  "priority": "boolean",
  "columnist_ids": [1, 2, 3]  // Array of ObjectInstance IDs
}
```

#### Content Widget (Unstructured Content)
- **Source**: `content` field (RichText from Mezzanine)
- **Destination**: Content Widget with column article content

#### Migration Steps

```python
def migrate_column(legacy_column, columnist_mapping):
    # 1. Create ObjectInstance
    column_obj = ObjectInstance.objects.create(
        object_type=get_column_type(),
        title=legacy_column.title,
        slug=legacy_column.slug,
        created_by=migration_user
    )
    
    # 2. Get columnist IDs
    columnist_ids = []
    for legacy_columnist in legacy_column.columnists.all():
        new_columnist_id = columnist_mapping.get(legacy_columnist.id)
        if new_columnist_id:
            columnist_ids.append(new_columnist_id)
    
    # 3. Create ObjectVersion with metadata
    version = ObjectVersion.objects.create(
        object_instance=column_obj,
        data={
            "presentational_publishing_date": legacy_column.presentational_publishing_date,
            "priority": legacy_column.priority,
            "columnist_ids": columnist_ids
        },
        effective_date=legacy_column.presentational_publishing_date,
        is_featured=legacy_column.priority,  # Priority columns are featured
        created_by=migration_user
    )
    
    # 4. Migrate content to Content Widget
    if legacy_column.content:
        ObjectWidget.objects.create(
            object_version=version,
            widget_type="content",
            configuration={
                "content": clean_html(legacy_column.content)
            },
            order=0,
            created_by=migration_user
        )
    
    # 5. Store related news in metadata
    if legacy_column.related_newsitems.exists():
        related_ids = list(legacy_column.related_newsitems.values_list('id', flat=True))
        column_obj.metadata['related_news'] = related_ids
        column_obj.save()
    
    # 6. Migrate tags
    migrate_categories_to_tags(
        legacy_column.categories.all(),
        column_obj
    )
    migrate_categories_to_tags(
        legacy_column.eceee_categories.all(),
        column_obj
    )
    
    # Keywords
    if legacy_column.keywords_sub:
        for keyword in parse_keywords(legacy_column.keywords_sub):
            tag, _ = Tag.get_or_create_tag(keyword)
            column_obj.tags.add(tag)
    
    # 7. Set current version
    column_obj.current_version = version
    column_obj.save()
    
    return column_obj
```

## Migration Order

### Phase 1: Columnists First
Migrate all columnists before columns, since columns reference columnists.

```python
# Create mapping
columnist_mapping = {}  # old_id -> new ObjectInstance.id

for legacy_columnist in EceeeColumnist.objects.all():
    new_columnist = migrate_columnist(legacy_columnist)
    columnist_mapping[legacy_columnist.id] = new_columnist.id

# Save mapping
save_mapping('columnist_mapping.json', columnist_mapping)
```

### Phase 2: Columns Second
Use the columnist mapping to link columns to their authors.

```python
columnist_mapping = load_mapping('columnist_mapping.json')

for legacy_column in EceeeColumn.objects.all():
    new_column = migrate_column(legacy_column, columnist_mapping)
```

## Querying After Migration

### Get Columnist with Their Columns

```python
from object_storage.models import ObjectInstance

# Get columnist
columnist = ObjectInstance.objects.get(
    object_type__name='columnist',
    slug='john-doe'
)

# Get their columns
columns = ObjectInstance.objects.filter(
    object_type__name='column',
    current_version__data__columnist_ids__contains=[columnist.id]
)
```

### Get Column with Authors

```python
# Get column
column = ObjectInstance.objects.get(
    object_type__name='column',
    slug='energy-transition-thoughts'
)

# Get columnist IDs from data
columnist_ids = column.current_version.data.get('columnist_ids', [])

# Get columnists
columnists = ObjectInstance.objects.filter(
    object_type__name='columnist',
    id__in=columnist_ids
)
```

## Data Cleanup

### Photo Migration
- Upload photos to new media system
- Store reference in schema as URL
- Handle multiple photo formats (choose best available)

### HTML Cleanup
- Remove legacy inline styles
- Update image references
- Fix broken links
- Sanitize for XSS

### Relationship Mapping
- Many-to-many relationships → JSON array in metadata
- Related news → Store IDs for later linking after news migration

## Validation Checklist

After migration, verify:

- [ ] All columnists migrated
- [ ] All columns migrated
- [ ] Columnist-column relationships preserved
- [ ] Photos uploaded and referenced correctly
- [ ] Bio content in Content Widgets (not schema)
- [ ] Column content in Content Widgets (not schema)
- [ ] Tags migrated correctly
- [ ] Related news relationships stored
- [ ] No 'content' field in ObjectVersion.data
- [ ] Priority columns marked as featured
- [ ] Publishing dates preserved

## Schema Definitions

### Columnist Schema

```json
{
  "fields": [
    {
      "name": "first_name",
      "type": "text",
      "label": "First Name",
      "required": true
    },
    {
      "name": "last_name",
      "type": "text",
      "label": "Last Name",
      "required": true
    },
    {
      "name": "prefix",
      "type": "text",
      "label": "Prefix",
      "required": false,
      "help_text": "e.g., Dr., Prof."
    },
    {
      "name": "affiliation",
      "type": "text",
      "label": "Affiliation",
      "required": false
    },
    {
      "name": "home_page",
      "type": "url",
      "label": "Homepage URL",
      "required": false
    },
    {
      "name": "photo_url",
      "type": "url",
      "label": "Photo URL",
      "required": false
    },
    {
      "name": "last_column_date",
      "type": "datetime",
      "label": "Last Column Date",
      "required": false,
      "help_text": "Date of most recent column"
    }
  ]
}
```

### Column Schema

```json
{
  "fields": [
    {
      "name": "presentational_publishing_date",
      "type": "datetime",
      "label": "Publishing Date",
      "required": true
    },
    {
      "name": "priority",
      "type": "boolean",
      "label": "Priority Column",
      "required": false,
      "default": false
    },
    {
      "name": "columnist_ids",
      "type": "array",
      "label": "Columnist IDs",
      "required": false,
      "help_text": "Array of ObjectInstance IDs for columnists"
    }
  ]
}
```

## Next Steps

1. Create ObjectTypeDefinitions for "columnist" and "column"
2. Implement migration script `migrate_columnists.py`
3. Test on sample data
4. Run full migration
5. Verify relationships
6. Update frontend to query new structure

## References

- Legacy models: `extracted_models/eceeecolumnists_models.py`
- Content Widget strategy: `CONTENT_WIDGET_STRATEGY.md`
- Migration plan: `extracted_models/eceee-data-migration.plan.md`

