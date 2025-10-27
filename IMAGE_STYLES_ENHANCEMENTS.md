# Image Styles System - Enhancements

## Overview

Enhanced the Image Styles System with visual preview thumbnails, preview image upload capability, and improved theme resolution for widgets.

## Changes Implemented

### 1. Visual Style Selector with Previews ✅

**File**: `frontend/src/components/form-fields/ImageStyleSelect.jsx`

**Complete Redesign** from basic `<select>` dropdown to custom visual component:

**Features Added**:
- ✅ **Custom Dropdown**: Click to open/close with outside click detection
- ✅ **Visual Previews**: Each style shows a miniature preview thumbnail
- ✅ **Dual Preview Modes**:
  - **Uploaded Preview**: If `previewImage` exists, shows uploaded thumbnail
  - **Auto-Generated**: Falls back to Mustache-rendered miniature
- ✅ **Dynamic Filtering**: Shows only gallery or carousel styles based on displayType
- ✅ **FormData Support**: Reads `displayType` from formData context for schema-driven forms
- ✅ **Selected State**: Visual indicator (checkmark) for selected style
- ✅ **Default Option**: Always shows "Default" option with description

**Preview Generation**:
- Uses sample placeholder images (colored boxes with numbers)
- Renders actual Mustache template at 0.2 scale
- Injects CSS for accurate preview
- Cached to avoid re-rendering

**UI/UX**:
- Clean card-based dropdown
- Hover states for options
- Smooth transitions
- Responsive overflow scrolling
- Border highlight on selected style

### 2. Preview Image Upload for Gallery Styles ✅

**File**: `frontend/src/components/theme/GalleryStylesTab.jsx`

**Added**:
- ✅ Preview image upload section in editor panel
- ✅ File input with drag-and-drop ready styling
- ✅ Base64 encoding for storage in theme JSON
- ✅ Remove preview button (X icon overlay)
- ✅ Preview thumbnail display (32x20 responsive)
- ✅ Upload handler with FileReader

**Location**: After CSS Editor, before Mustache Preview

**Benefits**:
- Designers can upload actual screenshots of styled galleries
- No need for external image hosting
- Stored directly in theme JSON (portable)

### 3. Preview Image Upload for Carousel Styles ✅

**File**: `frontend/src/components/theme/CarouselStylesTab.jsx`

**Same implementation as GalleryStylesTab**:
- ✅ Identical UI and functionality
- ✅ Uses Play icon instead of Grid for carousel branding
- ✅ Base64 storage in carousel style object

### 4. Enhanced Theme Resolution ✅

**File**: `frontend/src/hooks/useTheme.js`

**Problem**: Components were calling `useTheme()` without parameters but the hook required `themeId`

**Solution**: Enhanced hook to auto-resolve theme from UDC state

**Logic**:
1. Try to get theme from UDC state
   - Check current page version for theme ID
   - Look up theme in UDC themes cache
2. If not found, look for default theme in UDC
3. If themeId explicitly provided, fetch via React Query
4. Use fetched theme over UDC theme (explicit > implicit)

**Benefits**:
- ✅ Widgets can call `useTheme()` without parameters
- ✅ Automatically gets page's current theme
- ✅ Falls back to default theme if page has none
- ✅ Still supports explicit themeId when needed
- ✅ Graceful degradation if UDC not available

### 5. Backward Compatibility Alias ✅

**File**: `frontend/src/hooks/useTheme.js`

**Added**: `currentTheme` as alias for `theme` in return object

```javascript
return {
    theme,
    currentTheme: theme,  // Alias for backward compatibility
    //...
}
```

**Benefit**: Components using either `theme` or `currentTheme` both work

### 6. Field Components Registry ✅

**File**: `frontend/src/components/form-fields/index.js`

**Added**: ImageStyleSelect to `FIELD_COMPONENTS` for dynamic loading

```javascript
ImageStyleSelect: () => import('./ImageStyleSelect'),
```

