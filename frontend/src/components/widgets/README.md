# Widget System Documentation

## Overview

This directory contains a shared widget system that can be used by both ContentEditor and ObjectContentEditor. The system provides reusable React components for rendering different widget types with consistent behavior and styling.

## Architecture

### Core Components

1. **WidgetRenderer** (`WidgetRenderer.jsx`)
   - Main component for rendering individual widgets
   - Automatically selects the appropriate widget component based on type
   - Provides fallback rendering for unknown widget types
   - Supports both preview and editor modes

2. **WidgetFactory** (`WidgetFactory.jsx`)
   - Higher-level component that wraps widgets with editor controls
   - Provides edit, delete, and preview buttons
   - Handles widget metadata display
   - Can be used in both editor and preview modes

3. **Individual Widget Components**
   - `TextBlockWidget.jsx` - Renders text content with optional title
   - `ImageWidget.jsx` - Renders images with captions and alignment
   - `ButtonWidget.jsx` - Renders clickable buttons with different styles
   - `SpacerWidget.jsx` - Creates vertical spacing between widgets
   - `HtmlBlockWidget.jsx` - Renders raw HTML content safely
   - `GalleryWidget.jsx` - Displays image galleries with configurable layouts

### Utilities

1. **useWidgets Hook** (`../hooks/useWidgets.js`)
   - Custom React hook for widget management
   - Provides CRUD operations for widgets
   - Fetches widget types from API
   - Handles widget validation and state management

2. **Widget Registry** (`widgetRegistry.js`)
   - Maps widget type strings to React components
   - Provides utility functions for widget type checking
   - All widgets now use the new namespaced format

3. **Widget Renderer Utility** (`../utils/widgetRenderer.js`)
   - DOM-based widget rendering for LayoutRenderer
   - Converts widget configurations to HTML strings
   - Used by ContentEditor for direct DOM manipulation

## Usage

### In ObjectContentEditor

```jsx
import { WidgetFactory } from './widgets'
import { useWidgets } from '../hooks/useWidgets'

const ObjectContentEditor = ({ widgets, onWidgetChange }) => {
  const { addWidget, updateWidget, deleteWidget } = useWidgets(widgets)
  
  const renderWidget = (widget, slotName, index) => (
    <WidgetFactory
      widget={widget}
      slotName={slotName}
      index={index}
      onEdit={handleEditWidget}
      onDelete={handleDeleteWidget}
      mode="editor"
      showControls={true}
    />
  )
  
  // ... rest of component
}
```

### In ContentEditor

```jsx
// ContentEditor uses the widget renderer utility for DOM-based rendering
import { createWidgetElement } from '../utils/widgetRenderer'

const createWidgetElement = useCallback((widget) => {
  const { createWidgetElement: createSharedWidgetElement } = require('../utils/widgetRenderer')
  return createSharedWidgetElement(widget)
}, [])
```

### Direct Widget Usage

```jsx
import { WidgetRenderer } from './widgets'

const MyComponent = () => {
  const widget = {
    id: 'test-1',
    type: 'core_widgets.TextBlockWidget',
    config: {
      title: 'Hello World',
      content: 'This is a test widget.'
    }
  }
  
  return <WidgetRenderer widget={widget} mode="preview" />
}
```

## Widget Types

The system supports the following widget types:

- `core_widgets.TextBlockWidget` - Rich text content with titles
- `core_widgets.ImageWidget` - Images with captions and alignment
- `core_widgets.ButtonWidget` - Clickable buttons with various styles
- `core_widgets.SpacerWidget` - Vertical spacing elements
- `core_widgets.HtmlBlockWidget` - Raw HTML content (sanitized)
- `core_widgets.GalleryWidget` - Image galleries with grid layouts

All widgets now use the new namespaced format. Legacy formats have been migrated.

## Widget Configuration

Each widget type has its own configuration schema. Default configurations are provided in the `createDefaultWidgetConfig` function.

### Example Widget Object

```javascript
{
  id: 'widget-123',
  name: 'My Text Block',
  type: 'core_widgets.TextBlockWidget',
  config: {
    title: 'Widget Title',
    content: 'Widget content here...',
    style: 'normal',
    alignment: 'left'
  },
  slotName: 'main'
}
```

## API Integration

The widget system integrates with the backend API through:

- `/api/v1/webpages/widget-types/` - Fetch available widget types
- `/api/v1/webpages/widget-types/?include_template_json=true` - Fetch widget types with schemas

## Testing

Use the `WidgetTest.jsx` component to test widget rendering:

```jsx
import WidgetTest from './widgets/WidgetTest'

// Render in your app to see all widget types in action
<WidgetTest />
```

## Extension

To add new widget types:

1. Create a new widget component (e.g., `MyWidget.jsx`)
2. Add it to the widget registry in `widgetRegistry.js`
3. Add default configuration in `useWidgets.js`
4. Update the widget renderer utility if needed for DOM rendering
5. Export the component from `index.js`

## Migration Notes

This system replaces the previous inline widget rendering logic in ContentEditor and ObjectContentEditor. The shared approach ensures:

- Consistent widget rendering across editors
- Easier maintenance and updates
- Better code reusability
- Type safety and validation
- Unified widget management
