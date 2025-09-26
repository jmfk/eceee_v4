# ODC Migration Best Practices Guide

This guide provides step-by-step instructions for migrating components from older state management patterns to the Unified Data Context (ODC) system.

## Understanding ODC Philosophy

**ODC is NOT traditional props delegation.** Instead, ODC is a sophisticated data synchronization facility that allows components to manage their own data and rendering lifecycle while staying synchronized with a centralized truth.

### ODC Solves Four Key Problems:

1. **Storing the truth of the data** - Single source of truth for application state
2. **Synchronizing data between parts** - Components stay in sync without tight coupling (real-time) 
3. **Saving data to servers** - Centralized persistence with smart save strategies
4. **Preventing unnecessary re-renders** - ComponentId-based update locking prevents sender components from re-rendering on their own updates

### Key Principle: Components Own Their Rendering
Each component maintains its own local state for immediate UI responsiveness, while ODC ensures all components eventually converge to the same truth. This prevents the cascading re-render problems of traditional prop drilling while maintaining data consistency.

## Core ODC Patterns

### 1. Import Required ODC Dependencies

```javascript
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../contexts/unified-data/types/operations'
import { useEditorContext } from '../contexts/unified-data/hooks'
```

### 2. Component Initialization Pattern

**OLD Pattern:**
```javascript
const [localData, setLocalData] = useState(initialData)
```

**NEW ODC Pattern:**
```javascript
const { useExternalChanges, publishUpdate, getState } = useUnifiedData()
const componentId = useMemo(() => `component-name-${id || 'new'}`, [id])
const contextType = useEditorContext() // 'page' or 'object'
```

### 3. Data Initialization Pattern

**For Page Editors:**
```javascript
// Initialize webpage data
publishUpdate(componentId, OperationTypes.INIT_PAGE, {
    id: webpage.id,
    data: webpage
});

// Initialize version data  
publishUpdate(componentId, OperationTypes.INIT_VERSION, {
    id: version.id,
    data: version
});
```

**For Object Editors:**
```javascript
publishUpdate(componentId, OperationTypes.INIT_OBJECT, {
    id: String(instance.id),
    data: {
        ...instance,
        id: String(instance.id),
        type: instance?.objectType?.name || 'unknown',
        status: instance?.status || 'draft',
        metadata: instance?.metadata || {},
        currentVersionId: currentVersionId,
        availableVersions: versionIds
    }
});
```

### 4. External Changes Subscription Pattern

**OLD Pattern:**
```javascript
useEffect(() => {
    // Manual event listeners or polling
}, [dependencies])
```

**NEW ODC Pattern:**
```javascript
useExternalChanges(componentId, state => {
    // Handle external state changes
    const newData = extractRelevantData(state)
    if (hasDataChanged(currentData, newData)) {
        setLocalData(newData)
    }
});
```

### 5. Data Update Pattern

**OLD Pattern:**
```javascript
const handleChange = (newValue) => {
    setLocalData(newValue)
    onUpdate?.(newValue)
}
```

**NEW ODC Pattern:**
```javascript
const handleChange = async (newValue) => {
    setLocalData(newValue)
    
    await publishUpdate(componentId, OperationTypes.UPDATE_WEBPAGE_DATA, {
        id: dataId,
        updates: { fieldName: newValue }
    });
}
```

### 6. Widget-Specific Patterns

**For Widget Config Updates:**
```javascript
const handleWidgetConfigChange = async (newConfig) => {
    await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
        id: widgetId,
        slotName: slotName,
        contextType: contextType,
        config: newConfig
    });
}
```

**For Widget Content Updates (like HtmlSourceField):**
```javascript
// Initialize from ODC state
useEffect(() => {
    if (!widgetId || !slotName) return;
    
    const currentState = getState();
    const { content: udcContent } = getWidgetContent(currentState, widgetId, slotName, contextType);
    if (udcContent !== undefined && udcContent !== value) {
        setCurrentValue(udcContent);
    }
}, []);

// Subscribe to external changes
useExternalChanges(fieldId, state => {
    const { content: newContent } = getWidgetContent(state, widgetId, slotName, contextType);
    if (hasWidgetContentChanged(currentValue, newContent)) {
        setCurrentValue(newContent);
    }
});
```

## Migration Steps

### Step 1: Identify Component Type
```bash
# Determine what type of component you're migrating
grep -r "useState\|useEffect" src/components/YourComponent.jsx
```

### Step 2: Add ODC Dependencies
```bash
# Add required imports to your component
echo "Add these imports to your component:
- useUnifiedData hook
- OperationTypes enum  
- useEditorContext hook (if widget-related)"
```

### Step 3: Replace State Initialization
```bash
# Find local state that should be managed by ODC
grep -n "useState.*=" src/components/YourComponent.jsx
```

**Prompt:** Replace `useState` declarations for data that needs to be shared across components with ODC patterns. **Keep local UI state (like `isModalOpen`) as `useState`.** Remember: ODC synchronizes data truth, but components still own their rendering and local UI state.

### Step 4: Add Component ID and Context
```bash
# Add stable component identifier
echo "Add componentId using useMemo with a descriptive name and ID"
```

