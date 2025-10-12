# News Widgets Implementation Summary

## Overview

Successfully implemented four news widgets for the `eceee_widgets` app that work with ObjectType instances from the `object_storage` system. All widgets support multi-ObjectType selection and responsive design.

## Implemented Widgets

### 1. News List Widget (`NewsListWidget`)

**Purpose**: Display a list of news articles from selected ObjectTypes with filtering and pagination support.

**File Locations**:
- Widget: `/backend/eceee_widgets/widgets/news_list.py`
- Template: `/backend/eceee_widgets/templates/eceee_widgets/widgets/news_list.html`

**Configuration Options**:
- `object_types`: Multi-select list of ObjectType names (default: ["news"])
- `limit`: Maximum number of items (1-50, default: 10)
- `hide_on_detail_view`: Hide widget when rendering on detail pages
- `show_excerpts`: Display excerpt text
- `excerpt_length`: Maximum excerpt length (50-500, default: 150)
- `show_featured_image`: Display featured images
- `show_publish_date`: Show publish dates

**Features**:
- Pinned/featured items displayed first (checks `metadata.pinned` or `metadata.featured`)
- Sorts by pinned status, then publish date descending
- Horizontal card layout with image on left, content on right
- HTMX-ready with data attributes for future filtering
- Responsive: stacks vertically on mobile

---

### 2. News Detail Widget (`NewsDetailWidget`)

**Purpose**: Display a single news article based on slug in URL path. Supports multiple detail widgets on the same page, each configured for different ObjectTypes.

**File Locations**:
- Widget: `/backend/eceee_widgets/widgets/news_detail.py`
- Template: `/backend/eceee_widgets/templates/eceee_widgets/widgets/news_detail.html`

**Configuration Options**:
- `slug_variable_name`: Name of path variable holding slug (default: "slug")
- `object_types`: Multi-select list of ObjectTypes this widget handles (default: ["news"])
- `show_metadata`: Display publish date, author, update date
- `show_featured_image`: Display featured image
- `show_object_type`: Display ObjectType badge
- `render_object_widgets`: Render object's own widget slots

**Features**:
- Only renders if slug exists in `path_variables` AND matches configured ObjectTypes
- Multiple detail widgets can coexist on same page for different ObjectTypes
- Example: Widget A for ["news", "press-release"], Widget B for ["blog-post"]
- Fetches from `ObjectInstance` based on slug and ObjectType
- Can render object's own widget configuration
- Full article display with metadata and rich content

**Multi-Type Support**:
This is the key feature - you can have multiple NewsDetailWidget instances on the same page, each configured for different ObjectTypes. Only the widget whose configured ObjectTypes match the slug's ObjectType will render. This allows different styling/layouts for different content types.

---

### 3. Top News Plug Widget (`TopNewsPlugWidget`)

**Purpose**: Display top news in various grid configurations for homepage/landing pages.

**File Locations**:
- Widget: `/backend/eceee_widgets/widgets/top_news_plug.py`
- Template: `/backend/eceee_widgets/templates/eceee_widgets/widgets/top_news_plug.html`

**Configuration Options**:
- `object_types`: Multi-select list of ObjectType names
- `layout`: Radio button selection with 5 options:
  - `1x3`: 1 row × 3 columns (3 items)
  - `1x2`: 1 row × 2 columns (2 items)
  - `2x3_2`: 2 rows, first row 3 items, second row 2 items (5 items)
  - `2x1`: 2 rows × 1 column (2 items)
  - `2x2`: 2 rows × 2 columns (4 items)
- `show_excerpts`: Display excerpt text
- `excerpt_length`: Maximum excerpt length (50-300, default: 100)
- `show_publish_date`: Show publish dates
- `show_object_type`: Show ObjectType badge

**Features**:
- Card-based design with images, titles, excerpts
- Pinned items marked with pin icon
- Hover effects with lift animation
- Responsive breakpoints:
  - Desktop: As configured
  - Tablet (≤1024px): Adapts to 2 columns
  - Mobile (≤768px): Single column for all layouts
- Automatically fetches correct number of items based on layout

---

### 4. Sidebar Top News Widget (`SidebarTopNewsWidget`)

**Purpose**: Compact vertical list of top news for sidebar placement.

**File Locations**:
- Widget: `/backend/eceee_widgets/widgets/sidebar_top_news.py`
- Template: `/backend/eceee_widgets/templates/eceee_widgets/widgets/sidebar_top_news.html`

**Configuration Options**:
- `object_types`: Multi-select list of ObjectType names
- `limit`: Maximum number of items (1-20, default: 5)
- `show_thumbnails`: Display thumbnail images (80×80px)
- `show_dates`: Show publish dates
- `show_object_type`: Show ObjectType badge
- `widget_title`: Custom title for the widget section (default: "Top News")

**Features**:
- Compact horizontal layout: thumbnail on left, title/meta on right
- Pinned items indicated with pin emoji
- Bordered container with title header
- Hover effects on items
- Minimal spacing optimized for sidebars
- Responsive: adjusts thumbnail size on mobile

---

## Technical Implementation

### Query Logic

All widgets use consistent querying with the following pattern:

