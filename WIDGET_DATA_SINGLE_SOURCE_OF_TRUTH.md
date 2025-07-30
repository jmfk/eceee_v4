# Widget Data Architecture: Single Source of Truth

## Problem Statement

Previously, widget data existed in multiple places simultaneously:

1. **LayoutRenderer.savedWidgetData** (Map) - Internal widget storage
2. **DOM elements** - Rendered widget representations  
3. **pageData.widgets** - API/React state

This created inconsistencies and race conditions when users added/removed widgets.

## Solution: pageData.widgets as Single Source of Truth

### Flow Comparison

#### BEFORE (Multiple Sources)
```
User adds widget → LayoutRenderer creates widget instance → Add to internal Map → Render to DOM → Mark dirty → Save triggers DOM collection → Update pageData.widgets
```

#### AFTER (Single Source)
```
User adds widget → LayoutRenderer creates widget instance → Callback to PageEditor → Update pageData.widgets → ContentEditor re-renders → LayoutRenderer updates from pageData
```

## Implementation Changes

### 1. LayoutRenderer.js Changes

**Added Widget Data Callbacks:**
```javascript
// NEW: Widget data change callbacks for single source of truth
this.widgetDataCallbacks = new Map();

setWidgetDataCallbacks(callbacks = {}) {
  this.widgetDataCallbacks = new Map(Object.entries(callbacks));
}

executeWidgetDataCallback(action, slotName, widgetData, ...args) {
  const callback = this.widgetDataCallbacks.get('widgetDataChanged');
  if (typeof callback === 'function') {
    callback(action, slotName, widgetData, ...args);
  }
}
```

**Updated Widget Actions:**
- `handleWidgetSelection()` - Now calls callback instead of directly adding to slot
- `removeWidgetFromSlot()` - Now calls callback instead of directly removing from DOM  
- `clearSlot()` - Now calls callback instead of directly clearing DOM

### 2. ContentEditor.jsx Changes

**Added Widget Data Callback Handler:**
```javascript
layoutRenderer.setWidgetDataCallbacks({
  widgetDataChanged: (action, slotName, widgetData) => {
    const currentWidgets = pageData.widgets || {};
    let updatedWidgets = { ...currentWidgets };

    switch (action) {
      case 'add':
        if (!updatedWidgets[slotName]) updatedWidgets[slotName] = [];
        updatedWidgets[slotName] = [...updatedWidgets[slotName], widgetData];
        break;
      case 'remove':
        if (updatedWidgets[slotName]) {
          updatedWidgets[slotName] = updatedWidgets[slotName].filter(
            widget => widget.id !== widgetData
          );
        }
        break;
      case 'clear':
        updatedWidgets[slotName] = [];
        break;
      case 'update':
        if (updatedWidgets[slotName]) {
          updatedWidgets[slotName] = updatedWidgets[slotName].map(
            widget => widget.id === widgetData.id ? widgetData : widget
          );
        }
        break;
    }

    // Update pageData through parent component
    onUpdate({ ...pageData, widgets: updatedWidgets });
    
    // Mark as dirty
    if (onDirtyChange) {
      onDirtyChange(true, `widget ${action} in slot ${slotName}`);
    }
  }
});
```

**Updated saveWidgets Method:**
```javascript
// OLD: Collected from DOM via LayoutRenderer
const savedWidgetData = layoutRenderer.saveCurrentWidgetState();

// NEW: Uses pageData.widgets directly
const saveWidgets = useCallback((options = {}) => {
  return pageData.widgets || {};
}, [pageData?.widgets]);
```

### 3. PageEditor.jsx Changes

**No changes needed!** The existing `updatePageData` function already handles the updates:

```javascript
// Handle page data updates
const updatePageData = (updates) => {
  setPageData(prev => ({ ...prev, ...updates }))
  setIsDirty(true)
}
```

## Benefits

### 1. **Data Consistency**
- Only one source of truth: `pageData.widgets`
- No synchronization issues between different data stores
- Predictable data flow

### 2. **Performance**
- No DOM querying/parsing to extract widget configs
- No complex data collection from rendered elements
- Faster save operations

### 3. **Reliability**
- Eliminates race conditions during widget creation/deletion
- React's state management ensures consistent re-renders
- Proper error boundaries and state validation

### 4. **Developer Experience**
- Clearer data flow: User Action → State Update → UI Update
- Easier debugging with React DevTools
- Simplified testing (state-based instead of DOM-based)

### 5. **Future Extensibility**
- Easy to add undo/redo functionality
- Simplified collaboration features
- Better integration with form validation

## Migration Path

The changes are **backward compatible**:

1. **Existing code** continues to work with deprecated methods
2. **New widget operations** use the callback system automatically
3. **Gradual migration** can happen over time
4. **Legacy DOM collection** still works as fallback

## Testing Checklist

- [ ] Add new widget to slot
- [ ] Remove widget from slot  
- [ ] Clear entire slot
- [ ] Save page with widgets
- [ ] Load page with existing widgets
- [ ] Undo/redo operations (future)
- [ ] Multiple users editing (future)

## Backward Compatibility

The following methods are deprecated but still functional:
- `LayoutRenderer.saveCurrentWidgetState()` - still collects from DOM
- `LayoutRenderer.collectAllWidgetData()` - still parses DOM elements

New implementations should use `pageData.widgets` directly through the ContentEditor's `saveWidgets()` method. 