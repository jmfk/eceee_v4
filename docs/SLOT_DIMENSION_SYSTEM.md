# Slot Dimension System

> **Implementation Guide for Widget Rendering with Responsive Dimensions**  
> **Status**: ✅ Implemented  
> **Last Updated**: October 2025

## Overview

The slot dimension system provides widgets with explicit information about their rendering dimensions across different responsive breakpoints. This enables widgets to make intelligent decisions about content optimization (e.g., image sizing) without relying on CSS parsing or runtime calculations.

## Key Concepts

### 1. **Responsive Breakpoints**

The system uses three standard breakpoints matching Tailwind CSS:

- **`mobile`**: < 640px (smartphones)
- **`tablet`**: 640px - 1024px (tablets, small laptops)
- **`desktop`**: > 1024px (desktops, large screens)

### 2. **Dimension Values**

Dimensions are specified per breakpoint with three possible value types:

- **`None`**: Unknown/dynamic dimension (widget should handle gracefully)
- **`int` (e.g., `896`)**: Absolute pixels (used in **layout slots**)
- **`float` 0.0-1.0 (e.g., `0.48`)**: Fraction of parent (used in **container widget slots**)

### 3. **Dimension Propagation Flow**

```
Layout (absolute pixels)
  ↓
Layout Slot (896px on desktop)
  ↓
Widget in Slot (receives 896px)
  ↓
Container Widget (TwoColumns)
  ↓
Container Slot (0.48 fraction = 48% of parent)
  ↓
Nested Widget (receives 896 × 0.48 = 430px)
```

## Implementation

### For Layout Developers

Add `dimensions` to each slot in your layout's `slot_configuration`:

```python
# backend/default_layouts/layouts/single_column.py

from webpages.layout_registry import BaseLayout, register_layout

@register_layout
class SingleColumnLayout(BaseLayout):
    name = "single_column"
    template_name = "default_layouts/layouts/single_column.html"

    @property
    def slot_configuration(self):
        return {
            "slots": [
                {
                    "name": "main",
                    "title": "Main Content",
                    "description": "Primary page content area",
                    "max_widgets": None,
                    "css_classes": "slot-main max-w-4xl",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 768, "height": None},
                        "desktop": {"width": 896, "height": None},  # max-w-4xl
                    },
                },
                {
                    "name": "sidebar",
                    "title": "Sidebar",
                    "dimensions": {
                        "mobile": {"width": 360, "height": None},
                        "tablet": {"width": 320, "height": None},
                        "desktop": {"width": 320, "height": None},
                    },
                },
            ]
        }
```

**Tip**: Calculate dimensions based on your CSS classes:
- `max-w-4xl` = 896px
- `max-w-screen-lg` = 1024px
- Account for padding/margins in calculations

### For Container Widget Developers

Container widgets (like TwoColumnsWidget, ThreeColumnsWidget) need to:

1. **Define slot metadata** using `get_slot_definitions()` classmethod
2. **Calculate nested dimensions** in `prepare_template_context()`

```python
# backend/default_widgets/widgets/two_columns.py

from webpages.widget_registry import BaseWidget, register_widget_type

@register_widget_type
class TwoColumnsWidget(BaseWidget):
    name = "Two Columns"
    template_name = "default_widgets/widgets/two_columns.html"
    
    @classmethod
    def get_slot_definitions(cls):
        """Define nested slot dimensions as fractions of parent"""
        return {
            "left": {
                "name": "left",
                "title": "Left Column",
                "max_widgets": 10,
                "dimensions": {
                    "mobile": {"width": 1.0, "height": None},   # 100% on mobile (stacked)
                    "tablet": {"width": 0.48, "height": None},  # 48% on tablet (side-by-side)
                    "desktop": {"width": 0.48, "height": None}, # 48% on desktop
                },
            },
            "right": {
                "name": "right",
                "title": "Right Column",
                "max_widgets": 10,
                "dimensions": {
                    "mobile": {"width": 1.0, "height": None},
                    "tablet": {"width": 0.48, "height": None},
                    "desktop": {"width": 0.48, "height": None},
                },
            },
        }
    
    def prepare_template_context(self, config, context=None):
        """Render nested widgets with calculated dimensions"""
        renderer = WebPageRenderer(request=context["request"])
        template_config = super().prepare_template_context(config, context)
        
        # Get this widget's dimensions from parent
        parent_dimensions = self.get_widget_dimensions(context)
        
        # Get slot definitions
        slot_defs = self.get_slot_definitions()
        
        # Get nested widgets data
        slots_data = config.get("slots", {"left": [], "right": []})
        
        # Render each slot
        rendered_slots = {}
        for slot_name, widgets in slots_data.items():
            # Calculate pixel dimensions for this slot
            slot_def = slot_defs.get(slot_name, {})
            slot_dim_fractions = slot_def.get('dimensions', {})
            nested_slot_dimensions = self.calculate_nested_slot_dimensions(
                parent_dimensions, slot_dim_fractions
            )
            
            # Render nested widgets with calculated dimensions
            rendered_widgets = []
            for widget_data in widgets:
                widget_html = renderer.render_widget_json(
                    widget_data, context, slot_dimensions=nested_slot_dimensions
                )
                rendered_widgets.append({"html": widget_html, "widget_data": widget_data})
            
            rendered_slots[slot_name] = rendered_widgets
        
        template_config["rendered_slots"] = rendered_slots
        return template_config
```

