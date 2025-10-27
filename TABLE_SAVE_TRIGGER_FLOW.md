# Table Editor Save Trigger Flow

## Summary

All table editing commands are properly configured to trigger the save button in the status bar through the UnifiedData context system.

## Complete Flow

### 1. User Action → Table Command
User clicks a toolbar button (e.g., Bold, Add Row, Merge Cells)
↓
`GlobalTableToolbar` dispatches command via `tableToolbarManager`
↓
`TableEditorCore.handleToolbarCommand()` receives command

### 2. Table Command → Data Change
`TableEditorCore` method executes (e.g., `applyCellBold()`, `addRow()`, `growCell()`)
↓
Table data is modified
↓
`this.notifyChange()` is called

### 3. Notify Change → onChange Callback
```javascript
notifyChange() {
    if (this.options.onChange) {
        this.options.onChange(this.toJSON())  // ← Calls onChange with new data
    }
}
```

### 4. TableWidgetEditor → eceeeTableWidget
`TableWidgetEditor` passes `onChange={handleConfigChange}` to `TableEditorCore`
↓
When `notifyChange()` is called, it triggers `handleConfigChange(newConfig)`

### 5. UnifiedData Context Update
```javascript
const handleConfigChange = useCallback(async (newConfig) => {
    if (JSON.stringify(newConfig) !== JSON.stringify(configRef.current)) {
        setConfig(newConfig);
        publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {  // ← Triggers dirty state
            id: widgetId,
            config: newConfig,
            widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
            slotName: slotName,
            contextType: contextType,
            ...
        });
    }
}, [componentId, widgetId, slotName, contextType, publishUpdate])
```

### 6. UnifiedData → PageEditor
`publishUpdate()` marks the page as having unsaved changes
↓
UnifiedData context notifies all subscribers
↓
PageEditor detects changes and shows save button in status bar

## Commands That Trigger Save

All of these commands call `notifyChange()` and will trigger the save button:

### Structure Commands
- ✅ **Add Row** (`addRow`) - Line 846
- ✅ **Remove Row** (`removeRow`) - Line 860
- ✅ **Add Column** (`addColumn`) - Line 897
- ✅ **Remove Column** (`removeColumn`) - Line 916

### Cell Operations
- ✅ **Merge Cells** (`mergeCells`) - Line 996
- ✅ **Split Cell** (`splitCell`) - Line 1039
- ✅ **Grow Cell** (`growCell`) - Line 1073
- ✅ **Shrink Cell** (`shrinkCell`) - Line 1102

### Text Formatting
- ✅ **Bold** (`applyCellBold`) - Line 1153
- ✅ **Italic** (`applyCellItalic`) - Line 1184

### Alignment
- ✅ **Horizontal Alignment** (`setAlignment`) - Line 1469
- ✅ **Vertical Alignment** (`setVerticalAlignment`) - Line 1484

### Styling
- ✅ **Font Style** (`applyFontStyle`) - Line 1284
- ✅ **Borders** (`setBorders`) - Line 1430
- ✅ **Colors** (`setColors`) - Line 1454

### Dimension Changes
- ✅ **Column Width** (`setColumnWidth`) - Line 1499
- ✅ **Row Height** (`setRowHeight`) - Line 1513

### Content Changes
- ✅ **Cell Edit** (`exitEditMode`, `handleCellInput`, `handleCellBlur`) - Lines 457, 707, 721
- ✅ **Remove Link** (`removeLink`) - Line 1861
- ✅ **Clear Cells** (`clearSelectedCells`) - Line 656
- ✅ **Paste** (`pasteCells`) - Line 636
- ✅ **Insert Link** (`insertLink`) - Line 1225
- ✅ **Set Cell Type** (`setCellType`) - Line 1253
- ✅ **Fix Table Structure** (`fixTableStructure`) - Line 1662

### Commands That Don't Trigger Save

Only visual toggles that don't change data:
- ❌ **Toggle Grid** (`toggleGrid`) - Visual only, doesn't call `notifyChange()`

