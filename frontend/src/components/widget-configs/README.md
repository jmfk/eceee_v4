# Dynamic Widget Configuration System

This directory contains the dynamic widget configuration form system that automatically generates user-friendly configuration forms for widget types based on their Pydantic model schemas.

## Overview

Instead of hardcoding configuration UIs for each widget type, this system:
1. Fetches widget configuration schemas from the backend API
2. Reads field metadata including UI component hints from `json_schema_extra`
3. Dynamically generates appropriate form fields based on the metadata
4. Provides a toggle between form view and JSON view for advanced users

## Components

### Core Components

- **`WidgetConfigRegistry.js`**: Manages loading and caching of widget configuration schemas from the backend API
- **`DynamicWidgetConfigForm.jsx`**: Main component that generates dynamic forms from widget schemas

### Field Components

Specialized input components for specific field types:

- **`SliderInput.jsx`**: Numeric slider with visual feedback and number input
- **`SegmentedControl.jsx`**: Radio-style button group for selecting from options
- **`ReorderableListInput.jsx`**: Array management with add/remove/reorder functionality

## Usage

### Basic Usage

```jsx
import DynamicWidgetConfigForm from './widget-configs/DynamicWidgetConfigForm'

function MyComponent() {
  const [config, setConfig] = useState({})

  return (
    <DynamicWidgetConfigForm
      widgetType="default_widgets.ContentWidget"
      config={config}
      onChange={setConfig}
      showJsonToggle={true}
    />
  )
}
```

### Adding Support for New Field Types

The system automatically supports these component types from `json_schema_extra`:

- `TextInput` - Single-line text input
- `TextareaInput` - Multi-line text area
- `HtmlSource` - Code editor for HTML
- `NumberInput` - Numeric input
- `BooleanInput` - Checkbox/toggle
- `SelectInput` - Dropdown select
- `SliderInput` - Range slider
- `SegmentedControlInput` - Radio buttons
- `ReorderableInput` - Array management
- `URLInput` - URL input with validation

To add support for a new component type, update the `renderField` method in `DynamicWidgetConfigForm.jsx`.

## Backend Integration

### API Endpoint

The system uses the `/api/v1/webpages/widget-types/{widget_type}/config-ui-schema/` endpoint which returns:

```json
{
  "widget_type": "default_widgets.ContentWidget",
  "widget_name": "Content",
  "schema": { /* JSON schema */ },
  "fields": {
    "content": {
      "name": "content",
      "type": "str",
      "required": true,
      "description": "HTML content to display",
      "ui": {
        "component": "HtmlSource",
        "rows": 6
      }
    }
  },
  "defaults": { /* default values */ },
  "required": ["content"]
}
```

### Pydantic Model Metadata

Widget configuration models use `json_schema_extra` to specify UI hints:

```python
class ContentConfig(BaseModel):
    content: str = Field(
        ...,
        description="HTML content to display",
        json_schema_extra={
            "component": "HtmlSource",
            "rows": 6,
        },
    )
    allow_scripts: bool = Field(
        False,
        description="WARNING: Only enable for trusted content",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle",
            "warning": True,
        },
    )
```

## Field Grouping and Ordering

Fields can be grouped and ordered using metadata:

```python
json_schema_extra={
    "component": "SliderInput",
    "group": "Display Options",  # Group name
    "order": 3,  # Display order within group
    "min": 1,
    "max": 30,
    "step": 1,
    "unit": "seconds"
}
```

## Features

### ✅ Automatic Form Generation
- Reads widget schemas and generates forms dynamically
- No manual UI coding needed for new widgets

### ✅ Type-Safe
- Uses Pydantic models on backend for validation
- Frontend validates against schema constraints

### ✅ Extensible
- Easy to add new field component types
- Supports custom field renderers

### ✅ User-Friendly
- Form view for easy editing
- JSON view for advanced users
- Real-time validation feedback

### ✅ Grouped Fields
- Fields organized by logical groups
- Ordered display based on metadata

## Testing

To test the system:

1. Navigate to Settings → Object Types
2. Edit or create an object type
3. Go to the "Slots" tab
4. Add a widget control
5. Expand the "Default Configuration" section
6. Verify the form is generated based on widget type
7. Toggle between Form and JSON views

## Future Enhancements

- [ ] Field dependencies (show/hide based on other fields)
- [ ] Live preview of widget with current configuration
- [ ] Configuration templates/presets
- [ ] Better support for nested objects
- [ ] Enhanced array item editing interface
- [ ] Validation error display inline with fields

