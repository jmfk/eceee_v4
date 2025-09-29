# Widget Type Override System

The widget registry now supports **manual widget type override**, giving you full control over widget type naming.

## How It Works

### 1. Automatic Widget Type Generation (Default)
```javascript
// In registry.js
'default_widgets.TableWidget': registerWidget(TableWidget),

// This automatically generates: 'default_widgets.TableWidget'
// Based on: `default_widgets.${WidgetComponent.displayName}`
```

### 2. Manual Widget Type Override
```javascript
// In registry.js  
'core_widgets.ContentWidget': registerWidget(ContentWidget, 'core_widgets.ContentWidget'),

// This manually sets the widget type to: 'core_widgets.ContentWidget'
// Overriding any automatic generation
```

### 3. Component-Level Widget Type
```javascript
// In the widget component file
const MyWidget = (props) => { /* ... */ }

MyWidget.displayName = 'MyWidget'
MyWidget.widgetType = 'custom_widgets.MySpecialWidget'  // <-- Manual override

// In registry.js
'custom_widgets.MySpecialWidget': registerWidget(MyWidget),
// Uses the component's widgetType: 'custom_widgets.MySpecialWidget'
```

## Priority Order

The system uses this priority order:

1. **Registry override** (highest priority) - `registerWidget(Widget, 'custom_type')`
2. **Component widgetType** - `Widget.widgetType = 'custom_type'`  
3. **Auto-generated** (fallback) - `default_widgets.${Widget.displayName}`

## Usage Examples

### Example 1: Backward Compatibility
Keep existing `core_widgets.*` types while using new directory structure:

```javascript
export const CORE_WIDGET_REGISTRY = {
    // IMPORTANT: Registry key MUST match the widget type for lookup to work!
    'core_widgets.ContentWidget': registerWidget(ContentWidget, 'core_widgets.ContentWidget'),
    'core_widgets.ImageWidget': registerWidget(ImageWidget, 'core_widgets.ImageWidget'),
}
```

**Critical Rule**: The registry key must match the widget's actual type because `getCoreWidgetComponent(widget.type)` uses the widget's type to look up the registry entry.

### Example 2: Mixed Naming
Use different naming conventions for different widgets:

```javascript
export const CORE_WIDGET_REGISTRY = {
    // Legacy widgets keep old names
    'core_widgets.ContentWidget': registerWidget(ContentWidget, 'core_widgets.ContentWidget'),
    
    // New widgets use new naming
    'default_widgets.TableWidget': registerWidget(TableWidget),
    
    // Custom naming for special cases
    'eceee_widgets.BlogPostWidget': registerWidget(BlogPostWidget, 'eceee_widgets.BlogPostWidget'),
}
```

### Example 3: Future Widget Packages
When creating `eceee-widgets` package:

```javascript
// In widgets/eceee-widgets/registry.js
import { registerWidget } from '../default-widgets'
import BlogPostWidget from './BlogPostWidget'

export const ECEEE_WIDGET_REGISTRY = {
    'eceee_widgets.BlogPostWidget': registerWidget(BlogPostWidget, 'eceee_widgets.BlogPostWidget'),
    'eceee_widgets.NewsletterWidget': registerWidget(NewsletterWidget),  // Auto: eceee_widgets.NewsletterWidget
}
```

## Benefits

✅ **Full Control** - Override widget types manually when needed  
✅ **Backward Compatibility** - Keep existing widget type names  
✅ **Flexibility** - Mix automatic and manual naming in same registry  
✅ **Future-Proof** - Easy to migrate or rename widget types  
✅ **Package Independence** - Each widget package controls its own naming

This gives you the same level of control over widget type naming that you have on the backend!
