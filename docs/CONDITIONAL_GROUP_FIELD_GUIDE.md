# ConditionalGroupField Guide

**Version**: 1.0  
**Date**: October 2025  
**Status**: Implementation Guide

## Overview

`ConditionalGroupField` is a generic, reusable form field component that displays a button group or selectbox to switch between different configuration forms. Each group can reference a Pydantic model for its schema, enabling dynamic, type-safe conditional forms throughout the application.

## Features

- **Dynamic Schema Fetching**: Automatically fetches Pydantic model schemas from the backend
- **UDC Integration**: Full support for Unified Data Context with ref-based storage and external change subscription
- **Multiple Variants**: Supports button group (SegmentedControl) or selectbox rendering
- **"None" Option**: Can render groups with no configuration form
- **Automatic Form Clearing**: Clears form data when switching between groups
- **Validation Support**: Per-field and per-form validation
- **Type Safety**: Pydantic models ensure type-safe configuration

## Architecture

```
┌─────────────────────────────────────────────┐
│         ConditionalGroupField               │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Group Selector                     │   │
│  │  (SegmentedControl or SelectInput)  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Dynamic Form Renderer              │   │
│  │  ┌───────────────────────────────┐  │   │
│  │  │ Schema Fetcher                │  │   │
│  │  │ GET /api/.../schema/          │  │   │
│  │  └───────────────────────────────┘  │   │
│  │  ┌───────────────────────────────┐  │   │
│  │  │ Field Renderer                │  │   │
│  │  │ (Schema-driven components)    │  │   │
│  │  └───────────────────────────────┘  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  UDC Integration                    │   │
│  │  - useExternalChanges               │   │
│  │  - publishUpdate                    │   │
│  │  - Ref-based storage                │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Backend Usage

### Step 1: Define Pydantic Config Models

Create separate Pydantic models for each configuration option.

**Important:** Use `alias_generator=to_camel` to ensure JSON schema properties use camelCase (matching frontend conventions):

```python
from pydantic import BaseModel, Field, ConfigDict
from pydantic.alias_generators import to_camel
from typing import Optional, List, Literal

class InternalLinkConfig(BaseModel):
    """Internal page link configuration"""
    
    model_config = ConfigDict(
        alias_generator=to_camel,      # Converts snake_case → camelCase in JSON schema
        populate_by_name=True,          # Allows both snake_case and camelCase inputs
    )
    
    page_id: str = Field(
        ..., 
        description="Page ID",
        json_schema_extra={
            "component": "PageSelectInput",
            "placeholder": "Select a page..."
        }
    )
    label: str = Field(
        ..., 
        description="Link label",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "Home"
        }
    )

class ExternalLinkConfig(BaseModel):
    """External URL link configuration"""
    
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    
    url: str = Field(
        ..., 
        description="External URL",
        json_schema_extra={
            "component": "URLInput",
            "placeholder": "https://example.com"
        }
    )
    label: str = Field(
        ..., 
        description="Link label",
        json_schema_extra={
            "component": "TextInput",
            "placeholder": "External Link"
        }
    )
    target_blank: bool = Field(
        True, 
        description="Open in new tab",
        json_schema_extra={
            "component": "BooleanInput",
            "variant": "toggle"
        }
    )
```

### Step 2: Define the Field

ConditionalGroupField uses a **single field** that stores a complex value containing both the active group and all form data:

```python
from typing import Dict, Any

