# Layout Properties CSS Selector Fix

## Changes Made

Fixed the CSS selector generation for widget layout properties to correctly target widget parts when both slot and widget-type targeting is used.

### Problem

The theme CSS generator was creating incorrect descendant selectors for all layout parts:

```css
/* BROKEN - treats widget root as child element */
.slot-main .widget-type-easy-widgets-contentcardwidget .content-card-widget { }
```

But the actual HTML structure has both classes on the same element:

```html
<div class="content-card-widget widget-type-easy-widgets-contentcardwidget ...">
```

### Solution

Updated the CSS generator to detect root elements and use same-element selectors:

```css
/* FIXED - root element selector (no space) */
.slot-main .content-card-widget.widget-type-easy-widgets-contentcardwidget { }

/* Child elements use descendant selector (with space) */  
.slot-main .content-card-widget.widget-type-easy-widgets-contentcardwidget .content-card-header { }
```

### Files Modified

1. **backend/webpages/models/page_theme.py** - `_generate_design_groups_css()` method (lines 1505-1530)
   - Added detection for root elements (parts ending in `-widget` or named `container`)
   - Use same-element selector (no space) for root elements
   - Use descendant selector (with space) for child elements

2. **frontend/src/utils/themeUtils.js** - `generateDesignGroupsCSS()` function (lines 227-249)
   - Applied same logic for frontend CSS generation
   - Ensures editor preview matches published site

3. **backend/easy_widgets/widgets/banner.py** - Updated layout_parts naming
   - Changed `"container"` → `"banner-widget"` (matches template class)
   - Changed `"background"` → `"banner-background"`
   - Changed `"body"` → `"banner-body"`
   - Changed `"image"` → `"banner-images"`
   - Changed `"content"` → `"banner-text"`

4. **backend/easy_widgets/widgets/hero.py** - Updated layout_parts naming
   - Changed `"container"` → `"hero-widget"` (matches new template class)
   - Updated other parts to use `hero-` prefix
   - Updated widget_css to use `.hero-widget` selectors

5. **backend/easy_widgets/templates/easy_widgets/widgets/hero.html** - Added consistent class naming
   - Added `hero-widget` class to root element to match layout_parts

### Root Element Detection Logic

A layout part is considered a "root element" if:
- The part name ends with `-widget` (e.g., `content-card-widget`, `banner-widget`, `hero-widget`)
- OR the part name is exactly `container` (for widgets without specific root class)

### Cache Invalidation Required

After deploying these changes, **theme CSS cache must be cleared**:

```bash
# In Django shell or management command:
from webpages.services import ThemeCSSGenerator
generator = ThemeCSSGenerator()

# Clear cache for specific theme
generator.invalidate_cache(theme_id)

# Or clear all theme caches
from django.core.cache import cache
cache.delete_pattern('theme_css_*')
```

Alternatively, restart the backend service to clear caches.

### Testing

1. Navigate to http://summerstudy:8000/
2. Verify ContentCardWidget layout properties now apply correctly
3. Check that child elements (header, images, text) also receive their styles
4. Test Banner and Hero widgets with layout properties
5. Verify in both editor and published views

### Affected Widgets

Widgets with layout_parts that benefit from this fix:
- ✅ ContentCardWidget
- ✅ BannerWidget  
- ✅ HeroWidget

### Migration Notes

Existing themes with layout properties for these widgets will automatically generate correct CSS after:
1. Code deployment
2. Cache invalidation
3. Page reload

No database migration needed - this is purely a CSS generation fix.

