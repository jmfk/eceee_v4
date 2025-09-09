# Shared Widget System

This directory contains the **shared core widget implementations** that can be used by any editor framework. The widgets here are framework-agnostic and contain only the core functionality.

## Architecture Overview

```
frontend/src/
├── widgets/                    # 🔗 SHARED CORE
│   ├── core/                  # Core widget implementations
│   ├── registry.js            # Shared widget registry
│   ├── validation.js          # Shared validation utilities
│   └── index.js              # Main exports
├── editors/                   # 📝 FRAMEWORK LAYERS
│   ├── page-editor/          # PageEditor-specific framework
│   │   ├── PageWidgetFactory.jsx
│   │   ├── PageWidgetHeader.jsx
│   │   └── PageEditorEventSystem.js
│   └── object-editor/        # ObjectEditor-specific framework
│       ├── ObjectWidgetFactory.jsx
│       ├── ObjectWidgetHeader.jsx
│       └── ObjectEditorEventSystem.js
└── components/               # 🏗️ LEGACY (to be migrated)
    └── widgets/              # Old shared framework components
```

## Key Benefits

✅ **Widget Consistency** - Same widget behavior across all editors
✅ **Framework Independence** - Each editor can evolve independently  
✅ **Reduced Duplication** - Shared widget implementations
✅ **Better Stability** - Framework changes don't affect other editors
✅ **Easier Maintenance** - Widget fixes benefit all editors

## Core Widget Components

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

Each core widget follows this pattern:

```jsx
const MyWidget = ({ config, mode, onConfigChange, ...props }) => {
    // Widget implementation
    return <div>Widget content</div>
}

// Metadata for registry
MyWidget.displayName = 'MyWidget'
MyWidget.widgetType = 'core_widgets.MyWidget'
MyWidget.defaultConfig = { /* defaults */ }
MyWidget.metadata = { /* display info */ }
MyWidget.actionHandlers = { /* framework overrides */ }
```

## Usage in Editors

### PageEditor Framework

```jsx
import { PageWidgetFactory } from '../../editors/page-editor'

const PageEditor = () => {
    return (
        <PageWidgetFactory
            widget={widget}
            slotName={slotName}
            index={index}
            onEdit={handleEdit}
            onDelete={handleDelete}
            // PageEditor-specific props
            layoutRenderer={layoutRenderer}
            versionId={versionId}
            isPublished={isPublished}
            onVersionChange={handleVersionChange}
        />
    )
}
```

### ObjectEditor Framework

```jsx
import { ObjectWidgetFactory } from '../../editors/object-editor'

const ObjectEditor = () => {
    return (
        <ObjectWidgetFactory
            widget={widget}
            slotName={slotName}
            index={index}
            onEdit={handleEdit}
            onDelete={handleDelete}
            // ObjectEditor-specific props
            objectType={objectType}
            slotConfig={slotConfig}
            onSlotAction={handleSlotAction}
        />
    )
}
```

### Direct Widget Usage

```jsx
import { ContentWidget } from '../../widgets'

const MyComponent = () => {
    return (
        <ContentWidget
            config={{
                title: 'Hello World',
                content: 'This is content...'
            }}
            mode="preview"
            onConfigChange={handleChange}
        />
    )
}
```

## Registry and Utilities

### Widget Registry

```jsx
import { 
    getCoreWidgetComponent,
    getCoreWidgetDisplayName,
    isCoreWidgetTypeSupported 
} from '../../widgets'

const WidgetComponent = getCoreWidgetComponent('core_widgets.ContentWidget')
const displayName = getCoreWidgetDisplayName('core_widgets.ContentWidget')
const isSupported = isCoreWidgetTypeSupported('core_widgets.ContentWidget')
```

### Validation

```jsx
import { validateWidgetConfig, createDefaultWidgetConfig } from '../../widgets'

const validation = validateWidgetConfig(widget)
const defaultConfig = createDefaultWidgetConfig('core_widgets.ContentWidget')
```

## Adding New Widgets

1. **Create the core widget component** in `widgets/core/`
2. **Add metadata** (displayName, widgetType, defaultConfig, metadata)
3. **Register it** in `widgets/registry.js`
4. **Add validation** in `widgets/validation.js` if needed
5. **Export it** from `widgets/index.js`

The widget will automatically be available in both editor frameworks!

## Migration Guide

### From Old Shared Framework

**Before (old approach):**
```jsx
import { WidgetFactory } from '../components/widgets'
```

**After (hybrid approach):**
```jsx
// For PageEditor
import { PageWidgetFactory } from '../editors/page-editor'

// For ObjectEditor  
import { ObjectWidgetFactory } from '../editors/object-editor'

// For direct widget usage
import { ContentWidget } from '../widgets'
```

### Framework-Specific Features

**PageEditor Features:**
- Version management integration
- Publishing workflow support
- Layout renderer integration
- Advanced preview modes

**ObjectEditor Features:**
- Slot configuration validation
- Object type constraints
- Bulk operations
- Simpler workflows

## Event Systems

Each framework has its own event system that extends the base widget events:

### PageEditor Events
- `page-editor:version:created`
- `page-editor:layout:changed`
- `page-editor:page:published`

### ObjectEditor Events
- `object-editor:slot:cleared`
- `object-editor:object:validated`
- `object-editor:bulk:completed`

## Best Practices

1. **Keep core widgets framework-agnostic** - No editor-specific logic in `/widgets/core/`
2. **Use appropriate factory** - PageWidgetFactory for pages, ObjectWidgetFactory for objects
3. **Leverage shared utilities** - Use registry and validation functions
4. **Handle events properly** - Use framework-specific event systems
5. **Test across editors** - Ensure widgets work in both contexts

## Troubleshooting

### Widget Not Found
- Check if widget is registered in `widgets/registry.js`
- Verify the widget type string is correct
- Ensure widget is exported from `widgets/index.js`

### Framework Conflicts
- Use the correct factory for your editor
- Don't mix PageEditor and ObjectEditor components
- Check event system compatibility

### Validation Errors
- Add widget-specific validation in `widgets/validation.js`
- Check default configuration in widget metadata
- Verify widget type registration
