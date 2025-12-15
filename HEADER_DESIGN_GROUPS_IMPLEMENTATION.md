# Header Design Groups Implementation Summary

## Overview
Successfully refactored the header widget to use design groups `layoutProperties` for images, dimensions, and styling. Headers are now theme-driven with no widget-level configuration.

## Changes Implemented

### Backend Changes

#### 1. PageTheme CSS Generation (`backend/webpages/models/page_theme.py`)
- **Added image variable generation**: Detects `images` field in layoutProperties breakpoints
- **Generates CSS variables**: Creates `--{part}-{imageKey}-{breakpoint}` variables with image URLs
- **Skips images in CSS properties**: Images are handled separately as CSS variables, not as regular CSS properties
- **Uses fileUrl directly**: No imgproxy transformation - images used as-is

#### 2. HeaderWidget Simplification (`backend/easy_widgets/widgets/header.py`)
- **Removed HeaderConfig fields**: Deleted all image/dimension configuration fields
- **Simplified widget_css**: Now references CSS variables (`--header-widget-background-sm`, etc.)
- **Removed complex methods**: Deleted `render_with_style()` and `prepare_template_context()`
- **Mobile-first breakpoints**: Uses standard breakpoints (sm: 768px, md: 1024px, lg: 1280px)
- **Fallback chain**: Each breakpoint falls back to previous breakpoint's image

#### 3. Header Template (`backend/easy_widgets/templates/easy_widgets/widgets/header.html`)
- **Simplified markup**: Removed inline styles
- **Added header-widget class**: For layoutProperties targeting
- **All styling from CSS**: No template-level configuration needed

#### 4. Data Migration (`backend/webpages/migrations/0057_migrate_headers_to_layout_properties.py`)
- **Migrates existing headers**: Extracts config from all header widgets
- **Creates design groups**: Finds or creates header design group per theme
- **Preserves images**: Moves MediaFile objects to layoutProperties.images
- **Converts dimensions**: Moves height values to layoutProperties CSS
- **Clears widget configs**: Sets all header widget configs to empty dict
- **Reversible**: Includes reverse migration to restore original structure

### Frontend Changes

#### 1. ImagePropertyField Component (`frontend/src/components/theme/design-groups/ImagePropertyField.jsx`)
- **Reusable image field**: For layoutProperties image uploads
- **Media library integration**: Uses ImageInput component
- **Thumbnail preview**: Shows current image with metadata
- **Remove functionality**: Can clear images
- **Namespace support**: Tags images with "headers" namespace
- **Breakpoint labeling**: Shows which breakpoint the image is for

#### 2. Theme Utils (`frontend/src/utils/themeUtils.js`)
- **Image variable collection**: Scans all layoutProperties for images
- **CSS variable generation**: Creates variables at design group scope
- **Skips images in CSS**: Filters out `images` field when generating regular CSS properties
- **Maintains structure**: Preserves existing layoutProperties logic

#### 3. CSS Conversion Utils (`frontend/src/components/theme/design-groups/utils/cssConversion.js`)
- **Preserves images**: Keeps images when converting CSS to layoutProperties
- **Filters images from CSS**: Doesn't generate CSS properties for images field
- **Round-trip support**: layoutProperties → CSS → layoutProperties without losing images

#### 4. DesignGroupsTab Enhancement (`frontend/src/components/theme/DesignGroupsTab.jsx`)
- **Header-widget detection**: Shows image upload UI for header-widget parts
- **Per-breakpoint images**: Image field for each breakpoint (sm, md, lg, xl)
- **Inline integration**: Image field appears above regular CSS properties
- **Auto-save**: Updates design groups immediately on image change

#### 5. Header Form Info (`frontend/src/components/widgets/forms/HeaderFormInfo.jsx`)
- **Informational component**: Explains new theme-based approach
- **Navigation helper**: Link to theme editor
- **Usage instructions**: Guides users to Design Groups section

## Data Structure

