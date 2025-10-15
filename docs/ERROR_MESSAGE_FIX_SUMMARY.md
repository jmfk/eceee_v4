# Error Message Fix and Debugging Enhancement

## Problem

The error handling code was hiding the real backend error messages, making it impossible to debug the actual issue:

**What the backend sent:**
```
Required property 'presentationalPublishingDate' not found in properties
```

**What the user saw:**
```
Schema validation failed. Please check that all properties are properly configured.
```

This generic message was hiding the critical information about which property was missing!

## Solution Implemented

### 1. Fixed Error Message Display

**File:** `frontend/src/components/ObjectTypeForm.jsx`

Changed the error handling to:
- ✅ Extract and display the REAL backend error message
- ✅ Parse Django REST Framework `ErrorDetail` objects properly
- ✅ Extract error messages from nested JSON strings
- ✅ Show full error details in toast notifications (8 second duration)
- ✅ Log detailed error information to console

**Before:**
```javascript
if (backendError.includes('properties')) {
    errorMessage = 'Schema validation failed. Please check that all properties are properly configured.'
}
```

**After:**
```javascript
// Extract the REAL backend error message - don't hide it!
if (error.response?.data?.schema) {
    // Parse ErrorDetail objects and extract actual messages
    errorMessage = `Schema validation error: ${detailedError}`
}
```

### 2. Added Comprehensive Schema Logging

Added detailed logging before sending the schema to help debug issues:

**In ObjectTypeForm.jsx:**
- Logs object type ID
- Logs schema structure (property count, keys, required, propertyOrder)
- Logs each property in detail (type, field_type, componentType, title)
- Logs full schema as formatted JSON
- Client-side validation check for missing required properties

**In SchemaEditor.jsx:**
- Logs when conversion starts and how many properties
- Logs each property during processing
- Logs when type field is added
- Logs when componentType is renamed to field_type
- Logs final schema structure

## Expected Console Output

When you click Save now, you'll see:

```javascript
[SchemaEditor] convertPropertiesToSchema called with 3 properties
[SchemaEditor] Processing property 0: { key: 'presentationalPublishingDate', required: true, ... }
[SchemaEditor] Added type 'string' for presentationalPublishingDate
[SchemaEditor] Renamed componentType to field_type for presentationalPublishingDate
[SchemaEditor] Added property 'presentationalPublishingDate' to schema. Required: true
...
[SchemaEditor] Final schema: { propertyCount: 3, propertyKeys: [...], required: [...] }

[ObjectTypeForm] Calling API to update schema...
[ObjectTypeForm] Object Type ID: 5
[ObjectTypeForm] Schema structure: { type: 'object', propertyCount: 3, ... }
[ObjectTypeForm] Properties in detail:
  - presentationalPublishingDate: { hasType: true, type: 'string', hasFieldType: true, field_type: 'datetime', ... }
  - authors: { ... }
  - priority: { ... }
[ObjectTypeForm] Full schema as JSON:
{
  "type": "object",
  "properties": {
    "presentationalPublishingDate": { ... }
  },
  "required": ["presentationalPublishingDate"],
  "propertyOrder": ["presentationalPublishingDate", "authors", "priority"]
}
```

## Next Steps to Debug

With this detailed logging, we can now see:

1. **Is the property in the schema being sent?**
   - Check the "Full schema as JSON" log
   - Check if `presentationalPublishingDate` is in the properties object

2. **Is the property key in the required array?**
   - Check if the key matches exactly
   - camelCase vs snake_case issue?

3. **What does the backend actually receive?**
   - The console logs show what JavaScript is sending
   - Backend might be transforming the keys

## Possible Issues to Look For

### Issue 1: Case Transformation
The error message shows `presentationalPublishingDate` (camelCase) but the backend might be expecting `presentational_publishing_date` (snake_case).

### Issue 2: Property Order vs Properties
The backend validates that items in `required` exist in `properties`. Check if:
- The key names match exactly
- Both are using the same case convention
- The backend isn't transforming one but not the other

### Issue 3: Schema Mutation
Check if something is modifying the schema between SchemaEditor and the API call:
- The normalization function might be changing keys
- The API serialization might be transforming keys

## Testing

1. Open browser console
2. Navigate to object type editor → Schema Fields tab
3. Click Save Schema
4. Review the detailed console logs
5. Compare what's sent vs what backend says is missing
6. Note the EXACT error message now visible in the toast

The real error message will now be visible, and the comprehensive logs will help identify where the property is being lost or transformed!

