# Field Name Mapping: snake_case → camelCase

## Overview

All schema property names have been converted from **snake_case** to **camelCase** to comply with frontend validation requirements.

**Migration scripts must map legacy field names to new camelCase names.**

## Field Name Changes

### News (`news.json`)

| Legacy Name (snake_case) | New Name (camelCase) |
|--------------------------|----------------------|
| source_date | sourceDate |
| external_url | externalUrl |
| featured_image | featuredImage |

### Event (`event.json`)

| Legacy Name (snake_case) | New Name (camelCase) |
|--------------------------|----------------------|
| event_type | eventType |
| event_start_date | eventStartDate |
| event_end_date | eventEndDate |
| (venue, organiser, priority, quote unchanged) | |

### Job (`job.json`)

| Legacy Name (snake_case) | New Name (camelCase) |
|--------------------------|----------------------|
| external_url | externalUrl |
| (location, deadline unchanged) | |

### Library Item (`library_item.json`)

| Legacy Name (snake_case) | New Name (camelCase) |
|--------------------------|----------------------|
| derivable_number | derivableNumber |
| derivable_title | derivableTitle |

### Conference (`conference.json`)

| Legacy Name (snake_case) | New Name (camelCase) |
|--------------------------|----------------------|
| (all fields unchanged: year, venue, date, isbn, issn) | |

### Conference Panel (`conference_panel.json`)

| Legacy Name (snake_case) | New Name (camelCase) |
|--------------------------|----------------------|
| panel_prefix | panelPrefix |
| panel_leaders | panelLeaders |
| conference_id | conferenceId |

### Paper (`paper.json`)

| Legacy Name (snake_case) | New Name (camelCase) |
|--------------------------|----------------------|
| doc_nummer | docNummer |
| peer_review | peerReview |
| panel_id | panelId |
| (authors unchanged) | |

### Columnist (`columnist.json`)

| Legacy Name (snake_case) | New Name (camelCase) |
|--------------------------|----------------------|
| first_name | firstName |
| last_name | lastName |
| home_page | homePage |
| photo_url | photoUrl |
| last_column_date | lastColumnDate |
| (prefix, affiliation unchanged) | |

### Column (`column.json`)

| Legacy Name (snake_case) | New Name (camelCase) |
|--------------------------|----------------------|
| presentational_publishing_date | presentationalPublishingDate |
| columnist_ids | columnistIds |
| (priority unchanged) | |

## Migration Script Pattern

When migrating data, use this pattern:

```python
# ❌ OLD WAY (will fail frontend validation)
version_data = {
    'source_date': legacy_news.source_date,
    'external_url': legacy_news.external_url,
    'featured_image': legacy_news.featured_image
}

# ✅ NEW WAY (correct camelCase)
version_data = {
    'sourceDate': legacy_news.source_date,
    'externalUrl': legacy_news.external_url,
    'featuredImage': legacy_news.featured_image
}
```

## Helper Function

```python
def convert_to_camel_case(snake_str):
    """Convert snake_case to camelCase"""
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

# Usage
legacy_fields = {
    'source_date': '2025-01-15',
    'external_url': 'https://example.com',
    'featured_image': '/media/image.jpg'
}

# Convert to camelCase
camel_fields = {
    convert_to_camel_case(key): value 
    for key, value in legacy_fields.items()
}
# Result: {'sourceDate': '2025-01-15', 'externalUrl': ...}
```

## Complete Mapping Dictionary

