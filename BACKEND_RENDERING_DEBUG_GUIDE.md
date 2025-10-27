# Backend Rendering Debug Guide

## Changes Made

### 1. Added camelCase Support
**File**: `backend/eceee_widgets/widgets/image.py`

Changed:
```python
# OLD: Only snake_case
display_type = config.get("display_type", "gallery")
style_name = config.get("image_style")

# NEW: Both snake_case and camelCase
display_type = config.get("display_type") or config.get("displayType", "gallery")
style_name = config.get("image_style") or config.get("imageStyle")
```

### 2. Added Debug Logging
**Files**: 
- `backend/eceee_widgets/widgets/image.py` - render_with_style method
- `backend/webpages/renderers.py` - Widget rendering
- `backend/eceee_widgets/templates/eceee_widgets/widgets/image.html` - Template

## How to Test

### Step 1: View Backend Logs

Open terminal and watch backend logs:
```bash
docker-compose logs -f backend | grep -A 10 "DEBUG"
```

### Step 2: Trigger a Page Render

1. Go to a published page with an ImageWidget
2. Refresh the page
3. Watch the backend logs for debug output

### Step 3: Check Page Source

1. Right-click on the page → "View Page Source"
2. Search for "DEBUG:"
3. Look for the debug comments at the top of the image widget HTML

## What to Look For in Logs

### Expected Output (Working):

```
=== ImageWidget.render_with_style called ===
Config keys: ['media_items', 'display_type', 'image_style', 'show_captions', ...]
image_style (snake): partner-logos
imageStyle (camel): None
display_type (snake): gallery
displayType (camel): None
Final style_name: partner-logos
Final display_type: gallery
Theme: PageTheme object (2)
Theme gallery_styles: ['partner-logos']
Theme carousel_styles: ['car', 'test']

DEBUG Renderer: Widget has render_with_style: Image
DEBUG Renderer: Theme object: PageTheme object (2)
DEBUG Renderer: Config has image_style: partner-logos
DEBUG Renderer: render_with_style returned: True
DEBUG Renderer: custom_style_html length: 542
DEBUG Renderer: custom_style_css length: 287
```

### Problem Indicators:

**Issue 1: Config has camelCase**
```
image_style (snake): None
imageStyle (camel): partner-logos  ← Config not converted yet
```
**Status**: ✅ FIXED - Now checks both

**Issue 2: No theme**
```
Theme: None
```
**Cause**: Page doesn't have theme or theme inheritance broken

**Issue 3: Not called at all**
```
(no output)
```
**Cause**: Widget doesn't have render_with_style method or not being invoked

**Issue 4: Returns None**
```
DEBUG Renderer: render_with_style returned: False
```
**Cause**: style_name is "default" or None, method exits early

## What to Look For in Page Source

### Expected (Working):

```html
<!-- DEBUG: custom_style_html exists: YES -->
<!-- DEBUG: config.image_style: partner-logos -->
<!-- DEBUG: config.imageStyle:  -->
<!-- DEBUG: config.display_type: gallery -->
<!-- DEBUG: config.displayType:  -->

<!-- Custom Style Rendering via Mustache -->
<style>.image-gallery { ... }</style>
<div class="image-gallery">
  <div class="gallery-item">...</div>
  ...
</div>
```

### Problem (Not Working):

```html
<!-- DEBUG: custom_style_html exists: NO -->
<!-- DEBUG: config.image_style:  -->
<!-- DEBUG: config.imageStyle: partner-logos -->
<!-- DEBUG: config.display_type:  -->
<!-- DEBUG: config.displayType: gallery -->

<!-- Gallery Display -->
<div class="image-widget gallery-widget">
  ...
</div>
```

## Next Steps

### If Logs Show camelCase:
✅ Already fixed - code now handles both cases

### If Logs Show No Theme:
Check:
```bash
docker-compose exec backend python manage.py shell
>>> from webpages.models import WebPage
>>> page = WebPage.objects.get(slug='your-page-slug')
>>> page.get_effective_theme()
```

### If render_with_style Not Called:
Check widget type matches:
```bash
>>> from webpages.widget_registry import widget_type_registry
>>> widget = widget_type_registry.get_widget_type('eceee_widgets.ImageWidget')
>>> hasattr(widget, 'render_with_style')
```

### If Everything Looks Good But Still Not Rendering:
Check if `prepare_template_context` is being called AFTER `render_with_style`, which would convert the config and lose the custom render.

## Clean Up After Testing

Once you've identified the issue, remove the debug statements:
1. Remove print statements from `image.py`
2. Remove print statements from `renderers.py`
3. Remove HTML comments from `image.html`

---

**Run the tests now and report what you see in the logs and page source!**

