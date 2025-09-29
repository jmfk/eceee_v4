# Widget System

This directory contains the **widget system** that can be used by any editor framework. The widgets are organized into modular packages that can be extended or replaced.

## Architecture Overview

```
frontend/src/
├── widgets/                    # 🔗 WIDGET SYSTEM
│   ├── default-widgets/       # Default widget implementations
│   │   ├── ContentWidget.jsx
│   │   ├── ImageWidget.jsx
│   │   ├── registry.js        # Widget registry
│   │   ├── validation.js      # Widget validation
│   │   └── index.js           # Package exports
│   └── index.js               # Main widget exports
├── layouts/                    # 🎨 LAYOUT SYSTEM  
│   ├── default-layouts/       # Default layout implementations
│   │   ├── LayoutRegistry.jsx
│   │   ├── WidgetSlot.jsx
│   │   └── index.js           # Package exports
│   └── index.js               # Main layout exports
├── editors/                    # 📝 EDITOR FRAMEWORKS
│   ├── page-editor/           # PageEditor-specific framework
│   └── object-editor/         # ObjectEditor-specific framework
└── components/                 # 🏗️ LEGACY (being migrated)
```

## Key Benefits

✅ **Modular Packages** - Widget and layout packages can be swapped or extended
✅ **Framework Independence** - Each editor can evolve independently  
✅ **Reduced Duplication** - Shared widget implementations
✅ **Better Stability** - Package changes don't affect other packages
✅ **Easier Maintenance** - Widget fixes benefit all editors

## Default Widgets Package

### Available Widgets

- `ContentWidget` - Rich text content with titles and styling
- `ImageWidget` - Images with captions and alignment  
- `TableWidget` - Data tables with headers and styling
- `HeaderWidget` - Page headers with navigation
- `FooterWidget` - Page footers with links and copyright
- `NavigationWidget` - Navigation menus and breadcrumbs
- `SidebarWidget` - Sidebar content areas
- `FormsWidget` - Form inputs and validation

### Widget Structure

Each widget follows this pattern:

```jsx
const MyWidget = ({ config, mode, onConfigChange, ...props }) => {
    // Widget implementation
    return <div>Widget content</div>
}

// Metadata for registry
MyWidget.displayName = 'MyWidget'
MyWidget.widgetType = 'default_widgets.MyWidget'
MyWidget.defaultConfig = { /* defaults */ }
MyWidget.metadata = { /* display info */ }
MyWidget.actionHandlers = { /* framework overrides */ }
```

## Usage

### Import from Main Package

```jsx
import { ContentWidget, ImageWidget } from '../../widgets'
```

### Import from Specific Package

```jsx
import { ContentWidget } from '../../widgets/default-widgets'
```

### Registry Usage

```jsx
import { 
    getCoreWidgetComponent,
    getCoreWidgetDisplayName,
    isCoreWidgetTypeSupported 
} from '../../widgets'

const WidgetComponent = getCoreWidgetComponent('default_widgets.ContentWidget')
```

## Future Extension

This structure allows for future widget packages:

```
widgets/
├── default-widgets/     # Core defaults
├── eceee-widgets/      # ECEEE-specific widgets  
├── custom-widgets/     # Custom widget packages
└── third-party-widgets/ # Third-party packages
```

Each package can extend or replace the defaults, similar to the backend widget system.

## Migration Notes

The widgets have been moved from `widgets/core/` to `widgets/default-widgets/` to match the backend structure. All imports have been updated to maintain compatibility.