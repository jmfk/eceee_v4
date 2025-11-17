# Layout Properties CSS Selector Fix - Implementation Summary

## Problem Identified

Layout properties CSS was not being applied because the theme CSS generator created incorrect CSS selectors.

**Example of broken CSS:**
```css
.slot-main .widget-type-easy-widgets-contentcardwidget .content-card-widget {
  width: 100%;
  height: 55px;
}
```

This selector treats `.content-card-widget` as a **descendant** of `.widget-type-easy-widgets-contentcardwidget`, but in the actual HTML, they are **both on the same element**:

```html
<div class="content-card-widget widget-type-easy-widgets-contentcardwidget cms-content">
```

## Changes Implemented

### 1. Backend CSS Generator (Python)
**File:** `backend/webpages/models/page_theme.py`
**Lines:** 1505-1530

Added logic to detect root elements and generate correct selectors:

```python
is_root_element = part.endswith('-widget') or part == 'container'

if is_root_element:
    # Same-element selector (no space between classes)
    selector = f"{base}.{part}"  # e.g., .slot-main .widget-type-X.content-card-widget
else:
    # Descendant selector (with space)
    selector = f"{base} .{part}"  # e.g., .slot-main .widget-type-X .content-card-header
```

### 2. Frontend CSS Generator (JavaScript)
**File:** `frontend/src/utils/themeUtils.js`
**Lines:** 227-249

Applied identical logic for frontend preview rendering:

```javascript
const isRootElement = part.endsWith('-widget') || part === 'container';

if (isRootElement) {
    return `${base}.${part}`;  // Same-element selector
} else {
    return `${base} .${part}`;  // Descendant selector
}
```

### 3. Widget Layout Parts Standardization

Updated widget definitions to use consistent naming that matches template class names:

**BannerWidget** (`backend/easy_widgets/widgets/banner.py`):
```python
layout_parts = {
    "banner-widget": { ... },      # Was: "container"
    "banner-background": { ... },  # Was: "background"
    "banner-body": { ... },        # Was: "body"
    "banner-images": { ... },      # Was: "image"
    "banner-text": { ... },        # Was: "content"
}
```

**HeroWidget** (`backend/easy_widgets/widgets/hero.py`):
```python
layout_parts = {
    "hero-widget": { ... },      # Was: "container"
    "hero-background": { ... },  # Already correct
    "hero-content": { ... },     # Already correct
}
```

Also updated `hero.py` widget_css to use `.hero-widget` selectors instead of `.widget-type-easy-widgets-herowidget`.

### 4. Hero Template Update
**File:** `backend/easy_widgets/templates/easy_widgets/widgets/hero.html`

Added `hero-widget` class to root element for consistency:

```html
<!-- Before -->
<div class="widget-type-{{ widget_type.css_class_name }} cms-content">

<!-- After -->
<div class="hero-widget widget-type-{{ widget_type.css_class_name }} cms-content">
```

### 5. Management Command for Cache Clearing
**File:** `backend/webpages/management/commands/clear_theme_cache.py` (new file)

Created command to easily clear theme CSS caches after code deployment:

```bash
# Clear all theme caches
docker-compose -f docker-compose.dev.yml exec backend python manage.py clear_theme_cache --all

# Clear specific theme
docker-compose -f docker-compose.dev.yml exec backend python manage.py clear_theme_cache 1
```

## Generated CSS Examples

### ContentCardWidget (corrected)

```css
/* Root element - same-element selector */
.slot-main .content-card-widget.widget-type-easy-widgets-contentcardwidget {
  width: 100%;
  height: 55px;
}

/* Child element - descendant selector */
.slot-main .content-card-widget.widget-type-easy-widgets-contentcardwidget .content-card-header {
  width: 310px;
}

.slot-main .content-card-widget.widget-type-easy-widgets-contentcardwidget .content-card-images {
  width: 310px;
  height: 310px;
}
```

## Deployment Steps

1. Deploy code changes to backend and frontend
2. Clear theme CSS cache:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend python manage.py clear_theme_cache --all
   ```
3. Restart backend service (optional, ensures clean state):
   ```bash
   docker-compose -f docker-compose.dev.yml restart backend
   ```
4. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R) to clear browser cache
5. Verify layout properties work correctly on test page

## Testing Checklist

- [ ] Navigate to http://summerstudy:8000/
- [ ] Verify ContentCardWidget layout properties apply correctly
- [ ] Check Banner widget layout properties (if used)
- [ ] Check Hero widget layout properties (if used)
- [ ] Test in editor preview
- [ ] Test on published page
- [ ] Verify responsive breakpoints work (sm, md, lg, xl)

## Technical Details

### Root Element Detection

A layout part is considered a root element if:
1. Part name ends with `-widget` (e.g., `content-card-widget`, `banner-widget`, `hero-widget`)
2. OR part name is exactly `container` (legacy/generic naming)

### Selector Generation

For base selector: `.slot-main .widget-type-easy-widgets-contentcardwidget`

| Part Type | Part Name | Generated Selector |
|-----------|-----------|-------------------|
| Root | `content-card-widget` | `.slot-main .widget-type-easy-widgets-contentcardwidget.content-card-widget` |
| Child | `content-card-header` | `.slot-main .widget-type-easy-widgets-contentcardwidget .content-card-header` |
| Child | `content-card-images` | `.slot-main .widget-type-easy-widgets-contentcardwidget .content-card-images` |

### Affected Widgets

Only widgets with `layout_parts` defined are affected:
- ✅ ContentCardWidget (easy_widgets)
- ✅ BannerWidget (easy_widgets)
- ✅ HeroWidget (easy_widgets)

Other widgets without `layout_parts` are unaffected.

## Notes

- This fix applies to both backend-rendered pages and frontend editor preview
- No database migration required
- Existing theme data remains unchanged
- CSS is regenerated on-the-fly with correct selectors
- Browser cache may need to be cleared to see changes immediately

