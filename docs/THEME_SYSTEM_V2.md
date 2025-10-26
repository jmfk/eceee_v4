# Theme System V2 - Implementation Documentation

## Overview

The theme system has been redesigned to support 5 distinct parts with automatic migration, Google Fonts integration, and graceful fallbacks when theme elements are missing.

## Date

October 26, 2025

## Theme Structure

### 5-Part Theme System

1. **Fonts** - Google Fonts configuration
2. **Colors** - Named color palette  
3. **Typography** - Grouped HTML element styles with widget_type/slot targeting
4. **Component Styles** - HTML templates with optional CSS (renamed from Image Styles)
5. **Table Templates** - Predefined table templates for the Table widget

## Backend Implementation

### Model Changes

**File**: `backend/webpages/models/page_theme.py`

New fields added to `PageTheme` model:
- `fonts` - Google Fonts configuration (JSONField)
- `colors` - Named color palette (JSONField)
- `typography` - Grouped HTML element styles (JSONField)
- `component_styles` - Component templates (JSONField)
- `table_templates` - Table templates (JSONField)

Legacy fields (deprecated but kept for backwards compatibility):
- `css_variables` - Replaced by `colors`
- `html_elements` - Replaced by `typography`
- `image_styles` - Replaced by `component_styles`

### Data Structures

#### Fonts Structure
```json
{
  "google_fonts": [
    {
      "family": "Inter",
      "variants": ["400", "500", "600", "700"],
      "display": "swap"
    }
  ]
}
```

#### Colors Structure
```json
{
  "primary": "#3b82f6",
  "secondary": "#64748b",
  "accent": "#f59e0b",
  "text-dark": "#1f2937",
  "text-light": "#6b7280",
  "background": "#ffffff",
  "border": "#e5e7eb"
}
```

#### Typography Structure
```json
{
  "groups": [
    {
      "name": "Default Typography",
      "widget_type": null,
      "slot": null,
      "elements": {
        "h1": {
          "font": "Inter",
          "size": "2rem",
          "lineHeight": "1.2",
          "fontWeight": "700",
          "marginBottom": "1rem",
          "color": "primary"
        },
        "p": {
          "font": "Inter",
          "size": "1rem",
          "lineHeight": "1.6",
          "marginBottom": "1rem",
          "color": "text-dark"
        }
      }
    }
  ]
}
```

#### Component Styles Structure
```json
{
  "card-style": {
    "name": "Card Style",
    "description": "Card with shadow",
    "template": "<div class=\"rounded-lg shadow-lg p-4\">{{content}}</div>",
    "css": ".card-style:hover { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); }"
  }
}
```

#### Table Templates Structure
```json
{
  "simple-header": {
    "name": "Simple Header Table",
    "rows": [
      {
        "cells": [
          {"content": "Header 1", "font_style": "normal"},
          {"content": "Header 2", "font_style": "normal"}
        ]
      }
    ],
    "column_widths": ["auto", "auto"]
  }
}
```

### Migration

**File**: `backend/webpages/migrations/0042_redesign_theme_system.py`

Automatic data migration:
- Converts `css_variables` → `colors`
- Converts `html_elements` → `typography` (creates default group)
- Converts `image_styles` → `component_styles` (preserves legacy config)
- Initializes empty structures for `fonts` and `table_templates`

### Theme Service

**File**: `backend/webpages/theme_service.py`

New methods:
- `get_google_fonts_url_for_page(page_id)` - Get Google Fonts URL for a page's theme
- `get_google_fonts_url_for_theme(theme_id)` - Get Google Fonts URL for a specific theme
- `get_component_style(theme_id, style_name)` - Get component style with fallback
- `get_table_template(theme_id, template_name)` - Get table template
- `get_theme_colors(theme_id)` - Get named colors from a theme

Updated methods:
- `generate_css_for_page()` - Now supports widget_type and slot parameters

### Fallback Service

**File**: `backend/webpages/theme_service.py` (ThemeFallbackService class)

Provides fallback values when theme elements are missing:
- Default system font stack
- Default color palette
- Default typography configuration
- Default component style
- Default table template

### API Endpoints

**File**: `backend/webpages/views/page_theme_views.py`

New endpoint:
- `POST /api/themes/{id}/clone/` - Clone a theme with all configuration

Updated:
- Serializer includes all new fields
- JSON field parsing includes new fields

## Frontend Implementation

### Utilities

#### Google Fonts Utility
**File**: `frontend/src/utils/googleFonts.js`

- List of 50+ popular Google Fonts
- `buildGoogleFontsUrl()` - Generate Google Fonts URL
- `loadGoogleFonts()` - Dynamically load fonts
- `searchFonts()` - Search fonts by name
- `getFontsByCategory()` - Filter by category

