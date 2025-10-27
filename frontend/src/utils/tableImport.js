/**
 * Table Import Utilities
 * 
 * Parse various table formats (HTML, TSV, CSV) into TableWidget configuration format.
 */

/**
 * Detect the format of pasted content
 * @param {string} text - The pasted text content
 * @returns {'html' | 'tsv' | 'csv' | 'json' | 'unknown'} - Detected format
 */
export function detectPasteFormat(text) {
    if (!text || typeof text !== 'string') {
        return 'unknown'
    }

    const trimmed = text.trim()

    // Check for HTML table tags
    if (trimmed.includes('<table') || trimmed.includes('<tr') || trimmed.includes('<td')) {
        return 'html'
    }

    // Check for JSON format (array of arrays or array of objects)
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
        try {
            JSON.parse(trimmed)
            return 'json'
        } catch (e) {
            // Not valid JSON, continue checking
        }
    }

    // Check for tab characters (TSV from spreadsheets like Google Sheets, Excel)
    if (trimmed.includes('\t')) {
        return 'tsv'
    }

    // Check for CSV format (commas with or without newlines)
    const lines = trimmed.split('\n')

    // Check if it has commas (potential CSV)
    const hasCommas = trimmed.includes(',')

    if (hasCommas) {
        if (lines.length > 1) {
            // Multiple lines - check if they have similar comma counts
            const firstLineCommas = (lines[0].match(/,/g) || []).length
            const secondLineCommas = (lines[1].match(/,/g) || []).length

            // If multiple lines with similar comma counts, likely CSV
            if (firstLineCommas > 0 && Math.abs(firstLineCommas - secondLineCommas) <= 2) {
                return 'csv'
            }
        } else {
            // Single line with commas - treat as CSV if it has at least one comma
            const commaCount = (trimmed.match(/,/g) || []).length
            if (commaCount > 0) {
                return 'csv'
            }
        }
    }

    return 'unknown'
}

/**
 * Parse HTML table markup into TableWidget format
 * Sanitizes HTML to keep only table structure (tr, td, colspan, rowspan, borders)
 * @param {string} htmlString - HTML string containing table markup
 * @returns {Object} - TableWidget configuration
 */
export function parseHTMLTable(htmlString) {
    if (!htmlString) {
        throw new Error('No HTML content provided')
    }

    // Create a temporary DOM element to parse HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlString, 'text/html')

    // Find the first table element
    const table = doc.querySelector('table')
    if (!table) {
        throw new Error('No table element found in HTML')
    }

    const rows = []
    let maxCols = 0

    // Check if table has borders (from border attribute or style)
    let showBorders = true
    const borderAttr = table.getAttribute('border')
    if (borderAttr === '0' || borderAttr === 'none') {
        showBorders = false
    }

    // Process all rows (from thead and tbody)
    const allRows = table.querySelectorAll('tr')

    allRows.forEach((tr) => {
        const cells = []
        const cellElements = tr.querySelectorAll('td, th')

        cellElements.forEach((cell) => {
            // Clone the cell to avoid modifying the original
            const cellClone = cell.cloneNode(true)

            // Replace line break elements with a unique placeholder before getting text content
            const brPlaceholder = '<<<BR>>>'

            // Replace <br> tags
            cellClone.querySelectorAll('br').forEach(br => {
                br.replaceWith(brPlaceholder)
            })

            // Replace block elements (<div>, <p>) with line breaks
            cellClone.querySelectorAll('div, p').forEach(block => {
                // Add placeholder before the block for line break
                const placeholder = document.createTextNode(brPlaceholder)
                block.parentNode.insertBefore(placeholder, block)
                // Replace the block with its content
                while (block.firstChild) {
                    block.parentNode.insertBefore(block.firstChild, block)
                }
                block.remove()
            })

            // Get cell content as plain text (strip all HTML formatting)
            let content = cellClone.textContent.trim()

            // Normalize whitespace (multiple spaces/newlines to single space)
            content = content.replace(/\s+/g, ' ')

            // Now replace the placeholders with actual newlines
            content = content.replace(new RegExp(brPlaceholder, 'g'), '\n')

            // Clean up: remove leading/trailing newlines and multiple consecutive newlines
            content = content.replace(/^\n+|\n+$/g, '').replace(/\n{3,}/g, '\n\n')

            // Extract colspan and rowspan (only structural attributes preserved)
            const colspan = parseInt(cell.getAttribute('colspan') || '1', 10)
            const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10)

            cells.push({
                content: content,
                content_type: 'text',
                colspan: colspan,
                rowspan: rowspan,
                font_style: 'normal',
                alignment: 'left'
            })
        })

        if (cells.length > 0) {
            rows.push({
                cells: cells,
                height: 'auto'
            })
            maxCols = Math.max(maxCols, cells.reduce((sum, cell) => sum + cell.colspan, 0))
        }
    })

    if (rows.length === 0) {
        throw new Error('No rows found in table')
    }

    // Normalize rows - ensure all have same effective column count
    const normalizedRows = normalizeTableRows(rows, maxCols)

    // Generate column widths
    const columnWidths = Array(maxCols).fill('auto')

    return {
        rows: normalizedRows,
        column_widths: columnWidths,
        caption: null,
        show_borders: showBorders,
        striped_rows: false,
        hover_effect: true,
        responsive: true,
        table_width: 'full'
    }
}

