# Table Import Feature Documentation

## Overview

The Table Import feature allows users to import table data from multiple sources into the TableWidget editor. This feature supports:

- **Paste from Clipboard**: Auto-detect and parse HTML or tab-delimited text (e.g., from Google Sheets, Excel)
- **Upload CSV Files**: Parse CSV files with automatic encoding detection
- **Upload Excel Files**: Parse Excel files (.xlsx, .xls)
- **HTML Code**: Paste raw HTML table markup

## User Interface

### Accessing the Import Feature

1. Open the TableWidget special editor
2. Click the **Import** button (📥 icon) in the toolbar
3. The Import Modal will open with three tabs

### Import Methods

#### 1. Paste Tab

**Use this for:**
- Copying from Google Sheets
- Copying from Excel
- Pasting HTML tables from web pages

**How to use:**
1. Copy table data from your source (Ctrl/Cmd + C)
2. Paste into the textarea (Ctrl/Cmd + V)
3. Format is automatically detected (HTML or TSV)
4. Preview appears below the textarea
5. Click "Import Table" to apply

**Supported formats:**
- Tab-delimited (TSV) - from spreadsheets
- HTML table markup - from web pages

#### 2. Upload File Tab

**Use this for:**
- CSV files (.csv)
- Excel files (.xlsx, .xls)

**How to use:**
1. Click the drop zone or drag a file onto it
2. Select a CSV or Excel file
3. File is automatically uploaded and parsed
4. Preview appears showing the parsed data
5. Click "Import Table" to apply

**Limits:**
- Maximum file size: 5MB
- Supported formats: .csv, .xlsx, .xls

#### 3. HTML Code Tab

**Use this for:**
- Pasting raw HTML table code
- Advanced table structures with formatting

**How to use:**
1. Paste HTML code containing `<table>` element
2. Preview appears showing parsed structure
3. Click "Import Table" to apply

**Features preserved:**
- colspan and rowspan attributes
- Text alignment (left, center, right)
- Background colors
- Text colors
- Basic HTML formatting (bold, italic, links)

## Technical Implementation

### Frontend Components

#### TableImportModal.jsx
Location: `frontend/src/components/special-editors/TableImportModal.jsx`

**Props:**
```javascript
{
  isOpen: boolean,       // Controls modal visibility
  onClose: () => void,   // Callback when modal is closed
  onImport: (tableData) => void  // Callback with parsed table data
}
```

**Features:**
- Three-tab interface (Paste, Upload, HTML)
- Real-time format detection
- Live preview of parsed table
- Error handling and validation
- Loading states for file uploads

#### Parsing Utilities
Location: `frontend/src/utils/tableImport.js`

**Functions:**

```javascript
// Detect format of pasted content
detectPasteFormat(text: string): 'html' | 'tsv' | 'unknown'

// Parse HTML table markup
parseHTMLTable(htmlString: string): TableConfig

// Parse tab-delimited text
parseTabDelimited(text: string): TableConfig

// Auto-detect and parse
parseAuto(text: string): TableConfig

// Normalize and validate table data
normalizeTableData(tableData: object): TableConfig
```

### Backend API

#### Endpoint
**URL:** `POST /api/file-manager/import-table/`  
**Authentication:** Required  
**Content-Type:** `multipart/form-data`

**Request:**
```javascript
FormData {
  file: File  // CSV or Excel file
}
```

**Response:**
```json
{
  "rows": [
    {
      "cells": [
        {
          "content": "Cell content",
          "content_type": "text",
          "colspan": 1,
          "rowspan": 1,
          "font_style": "normal",
          "alignment": "left"
        }
      ],
      "height": "auto"
    }
  ],
  "column_widths": ["auto", "auto"],
  "caption": null,
  "show_borders": true,
  "striped_rows": false,
  "hover_effect": true,
  "responsive": true,
  "table_width": "full"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid file type, malformed file, or missing file
- `401 Unauthorized` - User not authenticated
- `500 Internal Server Error` - Server processing error

**File Validation:**
- Allowed extensions: .csv, .xlsx, .xls
- Maximum size: 5MB
- Encoding detection for CSV files (UTF-8, UTF-8-BOM, Latin-1, CP1252)

#### Implementation
Location: `backend/file_manager/views/table_import.py`

**Dependencies:**
- `pandas` - CSV and Excel parsing
- `openpyxl` - Excel file support (.xlsx)

**Functions:**
```python
parse_csv_file(file_content: bytes, filename: str) -> List[List[str]]
parse_excel_file(file_content: bytes, filename: str) -> List[List[str]]
convert_to_table_widget_format(rows: List[List[str]]) -> Dict[str, Any]
```

## Data Flow

### 1. Paste/HTML Import (Frontend Only)
```
User pastes → detectPasteFormat() → parseHTMLTable() or parseTabDelimited()
→ normalizeTableData() → Preview → Import → onConfigChange()
```

### 2. File Upload Import (Backend + Frontend)
```
User selects file → Frontend validation → Upload to API
→ Backend parses with pandas → Returns TableConfig
→ Preview → Import → onConfigChange()
```

## Examples

### Example 1: Google Sheets Paste

**Input (TSV):**
```
Name	Age	City
John Doe	30	New York
Jane Smith	25	Los Angeles
```

**Output:**
- 3 rows × 3 columns table
- All cells have `content_type: "text"`
- Column widths set to "auto"

### Example 2: HTML Table

**Input:**
```html
<table>
  <tr>
    <th colspan="2">Header</th>
  </tr>
  <tr>
    <td>Cell 1</td>
    <td>Cell 2</td>
  </tr>
