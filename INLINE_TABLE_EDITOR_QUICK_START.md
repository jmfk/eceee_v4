# Inline Table Editor - Quick Start Guide

## ✅ Implementation Complete

The table editor has been successfully moved from the special editor panel to inline editing with a global toolbar at the top.

## How It Works

### 1. Adding a Table Widget

- Open a page in the page editor
- Click "Add Widget" in any slot
- Select "ECEEE Table" from the widget library
- A table will appear inline in the slot

### 2. Activating the Table Editor

- **Click anywhere on the table** to activate it
- The table will show a **blue outline** indicating it's active
- The **global toolbar** will **slide down from the top** of the page
- The toolbar contains all table editing tools

### 3. Using the Toolbar

The toolbar has 8 sections (from left to right):

#### Structure
- 📥 **Import**: Import table from CSV/TSV/HTML
- ➕ **Row**: Add row at end
- ➖ **Remove Row**: Delete selected row
- ➕ **Col**: Add column at end  
- ➖ **Remove Column**: Delete selected column

#### Cell Operations
- ⊞ **Merge Cells**: Combine selected cells (requires 2+ cells selected)
- ⊟ **Split Cell**: Split merged cell (requires 1 merged cell selected)

#### Content Type
- T **Text Cell**: Convert cell to text type

#### Text Formatting
- **B** Bold: Make text bold
- *I* Italic: Make text italic

#### Horizontal Alignment
- ⬅️ **Align Left**
- ↔️ **Align Center**
- ➡️ **Align Right**

#### Vertical Alignment
- ⬆️ **Align Top**
- ↕️ **Align Middle**
- ⬇️ **Align Bottom**

#### Font Style
- Dropdown: Normal Text / Quote / Caption

#### Styling
- 🔲 **Borders**: Click to open border picker
  - Select sides (top, bottom, left, right)
  - Choose width (1px, 2px, 3px)
  - Choose style (solid, double)
  - Pick color
- 🎨 **Colors**: Click to open color picker
  - Background color
  - Text color
  - Hover background color
  - Hover text color

#### Close
- ✖️ **Close**: Deactivate table editor (hides toolbar)

### 4. Selecting Cells

- **Single cell**: Click on a cell
- **Multiple cells**: Click and drag across cells
- **Selection shows**: Blue background with blue outline

### 5. Editing Cell Content

- **Double-click** a cell to start editing text
- Type your content
- Click outside cell to finish editing
- Use **Bold/Italic** buttons for formatting while editing

### 6. Importing Tables

1. Click the **Import** button in the toolbar
2. Choose format: CSV, TSV, or HTML
3. Paste your data
4. Preview the table
5. Click "Import" to replace current table

### 7. Deactivating the Editor

- Click the **X button** on the right side of the toolbar, OR
- Click outside the table widget

The toolbar will slide up and hide.

### 8. Multiple Tables

- Only **one table can be active** at a time
- Clicking a different table will:
  - Deactivate the current table
  - Activate the new table
  - Toolbar updates to show new table's state

## Visual States

### Inactive (Default)
- Normal table appearance
- Hover shows **gray outline**
- Cursor changes to pointer

### Active (Editing)
- **Blue outline** around table
- Light blue background
- Toolbar visible at top
- Cells selectable

### Cell Selected
- **Blue background** on selected cells
- Blue outline around selection
- Toolbar buttons enabled based on selection

## Keyboard Shortcuts

- **Double-click cell**: Start editing
- **Escape**: Exit cell editing
- **Tab**: Move to next cell (while editing)
- **Ctrl/Cmd + B**: Bold (while editing cell)
- **Ctrl/Cmd + I**: Italic (while editing cell)

## Context Menu

- **Right-click** on a cell for additional options:
  - Cut, Copy, Paste
  - Insert Link
  - Cell formatting
  - Row/Column operations

## Tips

1. **Select before formatting**: Select cells first, then use toolbar buttons
2. **Border picker**: Changes apply immediately as you adjust settings
3. **Color picker**: Changes apply immediately as you pick colors
4. **Import preserves formatting**: HTML imports maintain styles
5. **Save happens automatically**: Changes sync via UnifiedData context

## Troubleshooting

### Toolbar doesn't appear
- Make sure you **clicked on the table** (not just hovering)
- Check if another editor is active (close it first)

### Can't merge cells
- You need to select **2 or more cells** first
- Click and drag to select multiple cells

### Can't split cell
- Only **merged cells** can be split
- Select exactly **one merged cell**

### Import button doesn't work
- Click the **Import** icon in the toolbar (leftmost button)
- The import modal will open automatically

### Changes not saving
- Changes save automatically via UnifiedData context
- Make sure you're not in preview mode
- Check browser console for errors

## Comparison with Old System

### Before (Special Editor Panel)
- Click "Edit Table" button
- Special editor opens as right panel (60% width)
- Edit table in panel
- Click "Save" or "Cancel"
- Panel closes

### Now (Inline Editor)
- Click on table to activate
- Global toolbar appears at top
- Edit table directly in layout
- Click X or click outside to deactivate
- Changes sync automatically

## Benefits

✅ **Faster workflow**: One click to activate
✅ **Better context**: See table in actual layout
✅ **Consistent UX**: Matches WYSIWYG content editor
✅ **No modal switching**: Stay in the page view
✅ **All features available**: Full functionality in toolbar
✅ **Visual feedback**: Clear active/inactive states

## Technical Details

- Uses vanilla JS `TableEditorCore` for performance
- React wrapper handles lifecycle and state
- Global toolbar managed by `tableToolbarManager` singleton
- State polling at 100ms for toolbar updates
- UnifiedData context for state management
- Custom events for command dispatch

