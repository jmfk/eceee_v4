# Property Config Component Lookup Bug - Fixed ✅

## Problem

User reported: "Nothing is solved. I can see Component Type = Object Reference in Columns but the form fields for `multiple`, `maxItems`, `relationshipType`, and `allowedObjectTypes` don't show up."

Screenshot showed:
```
⚠️ Generic Configuration
No specific configuration component found for "". Using generic settings.
```

## Root Cause

**Bug Location**: `frontend/src/components/schema-editor/PropertyItem.jsx` (line 31)

**Original Code**:
```javascript
const propertyType = getPropertyTypeByComponent(property.component)
```

**Problem**: 
1. The property object has `componentType: "object_reference"` (field type KEY)
2. But `property.component` is undefined or empty
3. `getPropertyTypeByComponent()` expects a COMPONENT NAME like "ObjectReferenceInput"
4. Lookup failed → fell back to GenericPropertyConfig

## The Fix

**File**: `frontend/src/components/schema-editor/PropertyItem.jsx`

**Changed from**:
```javascript
const propertyType = getPropertyTypeByComponent(property.component)
const ConfigComponent = propertyType?.component || GenericPropertyConfig
```

**Changed to**:
```javascript
// property.componentType contains the field type KEY (e.g., "object_reference")
// We look up by the field type key to get the PropertyConfig component
const fieldTypeKey = property.componentType
const propertyType = fieldTypeKey ? getPropertyType(fieldTypeKey) : null
const ConfigComponent = propertyType?.component || GenericPropertyConfig
```

**Why This Works**:
- `property.componentType` = `"object_reference"` (field type KEY from schema)
- `getPropertyType("object_reference")` looks up in PropertyTypeRegistry Map by key
- Map entry has `component: ObjectReferencePropertyConfig` 
- ConfigComponent = ObjectReferencePropertyConfig ✅

## Data Flow Explained

### 1. Schema Storage
```json
{
  "properties": {
    "authors": {
      "title": "Authors",
      "componentType": "object_reference",  ← Field type KEY
      "multiple": true,
      "maxItems": 5
    }
  }
}
```

### 2. PropertyTypeRegistry Initialization
```javascript
// Backend returns field type:
{
  key: "object_reference",          ← Used as Map key
  label: "Object Reference",
  component: "ObjectReferenceInput"  ← Component name for rendering
}

// Registry stores:
Map.set("object_reference", {
  key: "object_reference",
  component: ObjectReferencePropertyConfig,  ← PropertyConfig component!
  fieldComponent: "ObjectReferenceInput",
  defaultConfig: { component: "ObjectReferenceInput" }
})
```

### 3. PropertyItem Lookup (After Fix)
```javascript
const fieldTypeKey = property.componentType  // "object_reference"
const propertyType = getPropertyType(fieldTypeKey)  // Map.get("object_reference")
const ConfigComponent = propertyType?.component  // ObjectReferencePropertyConfig ✅
```

## Additional Fix

**File**: `frontend/src/components/schema-editor/property-configs/GenericPropertyConfig.jsx`

**Improved Warning Message**:
```javascript
// Before:
<div>No specific configuration component found for "{property.component}".</div>

// After:  
<div>No specific configuration component found for "{property.componentType || property.component || 'undefined'}".</div>
```

This shows the actual value being looked up, helping debug similar issues.

## Testing

### Test Steps

1. **Refresh the page** (Ctrl+R or Cmd+R)
   - PropertyTypeRegistry needs to reinitialize with new mappings

2. **Navigate to Schema Editor**
   ```
   Settings → Object Types → Edit Column → Schema Tab
   ```

3. **Expand the "Authors" property**
   - Click to expand the property

4. **Verify the form appears**
   - You should now see ObjectReferencePropertyConfig form
   - ⚠️ Warning banner should be GONE
   - ✅ Form should show: multiple, maxItems, relationshipType, allowedObjectTypes

### Expected Result

**Before (Bug)**:
```
⚠️ Generic Configuration
No specific configuration component found for "". Using generic settings.

Property Key: [authors]
Display Label: [Authors]
Component Type: [Object Reference ▼]
Description: [...]
Default Value: [...]
☐ Required field
▶ Advanced: Raw Configuration
```

**After (Fixed)**:
```
Property Key: [authors]
Display Label: [Authors]  
Component Type: [Object Reference ▼]
Description: [...]

─── Reference Configuration ───
☑ Allow Multiple References
    Max Items: [5]
Relationship Type: [authors]
Allowed Object Types:
  ☑ Columnist (columnist)
  ☐ News Article (news)
  ...

☐ Required field
```

## Files Modified

1. `frontend/src/components/schema-editor/PropertyItem.jsx`
   - Fixed component lookup to use field type KEY instead of component name
   
2. `frontend/src/components/schema-editor/property-configs/GenericPropertyConfig.jsx`
   - Improved warning message to show actual lookup value

## Success Criteria

- ✅ No more "Generic Configuration" warning for object_reference fields
- ✅ ObjectReferencePropertyConfig form fields visible
- ✅ Can configure: multiple, maxItems, relationshipType, allowedObjectTypes
- ✅ Can select from list of available object types (fetched from API)
- ✅ Changes saved correctly to schema JSON

## If It Still Doesn't Work

### Debug Checklist

1. **Check Browser Console**
   - Look for errors during PropertyTypeRegistry initialization
   - Check if field types loaded successfully

2. **Verify Field Type in Backend**
   ```bash
   # In Django shell:
   from utils.schema_system import field_registry
   print(field_registry.get_field_type('object_reference'))
   ```

3. **Check PropertyTypeRegistry Contents**
   ```javascript
   // In browser console:
   import { propertyTypeRegistry } from './components/schema-editor/PropertyTypeRegistry'
   console.log(propertyTypeRegistry.propertyConfigComponents)
   console.log(propertyTypeRegistry.getPropertyType('object_reference'))
   ```

4. **Verify property.componentType Value**
   - Add console.log in PropertyItem to see actual value
   - Check if it's "object_reference" or something else

### Common Issues

1. **Registry Not Initialized**
   - PropertyTypeRegistry.initialize() might not have completed
   - Check async initialization

2. **Field Type Not Loaded**
   - Backend might not be returning object_reference field type
   - Check API response from `/api/v1/utils/field-types/`

3. **Wrong Key Format**
   - componentType might be stored as "object-reference" (dash) vs "object_reference" (underscore)
   - Check exact key format in schema JSON

## Conclusion

The bug was a simple but critical mismatch: PropertyItem was looking up PropertyConfig components by component NAME ("ObjectReferenceInput") when the property object only had the field type KEY ("object_reference").

The fix ensures we look up by the correct field in the correct registry method.

**Status**: ✅ Bug Fixed - Awaiting User Testing

