# Advanced Table Widget Implementation

## Overview

Implement a professional table widget with a dedicated special editor modal for visual table editing. The editor will use vanilla JavaScript for the core editing functionality to avoid React re-renders, wrapped in a React component for integration.

## Architecture

**Hybrid Approach (Special Editor + Form Panel)**

- **Form Panel**: Table-level settings (caption, responsive, striped rows)
- **Special Editor**: Full-screen modal for table content editing with toolbar
- **Vanilla JS Core**: Performance-optimized contentEditable table editor
- **React Wrapper**: Integration with existing widget system

## Implementation Steps

### 1. Backend Model Updates

**File**: `backend/eceee_widgets/widgets/table.py`

Update data models to support new features:

```python
class BorderConfig(BaseModel):
    top: Optional[BorderStyle] = None
    bottom: Optional[BorderStyle] = None
    left: Optional[BorderStyle] = None
    right: Optional[BorderStyle] = None

class BorderStyle(BaseModel):
    style: Literal["plain", "thick", "double"] = "plain"  # 1px, 3px, 1px double
    color: Optional[str] = None

class CellImageData(BaseModel):
    media_id: int
    url: str
    alt: Optional[str] = None

class TableCell(BaseModel):
    content_type: Literal["text", "image"] = "text"
    content: str = ""  # HTML for text cells
    image_data: Optional[CellImageData] = None
    colspan: int = 1
    rowspan: int = 1
    font_style: Literal["normal", "quote", "caption"] = "normal"
    borders: Optional[BorderConfig] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None
    hover_bg_color: Optional[str] = None
    hover_text_color: Optional[str] = None
    alignment: Literal["left", "center", "right"] = "left"

class TableRow(BaseModel):
    cells: List[TableCell]
    height: Optional[str] = None  # CSS value: "auto", "50px", "3rem"
    
class TableConfig(BaseModel):
    rows: List[TableRow]
    column_widths: List[str] = []  # CSS values per column: ["auto", "200px", "30%"]
    caption: Optional[str] = None
    # ... existing fields
```

### 2. Backend Template Updates

**File**: `backend/eceee_widgets/templates/eceee_widgets/widgets/table.html`

Render enhanced table features:

- Image cells with `<img>` tags
- Font-style CSS classes (`.table-cell-quote`, `.table-cell-caption`)
- Per-side borders using CSS border properties
- Hover styles using `:hover` pseudo-class or inline styles
- Column widths via `<colgroup>` tags
- Row heights via inline styles

### 3. Vanilla JS Table Editor Core

**File**: `frontend/src/components/special-editors/TableEditorCore.js`

Core table editing engine (800-1000 lines):

**Key Classes/Functions:**

```javascript
class TableEditorCore {
  constructor(initialData, options)
  
  // Rendering
  render(container)
  updateTable(newData)
  
  // Cell Selection
  startSelection(cell)
  updateSelection(cell)
  endSelection()
  getSelectedCells()
  clearSelection()
  
  // Table Structure
  addRow(position = 'end')
  removeRow(rowIndex)
  addColumn(position = 'end')
  removeColumn(columnIndex)
  
  // Cell Merging
  mergeCells(selectedCells)
  splitCell(cell)
  canMerge(selectedCells)
  canSplit(cell)
  
  // Content Editing
  enableCellEditing(cell)
  applyFormatting(type) // bold, italic, link
  insertLink(url)
  
  // Cell Type
  setCellType(cells, type) // 'text' or 'image'
  
  // Styling
  applyFontStyle(cells, style) // 'normal', 'quote', 'caption'
  setBorders(cells, sides, borderStyle)
  setColors(cells, colorType, value)
  
  // Dimensions
  setColumnWidth(colIndex, width)
  setRowHeight(rowIndex, height)
  
  // Data Export
  toJSON()
}
```

**Features:**