/**
 * Parse tab-delimited text (TSV) into TableWidget format
 * @param {string} text - Tab-delimited text (e.g., from Google Sheets paste)
 * @returns {Object} - TableWidget configuration
 */
export function parseTabDelimited(text) {
    if (!text) {
        throw new Error('No content provided')
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0)

    if (lines.length === 0) {
        throw new Error('No data found in pasted content')
    }

    const rows = []
    let maxCols = 0

    lines.forEach((line) => {
        // Split by tabs
        const cellValues = line.split('\t')

        const cells = cellValues.map((value) => ({
            content: value.trim(),
            content_type: 'text',
            colspan: 1,
            rowspan: 1,
            font_style: 'normal',
            alignment: 'left'
        }))

        rows.push({
            cells: cells,
            height: 'auto'
        })

        maxCols = Math.max(maxCols, cells.length)
    })

    // Normalize rows to have same number of cells
    const normalizedRows = normalizeTableRows(rows, maxCols)

    // Generate column widths
    const columnWidths = Array(maxCols).fill('auto')

    return {
        rows: normalizedRows,
        column_widths: columnWidths,
        caption: null,
        show_borders: true,
        striped_rows: false,
        hover_effect: true,
        responsive: true,
        table_width: 'full'
    }
}

/**
 * Normalize table rows to ensure consistent structure
 * @param {Array} rows - Array of row objects
 * @param {number} targetCols - Target number of columns
 * @returns {Array} - Normalized rows
 */
function normalizeTableRows(rows, targetCols) {
    return rows.map((row) => {
        const currentCols = row.cells.reduce((sum, cell) => sum + (cell.colspan || 1), 0)

        // If row has fewer columns, pad with empty cells
        if (currentCols < targetCols) {
            const cellsToAdd = targetCols - currentCols
            for (let i = 0; i < cellsToAdd; i++) {
                row.cells.push({
                    content: '',
                    content_type: 'text',
                    colspan: 1,
                    rowspan: 1,
                    font_style: 'normal',
                    alignment: 'left'
                })
            }
        }

        return row
    })
}

/**
 * Normalize and validate table data
 * Ensures the table structure is valid and consistent
 * @param {Object} tableData - Raw parsed table data
 * @returns {Object} - Validated and normalized table data
 */
export function normalizeTableData(tableData) {
    if (!tableData || !tableData.rows) {
        throw new Error('Invalid table data structure')
    }

    if (tableData.rows.length === 0) {
        throw new Error('Table has no rows')
    }

    // Find maximum number of columns
    let maxCols = 0
    tableData.rows.forEach((row) => {
        if (row.cells && Array.isArray(row.cells)) {
            const colCount = row.cells.reduce((sum, cell) => sum + (cell.colspan || 1), 0)
            maxCols = Math.max(maxCols, colCount)
        }
    })

    if (maxCols === 0) {
        throw new Error('Table has no columns')
    }

    // Normalize all rows
    const normalizedRows = normalizeTableRows(tableData.rows, maxCols)

    // Ensure column_widths matches column count
    const columnWidths = tableData.column_widths || []
    while (columnWidths.length < maxCols) {
        columnWidths.push('auto')
    }
    columnWidths.length = maxCols // Trim if too long

    return {
        ...tableData,
        rows: normalizedRows,
        column_widths: columnWidths
    }
}

/**
 * Parse CSV text into TableWidget format
 * @param {string} text - CSV text
 * @returns {Object} - TableWidget configuration
 */