#### Theme Utilities
**File**: `frontend/src/utils/themeUtils.js`

- `generateTypographyCSS()` - Generate CSS from typography config
- `generateColorsCSS()` - Generate CSS variables from colors
- `resolveColor()` - Resolve named colors
- `isValidColor()` - Validate color values
- `getThemeFallback()` - Get fallback values

### Components

#### Typography Preview
**File**: `frontend/src/components/theme/TypographyPreview.jsx`

Live preview component showing all HTML elements with current typography styling.

#### Tab Components

**FontsTab** (`frontend/src/components/theme/FontsTab.jsx`):
- Google Fonts searchable dropdown with 50+ popular fonts
- Font preview with sample text
- Variant selector (weights)
- Category filtering

**ColorsTab** (`frontend/src/components/theme/ColorsTab.jsx`):
- Named color palette editor
- Color picker for each color
- Visual color preview grid
- Add/remove/rename colors

**TypographyTab** (`frontend/src/components/theme/TypographyTab.jsx`):
- Group-based typography management
- Widget type and slot targeting (AND relationship)
- Element editors for h1-h6, p, ul, ol, li, a, etc.
- Properties: font, size, lineHeight, fontWeight, color, margins, etc.
- Live preview integration

**ComponentStylesTab** (`frontend/src/components/theme/ComponentStylesTab.jsx`):
- HTML template editor with `{{content}}` placeholder
- Optional CSS editor
- Live preview
- Replaces "Image Styles" concept

**TableTemplatesTab** (`frontend/src/components/theme/TableTemplatesTab.jsx`):
- Visual editor using TableEditorCore
- JSON editor for quick copy-paste
- Template management

#### Main Theme Editor
**File**: `frontend/src/components/ThemeEditor.jsx`

Complete redesign with:
- List view with search
- Edit view with 5 tabs
- Create/Update/Delete/Clone operations
- Theme cloning support
- Responsive layout

### API Integration

**File**: `frontend/src/api/themes.js`

New method:
- `clone(themeId, data)` - Clone a theme

## Usage

### Creating a Theme

1. Navigate to Settings > Themes
2. Click "Create Theme"
3. Fill in basic information (name, description)
4. Configure each of the 5 parts:
   - **Fonts**: Add Google Fonts
   - **Colors**: Define named color palette
   - **Typography**: Create groups and style elements
   - **Component Styles**: Define HTML templates
   - **Table Templates**: Create table templates
5. Click "Save Theme"

### Using Typography Targeting

Typography groups can target specific contexts:

- **All widgets**: Leave widget_type and slot empty
- **Specific widget type**: Set widget_type (e.g., "text_block")
- **Specific slot**: Set slot (e.g., "header")
- **Both**: Set both for AND relationship (e.g., only text_block widgets in header slot)

Groups are applied in order, with more specific groups overriding general ones.

### Component Styles

Component styles use a template with `{{content}}` placeholder:

```html
<div class="rounded-lg shadow-lg p-4">
  {{content}}
</div>
```

Optional CSS can be added for advanced styling:

```css
.my-style:hover {
  box-shadow: 0 10px 15px rgba(0,0,0,0.1);
}
```

### Cloning Themes

Themes can be cloned to create variations:

1. Click the clone button on a theme
2. Enter a new name
3. The cloned theme includes all configuration

## Migration Notes

### Backwards Compatibility

The old fields (`css_variables`, `html_elements`, `image_styles`) are preserved and marked as deprecated. The system uses the new fields preferentially but falls back to old fields if new ones are empty.

### Automatic Migration

When running the migration, all existing themes are automatically converted:
- Color variables become the colors palette
- HTML elements become a default typography group
- Image styles become component styles (with legacy config preserved)

## Future Enhancements

Potential future improvements:
- Advanced font loading options
- Color scheme generators
- Typography presets
- Component style library
- Import/export themes
- Theme versioning

## Testing

To test the new theme system:

1. Create a new theme with all 5 parts configured
2. Apply typography targeting to specific widget types/slots
3. Create component styles with custom templates
4. Create table templates
5. Clone the theme
6. Verify migration of existing themes
7. Test fallback behavior when elements are missing

## Troubleshooting

### Google Fonts not loading

- Check the fonts configuration
- Verify the Google Fonts URL is generated correctly
- Check browser console for network errors

### Typography not applying

- Verify group targeting matches the context
- Check that color references exist in the color palette
- Ensure CSS property values are valid

### Component styles not rendering

- Verify the template includes `{{content}}` placeholder
- Check that the template HTML is valid
- Verify CSS syntax if custom CSS is provided

## Related Documentation

- See `backend/docs/ENHANCED_THEME_SYSTEM.md` for previous theme system docs (pre-V2)
- See `frontend/docs/THEME_MANAGEMENT.md` for frontend theme usage

