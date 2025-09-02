# Widget System Abstraction Layer

The Widget System Abstraction Layer provides a unified interface that allows widgets to work seamlessly in both page and object contexts without requiring knowledge of which editor they're in.

## Overview

This abstraction layer eliminates the need for widgets to contain context-specific code, making them truly portable and maintainable. The same widget component can work identically in both page editors and object editors, with the abstraction layer handling all context-specific differences behind the scenes.

## Key Benefits

1. **Widget Portability**: Widgets work in any context without modification
2. **Cleaner Code**: No if/else statements for context differences
3. **Easier Testing**: Mock context for comprehensive testing
4. **Future Proof**: Easy to add new contexts (mobile, API-only, etc.)
5. **Maintainability**: Changes isolated to abstraction layer

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Widget Components                        │
│              (Context-Agnostic)                            │
├─────────────────────────────────────────────────────────────┤
│                 Abstraction Layer                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │   Context   │ │    Slot     │ │ Configuration│          │
│  │ Abstraction │ │ Abstraction │ │ Abstraction  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ Data Flow   │ │ Rendering   │ │ API Client  │          │
│  │ Abstraction │ │ Abstraction │ │ Abstraction │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│           Context Implementations                          │
│  ┌─────────────────┐    ┌─────────────────┐               │
│  │ Page Context    │    │ Object Context  │               │
│  │ - Inheritance   │    │ - Restrictions  │               │
│  │ - Templates     │    │ - Controls      │               │
│  │ - Flexibility   │    │ - Validation    │               │
│  └─────────────────┘    └─────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. WidgetHost

The main component that provides context abstraction:

```jsx
import { WidgetHost } from '@/widgets/abstraction'

// Automatically detects context and provides appropriate implementation
<WidgetHost
  // Page-specific props (auto-detected)
  layoutJson={layoutJson}
  pageVersionData={pageVersionData}
  webpageData={webpageData}
  onUpdate={handleUpdate}
  
  // OR Object-specific props (auto-detected)
  objectType={objectType}
  objectInstance={objectInstance}
  objectWidgets={objectWidgets}
  onWidgetChange={handleWidgetChange}
  
  // Common props
  editable={true}
  renderingMode="edit"
>
  {/* Your widget components */}
</WidgetHost>
```

### 2. Context Implementations

#### PageWidgetContext
- Handles layout-based slots
- Supports widget inheritance from templates
- Flexible widget type restrictions
- Template-based configurations

#### ObjectWidgetContext
- Handles object type slots
- Enforces strict widget controls
- Type restrictions based on widget controls
- Validation against object constraints

### 3. Slot Abstractions

#### TemplateSlot (Pages)
- Derived from layout JSON
- Supports inheritance
- Flexible widget types
- Template widgets

#### ConfiguredSlot (Objects)
- Derived from object type configuration
- Widget controls define allowed types
- Strict validation
- Required widget enforcement

## Usage Examples

### Universal Widget Component

```jsx
import { useWidgetContext, useWidgetOperations } from '@/widgets/abstraction'

function UniversalTextWidget({ widget, slotId }) {
  const context = useWidgetContext()
  const operations = useWidgetOperations(slotId)
  
  // Same code works in both contexts!
  const handleUpdate = async (newConfig) => {
    const result = await context.updateWidget(widget.id, newConfig)
    if (!result.success) {
      console.error('Update failed:', result.error)
    }
  }
  
  // Context automatically handles differences:
  // - Page context: supports inheritance, flexible validation
  // - Object context: strict types, control-based validation
  
  return (
    <div className="universal-widget">
      {/* Widget content */}
      <textarea
        value={widget.config.content}
        onChange={(e) => handleUpdate({ 
          ...widget.config, 
          content: e.target.value 
        })}
        disabled={!operations.isEditable}
      />
      
      {/* Context info (for development) */}
      <div className="debug-info">
        Context: {context.type} | Editable: {operations.isEditable}
      </div>
    </div>
  )
}
```

### Page Editor Integration

```jsx
import { WidgetHost } from '@/widgets/abstraction'

function PageEditor({ pageData }) {
  return (
    <WidgetHost
      layoutJson={pageData.layoutJson}
      pageVersionData={pageData.pageVersionData}
      webpageData={pageData.webpageData}
      onUpdate={handlePageUpdate}
      editable={true}
    >
      <ContentEditor />
    </WidgetHost>
  )
}
```

