# Backend WebPage Renderer

The `WebPageRenderer` class provides comprehensive server-side rendering of WebPage instances, including layouts, widgets, themes, and CSS.

## Features

- **Complete HTML rendering** - Renders full pages with layout structure
- **Widget rendering** - Processes widgets within layout slots  
- **Theme integration** - Applies theme CSS and styling
- **CSS collection** - Aggregates CSS from themes, layouts, and widgets
- **Meta tag generation** - Creates HTML meta tags for SEO
- **Debug information** - Provides detailed rendering info in development

## Basic Usage

### In Python Code

```python
from webpages.renderers import WebPageRenderer
from webpages.models import WebPage

# Get a page
page = WebPage.objects.get(slug='home')

# Create renderer
renderer = WebPageRenderer(request=request)

# Render complete page
result = renderer.render(page)

# Access rendered content
html = result['html']      # Complete HTML
css = result['css']        # Aggregated CSS
meta = result['meta']      # Meta tags
debug = result['debug_info']  # Debug information
```

### In Django Templates

```django
{% load webpages_tags %}

<!-- Render complete page -->
{% render_page_backend page %}

<!-- Render page with CSS data -->
{% render_page_with_css page as page_data %}
<style>{{ page_data.css }}</style>
{{ page_data.html }}
```

## API Endpoints

### Render Published Page

```
GET /api/webpages/pages/{page_id}/render/
```

**Query Parameters:**
- `include_css=true` - Include CSS in response
- `include_meta=true` - Include meta tags  
- `include_debug=false` - Include debug info (DEBUG mode only)

**Response:**
```json
{
  "html": "<html>...</html>",
  "css": "/* CSS content */",
  "meta": "<title>Page Title</title>...",
  "page_id": 123,
  "page_title": "Home Page",
  "page_slug": "home",
  "debug_info": {...}
}
```

### Render Specific Version

```
GET /api/webpages/pages/{page_id}/versions/{version_id}/render/
```

Same parameters and response as above.

### Render Preview (Authenticated)

```
POST /api/webpages/pages/preview/
```

**Body:**
```json
{
  "page_id": 123,
  "widgets": [
    {
      "widget_type": "text",
      "slot_name": "main",
      "configuration": {
        "content": "Preview content"
      }
    }
  ],
  "page_data": {},
  "include_css": true,
  "include_debug": false
}
```

**Response:**
```json
{
  "html": "<html>...</html>",
  "css": "/* CSS content */",
  "page_id": 123,
  "preview": true,
  "debug_info": {...}
}
```

## Renderer Components

### Layout Rendering

The renderer processes layouts in this order:
1. Gets effective layout from WebPage
2. Resolves layout template name
3. Processes layout structure and slots

### Widget Rendering  

Widgets are rendered per slot using:
1. Widget inheritance system from WebPage model
2. JSON widget data from PageVersion
3. Widget registry for type resolution
4. Individual widget templates

### CSS Collection

CSS is aggregated from:
1. **Theme CSS** - Base theme styling
2. **Layout CSS** - Layout-specific styles  
3. **Page CSS** - Custom page CSS
4. **Widget CSS** - Individual widget styles
5. **CSS Variables** - Dynamic CSS variables

### Meta Tag Generation

Generates standard meta tags:
- `<title>` from meta_title or title
- `<meta name="description">` from meta_description
- `<meta name="keywords">` from meta_keywords  
- Open Graph tags for social sharing

## Error Handling

The renderer provides graceful error handling:

- **Missing layout** - Raises ValueError with clear message
- **Missing version** - Falls back to latest published version
- **Widget errors** - Renders error comments in HTML
- **CSS errors** - Continues rendering without problematic CSS
- **Template errors** - Returns error message in DEBUG mode

## Debugging

Enable debug information:

```python
# In settings.py
DEBUG = True

# In API requests
GET /api/webpages/pages/123/render/?include_debug=true
```

Debug info includes:
- Page and version IDs
- Layout and theme names  
- Widget count and types
- CSS injection status
- Error details

## Performance Considerations

- **CSS Deduplication** - Prevents duplicate CSS from being included
- **Template Caching** - Django's template caching is utilized
- **Lazy Loading** - Only loads required components
- **Error Boundaries** - Isolated error handling prevents cascade failures

## Example: Custom Rendering

```python
from webpages.renderers import WebPageRenderer

class CustomWebPageRenderer(WebPageRenderer):
    def _collect_page_css(self, page, layout, widgets_by_slot):
        """Override to add custom CSS processing"""
        base_css = super()._collect_page_css(page, layout, widgets_by_slot)
        
        # Add custom CSS processing
        custom_css = self._generate_custom_css(page)
        
        return f"{base_css}\n\n{custom_css}"
    
    def _generate_custom_css(self, page):
        """Generate custom CSS based on page properties"""
        return f"/* Custom CSS for {page.title} */"

# Use custom renderer
renderer = CustomWebPageRenderer(request=request)
result = renderer.render(page)
```

## Integration with Frontend

The backend renderer can be used alongside the frontend LayoutRenderer:

1. **Server-side rendering** for initial page load and SEO
2. **Client-side rendering** for interactive editing
3. **Hybrid approach** using both as needed

The renderer output is compatible with the frontend system and can be used for:
- Static page generation
- Email templates  
- PDF generation
- API responses
- Preview generation

## Security

The renderer includes security measures:

- **Permission checks** for page access
- **XSS protection** via Django's template system
- **Error message filtering** to prevent information disclosure
- **Input validation** for widget data

## Testing

Example test usage:

```python
from django.test import TestCase
from webpages.renderers import WebPageRenderer
from webpages.models import WebPage

class WebPageRendererTest(TestCase):
    def test_render_page(self):
        page = WebPage.objects.create(title="Test Page")
        renderer = WebPageRenderer()
        
        result = renderer.render(page)
        
        self.assertIn('html', result)
        self.assertIn('css', result)
        self.assertIn('meta', result)
```