**Benefit**: Schema-driven forms can now use ImageStyleSelect component

## Style Structure Update

Gallery and carousel styles now support optional `previewImage` field:

```javascript
{
    "name": "Partner Logos",
    "description": "Logo grid with hover effects",
    "template": "<div>...</div>",
    "css": ".logo-grid {...}",
    "variables": {},
    "previewImage": "data:image/png;base64,iVBORw0KG..." // ← NEW: Optional
}
```

## User Workflow

### Upload Custom Preview Image

1. **Theme Editor** → Select theme
2. Navigate to **Galleries** or **Carousels** tab
3. Click on a style to edit
4. Scroll to **Preview Image** section
5. Click **Upload Preview**
6. Select an image file (PNG, JPG, etc.)
7. ✅ Image appears immediately
8. **Save Theme**
9. When selecting this style in ImageWidget, uploaded preview shows instead of auto-generated

### Select Style in Widget

1. **Page Editor** → Add/edit ImageWidget
2. Set **Display Type** (Gallery or Carousel)
3. Click **Image Style** dropdown
4. ✅ See visual previews of each style (uploaded or auto-generated)
5. Click a style to select
6. ✅ Preview updates immediately with selected style

## Technical Details

### Preview Image Storage

**Format**: Base64-encoded data URI  
**Size**: Typically 20-50KB for small thumbnails  
**Location**: Stored in theme JSON (`gallery_styles` or `carousel_styles` JSONField)  
**Portability**: Moves with theme when cloning/exporting  

**Pros**:
- No separate file management needed
- Works immediately without image hosting
- Portable (themes are self-contained)

**Cons**:
- Increases JSON size
- Not ideal for very large images (recommend 400x300px max)

### Auto-Generated Previews

When no `previewImage` is uploaded:
- Uses `renderMustache()` to render miniature version
- Sample images: Colored placeholder boxes (blue, purple, pink)
- Scaled down to fit 96x64px thumbnail
- CSS applied for accurate preview
- Cached to avoid re-rendering

### Theme Resolution Chain

**When useTheme() called without parameters**:

1. Check UDC state for current page version theme
2. Look up theme in UDC themes cache
3. Fallback to default theme in UDC
4. Return null if none found

**When useTheme({ themeId: 123 }) called**:

1. Fetch theme via React Query
2. Return fetched theme (ignores UDC)

## Files Modified

1. `frontend/src/components/form-fields/ImageStyleSelect.jsx` - Complete redesign
2. `frontend/src/components/form-fields/index.js` - Registry entry
3. `frontend/src/components/theme/GalleryStylesTab.jsx` - Preview upload
4. `frontend/src/components/theme/CarouselStylesTab.jsx` - Preview upload
5. `frontend/src/hooks/useTheme.js` - UDC theme resolution

## Benefits

### For Designers
- ✅ Upload actual screenshots of custom layouts
- ✅ Visual style selection (no guessing from names)
- ✅ Preview exactly what users will see

### For Users
- ✅ Visual selection makes choosing styles intuitive
- ✅ See preview before applying
- ✅ Understand what each style does at a glance

### For Developers
- ✅ Theme automatically resolved from page context
- ✅ No manual theme ID passing needed
- ✅ Backward compatible with existing code

## Testing Checklist

- [ ] Upload preview image to gallery style
- [ ] Verify preview appears in ImageStyleSelect dropdown
- [ ] Remove preview image (X button works)
- [ ] Verify fallback to auto-generated preview
- [ ] Upload preview to carousel style
- [ ] Switch displayType in widget - dropdown options update
- [ ] Call useTheme() without params - gets page theme
- [ ] Call useTheme({ themeId: X }) - gets specific theme
- [ ] Clone theme - preview images copy correctly

## Next Steps

- Consider preview image size limits/warnings
- Add preview image compression
- Support drag-and-drop for preview upload
- Add "Capture from template" button (screenshot Mustache preview)

---

**Implementation Date**: October 27, 2025  
**Status**: Complete - Ready for Testing