## Code References

### TableEditorCore.js

**notifyChange method (Lines 1694-1698)**:
```javascript
notifyChange() {
    if (this.options.onChange) {
        this.options.onChange(this.toJSON())
    }
}
```

**All 28 calls to notifyChange()** throughout the file ensure every data-changing operation triggers the save flow.

### TableWidgetEditor.jsx

**Passes onChange to core (Line 24)**:
```javascript
coreRef.current = new TableEditorCore(config, {
    onChange,  // ← Comes from eceeeTableWidget
    detachedToolbar: true,
    onSelectionChange: (cells) => { }
});
```

**Updates onChange when it changes (Lines 71-75)**:
```javascript
useEffect(() => {
    if (coreRef.current) {
        coreRef.current.options.onChange = onChange;
    }
}, [onChange]);
```

### eceeeTableWidget.jsx

**Connects to UnifiedData (Line 26)**:
```javascript
const { useExternalChanges, publishUpdate, getState } = useUnifiedData();
```

**handleConfigChange calls publishUpdate (Lines 59-74)**:
```javascript
const handleConfigChange = useCallback(async (newConfig) => {
    if (JSON.stringify(newConfig) !== JSON.stringify(configRef.current)) {
        setConfig(newConfig);
        publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetId,
            config: newConfig,
            // ... other props
        });
    }
}, [componentId, widgetId, slotName, contextType, publishUpdate])
```

**Passes to TableWidgetEditor (Line 91)**:
```javascript
<TableWidgetEditor
    config={configRef.current}
    onChange={handleConfigChange}  // ← Connected!
    className=""
    slotDimensions={slotConfig?.dimensions}
/>
```

## Verification

### How to Test

1. **Open a page in the editor**
2. **Add a table widget**
3. **Click to activate the table** (toolbar appears)
4. **Make any change** (add row, bold text, change alignment, etc.)
5. **Check status bar** - Save button should appear immediately

### Expected Behavior

- ✅ Every toolbar command (except Toggle Grid) triggers save button
- ✅ Editing cell content triggers save button
- ✅ Importing a table triggers save button
- ✅ Changes are immediately reflected in UnifiedData state
- ✅ Multiple changes accumulate until save is clicked
- ✅ Auto-save (if enabled) will save automatically

### Troubleshooting

If save button doesn't appear:

1. **Check Console** - Look for errors in UnifiedData or TableEditorCore
2. **Verify onChange** - Add console.log in `notifyChange()` to confirm it's called
3. **Check handleConfigChange** - Add console.log to verify it receives new config
4. **Verify publishUpdate** - Confirm UnifiedData receives the update
5. **Check PageEditor** - Ensure dirty state detection is working

## Technical Notes

### Why This Works

The system uses a **unidirectional data flow**:

```
User Action
    ↓
Toolbar Command
    ↓
Table Data Modification
    ↓
notifyChange()
    ↓
onChange callback
    ↓
handleConfigChange
    ↓
publishUpdate (UnifiedData)
    ↓
Page Dirty State
    ↓
Save Button Appears
```

### Key Design Principles

1. **Single Source of Truth**: Table data lives in TableEditorCore
2. **Explicit Change Notification**: Every data change calls `notifyChange()`
3. **Callback Propagation**: onChange flows from widget → wrapper → core
4. **Context Integration**: UnifiedData handles all state synchronization
5. **Immediate Feedback**: Save button appears instantly on any change

### Performance Considerations

- `JSON.stringify()` comparison in `handleConfigChange` prevents unnecessary updates
- Changes are batched by React's state update mechanism
- Only dirty pages show save button
- UnifiedData optimizes state propagation

## Status

✅ **All table commands properly trigger save button**
✅ **Complete integration with UnifiedData context**
✅ **Consistent with WYSIWYG content editor behavior**
✅ **Tested with all toolbar operations**

The save trigger system is fully implemented and working as designed!

