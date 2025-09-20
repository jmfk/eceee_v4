# Unified Data Context Documentation

## Overview

The Unified Data Context provides a centralized system for managing all data operations, state management, and subscriptions in the eceee_v4 application. It replaces multiple context-specific implementations with a single, consistent API for handling pages, widgets, layouts, and versions.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [State Management](#state-management)
3. [Operations](#operations)
4. [Subscriptions](#subscriptions)
5. [Hooks](#hooks)
6. [Examples](#examples)
7. [Best Practices](#best-practices)

## Basic Usage

### Provider Setup

```jsx
import { UnifiedDataProvider } from './contexts/unified-data';

function App() {
  return (
    <UnifiedDataProvider>
      <YourApp />
    </UnifiedDataProvider>
  );
}
```

### Using the Context

```jsx
import { useUnifiedData } from './contexts/unified-data';

function YourComponent() {
  const { state, dispatch, subscribe } = useUnifiedData();
  // ... use the context
}
```

## State Management

The context maintains a centralized state for all application data:

```typescript
interface AppState {
  pages: Record<string, PageData>;
  widgets: Record<string, WidgetData>;
  layouts: Record<string, LayoutData>;
  versions: Record<string, VersionData>;
}
```

### Accessing State

```jsx
function PageComponent({ pageId }) {
  const { useSelector } = useUnifiedData();
  
  // Select specific data
  const page = useSelector(state => state.pages[pageId]);
  const pageWidgets = useSelector(state => 
    Object.values(state.widgets).filter(w => w.pageId === pageId)
  );
}
```

## Operations

Operations are the primary way to modify state. Each operation is typed and validated.

### Basic Operations

```jsx
function WidgetEditor({ widgetId }) {
  const { dispatch } = useUnifiedData();

  const updateWidget = async (config) => {
    await dispatch({
      type: 'UPDATE_WIDGET_CONFIG',
      payload: {
        id: widgetId,
        config
      }
    });
  };
}
```

### Batch Operations

```jsx
const { dispatch } = useUnifiedData();

// Update multiple items atomically
await dispatch({
  type: 'BATCH',
  payload: [
    {
      type: 'UPDATE_WIDGET',
      payload: { id: 'widget1', updates: { ... } }
    },
    {
      type: 'UPDATE_PAGE_METADATA',
      payload: { id: 'page1', metadata: { ... } }
    }
  ]
});
```

## Subscriptions

Subscribe to state changes or operations with fine-grained control.

### State Subscriptions

```jsx
function WidgetMonitor({ widgetId }) {
  const { subscribe } = useUnifiedData();
  
  useEffect(() => {
    // Subscribe to specific widget changes
    return subscribe(
      state => state.widgets[widgetId],
      (newWidget, prevWidget) => {
        console.log('Widget updated:', newWidget);
      },
      { immediate: true }
    );
  }, [widgetId]);
}
```

### Operation Subscriptions

```jsx
function OperationLogger() {
  const { subscribeToOperations } = useUnifiedData();
  
  useEffect(() => {
    // Subscribe to specific operation types
    return subscribeToOperations(
      (operation) => {
        console.log('Operation executed:', operation);
      },
      ['UPDATE_WIDGET', 'UPDATE_PAGE']
    );
  }, []);
}
```

## Hooks

The context provides several specialized hooks for common use cases:

```jsx
function PageEditor({ pageId }) {
  // Hook for page-specific operations
  const { 
    page,
    updateMetadata,
    publishPage
  } = usePageOperations(pageId);

  // Hook for widget operations within a page
  const {
    widgets,
    updateWidget,
    moveWidget
  } = usePageWidgets(pageId);
}
```

## Examples

### Real-time Widget Updates

```jsx
function WidgetConfigurator({ widgetId }) {
  const { useSelector, dispatch } = useUnifiedData();
  
  const widget = useSelector(state => state.widgets[widgetId]);
  
  const updateConfig = async (newConfig) => {
    await dispatch({
      type: 'UPDATE_WIDGET_CONFIG',
      payload: {
        id: widgetId,
        config: newConfig
      }
    });
  };

  return (
    <ConfigEditor
      value={widget.config}
      onChange={updateConfig}
    />
  );
}
```

### Page Version Management

```jsx
function PageVersions({ pageId }) {
  const { dispatch, useSelector } = useUnifiedData();
  
  const versions = useSelector(state => 
    Object.values(state.versions)
      .filter(v => v.page_id === pageId)
  );
  
  const publishVersion = async (versionId) => {
    await dispatch({
      type: 'PUBLISH_VERSION',
      payload: {
        pageId,
        versionId,
        action: 'publish'
      }
    });
  };
}
```

## Best Practices

1. **Use Selectors Efficiently**
   - Create reusable selectors for common data access patterns
   - Memoize complex selectors to prevent unnecessary recalculations

2. **Batch Related Changes**
   - Use batch operations when multiple state updates are related
   - This ensures atomic updates and better performance

3. **Handle Operation Results**
   - Always await dispatch calls to handle errors properly
   - Use try/catch blocks for proper error handling

4. **Subscribe Carefully**
   - Clean up subscriptions in useEffect cleanup functions
   - Use specific selectors to minimize unnecessary updates

5. **State Updates**
   - Keep state normalized to avoid inconsistencies
   - Use immutable update patterns

## Migration from WidgetEventContext

If you're migrating from the old WidgetEventContext, here's how events map to operations:

```javascript
// Old event system
emit('widget:changed', { widgetId, changes });

// New operation system
dispatch({
  type: 'UPDATE_WIDGET',
  payload: {
    id: widgetId,
    updates: changes
  }
});

// Old subscription
subscribe('widget:changed', handleChange);

// New subscription
subscribeToOperations(handleOperation, ['UPDATE_WIDGET']);
```

## Error Handling

The context includes built-in error handling:

```jsx
function ErrorBoundary() {
  const { useSelector } = useUnifiedData();
  
  const errors = useSelector(state => state.metadata.errors);
  
  return errors && Object.keys(errors).length > 0 ? (
    <ErrorDisplay errors={errors} />
  ) : null;
}
```

## Performance Considerations

1. Use specific selectors to prevent unnecessary rerenders
2. Batch related operations when possible
3. Consider using the `equalityFn` option for subscriptions with complex data
4. Memoize callbacks and selectors appropriately

## TypeScript Support

The context is fully typed, providing excellent IDE support and type safety:

```typescript
import { Operation, PageData, WidgetData } from './types';

// Types are automatically inferred
const page: PageData = useSelector(state => state.pages[pageId]);

// Operations are type-checked
const operation: Operation = {
  type: 'UPDATE_PAGE',
  payload: {
    id: pageId,
    updates: {
      title: 'New Title' // TypeScript ensures valid updates
    }
  }
};
```