</table>
```

**Output:**
- 2 rows table
- First row has one cell with `colspan: 2`
- Second row has two cells with `colspan: 1`

### Example 3: CSV File Upload

**File content:**
```csv
Product,Price,Stock
Apple,1.50,100
Banana,0.75,150
```

**Result:**
- Backend parses with pandas
- Returns 3 rows (header + 2 data rows)
- All values converted to strings

## Testing

### Backend Tests
Location: `backend/file_manager/tests/test_table_import.py`

**Run tests:**
```bash
docker-compose exec backend python manage.py test file_manager.tests.test_table_import
```

**Test cases:**
- CSV file parsing
- Excel file parsing
- Empty cells handling
- Invalid file type rejection
- File size validation
- Authentication requirement
- Encoding detection

### Frontend Tests
Location: `frontend/src/utils/__tests__/tableImport.test.js`

**Run tests:**
```bash
docker-compose exec frontend npm run test:run tableImport
```

**Test cases:**
- Format detection (HTML, TSV, unknown)
- HTML table parsing (simple, colspan, rowspan, alignment, colors)
- TSV parsing (simple, empty cells, normalization)
- Auto-detection and parsing
- Data normalization and validation

## Error Handling

### Frontend Errors

**Invalid paste format:**
```
"Could not detect table format. Please use HTML table markup 
or tab-delimited text (e.g., from Google Sheets)."
```

**Empty content:**
```
"No content provided"
"No data found in pasted content"
```

**Malformed HTML:**
```
"No table element found in HTML"
```

### Backend Errors

**Invalid file type:**
```
"Invalid file type. Please upload a CSV (.csv) or 
Excel (.xlsx, .xls) file."
```

**File too large:**
```
"File too large. Maximum size is 5MB."
```

**Parse failure:**
```
"Failed to parse CSV file: [error details]"
"Failed to parse Excel file: [error details]"
```

## Known Limitations

1. **CSV Detection:** The frontend paste area does not auto-detect CSV format (comma-separated). CSV files should be uploaded via the Upload tab.

2. **Merged Cells:** When pasting from spreadsheets, merged cells are not preserved in TSV format. Use HTML paste or file upload for complex tables.

3. **Formatting:** Basic HTML formatting (bold, italic, links) is preserved from HTML tables, but complex styling is not supported.

4. **Excel Sheets:** Only the first sheet of multi-sheet Excel files is imported.

5. **Large Tables:** Very large tables (1000+ rows) may cause performance issues in the preview. Consider splitting into multiple tables.

## Future Enhancements

Potential improvements for future versions:

- [ ] Support for multiple Excel sheets with sheet selector
- [ ] Import from URL (fetch table from web page)
- [ ] CSV delimiter auto-detection
- [ ] Import settings (skip rows, column mapping)
- [ ] Paste special (values only, formulas, formatting)
- [ ] Preview pagination for large tables
- [ ] Undo/redo for imports
- [ ] Template library (common table structures)

## Troubleshooting

### Import button does nothing
- Check browser console for JavaScript errors
- Ensure TableSpecialEditor is properly initialized
- Verify modal state management

### File upload fails
- Check file size (max 5MB)
- Verify file extension (.csv, .xlsx, .xls)
- Check network tab for API errors
- Ensure authentication is valid

### Preview shows empty cells
- This is normal for sparse data
- Empty cells will be filled with empty strings

### Encoding issues with CSV
- Try saving CSV with UTF-8 encoding
- Backend tries multiple encodings automatically
- Use Excel file format as alternative

### Table structure looks wrong
- Check that source data is properly formatted
- Verify colspan/rowspan in HTML tables
- Use normalization to fix column count mismatches

## Support

For issues or questions:
1. Check the error message in the modal
2. Review browser console for JavaScript errors
3. Check backend logs for API errors
4. Refer to test files for usage examples
5. Contact development team

