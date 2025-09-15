# PRD: Object Type Schema Editor Redesign

**Version**: 1.0  
**Date**: December 2024  
**Status**: Planning Phase

## Executive Summary

This PRD outlines the complete redesign of the Object Type Schema Editor to create a more modular, dynamic, and maintainable system. The new architecture will feature self-contained React components for each property type, dynamic component loading based on field types, and a unified configuration system that leverages the existing Pydantic widget schema format.

## Current State Analysis

### Existing Schema Editor Issues
1. **Monolithic Component**: Current `VisualSchemaEditor.jsx` is a single large component handling all field types
2. **Hard-coded Field Types**: Property types are statically defined in the component
3. **Limited Extensibility**: Adding new field types requires modifying core component code
4. **Inconsistent Configuration**: Each field type has custom configuration logic embedded inline
5. **Poor Separation of Concerns**: Property rendering, configuration, and management are tightly coupled

### Current JSON Schema Format
The system currently uses a JSON Schema-like format for object types:
```json
{
  "type": "object",
  "properties": {
    "fieldName": {
      "type": "string",
      "title": "Field Display Name",
      "description": "Field description",
      "fieldType": "text",
      "required": false,
      "default": "",
      "json_schema_extra": {
        "component": "TextInput",
        "placeholder": "Enter value..."
      }
    }
  },
  "propertyOrder": ["fieldName"],
  "required": ["fieldName"]
}
```

### Widget Schema Format (Pydantic)
Widgets use Pydantic models that generate comprehensive JSON schemas with UI control specifications embedded directly in property definitions:
```json
{
  "$defs": {
    "ImageMediaItem": {
      "description": "Individual media item for Image widget",
      "properties": {
        "id": {
          "anyOf": [{"type": "string"}, {"type": "null"}],
          "default": null,
          "description": "Media file ID",
          "title": "Id"
        },
        "url": {
          "description": "Media URL (image or video)",
          "title": "Url",
          "type": "string"
        },
        "altText": {
          "description": "Alternative text for accessibility",
          "minLength": 1,
          "title": "Alttext",
          "type": "string"
        }
      },
      "required": ["url", "altText"],
      "title": "ImageMediaItem",
      "type": "object"
    }
  },
  "description": "Configuration for Image widget",
  "properties": {
    "displayType": {
      "component": "SegmentedControlInput",
      "default": "gallery",
      "description": "How to display multiple items",
      "enum": ["gallery", "carousel"],
      "group": "Display Options",
      "options": [
        {"icon": "Grid", "label": "Gallery", "value": "gallery"},
        {"icon": "Play", "label": "Carousel", "value": "carousel"}
      ],
      "order": 1,
      "title": "Displaytype",
      "type": "string",
      "variant": "default"
    },
    "enableLightbox": {
      "component": "BooleanInput",
      "default": true,
      "description": "Enable lightbox for full-size viewing",
      "group": "Display Options",
      "order": 3,
      "title": "Enablelightbox",
      "type": "boolean",
      "variant": "toggle"
    }
  },
  "title": "ImageConfig",
  "type": "object"
}
```

## Problem Statement

The current Object Type Schema Editor lacks the modularity and extensibility needed for a modern CMS. Users cannot easily add new field types, the configuration interface is inconsistent across field types, and the codebase is difficult to maintain due to its monolithic structure.

## Proposed Solution

### 1. Unified JSON Schema Format

**Define a standardized JSON schema format** that aligns with the Pydantic widget schema approach, embedding UI control specifications directly in property definitions:

```json
{
  "$defs": {
    "MediaItem": {
      "description": "Media file reference",
      "properties": {
        "id": {
          "anyOf": [{"type": "string"}, {"type": "null"}],
          "default": null,
          "description": "Media file ID",
          "title": "Id"
        },
        "url": {
          "description": "Media URL",
          "title": "Url", 
          "type": "string"
        }
      },
      "required": ["url"],
      "title": "MediaItem",
      "type": "object"
    }
  },
  "type": "object",
  "properties": {
    "propertyKey": {
      "type": "string",
      "title": "Display Label",
      "description": "Help text for the field",
      "default": "default_value",
      "component": "TextInput",
      "group": "Basic",
      "order": 1,
      "placeholder": "Enter value...",
      "minLength": 0,
      "maxLength": 100
    },
    "choiceField": {
      "type": "string",
      "title": "Choice Field",
      "description": "Select from predefined options",
      "enum": ["option1", "option2", "option3"],
      "default": "option1",
      "component": "SegmentedControlInput",
      "group": "Basic",
      "order": 2,
      "variant": "default",
      "options": [
        {"value": "option1", "label": "Option 1", "icon": "Check"},
        {"value": "option2", "label": "Option 2", "icon": "Star"}
      ]
    },
    "mediaField": {
      "$ref": "#/$defs/MediaItem",
      "title": "Media Field",
      "description": "Select media file",
      "default": null,
      "component": "MediaInput",
      "group": "Advanced",
      "order": 3,
      "mediaTypes": ["image", "video"]
    }
  },
  "required": ["propertyKey"]
}
```

