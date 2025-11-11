# Widget System

This directory contains the **widget system** that can be used by any editor framework. The widgets are organized into modular packages that can be extended or replaced.

## Architecture Overview

```
frontend/src/
├── widgets/                    # 🔗 WIDGET SYSTEM
│   ├── easy-widgets/         # ECEEE widget implementations
│   │   ├── eceeeContentWidget.jsx
│   │   ├── eceeeImageWidget.jsx
│   │   ├── registry.js        # Widget registry
│   │   └── index.js           # Package exports
│   ├── WidgetRegistryManager.js # Central registry manager
│   └── index.js               # Main widget exports
├── layouts/                    # 🎨 LAYOUT SYSTEM  
│   ├── easy-layouts/         # ECEEE layout implementations
│   │   ├── LayoutRegistry.jsx
│   │   ├── WidgetSlot.jsx
│   │   └── index.js           # Package exports
│   └── index.js               # Main layout exports
├── editors/                    # 📝 EDITOR FRAMEWORKS
│   ├── page-editor/           # PageEditor-specific framework
│   └── object-editor/         # ObjectEditor-specific framework
└── components/                 # 🏗️ SHARED COMPONENTS
```

## Key Benefits

✅ **Modular Packages** - Widget and layout packages can be swapped or extended
✅ **Framework Independence** - Each editor can evolve independently  
✅ **Reduced Duplication** - Shared widget implementations
✅ **Better Stability** - Package changes don't affect other packages
✅ **Easier Maintenance** - Widget fixes benefit all editors

## ECEEE Widgets Package

### Available Widgets

- `ContentWidget` - Rich text content with titles and styling
- `ImageWidget` - Images with captions and alignment  
- `TableWidget` - Data tables with headers and styling
- `HeaderWidget` - Page headers with navigation
- `FooterWidget` - Page footers with links and copyright
- `NavigationWidget` - Navigation menus and breadcrumbs
- `NavbarWidget` - Top navigation bar
- `SidebarWidget` - Sidebar content areas
- `FormsWidget` - Form inputs and validation
- `NewsListWidget` - News article listings
- `NewsDetailWidget` - Individual news article display
- `TwoColumnsWidget` - Two-column container layout
- `ThreeColumnsWidget` - Three-column container layout

### Widget Structure

Each widget follows this pattern:

```jsx
const MyWidget = ({ config, mode, onConfigChange, ...props }) => {
    // Widget implementation
    return <div>Widget content</div>
}

// Metadata for registry
MyWidget.displayName = 'MyWidget'
MyWidget.widgetType = 'easy_widgets.MyWidget'
MyWidget.defaultConfig = { /* defaults */ }
MyWidget.metadata = { /* display info */ }
```

## Usage

### Import from Main Package

```jsx
import { ContentWidget, ImageWidget } from '../../widgets'
```

### Import from Specific Package

```jsx
import { ContentWidget } from '../../widgets/easy-widgets'
```

### Registry Usage

```jsx
import { 
    getWidgetComponent,
    getWidgetDisplayName,
    isWidgetTypeSupported 
} from '../../widgets'

const WidgetComponent = getWidgetComponent('easy_widgets.ContentWidget')
```

## Widget Registry System

The widget system uses a **priority-based registry** for managing widgets. Third-party packages can be added with different priority levels.

### How It Works

```
Priority Levels:
├── DEFAULT (100)      # Reserved for base widgets
├── THIRD_PARTY (200)  # easy-widgets (current level)
├── EXTENDED (300)     # Extended third-party widgets
└── CUSTOM (400)       # Custom/user widgets
```

### Current Packages

```
widgets/
├── WidgetRegistryManager.js    # Central registry manager
├── easy-widgets/             # ECEEE widget implementations (priority 200)
│   ├── eceeeContentWidget.jsx
│   ├── eceeeImageWidget.jsx
│   ├── eceeeTableWidget.jsx
│   └── registry.js
└── index.js                   # Main exports
```

## Adding Custom Widgets

To add custom widgets to the system:

1. Create a new widget component
2. Add metadata (widgetType, displayName, defaultConfig, metadata)
3. Register in a custom registry
4. Use `registerWidgetRegistry()` to add to the system

Example:

```jsx
// MyCustomWidget.jsx
const MyCustomWidget = ({ config }) => {
    return <div>My Custom Widget</div>
}

MyCustomWidget.widgetType = 'custom.MyCustomWidget'
MyCustomWidget.displayName = 'MyCustomWidget'
MyCustomWidget.defaultConfig = {}
MyCustomWidget.metadata = {
    name: 'My Custom Widget',
    description: 'A custom widget',
    category: 'custom',
    icon: MyIcon
}

export default MyCustomWidget

// registry.js
import { registerWidget } from '../WidgetRegistryManager'
import MyCustomWidget from './MyCustomWidget'

export const CUSTOM_WIDGET_REGISTRY = {
    'custom.MyCustomWidget': registerWidget(MyCustomWidget, 'custom.MyCustomWidget')
}

// In your app initialization
import { registerWidgetRegistry } from './widgets'
import { CUSTOM_WIDGET_REGISTRY } from './my-custom-widgets/registry'

registerWidgetRegistry(CUSTOM_WIDGET_REGISTRY, 'my-custom-widgets', 400)
```

## Quick Reference & Help System

The widget system includes comprehensive in-app documentation:

### Accessing Widget Help

When editing a widget in the PageEditor:
1. Click the help icon (?) in the widget editor header
2. Browse documentation tabs:
   - **Overview** - Widget description and special features
   - **Template Parameters** - All available parameters for templates
   - **Examples** - Basic and advanced configuration examples
   - **CSS Variables** - Theme customization options

### Parameter Naming Conventions

**IMPORTANT:** Frontend uses camelCase, backend/templates use snake_case:

```javascript
// Frontend (camelCase)
{
  backgroundColor: "#3b82f6",
  enableLightbox: true,
  menuItems: [...]
}
```

```django
{# Backend Templates (snake_case) #}
{{ config.background_color }}
{{ config.enable_lightbox }}
{% for item in config.menu_items %}
```

The API automatically converts between the two naming conventions.

### Quick Reference API

Get widget documentation programmatically:

```javascript
import { 
  getWidgetQuickReference,
  getAllWidgetReferences,
  searchWidgets
} from '../../api/widgetQuickReference'

// Get specific widget docs
const widgetDocs = await getWidgetQuickReference('easy_widgets.ContentWidget')

// Get all widgets
const allWidgets = await getAllWidgetReferences()

// Search widgets
const results = await searchWidgets('navigation')
```

### Components

Help panel components are in `src/components/widget-help/`:
- `WidgetQuickReference.jsx` - Main help panel modal
- `WidgetParameterReference.jsx` - Parameter table with search
- `WidgetExamples.jsx` - Code examples with copy/apply

## Migration Notes

The default-widgets and default-layouts packages have been removed from the system. All functionality is now provided by easy-widgets and easy-layouts.
