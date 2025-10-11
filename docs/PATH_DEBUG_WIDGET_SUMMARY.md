# Path Debug Widget - Implementation Summary

## Overview

Created a development/debugging widget that displays path variables captured from URL regex patterns. This widget helps test and debug the path pattern system for dynamic object publishing.

## Purpose

When you configure a page with a `path_pattern` like `^(?P<news_slug>[\w-]+)/$`, this widget shows:
- What variables were captured from the URL
- Whether you're in list mode or detail mode
- The current path and pattern configuration
- Full debugging context (optional)

## Widget Details

### Backend Widget

**File**: `backend/default_widgets/widgets/path_debug.py`

**Configuration**:
- `title` - Title to display (default: "Path Debug")
- `show_full_context` - Show full context object for advanced debugging

**Features**:
- Accesses `path_variables` from widget context
- Shows mode (list vs detail)
- Displays current URL path
- Shows page's path_pattern configuration
- Optional full context display

### Frontend Component

**File**: `frontend/src/widgets/default-widgets/PathDebugWidget.jsx`

**Modes**:
- **Edit Mode**: Configure widget settings (title, show full context option)
- **Display Mode**: Shows placeholder with helpful tips

### Template

**File**: `backend/default_widgets/templates/default_widgets/widgets/path_debug.html`

**UI Design**:
- Purple-themed debug widget (stands out visually)
- Clear sections for different debug info
- Color-coded mode badges (green for detail, blue for list)
- Monospace fonts for technical info
- Usage hints

## How It Works

### Example: News Page

**Setup**:
1. Create a `/news/` page
2. Set path pattern: `^(?P<news_slug>[\w-]+)/$`
3. Add "Path Debug" widget to the content slot
4. Publish the page

**Usage**:
- Visit `/news/` → Widget shows:
  ```
  Mode: List View (blue badge)
  Captured Path Variables: No path variables captured (listing mode)
  Current Path: /news/
  Page Path Pattern: ^(?P<news_slug>[\w-]+)/$
  ```

- Visit `/news/my-article/` → Widget shows:
  ```
  Mode: Detail View (green badge)
  Captured Path Variables:
    news_slug: my-article
  Current Path: /news/my-article/
  Page Path Pattern: ^(?P<news_slug>[\w-]+)/$
  ```

### Example: Dated Content

**Setup**:
1. Create `/events/` page
2. Set pattern: `^(?P<year>\d{4})/(?P<month>\d{2})/(?P<slug>[\w-]+)/$`
3. Add Path Debug widget

**Result**:
- Visit `/events/2024/12/conference/` → Shows:
  ```
  Captured Path Variables:
    year: 2024
    month: 12
    slug: conference
  ```

## Visual Design

```
┌─────────────────────────────────────────┐
│ 🐛 Path Debug                           │
├─────────────────────────────────────────┤
│ Mode                                    │
│ ┌───────────────────────────────────┐   │
│ │ ✓ Detail View (green badge)       │   │
│ └───────────────────────────────────┘   │
│                                         │
│ Captured Path Variables                 │
│ ┌───────────────────────────────────┐   │
│ │ news_slug: my-article             │   │
│ │ 1 variable captured               │   │
│ └───────────────────────────────────┘   │
│                                         │
│ Current Path                            │
│ ┌───────────────────────────────────┐   │
│ │ /news/my-article/                 │   │
│ └───────────────────────────────────┘   │
│                                         │
│ Page Path Pattern                       │
│ ┌───────────────────────────────────┐   │
│ │ ^(?P<news_slug>[\w-]+)/$          │   │
│ └───────────────────────────────────┘   │
│                                         │
│ 💡 Usage: Visit URLs like             │
│    /news/article-slug/ to see         │
│    variables in action.               │
└─────────────────────────────────────────┘
```

## Configuration Options

### Title
**Default**: "Path Debug"  
**Purpose**: Customize the widget title

### Show Full Context
**Default**: false  
**Purpose**: Enable to see additional debugging info:
- Page ID
- Page slug
- Page title
- Other context data

## Use Cases

### 1. Testing Path Patterns
Add widget to page, configure pattern, test different URLs.

### 2. Debugging Variable Names
Verify your named capture groups work correctly.

### 3. Understanding Modes
See when page is in list vs detail mode.

### 4. Development
Use during development to ensure path matching works.

### 5. Documentation
Screenshot widget output for documentation.

## Registration

**Backend**: Auto-registered via `widget_type_registry.register(PathDebugWidget)`

**Frontend**: Registered in `CORE_WIDGET_REGISTRY`:
```js
'default_widgets.PathDebugWidget': registerWidget(PathDebugWidget, 'default_widgets.PathDebugWidget')
```

## Files Created

1. `backend/default_widgets/widgets/path_debug.py` - Widget class
2. `backend/default_widgets/templates/default_widgets/widgets/path_debug.html` - Template
3. `frontend/src/widgets/default-widgets/PathDebugWidget.jsx` - Frontend component

## Files Modified

4. `frontend/src/widgets/default-widgets/index.js` - Export added
5. `frontend/src/widgets/default-widgets/registry.js` - Registration added

## How to Use

### 1. Add to Page

In the page editor:
1. Go to Content tab
2. Click "+" to add widget
3. Find "Path Debug" (in Development category)
4. Add to any slot
5. Configure if needed

### 2. Configure Path Pattern

In Settings & SEO tab:
1. Set "Path Pattern (Advanced)"
2. Example: `^(?P<item_slug>[\w-]+)/$`
3. Save page

### 3. Test URLs

Visit different URLs:
- Base URL (e.g., `/news/`) - See list mode
- Pattern URL (e.g., `/news/test-article/`) - See captured variables

### 4. Debug Issues

If variables aren't captured:
- Check pattern syntax
- Verify pattern matches URL format
- Use widget to see what's happening

## Best Practices

### During Development
- ✅ Add widget to test pages
- ✅ Use to verify patterns work
- ✅ Test different URL formats

### Before Production
- ❌ Remove debug widgets from production pages
- ❌ Don't ship with debug widgets visible
- ✅ Use only for testing/staging

## Future Enhancements

Potential improvements:
- Show pattern matching steps
- Display regex groups visually
- Pattern tester (try different paths)
- Suggest patterns based on URL
- Show what object would be loaded

## Related Documentation

- See `docs/PATH_PATTERN_SYSTEM.md` for path pattern system details
- See `BACKEND_PUBLISHABLE_OBJECTS_SUMMARY.md` for implementation

## Status

✅ **Widget Created and Registered**
- Backend widget class ✅
- Template created ✅
- Frontend component ✅
- Registered in both registries ✅
- No linting errors ✅

**Ready to use!** Add the widget to your page to debug path patterns.

