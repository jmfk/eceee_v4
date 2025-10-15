# How to Create Object Type Schemas - Complete Guide

## Overview

This guide explains how to create correct JSON schemas for ObjectTypeDefinitions in the ECEEE system. Schemas define the structure and validation rules for object instances.

## Basic Schema Structure

Every schema must follow this structure:

```json
{
  "type": "object",
  "properties": {
    "fieldName": {
      "title": "Display Label",
      "componentType": "field_type",
      "helpText": "Optional help text",
      "maxLength": 100
    }
  },
  "required": ["fieldName"],
  "propertyOrder": ["fieldName", "anotherField"]
}
```

## Critical Rules

### 1. Property Names MUST Be camelCase

✅ **Correct**:
```json
{
  "firstName": { "title": "First Name", "componentType": "text" },
  "externalUrl": { "title": "External URL", "componentType": "url" },
  "eventStartDate": { "title": "Event Start", "componentType": "datetime" }
}
```

❌ **Wrong**:
```json
{
  "first_name": { ... },      // ❌ snake_case
  "external_url": { ... },    // ❌ snake_case
  "event_start_date": { ... } // ❌ snake_case
}
```

### 2. Required Fields for Each Property

Every property MUST have:
- ✅ `title` - Display label (not `displayLabel`)
- ✅ `componentType` - The field type/component to use
- ⚠️ `helpText` - Optional but recommended

### 3. Content Goes in Widgets, NOT Schema

❌ **Don't do this**:
```json
{
  "content": {
    "title": "Article Content",
    "componentType": "rich_text"
  }
}
```

✅ **Do this instead**:
```json
// Schema has NO content field
{
  "sourceDate": { "title": "Source Date", "componentType": "date" }
}

// Content goes in Content Widget (handled by ObjectVersion.widgets)
```

**Rule**: Schemas should ONLY contain structured metadata (dates, numbers, URLs, short text). Long content goes in Content Widgets.

## Available Component Types

### Text Fields

#### `text` - Short Text Input
```json
{
  "title": "Short Text Field",
  "componentType": "text",
  "maxLength": 200,
  "minLength": 3,
  "placeholder": "Enter text...",
  "pattern": "^[a-zA-Z0-9]+$",
  "helpText": "Optional help text"
}
```

**Use for**: Names, titles, short descriptions, IDs

#### `email` - Email Input
```json
{
  "title": "Email Address",
  "componentType": "email",
  "placeholder": "user@example.com",
  "helpText": "Enter a valid email address"
}
```

**Use for**: Email addresses (has built-in validation)

#### `url` - URL Input
```json
{
  "title": "Website URL",
  "componentType": "url",
  "maxLength": 500,
  "placeholder": "https://example.com",
  "helpText": "Enter a complete URL including https://"
}
```

**Use for**: Website links, external references

#### `password` - Password Input
```json
{
  "title": "Password",
  "componentType": "password",
  "minLength": 8,
  "showStrengthIndicator": true,
  "helpText": "At least 8 characters"
}
```

**Use for**: Password fields (rarely needed in object schemas)

#### `rich_text` - Rich Text Editor
```json
{
  "title": "Long Description",
  "componentType": "rich_text",
  "helpText": "Formatted text with HTML"
}
```

**⚠️ Warning**: Avoid using `rich_text` in schemas. Use Content Widgets instead for better consistency and widget composition.

### Numeric Fields

#### `number` - Number Input
```json
{
  "title": "Price",
  "componentType": "number",
  "minimum": 0,
  "maximum": 10000,
  "step": 0.01,
  "default": 0,
  "prefix": "$",
  "suffix": "USD",
  "placeholder": "0.00",
  "helpText": "Enter price in USD"
}
```

**Use for**: Prices, measurements, quantities (can be decimal)