- ContentEditable cells for text editing
- Drag-to-select rectangular cell regions
- Shift-click to extend selection
- Visual selection highlight
- Inline formatting toolbar on text selection
- Border UI with side picker and style options
- Color pickers integration
- Real-time validation

### 4. React Special Editor Wrapper

**File**: `frontend/src/components/special-editors/TableSpecialEditor.jsx`

React component (400-500 lines):

**Toolbar Sections:**

1. **Structure**: Add Row, Add Column, Remove Row, Remove Column
2. **Cell Operations**: Merge Cells, Split Cell
3. **Content**: Cell Type (Text/Image), Insert Media
4. **Formatting**: Font Style dropdown
5. **Styling**: 

   - Border picker (visual side selector + style dropdown)
   - Text color picker
   - Background color picker
   - Hover text color picker
   - Hover background color picker

6. **Dimensions**: Row Height, Column Width inputs
7. **Actions**: Save, Cancel, Reset

**Features:**

- MediaPicker modal integration for image cells
- Real-time preview of table
- Undo/redo support (optional)
- Keyboard shortcuts
- Responsive toolbar layout

### 5. Widget Registration & Integration

**File**: `frontend/src/components/special-editors/index.js`

```javascript
export { default as TableSpecialEditor } from './TableSpecialEditor'
```

**File**: `backend/eceee_widgets/widgets/table.py`

```python
class TableWidget(BaseWidget):
    # ... existing code
    special_editor = "TableSpecialEditor"
```

**File**: `frontend/src/components/special-editors/SpecialEditorRenderer.jsx`

- Import and register TableSpecialEditor

### 6. Default Configuration

Create sensible defaults:

```python
@staticmethod
def get_default_config():
    return {
        "rows": [
            {"cells": [{"content": ""}, {"content": ""}], "height": "auto"},
            {"cells": [{"content": ""}, {"content": ""}], "height": "auto"}
        ],
        "column_widths": ["auto", "auto"],
        "caption": None,
        "show_borders": True,
        "striped_rows": False,
        "hover_effect": True,
        "responsive": True,
        "table_width": "full"
    }
```

### 7. CSS Styles

**Backend CSS** (in TableWidget):

- Font style classes: `.table-cell-quote`, `.table-cell-caption`
- Border utilities for per-side borders
- Hover color transitions
- Image cell styles

**Frontend CSS** (`frontend/src/styles/table-editor.css`):

- Selection highlight
- Toolbar styles
- Border picker UI
- Drag handles for rows/columns
- Editor container layout

## Key Technical Decisions

1. **Vanilla JS for editing**: Prevents React re-renders during typing, cell selection, and drag operations
2. **Contiguous selection only**: Simplifies merge logic and UX (rectangular regions)
3. **Replace on type switch**: When switching text→image, confirm and replace (store previous as undo state)
4. **Border CSS generation**: Generate CSS border properties from BorderConfig object
5. **Media integration**: Reuse existing MediaPicker component
6. **Column width array**: Store widths in order matching columns

## Testing Checklist

- [ ] Create empty 2x2 table
- [ ] Add rows at top, middle, bottom
- [ ] Add columns at left, middle, right
- [ ] Remove rows and columns
- [ ] Merge 2x2 cell block
- [ ] Merge non-square regions (2x3, 4x1)
- [ ] Split merged cells
- [ ] Text editing with bold, italic, links
- [ ] Image cell creation via MediaPicker
- [ ] Switch text→image (confirms replacement)
- [ ] Apply font styles to single cell
- [ ] Apply font styles to multiple cells
- [ ] Set borders on all sides
- [ ] Set borders on specific sides (top+bottom)
- [ ] Border style variations (plain, thick, double)
- [ ] Background colors on cells
- [ ] Text colors on cells
- [ ] Hover colors
- [ ] Column widths (px, %, auto)
- [ ] Row heights (px, rem, auto)
- [ ] Save and reload table
- [ ] Responsive table rendering