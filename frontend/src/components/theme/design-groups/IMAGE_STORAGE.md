# Image Storage in Design Groups

## Overview

Design Groups now have **separated image storage** for layout properties. Image properties are stored in a dedicated `images` sub-object within each breakpoint, allowing them to link to theme images and maintain proper structure.

## Storage Structure

### Before (Old Structure)
```javascript
layoutProperties: {
  header: {
    md: {
      backgroundColor: "#ffffff",
      backgroundImage: "url(...)",  // Mixed with regular CSS
      padding: "2rem"
    }
  }
}
```

### After (New Structure)
```javascript
layoutProperties: {
  header: {
    md: {
      backgroundColor: "#ffffff",
      padding: "2rem",
      images: {
        backgroundImage: {
          url: "s3://...",
          themeImageId: 123,
          width: 1920,
          height: 400
        }
      }
    }
  }
}
```

## Benefits

1. **Separation of Concerns**: CSS properties and image references are clearly separated
2. **Theme Image Linking**: Images can reference theme images with full metadata
3. **Validation**: Image dimensions can be validated against breakpoint requirements
4. **imgproxy Integration**: Image objects contain all data needed for imgproxy URL generation
5. **Backward Compatibility**: Reader logic checks both locations for smooth migration

## Implementation Details

### Image Properties

Currently, these properties are stored in the `images` sub-object:
- `backgroundImage`
- `background` (future-proofed, not currently in LAYOUT_PROPERTIES)

### Storage Logic

Located in:
- `frontend/src/components/theme/DesignGroupsTab.jsx` (lines 1010-1088)
- `frontend/src/components/theme/design-groups/hooks/useLayoutProperties.js` (lines 27-121)

```javascript
// Check if this is an image property (object with url field)
const isImageProperty = value && typeof value === 'object' && value.url;
const imageProperties = ['backgroundImage', 'background'];
const shouldStoreAsImage = imageProperties.includes(property) && (isImageProperty || value === null);

if (shouldStoreAsImage) {
  // Store in images sub-object
  if (!breakpointProps.images) {
    breakpointProps.images = {};
  }
  breakpointProps.images[property] = value;
} else {
  // Store as regular property
  breakpointProps[property] = value;
}
```

### Reading Logic

Located in `BreakpointPropertyEditor.jsx` (lines 84-89, 195):

```javascript
// Get used properties from both direct properties and images sub-object
const directProps = Object.keys(breakpointProps).filter(prop => 
  prop !== 'images' && prop in availableProperties
);
const imageProps = breakpointProps.images ? 
  Object.keys(breakpointProps.images).filter(prop => prop in availableProperties) : [];
const usedProperties = [...new Set([...directProps, ...imageProps])];

// When reading value for display
const storedValue = breakpointProps.images?.[prop] || breakpointProps[prop] || '';
```

## Image Property Field Component

The `ImagePropertyField` component (`design-groups/ImagePropertyField.jsx`) handles:
- Direct image uploads to object storage
- Theme image selection
- Image validation warnings (undersized images for retina displays)
- Integration with imgproxy for optimized delivery

## Migration Path

### Backward Compatibility

The system maintains backward compatibility by:
1. Checking both `breakpointProps.images[prop]` and `breakpointProps[prop]` when reading
2. Automatically migrating to new structure when properties are updated
3. Cleaning up old direct storage when new image values are saved

### Automatic Migration

When a user edits an existing design group with old-style image storage:
1. The reader finds the image in the old location (`breakpointProps[prop]`)
2. When the user saves changes, it's stored in the new location (`breakpointProps.images[prop]`)
3. The old location is not automatically cleaned up (manual cleanup if needed)

## Testing

To test the implementation:

1. **Create new design group** with background image:
   - Add layout part (e.g., "header")
   - Add breakpoint (e.g., "md")
   - Add "Background Image" property
   - Upload or select image
   - Verify stored in `layoutProperties.header.md.images.backgroundImage`

2. **Edit existing design group** with old-style storage:
   - Open group with `backgroundImage` in old location
   - Verify image displays correctly
   - Make any edit and save
   - Verify new storage structure is used

3. **Validation warnings**:
   - Upload undersized image (e.g., 800px for desktop breakpoint)
   - Verify warning appears about retina display requirements
   - Upload properly sized image (e.g., 2560px for 1280px display width)
   - Verify warning disappears

## Related Files

- `frontend/src/components/theme/DesignGroupsTab.jsx` - Main component with storage logic
- `frontend/src/components/theme/design-groups/hooks/useLayoutProperties.js` - Hook with storage logic
- `frontend/src/components/theme/design-groups/layout-properties/BreakpointPropertyEditor.jsx` - Reader logic
- `frontend/src/components/theme/design-groups/ImagePropertyField.jsx` - Image field component
- `frontend/src/components/theme/design-groups/DirectImageUpload.jsx` - Upload component
- `frontend/src/components/theme/design-groups/utils/propertyConfig.js` - Property definitions

## Future Enhancements

1. **Automatic cleanup**: Add migration script to clean up old direct storage
2. **More image properties**: Add support for other image-related CSS properties
3. **Image presets**: Allow saving image configurations as reusable presets
4. **Responsive images**: Support different images per breakpoint with automatic srcset generation
5. **Image effects**: Add filters, overlays, and other image processing options

## Status

✅ **Implementation Complete** (Dec 17, 2024)
- Separated image storage implemented
- Backward compatibility maintained
- Image validation working
- Theme image linking ready
- Documentation complete