### 2. Component Architecture Redesign

**Create a modular component system** with the following structure:

#### Main Components:
- `SchemaEditor` - Main container component
- `PropertyList` - Manages the list of properties
- `PropertyItem` - Individual property wrapper component
- `PropertyTypeRegistry` - Central registry for property types
- `PropertyConfigComponent` - Base class for property configuration components

#### Property-Specific Components:
Each field type gets its own configuration component:
- `TextPropertyConfig.jsx`
- `RichTextPropertyConfig.jsx`
- `NumberPropertyConfig.jsx`
- `BooleanPropertyConfig.jsx`
- `ChoicePropertyConfig.jsx`
- `MediaPropertyConfig.jsx`
- `DatePropertyConfig.jsx`
- etc.

### 3. Property Type Registry

**Implement a central registry system** that manages all available property types:

```javascript
// PropertyTypeRegistry.js
const propertyTypeRegistry = {
  text: {
    label: "Text Field",
    icon: Type,
    description: "Single line text input",
    component: TextPropertyConfig,
    defaultConfig: {
      type: "string",
      title: "Text Field",
      description: "",
      default: "",
      component: "TextInput",
      placeholder: "Enter text...",
      minLength: 0,
      maxLength: 255
    }
  },
  rich_text: {
    label: "Rich Text",
    icon: FileText,
    description: "Multi-line rich text editor",
    component: RichTextPropertyConfig,
    defaultConfig: {
      type: "string",
      title: "Rich Text Field",
      description: "",
      default: "",
      component: "RichTextInput",
      rows: 6,
      toolbar: "full"
    }
  },
  choice: {
    label: "Choice Field",
    icon: List,
    description: "Select from predefined options",
    component: ChoicePropertyConfig,
    defaultConfig: {
      type: "string",
      title: "Choice Field",
      description: "",
      enum: ["Option 1", "Option 2"],
      default: null,
      component: "SelectInput",
      placeholder: "Select an option..."
    }
  }
  // ... more property types
}
```

### 4. Self-Contained Property Configuration Components

**Each property type has its own configuration component** that handles:
- Property-specific settings
- Validation rules
- Default values
- UI control specifications
- Preview functionality

Example `TextPropertyConfig.jsx`:
```jsx
export default function TextPropertyConfig({ 
  property, 
  onChange, 
  onValidate 
}) {
  const handleChange = (field, value) => {
    const updated = { ...property, [field]: value }
    onChange(updated)
  }

  const handleComponentConfigChange = (key, value) => {
    const updated = {
      ...property,
      [key]: value
    }
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      {/* Basic Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <TextInput
          label="Property Key"
          value={property.key}
          onChange={(value) => handleChange('key', value)}
          required
        />
        <TextInput
          label="Display Label"
          value={property.title}
          onChange={(value) => handleChange('title', value)}
          required
        />
      </div>

      {/* Type-Specific Configuration */}
      <div className="border-t pt-4">
        <h4>Text Field Options</h4>
        <div className="grid grid-cols-2 gap-4">
          <NumberInput
            label="Min Length"
            value={property.minLength}
            onChange={(value) => handleChange('minLength', value)}
          />
          <NumberInput
            label="Max Length"
            value={property.maxLength}
            onChange={(value) => handleChange('maxLength', value)}
          />
        </div>
        <TextInput
          label="Placeholder Text"
          value={property.placeholder}
          onChange={(value) => handleComponentConfigChange('placeholder', value)}
        />
      </div>
    </div>
  )
}
```

### 5. Dynamic Component Loading

**Implement dynamic component resolution** based on field type:

```jsx
// PropertyItem.jsx
export default function PropertyItem({ property, onChange, onDelete }) {
  const propertyType = getPropertyTypeFromComponent(property.component)
  const ConfigComponent = propertyType?.component || GenericPropertyConfig

  return (
    <div className="property-item">
      <div className="property-header">
        <PropertyIcon component={property.component} />
        <span>{property.title || property.key}</span>
        <PropertyActions onDelete={onDelete} />
      </div>
      
      {isExpanded && (
        <div className="property-config">
          <ConfigComponent
            property={property}
            onChange={onChange}
            onValidate={validateProperty}
          />
        </div>
      )}
    </div>
  )
}
```

## Technical Specifications

