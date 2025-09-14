# Pydantic Widget Controls Guide

**Version**: 1.0  
**Date**: December 2024  
**Status**: Implementation Guide

## Overview

This guide explains how to add UI controls to Pydantic widget configuration classes using the `json_schema_extra` parameter. This allows you to specify which form field components should be used for each property in widget configuration forms.

## Control Specification Methods

### Method 1: Field-Level Control Specifications (Recommended)

Use `json_schema_extra` in Field definitions to specify UI controls:

```python
from pydantic import BaseModel, Field
from typing import Optional, Literal, List

class WidgetConfig(BaseModel):
    """Example widget configuration with controls"""
    
    # Basic text input
    title: str = Field(
        ..., 
        description="Widget title",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "Enter title..."
        }
    )
    
    # Rich text editor
    content: str = Field(
        ..., 
        description="Widget content",
        json_schema_extra={
            "component": "RichTextInput",
            "rows": 6,
            "toolbar": "full"
        }
    )
```

### Method 2: Model-Level Control Configuration

Add a class method to generate control specifications:

```python
class WidgetConfig(BaseModel):
    title: str = Field(..., description="Widget title")
    color: str = Field("#000000", description="Widget color")
    
    @classmethod
    def get_control_config(cls):
        """Return control configuration for this widget"""
        return {
            "title": {
                "component": "TextInput",
                "placeholder": "Enter title..."
            },
            "color": {
                "component": "ColorInput",
                "showPresets": True,
                "showEyeDropper": True
            }
        }
```

## Available Control Types

### Basic Input Controls

#### Text Input
```python
name: str = Field(
    ...,
    json_schema_extra={
        "control_type": "text",
        "component": "TextInput",
        "placeholder": "Enter name...",
        "maxLength": 100
    }
)
```

#### Textarea Input
```python
description: str = Field(
    ...,
    json_schema_extra={
        "control_type": "textarea",
        "component": "TextareaInput",
        "rows": 4,
        "placeholder": "Enter description...",
        "maxLength": 500,
        "showCharacterCount": True
    }
)
```

#### Number Input
```python
count: int = Field(
    1,
    json_schema_extra={
        "control_type": "number",
        "component": "NumberInput",
        "min": 1,
        "max": 100,
        "step": 1
    }
)
```

#### Password Input
```python
api_key: str = Field(
    ...,
    json_schema_extra={
        "control_type": "password",
        "component": "PasswordInput",
        "showStrengthIndicator": True,
        "minLength": 8
    }
)
```

### Selection Controls

#### Dropdown Select
```python
status: Literal["draft", "published", "archived"] = Field(
    "draft",
    json_schema_extra={
        "control_type": "choice",
        "component": "SelectInput",
        "placeholder": "Select status...",
        "options": [
            {"value": "draft", "label": "Draft"},
            {"value": "published", "label": "Published"},
            {"value": "archived", "label": "Archived"}
        ]
    }
)
```

#### Value List Integration
```python
category: Optional[str] = Field(
    None,
    json_schema_extra={
        "control_type": "choice",
        "component": "SelectInput",
        "valueListName": "categories",  # References a value list
        "placeholder": "Select category..."
    }
)
```

#### Segmented Control
```python
layout: Literal["grid", "list", "cards"] = Field(
    "grid",
    json_schema_extra={
        "control_type": "segmented_control",
        "component": "SegmentedControlInput",
        "variant": "default",
        "options": [
            {"value": "grid", "label": "Grid", "icon": "Grid"},
            {"value": "list", "label": "List", "icon": "List"},
            {"value": "cards", "label": "Cards", "icon": "Square"}
        ]
    }
)
```

#### Multi-Select
```python
tags: List[str] = Field(
    default_factory=list,
    json_schema_extra={
        "control_type": "tags",
        "component": "TagInput",
        "allowCreate": True,
        "maxTags": 10,
        "suggestions": ["react", "javascript", "python", "design"]
    }
)
```

### Advanced Controls

#### Color Picker
```python
background_color: str = Field(
    "#ffffff",
    json_schema_extra={
        "control_type": "color",
        "component": "ColorInput",
        "format": "hex",
        "showPresets": True,
        "showEyeDropper": True,
        "allowTransparent": True
    }
)
```

#### Slider/Range
```python
opacity: float = Field(
    1.0,
    ge=0.0,
    le=1.0,
    json_schema_extra={
        "control_type": "slider",
        "component": "SliderInput",
        "min": 0,
        "max": 1,
        "step": 0.1,
        "showValue": True,
        "formatValue": lambda x: f"{x:.1f}"
    }
)
```

