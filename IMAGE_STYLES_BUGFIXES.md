# Image Styles System - Bug Fixes

## Issues Identified and Fixed

### Issue #1: Gallery/Carousel Styles Not Saving ✅ FIXED

**Problem**: Gallery and carousel styles were not being saved to the database.

**Root Cause**: The `PageThemeSerializer` was missing `gallery_styles` and `carousel_styles` from its `fields` list.

**Fix**: 
- **File**: `backend/webpages/serializers.py`
- **Change**: Added `gallery_styles` and `carousel_styles` to the serializer fields

```python
fields = [
    # ...
    "component_styles",
    "gallery_styles",      # ← ADDED
    "carousel_styles",     # ← ADDED
    "table_templates",
    # ...
]
```

**Result**: 
- ✅ Gallery styles now save correctly
- ✅ Carousel styles now save correctly
- ✅ Case conversion handled automatically by djangorestframework-camel-case
  - Backend: `gallery_styles`, `carousel_styles` (snake_case)
  - Frontend: `galleryStyles`, `carouselStyles` (camelCase)

---

### Issue #2: Component Styles Not Using Mustache ✅ FIXED

**Problem**: Component styles were still using simple string replacement instead of Mustache rendering.

**Root Cause**: `ComponentStylesTab.jsx` was using `.replace('{{content}}', ...)` instead of the Mustache renderer.

**Fix**:
- **File**: `frontend/src/components/theme/ComponentStylesTab.jsx`
- **Changes**:
  1. Imported Mustache utilities
  2. Updated preview rendering to use `renderMustache()`
  3. Updated description to mention Mustache templates

**Before**:
```javascript
const html = template?.replace('{{content}}',
    '<div>Content Placeholder</div>'
) || '';
```

**After**:
```javascript
const context = prepareComponentContext(
    '<div>Content Placeholder</div>'
);
const html = renderMustache(template || '', context);
```

**Result**:
- ✅ Component styles now use proper Mustache rendering
- ✅ Consistent with Gallery and Carousel styles
- ✅ Supports full Mustache syntax (not just `{{content}}`)

---

## Testing the Fixes

### Test Gallery/Carousel Styles Saving

1. Open Theme Editor
2. Navigate to **Galleries** tab
3. Add a new gallery style
4. Edit template and CSS
5. Click **Save Theme**
6. Refresh page
7. ✅ Verify style is still there

### Test Component Styles Mustache Rendering

1. Open Theme Editor
2. Navigate to **Component Styles** tab
3. Add/edit a component style
4. Use Mustache syntax: `<div class="wrapper">{{content}}</div>`
5. Click **Show Preview**
6. ✅ Verify preview renders correctly with Mustache

---

## Case Conversion Behavior

The system now properly handles case conversion between backend and frontend:

### Backend (Python - snake_case)
```python
{
    "gallery_styles": {...},
    "carousel_styles": {...}
}
```

### API Layer (automatic conversion via djangorestframework-camel-case)
```
snake_case ←→ camelCase
```

### Frontend (JavaScript - camelCase)
```javascript
{
    galleryStyles: {...},
    carouselStyles: {...}
}
```

**No manual conversion needed** - the DRF camel case package handles this automatically!

---

## Files Modified

### Backend
- ✅ `backend/webpages/serializers.py` - Added fields to PageThemeSerializer

### Frontend
- ✅ `frontend/src/components/theme/ComponentStylesTab.jsx` - Migrated to Mustache rendering

---

## Status: All Issues Resolved ✅

Both identified issues have been fixed:
1. ✅ Gallery/Carousel styles now save and load correctly
2. ✅ Component styles now use proper Mustache rendering

The Image Styles System is now fully functional!

