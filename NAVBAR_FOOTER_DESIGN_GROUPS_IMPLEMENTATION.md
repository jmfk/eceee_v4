# Navbar & Footer Design Groups Implementation Summary

## Overview
Extended the design groups pattern from headers to navbar and footer widgets. Background images, background colors, and text colors are now theme-driven via layoutProperties with responsive breakpoint support.

## Changes Implemented

### Backend Changes

#### 1. NavbarWidget Simplification (`backend/easy_widgets/widgets/navbar.py`)
- **Removed config fields**: `background_image`, `background_alignment`, `background_color`, `component_style`
- **Kept essential fields**: `menu_items`, `secondary_menu_items`, `hamburger_breakpoint`
- **Updated widget_css**: References CSS variables for background image, background color, and text color
- **Simplified prepare_template_context**: Removed inline style generation, all styling from design groups
- **Removed render_with_style**: No component styles support
- **Responsive CSS variables**: 
  - `--navbar-widget-background-{bp}` for images
  - `--navbar-bg-color-{bp}` for background colors
  - `--navbar-text-color-{bp}` for text colors

#### 2. FooterWidget Simplification (`backend/easy_widgets/widgets/footer.py`)
- **Removed config fields**: `background_color`, `background_image`, `text_color`
- **Kept essential fields**: `slots` (for content slot)
- **Updated widget_css**: References CSS variables for background image, background color, and text color
- **Simplified prepare_template_context**: Removed image processing and color resolution
- **Removed render_with_style**: No component styles support
- **Responsive CSS variables**:
  - `--footer-widget-background-{bp}` for images
  - `--footer-bg-color-{bp}` for background colors
  - `--footer-text-color-{bp}` for text colors

#### 3. PageTheme CSS Generation Enhancement (`backend/webpages/models/page_theme.py`)
- **Extended CSS variable generation**: Now handles images AND colors for navbar/footer
- **Special color handling**: backgroundColor and color properties generate CSS variables for navbar-widget and footer-widget
- **Skips color properties in regular CSS**: For navbar/footer, backgroundColor and color are only in CSS variables, not regular CSS rules
- **Variable naming convention**:
  - Images: `--{part}-{imageKey}-{breakpoint}`
  - Colors: `--navbar-bg-color-{breakpoint}`, `--footer-bg-color-{breakpoint}`
  - Text: `--navbar-text-color-{breakpoint}`, `--footer-text-color-{breakpoint}`

#### 4. Data Migration (`backend/webpages/migrations/0058_migrate_navbar_footer_to_layout_properties.py`)
- **Migrates navbar configs**: Extracts background_image, background_color from all navbar widgets
- **Migrates footer configs**: Extracts background_image, background_color, text_color from all footer widgets
- **Applies to all breakpoints**: Single image/color applied to sm, md, lg, xl
- **Preserves essential config**: Keeps menu items for navbar, slots for footer
- **Creates design groups**: Finds or creates navbar/footer design groups per theme
- **Reversible**: Includes reverse migration to restore original structure

### Frontend Changes

#### 1. DesignGroupsTab Enhancement (`frontend/src/components/theme/DesignGroupsTab.jsx`)
- **Extended image support**: Now detects header-widget, navbar-widget, AND footer-widget
- **Dynamic labels**: Shows appropriate label based on widget type
- **Same ImagePropertyField**: Reuses existing component for all three widget types
- **Per-breakpoint uploads**: Each breakpoint (sm, md, lg, xl) gets its own image

#### 2. Theme Utils Enhancement (`frontend/src/utils/themeUtils.js`)
- **Extended CSS variable collection**: Collects images AND colors from navbar/footer
- **Color variable generation**: Creates `--navbar-bg-color-{bp}` and `--navbar-text-color-{bp}` variables
- **Skips colors in regular CSS**: For navbar/footer, backgroundColor and color only in CSS variables
- **Maintains fallback chain**: Each breakpoint falls back to previous breakpoint

## Data Structure

### layoutProperties with Images and Colors (Navbar)
```javascript
{
  "navbar-widget": {
    "sm": {
      "backgroundColor": "#3b82f6",
      "color": "#ffffff",
      "images": {
        "background": {
          "id": 123,
          "fileUrl": "https://cdn.example.com/navbar-mobile.jpg",
          "title": "Navbar Mobile Background"
        }
      }
    },
    "md": {
      "backgroundColor": "#2563eb",
      "color": "#f0f0f0",
      "images": {
        "background": { /* MediaFile object */ }
      }
    }
  }
}
```

### layoutProperties with Images and Colors (Footer)
```javascript
{
  "footer-widget": {
    "sm": {
      "backgroundColor": "#1f2937",
      "color": "#d1d5db",
      "images": {
        "background": {
          "id": 124,
          "fileUrl": "https://cdn.example.com/footer-mobile.jpg",
          "title": "Footer Mobile Background"
        }
      }
    },
    "lg": {
      "backgroundColor": "#111827",
      "color": "#e5e7eb",
      "images": {
        "background": { /* MediaFile object */ }
      }
    }
  }
}
```

### Generated CSS Variables
```css
/* Navbar */
.widget-type-easy-widgets-navbarwidget {
  --navbar-widget-background-sm: url('https://cdn.example.com/navbar-mobile.jpg');
  --navbar-bg-color-sm: #3b82f6;
  --navbar-text-color-sm: #ffffff;
  --navbar-widget-background-md: url('https://cdn.example.com/navbar-tablet.jpg');
  --navbar-bg-color-md: #2563eb;
  --navbar-text-color-md: #f0f0f0;
}

/* Footer */
.widget-type-easy-widgets-footerwidget {
  --footer-widget-background-sm: url('https://cdn.example.com/footer-mobile.jpg');
  --footer-bg-color-sm: #1f2937;
  --footer-text-color-sm: #d1d5db;
  --footer-widget-background-lg: url('https://cdn.example.com/footer-desktop.jpg');
  --footer-bg-color-lg: #111827;
  --footer-text-color-lg: #e5e7eb;
}
```

