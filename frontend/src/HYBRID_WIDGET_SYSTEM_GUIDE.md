# Hybrid Widget System - Developer Guide

## 🎯 **Quick Start**

The hybrid widget system provides **complete logical separation** between PageEditor and ObjectEditor while sharing widget implementations.

### For PageEditor Development
```jsx
import { PageWidgetFactory, PageContentEditor } from './editors/page-editor'
import { ContentWidget, ImageWidget } from './widgets'
```

### For ObjectEditor Development
```jsx
import { ObjectWidgetFactory } from './editors/object-editor'
import { ContentWidget, ImageWidget } from './widgets'
```

### For Widget Development
```jsx
import { getCoreWidgetComponent, validateWidgetConfig } from './widgets'
```

## 📁 **Directory Structure**

```
frontend/src/
├── widgets/                    # 🔗 SHARED CORE
│   ├── core/                  # Widget implementations (ContentWidget, ImageWidget, etc.)
│   ├── registry.js            # Widget registry and utilities
│   ├── validation.js          # Widget validation utilities
│   └── index.js              # Main exports
├── editors/                   # 📝 FRAMEWORK LAYERS
│   ├── page-editor/          # PageEditor framework (version management, publishing)
│   ├── object-editor/        # ObjectEditor framework (slot validation, constraints)
│   └── index.js              # Unified editor exports
└── components/widgets/       # 🗂️ LEGACY (deprecated, kept for compatibility)
```

## 🔧 **Core Concepts**

### 1. **Shared Widget Core**
- **Widget implementations** are shared between all editors
- **Same behavior** across all contexts
- **Single source of truth** for each widget type
- **Framework-agnostic** design

### 2. **Separate Editor Frameworks**
- **PageEditor framework** - Version management, publishing, layout integration
- **ObjectEditor framework** - Slot validation, object constraints, bulk operations
- **Independent evolution** - Change one without affecting the other
- **Specialized features** - Each optimized for its use case

### 3. **Event System Separation**
- **PageEditor events** - Version-filtered, publishing-aware
- **ObjectEditor events** - Slot-filtered, constraint-aware
- **No cross-contamination** - Events stay within their editor context

## 🎨 **Usage Patterns**

### PageEditor Widget Usage
```jsx
import { PageWidgetFactory } from '../editors/page-editor'

const PageEditor = () => (
    <PageWidgetFactory
        widget={widget}
        slotName={slotName}
        index={index}
        // Standard props
        onEdit={handleEdit}
        onDelete={handleDelete}
        // PageEditor-specific props
        versionId={versionId}
        isPublished={isPublished}
        layoutRenderer={layoutRenderer}
        onVersionChange={handleVersionChange}
        onPublishingAction={handlePublishingAction}
    />
)
```

### ObjectEditor Widget Usage
```jsx
import { ObjectWidgetFactory } from '../editors/object-editor'

const ObjectEditor = () => (
    <ObjectWidgetFactory
        widget={widget}
        slotName={slotName}
        index={index}
        // Standard props
        onEdit={handleEdit}
        onDelete={handleDelete}
        // ObjectEditor-specific props
        objectType={objectType}
        slotConfig={slotConfig}
        onSlotAction={handleSlotAction}
        allowedWidgetTypes={allowedTypes}
        maxWidgets={maxWidgets}
    />
)
```

### Direct Widget Usage
```jsx
import { ContentWidget, ImageWidget } from '../widgets'

const MyComponent = () => (
    <div>
        <ContentWidget 
            config={{ title: 'Hello', content: 'World' }} 
            mode="preview" 
        />
        <ImageWidget 
            config={{ src: '/image.jpg', alt: 'Image' }} 
            mode="preview" 
        />
    </div>
)
```

## ⚡ **Event Systems**

### PageEditor Events
```jsx
import { createPageEditorEventSystem } from '../editors/page-editor'

const pageEvents = createPageEditorEventSystem(baseEventSystem)

// Version-aware events
pageEvents.onWidgetChanged(callback, versionFilter)
pageEvents.onVersionPublished(callback)
pageEvents.onLayoutChanged(callback)
```