class MyWidgetConfig(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    
    # Single field storing complete state
    link_type: Dict[str, Any] = Field(
        default_factory=lambda: {"activeGroup": "none", "formData": {}},
        description="Link type and configuration",
        json_schema_extra={
            "component": "ConditionalGroupField",
            "groups": {
                "internal": {
                    "label": "Internal",
                    "config_model": "InternalLinkConfig"
                },
                "external": {
                    "label": "External",
                    "config_model": "ExternalLinkConfig"
                },
                "none": {
                    "label": "None"
                }
            }
        }
    )
```

**Value Structure:**
```python
{
    "activeGroup": "internal",  # Which group is currently selected
    "formData": {               # All groups' data preserved
        "internal": {"pageId": "123", "label": "Home"},
        "external": {"url": "https://...", "label": "Link"},
        "none": {}
    }
}
```

### Step 3: Use in Widget Config

Add the selector field with `ConditionalGroupField` component:

```python
class NavigationItem(BaseModel):
    """Navigation menu item with different link types"""
    
    link_type: Literal["internal", "external", "none"] = Field(
        "internal",
        description="Type of navigation link",
        json_schema_extra={
            "component": "ConditionalGroupField",
            "variant": "buttons",  # or "selectbox"
            "groups": {
                "internal": {
                    "label": "Internal Page",
                    "icon": "FileText",
                    "config_model": "InternalLinkConfig"  # References Pydantic model
                },
                "external": {
                    "label": "External URL", 
                    "icon": "ExternalLink",
                    "config_model": "ExternalLinkConfig"
                },
                "none": {
                    "label": "None",
                    # No config_model = no form rendered
                }
            }
        }
    )
```

## Frontend Usage

The component is automatically loaded when the field schema specifies `"component": "ConditionalGroupField"`. No manual frontend code is needed.

### Programmatic Usage

If you need to use it programmatically:

```jsx
import ConditionalGroupField from './components/form-fields/ConditionalGroupField'

<ConditionalGroupField
    value={{
        activeGroup: "internal",
        formData: {
            internal: { pageId: "123", label: "Home" },
            external: { url: "https://...", label: "Link" },
            none: {}
        }
    }}
    onChange={handleChange}
    groups={{
        internal: { 
            label: "Internal", 
            icon: "FileText", 
            configModel: "InternalLinkConfig" 
        },
        external: { 
            label: "External", 
            icon: "ExternalLink", 
            configModel: "ExternalLinkConfig" 
        },
        none: { 
            label: "None" 
        }
    }}
    variant="buttons"
    fieldName="linkType"
    context={{
        widgetId: "widget-1",
        slotName: "main",
        contextType: "page"
    }}
/>
```

## API Endpoint

The component fetches schemas from:

```
GET /api/webpages/pydantic-models/{model_name}/schema/
```

**Response:**
```json
{
    "model_name": "InternalLinkConfig",
    "schema": {
        "type": "object",
        "properties": {
            "page_id": {
                "type": "string",
                "title": "Page ID",
                "description": "Page ID",
                "component": "PageSelectInput",
                "placeholder": "Select a page..."
            },
            "label": {
                "type": "string",
                "title": "Link label",
                "description": "Link label",
                "component": "TextInput",
                "placeholder": "Home"
            }
        },
        "required": ["page_id", "label"]
    }
}
```

## Use Cases

### 1. Link Types

```python
link_type: Dict[str, Any] = Field(
    default_factory=lambda: {"activeGroup": "internal", "formData": {}},
    description="Link type configuration",
    json_schema_extra={
        "component": "ConditionalGroupField",
        "groups": {
            "internal": {
                "label": "Internal Page",
                "config_model": "InternalLinkConfig"
            },
            "external": {
                "label": "External URL",
                "config_model": "ExternalLinkConfig"
            },
            "download": {
                "label": "Download File",
                "config_model": "DownloadLinkConfig"
            }
        }
    }
)
```

### 2. Media Sources

```python
source_type: Dict[str, Any] = Field(
    default_factory=lambda: {"activeGroup": "upload", "formData": {}},
    description="Media source configuration",
    json_schema_extra={
        "component": "ConditionalGroupField",
        "variant": "selectbox",
        "groups": {
            "upload": {
                "label": "Upload File",
                "icon": "Upload",
                "config_model": "UploadConfig"
            },
            "url": {
                "label": "External URL",
                "icon": "Link",
                "config_model": "URLConfig"
            },
            "embed": {
                "label": "Embed Code",
                "icon": "Code",
                "config_model": "EmbedConfig"
            }
        }
    }
)
```

### 3. Content Types

```python
content_type: Dict[str, Any] = Field(
    default_factory=lambda: {"activeGroup": "text", "formData": {}},
    description="Content type configuration",
    json_schema_extra={
        "component": "ConditionalGroupField",
        "groups": {
            "text": {
                "label": "Text",
                "icon": "Type",
                "config_model": "TextContentConfig"
            },
            "video": {
                "label": "Video",
                "icon": "Video",
                "config_model": "VideoContentConfig"
            },
            "gallery": {
                "label": "Gallery",
                "icon": "Images",
                "config_model": "GalleryContentConfig"
            },
            "form": {
                "label": "Form",
                "icon": "FileText",
                "config_model": "FormContentConfig"
            }
        }
    }
)
```

### 4. Menu Types (With None Option)

```python
menu_type: Dict[str, Any] = Field(
    default_factory=lambda: {"activeGroup": "none", "formData": {}},
    description="Menu type configuration",
    json_schema_extra={
        "component": "ConditionalGroupField",
        "groups": {
            "pageSections": {
                "label": "Page Sections",
                "config_model": "PageSectionConfig"
            },
            "pageSubmenu": {
                "label": "Page Submenu",
                "config_model": "PageSubmenuConfig"
            },
            "custom": {
                "label": "Custom Menu",
                "config_model": "CustomMenuConfig"
            },
            "none": {
                "label": "None"
                # No config_model = no form
            }
        }
    }
)
```

## Naming Conventions

### Backend (Python)
- **Field names**: `snake_case` (e.g., `menu_items`, `page_id`)
- **Literal values**: `snake_case` (e.g., `"page_sections"`, `"page_submenu"`)
- **Pydantic models**: Use `alias_generator=to_camel` to generate camelCase JSON schemas

### Frontend (JavaScript)
- **Field names**: `camelCase` (e.g., `menuItems`, `pageId`) - automatically converted by Django
- **Literal values**: `snake_case` (e.g., `"page_sections"`) - NOT converted, stays as-is
- **Props**: `camelCase` (e.g., `configModel`)

### What Django Converts
✅ **Model field names** during serialization: `menu_items` ↔ `menuItems`
❌ **Literal enum values**: `"page_sections"` stays `"page_sections"`
❌ **Dictionary keys in json_schema_extra**: Use `configModel` not `config_model`
❌ **JSON schema property names**: Use Pydantic's `alias_generator` instead

## Data Storage

The component stores data in a **single complex value** that contains both the active group and all form data:

### Data Structure

```json
{
    "linkType": {
        "activeGroup": "internal",
        "formData": {
            "internal": {
                "pageId": "123",
                "label": "Home Page"
            },
            "external": {
                "url": "https://example.com",
                "label": "External Link",
                "targetBlank": true
            },
            "none": {}
        }
    }
}
```

### Benefits of This Approach

1. **Self-Contained**: Field owns its entire state (like any other field component)
2. **No Data Loss**: All groups' data preserved when switching
3. **Cleaner API**: Single value, not separate fields
4. **Type Safe**: Can validate the structure if needed
5. **Simpler Backend**: One field instead of two

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `object` | `{activeGroup: "none", formData: {}}` | Complex value containing activeGroup and formData |
| `onChange` | `function` | - | Called with full value object when changed |
| `groups` | `object` | `{}` | Group configuration from json_schema_extra |
| `variant` | `"buttons" \| "selectbox"` | `"buttons"` | Display variant |
| `context` | `object` | `{}` | UDC context for state management |
| `fieldName` | `string` | - | Field name (required for UDC publishing) |
| `label` | `string` | - | Field label |
| `description` | `string` | - | Field description |
| `required` | `boolean` | `false` | Whether field is required |
| `disabled` | `boolean` | `false` | Whether field is disabled |
| `validation` | `object` | - | Validation state |
| `isValidating` | `boolean` | `false` | Whether validation is in progress |

## Group Configuration

Each group in the `groups` object can have:

```typescript
{
    label: string,           // Display label for the group
    icon?: string,          // Lucide icon name (optional)
    config_model?: string   // Pydantic model name to fetch schema
}
```

If `config_model` is omitted (like for "none"), no form is rendered.

## Best Practices

### 1. Use Descriptive Model Names

```python
# Good
"InternalLinkConfig"
"ExternalLinkConfig"
"PageSectionConfig"

# Avoid
"Config1"
"OptionA"
"Type2Config"
```

### 2. Provide Icons for Better UX

```python
"groups": {
    "upload": {
        "label": "Upload",
        "icon": "Upload",  # Makes it visual
        "config_model": "UploadConfig"
    }
}
```

### 3. Use Variant Appropriately

- **buttons**: 2-4 options, short labels
- **selectbox**: 5+ options, or long labels

### 4. Provide Default Values

```python
menu_type: Optional[Literal["a", "b", "none"]] = Field(
    default="none",  # Sensible default
    description="Menu type to display"
)
```

### 5. Keep Forms Simple

Each config model should have 3-7 fields max. If you need more, consider breaking into sub-sections or using nested `ItemsListField`.

## Troubleshooting

### Schema Properties in snake_case Instead of camelCase

**Problem**: Frontend receives `page_id` instead of `pageId` in schemas

**Solution**: Add `model_config` with `alias_generator=to_camel` to all Pydantic models:

```python
from pydantic import ConfigDict
from pydantic.alias_generators import to_camel

class MyConfig(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
```

**Why**: Django/DRF only converts field names during serialization, not JSON schema property names. Pydantic's `alias_generator` handles schema generation.

### Schema Not Loading

**Problem**: Form shows "Loading..." indefinitely

**Solutions**:
1. Check that the model name matches exactly (case-sensitive)
2. Verify the model is in a widget module (`default_widgets.widgets`, `easy_widgets.widgets`, etc.)
3. Check browser console for API errors
4. Verify the API endpoint is accessible: `/api/v1/webpages/pydantic-models/{model_name}/schema/`
5. Ensure the URL uses `/api/v1/` prefix, not just `/api/`

### Form Not Clearing

**Problem**: Old form data persists when switching groups

**Solution**: The component automatically clears form data. If you're managing state externally, ensure you're listening to `onChange` and clearing your state.

### Validation Issues

**Problem**: Validation not working

**Solution**: Ensure validation is passed in the correct format:
```javascript
validation={{
    fieldName: {
        isValid: false,
        errors: ["Error message"]
    }
}}
```

## Performance Considerations

1. **Schema Caching**: Schemas are fetched once and cached in component state
2. **Ref-based Storage**: Form data is stored in refs to avoid re-renders
3. **Lazy Loading**: Field components are loaded lazily with React.Suspense
4. **Memoization**: Component is memoized to prevent unnecessary re-renders

## Future Enhancements

Potential future improvements:

1. **Schema Prefetching**: Prefetch all schemas on mount for faster switching
2. **Form Migration**: Preserve common fields when switching groups
3. **Undo/Redo**: Remember previous group configurations
4. **Responsive Variant**: Auto-switch between buttons/selectbox based on container width
5. **Nested Groups**: Support for hierarchical group structures

## Related Documentation

- [Pydantic Widget Controls Guide](./PYDANTIC_WIDGET_CONTROLS_GUIDE.md)
- [ItemsListField Documentation](./ITEMS_LIST_FIELD_GUIDE.md)
- [Unified Data Context](./UNIFIED_DATA_CONTEXT_SYNCHRONIZATION.md)
- [Widget System Documentation](./WIDGET_SYSTEM_DOCUMENTATION_INDEX.md)

## Support

For issues or questions about ConditionalGroupField:

1. Check this documentation
2. Review the component source code at `/frontend/src/components/form-fields/ConditionalGroupField.jsx`
3. Look at usage examples in the Navigation widget (`/backend/easy_widgets/widgets/navigation.py`)

