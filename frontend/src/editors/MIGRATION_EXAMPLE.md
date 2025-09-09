# Migration Example: Old Shared Framework → New Hybrid System

This document shows how to migrate from the old shared framework approach to the new hybrid system with separated editor frameworks.

## Before: Old Shared Framework

### Old PageEditor Implementation

```jsx
// OLD: PageEditor.jsx
import React from 'react'
import { WidgetFactory } from '../components/widgets'  // ❌ Shared framework
import { useWidgets } from '../hooks/useWidgets'
import { useWidgetEventListener } from '../contexts/WidgetEventContext'

const PageEditor = () => {
    const { widgets, addWidget, updateWidget, deleteWidget } = useWidgets()
    
    // ❌ Mixed concerns: PageEditor logic + shared framework
    const renderWidget = (widget, slotName, index) => (
        <WidgetFactory
            widget={widget}
            slotName={slotName}
            index={index}
            onEdit={handleEditWidget}
            onDelete={handleDeleteWidget}
            onMoveUp={handleMoveWidgetUp}
            onMoveDown={handleMoveWidgetDown}
            mode="editor"
            showControls={true}
            // ❌ PageEditor-specific props mixed with shared framework
            layoutRenderer={layoutRenderer}
            versionId={versionId}
            isPublished={isPublished}
        />
    )
    
    // ❌ Shared event listener - no editor-specific context
    useWidgetEventListener('widget:changed', (payload) => {
        // Handle widget changes...
        // ❌ No version filtering, no publishing context
    })
    
    return (
        <div>
            {slots.map(slot => (
                <div key={slot.name}>
                    {widgets[slot.name]?.map((widget, index) => 
                        renderWidget(widget, slot.name, index)
                    )}
                </div>
            ))}
        </div>
    )
}
```

### Old ObjectContentEditor Implementation

```jsx
// OLD: ObjectContentEditor.jsx  
import React from 'react'
import { WidgetFactory } from '../components/widgets'  // ❌ Same shared framework
import { useWidgets } from '../hooks/useWidgets'
import { useWidgetEventListener } from '../contexts/WidgetEventContext'

const ObjectContentEditor = ({ objectType, widgets, onWidgetChange }) => {
    // ❌ Same shared framework with different requirements
    const renderWidget = (widget, slotName, index) => (
        <WidgetFactory
            widget={widget}
            slotName={slotName}
            index={index}
            onEdit={handleEditWidget}
            onDelete={handleDeleteWidget}
            mode="editor"
            showControls={true}
            // ❌ ObjectEditor needs different props but uses same component
            objectType={objectType}
            slotConfig={slotConfig}
        />
    )
    
    // ❌ Same event listener - no object-specific context
    useWidgetEventListener('widget:changed', (payload) => {
        // Handle widget changes...
        // ❌ No slot validation, no object type context
    })
    
    return (
        <div>
            {objectType.slots?.map(slot => (
                <div key={slot.name}>
                    {widgets[slot.name]?.map((widget, index) => 
                        renderWidget(widget, slot.name, index)
                    )}
                </div>
            ))}
        </div>
    )
}
```

### Problems with Old Approach

❌ **Single shared WidgetFactory** trying to handle both use cases
❌ **Mixed concerns** - PageEditor and ObjectEditor logic in same component
❌ **Prop pollution** - Irrelevant props passed to components
❌ **Event system conflicts** - No editor-specific context
❌ **Brittle coupling** - Changes to one editor break the other
❌ **Complex conditional logic** - `if (mode === 'page') ... else if (mode === 'object')`

## After: New Hybrid System

### New PageEditor Implementation

```jsx
// NEW: PageEditor.jsx
import React from 'react'
import { PageWidgetFactory, createPageEditorEventSystem } from '../editors/page-editor'  // ✅ PageEditor framework
import { useWidgetEvents } from '../contexts/WidgetEventContext'

const PageEditor = () => {
    // ✅ PageEditor-specific event system
    const pageEventSystem = createPageEditorEventSystem(useWidgetEvents())
    
    // ✅ Clean separation - only PageEditor logic here
    const renderWidget = (widget, slotName, index) => (
        <PageWidgetFactory
            widget={widget}
            slotName={slotName}
            index={index}
            onEdit={handleEditWidget}
            onDelete={handleDeleteWidget}
            onMoveUp={handleMoveWidgetUp}
            onMoveDown={handleMoveWidgetDown}
            mode="editor"
            showControls={true}
            // ✅ PageEditor-specific props only
            layoutRenderer={layoutRenderer}
            versionId={versionId}
            isPublished={isPublished}
            onVersionChange={handleVersionChange}
            onPublishingAction={handlePublishingAction}
        />
    )
    
    // ✅ PageEditor-specific event handling with version filtering
    pageEventSystem.onWidgetChanged((payload) => {
        // Only handle changes for current version
        if (payload.versionId === currentVersionId) {
            updateLayoutRenderer(payload)
        }
    }, currentVersionId)
    
    pageEventSystem.onVersionPublished((payload) => {
        // Handle publishing events
        showPublishedNotification(payload)
    })
    
    return (
        <div>
            {slots.map(slot => (
                <div key={slot.name}>
                    {widgets[slot.name]?.map((widget, index) => 
                        renderWidget(widget, slot.name, index)
                    )}
                </div>
            ))}
        </div>
    )
}
```

### New ObjectContentEditor Implementation

