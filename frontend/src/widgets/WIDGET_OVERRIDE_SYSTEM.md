# Widget Override System

The eceee_v4 frontend now supports a powerful widget override system that allows third-party widget packages (like `eceee-widgets`) to override default widgets with custom implementations.

## How It Works

The system uses a **priority-based widget registry manager** that resolves widget lookups based on registry priority levels. Higher priority registries can override widgets from lower priority registries by registering widgets with the same widget type.

### Priority Levels

```javascript
priorities: {
    DEFAULT: 100,      // default-widgets
    ECEEE: 200,        // eceee-widgets  
    THIRD_PARTY: 300,  // third-party widgets
    CUSTOM: 400        // custom/user widgets
}
```

## Architecture

### Core Components

1. **`WidgetRegistryManager`** - Central registry manager that handles priority-based widget resolution
2. **`default-widgets`** - Core widget implementations (priority 100)
3. **`eceee-widgets`** - ECEEE-specific widget implementations (priority 200)
4. **Main widgets index** - Unified export that combines all widget registries

### File Structure

```
frontend/src/widgets/
├── WidgetRegistryManager.js     # Central registry manager
├── index.js                     # Unified widget exports
├── default-widgets/             # Core widget implementations
│   ├── registry.js              # Default widget registry
│   ├── ContentWidget.jsx        # Example default widget
│   └── ...
├── eceee-widgets/               # ECEEE-specific widgets
│   ├── index.js                 # ECEEE widget registry
│   ├── CustomFooterWidget.jsx   # Example override widget
│   └── ...
└── __tests__/
    └── WidgetOverrideSystem.test.js
```

## Usage Examples

### 1. Overriding a Default Widget

To override a default widget, create a new widget with the **same widget type**:

```javascript
// eceee-widgets/CustomFooterWidget.jsx
const CustomFooterWidget = ({ config, editable, onConfigChange }) => {
    // Your custom implementation
    return <footer>Custom ECEEE Footer</footer>;
};

// Use the SAME widget type as the default to override it
CustomFooterWidget.widgetType = 'core_widgets.FooterWidget';
CustomFooterWidget.displayName = 'CustomFooterWidget';

// Register in eceee-widgets/index.js
export const ECEEE_WIDGET_REGISTRY = {
    'core_widgets.FooterWidget': registerWidget(CustomFooterWidget, 'core_widgets.FooterWidget'),
};
```

### 2. Adding a New ECEEE-Specific Widget

```javascript
// eceee-widgets/BlogPostWidget.jsx
const BlogPostWidget = ({ config, editable, onConfigChange }) => {
    // Your new widget implementation
    return <article>ECEEE Blog Post</article>;
};

BlogPostWidget.widgetType = 'eceee_widgets.BlogPostWidget';
BlogPostWidget.displayName = 'BlogPostWidget';

// Register in eceee-widgets/index.js
export const ECEEE_WIDGET_REGISTRY = {
    'eceee_widgets.BlogPostWidget': registerWidget(BlogPostWidget, 'eceee_widgets.BlogPostWidget'),
};
```

### 3. Using the Unified Widget API

The main widgets index provides a unified API that automatically resolves widgets with priority:

```javascript
import { 
    getWidgetComponent,
    getWidgetMetadata,
    getWidgetDefaultConfig,
    isWidgetTypeSupported 
} from '../widgets';

// This will return the ECEEE CustomFooterWidget (priority 200)
// instead of the default FooterWidget (priority 100)
const FooterComponent = getWidgetComponent('core_widgets.FooterWidget');

// Get metadata with priority resolution
const metadata = getWidgetMetadata('core_widgets.FooterWidget');
console.log(metadata.metadata.name); // "ECEEE Footer"

// Check if widget type is supported
const isSupported = isWidgetTypeSupported('core_widgets.FooterWidget'); // true
```

### 4. Registering Third-Party Widget Registries

```javascript
import { registerWidgetRegistry, widgetRegistryManager } from '../widgets';

// Register a third-party widget registry
const THIRD_PARTY_REGISTRY = {
    'custom_widgets.MyWidget': registerWidget(MyWidget, 'custom_widgets.MyWidget'),
};

registerWidgetRegistry(
    THIRD_PARTY_REGISTRY, 
    'my-custom-widgets', 
    widgetRegistryManager.priorities.THIRD_PARTY
);
```

## Widget Resolution Process

When a widget is requested:

1. **Registry Lookup**: The system searches through registered widget registries in **descending priority order**
2. **First Match Wins**: The first registry that contains the widget type returns its implementation
3. **Fallback**: If no registry contains the widget type, `null` is returned

### Example Resolution

