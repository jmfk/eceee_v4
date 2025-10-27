# Table Import Test Samples

This directory contains sample files for testing the Table Import feature.

## Files

### 1. sample.csv
Simple CSV file with product data.

**Test with:** Upload File tab in Import Modal

**Expected result:**
- 6 rows (1 header + 5 data rows)
- 4 columns (Product, Price, Stock, Category)
- All cells populated with text

### 2. sample_html.html
HTML file containing three different table examples:
- Simple table with headers
- Table with colspan and rowspan
- Table with background colors and alignment

**Test with:** 
1. Open the file in a browser
2. Copy the table HTML source code
3. Paste into HTML Code tab

**Or:**
1. Right-click on a table in the rendered page
2. "Inspect Element" to view HTML
3. Copy the `<table>` element
4. Paste into HTML Code tab

### 3. sample_tsv.txt
Tab-separated values file (TSV) with country data.

**Test with:** Paste tab

**How to test:**
1. Open sample_tsv.txt in a text editor
2. Select all (Ctrl/Cmd + A)
3. Copy (Ctrl/Cmd + C)
4. Paste into Import Modal's Paste tab
5. Should auto-detect as TSV format

**Expected result:**
- 6 rows (1 header + 5 data rows)
- 4 columns (Country, Capital, Population, Area)
- Auto-detected as TSV format

## Testing Scenarios

### Scenario 1: Google Sheets Paste
1. Create a table in Google Sheets
2. Select cells and copy (Ctrl/Cmd + C)
3. Open TableWidget editor
4. Click Import button
5. Paste into Paste tab
6. Verify auto-detection shows "TSV"
7. Check preview matches source data
8. Click Import Table

### Scenario 2: CSV File Upload
1. Open TableWidget editor
2. Click Import button
3. Switch to Upload File tab
4. Drag and drop sample.csv
5. Wait for parsing to complete
6. Verify preview shows all data
7. Click Import Table

### Scenario 3: HTML Table from Web
1. Find any HTML table on a website
2. Right-click and "Inspect Element"
3. Copy the `<table>` element HTML
4. Open TableWidget editor
5. Click Import button
6. Switch to HTML Code tab
7. Paste the HTML
8. Verify preview renders correctly
9. Click Import Table

### Scenario 4: Complex Table with Formatting
1. Open sample_html.html in browser
2. Copy "Sample Table 3" HTML source
3. Paste into HTML Code tab
4. Verify colors are preserved in preview
5. Verify alignment is preserved
6. Import and check final rendering

## Edge Cases to Test

### Empty Cells
Create a table with empty cells:
```
A	B	C
1		3
	2	
```

**Expected:** Empty cells should have empty string content

### Single Column
```
Header
Value 1
Value 2
```

**Expected:** Should create 1-column table

### Single Row
```
A	B	C
```

**Expected:** Should create 1-row table with 3 columns

### Unicode Characters
Test with international characters:
```
名前	年齢	都市
田中	25	東京
佐藤	30	大阪
```

**Expected:** Should preserve all Unicode characters

### Large Table
Create a CSV with 100+ rows

**Expected:** 
- Should parse successfully
- Preview shows first 10 rows
- Full data available on import

## Common Issues

### Issue: Format not detected
**Solution:** Ensure content has tab characters (not spaces) for TSV, or proper `<table>` tags for HTML

### Issue: Preview shows empty
**Solution:** Check browser console for errors. Verify content is valid.

### Issue: Upload fails
**Solution:** 
- Check file size < 5MB
- Verify file extension is .csv, .xlsx, or .xls
- Check network tab for API errors

### Issue: Encoding problems
**Solution:**
- Save CSV as UTF-8
- Try Excel format instead
- Backend auto-detects common encodings

## Success Criteria

A successful import should:
1. ✅ Detect format correctly (if auto-detect)
2. ✅ Show accurate preview
3. ✅ Import without errors
4. ✅ Preserve data accuracy (all cells match source)
5. ✅ Preserve basic formatting (colors, alignment)
6. ✅ Create editable table in TableWidget
7. ✅ Allow further editing after import