#### Rating
```python
priority: int = Field(
    3,
    ge=1,
    le=5,
    json_schema_extra={
        "control_type": "rating",
        "component": "RatingInput",
        "max": 5,
        "icon": "star",
        "allowClear": True
    }
)
```

#### Date/Time Controls
```python
start_date: Optional[str] = Field(
    None,
    json_schema_extra={
        "control_type": "date",
        "component": "DateInput",
        "min": "2024-01-01",
        "max": "2025-12-31"
    }
)

event_period: Optional[dict] = Field(
    None,
    json_schema_extra={
        "control_type": "date_range",
        "component": "DateRangeInput",
        "allowSameDate": True,
        "showPresets": True
    }
)
```

### Special Interactive Controls

#### Command Palette
```python
quick_action: Optional[str] = Field(
    None,
    json_schema_extra={
        "control_type": "command_palette",
        "component": "CommandPaletteInput",
        "actions": [
            {"id": "save", "label": "Save Widget", "category": "Actions"},
            {"id": "duplicate", "label": "Duplicate Widget", "category": "Actions"}
        ]
    }
)
```

#### Reorderable List
```python
menu_items: List[dict] = Field(
    default_factory=list,
    json_schema_extra={
        "control_type": "reorderable_list",
        "component": "ReorderableInput",
        "allowAdd": True,
        "allowRemove": True,
        "allowReorder": True,
        "itemTemplate": {"label": "", "url": ""}
    }
)
```

#### Rule Builder
```python
filter_rules: Optional[dict] = Field(
    None,
    json_schema_extra={
        "control_type": "rule_builder",
        "component": "RuleBuilderInput",
        "fields": [
            {"key": "title", "label": "Title", "type": "string"},
            {"key": "status", "label": "Status", "type": "select", "options": ["draft", "published"]}
        ],
        "maxDepth": 3
    }
)
```

## Control Properties Reference

### Common Properties
- **`control_type`** - Maps to field type registry (required)
- **`component`** - React component name (required)
- **`placeholder`** - Input placeholder text
- **`disabled`** - Whether the field is disabled
- **`required`** - Whether the field is required (usually from Field())

### Input-Specific Properties
- **`rows`** - Number of rows for textarea
- **`maxLength`** - Maximum character length
- **`showCharacterCount`** - Show character counter
- **`autoResize`** - Auto-resize textarea

### Number-Specific Properties
- **`min`** - Minimum value
- **`max`** - Maximum value
- **`step`** - Step size for increments
- **`precision`** - Decimal places
- **`unit`** - Display unit (%, px, etc.)

### Selection-Specific Properties
- **`options`** - Array of {value, label, icon?} objects
- **`valueListName`** - Reference to value list by slug
- **`multiple`** - Allow multiple selections
- **`searchable`** - Enable search functionality

### Advanced Properties
- **`variant`** - UI variant (toggle, pills, buttons, etc.)
- **`showPresets`** - Show preset options (colors, dates, etc.)
- **`allowCreate`** - Allow creating new options
- **`maxItems`** - Maximum number of items

## Frontend Integration

### Using Controls in SchemaFieldRenderer

The `SchemaFieldRenderer` component automatically reads control specifications:

```javascript
// In SchemaFieldRenderer.jsx
const getFieldComponent = (fieldSchema) => {
    const controlType = fieldSchema.json_schema_extra?.control_type || 'text'
    const uiComponent = fieldSchema.json_schema_extra?.component || 'TextInput'
    
    return {
        component: uiComponent,
        props: fieldSchema.json_schema_extra || {}
    }
}
```

### Enhanced Widget Editor Integration

Update the WidgetEditorPanel to use control specifications:

```javascript
// In WidgetEditorPanel.jsx
const renderFormField = (fieldName, fieldSchema) => {
    const controlConfig = fieldSchema.json_schema_extra
    
    if (controlConfig?.control_type) {
        return (
            <SchemaFieldRenderer
                fieldName={fieldName}
                fieldSchema={fieldSchema}
                value={config[fieldName]}
                onChange={(value) => handleFieldChange(fieldName, value)}
                {...controlConfig}
            />
        )
    }
    
    // Fallback to existing logic
    return renderLegacyField(fieldName, fieldSchema)
}
```

## Best Practices

### 1. Use Appropriate Control Types
Match the control type to the data type and user interaction:

