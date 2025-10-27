# Image Styles Theme Pickup - Debug & Fix

## Problem
ImageWidget wasn't picking up gallery or carousel styles from the theme.

## Implementation: Option A (Simple Fix)

### Changes Made

#### 1. Enhanced useTheme Hook
**File**: `frontend/src/hooks/useTheme.js`

**Added Default Theme Fetch**:
- When `useTheme()` called without `themeId` parameter
- Fetches list of all themes
- Finds theme with `isDefault: true`
- Uses React Query with 5-minute cache

**Theme Resolution Priority**:
1. **fetchedTheme** - If themeId explicitly provided
2. **udcTheme** - From UDC state (current page version)
3. **defaultTheme** - Default theme from API
4. **null** - No theme available

**Debug Logging Added**:
```javascript
console.log('useTheme Debug:', {
    themeId,
    udcTheme,
    fetchedTheme,
    defaultTheme,
    finalTheme: theme,
    themeSource: 'fetched' | 'udc' | 'default' | 'none',
    hasGalleryStyles: boolean,
    hasCarouselStyles: boolean,
    galleryStylesKeys: string[],
    carouselStylesKeys: string[]
});
```

#### 2. ImageStyleSelect Debug Logging
**File**: `frontend/src/components/form-fields/ImageStyleSelect.jsx`

**Added Comprehensive Logging**:
```javascript
console.log('ImageStyleSelect Debug:', {
    value,
    displayType,
    formData,
    effectiveDisplayType,
    currentTheme,
    hasTheme: boolean,
    galleryStyles: object,
    carouselStyles: object,
    availableStyles: array,
    availableStylesCount: number
});
```

## How to Test the Fix

### Step 1: Open Browser Console
1. Open **Page Editor**
2. Press **F12** to open DevTools
3. Go to **Console** tab

### Step 2: Check useTheme Output
Look for: `useTheme Debug:`

**Expected Output (Working)**:
```javascript
{
    themeId: null,
    udcTheme: null,
    fetchedTheme: null,
    defaultTheme: { id: 2, name: "eceee Summer Study", ... },
    finalTheme: { id: 2, name: "eceee Summer Study", ... },
    themeSource: "default",  // ← Should be "default", "udc", or "fetched"
    hasGalleryStyles: true,
    hasCarouselStyles: true,
    galleryStylesKeys: ["partner-logos"],
    carouselStylesKeys: ["car"]
}
```

**Problem Indicators**:
- `themeSource: "none"` → No theme found at all
- `hasGalleryStyles: false` → Theme exists but no gallery styles
- `galleryStylesKeys: []` → Empty gallery styles object

### Step 3: Check ImageStyleSelect Output
Look for: `ImageStyleSelect Debug:`

**Expected Output (Working)**:
```javascript
{
    value: null,
    displayType: "gallery",
    effectiveDisplayType: "gallery",
    currentTheme: { id: 2, name: "eceee Summer Study", ... },
    hasTheme: true,
    galleryStyles: { "partner-logos": {...} },
    carouselStyles: { "car": {...} },
    availableStyles: [{ value: "partner-logos", label: "Partner Logos", ... }],
    availableStylesCount: 1  // ← Should be > 0
}
```

**Problem Indicators**:
- `currentTheme: undefined` → useTheme not providing theme
- `availableStylesCount: 0` → No styles found for this display type
- `galleryStyles: {}` → Empty object (check backend serialization)

### Step 4: Test Visual Selector
1. Add or edit **ImageWidget**
2. Set **Display Type**: Gallery
3. Click **Image Style** dropdown
4. ✅ Should show:
   - "Default" option
   - "Partner Logos" with preview thumbnail
5. Change **Display Type**: Carousel
6. Click **Image Style** dropdown
7. ✅ Should show:
   - "Default" option
   - "car" with preview thumbnail

### Step 5: Test Preview Rendering
1. Select a gallery style (e.g., "partner-logos")
2. Add some images to the widget
3. Look at the **Preview** section
4. ✅ Images should render using the custom gallery template

## Troubleshooting

### Issue: themeSource is "none"
**Cause**: No theme found in any source  
**Fix**: 
- Check if default theme exists in database
- Run: `docker-compose exec backend python manage.py shell`
- Check: `from webpages.models import PageTheme; PageTheme.objects.filter(is_default=True)`

### Issue: hasGalleryStyles is false
**Cause**: Theme exists but gallery_styles field is empty  
**Fix**:
- Go to Theme Editor → Galleries tab
- Create at least one gallery style
- Save theme

### Issue: galleryStyles is {} (empty object)
**Cause**: Backend serialization might not be converting snake_case to camelCase  
**Check**:
- Network tab → Check API response for `/api/v1/webpages/themes/`
- Look for `gallery_styles` vs `galleryStyles`
- Should be `galleryStyles` (camelCase)

### Issue: "Value list 'image-styles' not found"
**Cause**: Backend schema still uses old SelectInput component  
**Status**: Backend file is in gitignored directory, so change works but not committed
**Verify**: Check console - warning should be gone with new implementation

## Next Steps After Verification

### If Fix Works:
1. Test all scenarios above
2. Verify styles show in dropdown
3. Verify previews render correctly
4. **Remove debug console.logs**
5. Commit changes

### If Fix Doesn't Work:
1. Review console logs
2. Identify which source is failing (none/udc/default)
3. Consider Option B: Load theme into UDC properly
4. Or Option C: Create ThemeContext provider

## Files Modified

- `frontend/src/hooks/useTheme.js` - Default theme fetch + debug
- `frontend/src/components/form-fields/ImageStyleSelect.jsx` - Debug logging

## Expected Result

After this fix:
- ✅ ImageWidget picks up gallery/carousel styles automatically
- ✅ Visual previews show in dropdown
- ✅ Styles render correctly in widget preview
- ✅ No "value list not found" warnings
- ✅ Theme inherits from parent pages (via default theme fallback)

---

**Test this now and report what you see in the console!**

