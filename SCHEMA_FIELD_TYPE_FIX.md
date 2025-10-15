# Schema Field Type Fix - Complete Solution

## Problem Identified

The Schema Editor save was failing with two related validation errors:

### Error 1: Missing `type` Field
```
Property "presentationalPublishingDate" must have a valid type
```

### Error 2: Missing `field_type` or `component` Field  
```
Property 'presentational_publishing_date' must have either a 'field_type' or 'component' field
```

## Root Cause

The backend validation (in `backend/utils/schema_system.py`) requires each property to have:

1. **`type`** - The JSON Schema data type (`string`, `integer`, `boolean`, `array`, `object`)
2. **`field_type` OR `component`** - Either the field type key (e.g., "datetime") or the component name

But the frontend SchemaEditor was:
- Not including the `type` field
- Using `componentType` instead of `field_type`

## Solution Implemented

### 1. Automatic `type` Field Generation

Added a mapping function in `SchemaEditor.jsx` that automatically adds the correct `type` based on `componentType`:

```javascript
const getJsonSchemaType = (componentType, isMultiple = false) => {
  const typeMapping = {
    'text': 'string',
    'textarea': 'string',
    'rich_text': 'string',
    'number': 'number',
    'integer': 'integer',
    'date': 'string',
    'datetime': 'string',
    'time': 'string',
    'boolean': 'boolean',
    'image': 'string',
    'file': 'string',
    'url': 'string',
    'email': 'string',
    'choice': 'string',
    'multi_choice': 'array',
    'user_reference': isMultiple ? 'array' : 'integer',
    'object_reference': isMultiple ? 'array' : 'integer',
    'reverse_object_reference': 'array',
    'tag': 'array',
    'date_range': 'object',
    'object_type_selector': 'string',
  }
  
  return typeMapping[componentType] || 'string'
}
```

### 2. Field Name Translation

The SchemaEditor now translates between frontend and backend field names:

**When reading from backend (convertSchemaToProperties):**
```javascript
if (prop.field_type && !prop.componentType) {
  prop.componentType = prop.field_type
}
```

**When writing to backend (convertPropertiesToSchema):**
```javascript
// Ensure the property has a 'type' field
if (!schemaProp.type && schemaProp.componentType) {
  schemaProp.type = getJsonSchemaType(schemaProp.componentType, schemaProp.multiple)
}

// Backend expects 'field_type' not 'componentType'
if (schemaProp.componentType) {
  schemaProp.field_type = schemaProp.componentType
  delete schemaProp.componentType
}
```

### 3. Normalization in ObjectTypeForm

Updated the schema normalization function to:
- Handle both `field_type` and `componentType`
- Automatically add `type` field if missing
- Normalize to `field_type` for consistent comparison

## Files Modified

1. **frontend/src/components/schema-editor/SchemaEditor.jsx**
   - Added `getJsonSchemaType()` function
   - Updated `convertSchemaToProperties()` to convert `field_type` → `componentType`
   - Updated `convertPropertiesToSchema()` to add `type` and convert `componentType` → `field_type`

2. **frontend/src/components/ObjectTypeForm.jsx**
   - Updated `normalizeSchema()` to handle both field naming conventions
   - Automatically adds `type` field if missing
   - Normalizes to `field_type` for comparison

## Expected Schema Format

### Frontend Internal Format (during editing):
```json
{
  "type": "object",
  "properties": {
    "presentationalPublishingDate": {
      "title": "Publishing Date",
      "componentType": "datetime",
      "helpText": "Date the column was published"
    }
  }
}
```

### Backend Format (when saving):
```json
{
  "type": "object",
  "properties": {
    "presentationalPublishingDate": {
      "type": "string",
      "title": "Publishing Date",
      "field_type": "datetime",
      "helpText": "Date the column was published"
    }
  },
  "required": ["presentationalPublishingDate"],
  "propertyOrder": ["presentationalPublishingDate", ...]
}
```

## Testing

1. Navigate to any object type editor
2. Go to "Schema Fields" tab
3. The schema should load without errors
4. Make any change to trigger save button
5. Click "Save Schema"
6. Should see success toast: "Schema saved successfully!"

## Verification in Console

Check the console logs to see the transformation:

```javascript
[ObjectTypeForm] Calling API to update schema...
{
  schema: {
    type: "object",
    properties: {
      presentationalPublishingDate: {
        type: "string",              // ✅ Automatically added
        field_type: "datetime",      // ✅ Converted from componentType
        title: "Publishing Date",
        helpText: "..."
      }
    }
  }
}
```

## Backward Compatibility

The solution handles both old and new schemas:
- Old schemas with `componentType` are automatically converted
- New schemas from backend with `field_type` are converted to `componentType` for editing
- Both formats are normalized for comparison to prevent false change detection

## Success Criteria

✅ Schema validation passes  
✅ Properties have `type` field  
✅ Properties have `field_type` field  
✅ Save button works correctly  
✅ Toast notifications show success/error  
✅ Console logs show the complete flow  
✅ Backward compatible with existing schemas