### ObjectEditor Events  
```jsx
import { createObjectEditorEventSystem } from '../editors/object-editor'

const objectEvents = createObjectEditorEventSystem(baseEventSystem)

// Slot-aware events
objectEvents.onWidgetChanged(callback, slotFilter)
objectEvents.onSlotCleared(callback)
objectEvents.onSlotConstraintViolated(callback)
```

## 🧪 **Testing**

### Migration Test Components
```jsx
// Test PageEditor framework
import { PageEditorMigrationTest } from '../editors/page-editor'

// Test ObjectEditor framework
import { ObjectEditorMigrationTest } from '../editors/object-editor'
```

### Widget Testing
```jsx
import { validateWidgetConfig, createDefaultWidgetConfig } from '../widgets'

// Test widget validation
const validation = validateWidgetConfig(widget)
expect(validation.isValid).toBe(true)

// Test default config creation
const defaultConfig = createDefaultWidgetConfig('core_widgets.ContentWidget')
expect(defaultConfig).toHaveProperty('title')
```

## 🔍 **Troubleshooting**

### Import Errors
```jsx
// ❌ OLD (deprecated)
import { WidgetFactory } from '../components/widgets'

// ✅ NEW (use appropriate framework)
import { PageWidgetFactory } from '../editors/page-editor'      // For PageEditor
import { ObjectWidgetFactory } from '../editors/object-editor'  // For ObjectEditor
import { ContentWidget } from '../widgets'                     // For direct usage
```

### Widget Not Found
1. Check if widget is registered in `/widgets/registry.js`
2. Verify widget is exported from `/widgets/index.js`
3. Ensure widget type string matches registry

### Event System Issues
1. Use the correct event system for your editor
2. Check event filtering (version for PageEditor, slot for ObjectEditor)
3. Verify event context includes required properties

### Framework Conflicts
1. Don't mix PageEditor and ObjectEditor components
2. Use appropriate factory for your editor context
3. Check that editor-specific props are provided

## 📚 **Best Practices**

### 1. **Widget Development**
- Keep widgets framework-agnostic in `/widgets/core/`
- Add metadata for registry registration
- Include validation rules in `/widgets/validation.js`
- Test widgets in both editor contexts

### 2. **Editor Development**
- Use appropriate framework components
- Leverage editor-specific event systems
- Don't add editor-specific logic to shared widgets
- Test framework-specific features thoroughly

### 3. **Integration**
- Import from correct locations (`/widgets/` vs `/editors/`)
- Use appropriate event systems for your context
- Respect framework boundaries
- Document editor-specific requirements

## 🚀 **Performance Tips**

### Bundle Optimization
- Import only what you need from each framework
- Use dynamic imports for editor-specific components
- Leverage tree shaking for unused widgets

### Event Performance
- Use event filtering to avoid unnecessary processing
- Unsubscribe from events when components unmount
- Batch event emissions when possible

### Widget Performance
- Use React.memo for expensive widgets
- Implement shouldComponentUpdate for complex widgets
- Cache widget configurations when appropriate

## 🔮 **Future Extensions**

### Adding New Editors
1. Create new editor framework in `/editors/new-editor/`
2. Implement editor-specific widget factory
3. Create editor-specific event system
4. Register editor in `/editors/index.js`

### Adding New Widgets
1. Create widget in `/widgets/core/NewWidget.jsx`
2. Add metadata and registration
3. Add validation rules if needed
4. Export from `/widgets/index.js`
5. Widget automatically available in all editors!

### Framework Enhancements
- Add editor-specific features without affecting others
- Enhance event systems with new event types
- Optimize for editor-specific use cases
- Maintain backward compatibility

## 📖 **Additional Documentation**

- **`/widgets/README.md`** - Shared widget system details
- **`/editors/MIGRATION_EXAMPLE.md`** - Migration patterns and examples
- **`HYBRID_SEPARATION_COMPLETE.md`** - Implementation overview
- **Migration summaries** - Phase-by-phase implementation details

## 🎉 **Success!**

The hybrid widget system successfully achieves:
- ✅ **Complete logical separation** between editors
- ✅ **Shared widget implementations** for consistency
- ✅ **Independent evolution** capability
- ✅ **Enhanced stability** and reliability
- ✅ **Future-proof architecture**

**Happy coding with the new hybrid widget system! 🚀**
