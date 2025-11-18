# Widget Padding to Slot Gap Migration

## Summary

Successfully migrated widget spacing from hardcoded `margin-bottom: 30px` on individual widgets to configurable `gap` property on slot containers using the design groups system.

## Changes Made

### 1. Backend - Widget CSS Updates

Removed hardcoded `:not(:last-child) { margin-bottom: 30px; }` from:
- `backend/easy_widgets/widgets/content.py`
- `backend/easy_widgets/widgets/content_card.py`
- `backend/easy_widgets/widgets/banner.py`
- `backend/easy_widgets/widgets/hero.py`

### 2. Frontend - Slot Container Styling

Updated `frontend/src/index.css`:
- Added default slot container styles with `display: flex`, `flex-direction: column`, and `gap: 30px`
- This provides backward compatibility with existing 30px spacing

### 3. Backend - Layout Parts Configuration

Added `layout_parts` to all layout definitions:
- `backend/easy_layouts/layouts/main_layout.py`
- `backend/easy_layouts/layouts/landing_page.py`
- `backend/easy_layouts/layouts/two_column.py`
- `backend/easy_layouts/layouts/three_column.py`
- `backend/easy_layouts/layouts/sidebar_layout.py`
- `backend/easy_layouts/layouts/minimal.py`

Each layout now defines slot container parts with configurable properties:
```python
layout_parts = {
    "slot-{name}": {
        "label": "{Name} slot container",
        "properties": ["gap", "display", "flexDirection"],
    },
}
```

## How to Use

### Configure Slot Gap via Design Groups

1. Navigate to Theme Editor → Design Groups
2. Create or edit a design group
3. Add layout properties for slot containers:
   - Part name: `slot-main`, `slot-sidebar`, etc.
   - Property: `gap`
   - Value: `20px`, `1.5rem`, etc.
   - Breakpoints: Configure responsive gaps for sm, md, lg, xl

### Example Design Group Configuration

```json
{
  "groups": [
    {
      "name": "Main Slot Spacing",
      "widgetTypes": [],
      "slots": ["main"],
      "layoutProperties": {
        "slot-main": {
          "sm": {
            "gap": "20px"
          },
          "md": {
            "gap": "30px"
          },
          "lg": {
            "gap": "40px"
          }
        }
      }
    }
  ]
}
```

## Benefits

1. **Configurable**: Spacing can be customized per slot via design groups
2. **Responsive**: Different gap values for different breakpoints
3. **Maintainable**: No hardcoded values in widget CSS
4. **Consistent**: All spacing controlled through the theme system
5. **Backward Compatible**: Default 30px gap maintains existing visual appearance

## Technical Details

### Slot Container Structure

Backend template tag creates:
```html
<div class="layout-slot slot-{name}" data-slot-name="{name}">
  <!-- widgets rendered here -->
</div>
```

### CSS Targeting

Design groups can target slots using the `.slot-{name}` class:
```css
.slot-main {
  display: flex;
  flex-direction: column;
  gap: 30px;
}
```

### Properties Available

Slot containers support:
- `gap` - Spacing between widgets
- `display` - Display mode (flex, grid, etc.)
- `flexDirection` - Flex direction (column, row, etc.)

## Migration Notes

- Existing pages will maintain 30px spacing via default CSS
- No database migration required
- Theme configurations should be updated to leverage new gap controls
- Widget CSS is now cleaner without spacing concerns