```python
# Good: Color picker for color values
background_color: str = Field(
    "#ffffff",
    json_schema_extra={"control_type": "color", "component": "ColorInput"}
)

# Good: Slider for numeric ranges
opacity: float = Field(
    1.0,
    json_schema_extra={"control_type": "slider", "component": "SliderInput"}
)

# Good: Segmented control for few options
size: Literal["small", "medium", "large"] = Field(
    "medium",
    json_schema_extra={"control_type": "segmented_control"}
)
```

### 2. Leverage Value Lists
Use value lists for commonly used dropdown options:

```python
# Good: Reference value list
country: Optional[str] = Field(
    None,
    json_schema_extra={
        "control_type": "choice",
        "valueListName": "countries"
    }
)

# Avoid: Hardcoded options in every widget
country: Literal["US", "CA", "GB"] = Field("US")
```

### 3. Provide Helpful Defaults
Include sensible defaults and placeholders:

```python
submit_url: Optional[str] = Field(
    None,
    json_schema_extra={
        "control_type": "url",
        "component": "URLInput",
        "placeholder": "https://example.com/submit",
        "description": "Leave empty to submit to current page"
    }
)
```

### 4. Use Advanced Controls for Complex Data
Leverage sophisticated controls for complex interactions:

```python
# Rule builder for complex filtering
filter_conditions: Optional[dict] = Field(
    None,
    json_schema_extra={
        "control_type": "rule_builder",
        "component": "RuleBuilderInput",
        "fields": [
            {"key": "title", "label": "Title", "type": "string"},
            {"key": "date", "label": "Date", "type": "date"}
        ]
    }
)

# Reorderable list for ordered items
navigation_items: List[dict] = Field(
    default_factory=list,
    json_schema_extra={
        "control_type": "reorderable_list",
        "component": "ReorderableInput",
        "itemTemplate": {"label": "", "url": "", "icon": ""}
    }
)
```

## Complete Example

Here's a comprehensive example showing all control types:

```python
class AdvancedWidgetConfig(BaseModel):
    """Advanced widget with all control types"""
    
    # Basic inputs
    title: str = Field(..., json_schema_extra={"control_type": "text"})
    content: str = Field(..., json_schema_extra={"control_type": "rich_text"})
    count: int = Field(1, json_schema_extra={"control_type": "numeric_stepper"})
    
    # Selection controls
    category: str = Field(..., json_schema_extra={
        "control_type": "choice", 
        "valueListName": "categories"
    })
    tags: List[str] = Field(default_factory=list, json_schema_extra={
        "control_type": "tags",
        "allowCreate": True
    })
    
    # Advanced controls
    background_color: str = Field("#ffffff", json_schema_extra={
        "control_type": "color",
        "showPresets": True
    })
    priority: int = Field(3, json_schema_extra={
        "control_type": "rating",
        "max": 5
    })
    opacity: float = Field(1.0, json_schema_extra={
        "control_type": "slider",
        "min": 0,
        "max": 1,
        "step": 0.1
    })
    
    # Special controls
    rules: Optional[dict] = Field(None, json_schema_extra={
        "control_type": "rule_builder",
        "maxDepth": 3
    })
    items: List[dict] = Field(default_factory=list, json_schema_extra={
        "control_type": "reorderable_list",
        "allowAdd": True
    })
```

## Frontend Integration

### Reading Control Specifications

The frontend can read control specifications from the JSON schema:

```javascript
// Extract control configuration
const getControlConfig = (fieldSchema) => {
    const extra = fieldSchema.json_schema_extra || {}
    return {
        controlType: extra.control_type || 'text',
        component: extra.component || 'TextInput',
        props: extra
    }
}

// Use in form rendering
const renderField = (fieldName, fieldSchema) => {
    const { controlType, component, props } = getControlConfig(fieldSchema)
    
    return (
        <DynamicFieldComponent
            component={component}
            {...props}
            value={value}
            onChange={onChange}
        />
    )
}
```

### Widget Editor Integration

Integrate with the existing WidgetEditorPanel:

```javascript
// Enhanced field rendering
const renderFormField = (fieldName, fieldSchema) => {
    const controlConfig = fieldSchema.json_schema_extra
    
    if (controlConfig?.control_type) {
        // Use new control system
        return (
            <SchemaFieldRenderer
                fieldName={fieldName}
                fieldSchema={fieldSchema}
                value={config[fieldName]}
                onChange={(value) => handleFieldChange(fieldName, value)}
            />
        )
    }
    
    // Fallback to existing logic for backward compatibility
    return renderLegacyField(fieldName, fieldSchema)
}
```

## Migration Strategy

### Gradual Migration
1. **Add controls to new widgets** - Use control specifications for new widget types
2. **Enhance existing widgets** - Add controls to existing Pydantic classes gradually
3. **Update widget editor** - Enhance WidgetEditorPanel to use control specifications
4. **Test thoroughly** - Ensure backward compatibility with existing widgets