```jsx
// NEW: ObjectContentEditor.jsx
import React from 'react'
import { ObjectWidgetFactory, createObjectEditorEventSystem } from '../editors/object-editor'  // ✅ ObjectEditor framework

const ObjectContentEditor = ({ objectType, widgets, onWidgetChange }) => {
    // ✅ ObjectEditor-specific event system
    const objectEventSystem = createObjectEditorEventSystem(useWidgetEvents())
    
    // ✅ Clean separation - only ObjectEditor logic here
    const renderWidget = (widget, slotName, index) => (
        <ObjectWidgetFactory
            widget={widget}
            slotName={slotName}
            index={index}
            onEdit={handleEditWidget}
            onDelete={handleDeleteWidget}
            onMoveUp={handleMoveWidgetUp}
            onMoveDown={handleMoveWidgetDown}
            mode="editor"
            showControls={true}
            // ✅ ObjectEditor-specific props only
            objectType={objectType}
            slotConfig={getSlotConfig(slotName)}
            onSlotAction={handleSlotAction}
            allowedWidgetTypes={getAllowedWidgetTypes(slotName)}
            maxWidgets={getMaxWidgets(slotName)}
        />
    )
    
    // ✅ ObjectEditor-specific event handling with slot filtering
    objectEventSystem.onWidgetChanged((payload) => {
        // Validate slot constraints
        validateSlotConstraints(payload.slotName, payload.widget)
        updateWidgetState(payload)
    })
    
    objectEventSystem.onSlotConstraintViolated((payload) => {
        // Handle slot validation errors
        showSlotError(payload)
    })
    
    return (
        <div>
            {objectType.slots?.map(slot => (
                <div key={slot.name}>
                    {widgets[slot.name]?.map((widget, index) => 
                        renderWidget(widget, slot.name, index)
                    )}
                </div>
            ))}
        </div>
    )
}
```

### Benefits of New Approach

✅ **Separated frameworks** - PageWidgetFactory vs ObjectWidgetFactory
✅ **Clean concerns** - Each editor handles only its own logic
✅ **Relevant props** - Only necessary props passed to each component
✅ **Specialized events** - Editor-specific event systems with context
✅ **Independent evolution** - Change one editor without affecting the other
✅ **No conditional logic** - Each factory handles its own use case

## Core Widget Usage (Unchanged)

The core widgets themselves remain the same and can be used directly:

```jsx
// ✅ Direct usage still works the same way
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

## Migration Steps

### 1. Update Imports

**Before:**
```jsx
import { WidgetFactory } from '../components/widgets'
```

**After:**
```jsx
// For PageEditor
import { PageWidgetFactory } from '../editors/page-editor'

// For ObjectEditor
import { ObjectWidgetFactory } from '../editors/object-editor'
```

### 2. Replace WidgetFactory Usage

**Before:**
```jsx
<WidgetFactory
    widget={widget}
    // ... shared props
    layoutRenderer={layoutRenderer}  // ❌ Mixed concerns
    objectType={objectType}          // ❌ Mixed concerns
/>
```

**After (PageEditor):**
```jsx
<PageWidgetFactory
    widget={widget}
    // ... shared props
    layoutRenderer={layoutRenderer}     // ✅ PageEditor-specific
    versionId={versionId}              // ✅ PageEditor-specific
    isPublished={isPublished}          // ✅ PageEditor-specific
/>
```

**After (ObjectEditor):**
```jsx
<ObjectWidgetFactory
    widget={widget}
    // ... shared props
    objectType={objectType}            // ✅ ObjectEditor-specific
    slotConfig={slotConfig}           // ✅ ObjectEditor-specific
    onSlotAction={handleSlotAction}   // ✅ ObjectEditor-specific
/>
```

### 3. Update Event Systems

**Before:**
```jsx
import { useWidgetEventListener } from '../contexts/WidgetEventContext'

useWidgetEventListener('widget:changed', callback)
```

**After (PageEditor):**
```jsx
import { createPageEditorEventSystem } from '../editors/page-editor'

const eventSystem = createPageEditorEventSystem(baseEventSystem)
eventSystem.onWidgetChanged(callback, versionFilter)
eventSystem.onVersionPublished(callback)
```

**After (ObjectEditor):**
```jsx
import { createObjectEditorEventSystem } from '../editors/object-editor'

const eventSystem = createObjectEditorEventSystem(baseEventSystem)
eventSystem.onWidgetChanged(callback, slotFilter)
eventSystem.onSlotConstraintViolated(callback)
```

## Testing the Migration

### 1. Verify Widget Rendering
- Widgets should render identically in both editors
- All widget types should be available
- Widget configurations should work the same

### 2. Test Editor-Specific Features
- **PageEditor**: Version management, publishing, layout integration
- **ObjectEditor**: Slot validation, object constraints, bulk operations

### 3. Check Event Handling
- Events should be properly filtered by editor context
- No cross-contamination between editors
- Editor-specific events should work correctly

### 4. Performance Testing
- No performance regression
- Memory usage should be similar or better
- Bundle size impact should be minimal

## Rollback Plan

If issues arise, you can temporarily fall back to the old system:

1. Keep old `components/widgets/WidgetFactory.jsx` as backup
2. Use feature flags to switch between old and new systems
3. Gradually migrate one editor at a time
4. Monitor for regressions and fix incrementally

The hybrid approach provides a clear migration path with the ability to rollback if needed.
