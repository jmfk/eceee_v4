# Image Widget Template Variables Documentation

This document describes how the Image Widget template system works and all variables available in different display types and theme styles.

## Table of Contents

1. [Overview](#overview)
2. [Template Rendering Flow](#template-rendering-flow)
3. [Display Types](#display-types)
4. [Gallery Template Variables](#gallery-template-variables)
5. [Carousel Template Variables](#carousel-template-variables)
6. [Single Image Template Variables](#single-image-template-variables)
7. [Responsive Image System](#responsive-image-system)
8. [Imgproxy Configuration](#imgproxy-configuration)
9. [Custom Theme Styles](#custom-theme-styles)
10. [Examples](#examples)

---

## Overview

The Image Widget supports three display types:
- **Gallery**: Grid-based image display
- **Carousel**: Slideshow-based image display
- **Single Image**: Single image display

Each display type can use custom Mustache-based theme styles or the default Django template rendering.

---

## Template Rendering Flow

```
1. Widget Configuration (JSON)
   ↓
2. prepare_template_context() - Convert camelCase to snake_case, resolve collections
   ↓
3. render_with_style() - Check for custom theme style
   ↓
4. prepare_gallery_context() / prepare_carousel_context() - Generate responsive URLs
   ↓
5. Mustache Template Rendering (if custom style) OR Default Django Template
   ↓
6. Final HTML Output
```

### Key Files

- **Widget Definition**: `backend/easy_widgets/widgets/image.py`
- **Default Template**: `backend/easy_widgets/templates/easy_widgets/widgets/image.html`
- **Context Preparation**: `backend/webpages/utils/mustache_renderer.py`
- **Imgproxy Service**: `backend/file_manager/imgproxy.py`

---

## Display Types

### Setting Display Type

The display type is determined by the `displayType` field in the widget configuration:

```json
{
  "displayType": "gallery",  // or "carousel" or leave empty for single image
  "mediaItems": [...],
  "imageStyle": "grid-with-overlay"  // Optional custom style name
}
```

---

## Gallery Template Variables

### Context Structure

When using a custom gallery style, the following variables are available in the Mustache template:

#### Top-Level Variables

| Variable | Type | Description |
|----------|------|-------------|
| `images` | Array | Array of image objects (see Image Object structure below) |
| `imageCount` | Number | Total number of images |
| `multipleImages` | Boolean | True if more than one image |
| `showCaptions` | Boolean | Whether to display captions |
| `enableLightbox` | Boolean | Whether lightbox is enabled |
| `columns` | Number | Number of columns for grid (default: 3) |

#### Image Object Structure

Each item in the `images` array contains:

| Variable | Type | Description |
|----------|------|-------------|
| `index` | Number | Zero-based index of the image |
| `url` | String | Imgproxy-optimized URL (1x size) |
| `srcset` | String | Responsive image srcset (e.g., "url1 800w, url2 1600w") |
| `display_width` | Number | Calculated display width (1x) |
| `display_height` | Number | Calculated display height (1x) |
| `responsive_sizes` | Array | Array of size objects for different densities |
| `width` | Number | Original image width |
| `height` | Number | Original image height |
| `alt_text` | String | Alt text for accessibility |
| `caption` | String | Image caption |
| `title` | String | Image title |
| `photographer` | String | Photographer credit |
| `source` | String | Image source |
| `type` | String | Media type ("image" or "video") |
| `thumbnail_url` | String | Thumbnail URL (for videos) |

#### Responsive Sizes Array

Each item in `responsive_sizes`:

```javascript
{
  "url": "https://imgproxy.../resize:fit:800:600/...",
  "width": 800,
  "height": 600,
  "density": "1x"  // or "2x"
}
```

#### Style Variables

Custom style-specific variables defined in the theme:

```javascript
{
  "columns": {
    "type": "number",
    "default": 3,
    "min": 1,
    "max": 6
  }
  // Additional custom variables defined in theme
}
```

### Gallery Mustache Template Example

```mustache
<div class="gallery-widget">
  <div class="gallery-grid" style="grid-template-columns: repeat({{columns}}, 1fr);">
    {{#images}}
      <div class="gallery-item" data-index="{{index}}">
        <div class="image-container">
          <img 
            src="{{url}}" 
            srcset="{{srcset}}"
            width="{{display_width}}"
            height="{{display_height}}"
            alt="{{alt_text}}" 
            class="gallery-image" 
            loading="lazy">
        </div>
        {{#showCaptions}}
          {{#caption}}
            <div class="image-caption">{{caption}}</div>
          {{/caption}}
        {{/showCaptions}}
      </div>
    {{/images}}
  </div>
</div>
```

---

## Carousel Template Variables

### Context Structure

When using a custom carousel style, the following variables are available:

#### Top-Level Variables

| Variable | Type | Description |
|----------|------|-------------|
| `images` | Array | Array of image objects (same structure as gallery) |
| `imageCount` | Number | Total number of images |
| `multipleImages` | Boolean | True if more than one image |
| `showCaptions` | Boolean | Whether to display captions |
| `autoPlay` | Boolean | Whether carousel auto-plays |
| `autoPlayInterval` | Number | Auto-play interval in seconds (default: 3) |

#### Image Object

Same structure as Gallery (see above).

### Carousel Mustache Template Example

```mustache
<div class="carousel-widget">
  <div class="carousel-container">
    <div class="carousel-track">
      {{#images}}
        <div class="carousel-slide" data-index="{{index}}">
          <img 
            src="{{url}}" 
            srcset="{{srcset}}"
            width="{{display_width}}"
            height="{{display_height}}"
            alt="{{alt_text}}"
            class="carousel-image">
          {{#showCaptions}}
            {{#caption}}
              <div class="carousel-caption">{{caption}}</div>
            {{/caption}}
          {{/showCaptions}}
        </div>
      {{/images}}
    </div>
  </div>
</div>
```

---

## Single Image Template Variables

### Django Template Context

For single image display (no custom style), the default Django template uses:

| Variable | Type | Description |
|----------|------|-------------|
| `config` | Object | Full widget configuration |
| `config.media_items` | Array | Array with single image object |
| `config.media_items.0` | Object | First (only) image |
| `config.show_captions` | Boolean | Whether to show caption |
| `config.auto_play` | Boolean | For videos |
| `config.size` | String | Size class ("small", "medium", "large", "full") |
| `config.alignment` | String | Alignment ("left", "center", "right") |

### Single Image Example (Django Template)

```django
{% if config.media_items and config.media_items|length > 0 %}
  {% with item=config.media_items.0 %}
    <div class="image-container">
      <img 
        src="{{ item.url }}" 
        {% if item.srcset %}srcset="{{ item.srcset }}"{% endif %}
        {% if item.display_width %}width="{{ item.display_width }}"{% endif %}
        {% if item.display_height %}height="{{ item.display_height }}"{% endif %}
        alt="{{ item.alt_text }}"
        class="widget-image"
        loading="lazy" />
    </div>
  {% endwith %}
{% endif %}
```

---

## Responsive Image System

### How It Works

The system automatically generates multiple image sizes to support different pixel densities (1x, 2x) while preventing upscaling.

#### Process Flow

1. **Max Dimensions**: Defined in theme's `imgproxy_config` (max_width, max_height)
2. **Original Dimensions**: Extracted from image metadata (width, height)
3. **Constraint Calculation**: `_constrain_dimensions()` ensures no upscaling
4. **Multi-Density URLs**: Generate 1x and 2x versions
5. **Srcset Generation**: Build srcset string for browser selection

#### Example Calculation

```python
# Given:
max_width = 800
max_height = 600
original_width = 1200
original_height = 900

# For 1x:
# Calculate constrained dimensions (maintains aspect ratio)
# Result: width=800, height=600

# For 2x:
# Calculate: width=1600, height=1200
# Constrain to original: width=1200, height=900

# Final srcset:
"https://imgproxy.../800x600 800w, https://imgproxy.../1200x900 1200w"
```

### Srcset Attributes

Generated `srcset` uses width descriptors:

```html
<img 
  src="https://imgproxy.../resize:fit:800:600/..."
  srcset="https://imgproxy.../resize:fit:800:600/... 800w,
          https://imgproxy.../resize:fit:1200:900/... 1200w"
  width="800"
  height="600"
  alt="Image description">
```

Browser automatically selects appropriate size based on:
- Device pixel ratio (1x, 2x, 3x)
- Viewport size
- Network conditions

---

## Imgproxy Configuration

### Configuration Levels

Imgproxy settings can be defined at multiple levels (priority order):

1. **Widget-level override** (`imgproxyOverride` in widget config)
2. **Style-level config** (`imgproxy_config` in theme style)
3. **System defaults**

### Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `width` | Number | Target width in pixels | - |
| `height` | Number | Target height in pixels | - |
| `max_width` | Number | Maximum width (prevents upscaling) | Uses `width` |
| `max_height` | Number | Maximum height (prevents upscaling) | Uses `height` |
| `resize_type` | String | "fit", "fill", "crop", "force" | "fit" |
| `gravity` | String | "sm" (smart), "ce" (center), "no", "so", etc. | "sm" |
| `quality` | Number | JPEG/WebP quality (1-100) | 85 |
| `format` | String | "jpg", "png", "webp", "avif" | - |

### Example Configuration

```json
{
  "imgproxy_config": {
    "width": 800,
    "height": 600,
    "max_width": 1600,
    "max_height": 1200,
    "resize_type": "fill",
    "gravity": "sm",
    "quality": 85
  }
}
```

### No Upscaling Logic

The system prevents upscaling in `_constrain_dimensions()`:

```python
# If requested dimensions exceed original, use original
if width_scale >= 1.0 and height_scale >= 1.0:
    return original_width, original_height

# Otherwise scale down
scale = min(width_scale, height_scale, 1.0)
constrained_width = int(original_width * scale)
constrained_height = int(original_height * scale)
```

---

## Custom Theme Styles

### Gallery Styles Structure

Defined in `PageTheme.gallery_styles`:

```python
{
  "grid-with-overlay": {
    "name": "Grid with Overlay",
    "template": "...",  # Mustache template
    "css": "...",       # CSS styles
    "variables": {      # Customizable variables
      "columns": {"type": "number", "default": 3}
    },
    "imgproxy_config": {
      "width": 800,
      "height": 600,
      "max_width": 1600,
      "max_height": 1200,
      "resize_type": "fill",
      "gravity": "sm"
    }
  }
}
```

### Carousel Styles Structure

Defined in `PageTheme.carousel_styles`:

```python
{
  "modern-carousel": {
    "name": "Modern Carousel",
    "template": "...",
    "css": "...",
    "variables": {},
    "imgproxy_config": {
      "width": 1200,
      "height": 400,
      "max_width": 2400,
      "max_height": 800,
      "resize_type": "fill",
      "gravity": "sm"
    }
  }
}
```

### Creating Custom Styles

1. **Add style to theme** via Theme Editor
2. **Define Mustache template** using available variables
3. **Add CSS** for styling
4. **Configure imgproxy** settings
5. **Define custom variables** (optional)

---

## Examples

### Example 1: Simple Gallery Grid

**Theme Configuration:**

```json
{
  "imgproxy_config": {
    "width": 600,
    "height": 400,
    "max_width": 1200,
    "max_height": 800,
    "resize_type": "fill",
    "gravity": "sm"
  },
  "variables": {
    "columns": 3
  }
}
```

**Mustache Template:**

```mustache
<div class="simple-gallery">
  {{#images}}
    <div class="gallery-item">
      <img src="{{url}}" srcset="{{srcset}}" 
           width="{{display_width}}" height="{{display_height}}"
           alt="{{alt_text}}" loading="lazy">
    </div>
  {{/images}}
</div>
```

**Generated Context:**

```javascript
{
  "images": [
    {
      "index": 0,
      "url": "https://imgproxy.../resize:fill:600:400/...",
      "srcset": "https://imgproxy.../resize:fill:600:400/... 600w, https://imgproxy.../resize:fill:1200:800/... 1200w",
      "display_width": 600,
      "display_height": 400,
      "width": 2000,  // Original
      "height": 1500,  // Original
      "alt_text": "Mountain landscape",
      "caption": "Beautiful mountain view"
    }
  ],
  "imageCount": 1,
  "columns": 3
}
```

### Example 2: Carousel with Auto-Play

**Widget Configuration:**

```json
{
  "displayType": "carousel",
  "imageStyle": "modern-carousel",
  "autoPlay": true,
  "autoPlayInterval": 5,
  "showCaptions": true,
  "mediaItems": [...]
}
```

**Available Variables:**

```javascript
{
  "images": [...],
  "imageCount": 3,
  "multipleImages": true,
  "showCaptions": true,
  "autoPlay": true,
  "autoPlayInterval": 5
}
```

### Example 3: Responsive Sizes Array

**Using responsive_sizes in custom template:**

```mustache
{{#images}}
  <picture>
    {{#responsive_sizes}}
      <source 
        srcset="{{url}}" 
        media="(min-resolution: {{density}})">
    {{/responsive_sizes}}
    <img src="{{url}}" alt="{{alt_text}}">
  </picture>
{{/images}}
```

**Generated:**

```html
<picture>
  <source srcset="https://imgproxy.../800x600/..." media="(min-resolution: 1x)">
  <source srcset="https://imgproxy.../1600x1200/..." media="(min-resolution: 2x)">
  <img src="https://imgproxy.../800x600/..." alt="Image">
</picture>
```

---

## Variable Reference Quick Guide

### Gallery Context

```javascript
{
  images: [{
    index: 0,
    url: "...",
    srcset: "...",
    display_width: 800,
    display_height: 600,
    responsive_sizes: [...],
    width: 2000,
    height: 1500,
    alt_text: "...",
    caption: "...",
    title: "...",
    photographer: "...",
    source: "...",
    type: "image"
  }],
  imageCount: 5,
  multipleImages: true,
  showCaptions: true,
  enableLightbox: true,
  columns: 3
}
```

### Carousel Context

```javascript
{
  images: [...],  // Same structure as gallery
  imageCount: 3,
  multipleImages: true,
  showCaptions: true,
  autoPlay: true,
  autoPlayInterval: 3
}
```

### Imgproxy Config

```javascript
{
  width: 800,
  height: 600,
  max_width: 1600,
  max_height: 1200,
  resize_type: "fill",
  gravity: "sm",
  quality: 85,
  format: "webp"
}
```

---

## Best Practices

1. **Always set max_width and max_height** to prevent upscaling
2. **Use srcset** for responsive images
3. **Include width and height attributes** for better CLS (Cumulative Layout Shift)
4. **Use lazy loading** for better performance
5. **Provide meaningful alt text** for accessibility
6. **Test with different image sizes** to ensure proper constraints
7. **Use smart gravity** for automatic focal point detection
8. **Consider quality vs. file size** when setting quality parameter

---

## Troubleshooting

### Images are upscaled beyond original size

**Solution**: Set `max_width` and `max_height` in imgproxy_config to constrain dimensions.

### Srcset not generated

**Cause**: Missing original image dimensions (width/height).

**Solution**: Ensure images have width/height metadata when uploaded.

### Custom style not rendering

**Cause**: Style name doesn't match theme configuration.

**Solution**: Check `imageStyle` value matches key in `gallery_styles` or `carousel_styles`.

### Aspect ratio incorrect

**Cause**: Using "force" resize_type.

**Solution**: Use "fit" or "fill" to maintain aspect ratio.

---

## Related Documentation

- [Imgproxy Template Tags](./IMGPROXY_TEMPLATE_TAGS.md)
- [Theme System Documentation](./THEME_SYSTEM.md)
- [Widget Development Guide](./WIDGET_DEVELOPMENT.md)
- [Mustache Template Reference](./MUSTACHE_TEMPLATES.md)