```javascript
// Registries (in priority order):
// 1. eceee-widgets (priority 200) - contains 'core_widgets.FooterWidget' 
// 2. default-widgets (priority 100) - contains 'core_widgets.FooterWidget'

getWidgetComponent('core_widgets.FooterWidget')
// → Returns CustomFooterWidget from eceee-widgets (higher priority)

getWidgetComponent('core_widgets.ContentWidget') 
// → Returns ContentWidget from default-widgets (only registry that has it)

getWidgetComponent('non_existent.Widget')
// → Returns null (not found in any registry)
```

## API Reference

### WidgetRegistryManager

#### Methods

- `registerRegistry(registry, priority, name)` - Register a widget registry
- `getWidgetComponent(widgetType)` - Get widget component with priority resolution
- `getWidgetMetadata(widgetType)` - Get widget metadata with priority resolution
- `getWidgetDefaultConfig(widgetType)` - Get widget default config
- `isWidgetTypeSupported(widgetType)` - Check if widget type is supported
- `getAvailableWidgetTypes()` - Get all available widget types
- `searchWidgets(searchTerm)` - Search widgets by term
- `filterWidgetsByCategory(category)` - Filter widgets by category
- `getAvailableCategories()` - Get all available categories

### Unified Widget Functions

All functions exported from `widgets/index.js` use the priority-based resolution:

```javascript
export {
    getWidgetComponent,
    getWidgetMetadata, 
    getWidgetDefaultConfig,
    getWidgetDisplayName,
    isWidgetTypeSupported,
    getAvailableWidgetTypes,
    getAllWidgetMetadata,
    searchWidgets,
    filterWidgetsByCategory,
    getAvailableCategories,
    registerWidgetRegistry,
    widgetRegistryManager
};
```

## Testing

The system includes comprehensive tests that verify:

- ✅ Registry registration with correct priorities
- ✅ Widget override functionality (ECEEE widgets override default widgets)
- ✅ Fallback to default widgets when no override exists
- ✅ Priority-based metadata and config resolution
- ✅ Widget type support checking
- ✅ Search and filtering across all registries
- ✅ Registry priority order maintenance

Run tests with:
```bash
npm run test:run src/widgets/__tests__/WidgetOverrideSystem.test.js
```

## Benefits

✅ **Seamless Overrides** - ECEEE widgets automatically override default widgets  
✅ **Backward Compatibility** - Existing code continues to work unchanged  
✅ **Priority Control** - Clear priority system for conflict resolution  
✅ **Extensible** - Easy to add new widget packages with custom priorities  
✅ **Type Safety** - Same widget types ensure API compatibility  
✅ **Performance** - Efficient priority-based lookup with caching  
✅ **Debugging** - Built-in logging shows which registry provides each widget  

## Migration Guide

### For Existing Code

No changes required! The unified widget API maintains backward compatibility:

```javascript
// This still works exactly the same
import { ContentWidget, FooterWidget } from '../widgets';

// But now FooterWidget might be the ECEEE override instead of default
```

### For New Widget Packages

1. Create your widget registry following the pattern in `eceee-widgets/`
2. Register widgets using the same `registerWidget` utility
3. Use the same widget types to override, or new types to extend
4. Register your registry with appropriate priority

## Example: Complete Widget Override

Here's a complete example of overriding the default FooterWidget:

```javascript
// eceee-widgets/CustomFooterWidget.jsx
import React from 'react';
import { registerWidget } from '../default-widgets/registry';

const CustomFooterWidget = ({ config = {}, editable, onConfigChange }) => {
    const { companyName = 'ECEEE', showContact = true } = config;
    
    if (editable) {
        return (
            <div className="p-4 border rounded">
                <h3>ECEEE Custom Footer</h3>
                <input 
                    value={companyName}
                    onChange={(e) => onConfigChange({ companyName: e.target.value })}
                />
            </div>
        );
    }
    
    return (
        <footer className="bg-gray-800 text-white p-6">
            <h3>{companyName}</h3>
            {showContact && <p>Contact: info@eceee.org</p>}
        </footer>
    );
};

CustomFooterWidget.displayName = 'CustomFooterWidget';
CustomFooterWidget.widgetType = 'core_widgets.FooterWidget'; // Same as default
CustomFooterWidget.defaultConfig = { companyName: 'ECEEE', showContact: true };
CustomFooterWidget.metadata = {
    name: 'ECEEE Footer',
    description: 'Custom ECEEE footer with branding',
    category: 'layout',
    tags: ['footer', 'eceee', 'branding']
};

export default CustomFooterWidget;

// eceee-widgets/index.js
import CustomFooterWidget from './CustomFooterWidget';

export const ECEEE_WIDGET_REGISTRY = {
    'core_widgets.FooterWidget': registerWidget(CustomFooterWidget, 'core_widgets.FooterWidget'),
};

// Now anywhere FooterWidget is used, the ECEEE version will be rendered!
```

This system provides a powerful, flexible way to customize and extend the widget system while maintaining full backward compatibility.