```python
queryset = ObjectInstance.objects.filter(
    object_type__name__in=config.object_types,
    status='published'
).select_related('object_type', 'current_version')

# Annotate with pinned status
queryset = queryset.annotate(
    is_pinned=Case(
        When(Q(metadata__pinned=True) | Q(metadata__featured=True), then=Value(True)),
        default=Value(False),
        output_field=BooleanField()
    )
)

# Sort: pinned first, then by publish date
queryset = queryset.order_by('-is_pinned', '-publish_date', '-created_at')
```

### Data Access

Widgets access data from ObjectInstance through the `current_version` relationship:

```python
# Featured image
featured_image = obj.data.get('featured_image') or obj.data.get('featuredImage')

# Content fields
content = obj.data.get('content') or obj.data.get('body') or obj.data.get('text')

# Excerpt
excerpt = obj.data.get('excerpt') or obj.data.get('summary') or obj.data.get('description')
```

### Path Variables (Detail Widget)

The NewsDetailWidget accesses the slug from path_variables:

```python
path_variables = context.get("path_variables", {})
slug = path_variables.get(config.slug_variable_name)  # default: "slug"
```

This enables dynamic URL patterns like `/news/{slug}/` where the slug is extracted and used to fetch the object.

### Excerpt Generation

All list widgets include smart excerpt extraction:
- Tries multiple field names: excerpt, summary, description, content
- Strips HTML tags using regex
- Truncates to configured length at word boundaries
- Adds ellipsis for truncated text

---

## CSS Architecture

All widgets use scoped CSS with the `css_scope = "widget"` setting, which means:
- CSS is automatically injected when the widget is rendered
- Styles are scoped to prevent conflicts
- Uses BEM-like naming convention
- Includes responsive breakpoints
- Uses CSS custom properties for theming

### Mobile Responsiveness

- **Breakpoint 1024px**: Tablets - multi-column layouts adapt to 2 columns
- **Breakpoint 768px**: Mobile - all layouts become single column

---

## Future Enhancements

### HTMX Filtering (Planned)

The NewsListWidget includes placeholder markup for HTMX filtering:

```html
<div class="news-filters" data-htmx-filter-target style="display: none;">
    <!-- Filtering UI will be added here -->
</div>
```

Future features could include:
- Date range filters
- ObjectType filters
- Search functionality
- Category/tag filters
- Dynamic loading/pagination

---

## Testing Checklist

To test the widgets:

1. **Create ObjectType**: Create or use existing ObjectType(s) in object_storage
2. **Create ObjectInstances**: Add test news items with:
   - Title, slug
   - Content/excerpt
   - Featured image URL
   - publish_date
   - status='published'
   - Optional: metadata={'pinned': True}

3. **Add Widgets to Page**:
   - Add widgets to a page's widget configuration
   - Configure ObjectType selection
   - Test different layouts (for TopNewsPlugWidget)

4. **Test Responsive Design**: View on mobile, tablet, desktop

5. **Test Detail Widget**: 
   - Create page with path pattern
   - Add multiple detail widgets with different ObjectType configurations
   - Verify only matching widget renders

---

## Files Created

### Backend Python Widget Files
1. `/backend/eceee_widgets/widgets/news_list.py`
2. `/backend/eceee_widgets/widgets/news_detail.py`
3. `/backend/eceee_widgets/widgets/top_news_plug.py`
4. `/backend/eceee_widgets/widgets/sidebar_top_news.py`

### Backend HTML Templates
1. `/backend/eceee_widgets/templates/eceee_widgets/widgets/news_list.html`
2. `/backend/eceee_widgets/templates/eceee_widgets/widgets/news_detail.html`
3. `/backend/eceee_widgets/templates/eceee_widgets/widgets/top_news_plug.html`
4. `/backend/eceee_widgets/templates/eceee_widgets/widgets/sidebar_top_news.html`

### Frontend Widget Components
1. `/frontend/src/widgets/eceee-widgets/eceeeNewsListWidget.jsx`
2. `/frontend/src/widgets/eceee-widgets/eceeeNewsDetailWidget.jsx`
3. `/frontend/src/widgets/eceee-widgets/eceeeTopNewsPlugWidget.jsx`
4. `/frontend/src/widgets/eceee-widgets/eceeeSidebarTopNewsWidget.jsx`

### Modified Files
1. `/backend/eceee_widgets/widgets/__init__.py` - Added backend widget imports
2. `/frontend/src/widgets/eceee-widgets/index.js` - Added frontend widget registration

---

## Integration

### Backend Integration
All widgets are automatically registered through the `@register_widget_type` decorator and the `eceee_widgets/apps.py` ready() method.

**Important**: Model imports are done lazily (inside methods) to avoid circular import issues during Django startup.

### Frontend Integration
All widgets are registered in the ECEEE_WIDGET_REGISTRY in `/frontend/src/widgets/eceee-widgets/index.js`. Each widget:
- Has a displayName, widgetType, and metadata
- Provides defaultConfig matching the backend Pydantic models
- Shows a placeholder UI in editor mode
- Renders as "rendered server-side" in display mode (actual rendering happens backend)

### No Database Changes
No database migrations are required as these widgets use the existing ObjectInstance model from object_storage.

---

## Branch Information

- **Branch**: `feature/news-widgets`
- **Status**: Implementation complete, ready for testing
- **Next Steps**: 
  1. Test with actual ObjectType data
  2. Adjust styling if needed
  3. Merge to main when approved