**Options**:
- `minimum` - Minimum allowed value
- `maximum` - Maximum allowed value
- `step` - Step increment (0.01 for cents)
- `multipleOf` - Value must be multiple of this number
- `prefix` - Text before number (e.g., "$")
- `suffix` - Text after number (e.g., "kg")
- `showSpinner` - Show up/down arrows (default: true)

#### `integer` - Integer Input
```json
{
  "title": "Quantity",
  "componentType": "number",
  "type": "integer",
  "minimum": 1,
  "maximum": 100,
  "step": 1,
  "default": 1,
  "helpText": "Enter whole number"
}
```

**Use for**: Counts, IDs, years (whole numbers only)

### Date/Time Fields

#### `date` - Date Picker
```json
{
  "title": "Event Date",
  "componentType": "date",
  "helpText": "Select the event date"
}
```

**Use for**: Birth dates, event dates, deadlines

#### `datetime` - Date and Time Picker
```json
{
  "title": "Publishing Date",
  "componentType": "datetime",
  "helpText": "When this should be published"
}
```

**Use for**: Timestamps, scheduled publishing, event start times

### Boolean Fields

#### `boolean` - Checkbox/Toggle
```json
{
  "title": "Featured Item",
  "componentType": "boolean",
  "default": false,
  "trueLabel": "Featured",
  "falseLabel": "Not Featured",
  "helpText": "Mark as featured item"
}
```

**Use for**: Yes/no flags, enabled/disabled states

**Options**:
- `default` - Default value (true/false)
- `trueLabel` - Label when true
- `falseLabel` - Label when false

### Choice Fields

#### `choice` - Single Select Dropdown
```json
{
  "title": "Status",
  "componentType": "choice",
  "enum": ["draft", "published", "archived"],
  "enumLabels": ["Draft", "Published", "Archived"],
  "default": "draft",
  "helpText": "Select publication status"
}
```

**Use for**: Status, category (single selection)

**Required**:
- `enum` - Array of values
- `enumLabels` - (Optional) Human-readable labels for values

#### `multi_choice` - Multi-Select
```json
{
  "title": "Categories",
  "componentType": "multi_choice",
  "enum": ["policy", "technology", "research"],
  "enumLabels": ["Policy", "Technology", "Research"],
  "default": [],
  "minItems": 1,
  "maxItems": 3,
  "helpText": "Select one or more categories"
}
```

**Use for**: Tags, categories (multiple selection)

**Options**:
- `minItems` - Minimum selections required
- `maxItems` - Maximum selections allowed
- `default` - Array of default values

### Media Fields

#### `image` - Image Selector
```json
{
  "title": "Featured Image",
  "componentType": "image",
  "mediaTypes": ["image"],
  "allowedMimeTypes": ["image/jpeg", "image/png", "image/webp"],
  "maxFileSize": 5242880,
  "autoTags": ["featured"],
  "autoCollections": [],
  "helpText": "Main image for this item"
}
```

**Use for**: Photos, illustrations, featured images

**Options**:
- `mediaTypes` - Array: ["image"] (usually just image)
- `allowedMimeTypes` - Specific image formats
- `maxFileSize` - In bytes (5242880 = 5MB)
- `minWidth` / `maxWidth` - Dimension constraints (pixels)
- `minHeight` / `maxHeight` - Dimension constraints (pixels)
- `aspectRatio` - Enforce aspect ratio (e.g., "16:9")
- `autoTags` - Auto-apply these tags to uploads
- `autoCollections` - Auto-add to these collections

#### `file` - File Upload
```json
{
  "title": "Attachment",
  "componentType": "file",
  "allowedFileTypes": ["document", "image", "video"],
  "allowedMimeTypes": ["application/pdf", "image/jpeg"],
  "maxFileSize": 10485760,
  "multiple": false,
  "helpText": "Upload supporting documents"
}
```

**Use for**: PDFs, documents, any file type

