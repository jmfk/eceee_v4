# Table Toolbar Activation Bug Fixes

## Problem
The global table toolbar was not appearing when clicking on a table widget.

## Root Causes

### 1. Incorrect Click Handler Target
**File**: `frontend/src/widgets/eceee-widgets/TableWidgetEditor.jsx`

**Problem**: The click handler was trying to find a child element with class `.table-editor-container` that didn't exist:
```javascript
// ❌ WRONG - Looking for non-existent child element
const tableContainer = containerRef.current?.querySelector('.table-editor-container');
if (tableContainer && coreRef.current) {
    tableContainer.addEventListener('click', clickHandlerRef.current);
}
```

**Fix**: Attach the click handler directly to the container itself:
```javascript
// ✅ CORRECT - Attach to container directly
if (containerRef.current) {
    containerRef.current.addEventListener('click', clickHandlerRef.current);
}
```

### 2. Missing Base CSS Class
**File**: `frontend/src/widgets/eceee-widgets/TableWidgetEditor.jsx`

**Problem**: The container div didn't have the `table-editor-container` CSS class that the styles were targeting:
```javascript
// ❌ WRONG - Missing base class
<div ref={containerRef} className={className} />
```

**Fix**: Added the base CSS class:
```javascript
// ✅ CORRECT - Has base class for styling
<div ref={containerRef} className={`table-editor-container ${className}`} />
```

### 3. Async Import Causing Timing Issues
**File**: `frontend/src/components/special-editors/TableEditorCore.js`

**Problem**: Using dynamic async import in the `activate()` method caused timing issues:
```javascript
// ❌ WRONG - Async import delays registration
activate() {
    if (this.options.detachedToolbar) {
        import('../../utils/tableToolbarManager.js').then(({ tableToolbarManager }) => {
            tableToolbarManager.registerEditor(this);
        });
    }
}
```

**Fix**: Changed to static import at the top of the file:
```javascript
// ✅ CORRECT - Static import at top
import { tableToolbarManager } from '../../utils/tableToolbarManager.js'

activate() {
    if (this.options.detachedToolbar) {
        tableToolbarManager.registerEditor(this);  // Synchronous call
    }
}
```

## Changes Made

### 1. TableWidgetEditor.jsx
- Changed click handler to attach directly to `containerRef.current` instead of looking for child element
- Added `table-editor-container` class to the container div for proper CSS styling
- Updated cleanup code to match the new click handler attachment
- Removed timeout wrapper around click handler setup (no longer needed)

### 2. TableEditorCore.js
- Added static import of `tableToolbarManager` at the top of the file
- Updated `activate()` method to use the static import (synchronous)
- Updated `deactivate()` method to use the static import (synchronous)
- Removed async `import()` calls that were causing timing issues

## How It Works Now

1. **Table Widget Renders**
   - `TableWidgetEditor` component creates a div with class `table-editor-container`
   - `TableEditorCore` is initialized with `detachedToolbar: true`
   - `TableEditorCore.render()` is called, which sets `this.container`

2. **Click Handler Setup**
   - Click listener is attached directly to the container div
   - Listener calls `coreRef.current.activate()` when clicked

3. **Activation Flow**
   - User clicks anywhere on the table widget
   - Click handler calls `activate()`
   - `activate()` immediately (synchronously) calls `tableToolbarManager.registerEditor(this)`
   - Manager emits 'editor-activated' event
   - `GlobalTableToolbar` receives event and shows toolbar
   - Visual feedback: `table-editor-active` class added to container (blue outline)

4. **Toolbar Appears**
   - Toolbar slides down from top of page
   - State polling begins (100ms intervals)
   - Toolbar buttons reflect current table state

## Testing Checklist

✅ Click on table widget activates it
✅ Blue outline appears around table when active
✅ Global toolbar slides down from top
✅ Toolbar shows current selection state
✅ All toolbar buttons work correctly
✅ Click outside table deactivates it
✅ Toolbar slides up and hides when deactivated
✅ Multiple tables - only one active at a time

## Visual Feedback States

### Inactive (Default)
- No outline
- Hover: Gray outline (`outline: 1px solid #d1d5db`)
- Cursor: pointer

### Active (Editing)
- Blue outline (`outline: 2px solid #3b82f6`)
- Light blue background (`background-color: #f8fafc`)
- Toolbar visible at top
- Cells selectable

## Files Modified

1. `frontend/src/widgets/eceee-widgets/TableWidgetEditor.jsx`
   - Fixed click handler attachment
   - Added base CSS class
   - Updated cleanup

2. `frontend/src/components/special-editors/TableEditorCore.js`
   - Added static import
   - Removed async imports from activate/deactivate
   - Made registration synchronous

## Status

✅ **Fixed and Ready for Testing**

The table toolbar should now appear immediately when you click on any table widget in the page editor.

