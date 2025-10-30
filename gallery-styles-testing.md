# Gallery Styles Testing Guide

## Implementation Summary

The image widget (`frontend/src/widgets/easy-widgets/eceeeImageWidget.jsx`) has been refactored to render custom gallery and carousel style templates in both editor and preview modes.

### Changes Made

1. **Moved custom style check before mode check** (line 408)
   - Custom style rendering now applies to both editor and preview modes
   - Ensures WYSIWYG consistency in the page editor

2. **Unified Mustache template rendering** (lines 410-444)
   - Uses the same rendering logic for both modes
   - Applies appropriate wrapper classes for editor vs preview

3. **Updated editor mode fallback** (lines 447-472)
   - Only executes when no custom style is selected
   - Maintains existing grid/carousel rendering for default styles

## Manual Testing Instructions

### Test 1: Gallery Styles in Page Editor

1. Navigate to http://localhost:3000
2. Log in to the admin interface
3. Open the "summerstudy" page in the page editor
4. Locate the Image Widget that uses the "partner-logos" gallery style
5. **Expected Result**: The custom gallery template should render in the editor exactly as it appears in preview/published mode

### Test 2: Carousel Styles in Page Editor

1. Create a new page or edit an existing one
2. Add an Image Widget with multiple images
3. Set Display Type to "Carousel"
4. Select a custom carousel style (e.g., "car" or "test" from the Dark theme)
5. **Expected Result**: The custom carousel template should render with full interactivity (navigation controls, auto-play if enabled)

### Test 3: Default Styles Still Work

1. Create or edit a page with an Image Widget
2. Set Image Style to "Default" (or leave it unselected)
3. **Expected Result**: The widget should use the standard grid/carousel rendering without custom templates

### Test 4: Error Handling

1. Create a malformed gallery style template (intentionally break the Mustache syntax)
2. Apply it to an Image Widget
3. **Expected Result**: The widget should log an error to console and fall back to default rendering

## Available Test Data

### Themes with Gallery Styles
- **eceee Summer Study**: partner-logos
- **Dark**: grid-gallery, partner-logos, grid-with-overlay
- **Green**: grid-gallery, grid-with-overlay

### Themes with Carousel Styles
- **eceee Summer Study**: car, test
- **Dark**: car, test, default-carousel, carousel-with-captions, carousel-with-indicators
- **Green**: default-carousel, carousel-with-captions, carousel-with-indicators

### Pages Using Custom Styles
- **summerstudy**: Uses "partner-logos" gallery style

## Verification Checklist

- [x] Code refactoring completed
- [x] No linting errors
- [x] Custom style check moved before mode check
- [x] Mustache rendering applies to both modes
- [x] Appropriate wrapper classes for editor mode
- [x] Error handling maintained
- [ ] Manual test: Custom gallery styles render in editor
- [ ] Manual test: Custom carousel styles render in editor with interactivity
- [ ] Manual test: Default styles still work
- [ ] Manual test: Error handling works for malformed templates

## Technical Details

### Code Flow
```
1. Check if custom style is selected (imageStyle !== 'default' && items.length > 0)
   ├─ YES → Render Mustache template (same for editor & preview)
   │        - Get appropriate styles (galleryStyles or carouselStyles)
   │        - Prepare context (prepareGalleryContext or prepareCarouselContext)
   │        - Render template with renderMustache()
   │        - Apply wrapper class based on mode
   │        - Inject CSS via <style> tag
   └─ NO  → Check mode
              ├─ editor → Simple grid/carousel rendering
              └─ preview → Simple grid/carousel rendering
```

### Key Files
- **Widget**: `frontend/src/widgets/easy-widgets/eceeeImageWidget.jsx`
- **Mustache Renderer**: `frontend/src/utils/mustacheRenderer.js`
- **Theme Model**: `backend/webpages/models/page_theme.py`
- **Image Style Selector**: `frontend/src/components/form-fields/ImageStyleSelect.jsx`

## Notes

- Custom styles use Mustache template syntax with context variables
- Gallery context includes: images, imageCount, multipleImages, showCaptions, enableLightbox, columns
- Carousel context includes: images, imageCount, multipleImages, showCaptions, autoPlay, autoPlayInterval
- Each image object includes: url, alt, caption, width, height, index
- CSS is injected inline via `<style>` tags for custom styles

