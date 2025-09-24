# Unified Data Context (UDC) Component Synchronization

## Overview

The Unified Data Context (UDC) is a sophisticated state management system designed to synchronize data across multiple components while preventing race conditions and infinite update loops. This document explains how UDC works with components like `ContentWidget` and `HtmlSourceField` to maintain data consistency.

## Core Architecture

### Component Registration Pattern

Each component that participates in UDC synchronization follows this pattern:

1. **Component ID Generation**: Creates a unique identifier for the component instance
2. **External Changes Subscription**: Subscribes to state changes from other components
3. **Update Publishing**: Publishes its own changes to the shared state
4. **Race Condition Prevention**: Uses component IDs to filter out self-triggered updates

## Race Condition Prevention Mechanism

### The Problem

Without proper synchronization, components can create infinite update loops:

```
Component A changes data → UDC updates → Component A receives update → Component A changes data → ...
```

### The Solution: Component ID Filtering

UDC prevents race conditions by:

1. **Unique Component IDs**: Each component instance gets a unique identifier
2. **Update Origin Tracking**: Every update includes the originating component ID
3. **Self-Update Filtering**: Components ignore updates they originated

## Implementation Examples

### ContentWidget Implementation

```javascript
const ContentWidget = ({ widgetId, slotName, config, onConfigChange }) => {
    const { useExternalChanges, publishUpdate } = useUnifiedData();
    const [content, setContent] = useState(config.content || 'Default content...');
    
    // 1. Generate unique component ID
    const componentId = `widget-${widgetId}`;

    // 2. Subscribe to external changes (from other components)
    useExternalChanges(componentId, (state) => {
        const { content: newContent } = getWidgetContent(state, widgetId, slotName);
        if (hasWidgetContentChanged(content, newContent)) {
            setContent(newContent); // Only update if content actually changed
        }
    });

    // 3. Publish updates with component ID
    const handleContentChange = useCallback(async (newContent) => {
        if (newContent !== content) {
            setContent(newContent);
            publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                slotName: slotName,
                config: { ...config, content: newContent }
            });
        }
    }, [content, config]);

    return (
        <ContentWidgetEditor
            content={content}
            onChange={handleContentChange}
        />
    );
};
```

### HtmlSourceField Implementation

```javascript
const HtmlSourceField = ({ context, value, onChange }) => {
    const [currentValue, setCurrentValue] = useState(value);
    const { useExternalChanges, publishUpdate } = useUnifiedData();
    
    // 1. Generate unique component ID
    const fieldId = `field-${context.widgetId}`;

    // 2. Subscribe to external changes
    useExternalChanges(fieldId, state => {
        const { content: newContent } = getWidgetContent(state, context.widgetId, context.slotName);
        if (hasWidgetContentChanged(currentValue, newContent)) {
            setCurrentValue(newContent);
        }
    });

    // 3. Publish updates with component ID
    const handleChange = (newValue) => {
        setCurrentValue(newValue);
        publishUpdate(fieldId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: context.widgetId,
            slotName: context.slotName,
            config: { content: newValue }
        });
        onChange(newValue);
    };

    return (
        <HtmlEditor
            value={currentValue}
            onChange={handleChange}
        />
    );
};
```

## Data Flow Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ContentWidget │    │ HtmlSourceField │    │  Other Components│
│   componentId:  │    │   componentId:  │    │   componentId:  │
│   widget-123    │    │   field-123     │    │   editor-123    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ publishUpdate()      │ publishUpdate()      │ publishUpdate()
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Unified Data Context  │
                    │                         │
                    │  • Receives updates     │
                    │  • Updates central      │
                    │    state                │
                    │  • Broadcasts to all    │
                    │    subscribers          │
                    └─────────────┬───────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
    useExternalChanges()    useExternalChanges()    useExternalChanges()
          │                       │                       │
          │ Filter: ignore        │ Filter: ignore        │ Filter: ignore
          │ if from widget-123    │ if from field-123     │ if from editor-123
          │                       │                       │
          ▼                       ▼                       ▼
    Update local state      Update local state      Update local state
    (if different)          (if different)          (if different)