**Options**:
- `allowedFileTypes` - Array: ["document", "image", "video", "audio"]
- `allowedMimeTypes` - Specific MIME types
- `maxFileSize` - In bytes (10485760 = 10MB)
- `multiple` - Allow multiple file selection

#### `media` - Media Library Picker
```json
{
  "title": "Media Items",
  "componentType": "media",
  "mediaTypes": ["image", "document"],
  "multiple": true,
  "maxItems": 5,
  "helpText": "Select from media library"
}
```

**Use for**: Selecting existing media from library

### Reference Fields

#### `object_reference` - Reference to Other Objects (NEW)
```json
{
  "title": "Authors",
  "componentType": "object_reference",
  "multiple": true,
  "max_items": 5,
  "allowed_object_types": ["columnist", "contributor"],
  "relationship_type": "authors",
  "default": [],
  "required": false,
  "helpText": "Select columnists who authored this column"
}
```

**Use for**: Linking to other ObjectInstances with configurable constraints. Supports single or multiple references with validation.

**Configuration Options**:
- `multiple` (boolean) - Allow multiple selections (default: false)
- `max_items` (integer) - Maximum items when multiple=true (optional)
- `allowed_object_types` (array) - List of allowed object type names (optional, defaults to all)
- `relationship_type` (string) - Override relationship type name (optional, defaults to field name)
- `default` - Default value ([] for multiple, null for single)

**Single Reference Example**:
```json
{
  "title": "Primary Author",
  "componentType": "object_reference",
  "multiple": false,
  "allowed_object_types": ["columnist"],
  "required": true,
  "helpText": "Select the primary author"
}
```

**Features**:
- Search and autocomplete UI
- Direct PK entry support
- Validates referenced objects exist
- Validates object types match allowed_object_types
- Auto-syncs to ObjectInstance.relationships
- Supports drag-and-drop reordering (when multiple)

**Data Storage**: Stored as array of integer IDs: `[123, 456]` or single integer: `123`

#### `reverse_object_reference` - Reverse Relationship Display (NEW)
```json
{
  "title": "Columns Authored",
  "componentType": "reverse_object_reference",
  "reverse_relationship_type": "authors",
  "reverse_object_types": ["column"],
  "helpText": "Columns where this columnist is listed as an author"
}
```

**Use for**: Read-only display of objects that reference this object (reverse relationships)

**Configuration Options**:
- `reverse_relationship_type` (string) - The relationship type to look for (required)
- `reverse_object_types` (array) - Filter by source object types (optional)

**Features**:
- Read-only field (computed dynamically)
- Shows objects that reference this object
- Filtered by relationship type
- Displays with links to referenced objects
- Count display

**Data Storage**: Not stored - computed from ObjectInstance.related_from

**Note**: This field is automatically populated from the bidirectional relationship system. When object A has an `object_reference` field pointing to object B, object B's `reverse_object_reference` field will show object A.

#### `user_reference` - Reference to User
```json
{
  "title": "Author",
  "componentType": "user_reference",
  "helpText": "Article author"
}
```

**Use for**: Author fields, assignees

### Special Fields

#### `color` - Color Picker
```json
{
  "title": "Brand Color",
  "componentType": "color",
  "default": "#3B82F6",
  "helpText": "Choose brand color"
}
```

**Use for**: Theme colors, highlight colors

#### `slider` - Range Slider
```json
{
  "title": "Priority",
  "componentType": "slider",
  "minimum": 0,
  "maximum": 100,
  "step": 5,
  "default": 50,
  "marks": true,
  "helpText": "Set priority level"
}
```

**Use for**: Ratings, priorities, percentages

#### `array` - Array of Items
```json
{
  "title": "Columnist IDs",
  "componentType": "array",
  "items": {
    "type": "number"
  },
  "default": [],
  "helpText": "Array of columnist ObjectInstance IDs"
}
```

**Use for**: Lists of IDs, tags, multiple values