### Object Editor Integration

```jsx
import { WidgetHost } from '@/widgets/abstraction'

function ObjectEditor({ objectData }) {
  return (
    <WidgetHost
      objectType={objectData.objectType}
      objectInstance={objectData.objectInstance}
      objectWidgets={objectData.widgets}
      onWidgetChange={handleObjectWidgetChange}
      editable={true}
    >
      <ObjectContentEditor />
    </WidgetHost>
  )
}
```

## Hooks and Utilities

### useWidgetContext()
Access the current widget context:

```jsx
const context = useWidgetContext()

// Context properties
console.log(context.type) // 'page' | 'object'
console.log(context.isEditable()) // boolean
console.log(context.getMetadata()) // context metadata

// Context operations
await context.addWidget(slotId, widget)
await context.updateWidget(widgetId, config)
await context.removeWidget(widgetId)
const validation = context.validateWidget(widget)
```

### useWidgetOperations(slotId)
Get operations scoped to a specific slot:

```jsx
const operations = useWidgetOperations('main-content')

// Slot-specific data
console.log(operations.slotWidgets) // widgets in slot
console.log(operations.availableTypes) // allowed widget types

// Slot-specific operations
await operations.addToSlot(widget)
const canAdd = operations.canAddToSlot('text-block')
```

### useSlotOperations(slotId)
Get detailed slot information and operations:

```jsx
const slot = useSlotOperations('sidebar')

// Slot metadata
console.log(slot.label) // human-readable name
console.log(slot.maxWidgets) // capacity limit
console.log(slot.accepts) // allowed types
console.log(slot.hasSpace) // can accept more widgets

// Slot operations
await slot.addWidget(widget)
const isValid = slot.isValid // validation status
```

## Configuration Management

The abstraction layer handles configuration differences between contexts:

```jsx
import { ConfigurationManager } from '@/widgets/abstraction'

const configManager = new ConfigurationManager({
  contextType: 'page'
})

// Validate configuration for context
const validation = configManager.validateConfiguration(config, widget, slot)

// Transform configuration between contexts
const objectConfig = configManager.transformConfiguration(
  pageConfig,
  'page',
  'object'
)

// Get context-appropriate schema
const schema = configManager.getConfigurationSchema('text-block', 'page')
```

## Data Flow Management

Handle widget data storage and synchronization:

```jsx
import { DataFlowManager } from '@/widgets/abstraction'

const dataManager = new DataFlowManager({
  contextType: 'object'
})

// Store widget with context processing
await dataManager.storeWidget(widget)

// Retrieve widget with context processing
const widget = await dataManager.retrieveWidget(widgetId)

// Sync multiple widgets
const result = await dataManager.syncWidgets(widgets)
```

## API Integration

Unified API operations regardless of context:

```jsx
import { ApiClient } from '@/widgets/abstraction'

const apiClient = new ApiClient({
  contextType: 'page'
})

// Save widgets (handles page vs object differences)
const result = await apiClient.saveWidgets(data)

// Load widgets (transforms response appropriately)
const data = await apiClient.loadWidgets(entityId)

// Validate widgets on server
const validation = await apiClient.validateWidgets(widgets)
```

## Migration Guide

### From Direct Context Usage

**Before (context-specific code):**
```jsx
function TextWidget({ widget, context, slotId }) {
  const handleUpdate = (newConfig) => {
    if (context === 'page') {
      // Page-specific update logic
      onPageWidgetUpdate(slotId, widget.id, newConfig)
    } else if (context === 'object') {
      // Object-specific update logic
      onObjectWidgetUpdate(slotId, widget.id, newConfig)
    }
  }
  
  const isEditable = context === 'page' 
    ? pageEditable 
    : objectEditable && hasPermission
    
  // More if/else statements...
}
```

**After (abstraction layer):**
```jsx
function TextWidget({ widget, slotId }) {
  const context = useWidgetContext()
  
  const handleUpdate = async (newConfig) => {
    // Same code works in both contexts!
    const result = await context.updateWidget(widget.id, newConfig)
    if (!result.success) {
      console.error('Update failed:', result.error)
    }
  }
  
  const isEditable = context.isEditable()
  
  // No context-specific code needed!
}
```