**Why use fractions (0.0-1.0)?**
- Parent dimensions are already in pixels from the layout
- Fraction × parent_pixels = child_pixels
- Accounts for CSS gaps/gutters by using values like 0.48 instead of 0.5

### For Widget Developers (Using Dimensions)

Any widget can access its dimensions to optimize rendering:

```python
# backend/default_widgets/widgets/image.py

class ImageWidget(BaseWidget):
    def prepare_template_context(self, config, context=None):
        template_config = super().prepare_template_context(config, context)
        
        # Get widget dimensions
        dimensions = self.get_widget_dimensions(context)
        
        # Generate responsive image sizes
        desktop_width = dimensions.get('desktop', {}).get('width')
        tablet_width = dimensions.get('tablet', {}).get('width')
        mobile_width = dimensions.get('mobile', {}).get('width')
        
        if desktop_width:
            template_config['optimized_images'] = {
                'mobile': self.generate_image_url(mobile_width),
                'tablet': self.generate_image_url(tablet_width),
                'desktop': self.generate_image_url(desktop_width),
            }
            
            # For srcset attribute
            template_config['srcset'] = (
                f"{template_config['optimized_images']['mobile']} {mobile_width}w, "
                f"{template_config['optimized_images']['tablet']} {tablet_width}w, "
                f"{template_config['optimized_images']['desktop']} {desktop_width}w"
            )
        
        return template_config
```

## Helper Utilities

The `webpages.utils.dimension_helpers` module provides utility functions:

```python
from webpages.utils.dimension_helpers import (
    create_dimension_dict,
    calculate_slot_dimensions,
    calculate_multi_column_dimensions,
    format_dimensions_for_display,
)

# Create standard dimension dict
dims = create_dimension_dict(
    mobile_width=360,
    tablet_width=768,
    desktop_width=896
)

# Calculate column dimensions with gaps
column_dims = calculate_multi_column_dimensions(
    parent_dimensions=dims,
    num_columns=2,
    gap=16  # 1rem
)

# Debug output
print(format_dimensions_for_display(dims))
# Output: "mobile: 360x? | tablet: 768x? | desktop: 896x?"
```

## BaseWidget Methods

### `get_widget_dimensions(context)`

Get the dimensions for the current widget from the rendering context.

```python
dimensions = self.get_widget_dimensions(context)
# Returns: {"mobile": {"width": 360, "height": None}, ...}
```

### `calculate_nested_slot_dimensions(parent_dims, slot_dims)`

Calculate pixel dimensions for a nested slot based on parent dimensions and slot fractions.

```python
nested_dims = self.calculate_nested_slot_dimensions(
    parent_dimensions={"desktop": {"width": 896, "height": None}},
    slot_dimensions={"desktop": {"width": 0.5, "height": None}}
)
# Returns: {"desktop": {"width": 448, "height": None}}
```

### `get_slot_definitions()` (classmethod)

Define slots provided by a container widget. Optional - only implement if your widget contains nested slots.

```python
@classmethod
def get_slot_definitions(cls):
    return {
        "slot_name": {
            "name": "slot_name",
            "title": "Slot Title",
            "dimensions": {
                "mobile": {"width": 1.0, "height": None},
                "tablet": {"width": 0.5, "height": None},
                "desktop": {"width": 0.5, "height": None},
            }
        }
    }
```

## Technical Details

### Rendering Pipeline

1. **`WebPageRenderer._render_widgets_by_slot()`**
   - Extracts dimensions from layout's slot configuration
   - Passes dimensions to `render_widget_json()`

