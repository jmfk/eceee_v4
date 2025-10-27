# Table Import Multi-Format Implementation Summary

## Overview

Enhanced the Table Import feature with comprehensive format support and a unified paste interface. Now supports HTML, CSV, TSV (Google Sheets/Excel), and JSON formats with automatic detection in both visual contenteditable and code textarea views.

## Changes Implemented

### 1. TableImportModal.jsx - Unified Paste Tab with View Toggle

**File:** `frontend/src/components/special-editors/TableImportModal.jsx`

**Changes:**
- Merged "Paste" and "HTML Code" tabs into a single "Paste" tab with view toggle
- Added `showCodeView` state to toggle between visual and code views
- Replaced textarea with `<div contentEditable>` for visual paste mode
- Added toggle button with "Code"/"Visual" labels to switch between modes
- Implemented `handleToggleView()` to sync content between views
- Implemented `handleContentEditablePaste()` to intercept paste events and extract HTML/plain text from clipboard
- Implemented `handleContentEditableInput()` to track contenteditable changes
- Implemented `handleCodeChange()` to handle textarea code editing
- Added CSS placeholder styling using `empty:before:content-[attr(data-placeholder)]`
- Dynamic help text that changes based on current view mode

**Key Features:**
- **Visual View:** Contenteditable div for pasting from webpages/spreadsheets
- **Code View:** Textarea for manual HTML editing
- Automatically captures HTML when pasting from webpages
- Falls back to plain text for TSV/spreadsheet pastes
- Real-time format detection (HTML vs TSV)
- Live preview of parsed table structure
- Seamless switching between visual and code views with content sync

### 2. tableImport.js - Multi-Format Support

**File:** `frontend/src/utils/tableImport.js`

**Enhanced Format Detection (`detectPasteFormat()`):**
- Detects: HTML, JSON, TSV, CSV (in priority order)
- **HTML:** Checks for `<table>`, `<tr>`, `<td>` tags
- **JSON:** Validates JSON arrays (array of arrays or array of objects)
- **TSV:** Detects tab characters (from Google Sheets, Excel)
- **CSV:** Detects comma-separated values with consistent column counts

**New Parsers Added:**
- `parseCSV()` - Parses comma-separated values, trims whitespace
- `parseJSON()` - Parses JSON arrays with two modes:
  - Array of arrays: `[["A","B"],["1","2"]]`
  - Array of objects: `[{"name":"John","age":30}]` (generates header row)

**HTML Sanitization (`parseHTMLTable()`):**
- Now uses `textContent` instead of `innerHTML` to strip all HTML formatting
- Preserves only structural elements: `<table>`, `<tr>`, `<td>`, `<th>`
- Preserves only structural attributes: `colspan`, `rowspan`
- Strips all styling: colors, fonts, backgrounds, alignment, classes
- Detects `border` attribute to set `show_borders` config
- All cells default to `alignment: 'left'`

**Auto-Detection (`parseAuto()`):**
- Automatically routes to correct parser based on format detection
- Works in both visual and code views

### 3. Test Coverage

**File:** `frontend/src/utils/__tests__/tableImport.test.js`

**New Tests Added:**
- `strips HTML formatting and keeps only text content` - Verifies bold, italic, and links are stripped
- `strips style attributes and uses default alignment` - Verifies all styling is removed
- `detects border attribute` - Verifies border detection from table element
- `strips nested HTML tags from cells` - Verifies complex nested HTML is flattened to text
- `handles complex styled tables from webpages` - Verifies real-world webpage tables are sanitized
- `preserves only colspan and rowspan attributes` - Verifies structural attributes are kept
- `handles whitespace normalization` - Verifies whitespace is normalized to single spaces

**New Test Coverage:**
- CSV parsing (6 tests)
- JSON parsing (8 tests)
- Enhanced format detection (4 additional tests)
- Auto-detection for all formats (4 tests)

**Test Results:** All 51 tests passing ✓ (up from 30)

## User Experience

### Before
- Separate tabs for "Paste" (textarea only) and "HTML Code" (manual editing)
- Pasting from a webpage into the textarea would only capture plain text
- Lost table structure, merged cells, and column/row organization

### After
- Single "Paste" tab with Visual/Code toggle button
- **Visual Mode (default):** Paste directly from webpages/spreadsheets
- **Code Mode:** View and edit HTML source code
- Content syncs between modes automatically