**Required**:
- `items` - Schema for array items
  - `items.type` - Item type ("number", "string", "object")

## Complete Examples

### News Article Schema

```json
{
  "type": "object",
  "properties": {
    "sourceDate": {
      "title": "Source Date",
      "componentType": "date",
      "helpText": "Original publication date"
    },
    "externalUrl": {
      "title": "External URL",
      "componentType": "url",
      "maxLength": 500,
      "helpText": "Link to original article"
    },
    "featuredImage": {
      "title": "Featured Image",
      "componentType": "image",
      "mediaTypes": ["image"],
      "maxFileSize": 5242880,
      "helpText": "Main image for the article"
    }
  },
  "required": [],
  "propertyOrder": ["featuredImage", "sourceDate", "externalUrl"]
}
```

**Note**: Article content goes in Content Widget, NOT in schema!

### Event Schema

```json
{
  "type": "object",
  "properties": {
    "eventType": {
      "title": "Event Type",
      "componentType": "choice",
      "enum": ["conference", "workshop", "webinar", "meetup"],
      "enumLabels": ["Conference", "Workshop", "Webinar", "Meetup"],
      "helpText": "Type of event"
    },
    "venue": {
      "title": "Venue",
      "componentType": "text",
      "maxLength": 200,
      "helpText": "Event location"
    },
    "eventStartDate": {
      "title": "Start Date",
      "componentType": "datetime",
      "helpText": "When the event starts"
    },
    "eventEndDate": {
      "title": "End Date",
      "componentType": "datetime",
      "helpText": "When the event ends"
    },
    "priority": {
      "title": "Featured Event",
      "componentType": "boolean",
      "default": false,
      "helpText": "Mark as featured"
    }
  },
  "required": ["eventStartDate"],
  "propertyOrder": ["eventType", "eventStartDate", "eventEndDate", "venue", "priority"]
}
```

### Conference Paper Schema

```json
{
  "type": "object",
  "properties": {
    "authors": {
      "title": "Authors",
      "componentType": "text",
      "maxLength": 500,
      "helpText": "Paper authors (comma-separated)"
    },
    "docNummer": {
      "title": "Document Number",
      "componentType": "text",
      "maxLength": 50,
      "helpText": "Unique paper identifier"
    },
    "peerReview": {
      "title": "Peer Reviewed",
      "componentType": "boolean",
      "default": false,
      "helpText": "Was this peer-reviewed?"
    },
    "panelId": {
      "title": "Panel",
      "componentType": "object_reference",
      "referenceType": "conference_panel",
      "helpText": "Panel this was presented in"
    }
  },
  "required": ["authors"],
  "propertyOrder": ["docNummer", "authors", "peerReview", "panelId"]
}
```

**Note**: Abstract goes in Content Widget. PDF files attached as media.

## Field Type Reference

### Quick Component Type Selection Guide

| Data Type | Use Component Type | Example |
|-----------|-------------------|---------|
| Short text | `text` | Name, title, ID |
| Long text | Content Widget | Article, description, bio |
| Email | `email` | Contact email |
| URL | `url` | Website, external link |
| Whole number | `number` + `type: "integer"` | Count, year |
| Decimal | `number` | Price, rating |
| Yes/No | `boolean` | Featured, enabled |
| Date only | `date` | Birth date, deadline |
| Date + time | `datetime` | Publishing date, event time |
| Pick one option | `choice` | Status, type |
| Pick multiple | `multi_choice` | Categories, tags |
| Image | `image` | Photo, logo |
| File | `file` | PDF, document |
| Color | `color` | Theme color |
| User | `user_reference` | Author, assignee |
| Link to object(s) | `object_reference` | Authors, related items, parent (NEW - supports constraints) |
| Reverse links | `reverse_object_reference` | Columns authored (NEW - read-only, computed) |
| List of values | `array` | IDs, tags |

## Component Type Options

### Text Component Options