export function parseCSV(text) {
    if (!text) {
        throw new Error('No content provided')
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0)

    if (lines.length === 0) {
        throw new Error('No data found in CSV content')
    }

    const rows = []
    let maxCols = 0

    lines.forEach((line) => {
        // Simple CSV parsing (handles basic cases, not quoted commas)
        const cellValues = line.split(',').map(val => val.trim())

        const cells = cellValues.map((value) => ({
            content: value,
            content_type: 'text',
            colspan: 1,
            rowspan: 1,
            font_style: 'normal',
            alignment: 'left'
        }))

        rows.push({
            cells: cells,
            height: 'auto'
        })

        maxCols = Math.max(maxCols, cells.length)
    })

    // Normalize rows to have same number of cells
    const normalizedRows = normalizeTableRows(rows, maxCols)

    // Generate column widths
    const columnWidths = Array(maxCols).fill('auto')

    return {
        rows: normalizedRows,
        column_widths: columnWidths,
        caption: null,
        show_borders: true,
        striped_rows: false,
        hover_effect: true,
        responsive: true,
        table_width: 'full'
    }
}

/**
 * Parse JSON into TableWidget format
 * Supports: array of arrays [[a,b],[c,d]] or array of objects [{col1:a, col2:b}]
 * @param {string} text - JSON text
 * @returns {Object} - TableWidget configuration
 */
export function parseJSON(text) {
    if (!text) {
        throw new Error('No content provided')
    }

    let data
    try {
        data = JSON.parse(text)
    } catch (e) {
        throw new Error('Invalid JSON format')
    }

    if (!Array.isArray(data)) {
        throw new Error('JSON must be an array')
    }

    if (data.length === 0) {
        throw new Error('JSON array is empty')
    }

    const rows = []
    let maxCols = 0

    // Check if it's array of arrays or array of objects
    if (Array.isArray(data[0])) {
        // Array of arrays: [[a, b], [c, d]]
        data.forEach((row) => {
            if (!Array.isArray(row)) {
                throw new Error('Mixed JSON format - all items must be arrays')
            }

            const cells = row.map((value) => ({
                content: String(value),
                content_type: 'text',
                colspan: 1,
                rowspan: 1,
                font_style: 'normal',
                alignment: 'left'
            }))

            rows.push({
                cells: cells,
                height: 'auto'
            })

            maxCols = Math.max(maxCols, cells.length)
        })
    } else if (typeof data[0] === 'object' && data[0] !== null) {
        // Array of objects: [{name: "John", age: 30}, {name: "Jane", age: 25}]
        // Extract headers from first object
        const headers = Object.keys(data[0])
        maxCols = headers.length

        // Add header row
        const headerCells = headers.map((header) => ({
            content: String(header),
            content_type: 'text',
            colspan: 1,
            rowspan: 1,
            font_style: 'normal',
            alignment: 'left'
        }))

        rows.push({
            cells: headerCells,
            height: 'auto'
        })

        // Add data rows
        data.forEach((obj) => {
            const cells = headers.map((header) => ({
                content: obj[header] !== undefined ? String(obj[header]) : '',
                content_type: 'text',
                colspan: 1,
                rowspan: 1,
                font_style: 'normal',
                alignment: 'left'
            }))

            rows.push({
                cells: cells,
                height: 'auto'
            })
        })
    } else {
        throw new Error('JSON must be array of arrays or array of objects')
    }

    // Normalize rows to have same number of cells
    const normalizedRows = normalizeTableRows(rows, maxCols)

    // Generate column widths
    const columnWidths = Array(maxCols).fill('auto')

    return {
        rows: normalizedRows,
        column_widths: columnWidths,
        caption: null,
        show_borders: true,
        striped_rows: false,
        hover_effect: true,
        responsive: true,
        table_width: 'full'
    }
}

/**
 * Auto-detect and parse pasted content
 * @param {string} text - Pasted text content
 * @returns {Object} - TableWidget configuration
 */
export function parseAuto(text) {
    const format = detectPasteFormat(text)

    switch (format) {
        case 'html':
            return parseHTMLTable(text)
        case 'tsv':
            return parseTabDelimited(text)
        case 'csv':
            return parseCSV(text)
        case 'json':
            return parseJSON(text)
        default:
            throw new Error('Could not detect table format. Please use HTML table markup, tab-delimited text (Google Sheets/Excel), CSV, or JSON format.')
    }
}