### File Structure
```
frontend/src/components/schema-editor/
├── SchemaEditor.jsx                    # Main container
├── PropertyList.jsx                    # Property list manager
├── PropertyItem.jsx                    # Individual property wrapper
├── PropertyTypeSelector.jsx            # Property type picker
├── PropertyTypeRegistry.js             # Central registry
├── property-configs/                   # Property-specific components
│   ├── TextPropertyConfig.jsx
│   ├── RichTextPropertyConfig.jsx
│   ├── NumberPropertyConfig.jsx
│   ├── BooleanPropertyConfig.jsx
│   ├── ChoicePropertyConfig.jsx
│   ├── MediaPropertyConfig.jsx
│   ├── DatePropertyConfig.jsx
│   └── GenericPropertyConfig.jsx       # Fallback component
├── components/                         # Shared components
│   ├── PropertyIcon.jsx
│   ├── PropertyActions.jsx
│   └── PropertyPreview.jsx
└── utils/
    ├── schemaValidation.js
    ├── propertyHelpers.js
    └── configurationUtils.js
```

### Component Registration System

**Automatic component registration** when the module loads:

```javascript
// property-configs/index.js
import TextPropertyConfig from './TextPropertyConfig'
import RichTextPropertyConfig from './RichTextPropertyConfig'
// ... other imports

// Auto-register all property config components
export const registerPropertyComponents = () => {
  registerPropertyType('TextInput', {
    label: 'Text Field',
    icon: Type,
    description: 'Single line text input',
    component: TextPropertyConfig,
    defaultConfig: {
      type: "string",
      component: "TextInput",
      placeholder: "Enter text...",
      minLength: 0,
      maxLength: 255
    }
  })
  
  registerPropertyType('RichTextInput', {
    label: 'Rich Text',
    icon: FileText,
    description: 'Multi-line rich text editor', 
    component: RichTextPropertyConfig,
    defaultConfig: {
      type: "string",
      component: "RichTextInput",
      rows: 6,
      toolbar: "full"
    }
  })
  
  // ... register other types
}
```

### Data Flow

1. **Schema Loading**: Main `SchemaEditor` receives schema and converts to internal format
2. **Property Rendering**: `PropertyList` maps over properties and renders `PropertyItem` components
3. **Dynamic Config**: Each `PropertyItem` resolves its config component from the registry
4. **Change Handling**: Property config components emit changes that bubble up to main editor
5. **Schema Generation**: Main editor converts internal format back to JSON schema on save

### Integration Points

**The new Schema Editor will integrate with**:
- Existing `ObjectTypeForm.jsx` (replaces `VisualSchemaEditor`)
- Field type registry system (reuses existing field types)
- Form validation system (enhanced validation per property type)
- Property preview system (live preview of form fields)

## Success Criteria

### Functional Requirements
- ✅ Self-contained property configuration components
- ✅ Dynamic component loading based on field type
- ✅ Unified JSON schema format aligned with widget schemas
- ✅ Central property type registry system
- ✅ Extensible architecture for adding new field types
- ✅ Property reordering and management
- ✅ Real-time validation and preview

### Non-Functional Requirements
- ✅ Maintainable and modular codebase
- ✅ Consistent UI/UX across all property types
- ✅ Performance optimized (lazy loading of config components)
- ✅ Backward compatibility with existing schemas
- ✅ Comprehensive error handling and validation

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
1. Define unified JSON schema format specification
2. Create base component architecture
3. Implement property type registry system
4. Build core `SchemaEditor`, `PropertyList`, and `PropertyItem` components

### Phase 2: Property Components (Week 3-4)
1. Create configuration components for basic types (text, number, boolean)
2. Implement advanced property types (choice, media, date)
3. Build generic fallback configuration component
4. Add property validation and preview functionality

### Phase 3: Integration (Week 5)
1. Replace existing `VisualSchemaEditor` in `ObjectTypeForm`
2. Migrate existing schemas to new format
3. Add backward compatibility layer
4. Implement comprehensive testing

### Phase 4: Enhancement (Week 6)
1. Add property templates and presets
2. Implement advanced features (conditional fields, validation rules)
3. Performance optimization and error handling
4. Documentation and user guides

## Questions for Review

1. **JSON Schema Format**: Does the proposed unified schema format meet all requirements? Should we include additional metadata?

2. **Component Architecture**: Is the proposed component structure appropriate? Should we have additional abstraction layers?

3. **Registry System**: Should the property type registry be static or support dynamic registration at runtime?

4. **Backward Compatibility**: How should we handle migration of existing object type schemas to the new format?

5. **Configuration Complexity**: Should complex property types (like nested objects or arrays) have specialized editors?

6. **Performance**: Should property config components be lazy-loaded or bundled together?

7. **Validation**: Should validation be handled at the property level or centrally in the main editor?

8. **Preview System**: Should we implement live preview of how properties will appear in forms?

Please review this PRD and provide feedback on any aspects that need clarification, modification, or additional consideration.
