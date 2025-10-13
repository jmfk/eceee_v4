# Object Type Definition Schemas

This directory contains JSON schemas for all ObjectTypeDefinitions to be created during the ECEEE data migration.

## Important Principles

### Content Widget Pattern

All schemas follow the **Content Widget Pattern**:

- ✅ **Schema fields** = Structured metadata only (dates, numbers, URLs, etc.)
- ✅ **Content Widget** = Rich text content (descriptions, articles, bios)
- ❌ **Schema does NOT contain** = Long text fields, HTML content, articles

### Why This Matters

Content in schemas makes it:
- Hard to edit consistently
- Difficult to render uniformly
- Impossible to use the widget system
- Mixed concerns (data vs presentation)

Content in widgets provides:
- Consistent editing experience
- Unified rendering pipeline
- Widget composition capabilities
- Clean separation of concerns

## Schema Files

### 1. News (`news.json`)
**Purpose**: News articles and announcements

**Schema Fields**:
- `source_date` - Original publication date
- `external_url` - Link to source
- `featured_image` - Main image

**Content Widget**: Article body/content

**Tags**: news_type, news_category, news_source, keywords

**Related**: Can reference other news via metadata

---

### 2. Event (`event.json`)
**Purpose**: Calendar events, conferences, workshops

**Schema Fields**:
- `event_type` - Type of event
- `venue` - Location
- `organiser` - Organizing entity
- `event_start_date` - Start date/time
- `event_end_date` - End date/time
- `priority` - High priority flag
- `quote` - Highlight quote

**Content Widget**: Event description

**Tags**: event_type, event_category, eceee_category

---

### 3. Job (`job.json`)
**Purpose**: Job postings

**Schema Fields**:
- `location` - Job location
- `deadline` - Application deadline
- `external_url` - Application link

**Content Widget**: Job description

**Tags**: Generic categories

---

### 4. Library Item (`library_item.json`)
**Purpose**: Library documents and resources

**Schema Fields**:
- `derivable_number` - Document number
- `derivable_title` - Alternative title

**Content Widget**: Item description

**Media Attachments**: PDFs and related files

**Tags**: library_category

---

### 5. Conference (`conference.json`)
**Purpose**: Academic conferences

**Schema Fields**:
- `year` - Conference year
- `venue` - Conference location
- `date` - Conference date
- `isbn` - Proceedings ISBN
- `issn` - Proceedings ISSN

**Content Widget**: Conference description

**Children**: Conference panels

**Tags**: proceedings_keyword

---

### 6. Conference Panel (`conference_panel.json`)
**Purpose**: Panels/tracks within conferences

**Schema Fields**:
- `panel_prefix` - Panel identifier
- `panel_leaders` - Panel chairs
- `conference_id` - Parent conference reference

**Content Widget**: Additional information (optional)

**Parent**: Conference

**Children**: Papers

---

### 7. Paper (`paper.json`)
**Purpose**: Conference papers

**Schema Fields**:
- `authors` - Paper authors
- `doc_nummer` - Document identifier
- `peer_review` - Peer-reviewed flag
- `panel_id` - Parent panel reference

**Content Widget**: Paper abstract

**Media Attachments**: PDF, presentation files

**Parent**: Conference panel

**Tags**: proceedings_keyword

---

### 8. Columnist (`columnist.json`)
**Purpose**: Opinion columnists/authors

**Schema Fields**:
- `first_name` - First name
- `last_name` - Last name
- `prefix` - Title (Dr., Prof.)
- `affiliation` - Organization
- `home_page` - Personal website
- `photo_url` - Profile photo
- `last_column_date` - Most recent column date

**Content Widget**: Biographical information

**Related**: Columns reference columnists

**Tags**: categories, eceee_categories

---

### 9. Column (`column.json`)
**Purpose**: Opinion columns/articles

**Schema Fields**:
- `presentational_publishing_date` - Publication date
- `priority` - Featured flag
- `columnist_ids` - Array of columnist IDs

**Content Widget**: Column content/article

**Relationships**: References columnists via IDs array

**Tags**: categories, eceee_categories, keywords

**Related**: Can reference news items via metadata

---

## Schema Structure

All schemas follow this structure:

```json
{
  "type": "object",
  "properties": {
    "fieldName": {
      "title": "Human Readable Label",
      "componentType": "field_type",
      "maxLength": 100,           // Optional
      "helpText": "Helper text",  // Optional
      "required": false           // Optional
    }
  },
  "required": ["fieldName", "otherField"],
  "propertyOrder": ["fieldName", "otherField"],
  "additionalInfo": {
    "description": "Schema description",
    "contentWidgetRequired": true,
    "note": "Additional notes"
  }
}
```

**Important**: 
- Property names MUST be in **camelCase** (e.g., `firstName`, `externalUrl`)
- Display label key MUST be **`title`** (not `displayLabel`)
- Component type MUST be **`componentType`**

See `FIELD_NAME_MAPPING.md` for field name conversions.

## Component Types

Available `componentType` values:

- `text` - Short text field
- `rich_text` - Rich text editor (AVOID - use Content Widget instead)
- `number` - Numeric field
- `boolean` - Checkbox/toggle
- `date` - Date picker
- `datetime` - Date and time picker
- `url` - URL field with validation
- `image_reference` - Reference to media file
- `object_reference` - Reference to another object
- `user_reference` - Reference to user
- `choice` - Select from predefined choices
- `array` - Array/list of values

## Usage in Migration

### Creating ObjectTypeDefinition

```python
from object_storage.models import ObjectTypeDefinition
import json

# Load schema
with open('schemas/news.json') as f:
    schema = json.load(f)

# Create ObjectTypeDefinition
news_type = ObjectTypeDefinition.objects.create(
    name='news',
    label='News Article',
    plural_label='News Articles',
    description='News articles and announcements',
    schema=schema,
    hierarchy_level='both',
    is_active=True,
    created_by=migration_user
)
```

### Creating ObjectInstance

```python
from object_storage.models import ObjectInstance, ObjectVersion

# Create instance (metadata only)
news_obj = ObjectInstance.objects.create(
    object_type=news_type,
    title='Article Title',
    slug='article-slug',
    created_by=migration_user
)

# Create version with schema data
version = ObjectVersion.objects.create(
    object_instance=news_obj,
    data={
        'source_date': '2025-01-15',
        'external_url': 'https://example.com/article',
        'featured_image': '/media/image.jpg'
    },
    created_by=migration_user
)

# Add Content Widget (NOT in schema!)
from webpages.models import ObjectWidget

ObjectWidget.objects.create(
    object_version=version,
    widget_type='content',
    configuration={
        'content': '<p>Article content here...</p>'
    },
    order=0,
    created_by=migration_user
)

# Set current version
news_obj.current_version = version
news_obj.save()
```

## Validation

Before using schemas in production:

1. **No content fields** - Verify no `componentType: "rich_text"` in main schema
2. **Required fields** - Check required fields are reasonable
3. **Field types** - Ensure component types match data types
4. **maxLength values** - Verify lengths accommodate real data
5. **References** - Ensure object/image references are valid
6. **Arrays** - Check array item types are specified

## Next Steps

1. Review each schema with stakeholders
2. Adjust field types and labels as needed
3. Create ObjectTypeDefinitions in database
4. Test with sample data
5. Use in migration scripts

## References

- Migration Plan: `extracted_models/eceee-data-migration.plan.md`
- Content Widget Strategy: `CONTENT_WIDGET_STRATEGY.md`
- Object Storage Models: `backend/object_storage/models.py`

