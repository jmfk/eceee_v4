# Next Steps: Investigation Tasks

## ✅ Completed: Property Config Components

Successfully implemented 6 PropertyConfig components for the Schema Editor:
- ObjectReferencePropertyConfig
- ReverseObjectReferencePropertyConfig
- ObjectTypeSelectorPropertyConfig  
- UserSelectorPropertyConfig
- TagPropertyConfig
- DateRangePropertyConfig

**User can now configure object_reference fields via forms!** ✨

---

## 🔍 Next: Investigate "Loading component: Unknown" Error

### Problem Description

When editing an object instance (e.g., editing a Column object) that has an `object_reference` field, the form shows:

```
Loading component: Unknown
```

Instead of rendering the ObjectReferenceInput component.

### Key Distinction

This is a **different issue** from the PropertyConfig work we just completed:

| Issue | Location | Purpose |
|-------|----------|---------|
| **PropertyConfig** (✅ Fixed) | Schema Editor | Configure field **definition** in Object Type |
| **Form Field Component** (🔍 To investigate) | Object Instance Editor | Render field **data input** when editing object |

### Investigation Plan

#### Step 1: Identify Where Error Occurs

**Likely Location**: `frontend/src/components/ObjectInstanceEditor.jsx` or related form rendering components

**Search for**:
```javascript
"Loading component:"
// Component loading logic
// Dynamic component import
```

#### Step 2: Check Component Registry

**File**: `frontend/src/components/form-fields/index.js`

**Verify**:
- Is `ObjectReferenceInput` exported?
- Is it in the `FIELD_COMPONENTS` registry?
- Does the dynamic loader handle it correctly?

**Current Status** (needs verification):
```javascript
export { default as ObjectReferenceInput } from './ObjectReferenceInput'  // ✅ Exists
export const FIELD_COMPONENTS = {
  ObjectReferenceInput: () => import('./ObjectReferenceInput'),  // ✅ Exists
}
```

#### Step 3: Check Component Type Mapping

**Issue**: Backend sends `componentType: "object_reference"` but frontend may be looking for different key.

**Check mapping**:
- Backend field type key: `"object_reference"`
- Frontend component name: `"ObjectReferenceInput"`
- Is there a mapping between these?

**Likely file**: Field type registry or form renderer

#### Step 4: Check Component Implementation

**File**: `frontend/src/components/form-fields/ObjectReferenceInput.jsx`

**Verify**:
- Does component exist and export correctly?
- Are all props being passed correctly?
- Does it handle the data format from backend?

#### Step 5: Check Error Handling

**Search for**: `"Unknown"` in codebase to find error message source

**Check**:
- What triggers "Loading component: Unknown"?
- Is it a loading state, error state, or fallback?
- Are there console errors with more details?

### Potential Root Causes

1. **Component Name Mismatch**
   - Backend: `componentType: "object_reference"` 
   - Frontend expects: `"ObjectReferenceInput"`
   - Missing mapping between snake_case and PascalCase

2. **Missing Component Registry Entry**
   - Component exists but not registered in FIELD_COMPONENTS
   - Or registered with wrong key

3. **Import/Export Issue**
   - Component not exported from index.js
   - Dynamic import failing
   - Circular dependency

4. **Props Mismatch**
   - Component expects certain props
   - Form renderer not providing them
   - Causing component to fail loading

5. **Async Loading Issue**
   - Component stuck in loading state
   - Promise not resolving
   - Error not being caught

### Debugging Steps

1. **Add Console Logs**
   ```javascript
   console.log('Attempting to load component:', componentType)
   console.log('Available components:', Object.keys(FIELD_COMPONENTS))
   ```

2. **Check Browser Console**
   - Look for import errors
   - Check network tab for failed module loads
   - Look for React errors

3. **Try Direct Import**
   - Replace dynamic import with static import temporarily
   - See if component loads

4. **Check Data Flow**
   - Log the schema field definition
   - Log what componentType is being requested
   - Log what gets resolved

### Expected Fix

Once root cause is identified, likely solutions:

**If it's a mapping issue:**
```javascript
// Add mapping from backend field type to frontend component
const COMPONENT_TYPE_MAP = {
  'object_reference': 'ObjectReferenceInput',
  'reverse_object_reference': 'ReverseObjectReferenceDisplay',
  // ...
}
```

**If it's a registry issue:**
```javascript
// Ensure proper export in index.js
export { default as ObjectReferenceInput } from './ObjectReferenceInput'
```

**If it's an import issue:**
```javascript
// Fix dynamic import
ObjectReferenceInput: () => import('./ObjectReferenceInput').then(m => m.default)
```

### Testing After Fix

1. Edit an object instance with object_reference field
2. Verify ObjectReferenceInput component renders
3. Verify it can select and save object references
4. Test with both single and multiple references
5. Test with different allowedObjectTypes

### Files to Investigate

```
frontend/src/components/
├── ObjectInstanceEditor.jsx          # Form renderer
├── objectEdit/
│   ├── ObjectDataForm.jsx           # Data form component
│   └── ObjectDataView.jsx           # Data view component
├── form-fields/
│   ├── index.js                     # Component registry
│   ├── ObjectReferenceInput.jsx    # The component itself
│   └── ReverseObjectReferenceDisplay.jsx
└── DynamicFormField.jsx             # Dynamic field loader (if exists)
```

### Priority

🔴 **HIGH** - Users cannot edit object instances with object_reference fields until this is fixed.

However, the PropertyConfig work we just completed is independent and valuable - users can now configure the schema properly, even if the runtime form rendering needs fixing.

---

## Summary

- ✅ **Phase 1 Complete**: PropertyConfig components for schema configuration
- 🔍 **Phase 2 Needed**: Investigate and fix form field component loading
- 📝 **Documentation**: Both phases documented separately

The PropertyConfig implementation stands on its own and provides immediate value. The form rendering issue is a separate concern that needs investigation.