```python
# For use in migration scripts
FIELD_NAME_MAPPING = {
    # News
    'source_date': 'sourceDate',
    'external_url': 'externalUrl',
    'featured_image': 'featuredImage',
    
    # Event
    'event_type': 'eventType',
    'event_start_date': 'eventStartDate',
    'event_end_date': 'eventEndDate',
    
    # Library Item
    'derivable_number': 'derivableNumber',
    'derivable_title': 'derivableTitle',
    
    # Conference Panel
    'panel_prefix': 'panelPrefix',
    'panel_leaders': 'panelLeaders',
    'conference_id': 'conferenceId',
    
    # Paper
    'doc_nummer': 'docNummer',
    'peer_review': 'peerReview',
    'panel_id': 'panelId',
    
    # Columnist
    'first_name': 'firstName',
    'last_name': 'lastName',
    'home_page': 'homePage',
    'photo_url': 'photoUrl',
    'last_column_date': 'lastColumnDate',
    
    # Column
    'presentational_publishing_date': 'presentationalPublishingDate',
    'columnist_ids': 'columnistIds',
}

def map_field_names(data_dict, mapping=FIELD_NAME_MAPPING):
    """
    Convert field names from snake_case to camelCase
    
    Args:
        data_dict: Dictionary with snake_case keys
        mapping: Field name mapping dictionary
        
    Returns:
        Dictionary with camelCase keys
    """
    result = {}
    for key, value in data_dict.items():
        new_key = mapping.get(key, key)  # Use mapping or keep original
        result[new_key] = value
    return result

# Usage in migration
legacy_data = {
    'source_date': '2025-01-15',
    'external_url': 'https://example.com'
}

version_data = map_field_names(legacy_data)
# Result: {'sourceDate': '2025-01-15', 'externalUrl': 'https://example.com'}
```

## Migration Script Updates Required

### 1. News Migration
Update `migrate_news.py` to use camelCase:
```python
version = ObjectVersion.objects.create(
    object_instance=news_obj,
    data={
        'sourceDate': legacy_news.source_date,           # ✅ camelCase
        'externalUrl': legacy_news.external_url,         # ✅ camelCase
        'featuredImage': migrate_image(legacy_news.image) # ✅ camelCase
    }
)
```

### 2. Event Migration
Update `migrate_events.py` to use camelCase:
```python
version = ObjectVersion.objects.create(
    object_instance=event_obj,
    data={
        'eventType': legacy_event.event_type,         # ✅ camelCase
        'venue': legacy_event.venue,
        'organiser': legacy_event.organiser,
        'eventStartDate': legacy_event.event_start_date, # ✅ camelCase
        'eventEndDate': legacy_event.event_end_date,     # ✅ camelCase
        'priority': legacy_event.priority,
        'quote': legacy_event.quote
    }
)
```

### 3. Columnist Migration
Update `migrate_columnists.py` to use camelCase:
```python
version = ObjectVersion.objects.create(
    object_instance=columnist_obj,
    data={
        'firstName': legacy_columnist.first_name,       # ✅ camelCase
        'lastName': legacy_columnist.last_name,         # ✅ camelCase
        'prefix': legacy_columnist.prefix,
        'affiliation': legacy_columnist.affiliation,
        'homePage': legacy_columnist.home_page,         # ✅ camelCase
        'photoUrl': migrate_photo(legacy_columnist.photo), # ✅ camelCase
        'lastColumnDate': legacy_columnist.last_column_date # ✅ camelCase
    }
)
```

## Testing Schema Validation

After updating schemas, test in frontend:

```javascript
// Should now pass validation
const newsSchema = {
  type: "object",
  properties: {
    sourceDate: {              // ✅ camelCase
      displayLabel: "Source Date",
      componentType: "date"
    },
    externalUrl: {             // ✅ camelCase
      displayLabel: "External URL",
      componentType: "url"
    }
  }
};
```

## Validation Rules

Frontend validation requires:
1. ✅ **Property names in camelCase** (firstName, not first_name)
2. ✅ **`title` field present** for each property (not displayLabel)
3. ✅ **`componentType` field present** for each property
4. ✅ **Valid componentType** values

## Quick Reference

**Common Conversions:**
- `_date` → `Date` (e.g., source_date → sourceDate)
- `_url` → `Url` (e.g., external_url → externalUrl)
- `_id` / `_ids` → `Id` / `Ids` (e.g., panel_id → panelId)
- `_name` → `Name` (e.g., first_name → firstName)

**Exception:**
- `doc_nummer` → `docNummer` (keeping original German spelling)

## Impact on Migration Plan

The migration plan document still uses snake_case for readability when describing legacy fields. When implementing migrations:

1. **Documentation** (plan, READMEs) → Use snake_case for legacy field descriptions
2. **Schemas** (JSON files) → Use camelCase (done ✅)
3. **Migration code** → Map snake_case legacy → camelCase schema
4. **Database** → ObjectVersion.data stores camelCase keys

---

**Updated**: 2025-01-13  
**Status**: ✅ All schemas converted to camelCase  
**Validated**: ✅ All JSON files valid  
**Next**: Update migration scripts to use camelCase when creating ObjectVersions