```json
{
  "componentType": "text",
  "maxLength": 200,        // Maximum characters
  "minLength": 3,          // Minimum characters
  "pattern": "regex",      // Validation pattern
  "placeholder": "text",   // Placeholder text
  "default": "value"       // Default value
}
```

### Number Component Options

```json
{
  "componentType": "number",
  "type": "integer",       // Optional: force integers
  "minimum": 0,            // Min value
  "maximum": 100,          // Max value
  "step": 1,               // Increment step
  "multipleOf": 5,         // Must be multiple of
  "prefix": "$",           // Prefix symbol
  "suffix": "kg",          // Suffix unit
  "showSpinner": true,     // Show +/- controls
  "default": 0             // Default value
}
```

### Choice Component Options

```json
{
  "componentType": "choice",
  "enum": ["value1", "value2"],           // Required: option values
  "enumLabels": ["Label 1", "Label 2"],   // Optional: display labels
  "default": "value1"                     // Default selection
}
```

### Multi-Choice Component Options

```json
{
  "componentType": "multi_choice",
  "enum": ["opt1", "opt2", "opt3"],
  "enumLabels": ["Option 1", "Option 2", "Option 3"],
  "default": [],           // Array of defaults
  "minItems": 1,           // Min selections
  "maxItems": 3            // Max selections
}
```

### Image Component Options

```json
{
  "componentType": "image",
  "mediaTypes": ["image"],                    // Always ["image"] for images
  "allowedMimeTypes": [                       // Optional: specific formats
    "image/jpeg",
    "image/png", 
    "image/webp"
  ],
  "maxFileSize": 5242880,                     // Max size in bytes (5MB)
  "minWidth": 800,                            // Min width in pixels
  "maxWidth": 4000,                           // Max width in pixels
  "minHeight": 600,                           // Min height in pixels
  "maxHeight": 3000,                          // Max height in pixels
  "aspectRatio": "16:9",                      // Enforce aspect ratio
  "autoTags": ["featured"],                   // Auto-apply tags
  "autoCollections": ["hero-images"]          // Auto-add to collections
}
```

### File Component Options

```json
{
  "componentType": "file",
  "allowedFileTypes": [                       // File categories
    "document",
    "image",
    "video",
    "audio"
  ],
  "allowedMimeTypes": [                       // Specific MIME types
    "application/pdf",
    "application/msword"
  ],
  "maxFileSize": 10485760,                    // Max size (10MB)
  "multiple": false,                          // Allow multiple files
  "autoTags": ["attachment"]                  // Auto-apply tags
}
```

### Object Reference Options

```json
{
  "componentType": "object_reference",
  "multiple": true,                           // Allow multiple selections (default: false)
  "max_items": 5,                             // Max items when multiple (optional)
  "allowed_object_types": ["columnist"],      // Allowed object type names (optional)
  "relationship_type": "authors",             // Override relationship name (optional, defaults to field name)
  "default": [],                              // Default value ([] for multiple, null for single)
  "required": false,                          // Is field required
  "helpText": "Select authors"
}
```

**Single Reference Options**:
```json
{
  "componentType": "object_reference",
  "multiple": false,
  "allowed_object_types": ["columnist"],
  "required": true
}
```

**Features**:
- Validates referenced objects exist
- Validates object types
- Auto-syncs to ObjectInstance.relationships
- Search and autocomplete UI
- Direct PK entry support
- Drag-to-reorder (when multiple)

### Reverse Object Reference Options

```json
{
  "componentType": "reverse_object_reference",
  "reverse_relationship_type": "authors",      // Required: relationship type to look for
  "reverse_object_types": ["column"],          // Optional: filter by source object types
  "helpText": "Columns authored"
}
```

**Features**:
- Read-only field (computed automatically)
- Shows objects that reference this object
- Filtered by relationship type and object types
- Displays with links and count
- Not stored (computed from related_from)