2. **`WebPageRenderer.render_widget_json(widget_data, context, slot_dimensions)`**
   - Adds `slot_dimensions` to context as `_widget_dimensions`
   - Calls widget's `prepare_template_context()` with enhanced context

3. **Container Widget's `prepare_template_context()`**
   - Retrieves its dimensions via `get_widget_dimensions(context)`
   - Gets slot definitions via `get_slot_definitions()`
   - Calculates nested slot dimensions via `calculate_nested_slot_dimensions()`
   - Recursively renders nested widgets with calculated dimensions

### Context Structure

```python
context = {
    # ... existing context ...
    '_widget_dimensions': {
        'mobile': {'width': 360, 'height': None},
        'tablet': {'width': 768, 'height': None},
        'desktop': {'width': 896, 'height': None},
    }
}
```

## Example: Nested Dimension Calculation

Given this structure:
```
SingleColumnLayout
└─ Slot: "main" (desktop: 896px)
   └─ TwoColumnsWidget
      ├─ Slot: "left" (desktop: 0.48)
      │  └─ ImageWidget (desktop: 896 × 0.48 = 430px)
      └─ Slot: "right" (desktop: 0.48)
         └─ ContentWidget (desktop: 430px)
```

**Calculation flow:**

1. Layout defines `"main"` slot with `desktop: {"width": 896}`
2. TwoColumnsWidget receives `896px` in `_widget_dimensions`
3. TwoColumnsWidget defines `"left"` slot with fraction `0.48`
4. ImageWidget receives calculated `896 × 0.48 = 430px`
5. ImageWidget can now generate optimized image at 430px width

## Best Practices

### ✅ DO

- Define dimensions in layouts based on actual CSS max-widths
- Use fractions (0.0-1.0) in container widget slots
- Account for gaps/gutters (use 0.48 instead of 0.5 for 2 columns with gap)
- Handle `None` values gracefully in widgets
- Use dimensions for image optimization and content decisions

### ❌ DON'T

- Don't try to calculate exact pixel dimensions from CSS classes at runtime
- Don't assume dimensions are always present (check for None)
- Don't use dimensions for layout/styling (use CSS for that)
- Don't forget to propagate dimensions in container widgets

## Frontend Integration

The frontend will need similar dimension information for the page editor. Expose slot definitions via the widget API:

```python
# backend/webpages/serializers.py

class WidgetSerializer(serializers.Serializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        
        # Add slot definitions for container widgets
        widget_type = widget_registry.get_widget_type(instance.widget_type)
        if hasattr(widget_type, 'get_slot_definitions'):
            data['slot_definitions'] = widget_type.get_slot_definitions()
        
        return data
```

## Testing

Test dimension propagation:

```python
# Test layout slot dimensions
layout = SingleColumnLayout()
config = layout.slot_configuration
assert config['slots'][0]['dimensions']['desktop']['width'] == 896

# Test container widget slot definitions
slot_defs = TwoColumnsWidget.get_slot_definitions()
assert slot_defs['left']['dimensions']['desktop']['width'] == 0.48

# Test dimension calculation
widget = TwoColumnsWidget()
parent_dims = {"desktop": {"width": 896, "height": None}}
slot_dims = {"desktop": {"width": 0.48, "height": None}}
result = widget.calculate_nested_slot_dimensions(parent_dims, slot_dims)
assert result['desktop']['width'] == 430  # 896 × 0.48
```

## Migration Guide

For existing layouts and widgets:

1. **Layouts**: Add `dimensions` field to existing slot configurations
2. **Container Widgets**: Implement `get_slot_definitions()` and update `prepare_template_context()`
3. **Regular Widgets**: Optionally use `get_widget_dimensions()` for optimization
4. **Backward Compatibility**: System gracefully handles missing dimensions (returns `None`)

## Future Enhancements

Possible future improvements:

- **Auto-calculation**: Parse CSS classes to automatically determine dimensions
- **Dynamic breakpoints**: Support custom breakpoint definitions
- **Height calculation**: More sophisticated height estimation
- **Frontend parity**: Sync dimension system with frontend editor

## Summary

The slot dimension system provides:

✅ **Explicit dimensions** defined in code, not inferred from CSS  
✅ **Responsive awareness** across mobile, tablet, desktop  
✅ **Simple propagation** through rendering pipeline  
✅ **Nested support** for container widgets with automatic calculation  
✅ **Optional usage** - widgets can ignore if not needed  
✅ **Performance** - no runtime CSS parsing or queries  

This enables widgets to make smart decisions about content optimization while keeping the implementation simple and maintainable.

