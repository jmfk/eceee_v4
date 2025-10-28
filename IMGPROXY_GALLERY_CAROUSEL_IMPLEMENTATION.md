# Imgproxy Gallery & Carousel Implementation Summary

## Overview
Added imgproxy rendering configuration to gallery and carousel theme styles, allowing automatic image processing with configurable dimensions, resize type, and gravity. Widget instances can override style defaults.

## Implementation Date
October 28, 2025

## Files Modified

### Backend Files
1. **`backend/webpages/models/page_theme.py`**
   - Added `imgproxy_config` to all default gallery styles (grid-gallery, grid-with-overlay)
   - Added `imgproxy_config` to all default carousel styles (default-carousel, carousel-with-indicators, carousel-with-captions)
   - Default gallery config: 800x600, fill, smart gravity
   - Default carousel config: 1200x400, fill, smart gravity

2. **`backend/webpages/utils/mustache_renderer.py`**
   - Updated `prepare_gallery_context()` to accept `imgproxy_config` parameter
   - Updated `prepare_carousel_context()` to accept `imgproxy_config` parameter
   - Both functions now:
     - Merge style imgproxy config with widget-level overrides
     - Generate imgproxy URLs for each image using `imgproxy_service`
     - Replace original URLs with imgproxy-processed URLs
     - Gracefully fallback to original URLs on error

3. **`backend/eceee_widgets/widgets/image.py`**
   - Added `imgproxyOverride` field to `ImageConfig` model (hidden from UI by default)
   - Updated `prepare_template_context()` to convert imgproxyOverride to snake_case
   - Updated `render_with_style()` to pass imgproxy_config from style to context preparation functions

### Frontend Files
1. **`frontend/src/components/theme/GalleryStylesTab.jsx`**
   - Added imgproxy configuration UI section with 4 fields:
     - Width (px) - number input, placeholder "800"
     - Height (px) - number input, placeholder "600"
     - Resize Type - select (fit, fill, crop, force)
     - Gravity - select (sm, face, ce, no, so, ea, we, noea, nowe, soea, sowe)
   - Updated new style defaults to include imgproxy_config
   - Added visual styling with blue background to distinguish imgproxy section

2. **`frontend/src/components/theme/CarouselStylesTab.jsx`**
   - Added same imgproxy configuration UI section
   - Updated new style defaults with carousel-appropriate dimensions (1200x400)
   - Consistent UI with gallery styles tab

## Features Implemented

### 1. Style-Level imgproxy Configuration
Each gallery and carousel style can now define:
- **Width**: Target image width in pixels
- **Height**: Target image height in pixels
- **Resize Type**: How to resize the image
  - `fit`: Fit within dimensions, preserving aspect ratio
  - `fill`: Fill dimensions, may crop to maintain aspect ratio
  - `crop`: Crop to exact dimensions
  - `force`: Force exact dimensions, distorting if necessary
- **Gravity**: Where to focus when cropping
  - `sm` (smart): AI-based smart cropping
  - `face`: Focus on detected faces
  - `ce`: Center
  - `no`, `so`, `ea`, `we`: North, South, East, West (top, bottom, right, left)
  - Corner options: `noea`, `nowe`, `soea`, `sowe`

### 2. Automatic URL Generation
When templates render, image URLs are automatically processed through imgproxy with the configured settings. The Mustache templates use `{{url}}` which now contains the imgproxy-processed URL.

### 3. Widget-Level Overrides (Backend Support)
The `ImageConfig` model includes `imgproxyOverride` field allowing individual widget instances to override the style's imgproxy settings. This is currently hidden from the auto-generated UI but fully functional in the backend.

### 4. Graceful Error Handling
If imgproxy URL generation fails for any reason, the system gracefully falls back to the original image URL and logs a warning.

## How It Works