### Array Component Options

```json
{
  "componentType": "array",
  "items": {                                  // Required: item schema
    "type": "number"
  },
  "default": [],                              // Empty array default
  "minItems": 0,                              // Min number of items
  "maxItems": 10,                             // Max number of items
  "uniqueItems": true                         // No duplicate values
}
```

## Common Patterns

### Pattern 1: Required Text Field with Validation

```json
{
  "title": "Document ID",
  "componentType": "text",
  "maxLength": 20,
  "pattern": "^[A-Z]{2}[0-9]{4}$",
  "placeholder": "AB1234",
  "helpText": "Format: 2 letters + 4 numbers"
}
```

Add to `required` array: `"required": ["documentId"]`

### Pattern 2: Optional URL with Max Length

```json
{
  "title": "Website",
  "componentType": "url",
  "maxLength": 500,
  "placeholder": "https://example.com",
  "helpText": "Optional website URL"
}
```

Don't add to `required` array (it's optional).

### Pattern 3: Date Range (Start/End)

```json
{
  "eventStartDate": {
    "title": "Start Date",
    "componentType": "datetime",
    "helpText": "When the event starts"
  },
  "eventEndDate": {
    "title": "End Date",
    "componentType": "datetime",
    "helpText": "When the event ends"
  }
}
```

### Pattern 4: Multiple Images

```json
{
  "gallery": {
    "title": "Image Gallery",
    "componentType": "image",
    "multiple": true,
    "maxItems": 10,
    "maxFileSize": 5242880,
    "helpText": "Upload up to 10 images"
  }
}
```

### Pattern 5: Parent-Child Relationship

```json
{
  "conferenceId": {
    "title": "Parent Conference",
    "componentType": "object_reference",
    "referenceType": "conference",
    "helpText": "Conference this panel belongs to"
  }
}
```

Mark as required: `"required": ["conferenceId"]`

### Pattern 6: Array of Object IDs (DEPRECATED - Use object_reference)

**Old Way** (still works but not recommended):
```json
{
  "columnistIds": {
    "title": "Columnists",
    "componentType": "array",
    "items": {
      "type": "number"
    },
    "default": [],
    "helpText": "Array of columnist ObjectInstance IDs"
  }
}
```

**New Way** (RECOMMENDED - Use object_reference):
```json
{
  "authors": {
    "title": "Authors",
    "componentType": "object_reference",
    "multiple": true,
    "max_items": 5,
    "allowed_object_types": ["columnist"],
    "relationship_type": "authors",
    "default": [],
    "helpText": "Select columnists who authored this column"
  }
}
```

**Benefits of object_reference**:
- Validates referenced objects exist
- Validates object types
- Auto-syncs to relationships infrastructure
- Better UI (search, autocomplete)
- Bidirectional relationships
- Supports reverse lookups

### Pattern 7: Reverse Relationships (NEW)

```json
{
  "columns_authored": {
    "title": "Columns Authored",
    "componentType": "reverse_object_reference",
    "reverse_relationship_type": "authors",
    "reverse_object_types": ["column"],
    "helpText": "Columns where this columnist is listed as an author"
  }
}
```

**Use case**: Display list of objects that reference this object

**Features**:
- Read-only (computed automatically)
- Shows reverse relationships
- Filtered by type
- Links to related objects

**Example**: When a column has `authors: [columnist.id]`, the columnist's `columns_authored` field will automatically show `[column.id]`

## Validation and Best Practices

### ✅ DO

1. **Use camelCase** for all property names
2. **Include `title`** for every field
3. **Include `componentType`** for every field
4. **Add `helpText`** to guide users
5. **Set reasonable `maxLength`** for text fields
6. **Use Content Widgets** for long text/HTML
7. **Specify `required`** fields in the array
8. **Order fields** with `propertyOrder`
9. **Set sensible defaults** where appropriate
10. **Use appropriate component types** for data

