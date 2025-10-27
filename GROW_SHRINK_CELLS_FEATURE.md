# Grow/Shrink Cell Feature

## Summary

Added two new buttons to the table toolbar that allow users to incrementally adjust cell spanning (colspan) - making cells grow to span one more column or shrink to span one less column.

## Feature Description

### Grow Cell Button
- **Icon**: ArrowRightFromLine (arrow pointing right from a line)
- **Action**: Increases the cell's colspan by 1
- **Enabled when**: 
  - Exactly one cell is selected
  - Cell is not at the right edge of the table
- **Effect**: Cell expands to cover one more column to the right

### Shrink Cell Button  
- **Icon**: ArrowLeftFromLine (arrow pointing left to a line)
- **Action**: Decreases the cell's colspan by 1
- **Enabled when**:
  - Exactly one cell is selected
  - Cell's colspan is greater than 1
- **Effect**: Cell contracts to span one less column
- **Minimum**: Cell always spans at least 1 column (can't shrink below 1)

## Use Cases

### Quick Table Layout Adjustments
Instead of using Merge Cells (which requires selecting multiple cells), users can:
1. Select a single cell
2. Click Grow to incrementally expand it
3. Click Shrink to incrementally contract it

This is especially useful for:
- Fine-tuning column layouts
- Creating headers that span multiple columns
- Adjusting cell widths without restarting from scratch

### Example Workflow

**Creating a header that spans 3 columns:**
1. Select the header cell (initially spans 1 column)
2. Click Grow → Now spans 2 columns
3. Click Grow → Now spans 3 columns

**Reducing a spanning cell:**
1. Select a cell that spans 3 columns
2. Click Shrink → Now spans 2 columns
3. Click Shrink → Now spans 1 column
4. Shrink button now disabled (can't go below 1)

## Implementation Details

### Files Modified

#### 1. TableToolbarButtons.jsx
**Changes**:
- Added imports for `ArrowRightFromLine` and `ArrowLeftFromLine` icons
- Added two new buttons in the Cell Operations section
- Buttons show between Split and View Options
- Proper disabled states based on `state.canGrow` and `state.canShrink`

**Button Configuration**:
```jsx
<button
    onClick={() => onCommand('growCell')}
    className="p-2 hover:bg-gray-200 rounded"
    title="Grow Cell (span +1)"
    disabled={!state.canGrow}
>
    <ArrowRightFromLine size={16} />
</button>
<button
    onClick={() => onCommand('shrinkCell')}
    className="p-2 hover:bg-gray-200 rounded"
    title="Shrink Cell (span -1)"
    disabled={!state.canShrink}
>
    <ArrowLeftFromLine size={16} />
</button>
```

#### 2. TableEditorCore.js
**New Methods**:

##### `growCell(cell)`
- Increases cell's colspan by 1
- Checks table bounds to prevent growing beyond edge
- Marks the next cell as merged (`_merged = true`)
- Re-renders table and notifies of changes

**Logic**:
```javascript
1. Get current colspan (default 1 if not set)
2. Calculate total table columns
3. Check if growing would exceed table width
4. If valid, increase colspan by 1
5. Mark next cell as merged
6. Re-render and save
```

##### `shrinkCell(cell)`
- Decreases cell's colspan by 1 (minimum 1)
- Unmarks the previously merged cell
- Re-renders table and notifies of changes

**Logic**:
```javascript
1. Get current colspan
2. Check if > 1 (can't shrink below 1)
3. If valid, decrease colspan by 1
4. Unmark the last merged cell (_merged = false)
5. Re-render and save
```

**Command Handlers**:
- Added 'growCell' case in `handleToolbarCommand()`
- Added 'shrinkCell' case in `handleToolbarCommand()`
- Both require exactly one selected cell

**State Management**:
Updated `getToolbarState()` to calculate:
- `canGrow`: True if cell can expand (not at table edge)
- `canShrink`: True if colspan > 1

## Technical Details

### How Growing Works

When a cell grows:
1. Its `colspan` property increases by 1
2. The cell to its right gets marked as `_merged = true`
3. Merged cells don't render (skipped during table rendering)
4. Visual result: Cell appears to span more columns

### How Shrinking Works

When a cell shrinks:
1. Its `colspan` property decreases by 1
2. The previously merged cell to its right gets unmarked (`delete cell._merged`)
3. Unmarked cell renders again
4. Visual result: Cell appears to span fewer columns

### Edge Cases Handled

1. **Growing at table edge**: Button disabled, can't grow beyond table width
2. **Shrinking to minimum**: Button disabled when colspan = 1
3. **No selection**: Both buttons disabled
4. **Multiple cells selected**: Both buttons disabled (requires exactly 1 cell)

### Data Structure Impact

**Before growing** (cell with colspan=1):
```javascript
{
  content: "Header",
  colspan: 1,
  // ... other properties
}
```

**After growing** (cell with colspan=2):
```javascript
{
  content: "Header",
  colspan: 2,
  // ... other properties
}
// Next cell in row:
{
  content: "",
  _merged: true
}
```

## New Toolbar Layout

```
[Import] [+Row] [-Row] [+Col] [-Col] │ 
[Merge] [Split] [Grow→] [←Shrink] │ 
[Grid] │ [B] [I] │ 
[Left][Center][Right] │ [Top][Middle][Bottom] │ 
[Font▼] │ [Border] [Colors]
```

**Cell Operations Section** (4 buttons):
1. Merge Cells (Grid3X3 icon)
2. Split Cell (Split icon)  
3. **Grow Cell** (ArrowRightFromLine icon) - NEW
4. **Shrink Cell** (ArrowLeftFromLine icon) - NEW

## User Benefits

✅ **Incremental Control**: Adjust cell spanning one column at a time
✅ **Faster Workflow**: No need to select multiple cells for simple expansions
✅ **Visual Feedback**: Buttons disabled when action not possible
✅ **Undo-Friendly**: Easy to grow/shrink incrementally without losing content
✅ **Intuitive Icons**: Arrows clearly indicate direction of span change

## Testing Checklist

- [x] Grow button appears in toolbar
- [x] Shrink button appears in toolbar
- [x] Grow button disabled when no cell selected
- [x] Shrink button disabled when no cell selected
- [x] Grow button disabled when cell at right edge
- [x] Shrink button disabled when colspan = 1
- [x] Grow button works - increases colspan
- [x] Shrink button works - decreases colspan
- [x] Growing marks next cell as merged
- [x] Shrinking unmarks previously merged cell
- [x] Can grow multiple times in sequence
- [x] Can shrink multiple times in sequence
- [x] Cell always spans at least 1 column
- [x] State updates correctly after each operation
- [x] Changes persist after save

## Future Enhancements

Possible future additions:
- **Vertical grow/shrink**: Similar buttons for rowspan adjustment
- **Keyboard shortcuts**: Ctrl+Right to grow, Ctrl+Left to shrink
- **Show current span**: Display colspan/rowspan in toolbar when cell selected
- **Grow/shrink by multiple**: Shift+click to grow/shrink by 2 or more

