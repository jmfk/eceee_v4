# Schema Quick Reference Card

## Updated Schemas - Key Changes

### 🖼️ Image Fields (Changed)
```json
// OLD ❌
"componentType": "image_reference"

// NEW ✅
"componentType": "image",
"mediaTypes": ["image"],
"maxFileSize": 5242880  // 5MB
```

**Affects**: `news.json`, `columnist.json`

### 🎯 Event Type (Enhanced)
```json
// OLD ❌
"eventType": {
  "componentType": "text",
  "maxLength": 100
}

// NEW ✅
"eventType": {
  "componentType": "choice",
  "enum": ["conference", "workshop", "webinar", "meeting", "seminar", "other"],
  "enumLabels": ["Conference", "Workshop", "Webinar", "Meeting", "Seminar", "Other"]
}
```

**Affects**: `event.json`

### ✓ Boolean Defaults (Added)
```json
// OLD ❌
"priority": {
  "componentType": "boolean"
}

// NEW ✅
"priority": {
  "componentType": "boolean",
  "default": false
}
```

**Affects**: `event.json`, `paper.json`, `column.json`

### 📋 Array Defaults (Added)
```json
// OLD ❌
"columnistIds": {
  "componentType": "array",
  "items": {"type": "number"}
}

// NEW ✅
"columnistIds": {
  "componentType": "array",
  "items": {"type": "number"},
  "default": []
}
```

**Affects**: `column.json`

### 🔢 Conference Year (Enhanced)
```json
// OLD ❌
"year": {
  "componentType": "number"
}

// NEW ✅
"year": {
  "componentType": "number",
  "type": "integer",
  "minimum": 1990,
  "maximum": 2100
}
```

**Affects**: `conference.json`

## Field Name Reference (camelCase)

| Legacy (snake_case) | New (camelCase) | Schema |
|---------------------|-----------------|--------|
| source_date | sourceDate | news |
| external_url | externalUrl | news, job |
| featured_image | featuredImage | news |
| event_type | eventType | event |
| event_start_date | eventStartDate | event |
| event_end_date | eventEndDate | event |
| derivable_number | derivableNumber | library_item |
| derivable_title | derivableTitle | library_item |
| panel_prefix | panelPrefix | conference_panel |
| panel_leaders | panelLeaders | conference_panel |
| conference_id | conferenceId | conference_panel |
| doc_nummer | docNummer | paper |
| peer_review | peerReview | paper |
| panel_id | panelId | paper |
| first_name | firstName | columnist |
| last_name | lastName | columnist |
| home_page | homePage | columnist |
| photo_url | photoUrl | columnist |
| last_column_date | lastColumnDate | columnist |
| presentational_publishing_date | presentationalPublishingDate | column |
| columnist_ids | columnistIds | column |

## Migration Code Pattern

```python
# ✅ CORRECT - Use camelCase in ObjectVersion.data
version = ObjectVersion.objects.create(
    object_instance=news_obj,
    data={
        'sourceDate': legacy.source_date,        # ✅ camelCase
        'externalUrl': legacy.external_url,      # ✅ camelCase
        'featuredImage': migrate_image(legacy.image)  # ✅ camelCase
    }
)

# ❌ WRONG - Don't use snake_case
version = ObjectVersion.objects.create(
    object_instance=news_obj,
    data={
        'source_date': legacy.source_date,       # ❌ Will fail validation
        'external_url': legacy.external_url,     # ❌ Will fail validation
        'featured_image': migrate_image(legacy.image)  # ❌ Will fail validation
    }
)
```

## Component Types Used

| Component Type | Used For | Schemas |
|----------------|----------|---------|
| `text` | Short text (names, IDs, etc.) | All |
| `url` | Web addresses | news, job, columnist |
| `date` | Dates without time | news, job, conference, library_item |
| `datetime` | Dates with time | event, columnist, column |
| `number` | Numeric values | conference |
| `boolean` | Yes/no flags | event, paper, column |
| `choice` | Single selection | event |
| `array` | Lists of values | column |
| `image` | Image uploads | news, columnist |
| `object_reference` | Links to other objects | conference_panel, paper |

## Validation Status

```
✅ All 9 schemas valid JSON
✅ All property names in camelCase
✅ All fields have title and componentType
✅ Boolean fields have defaults
✅ Array fields have defaults
✅ Image fields use correct componentType
✅ Choice fields used where appropriate
✅ Help text provided
✅ Required fields identified
✅ Property order defined
```

## Quick Commands

```bash
# Validate all schemas
for f in *.json; do 
  python3 -m json.tool "$f" > /dev/null && echo "✅ $f" || echo "❌ $f"
done

# Count schemas
ls -1 *.json | wc -l

# View schema
cat news.json | python3 -m json.tool
```

---

**Updated**: 2025-10-13  
**Status**: ✅ All schemas ready for production