### ❌ DON'T

1. **Don't use snake_case** (e.g., first_name)
2. **Don't use `displayLabel`** (use `title`)
3. **Don't put content in schema** (use Content Widgets)
4. **Don't use `rich_text`** unless absolutely necessary
5. **Don't forget validation constraints** (min/max)
6. **Don't make everything required** (only require essentials)
7. **Don't use text for dates** (use `date` or `datetime`)
8. **Don't use text for choices** (use `choice`)
9. **Don't duplicate object-level fields** (title, slug are on ObjectInstance)
10. **Don't use generic types** when specific ones exist

## Testing Your Schema

### 1. JSON Validation

```bash
# Validate JSON syntax
python -m json.tool your_schema.json > /dev/null && echo "✅ Valid" || echo "❌ Invalid"
```

### 2. Frontend Validation

Load in ObjectType editor:
- All fields show ✅ Valid badge
- No "Component type is required" errors
- No "Invalid key format" errors
- Can save without errors

### 3. Create Test Object

Create an ObjectInstance with your schema:
- All fields render correctly
- Validation works as expected
- Data saves properly
- Fields display with correct components

## Migration Schema Checklist

When creating schemas for data migration:

- [ ] Property names in camelCase
- [ ] Each property has `title`
- [ ] Each property has `componentType`
- [ ] Content fields removed (use Content Widgets)
- [ ] Appropriate component types chosen
- [ ] Max lengths set for text fields
- [ ] Required fields identified
- [ ] propertyOrder defined
- [ ] Help text added
- [ ] Defaults set where appropriate
- [ ] JSON validates (no syntax errors)
- [ ] Validates in frontend editor
- [ ] Can create ObjectTypeDefinition successfully

## Common Mistakes

### Mistake 1: Using snake_case
```json
// ❌ Wrong
{"user_name": {"title": "Username", "componentType": "text"}}

// ✅ Correct
{"userName": {"title": "Username", "componentType": "text"}}
```

### Mistake 2: Using displayLabel
```json
// ❌ Wrong
{"name": {"displayLabel": "Name", "componentType": "text"}}

// ✅ Correct
{"name": {"title": "Name", "componentType": "text"}}
```

### Mistake 3: Content in Schema
```json
// ❌ Wrong
{"content": {"title": "Article", "componentType": "rich_text"}}

// ✅ Correct - No content field! Use Content Widget instead
{}
```

### Mistake 4: Wrong Type for Data
```json
// ❌ Wrong - using text for date
{"eventDate": {"title": "Date", "componentType": "text"}}

// ✅ Correct
{"eventDate": {"title": "Date", "componentType": "datetime"}}
```

### Mistake 5: Forgetting componentType
```json
// ❌ Wrong
{"name": {"title": "Name"}}

// ✅ Correct
{"name": {"title": "Name", "componentType": "text"}}
```

## Quick Start Template

Use this template as a starting point:

```json
{
  "type": "object",
  "properties": {
    "myField": {
      "title": "My Field",
      "componentType": "text",
      "helpText": "Description of what this field is for"
    }
  },
  "required": [],
  "propertyOrder": ["myField"]
}
```

**Steps**:
1. Copy template
2. Replace `myField` with camelCase name
3. Replace `"My Field"` with display label
4. Choose appropriate `componentType`
5. Add options for that component type
6. Add to `required` if needed
7. Add more fields as needed
8. Update `propertyOrder`

## Getting Help

- **Component types list**: Open ComponentType selector in frontend editor
- **Field options**: Check specific PropertyConfig component
- **Examples**: See schemas in `backend/scripts/migration/schemas/`
- **Validation**: Use frontend ObjectType editor - it validates automatically
- **Documentation**: See `FIELD_NAME_MAPPING.md` for field name conversions

---

**Quick Reference**: Use ComponentType selector in frontend to see all available types with descriptions!