```

## Key UDC Hooks

### useExternalChanges(componentId, callback)

Subscribes a component to state changes from other components.

**Parameters:**
- `componentId`: Unique identifier for this component instance
- `callback`: Function called when state changes (excluding self-triggered changes)

**Behavior:**
- Filters out updates originating from the same `componentId`
- Only triggers callback for changes from other components
- Provides the latest state to the callback

### publishUpdate(componentId, operationType, payload)

Publishes a state change to the UDC system.

**Parameters:**
- `componentId`: Identifier of the component making the change
- `operationType`: Type of operation (e.g., UPDATE_WIDGET_CONFIG)
- `payload`: Data to update in the state

**Behavior:**
- Updates the central state
- Broadcasts change to all subscribers except the originator
- Maintains operation history for debugging

## Utility Functions for Data Access

### getWidgetContent(state, widgetId, slotName)

Safely extracts widget content from the UDC state.

```javascript
export const getWidgetContent = (state, widgetId, slotName) => {
    if (!state || !widgetId || !slotName) {
        return { content: null, widget: null };
    }

    const version = state.versions[state.metadata.currentVersionId];
    if (!version) {
        return { content: null, widget: null };
    }

    const widgets = version.widgets[slotName];
    const widget = widgets?.find(w => w.id === widgetId);
    const content = widget?.config?.content;

    return { content, widget };
};
```

### hasWidgetContentChanged(currentContent, newContent)

Determines if widget content has actually changed to prevent unnecessary updates.

```javascript
export const hasWidgetContentChanged = (currentContent, newContent) => {
    return !isEqual(currentContent, newContent);
};
```

## Synchronization Scenarios

### Scenario 1: User Edits in ContentWidget

1. User types in ContentWidget editor
2. `handleContentChange` is called
3. ContentWidget updates its local state
4. ContentWidget calls `publishUpdate(componentId, ...)`
5. UDC updates central state
6. UDC broadcasts to all subscribers except ContentWidget (filtered by componentId)
7. HtmlSourceField receives update via `useExternalChanges`
8. HtmlSourceField updates its local state to match

### Scenario 2: User Edits in HtmlSourceField

1. User edits HTML in HtmlSourceField
2. `handleChange` is called
3. HtmlSourceField updates its local state
4. HtmlSourceField calls `publishUpdate(fieldId, ...)`
5. UDC updates central state
6. UDC broadcasts to all subscribers except HtmlSourceField (filtered by fieldId)
7. ContentWidget receives update via `useExternalChanges`
8. ContentWidget updates its local state to match

### Scenario 3: External API Update

1. External system updates widget data
2. UDC receives update (no component ID filter needed)
3. Both ContentWidget and HtmlSourceField receive updates
4. Both components update their local state

## Best Practices

### 1. Always Use Unique Component IDs

```javascript
// Good: Unique per widget instance
const componentId = `widget-${widgetId}`;
const fieldId = `field-${widgetId}`;

// Bad: Generic IDs can cause conflicts
const componentId = 'content-widget';
```

### 2. Check for Actual Changes

```javascript
// Good: Only update if content actually changed
if (hasWidgetContentChanged(currentContent, newContent)) {
    setCurrentValue(newContent);
}

// Bad: Always updating can cause performance issues
setCurrentValue(newContent);
```

### 3. Handle Null/Undefined States

```javascript
// Good: Safe access with fallbacks
const { content: newContent } = getWidgetContent(state, widgetId, slotName);
if (newContent !== undefined && newContent !== currentValue) {
    setCurrentValue(newContent);
}
```

### 4. Use Descriptive Component IDs

```javascript
// Good: Clear purpose and scope
const editorId = `content-editor-${widgetId}`;
const previewId = `content-preview-${widgetId}`;
const fieldId = `html-field-${widgetId}`;

// Bad: Unclear or too generic
const id = `comp-${widgetId}`;
```

## Debugging UDC Synchronization

### Enable Debug Logging

The UDC system includes debug logging to help track synchronization:

```javascript
// In DataManager.ts
console.log(`[UDC] Publishing update from ${componentId}:`, operationType, payload);
console.log(`[UDC] Broadcasting to subscribers (excluding ${componentId})`);
```

### Common Issues and Solutions

**Issue**: Components not updating
- **Cause**: Component ID mismatch or incorrect subscription
- **Solution**: Verify componentId consistency between `useExternalChanges` and `publishUpdate`

**Issue**: Infinite update loops
- **Cause**: Component receiving its own updates
- **Solution**: Ensure component ID filtering is working correctly

**Issue**: Stale data
- **Cause**: Not checking for actual content changes
- **Solution**: Use `hasWidgetContentChanged` utility function

## Performance Considerations

### Efficient Change Detection

The UDC system optimizes performance by:

1. **Selective Updates**: Only notifying components that need updates
2. **Change Detection**: Using deep equality checks to prevent unnecessary renders
3. **Batching**: Grouping multiple updates when possible
4. **Memory Management**: Cleaning up subscriptions when components unmount

### Memory Cleanup

```javascript
useEffect(() => {
    // Subscription is automatically cleaned up when component unmounts
    return () => {
        // UDC handles cleanup internally
    };
}, []);
```

## Conclusion

The Unified Data Context provides a robust foundation for component synchronization by:

- Preventing race conditions through component ID filtering
- Maintaining data consistency across multiple editing interfaces
- Providing utility functions for safe data access
- Enabling efficient change detection and updates

This architecture allows complex applications like the eceee_v4 CMS to have multiple components editing the same data simultaneously without conflicts or data loss.
