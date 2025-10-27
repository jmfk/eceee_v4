/**
 * Table Import Utilities
 * 
 * Parse various table formats (HTML, TSV, CSV) into TableWidget configuration format.
 */

/**
 * Detect the format of pasted content
 * @param {string} text - The pasted text content
 * @returns {'html' | 'tsv' | 'unknown'} - Detected format
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

    // Check for tab characters (TSV from spreadsheets)
    if (trimmed.includes('\t')) {
        return 'tsv'
    }

    // If it has newlines and commas, might be CSV, but we'll treat as unknown
    // since CSV is better handled via file upload
    return 'unknown'
}

/**
 * Parse HTML table markup into TableWidget format
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

    // Process all rows (from thead and tbody)
    const allRows = table.querySelectorAll('tr')

    allRows.forEach((tr) => {
        const cells = []
        const cellElements = tr.querySelectorAll('td, th')

        cellElements.forEach((cell) => {
            // Get cell content (innerHTML to preserve basic formatting)
            let content = cell.innerHTML.trim()

            // Clean up the content - remove excessive whitespace but keep basic HTML
            content = content.replace(/\s+/g, ' ')

            // Extract colspan and rowspan
            const colspan = parseInt(cell.getAttribute('colspan') || '1', 10)
            const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10)

            // Determine alignment from style or align attribute
            let alignment = 'left'
            const textAlign = cell.style.textAlign || cell.getAttribute('align')
            if (textAlign) {
                alignment = textAlign.toLowerCase()
                if (!['left', 'center', 'right'].includes(alignment)) {
                    alignment = 'left'
                }
            }

            // Extract background color if present
            let backgroundColor = null
            if (cell.style.backgroundColor) {
                backgroundColor = cell.style.backgroundColor
            }

            // Extract text color if present
            let textColor = null
            if (cell.style.color) {
                textColor = cell.style.color
            }

            cells.push({
                content: content,
                content_type: 'text',
                colspan: colspan,
                rowspan: rowspan,
                font_style: 'normal',
                alignment: alignment,
                background_color: backgroundColor,
                text_color: textColor
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
        show_borders: true,
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
        default:
            throw new Error('Could not detect table format. Please use HTML table markup or tab-delimited text (e.g., from Google Sheets).')
    }
}

