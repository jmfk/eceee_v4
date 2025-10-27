# Image Styles System - User Guide

## What is the Image Styles System?

The Image Styles System allows you to create custom templates for displaying image galleries and carousels throughout your site. Instead of being limited to the default gallery and carousel layouts, you can design your own using Mustache templates.

## Quick Start

### 1. Creating a Custom Gallery Style

1. Navigate to **Settings → Themes**
2. Select or create a theme
3. Click the **Galleries** tab
4. Enter a style name (e.g., "partner-logos")
5. Click **Add**
6. Edit the template and CSS:

**Example Gallery Template** (Mustache):
```html
<div class="logo-gallery">
  {{#images}}
    <div class="logo-item">
      <img src="{{url}}" alt="{{alt}}" loading="lazy">
      {{#showCaptions}}
        {{#caption}}<p class="logo-name">{{caption}}</p>{{/caption}}
      {{/showCaptions}}
    </div>
  {{/images}}
</div>
```

**Example CSS**:
```css
.logo-gallery {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2rem;
  padding: 2rem;
}
.logo-item {
  width: 150px;
  text-align: center;
}
.logo-item img {
  width: 100%;
  height: auto;
  filter: grayscale(100%);
  transition: filter 0.3s;
}
.logo-item img:hover {
  filter: grayscale(0%);
}
.logo-name {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}
```

7. Click **Show Preview** to see how it looks
8. Click **Save Theme**

### 2. Creating a Custom Carousel Style

1. Navigate to **Settings → Themes**
2. Select your theme
3. Click the **Carousels** tab
4. Enter a style name (e.g., "hero-carousel")
5. Click **Add**

**Example Carousel Template** (with Alpine.js):
```html
<div class="hero-carousel" x-data="{ current: 0, total: {{imageCount}} }">
  <div class="carousel-wrapper">
    <div class="carousel-slides" :style="'transform: translateX(-' + (current * 100) + '%)'">
      {{#images}}
        <div class="hero-slide">
          <img src="{{url}}" alt="{{alt}}">
          {{#showCaptions}}
            {{#caption}}
              <div class="hero-caption">
                <h2>{{caption}}</h2>
              </div>
            {{/caption}}
          {{/showCaptions}}
        </div>
      {{/images}}
    </div>
    
    {{#multipleImages}}
      <button @click="current = (current - 1 + total) % total" class="nav-btn prev">
        Previous
      </button>
      <button @click="current = (current + 1) % total" class="nav-btn next">
        Next
      </button>
    {{/multipleImages}}
  </div>
</div>
```

**Example CSS**:
```css
.hero-carousel {
  position: relative;
  height: 500px;
  overflow: hidden;
}
.carousel-wrapper {
  position: relative;
  height: 100%;
}
.carousel-slides {
  display: flex;
  height: 100%;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.hero-slide {
  min-width: 100%;
  height: 100%;
  position: relative;
}
.hero-slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 3rem 2rem;
  background: linear-gradient(transparent, rgba(0,0,0,0.9));
}
.hero-caption h2 {
  color: white;
  font-size: 2.5rem;
  font-weight: 700;
  margin: 0;
}
.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: white;
  color: black;
  border: none;
  padding: 1rem 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.nav-btn:hover {
  background: #f0f0f0;
}
.nav-btn.prev { left: 2rem; }
.nav-btn.next { right: 2rem; }
```

### 3. Applying a Style to an ImageWidget

1. Go to **Page Editor**
2. Add or edit an **Image Widget**
3. In the **Media Manager**:
   - Add multiple images OR select a collection
   - Choose **Display Type**: Gallery or Carousel
   - Select your custom style from the dropdown
4. Preview updates immediately
5. Save the page

## Mustache Template Reference

### Available Variables

#### Gallery Context
| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `images` | Array | List of image objects | Loop with `{{#images}}` |
| `imageCount` | Number | Total number of images | `{{imageCount}}` |
| `multipleImages` | Boolean | True if > 1 image | `{{#multipleImages}}` |
| `showCaptions` | Boolean | Caption display setting | `{{#showCaptions}}` |
| `enableLightbox` | Boolean | Lightbox enabled | `{{#enableLightbox}}` |
| `columns` | Number | Grid columns (if defined) | `{{columns}}` |

#### Carousel Context
| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `images` | Array | List of image objects | Loop with `{{#images}}` |
| `imageCount` | Number | Total number of images | `{{imageCount}}` |
| `multipleImages` | Boolean | True if > 1 image | `{{#multipleImages}}` |
| `showCaptions` | Boolean | Caption display setting | `{{#showCaptions}}` |
| `autoPlay` | Boolean | Auto-play enabled | `{{#autoPlay}}` |
| `autoPlayInterval` | Number | Interval in seconds | `{{autoPlayInterval}}` |

#### Image Object Properties
| Property | Type | Description |
|----------|------|-------------|
| `url` | String | Image URL |
| `alt` | String | Alt text |
| `caption` | String | Image caption (optional) |
| `width` | Number | Image width in pixels |
| `height` | Number | Image height in pixels |
| `index` | Number | Array index (0-based) |