### Backend Flow
1. ImageWidget's `render_with_style()` retrieves the selected gallery/carousel style from the theme
2. Style contains `imgproxy_config` dictionary with width, height, resize_type, gravity
3. `prepare_gallery_context()` or `prepare_carousel_context()` is called with:
   - Images list
   - Widget config (may contain `imgproxy_override`)
   - Style variables
   - Imgproxy config from style
4. Context preparation merges style config with any widget-level overrides
5. For each image, `imgproxy_service.generate_url()` creates a signed imgproxy URL
6. Original image URL is replaced with imgproxy URL in the context
7. Mustache template renders with processed URLs

### Frontend Flow
1. Theme editor displays gallery/carousel style editor
2. Each style has imgproxy configuration section
3. User can set width, height, resize_type, and gravity
4. Settings are saved with the style in the theme's gallery_styles or carousel_styles JSON
5. Settings are automatically loaded when editing an existing style
6. New styles include sensible defaults

## Default Configurations

### Gallery Styles
```python
"imgproxy_config": {
    "width": 800,
    "height": 600,
    "resize_type": "fill",
    "gravity": "sm"
}
```

### Carousel Styles
```python
"imgproxy_config": {
    "width": 1200,
    "height": 400,
    "resize_type": "fill",
    "gravity": "sm"
}
```

## Example Usage

### Creating a Gallery Style with Custom Image Processing
1. Navigate to Theme Editor → Gallery Styles
2. Create new style or edit existing
3. Set imgproxy configuration:
   - Width: 1024
   - Height: 768
   - Resize Type: fill
   - Gravity: face (to focus on faces)
4. Save theme
5. Any ImageWidget using this gallery style will automatically process images at 1024x768 with face-focused cropping

### Overriding at Widget Level (Programmatic)
```json
{
  "displayType": "gallery",
  "imageStyle": "grid-gallery",
  "imgproxyOverride": {
    "width": 1200,
    "height": 800,
    "resize_type": "crop",
    "gravity": "ce"
  }
}
```

## Benefits

1. **Performance**: Automatically optimizes images to appropriate sizes for display
2. **Consistency**: All images in a style use the same processing settings
3. **Flexibility**: Styles can be customized per theme, widgets can override per instance
4. **User Experience**: Faster page loads with optimally-sized images
5. **Smart Cropping**: AI-powered smart cropping and face detection ensure important content is preserved
6. **Bandwidth Savings**: Smaller image files reduce bandwidth usage

## Future Enhancements

### Potential Additions
1. Add UI for widget-level imgproxy overrides in MediaSpecialEditor
2. Add quality and format options to imgproxy config
3. Add responsive image configurations (different sizes for different breakpoints)
4. Add preset management for common image processing configurations
5. Add preview in theme editor showing actual imgproxy-processed images

## Testing

To test the implementation:

1. **Create a gallery style with specific imgproxy settings**
   - Go to Theme Editor → Gallery Styles
   - Edit a style and set width=500, height=400, resize_type=crop, gravity=face
   - Save theme

2. **Add an ImageWidget to a page**
   - Select the gallery style you configured
   - Add several images
   - Publish the page

3. **Verify imgproxy URLs**
   - View page source
   - Inspect image URLs - they should be imgproxy URLs with the configured dimensions
   - Check browser network tab to confirm smaller image file sizes

4. **Test fallback behavior**
   - Temporarily disable imgproxy service
   - Verify original URLs are used and page still renders

## Technical Notes

- Backend uses `file_manager.imgproxy.imgproxy_service` for URL generation
- imgproxy URLs are signed for security (when key/salt configured)
- Frontend uses both snake_case (`imgproxy_config`) and camelCase (`imgproxyConfig`) for compatibility
- Context preparation functions handle case conversion automatically
- Error handling ensures template rendering never fails due to imgproxy issues

## Related Documentation
- imgproxy documentation: https://docs.imgproxy.net/
- IMGPROXY_INTEGRATION_GUIDE.md
- IMGPROXY_TEMPLATE_TAGS.md
- Theme system documentation in docs/

