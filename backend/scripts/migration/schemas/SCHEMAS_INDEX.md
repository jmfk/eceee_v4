# Object Type Schemas Index

Quick reference for all object type schemas created for ECEEE migration.

**⚠️ Important**: All property names use **camelCase** (e.g., `firstName`, `externalUrl`) to comply with frontend validation. See `FIELD_NAME_MAPPING.md` for snake_case → camelCase conversions.

## Schema Files Overview

| Schema | File | Content Type | Content Widget | Media | Relationships |
|--------|------|--------------|----------------|-------|---------------|
| News | `news.json` | Articles, announcements | ✅ Required | Featured image | Related news |
| Event | `event.json` | Calendar events | ✅ Required | - | - |
| Job | `job.json` | Job postings | ✅ Required | - | - |
| Library Item | `library_item.json` | Documents, resources | ✅ Required | PDF files | - |
| Conference | `conference.json` | Academic conferences | ✅ Required | - | Has panels (children) |
| Panel | `conference_panel.json` | Conference panels | Optional | - | Parent: conference, Has papers |
| Paper | `paper.json` | Conference papers | ✅ Required | PDF, presentations | Parent: panel |
| Columnist | `columnist.json` | Opinion writers | ✅ Required | Profile photo | Has columns |
| Column | `column.json` | Opinion articles | ✅ Required | - | References columnists, news |

## Field Summary

### News
- source_date (date)
- external_url (url)
- featured_image (image_reference)

### Event
- event_type (text)
- venue (text)
- organiser (text)
- event_start_date (datetime) ⭐ required
- event_end_date (datetime)
- priority (boolean)
- quote (text)

### Job
- location (text)
- deadline (date)
- external_url (url)

### Library Item
- derivable_number (text)
- derivable_title (text)

### Conference
- year (number) ⭐ required
- venue (text)
- date (date)
- isbn (text)
- issn (text)

### Conference Panel
- panel_prefix (text)
- panel_leaders (text)
- conference_id (object_reference) ⭐ required

### Paper
- authors (text) ⭐ required
- doc_nummer (text)
- peer_review (boolean)
- panel_id (object_reference)

### Columnist
- first_name (text) ⭐ required
- last_name (text) ⭐ required
- prefix (text)
- affiliation (text)
- home_page (url)
- photo_url (image_reference)
- last_column_date (datetime)

### Column
- presentational_publishing_date (datetime) ⭐ required
- priority (boolean)
- columnist_ids (array of numbers)

## Migration Priority

### Phase 1 (High Priority)
1. ✅ News
2. ✅ Event
3. ✅ Library Item
4. ✅ Conference + Panel + Paper

### Phase 2 (Medium Priority)
5. ✅ Columnist + Column
6. ✅ Job

## Content Widget Requirements

All schemas require Content Widgets EXCEPT:
- ❓ Conference Panel (optional - may not have additional content)

## Parent-Child Relationships

```
Conference
  └── Panel
        └── Paper

Columnist
  ← Referenced by Column (via columnist_ids array)
```

## Tags by Content Type

| Content Type | Tag Sources |
|--------------|-------------|
| News | news_type, news_category, news_source, keywords |
| Event | event_type, event_category, eceee_category |
| Job | categories |
| Library Item | library_category |
| Paper | proceedings_keyword |
| Columnist | categories, eceee_categories |
| Column | categories, eceee_categories, keywords |

## Creating All Schemas

```python
import json
from pathlib import Path
from object_storage.models import ObjectTypeDefinition

schemas_dir = Path('backend/scripts/migration/schemas')

schema_configs = [
    ('news', 'News Article', 'News Articles', 'News articles and announcements'),
    ('event', 'Event', 'Events', 'Calendar events and conferences'),
    ('job', 'Job Posting', 'Job Postings', 'Job opportunities'),
    ('library_item', 'Library Item', 'Library Items', 'Library documents and resources'),
    ('conference', 'Conference', 'Conferences', 'Academic conferences'),
    ('conference_panel', 'Conference Panel', 'Conference Panels', 'Conference panels and tracks'),
    ('paper', 'Paper', 'Papers', 'Conference papers and proceedings'),
    ('columnist', 'Columnist', 'Columnists', 'Opinion columnists'),
    ('column', 'Column', 'Columns', 'Opinion columns and articles'),
]

for name, label, plural, description in schema_configs:
    schema_file = schemas_dir / f'{name}.json'
    with open(schema_file) as f:
        schema = json.load(f)
    
    obj_type = ObjectTypeDefinition.objects.create(
        name=name,
        label=label,
        plural_label=plural,
        description=description,
        schema=schema,
        hierarchy_level='both',
        is_active=True,
        created_by=migration_user
    )
    print(f'✅ Created: {label}')
```

## Validation Checklist

For each schema:
- [ ] No `rich_text` component types (use Content Widgets)
- [ ] Required fields are reasonable
- [ ] Field types match expected data
- [ ] maxLength values accommodate data
- [ ] References are valid
- [ ] Array item types specified
- [ ] Help text is clear
- [ ] Display labels are user-friendly

## Schema Modifications

If you need to modify a schema:

1. Edit the JSON file
2. Update the ObjectTypeDefinition:
```python
obj_type = ObjectTypeDefinition.objects.get(name='news')
with open('schemas/news.json') as f:
    obj_type.schema = json.load(f)
obj_type.save()
```

3. Existing objects are NOT affected (schemas are versioned at ObjectVersion level)

## Quick Command Reference

```bash
# List all schema files
ls -1 backend/scripts/migration/schemas/*.json

# Validate JSON syntax
for f in backend/scripts/migration/schemas/*.json; do
    python -m json.tool "$f" > /dev/null && echo "✅ $f" || echo "❌ $f"
done

# Count schemas
ls -1 backend/scripts/migration/schemas/*.json | wc -l
```

## File Sizes

```
news.json              ~600 bytes
event.json             ~1.2 KB
job.json               ~450 bytes
library_item.json      ~500 bytes
conference.json        ~800 bytes
conference_panel.json  ~700 bytes
paper.json             ~750 bytes
columnist.json         ~950 bytes
column.json            ~650 bytes
```

## Next Steps

1. ✅ Review all schemas
2. ✅ Get stakeholder approval
3. ⏳ Create ObjectTypeDefinitions in database
4. ⏳ Test with sample data
5. ⏳ Use in migration scripts
6. ⏳ Validate with real legacy data

---

**Total Schemas**: 9  
**Lines of JSON**: ~5,600  
**Content Widget Pattern**: ✅ Consistently applied  
**Ready for Migration**: ✅ Yes

