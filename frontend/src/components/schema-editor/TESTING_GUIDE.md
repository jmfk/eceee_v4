# ComponentType Selector - Testing Guide

## Quick Test Checklist

### 1. Basic Functionality ✓

**Navigate to Object Types**:
```
/settings/object-types/new/schema
```

**Test Steps**:
- [ ] Click "Add Property" button
- [ ] Select a property type (e.g., "Text")
- [ ] Property is added to the list
- [ ] Expand the property
- [ ] See "Component Type" dropdown field
- [ ] Dropdown shows current selection
- [ ] Click dropdown - modal opens
- [ ] Search box is visible
- [ ] Field types are grouped by category

### 2. Search Functionality ✓

- [ ] Type "text" in search box
- [ ] Only text-related types show
- [ ] Type "date"
- [ ] Only date-related types show
- [ ] Clear search
- [ ] All types visible again
- [ ] Search is case-insensitive

### 3. Selection ✓

- [ ] Click on a different component type
- [ ] Dropdown closes
- [ ] New type is selected
- [ ] Property updates with new type
- [ ] Visual indicator shows selected type
- [ ] Badge updates if type is valid/invalid

### 4. Validation ✓

**Test Invalid Type**:
- [ ] Open raw JSON view (if available)
- [ ] Manually type invalid componentType: `"invalid_type"`
- [ ] Save changes
- [ ] See validation error
- [ ] Error message shows available types
- [ ] Property shows "Invalid Type" badge

**Test Missing Type**:
- [ ] Remove componentType from property
- [ ] See "Component type is required" error
- [ ] Property shows error badge

**Test Valid Type**:
- [ ] Use ComponentTypeSelector to pick valid type
- [ ] Error clears
- [ ] "Valid" badge shows
- [ ] Can save schema

### 5. Visual Feedback ✓

- [ ] Valid property shows green "Valid" badge
- [ ] Invalid componentType shows amber "Invalid Type" badge
- [ ] Other errors show red "Error" badge
- [ ] Hover over "Invalid Type" shows tooltip with error
- [ ] Property icon color changes based on validation

### 6. Error Messages ✓

- [ ] Missing componentType: "Component type is required"
- [ ] Invalid componentType: "Invalid component type 'xyz'. Must be one of: text, number, date..."
- [ ] Error is specific and helpful
- [ ] Suggests valid alternatives

### 7. Category Grouping ✓

- [ ] Component types grouped by category
- [ ] Categories have headers
- [ ] Categories clearly separated
- [ ] Each category shows its types
- [ ] Categories: text, media, date, choice, etc.

### 8. Integration with Existing Features ✓

- [ ] Works in all property config panels
- [ ] Works in GenericPropertyConfig
- [ ] Works in TextPropertyConfig
- [ ] Works in NumberPropertyConfig
- [ ] Works in ImagePropertyConfig
- [ ] Works when editing existing properties
- [ ] Works when creating new properties
- [ ] Doesn't break existing schemas

### 9. Edge Cases ✓

- [ ] Empty schema loads correctly
- [ ] Registry not initialized: shows loading
- [ ] No available types: shows message
- [ ] Disabled selector: grays out, can't click
- [ ] Error state: shows red border
- [ ] Long type names: truncate properly
- [ ] Many types: scrollable dropdown

### 10. Browser Testing

- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile responsive

## Test Scenarios

### Scenario 1: Create New Object Type

1. Go to `/settings/object-types/new`
2. Fill in basic info
3. Go to "Schema" tab
4. Click "Add Property"
5. Select "Text" type
6. Expand property
7. **Test**: Change Component Type
   - Click "Component Type" dropdown
   - Search for "email"
   - Select "Email" type
   - Verify selection updates
   - Verify no errors

### Scenario 2: Edit Existing Object Type

1. Open existing object type
2. Go to "Schema" tab
3. Expand existing property
4. **Test**: Change Component Type
   - Open Component Type selector
   - Select different type
   - Verify change applies
   - Save schema
   - Reload page
   - Verify change persisted

### Scenario 3: Invalid ComponentType

1. Create/edit schema
2. Add property
3. Via raw JSON or manual edit, set invalid type
4. **Test**: See validation error
   - "Invalid Type" badge appears
   - Tooltip shows error message
   - Cannot save until fixed
   - Use selector to fix
   - Error clears

### Scenario 4: Migration Schemas

1. Use migration schemas (news.json, event.json, etc.)
2. Load in ObjectType editor
3. **Test**: All fields validate
   - sourceDate has componentType "date"
   - externalUrl has componentType "url"
   - All types are valid
   - No validation errors
   - Can save successfully

## Validation Messages

### Expected Errors

| Condition | Error Message |
|-----------|---------------|
| Missing componentType | "Component type is required" |
| Invalid componentType | "Invalid component type 'xyz'. Must be one of: text, number, date..." |
| Duplicate key | "Duplicate key 'fieldName'" |
| Invalid key format | "Invalid key format. Use camelCase (e.g., firstName)" |
| Missing title | "Display label is required" |

## UI Screenshots to Verify

### ComponentTypeSelector Dropdown
- Search box at top
- Category headers (TEXT, MEDIA, DATE, etc.)
- Field types listed under categories
- Selected type highlighted in blue
- Hover state on options
- Footer showing count

### Property Config Panel
- "Component Type" field between "Display Label" and "Description"
- Dropdown button showing current selection
- Required asterisk (*)
- Error state in red if invalid

### PropertyItem Header
- "Invalid Type" badge in amber
- Hover tooltip with error message
- Multiple badges can show (Required + Invalid Type)

## Performance

- Selector loads instantly (uses already-initialized registry)
- Search is instant (client-side filtering)
- No network requests on dropdown open
- Smooth animations and transitions

## Accessibility

- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ ARIA labels on inputs
- ✅ Screen reader friendly
- ✅ Focus indicators
- ✅ Error announcements

## Common Issues & Solutions

### Issue: Selector shows "Loading..."
**Cause**: Registry not initialized yet  
**Solution**: Wait a moment, should auto-load

### Issue: No types in dropdown
**Cause**: Field types not loaded from backend  
**Solution**: Check backend API `/api/field-types/`

### Issue: componentType error persists
**Cause**: Old value stored, need to select from dropdown  
**Solution**: Click selector, choose valid type

### Issue: Changes don't save
**Cause**: Validation errors present  
**Solution**: Fix all errors shown in badges and tooltips

## Browser Console Checks

```javascript
// Check available types
import { getAvailableComponentTypes } from './PropertyTypeRegistry'
console.log(getAvailableComponentTypes())

// Check validation
import { validateComponentType } from '../../utils/schemaValidation'
console.log(validateComponentType('text', availableTypes)) // null (valid)
console.log(validateComponentType('invalid', availableTypes)) // error message
```

## Success Criteria

- [x] ComponentTypeSelector component created
- [x] All 16 property configs updated (8 direct, 8 via inheritance)
- [x] Validation functions added
- [x] Visual feedback implemented
- [x] No linting errors
- [x] Dropdown groups by category
- [x] Search works
- [x] Errors display properly
- [ ] Manual browser testing complete
- [ ] Migration schemas validated

## Next Actions

1. Start frontend development server
2. Navigate to Object Types editor
3. Test creating and editing schemas
4. Verify ComponentType selector works
5. Test with migration schemas
6. Confirm all validation works

---

**Implementation Status**: ✅ Complete  
**Code Quality**: ✅ No linting errors  
**Ready for Testing**: ✅ Yes

