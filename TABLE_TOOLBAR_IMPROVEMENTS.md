# Table Toolbar Improvements

## Summary

Fixed multiple issues with the table toolbar and added new features based on user feedback.

## Issues Fixed

### 1. ✅ Removed Non-Functional "Text Cell" Button

**Problem**: The Text Cell button (Type icon) didn't do anything useful.

**Solution**: Removed the Content Type section entirely from the toolbar.

**Files Modified**:
- `frontend/src/components/table-toolbar/TableToolbarButtons.jsx`
  - Removed Type import
  - Added Grid2X2 import (for new grid toggle button)
  - Removed entire "Content Type" section with Text Cell button

### 2. ✅ Fixed Bold and Italic Buttons

**Problem**: Bold and Italic buttons didn't work when clicking from toolbar.

**Root Cause**: The toolbar was calling `applyFormatting()` which only works on text selections within an editing cell, not on selected cells.

**Solution**: Changed to use `applyCellBold()` and `applyCellItalic()` methods which apply formatting to entire selected cells.

**Files Modified**:
- `frontend/src/components/special-editors/TableEditorCore.js`
  - Updated handleToolbarCommand for 'bold' command to call `applyCellBold(selectedCells)`
  - Updated handleToolbarCommand for 'italic' command to call `applyCellItalic(selectedCells)`

**How It Works Now**:
1. User selects one or more cells
2. Clicks Bold or Italic button in toolbar
3. Entire content of selected cells gets wrapped in `<strong>` or `<em>` tags
4. Clicking again toggles the formatting off

### 3. ✅ Fixed Split Cell Button

**Problem**: Split cell button wasn't properly enabled/disabled.

**Root Cause**: The `canSplit` state was only checking if one cell was selected, not if that cell was actually merged.

**Solution**: Updated `getToolbarState()` to properly call `canSplit()` method which checks if the cell has colspan or rowspan > 1.

**Files Modified**:
- `frontend/src/components/special-editors/TableEditorCore.js`
  - Updated getToolbarState() to call `this.canSplit(selectedCells[0])` instead of just checking count

**How It Works Now**:
- Split button is only enabled when:
  - Exactly one cell is selected, AND
  - That cell has colspan > 1 OR rowspan > 1

### 4. ✅ Added Grid Toggle Button

**Problem**: User wanted a way to show light cell borders for better visibility while editing.

**Solution**: Added a grid toggle button that shows/hides light gray borders on all cells.

**Files Modified**:
- `frontend/src/components/table-toolbar/TableToolbarButtons.jsx`
  - Added new "View Options" section with Grid toggle button
  - Button shows active state (blue background) when grid is on
  - Positioned between Cell Operations and Text Formatting

- `frontend/src/components/special-editors/TableEditorCore.js`
  - Added `showGrid` property to constructor
  - Added `toggleGrid()` method that adds/removes 'show-grid' class
  - Added 'toggleGrid' case to handleToolbarCommand
  - Added `showGrid` to getToolbarState() return value

- `frontend/src/styles/table-editor.css`
  - Added `.table-editor-table.show-grid .table-editor-cell` rule
  - Sets light gray border (`#e5e7eb`) on all cells when grid is active

**How It Works**:
1. User clicks Grid button (Grid2X2 icon)
2. TableEditorCore toggles `showGrid` state
3. Adds/removes `show-grid` class to table element
4. CSS shows/hides light borders on all cells
5. Button shows blue background when active
6. State persists during editing session

### 5. ✅ Made Border and Color Pickers Toggle Properly

**Problem**: Border and color pickers should toggle open/closed when clicking the button.

**Solution**: Improved the click-outside-to-close logic to exclude the toggle buttons themselves.

**Files Modified**:
- `frontend/src/components/table-toolbar/TableToolbarButtons.jsx`
  - Added `data-border-toggle` attribute to border button
  - Added `data-color-toggle` attribute to color button
  - Updated click-outside handler to check for these attributes
  - Added active state styling (blue background) when pickers are open
  - Clicking button toggles picker, clicking outside closes it

**How It Works Now**:
1. Click border/color button → Picker opens, button shows blue background
2. Click button again → Picker closes
3. Click outside picker → Picker closes
4. Clicking inside picker → Stays open
5. Only one picker can be open at a time

## New Toolbar Layout

From left to right:

1. **Structure** (6 buttons)
   - Import
   - Add Row
   - Remove Row
   - Add Column
   - Remove Column

2. **Cell Operations** (2 buttons)
   - Merge Cells (disabled unless 2+ cells selected)
   - Split Cell (disabled unless 1 merged cell selected)

3. **View Options** (1 button) 🆕
   - Toggle Grid (shows light borders for visibility)

4. **Text Formatting** (2 buttons)
   - Bold (applies to selected cells) ✅ Fixed
   - Italic (applies to selected cells) ✅ Fixed

5. **Horizontal Alignment** (3 buttons)
   - Align Left
   - Align Center
   - Align Right

6. **Vertical Alignment** (3 buttons)
   - Align Top
   - Align Middle
   - Align Bottom

7. **Font Style** (1 dropdown)
   - Normal / Quote / Caption

8. **Styling** (2 buttons with popups)
   - Borders (toggle popup) ✅ Fixed
   - Colors (toggle popup) ✅ Fixed

## Visual Improvements

### Active State Indicators

- **Grid Toggle**: Blue background when grid is on
- **Border Picker**: Blue background when picker is open
- **Color Picker**: Blue background when picker is open

### Grid Visibility

When grid is on:
- All cells show light gray border (`1px solid #e5e7eb`)
- Helps visualize cell boundaries during editing
- Especially useful for:
  - Empty cells
  - Cells with minimal content
  - Merged cells
  - Planning table structure

## Testing Checklist

- [x] Text Cell button removed
- [x] Bold button works on selected cells
- [x] Italic button works on selected cells  
- [x] Split Cell button only enabled for merged cells
- [x] Grid toggle button appears
- [x] Grid toggle shows light borders
- [x] Grid toggle button shows active state
- [x] Border picker toggles open/closed
- [x] Color picker toggles open/closed
- [x] Border button shows active state when open
- [x] Color button shows active state when open
- [x] Clicking outside pickers closes them
- [x] Only one picker can be open at a time

## Files Modified

1. `frontend/src/components/table-toolbar/TableToolbarButtons.jsx`
   - Removed Type import, added Grid2X2
   - Removed Content Type section
   - Added View Options section with grid toggle
   - Improved picker toggle logic
   - Added active state styling to buttons

2. `frontend/src/components/special-editors/TableEditorCore.js`
   - Added `showGrid` property
   - Added `toggleGrid()` method
   - Fixed `getToolbarState()` canSplit check
   - Added 'toggleGrid' command handler
   - Fixed bold/italic to use applyCellBold/applyCellItalic
   - Added showGrid to toolbar state

3. `frontend/src/styles/table-editor.css`
   - Added `.show-grid` CSS rule for light borders

## User Benefits

✅ **Cleaner toolbar** - Removed non-functional button
✅ **Working formatting** - Bold and Italic now work as expected
✅ **Better visibility** - Grid toggle helps see cell boundaries
✅ **Proper button states** - Split only enabled when needed
✅ **Intuitive toggles** - Border and color pickers toggle cleanly
✅ **Visual feedback** - Active states show what's currently open/on