### Migration Steps

1. **Wrap editors with WidgetHost**:
   ```jsx
   // Wrap your existing editors
   <WidgetHost {...contextProps}>
     <YourExistingEditor />
   </WidgetHost>
   ```

2. **Replace context checks with hooks**:
   ```jsx
   // Replace direct context checks
   const context = useWidgetContext()
   const operations = useWidgetOperations(slotId)
   ```

3. **Use abstracted operations**:
   ```jsx
   // Replace direct API calls
   await context.updateWidget(widgetId, config)
   ```

4. **Remove context-specific code**:
   ```jsx
   // Remove if/else statements for context differences
   // The abstraction layer handles it automatically
   ```

## Testing

The abstraction layer includes comprehensive tests:

```bash
# Run abstraction layer tests
npm test src/widgets/abstraction/tests/

# Run specific test suites
npm test AbstractionLayer.test.js
```

### Testing Utilities

```jsx
import { TestUtils } from '@/widgets/abstraction/tests/AbstractionLayer.test.js'

// Create mock props for testing
const pageProps = TestUtils.createMockPageProps()
const objectProps = TestUtils.createMockObjectProps()
const mockWidget = TestUtils.createMockWidget()
```

## Performance Considerations

The abstraction layer is designed for minimal performance impact:

- **Lazy Context Creation**: Contexts are only created when needed
- **Caching**: Slot configurations and schemas are cached
- **Efficient Updates**: Only necessary re-renders triggered
- **Memory Management**: Proper cleanup of event listeners and caches

## Debugging

Enable debug mode in development:

```jsx
<WidgetHost
  {...props}
  debug={process.env.NODE_ENV === 'development'}
>
  {/* Debug indicators will show context info */}
</WidgetHost>
```

Debug information includes:
- Current context type
- Number of slots and widgets
- Validation status
- Performance metrics

## Best Practices

1. **Always use WidgetHost**: Wrap widget editors with WidgetHost component
2. **Use hooks for context access**: Don't pass context as props
3. **Avoid context-specific code**: Let the abstraction layer handle differences
4. **Test in both contexts**: Ensure widgets work in page and object contexts
5. **Handle async operations**: Use proper error handling for widget operations
6. **Validate configurations**: Use the configuration manager for validation
7. **Cache when possible**: Use caching for expensive operations

## Troubleshooting

### Common Issues

**Widget not updating:**
- Check if WidgetHost is properly configured
- Verify context has correct data
- Ensure widget operations are awaited

**Validation errors:**
- Check widget configuration against context rules
- Verify slot allows the widget type
- Review context-specific constraints

**Context not detected:**
- Ensure required props are passed to WidgetHost
- Check prop names match expected format
- Use forceContext prop if needed

**Performance issues:**
- Enable debug mode to see performance metrics
- Check for unnecessary re-renders
- Verify proper cleanup of event listeners

## Future Enhancements

The abstraction layer is designed to be extensible:

- **Mobile Context**: Support for mobile widget editors
- **API-Only Context**: Headless widget management
- **Preview Context**: Read-only widget rendering
- **Multi-User Context**: Collaborative editing support
- **Version Context**: Time-travel debugging

## Contributing

When adding new features to the abstraction layer:

1. **Follow interfaces**: Implement the core interfaces
2. **Add tests**: Include comprehensive test coverage
3. **Update documentation**: Keep README and examples current
4. **Consider all contexts**: Ensure changes work in all contexts
5. **Maintain backward compatibility**: Don't break existing usage

## Version History

- **v1.0.0**: Initial implementation with page and object contexts
- Context abstraction layer
- Slot abstraction with TemplateSlot and ConfiguredSlot
- Configuration management with validation and transformation
- Data flow management with inheritance and restrictions
- API client with response transformation
- Rendering abstraction with WidgetHost
- Comprehensive test suite
- Migration utilities and documentation

---

The Widget System Abstraction Layer represents a major architectural improvement that enables truly portable widgets while maintaining the specific behaviors required by different editing contexts. By eliminating context-specific code from widgets, we achieve cleaner, more maintainable, and more testable code that works consistently across the entire application.
