# Widget Configuration UI - Quick Reference

## For End Users

### How to Configure Widgets in Object Types

1. **Navigate**: Settings → Object Types → Select Type → Slots Tab
2. **Add Widget**: Select widget from dropdown → Click "Add Widget Control"
3. **Configure**: Expand "Default Configuration" section
4. **Edit**: Use the form fields to configure (or switch to JSON for advanced editing)
5. **Save**: Click "Save Slots Changes"

### Form vs JSON View

- **Form View** (Default): User-friendly interface with appropriate controls
- **JSON View**: Direct JSON editing for power users
- Toggle between views using Form/JSON buttons at the top

## For Widget Developers

### Add UI Metadata to Your Widget Config

```python
from pydantic import BaseModel, Field

class MyWidgetConfig(BaseModel):
    title: str = Field(
        ...,
        description="Widget title",
        json_schema_extra={
            "component": "TextInput",      # UI component type
            "placeholder": "Enter title",  # Placeholder text
            "order": 1,                    # Display order (optional)
            "group": "Basic Settings"      # Group name (optional)
        }
    )
    
    count: int = Field(
        5,
        ge=1,
        le=100,
        description="Number of items",
        json_schema_extra={
            "component": "SliderInput",
            "min": 1,
            "max": 100,
            "step": 1,
            "unit": "items",
            "showValue": True
        }
    )
```

### Available Component Types

| Component | Use For | Required Props | Optional Props |
|-----------|---------|----------------|----------------|
| `TextInput` | Short text | - | `placeholder`, `maxLength` |
| `TextareaInput` | Multi-line text | - | `rows`, `placeholder` |
| `HtmlSource` | HTML/Code | - | `rows` |
| `NumberInput` | Numbers | - | `min`, `max`, `step` |
| `BooleanInput` | True/False | - | `variant` (toggle/checkbox) |
| `SelectInput` | Dropdown | `options` | `placeholder` |
| `SliderInput` | Range | `min`, `max` | `step`, `unit`, `showValue` |
| `SegmentedControlInput` | Radio buttons | `options` | - |
| `ReorderableInput` | Arrays | `itemTemplate` | `allowAdd`, `allowRemove`, `allowReorder` |
| `URLInput` | URLs | - | `placeholder` |

### Grouping and Ordering

```python
json_schema_extra={
    "component": "TextInput",
    "group": "Display Settings",  # Group related fields
    "order": 1                    # Control display order (lower = earlier)
}
```

### Hide Fields from UI

```python
json_schema_extra={
    "hidden": True  # Field won't appear in form (managed programmatically)
}
```

### Example: Complete Widget Config

```python
class ImageConfig(BaseModel):
    # Basic field (ungrouped, shows first)
    mediaItems: List[ImageMediaItem] = Field(
        default_factory=list,
        json_schema_extra={"hidden": True}  # Hidden - managed by special editor
    )
    
    # Display Options group
    displayType: Literal["gallery", "carousel"] = Field(
        "gallery",
        json_schema_extra={
            "component": "SegmentedControlInput",
            "group": "Display Options",
            "order": 1,
            "options": [
                {"value": "gallery", "label": "Gallery", "icon": "Grid"},
                {"value": "carousel", "label": "Carousel", "icon": "Play"}
            ]
        }
    )
    
    enableLightbox: bool = Field(
        True,
        description="Enable lightbox for full-size viewing",
        json_schema_extra={
            "component": "BooleanInput",
            "group": "Display Options",
            "order": 2,
            "variant": "toggle"
        }
    )
    
    # Advanced Settings group
    autoPlayInterval: int = Field(
        3,
        ge=1,
        le=30,
        description="Auto-play interval in seconds",
        json_schema_extra={
            "component": "SliderInput",
            "group": "Advanced Settings",
            "order": 1,
            "min": 1,
            "max": 30,
            "step": 1,
            "unit": "seconds",
            "showValue": True
        }
    )
```

## For System Administrators

### API Endpoint

```
GET /api/v1/webpages/widget-types/{widget_type}/config-ui-schema/
```

Returns enhanced schema with UI metadata for building dynamic forms.

### Debugging

**Check if widget has config schema:**
```javascript
import { getWidgetSchema } from './components/widget-configs'
const schema = getWidgetSchema('default_widgets.ContentWidget')
console.log(schema)
```

**View loaded schemas:**
```javascript
import { widgetConfigRegistry } from './components/widget-configs'
console.log(widgetConfigRegistry.getAllSchemas())
```

## Common Patterns

### Text Fields with Validation

```python
email: str = Field(
    ...,
    description="Email address",
    json_schema_extra={
        "component": "TextInput",
        "placeholder": "user@example.com"
    }
)
```

### Toggles with Warnings

```python
allow_scripts: bool = Field(
    False,
    description="WARNING: Only enable for trusted content",
    json_schema_extra={
        "component": "BooleanInput",
        "variant": "toggle",
        "warning": True  # Shows warning icon
    }
)
```

### Sliders with Units

```python
duration: int = Field(
    30,
    ge=1,
    le=300,
    json_schema_extra={
        "component": "SliderInput",
        "min": 1,
        "max": 300,
        "step": 5,
        "unit": "seconds"
    }
)
```

### Dropdowns with Options

```python
size: str = Field(
    "medium",
    json_schema_extra={
        "component": "SelectInput",
        "options": ["small", "medium", "large"],
        "placeholder": "Select size..."
    }
)
```

### Array Management

```python
items: List[str] = Field(
    default_factory=list,
    json_schema_extra={
        "component": "ReorderableInput",
        "itemTemplate": {"name": "", "value": ""},
        "allowAdd": True,
        "allowRemove": True,
        "allowReorder": True
    }
)
```

## Tips

1. **Use Descriptive Labels**: Set `description` in Field() - it shows as help text
2. **Group Related Fields**: Use `group` to organize logically
3. **Order Matters**: Use `order` to control display sequence
4. **Hide Internal Fields**: Use `hidden: True` for fields managed programmatically
5. **Validate Constraints**: Use Pydantic validators (ge, le, min_length, max_length)
6. **Test Both Views**: Verify form view and JSON view work correctly