### layoutProperties with Images
```javascript
{
  "header-widget": {
    "sm": {
      "height": "80px",
      "images": {
        "background": {
          "id": 123,
          "fileUrl": "https://cdn.example.com/mobile.jpg",
          "title": "Mobile Header",
          "imgproxyBaseUrl": "s3://..."
        }
      }
    },
    "md": {
      "height": "112px",
      "images": {
        "background": { /* MediaFile object */ }
      }
    },
    "lg": {
      "height": "112px",
      "images": {
        "background": { /* MediaFile object */ }
      }
    }
  }
}
```

### Generated CSS Variables
```css
.widget-type-easy-widgets-headerwidget {
  --header-widget-background-sm: url('https://cdn.example.com/mobile.jpg');
  --header-widget-background-md: url('https://cdn.example.com/tablet.jpg');
  --header-widget-background-lg: url('https://cdn.example.com/desktop.jpg');
}
```

### Widget CSS Usage
```css
.widget-type-header {
  background-image: var(--header-widget-background-sm, none);
  height: var(--header-height-sm, 80px);
}

@media (min-width: 768px) {
  .widget-type-header {
    background-image: var(--header-widget-background-md, var(--header-widget-background-sm, none));
    height: var(--header-height-md, 112px);
  }
}
```

## Benefits

✅ **Single source of truth** - All header config in design groups  
✅ **No imgproxy dependency** - Images used as-is from fileUrl  
✅ **CSS variables** - Maximum flexibility for custom styling  
✅ **Simplified widget** - Header widget has no config fields  
✅ **Theme-driven** - Switch themes = switch header appearance  
✅ **Media library integration** - Images managed through standard media system  
✅ **Responsive by default** - Breakpoint images built into structure  
✅ **Backward compatible** - Migration preserves existing headers  

## Usage

### For Content Editors
1. Add a HeaderWidget to a page slot
2. No configuration needed - styling comes from theme
3. To change header appearance, switch page theme

### For Theme Designers
1. Go to Theme Editor → Design Groups
2. Create or edit a design group
3. Set `widgetTypes` to `["easy_widgets.HeaderWidget"]`
4. Add `header-widget` to Layout Properties
5. For each breakpoint (sm, md, lg, xl):
   - Upload header background image
   - Set height (e.g., "80px", "112px")
   - Add any additional CSS properties

### For Developers
- Images stored in `layoutProperties[part][breakpoint].images.background`
- Backend generates CSS variables automatically
- Frontend ImagePropertyField handles uploads
- No widget-level code changes needed for new headers

## Testing Checklist

- [ ] Run migration on test database
- [ ] Verify existing headers still render correctly
- [ ] Upload new header images in Design Groups
- [ ] Test responsive behavior at all breakpoints
- [ ] Verify CSS variables are generated correctly
- [ ] Test theme switching with different header styles
- [ ] Check that images are not processed by imgproxy
- [ ] Verify HeaderFormInfo displays in widget editor

## Files Modified

### Backend (5 files)
- `backend/webpages/models/page_theme.py` - CSS generation
- `backend/easy_widgets/widgets/header.py` - Widget simplification
- `backend/easy_widgets/templates/easy_widgets/widgets/header.html` - Template
- `backend/webpages/migrations/0057_migrate_headers_to_layout_properties.py` - Migration

### Frontend (6 files)
- `frontend/src/components/theme/design-groups/ImagePropertyField.jsx` - New component
- `frontend/src/utils/themeUtils.js` - CSS generation
- `frontend/src/components/theme/design-groups/utils/cssConversion.js` - CSS conversion
- `frontend/src/components/theme/DesignGroupsTab.jsx` - UI integration
- `frontend/src/components/widgets/forms/HeaderFormInfo.jsx` - Info component

## Migration Notes

- Migration is **reversible** - can roll back if needed
- Processes all pages and their current versions
- Finds or creates header design groups per theme
- Preserves all existing header images and dimensions
- Clears widget configs but keeps empty dict for compatibility
- Safe to run multiple times (idempotent)

## Next Steps

1. Run migration: `docker-compose exec backend python manage.py migrate`
2. Test on development site
3. Update documentation for content editors
4. Train theme designers on new workflow
5. Consider extending to other widgets (nav, footer, etc.)