### Backward Compatibility
- **Fallback rendering** - Existing widgets continue to work
- **Progressive enhancement** - Add controls without breaking existing functionality
- **Optional controls** - Control specifications are optional, not required

## 📋 Field Ordering and Grouping

You can control field order and grouping using `order` and optional `group` properties:

### Global Ordering
All fields have a global order number (1, 2, 3, 4, 5...):
```python
class WidgetConfig(BaseModel):
    title: str = Field(..., json_schema_extra={
        "component": "TextInput",
        "order": 1  # Appears first globally
    })
    
    description: str = Field(..., json_schema_extra={
        "component": "TextareaInput", 
        "order": 2  # Appears second globally
    })
```

### Optional Grouping
Fields can optionally belong to named groups:
```python
class WidgetConfig(BaseModel):
    # Non-grouped fields (appear first, in order)
    title: str = Field(..., json_schema_extra={
        "component": "TextInput",
        "order": 1  # First non-grouped field
    })
    
    enabled: bool = Field(True, json_schema_extra={
        "component": "BooleanInput", 
        "order": 2  # Second non-grouped field
    })
    
    # Grouped fields (appear after non-grouped, in group order)
    layout: str = Field("grid", json_schema_extra={
        "component": "SegmentedControlInput",
        "order": 3,
        "group": "Display Options"  # This group appears first (order 3)
    })
    
    theme: str = Field("light", json_schema_extra={
        "component": "SelectInput",
        "order": 4,
        "group": "Display Options"  # Same group, appears after layout
    })
    
    debug: bool = Field(False, json_schema_extra={
        "component": "BooleanInput",
        "order": 5, 
        "group": "Advanced Settings"  # This group appears second (order 5)
    })
```

### Rendering Logic
1. **Non-grouped fields first** - Rendered in global order
2. **Groups by lowest order** - Groups appear in order of their lowest-ordered field
3. **Within groups by order** - Fields within each group sorted by their order

### Real Example (ImageConfig)
```python
class ImageConfig(BaseModel):
    # Non-grouped fields (appear first)
    enableLightbox: bool = Field(True, json_schema_extra={
        "component": "BooleanInput",
        "order": 1  # First field
    })
    
    showCaptions: bool = Field(True, json_schema_extra={
        "component": "BooleanInput",
        "order": 2  # Second field
    })
    
    # Display Options group (appears next, starts at order 3)
    displayType: str = Field("gallery", json_schema_extra={
        "component": "SegmentedControlInput", 
        "order": 3,
        "group": "Display Options"
    })
    
    imageStyle: str = Field(None, json_schema_extra={
        "component": "SelectInput",
        "order": 4,
        "group": "Display Options" 
    })
    
    # Advanced Settings group (appears last, starts at order 5)
    autoPlay: bool = Field(False, json_schema_extra={
        "component": "BooleanInput",
        "order": 5,
        "group": "Advanced Settings"
    })
    
    autoPlayInterval: int = Field(3, json_schema_extra={
        "component": "SliderInput", 
        "order": 6,
        "group": "Advanced Settings"
    })
```

**Result:** 
1. Enable Lightbox (order 1)
2. Show Captions (order 2)  
3. **Display Options** group header
   - Display Type (order 3)
   - Image Style (order 4)
4. **Advanced Settings** group header
   - Auto Play (order 5)
   - Auto Play Interval (order 6)

## Benefits

### Developer Experience
- **Declarative UI** - Specify controls directly in Pydantic models
- **Type safety** - Controls match Pydantic field types
- **Centralized** - All widget configuration in one place
- **Reusable** - Control patterns can be reused across widgets

### User Experience
- **Better widgets** - Rich UI controls for widget configuration
- **Consistent interface** - Same controls across all widgets
- **Advanced interactions** - Sophisticated controls for complex configuration
- **Intuitive editing** - Appropriate controls for each data type

### Maintenance
- **Single source of truth** - Controls defined with data models
- **Easy updates** - Change controls by updating Pydantic classes
- **Version control** - Control specifications tracked with code
- **Documentation** - Controls self-document through field descriptions

## Conclusion

Adding controls to Pydantic widget classes provides a powerful way to enhance the widget editing experience. By using `json_schema_extra`, you can specify exactly which UI components should be used for each field, creating a rich, intuitive interface for widget configuration.

The control system integrates seamlessly with the existing form field widgets system, providing type-safe, reusable controls that enhance both developer and user experience.