### Widget CSS Usage
```css
/* Navbar */
.widget-type-navbar {
  background-image: var(--navbar-widget-background-sm, none);
  background-color: var(--navbar-bg-color-sm, #3b82f6);
  color: var(--navbar-text-color-sm, #ffffff);
}

@media (min-width: 768px) {
  .widget-type-navbar {
    background-image: var(--navbar-widget-background-md, var(--navbar-widget-background-sm, none));
    background-color: var(--navbar-bg-color-md, var(--navbar-bg-color-sm, #3b82f6));
    color: var(--navbar-text-color-md, var(--navbar-text-color-sm, #ffffff));
  }
}

/* Footer */
.widget-type-footer {
  background-image: var(--footer-widget-background-sm, none);
  background-color: var(--footer-bg-color-sm, transparent);
  color: var(--footer-text-color-sm, inherit);
}

@media (min-width: 1024px) {
  .widget-type-footer {
    background-image: var(--footer-widget-background-lg, var(--footer-widget-background-md, var(--footer-widget-background-sm, none)));
    background-color: var(--footer-bg-color-lg, var(--footer-bg-color-md, var(--footer-bg-color-sm, transparent)));
    color: var(--footer-text-color-lg, var(--footer-text-color-md, var(--footer-text-color-sm, inherit)));
  }
}
```

## Benefits

✅ **Consistent pattern** - Same approach as headers  
✅ **Theme-driven styling** - All visual config in design groups  
✅ **Responsive by default** - Different images/colors per breakpoint  
✅ **No imgproxy** - Images used as-is from fileUrl  
✅ **CSS variables** - Maximum flexibility for custom styling  
✅ **Simplified widgets** - Minimal config fields  
✅ **Backward compatible** - Migration preserves existing appearance  
✅ **Color support** - Background and text colors per breakpoint  

## Usage

### For Theme Designers

#### Navbar Styling
1. Go to Theme Editor → Design Groups
2. Create or edit a design group
3. Set `widgetTypes` to `["easy_widgets.NavbarWidget"]`
4. Add `navbar-widget` to Layout Properties
5. For each breakpoint (sm, md, lg, xl):
   - Upload navbar background image (optional)
   - Set backgroundColor (e.g., "#3b82f6")
   - Set color for text (e.g., "#ffffff")
   - Add any additional CSS properties

#### Footer Styling
1. Go to Theme Editor → Design Groups
2. Create or edit a design group
3. Set `widgetTypes` to `["easy_widgets.FooterWidget"]`
4. Add `footer-widget` to Layout Properties
5. For each breakpoint (sm, md, lg, xl):
   - Upload footer background image (optional)
   - Set backgroundColor (e.g., "#1f2937")
   - Set color for text (e.g., "#d1d5db")
   - Add any additional CSS properties

### For Content Editors
1. Add NavbarWidget or FooterWidget to a page slot
2. Configure menu items (navbar) or content widgets (footer)
3. No styling configuration needed - comes from theme
4. To change appearance, switch page theme

## Key Differences from Header

### Colors as CSS Variables
Unlike headers (which only have images), navbar and footer support:
- **backgroundColor**: Responsive background color per breakpoint
- **color**: Responsive text color per breakpoint

These are handled as CSS variables (not regular CSS properties) to enable responsive color changes via media queries.

### Widget-Specific Behavior
- **Navbar**: Keeps menu items and hamburger breakpoint config
- **Footer**: Keeps slots config for content widgets
- **Header**: Completely config-free (all styling from theme)

## Files Modified

### Backend (4 files)
- `backend/easy_widgets/widgets/navbar.py` - Widget simplification
- `backend/easy_widgets/widgets/footer.py` - Widget simplification
- `backend/webpages/models/page_theme.py` - CSS generation with colors
- `backend/webpages/migrations/0058_migrate_navbar_footer_to_layout_properties.py` - Migration

### Frontend (2 files)
- `frontend/src/components/theme/DesignGroupsTab.jsx` - Extended image support
- `frontend/src/utils/themeUtils.js` - Color variable generation

## Migration Notes

- Migration is **reversible** - can roll back if needed
- Processes all pages and their current versions
- Finds or creates navbar/footer design groups per theme
- Preserves all existing images, colors, and essential config
- Applies single image/color to all breakpoints (can be customized later)
- Safe to run multiple times (idempotent)

## Testing Checklist

- [ ] Run migration: `docker-compose exec backend python manage.py migrate`
- [ ] Verify existing navbars render correctly
- [ ] Verify existing footers render correctly
- [ ] Upload new navbar images in Design Groups
- [ ] Upload new footer images in Design Groups
- [ ] Set navbar background/text colors per breakpoint
- [ ] Set footer background/text colors per breakpoint
- [ ] Test responsive behavior at all breakpoints
- [ ] Verify CSS variables are generated correctly
- [ ] Test theme switching with different navbar/footer styles
- [ ] Check that images are not processed by imgproxy
- [ ] Verify menu items still work in navbar
- [ ] Verify footer content slots still work

## Complete Implementation Summary

With this implementation, we now have a consistent design groups pattern for:
1. **Header** - Images and dimensions per breakpoint
2. **Navbar** - Images, background colors, and text colors per breakpoint
3. **Footer** - Images, background colors, and text colors per breakpoint

All three widgets are now theme-driven with minimal widget-level configuration, providing a unified approach to site-wide styling.

