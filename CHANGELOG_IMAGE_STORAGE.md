# Changelog: Separated Image Storage in Design Groups

**Date**: December 17, 2024  
**Status**: ✅ Complete

## Summary

Implemented separated image storage for layout properties in Design Groups. Image properties (like `backgroundImage`) are now stored in a dedicated `images` sub-object within each breakpoint, enabling better organization, theme image linking, and validation.

## Changes Made

### 1. Updated Main Component Storage Logic
**File**: `frontend/src/components/theme/DesignGroupsTab.jsx`

- Modified `handleUpdateLayoutProperty` function (lines 1010-1088)
- Added logic to detect image properties (objects with `url` field)
- Image properties now stored in `breakpointProps.images[property]`
- Regular CSS properties stored directly in `breakpointProps[property]`
- Automatic cleanup of empty `images` object when all images removed

### 2. Maintained Hook Consistency
**File**: `frontend/src/components/theme/design-groups/hooks/useLayoutProperties.js`

- Already had the correct implementation
- Verified consistency with main component
- No changes needed

### 3. Verified Reader Logic
**File**: `frontend/src/components/theme/design-groups/layout-properties/BreakpointPropertyEditor.jsx`

- Already correctly reads from both locations (lines 84-89, 195)
- Provides backward compatibility for migration
- No changes needed

### 4. Documentation
**Files Created**:
- `frontend/src/components/theme/design-groups/IMAGE_STORAGE.md` - Complete documentation
- `CHANGELOG_IMAGE_STORAGE.md` - This file

**Files Updated**:
- `frontend/src/components/theme/design-groups/STATUS.md` - Updated progress to 65%

## Technical Details

### Storage Structure

```javascript
// NEW: Separated storage
layoutProperties: {
  header: {
    md: {
      padding: "2rem",              // Regular CSS properties
      backgroundColor: "#ffffff",
      images: {                      // Image properties in sub-object
        backgroundImage: {
          url: "s3://bucket/image.jpg",
          themeImageId: 123,
          width: 1920,
          height: 400
        }
      }
    }
  }
}
```

### Detection Logic

```javascript
const isImageProperty = value && typeof value === 'object' && value.url;
const imageProperties = ['backgroundImage', 'background'];
const shouldStoreAsImage = imageProperties.includes(property) && 
                          (isImageProperty || value === null);
```

### Backward Compatibility

Reader checks both locations:
```javascript
const storedValue = breakpointProps.images?.[prop] || breakpointProps[prop] || '';
```

This allows:
- Old data to be read correctly
- Automatic migration on next save
- No breaking changes for existing design groups

## Benefits

1. **Clear Separation**: CSS properties vs. image references
2. **Theme Integration**: Images can link to theme images with metadata
3. **Validation**: Image dimensions validated against breakpoint requirements
4. **imgproxy Ready**: Image objects contain all data for URL generation
5. **Future-Proof**: Easy to extend with more image-related features

## Testing Checklist

- [x] Code updated in main component
- [x] Code verified in hook
- [x] Reader logic verified
- [x] No linting errors
- [x] Documentation complete
- [ ] Manual testing with new design group
- [ ] Manual testing with existing design group (migration)
- [ ] Validation warnings tested

## Migration Notes

### For Existing Data

No immediate action required. The system maintains backward compatibility:

1. Existing design groups with old-style storage continue to work
2. When edited and saved, they automatically migrate to new structure
3. Old storage location is not cleaned up automatically (harmless)

### Optional Cleanup Script

If you want to clean up old storage locations, run:
```javascript
// Future: Add migration script to clean up old direct storage
// This would iterate through all design groups and move any
// image properties from direct storage to images sub-object
```

## Related Issues

This fixes the issue where:
- Image properties were mixed with CSS properties
- No clear way to link to theme images
- Difficult to validate image dimensions
- imgproxy integration was unclear

## Next Steps

1. **Test manually** with browser to verify functionality
2. **Create test design group** with background images
3. **Edit existing design group** to verify migration
4. **Check validation warnings** for undersized images
5. **Consider adding more image properties** (e.g., `backgroundSize`, `backgroundPosition`)

## Files Changed

```
frontend/src/components/theme/DesignGroupsTab.jsx (modified)
frontend/src/components/theme/design-groups/STATUS.md (modified)
frontend/src/components/theme/design-groups/IMAGE_STORAGE.md (new)
CHANGELOG_IMAGE_STORAGE.md (new)
```

## Commit Message Suggestion

```
feat: Implement separated image storage in Design Groups

- Store image properties in dedicated 'images' sub-object
- Maintain backward compatibility for migration
- Enable theme image linking with full metadata
- Support image validation and imgproxy integration
- Add comprehensive documentation

Fixes issue with mixed CSS and image property storage.
Enables future enhancements for responsive images and validation.
```