### Mustache Syntax

#### Output Variables
```mustache
{{variableName}}              <!-- Outputs value, HTML-escaped -->
{{{rawVariable}}}             <!-- Outputs raw HTML (use carefully!) -->
```

#### Conditionals
```mustache
{{#condition}}
  Content shown if condition is true or non-empty
{{/condition}}

{{^condition}}
  Content shown if condition is false or empty
{{/condition}}
```

#### Loops
```mustache
{{#arrayName}}
  <div>{{propertyName}}</div>  <!-- Accesses array item properties -->
{{/arrayName}}
```

#### Comments
```mustache
{{! This is a comment and won't appear in output }}
```

## Alpine.js Integration (Carousels)

Carousel styles can use Alpine.js for interactive features:

### State Management
```html
<div x-data="{ current: 0, total: {{imageCount}} }">
  <!-- current: current slide index -->
  <!-- total: total number of slides -->
</div>
```

### Click Handlers
```html
<button @click="current = (current + 1) % total">Next</button>
<button @click="current = (current - 1 + total) % total">Previous</button>
```

### Dynamic Styling
```html
<div :style="'transform: translateX(-' + (current * 100) + '%)'">
  <!-- Slides container that moves based on current index -->
</div>
```

### Conditional Classes
```html
<button :class="current === {{index}} ? 'active' : ''" class="dot">
</button>
```

### Visibility
```html
<div x-show="current === {{index}}">
  <!-- Only shown when this is the current slide -->
</div>
```

## Advanced Examples

### Masonry Gallery
```html
<div class="masonry-gallery" style="column-count: 3; column-gap: 1rem;">
  {{#images}}
    <div class="masonry-item" style="break-inside: avoid; margin-bottom: 1rem;">
      <img src="{{url}}" alt="{{alt}}" style="width: 100%; border-radius: 8px;">
      {{#caption}}<p style="padding: 0.5rem; font-size: 0.875rem;">{{caption}}</p>{{/caption}}
    </div>
  {{/images}}
</div>
```

### Fade Carousel
```html
<div class="fade-carousel" x-data="{ current: 0, total: {{imageCount}} }">
  {{#images}}
    <div :class="current === {{index}} ? 'active' : ''" class="fade-slide">
      <img src="{{url}}" alt="{{alt}}">
    </div>
  {{/images}}
  <button @click="current = (current + 1) % total">Next</button>
</div>

<style>
.fade-slide {
  position: absolute;
  opacity: 0;
  transition: opacity 0.5s;
}
.fade-slide.active {
  opacity: 1;
}
</style>
```

### Stacked Cards Gallery
```html
<div class="card-stack">
  {{#images}}
    <div class="card" style="--index: {{index}}">
      <img src="{{url}}" alt="{{alt}}">
      {{#caption}}<div class="card-caption">{{caption}}</div>{{/caption}}
    </div>
  {{/images}}
</div>

<style>
.card-stack {
  position: relative;
  height: 400px;
}
.card {
  position: absolute;
  width: 300px;
  left: 50%;
  transform: translateX(-50%) translateY(calc(var(--index) * 20px));
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.3s;
}
.card:hover {
  transform: translateX(-50%) translateY(calc(var(--index) * 20px - 10px)) scale(1.05);
  z-index: 10;
}
</style>
```

## Troubleshooting

### Style Not Showing in Widget
- Verify the style name matches exactly (case-sensitive)
- Check that displayType matches style type (gallery vs carousel)
- Ensure theme is saved after creating style
- Refresh the page editor

### Preview Not Matching Public Page
- Frontend uses mustache.js, backend uses chevron
- Both should produce identical output
- Check browser console for JavaScript errors
- Alpine.js only works on public pages (not in editor preview)

### CSS Not Applying
- CSS is injected as `<style>` tag within the widget
- Ensure CSS selectors match your template structure
- Check for CSS conflicts with theme or global styles
- Use specific class names to avoid conflicts

### Template Errors
- Check Mustache syntax (closing tags, matching braces)
- Verify variable names match available context
- Use browser DevTools to inspect rendered HTML
- Check backend logs for Python rendering errors

## Best Practices

1. **Use Semantic Class Names**: `hero-carousel`, `partner-logos`, `photo-grid`
2. **Test Responsiveness**: Use media queries in CSS for mobile
3. **Provide Alt Text**: Always use `{{alt}}` in img tags
4. **Lazy Loading**: Include `loading="lazy"` for better performance
5. **Accessible Carousels**: Add ARIA labels to navigation buttons
6. **Error Handling**: Test with missing images/data
7. **Version Control**: Document custom styles for your team

## Next Steps

- Experiment with different gallery layouts (masonry, justified, etc.)
- Create themed carousel styles matching your site design
- Combine with randomization for dynamic galleries
- Use collections for globally managed image sets

---

**Questions?** Check the console for errors or review the Mustache documentation at https://mustache.github.io/