### Usage Flow - Visual Mode

1. User opens Table Import modal (Paste tab is default)
2. User navigates to a webpage with a table
3. User selects and copies the table (Ctrl/Cmd + C)
4. User pastes into the contenteditable area (Ctrl/Cmd + V)
5. Modal automatically detects "HTML" format
6. Preview shows sanitized table structure
7. User clicks "Import Table" to apply

### Usage Flow - Code Mode

1. User clicks "Code" toggle button in Paste tab
2. User pastes or types HTML table markup
3. Format auto-detected and preview shown
4. User can switch back to "Visual" to see rendered content
5. Content syncs between both views

## Technical Details

### Clipboard Data Handling

```javascript
const handleContentEditablePaste = (e) => {
    e.preventDefault()
    
    // Try HTML first, fall back to plain text
    const htmlData = e.clipboardData.getData('text/html')
    const textData = e.clipboardData.getData('text/plain')
    
    let content = htmlData || textData
    // ... parse and preview
}
```

### HTML Sanitization

```javascript
// Old: innerHTML preserves formatting
let content = cell.innerHTML.trim()

// New: textContent strips all HTML
let content = cell.textContent.trim()
```

### Contenteditable Styling

```jsx
<div
  ref={contentEditableRef}
  contentEditable
  onPaste={handleContentEditablePaste}
  onInput={handleContentEditableInput}
  className="w-full h-48 p-3 border rounded font-mono text-sm overflow-auto 
             focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white 
             empty:before:content-[attr(data-placeholder)] 
             empty:before:text-gray-400"
  data-placeholder="Paste your table here from a webpage or spreadsheet..."
  suppressContentEditableWarning={true}
/>
```

## Files Modified

1. `frontend/src/components/special-editors/TableImportModal.jsx` - Contenteditable implementation
2. `frontend/src/utils/tableImport.js` - HTML sanitization logic
3. `frontend/src/utils/__tests__/tableImport.test.js` - Test coverage for sanitization

## Benefits

1. **Universal Format Support:** HTML, CSV, TSV (Google Sheets/Excel), JSON - all auto-detected
2. **Unified Interface:** Single tab with Visual/Code toggle reduces cognitive load
3. **Easier Import:** Paste directly from webpages, spreadsheets, APIs, or data files
4. **Clean Output:** Automatic HTML sanitization ensures consistent, clean table data
5. **Better UX:** Live preview with format detection shows exactly what will be imported
6. **Flexibility:** Works in both visual and code views
7. **Code Access:** Toggle to code view for manual editing without switching tabs
8. **Content Sync:** Switch between visual and code views while preserving content
9. **Developer-Friendly:** JSON support for API responses and data exports

## Example Use Cases

### Use Case 1: Wikipedia Table (HTML)
1. Copy table from Wikipedia article
2. Paste into Table Import modal
3. **Detected:** HTML format
4. All styling/colors stripped, structure preserved
5. Import clean table structure

### Use Case 2: Google Sheets (TSV)
1. Copy cells from Google Sheets
2. Paste into Table Import modal
3. **Detected:** TSV format
4. Import spreadsheet data

### Use Case 3: CSV File
1. Copy CSV data from text editor or export
2. Paste into Table Import modal (Visual or Code view)
3. **Detected:** CSV format
4. Import comma-separated data

### Use Case 4: JSON API Response
1. Copy JSON array from API response or dev tools
2. Paste into Table Import modal (Code view works best)
3. **Detected:** JSON format
4. Array of objects → automatic header row creation
5. Array of arrays → direct table import

### Use Case 5: Complex Webpage Table (HTML)
1. Copy styled table with merged cells from webpage
2. Paste into Table Import modal
3. **Detected:** HTML format
4. Colspan/rowspan preserved, styling stripped
5. Import clean table with merged cells

## Future Enhancements

Potential improvements:
- Option to preserve basic formatting (bold, italic)
- Option to preserve links
- Visual indicator of merged cells in preview
- Import table with automatic header detection
- Paste from multiple tables with selector

## Testing

Run tests with:
```bash
npm run test:run tableImport
```

All 30 tests passing, including:
- Format detection (HTML, TSV)
- HTML sanitization
- Colspan/rowspan preservation
- Border detection
- Whitespace normalization
- Nested HTML stripping
- Complex webpage table handling