**Prompt:** Add `const componentId = useMemo(() => 'component-name-${id}', [id])` and `const contextType = useEditorContext()` if working with widgets.

### Step 5: Replace Data Updates
```bash
# Find all state update calls
grep -n "set[A-Z]" src/components/YourComponent.jsx
```

**Prompt:** Replace direct state updates with ODC `publishUpdate` calls using appropriate `OperationTypes`. **Keep local state updates for immediate UI feedback.** The component should update its own local state immediately, then notify ODC of the change. This ensures responsive UI while maintaining data synchronization.

### Step 6: Add External Changes Subscription  
**Prompt:** Add `useExternalChanges(componentId, callback)` to listen for external state changes and update local state accordingly.

### Step 7: Handle Form Data Synchronization
```bash
# For form components, add validation-driven sync
echo "Add handleValidatedDataSync pattern for form validation"
```

**Prompt:** For form components, implement validation-driven sync pattern like `handleValidatedPageDataSync` in PageEditor.

### Step 8: Test Migration
```bash
# Test the migrated component
npm run test -- --testNamePattern="YourComponent"
```

## Common Patterns by Component Type

### Page Editors
- Use `INIT_PAGE` and `INIT_VERSION` for initialization
- Use `UPDATE_WEBPAGE_DATA` and `UPDATE_PAGE_VERSION_DATA` for updates
- Implement validation-driven sync for form data

### Object Editors  
- Use `INIT_OBJECT` for initialization
- Use `UPDATE_OBJECT_DATA` for updates
- Handle widget changes with `UPDATE_WIDGET_CONFIG`

### Widget Components
- Use `getWidgetContent` utility for content extraction
- Subscribe to widget-specific state changes
- Use `UPDATE_WIDGET_CONFIG` for configuration updates

### Form Components
- **Maintain local state for immediate UI feedback** - Forms should be responsive to user input
- **Use ODC for data that needs to be shared** - Only sync validated/confirmed data to ODC
- **Implement debounced updates to ODC** - Avoid flooding ODC with every keystroke
- **Remember**: The form owns its rendering, ODC owns the data truth

## Validation Checklist

- [ ] Component has stable `componentId` using `useMemo`
- [ ] ODC hooks (`useUnifiedData`, `useExternalChanges`) are properly imported
- [ ] Initialization uses appropriate `OperationTypes` (`INIT_PAGE`, `INIT_OBJECT`, etc.)
- [ ] Data updates use `publishUpdate` with correct operation types
- [ ] External changes are handled via `useExternalChanges` callback
- [ ] Local state is preserved for UI-only state (modals, loading, etc.)
- [ ] Widget components use `useEditorContext` and context-aware operations
- [ ] Form validation is integrated with ODC sync patterns

## Migration Commands

### Find Components to Migrate
```bash
# Find components with old state patterns
grep -r "useState.*Data\|useEffect.*setData" frontend/src/components/ --include="*.jsx" --include="*.tsx"
```

### Check ODC Integration Status  
```bash
# Check if component already uses ODC
grep -l "useUnifiedData\|publishUpdate" frontend/src/components/YourComponent.jsx
```

### Verify Context Usage
```bash
# Check if widget components use editor context
grep -l "useEditorContext\|contextType" frontend/src/components/widgets/
```

## Pure ODC Implementation (Recommended)

### Avoid Legacy Callback Props
**CRITICAL**: Remove these legacy props from component interfaces:
- `onRealTimeUpdate` - Replace with direct ODC integration
- `emitWidgetChanged` - Replace with `publishUpdate` calls
- `onConfigChange` - Use ODC `publishUpdate` directly

### Pure ODC Widget Editor Pattern
```javascript
// WidgetEditorPanel (Pure UI Container)
const WidgetEditorPanel = ({ widgetData, context, onSave, onClose }) => {
    const contextType = widgetData?.context?.contextType || context?.contextType
    
    return (
        <IsolatedFormRenderer
            widgetId={widgetData?.id}
            slotName={widgetData?.slotName}
            contextType={contextType}
            // NO onRealTimeUpdate or emitWidgetChanged props
        />
    )
}

// IsolatedFormRenderer (Direct ODC Integration)
const IsolatedFormRenderer = ({ widgetId, slotName, contextType }) => {
    const { publishUpdate, useExternalChanges } = useUnifiedData()
    
    // Publish changes directly to ODC
    const handleConfigChange = async (newConfig) => {
        await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetId,
            slotName,
            contextType,
            config: newConfig
        })
    }
    
    // Subscribe to external changes
    useExternalChanges(componentId, state => {
        const { widget } = getWidgetContent(state, widgetId, slotName, contextType)
        if (widget?.config) {
            updateLocalFormState(widget.config)
        }
    })
}
```

### Benefits of Pure ODC
- ✅ Single source of truth (no callback confusion)
- ✅ Better debugging (clear ODC flow)
- ✅ Cleaner architecture (separation of concerns)
- ✅ Proper external changes handling
- ✅ No duplicate state management

This guide ensures consistent ODC integration patterns across all components while maintaining performance and reliability.
