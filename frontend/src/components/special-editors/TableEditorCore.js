/**
 * TableEditorCore - Vanilla JS Table Editor
 * 
 * High-performance table editor using vanilla JavaScript to avoid React re-renders.
 * Provides visual table editing with cell selection, merging, formatting, and styling.
 */

import { FloatingToolbar } from './FloatingToolbar'
import { LinkModal } from './LinkModal'
import { TableContextMenu } from './TableContextMenu'
import { tableToolbarManager } from '../../utils/tableToolbarManager.js'

export class TableEditorCore {
    constructor(initialData, options = {}) {
        this.data = this.normalizeData(initialData)
        this.options = {
            onChange: options.onChange || (() => { }),
            onSelectionChange: options.onSelectionChange || (() => { }),
            detachedToolbar: options.detachedToolbar || false,
            ...options
        }

        this.container = null
        this.tableElement = null
        this.selection = {
            active: false,
            startCell: null,
            endCell: null,
            cells: []
        }

        this.isSelecting = false
        this.history = []
        this.historyIndex = -1

        // Text selection and floating toolbar
        this.textSelection = null
        this.floatingToolbar = null
        this.linkModal = null
        this.contextMenu = null

        // Edit mode tracking
        this.editingCell = null // Currently editing cell
        this.isEditMode = false

        // Clipboard for copy/paste
        this.clipboard = null
        this.clipboardMode = null // 'copy' or 'cut'

        // Activation state for detached toolbar mode
        this.isActive = false
        this.handleCommandBound = null

        // Grid visibility state
        this.showGrid = false

        // Bound handlers for event listeners
        this.handleSelectionChangeBound = this.handleSelectionChange.bind(this)
        this.handleClickOutsideBound = this.handleClickOutside.bind(this)
        this.handleKeyDownBound = this.handleKeyDown.bind(this)
    }

    /**
     * Normalize incoming data to ensure consistent structure
     */
    normalizeData(data) {
        if (!data || !data.rows || data.rows.length === 0) {
            // Create default 2x2 table
            return {
                rows: [
                    {
                        cells: [
                            { contentType: 'text', content: '' },
                            { contentType: 'text', content: '' }
                        ],
                        height: null
                    },
                    {
                        cells: [
                            { contentType: 'text', content: '' },
                            { contentType: 'text', content: '' }
                        ],
                        height: null
                    }
                ],
                columnWidths: ['auto', 'auto'],
                caption: null,
                showBorders: true,
                stripedRows: false,
                hoverEffect: true,
                responsive: true,
                tableWidth: 'full'
            }
        }

        // Ensure all cells have required fields
        const normalized = { ...data }
        normalized.rows = data.rows.map(row => ({
            ...row,
            cells: row.cells.map(cell => ({
                contentType: cell.contentType || 'text',
                content: cell.content || '',
                imageData: cell.imageData || null,
                colspan: cell.colspan || 1,
                rowspan: cell.rowspan || 1,
                fontStyle: cell.fontStyle || 'normal',
                alignment: cell.alignment || 'left',
                verticalAlignment: cell.verticalAlignment || 'top',
                borders: cell.borders || null,
                backgroundColor: cell.backgroundColor || null,
                textColor: cell.textColor || null,
                hoverBgColor: cell.hoverBgColor || null,
                hoverTextColor: cell.hoverTextColor || null,
                cssClass: cell.cssClass || null
            }))
        }))

        // Ensure columnWidths array exists
        if (!normalized.columnWidths) {
            const maxCols = Math.max(...normalized.rows.map(r => r.cells.length))
            normalized.columnWidths = Array(maxCols).fill('auto')
        }

        return normalized
    }

    /**
     * Render the table into the container
     */
    render(container) {
        this.container = container
        this.container.innerHTML = ''

        const wrapper = document.createElement('div')
        wrapper.className = 'table-editor-wrapper'

        const table = document.createElement('table')
        table.className = 'table-editor-table'

        // Create colgroup for column widths
        const colgroup = document.createElement('colgroup')
        this.data.columnWidths.forEach(width => {
            const col = document.createElement('col')
            col.style.width = width
            colgroup.appendChild(col)
        })
        table.appendChild(colgroup)

        const tbody = document.createElement('tbody')

        this.data.rows.forEach((row, rowIndex) => {
            const tr = this.createRowElement(row, rowIndex)
            tbody.appendChild(tr)
        })

        table.appendChild(tbody)
        wrapper.appendChild(table)
        this.container.appendChild(wrapper)

        this.tableElement = table

        // Initialize floating toolbar and context menu
        if (!this.floatingToolbar) {
            this.floatingToolbar = new FloatingToolbar(wrapper, {
                onBold: () => this.applyFormatting('bold'),
                onItalic: () => this.applyFormatting('italic'),
                onLink: () => this.showLinkModal()
            })
        }

        if (!this.linkModal) {
            this.linkModal = new LinkModal()
        }

        if (!this.contextMenu) {
            this.contextMenu = new TableContextMenu(this)
        }

        this.attachEventListeners()

        return this.container
    }

    /**
     * Create a table row element
     */
    createRowElement(row, rowIndex) {
        const tr = document.createElement('tr')
        tr.dataset.rowIndex = rowIndex

        if (row.height) {
            tr.style.height = row.height
        }

        row.cells.forEach((cell, cellIndex) => {
            // Skip cells that are part of a merged cell
            if (cell._merged) {
                return
            }

            const td = this.createCellElement(cell, rowIndex, cellIndex)
            tr.appendChild(td)
        })

        return tr
    }

    /**
     * Create a table cell element
     */
    createCellElement(cell, rowIndex, cellIndex) {
        const td = document.createElement('td')
        td.dataset.rowIndex = rowIndex
        td.dataset.cellIndex = cellIndex
        td.className = 'table-editor-cell'

        // Set colspan and rowspan
        if (cell.colspan > 1) td.colSpan = cell.colspan
        if (cell.rowspan > 1) td.rowSpan = cell.rowspan

        // Apply font style class
        if (cell.fontStyle === 'quote') td.classList.add('table-cell-quote')
        if (cell.fontStyle === 'caption') td.classList.add('table-cell-caption')

        // Apply horizontal alignment class
        if (cell.alignment === 'center') td.classList.add('cell-center')
        if (cell.alignment === 'right') td.classList.add('cell-right')
        if (cell.alignment === 'left') td.classList.add('cell-left')

        // Apply vertical alignment class
        if (cell.verticalAlignment === 'middle') td.classList.add('cell-v-middle')
        if (cell.verticalAlignment === 'bottom') td.classList.add('cell-v-bottom')
        if (cell.verticalAlignment === 'top') td.classList.add('cell-v-top')

        // Apply inline styles
        if (cell.backgroundColor) td.style.backgroundColor = cell.backgroundColor
        if (cell.textColor) td.style.color = cell.textColor

        // Apply borders
        if (cell.borders) {
            this.applyBordersToElement(td, cell.borders)
        }

        // Render content based on type
        if (cell.contentType === 'image' && cell.imageData) {
            td.classList.add('cell-image')
            const img = document.createElement('img')
            img.src = cell.imageData.url
            img.alt = cell.imageData.alt || ''
            img.style.maxWidth = '100%'
            img.style.height = 'auto'
            td.appendChild(img)
        } else {
            // Cell starts as non-editable - requires double-click to edit
            td.contentEditable = 'false'
            td.innerHTML = cell.content || ''
        }

        return td
    }

    /**
     * Apply border styles to element
     */
    applyBordersToElement(element, borders) {
        const getBorderCSS = (borderConfig) => {
            if (!borderConfig) return null

            // New format: { width: '1px', style: 'solid', color: '#000000' }
            if (borderConfig.width) {
                let width = borderConfig.width || '1px'
                let style = borderConfig.style || 'solid'
                const color = borderConfig.color || '#000000'

                // Convert legacy 'plain' to 'solid'
                if (style === 'plain') {
                    style = 'solid'
                }

                return `${width} ${style} ${color}`
            }

            // Legacy format compatibility: { style: 'plain', color: '#d1d5db' }
            let width = '1px'
            let style = 'solid'

            if (borderConfig.style === 'thick') {
                width = '3px'
            } else if (borderConfig.style === 'double') {
                width = '1px'
                style = 'double'
            } else if (borderConfig.style === 'plain') {
                width = '1px'
                style = 'solid'
            }

            const color = borderConfig.color || '#d1d5db'
            return `${width} ${style} ${color}`
        }

        const topCSS = getBorderCSS(borders.top)
        const bottomCSS = getBorderCSS(borders.bottom)
        const leftCSS = getBorderCSS(borders.left)
        const rightCSS = getBorderCSS(borders.right)

        if (borders.top) element.style.borderTop = topCSS
        if (borders.bottom) element.style.borderBottom = bottomCSS
        if (borders.left) element.style.borderLeft = leftCSS
        if (borders.right) element.style.borderRight = rightCSS
    }

    /**
     * Attach event listeners for selection and editing
     */
    attachEventListeners() {
        // Cell selection
        this.tableElement.addEventListener('mousedown', this.handleMouseDown.bind(this))
        this.tableElement.addEventListener('mouseover', this.handleMouseOver.bind(this))
        document.addEventListener('mouseup', this.handleMouseUp.bind(this))

        // Double-click to edit
        this.tableElement.addEventListener('dblclick', this.handleDoubleClick.bind(this))

        // Content editing
        this.tableElement.addEventListener('input', this.handleCellInput.bind(this))
        this.tableElement.addEventListener('blur', this.handleCellBlur.bind(this), true)

        // Text selection for floating toolbar
        document.addEventListener('selectionchange', this.handleSelectionChangeBound)

        // Context menu
        this.tableElement.addEventListener('contextmenu', this.handleContextMenu.bind(this))

        // Click outside to exit edit mode
        document.addEventListener('mousedown', this.handleClickOutsideBound)

        // Keyboard shortcuts (copy/cut/paste)
        document.addEventListener('keydown', this.handleKeyDownBound)
    }

    /**
     * Handle mouse down - start selection
     */
    handleMouseDown(e) {
        const cell = e.target.closest('td')
        if (!cell) return

        // If in edit mode and clicking the editing cell, allow interaction
        if (this.isEditMode && this.editingCell === cell) {
            return
        }

        // Exit edit mode if clicking different cell
        if (this.isEditMode && this.editingCell !== cell) {
            this.exitEditMode()
        }

        // Prevent default to avoid text selection during cell selection
        e.preventDefault()

        // If shift key is held, extend selection
        if (e.shiftKey && this.selection.startCell) {
            this.updateSelection(cell)
            return
        }

        // Start cell selection
        this.isSelecting = true
        this.startSelection(cell)
    }

    /**
     * Handle mouse over - update selection while dragging
     */
    handleMouseOver(e) {
        if (!this.isSelecting) return

        const cell = e.target.closest('td')
        if (!cell) return

        this.updateSelection(cell)
    }

    /**
     * Handle mouse up - end selection
     */
    handleMouseUp(e) {
        if (!this.isSelecting) return

        this.isSelecting = false
        this.endSelection()
    }

    /**
     * Handle double-click - enter edit mode
     */
    handleDoubleClick(e) {
        const cell = e.target.closest('td')
        if (!cell || cell.classList.contains('cell-image')) return

        e.preventDefault()
        e.stopPropagation()

        this.enterEditMode(cell)
    }

    /**
     * Enter edit mode for a cell
     */
    enterEditMode(cell) {
        // Exit any existing edit mode
        if (this.editingCell) {
            this.exitEditMode()
        }

        // Make cell editable
        cell.contentEditable = 'true'
        cell.classList.add('editing')

        // Focus and select all content
        cell.focus()

        // Select all text in the cell
        const range = document.createRange()
        range.selectNodeContents(cell)
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)

        // Track editing state
        this.isEditMode = true
        this.editingCell = cell
    }

    /**
     * Exit edit mode
     */
    exitEditMode() {
        if (!this.editingCell) return

        // Save content
        const rowIndex = parseInt(this.editingCell.dataset.rowIndex)
        const cellIndex = parseInt(this.editingCell.dataset.cellIndex)
        this.data.rows[rowIndex].cells[cellIndex].content = this.editingCell.innerHTML

        // Make cell non-editable
        this.editingCell.contentEditable = 'false'
        this.editingCell.classList.remove('editing')

        // Clear selection
        window.getSelection().removeAllRanges()

        // Reset state
        this.isEditMode = false
        this.editingCell = null

        this.notifyChange()
    }

    /**
     * Handle clicks outside the table
     */
    handleClickOutside(e) {
        if (!this.isEditMode) return

        // Check if click is outside the table
        if (!this.tableElement.contains(e.target)) {
            this.exitEditMode()
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyDown(e) {
        // Only handle shortcuts when not in edit mode
        if (this.isEditMode) return

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
        const modKey = isMac ? e.metaKey : e.ctrlKey

        // Copy: Ctrl/Cmd + C
        if (modKey && e.key === 'c' && !e.shiftKey) {
            if (this.selection.cells.length > 0) {
                e.preventDefault()
                this.copyCells()
            }
        }

        // Cut: Ctrl/Cmd + X
        if (modKey && e.key === 'x' && !e.shiftKey) {
            if (this.selection.cells.length > 0) {
                e.preventDefault()
                this.cutCells()
            }
        }

        // Paste: Ctrl/Cmd + V
        if (modKey && e.key === 'v' && !e.shiftKey) {
            if (this.clipboard && this.selection.cells.length > 0) {
                e.preventDefault()
                this.pasteCells()
            }
        }

        // Delete: Delete or Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selection.cells.length > 0 && !this.isEditMode) {
                e.preventDefault()
                this.clearSelectedCells()
            }
        }
    }

    /**
     * Copy selected cells to clipboard
     */
    copyCells() {
        if (this.selection.cells.length === 0) return

        // Store cell data with positions
        const clipboardData = this.selection.cells.map(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)
            const cellData = this.data.rows[rowIndex].cells[cellIndex]

            return {
                rowIndex,
                cellIndex,
                data: JSON.parse(JSON.stringify(cellData)) // Deep clone
            }
        })

        this.clipboard = clipboardData
        this.clipboardMode = 'copy'

        // Visual feedback
        this.showClipboardFeedback('Copied')
    }

    /**
     * Cut selected cells to clipboard
     */
    cutCells() {
        if (this.selection.cells.length === 0) return

        // Copy first
        this.copyCells()
        this.clipboardMode = 'cut'

        // Visual feedback for cut cells
        this.selection.cells.forEach(cell => {
            cell.style.opacity = '0.5'
        })

        this.showClipboardFeedback('Cut')
    }

    /**
     * Paste cells from clipboard
     */
    pasteCells() {
        if (!this.clipboard || this.selection.cells.length === 0) return

        // Only allow paste if exactly one cell is selected (target cell)
        if (this.selection.cells.length !== 1) {
            this.showClipboardFeedback('Select only one cell to paste')
            return
        }

        const targetCell = this.selection.cells[0]
        const targetRowIndex = parseInt(targetCell.dataset.rowIndex)
        const targetCellIndex = parseInt(targetCell.dataset.cellIndex)

        // Calculate the bounding box of copied cells
        const minRow = Math.min(...this.clipboard.map(c => c.rowIndex))
        const maxRow = Math.max(...this.clipboard.map(c => c.rowIndex))
        const minCol = Math.min(...this.clipboard.map(c => c.cellIndex))
        const maxCol = Math.max(...this.clipboard.map(c => c.cellIndex))

        const copyWidth = maxCol - minCol + 1
        const copyHeight = maxRow - minRow + 1

        // Check if there's enough space to paste
        const neededRows = targetRowIndex + copyHeight
        const neededCols = targetCellIndex + copyWidth

        if (neededRows > this.data.rows.length) {
            this.showClipboardFeedback(`Not enough rows (need ${copyHeight}, have ${this.data.rows.length - targetRowIndex})`)
            return
        }

        // Check if all rows have enough columns
        for (let i = 0; i < copyHeight; i++) {
            const rowIndex = targetRowIndex + i
            if (this.data.rows[rowIndex].cells.length < neededCols) {
                this.showClipboardFeedback(`Not enough columns in row ${rowIndex + 1} (need ${copyWidth})`)
                return
            }
        }

        // Calculate the offset from the first copied cell
        const rowOffset = targetRowIndex - minRow
        const cellOffset = targetCellIndex - minCol

        // Save state for undo
        this.saveState()

        // Paste each cell with offset
        this.clipboard.forEach(clipCell => {
            const newRowIndex = clipCell.rowIndex + rowOffset
            const newCellIndex = clipCell.cellIndex + cellOffset

            // Paste the cell data (we already validated bounds above)
            this.data.rows[newRowIndex].cells[newCellIndex] = JSON.parse(JSON.stringify(clipCell.data))
        })

        // If it was a cut operation, clear the original cells
        if (this.clipboardMode === 'cut') {
            this.clipboard.forEach(clipCell => {
                const cell = this.data.rows[clipCell.rowIndex].cells[clipCell.cellIndex]
                cell.content = ''
                cell.contentType = 'text'
            })

            // Remove visual feedback from cut cells
            document.querySelectorAll('td[style*="opacity"]').forEach(cell => {
                cell.style.opacity = ''
            })

            this.clipboardMode = 'copy' // Reset to copy mode
        }

        // Re-render and notify
        this.render()
        this.notifyChange()

        this.showClipboardFeedback('Pasted')
    }

    /**
     * Clear content of selected cells
     */
    clearSelectedCells() {
        if (this.selection.cells.length === 0) return

        this.saveState()

        this.selection.cells.forEach(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)
            this.data.rows[rowIndex].cells[cellIndex].content = ''
        })

        this.render()
        this.notifyChange()
    }

    /**
     * Show visual feedback for clipboard operations
     */
    showClipboardFeedback(message) {
        // Create or get feedback element
        let feedback = this.container.querySelector('.clipboard-feedback')

        if (!feedback) {
            feedback = document.createElement('div')
            feedback.className = 'clipboard-feedback'
            feedback.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                padding: 8px 16px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                border-radius: 4px;
                font-size: 14px;
                z-index: 1000;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s;
            `
            this.container.style.position = 'relative'
            this.container.appendChild(feedback)
        }

        feedback.textContent = message
        feedback.style.opacity = '1'

        // Fade out after 1 second
        setTimeout(() => {
            feedback.style.opacity = '0'
        }, 1000)
    }

    /**
     * Handle cell content input
     */
    handleCellInput(e) {
        const cell = e.target.closest('td')
        if (!cell || cell.classList.contains('cell-image')) return

        const rowIndex = parseInt(cell.dataset.rowIndex)
        const cellIndex = parseInt(cell.dataset.cellIndex)

        this.data.rows[rowIndex].cells[cellIndex].content = cell.innerHTML
        this.notifyChange()
    }

    /**
     * Handle cell blur - save content
     */
    handleCellBlur(e) {
        const cell = e.target.closest('td')
        if (!cell || cell.classList.contains('cell-image')) return

        const rowIndex = parseInt(cell.dataset.rowIndex)
        const cellIndex = parseInt(cell.dataset.cellIndex)

        this.data.rows[rowIndex].cells[cellIndex].content = cell.innerHTML
        this.notifyChange()
    }

    /**
     * Start selection at a cell
     */
    startSelection(cell) {
        this.clearSelection()

        this.selection.active = true
        this.selection.startCell = cell
        this.selection.endCell = cell
        this.selection.cells = [cell]

        cell.classList.add('selected')
        this.notifySelectionChange()
    }

    /**
     * Update selection to include cell
     */
    updateSelection(cell) {
        if (!this.selection.active) return

        this.selection.endCell = cell

        // Calculate rectangular region
        const cells = this.getSelectionRectangle(this.selection.startCell, cell)

        // Clear previous selection highlighting
        this.selection.cells.forEach(c => c.classList.remove('selected'))

        // Apply new selection
        this.selection.cells = cells
        cells.forEach(c => c.classList.add('selected'))

        this.notifySelectionChange()
    }

    /**
     * End selection
     */
    endSelection() {
        // Selection remains active until explicitly cleared
    }

    /**
     * Get rectangular selection between two cells
     */
    getSelectionRectangle(startCell, endCell) {
        const startRow = parseInt(startCell.dataset.rowIndex)
        const startCol = parseInt(startCell.dataset.cellIndex)
        const endRow = parseInt(endCell.dataset.rowIndex)
        const endCol = parseInt(endCell.dataset.cellIndex)

        const minRow = Math.min(startRow, endRow)
        const maxRow = Math.max(startRow, endRow)
        const minCol = Math.min(startCol, endCol)
        const maxCol = Math.max(startCol, endCol)

        const cells = []
        const rows = this.tableElement.querySelectorAll('tr')

        for (let r = minRow; r <= maxRow; r++) {
            const row = rows[r]
            if (!row) continue

            const rowCells = row.querySelectorAll('td')
            for (let c = minCol; c <= maxCol; c++) {
                const cell = rowCells[c]
                if (cell) cells.push(cell)
            }
        }

        return cells
    }

    /**
     * Clear current selection
     */
    clearSelection() {
        this.selection.cells.forEach(cell => cell.classList.remove('selected'))
        this.selection = {
            active: false,
            startCell: null,
            endCell: null,
            cells: []
        }
        this.notifySelectionChange()
    }

    /**
     * Get currently selected cells
     */
    getSelectedCells() {
        return this.selection.cells
    }

    /**
     * Add a row at the specified position
     */
    addRow(position = 'end') {
        const numCols = this.data.columnWidths.length
        const newRow = {
            cells: Array(numCols).fill(null).map(() => ({
                contentType: 'text',
                content: '',
                colspan: 1,
                rowspan: 1,
                fontStyle: 'normal',
                alignment: 'left',
                verticalAlignment: 'top'
            })),
            height: null
        }

        if (position === 'end') {
            this.data.rows.push(newRow)
        } else if (position === 'start') {
            this.data.rows.unshift(newRow)
        } else if (typeof position === 'number') {
            this.data.rows.splice(position, 0, newRow)
        }

        this.rerender()
        this.notifyChange()
    }

    /**
     * Remove a row at the specified index
     */
    removeRow(rowIndex) {
        if (this.data.rows.length <= 1) {
            alert('Cannot remove the last row')
            return
        }

        this.data.rows.splice(rowIndex, 1)
        this.rerender()
        this.notifyChange()
    }

    /**
     * Add a column at the specified position
     */
    addColumn(position = 'end') {
        this.data.rows.forEach(row => {
            const newCell = {
                contentType: 'text',
                content: '',
                colspan: 1,
                rowspan: 1,
                fontStyle: 'normal',
                alignment: 'left',
                verticalAlignment: 'top'
            }

            if (position === 'end') {
                row.cells.push(newCell)
            } else if (position === 'start') {
                row.cells.unshift(newCell)
            } else if (typeof position === 'number') {
                row.cells.splice(position, 0, newCell)
            }
        })

        // Update column widths
        if (position === 'end') {
            this.data.columnWidths.push('auto')
        } else if (position === 'start') {
            this.data.columnWidths.unshift('auto')
        } else if (typeof position === 'number') {
            this.data.columnWidths.splice(position, 0, 'auto')
        }

        this.rerender()
        this.notifyChange()
    }

    /**
     * Remove a column at the specified index
     */
    removeColumn(colIndex) {
        const numCols = this.data.columnWidths.length
        if (numCols <= 1) {
            alert('Cannot remove the last column')
            return
        }

        this.data.rows.forEach(row => {
            row.cells.splice(colIndex, 1)
        })

        this.data.columnWidths.splice(colIndex, 1)
        this.rerender()
        this.notifyChange()
    }

    /**
     * Check if selected cells can be merged
     */
    canMerge(cells = null) {
        const selectedCells = cells || this.getSelectedCells()
        if (selectedCells.length <= 1) return false

        // Check if cells form a valid rectangle
        const positions = selectedCells.map(cell => ({
            row: parseInt(cell.dataset.rowIndex),
            col: parseInt(cell.dataset.cellIndex)
        }))

        const rows = [...new Set(positions.map(p => p.row))].sort((a, b) => a - b)
        const cols = [...new Set(positions.map(p => p.col))].sort((a, b) => a - b)

        // Check if it's a contiguous rectangle
        for (let r = rows[0]; r <= rows[rows.length - 1]; r++) {
            for (let c = cols[0]; c <= cols[cols.length - 1]; c++) {
                if (!positions.some(p => p.row === r && p.col === c)) {
                    return false
                }
            }
        }

        return true
    }

    /**
     * Merge selected cells
     */
    mergeCells(cells = null) {
        const selectedCells = cells || this.getSelectedCells()

        if (!this.canMerge(selectedCells)) {
            alert('Cannot merge: cells must form a rectangular region')
            return
        }

        if (selectedCells.length <= 1) return

        // Get merge dimensions
        const positions = selectedCells.map(cell => ({
            row: parseInt(cell.dataset.rowIndex),
            col: parseInt(cell.dataset.cellIndex),
            cell
        }))

        const rows = [...new Set(positions.map(p => p.row))].sort((a, b) => a - b)
        const cols = [...new Set(positions.map(p => p.col))].sort((a, b) => a - b)

        const topRow = rows[0]
        const leftCol = cols[0]
        const rowspan = rows.length
        const colspan = cols.length

        // Merge content (concatenate)
        const mergedContent = selectedCells
            .map(cell => cell.textContent.trim())
            .filter(text => text.length > 0)
            .join(' ')

        // Update data model
        const targetCell = this.data.rows[topRow].cells[leftCol]
        targetCell.colspan = colspan
        targetCell.rowspan = rowspan
        targetCell.content = mergedContent

        // Mark other cells as merged (set colspan/rowspan to 0 or remove them)
        positions.forEach(({ row, col }) => {
            if (row !== topRow || col !== leftCol) {
                // Mark cell as part of merge (will be skipped in rendering)
                this.data.rows[row].cells[col]._merged = true
            }
        })

        this.rerender()
        this.notifyChange()
    }

    /**
     * Check if a cell can be split
     */
    canSplit(cell) {
        const rowIndex = parseInt(cell.dataset.rowIndex)
        const cellIndex = parseInt(cell.dataset.cellIndex)
        const cellData = this.data.rows[rowIndex].cells[cellIndex]

        return cellData.colspan > 1 || cellData.rowspan > 1
    }

    /**
     * Split a merged cell
     */
    splitCell(cell) {
        const rowIndex = parseInt(cell.dataset.rowIndex)
        const cellIndex = parseInt(cell.dataset.cellIndex)
        const cellData = this.data.rows[rowIndex].cells[cellIndex]

        if (!this.canSplit(cell)) return

        const { colspan, rowspan } = cellData

        // Reset target cell
        cellData.colspan = 1
        cellData.rowspan = 1

        // Restore merged cells
        for (let r = rowIndex; r < rowIndex + rowspan; r++) {
            for (let c = cellIndex; c < cellIndex + colspan; c++) {
                if (r === rowIndex && c === cellIndex) continue

                const cell = this.data.rows[r].cells[c]
                if (cell._merged) {
                    delete cell._merged
                }
            }
        }

        this.rerender()
        this.notifyChange()
    }

    /**
     * Grow cell by increasing colspan by 1
     */
    growCell(cell) {
        const rowIndex = parseInt(cell.dataset.rowIndex)
        const cellIndex = parseInt(cell.dataset.cellIndex)
        const cellData = this.data.rows[rowIndex].cells[cellIndex]

        // Check if we can grow (not at edge of table)
        const currentColspan = cellData.colspan || 1
        const currentCellIndex = cellIndex
        const rowCells = this.data.rows[rowIndex].cells

        // Find the actual number of columns by looking at the first row
        const totalColumns = this.data.rows[0].cells.reduce((sum, c) => sum + (c.colspan || 1), 0)

        // Check if growing would exceed table bounds
        if (currentCellIndex + currentColspan >= totalColumns) {
            return // Can't grow beyond table edge
        }

        // Increase colspan
        cellData.colspan = currentColspan + 1

        // Mark the next cell as merged
        const nextCellIndex = currentCellIndex + currentColspan
        if (nextCellIndex < rowCells.length) {
            rowCells[nextCellIndex]._merged = true
        }

        this.rerender()
        this.notifyChange()
    }

    /**
     * Shrink cell by decreasing colspan by 1 (minimum 1)
     */
    shrinkCell(cell) {
        const rowIndex = parseInt(cell.dataset.rowIndex)
        const cellIndex = parseInt(cell.dataset.cellIndex)
        const cellData = this.data.rows[rowIndex].cells[cellIndex]

        const currentColspan = cellData.colspan || 1

        // Can't shrink below 1
        if (currentColspan <= 1) {
            return
        }

        // Decrease colspan
        cellData.colspan = currentColspan - 1

        // Unmark the previously merged cell
        const rowCells = this.data.rows[rowIndex].cells
        const lastMergedIndex = cellIndex + currentColspan - 1
        if (lastMergedIndex < rowCells.length && rowCells[lastMergedIndex]._merged) {
            delete rowCells[lastMergedIndex]._merged
        }

        this.rerender()
        this.notifyChange()
    }

    /**
     * Apply formatting to text (bold, italic, link)
     * This works when editing a cell with text selected (used by floating toolbar)
     */
    applyFormatting(type) {
        const selection = window.getSelection()
        if (!selection.rangeCount) return

        document.execCommand(type, false, null)

        // Update cell content in data model
        const cell = this.getActiveCellFromSelection(selection)
        if (cell) {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)
            this.data.rows[rowIndex].cells[cellIndex].content = cell.innerHTML
            this.notifyChange()
        }
    }

    /**
     * Apply bold to entire content of selected cells
     */
    applyCellBold(cells) {
        cells.forEach(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)
            const cellData = this.data.rows[rowIndex].cells[cellIndex]

            // Skip image cells
            if (cellData.contentType === 'image') return

            // Use DOM parsing for robust toggle
            const temp = document.createElement('div')
            temp.innerHTML = cellData.content

            // Check if outermost element is strong/b
            const firstChild = temp.firstElementChild
            if (firstChild && (firstChild.tagName === 'STRONG' || firstChild.tagName === 'B')) {
                // Remove bold wrapper, keep inner content
                cellData.content = firstChild.innerHTML
            } else {
                // Wrap entire content in strong
                cellData.content = `<strong>${cellData.content}</strong>`
            }
        })

        this.rerender()
        this.notifyChange()
    }

    /**
     * Apply italic to entire content of selected cells
     */
    applyCellItalic(cells) {
        cells.forEach(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)
            const cellData = this.data.rows[rowIndex].cells[cellIndex]

            // Skip image cells
            if (cellData.contentType === 'image') return

            // Use DOM parsing for robust toggle
            const temp = document.createElement('div')
            temp.innerHTML = cellData.content

            // Check if outermost element is em/i
            const firstChild = temp.firstElementChild
            if (firstChild && (firstChild.tagName === 'EM' || firstChild.tagName === 'I')) {
                // Remove italic wrapper, keep inner content
                cellData.content = firstChild.innerHTML
            } else {
                // Wrap entire content in em
                cellData.content = `<em>${cellData.content}</em>`
            }
        })

        this.rerender()
        this.notifyChange()
    }

    /**
     * Insert link at current selection
     */
    insertLink(url, text, range, openInNewTab = false) {
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)

        if (text && text !== selection.toString()) {
            const startContainer = range.startContainer
            const startOffset = range.startOffset

            document.execCommand('insertText', false, text)

            const newRange = document.createRange()
            newRange.setStart(startContainer, startOffset)
            newRange.setEnd(startContainer, startOffset + text.length)

            selection.removeAllRanges()
            selection.addRange(newRange)
        }

        document.execCommand('createLink', false, url)

        if (openInNewTab) {
            const newLink = this.findLinkAtSelection()
            if (newLink) {
                newLink.setAttribute('target', '_blank')
                newLink.setAttribute('rel', 'noopener noreferrer')
            }
        }

        // Update cell content in data model
        const cell = this.getActiveCellFromSelection(selection)
        if (cell) {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)
            this.data.rows[rowIndex].cells[cellIndex].content = cell.innerHTML
            this.notifyChange()
        }
    }

    /**
     * Set cell type (text or image)
     */
    setCellType(cells, type) {
        cells.forEach(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)
            const cellData = this.data.rows[rowIndex].cells[cellIndex]

            if (type === 'text') {
                cellData.contentType = 'text'
                cellData.imageData = null
            } else if (type === 'image') {
                if (cellData.content && cellData.content.trim()) {
                    if (!confirm('Switching to image will replace the current text content. Continue?')) {
                        return
                    }
                }
                cellData.contentType = 'image'
                cellData.content = ''
            }
        })

        this.rerender()
        this.notifyChange()
    }

    /**
     * Set image for a cell
     */
    setCellImage(cell, imageData) {
        const rowIndex = parseInt(cell.dataset.rowIndex)
        const cellIndex = parseInt(cell.dataset.cellIndex)
        const cellData = this.data.rows[rowIndex].cells[cellIndex]

        cellData.contentType = 'image'
        cellData.imageData = imageData
        cellData.content = ''

        this.rerender()
        this.notifyChange()
    }

    /**
     * Apply font style to cells
     */
    applyFontStyle(cells, fontStyle) {
        cells.forEach(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)

            this.data.rows[rowIndex].cells[cellIndex].fontStyle = fontStyle
        })

        this.rerender()
        this.notifyChange()
    }

    /**
     * Get the opposite side for adjacent cell borders
     * @param {string} side - 'top', 'bottom', 'left', 'right'
     * @returns {string} Opposite side
     */
    getOppositeSide(side) {
        const opposites = {
            top: 'bottom',
            bottom: 'top',
            left: 'right',
            right: 'left'
        }
        return opposites[side]
    }

    /**
     * Find cells adjacent to a given side of a cell (considering merges)
     * @param {number} rowIndex - Row index of the source cell
     * @param {number} cellIndex - Cell index of the source cell
     * @param {string} side - 'top', 'bottom', 'left', 'right'
     * @returns {Array} Array of {rowIndex, cellIndex} objects for adjacent cells
     */
    findAdjacentCells(rowIndex, cellIndex, side) {
        const cellData = this.data.rows[rowIndex].cells[cellIndex]
        const colspan = cellData.colspan || 1
        const rowspan = cellData.rowspan || 1
        const adjacentCells = []

        if (side === 'bottom') {
            // Cells below: row (rowIndex + rowspan), columns [cellIndex ... cellIndex + colspan - 1]
            const targetRow = rowIndex + rowspan
            if (targetRow < this.data.rows.length) {
                for (let c = cellIndex; c < cellIndex + colspan; c++) {
                    if (c < this.data.rows[targetRow].cells.length) {
                        const targetCell = this.data.rows[targetRow].cells[c]
                        if (!targetCell._merged) {
                            adjacentCells.push({ rowIndex: targetRow, cellIndex: c })
                        }
                    }
                }
            }
        } else if (side === 'top') {
            // Cells above: row (rowIndex - 1), columns [cellIndex ... cellIndex + colspan - 1]
            const targetRow = rowIndex - 1
            if (targetRow >= 0) {
                for (let c = cellIndex; c < cellIndex + colspan; c++) {
                    if (c < this.data.rows[targetRow].cells.length) {
                        const targetCell = this.data.rows[targetRow].cells[c]
                        if (!targetCell._merged) {
                            adjacentCells.push({ rowIndex: targetRow, cellIndex: c })
                        }
                    }
                }
            }
        } else if (side === 'right') {
            // Cells to the right: column (cellIndex + colspan), rows [rowIndex ... rowIndex + rowspan - 1]
            const targetCol = cellIndex + colspan
            for (let r = rowIndex; r < rowIndex + rowspan; r++) {
                if (r < this.data.rows.length && targetCol < this.data.rows[r].cells.length) {
                    const targetCell = this.data.rows[r].cells[targetCol]
                    if (!targetCell._merged) {
                        adjacentCells.push({ rowIndex: r, cellIndex: targetCol })
                    }
                }
            }
        } else if (side === 'left') {
            // Cells to the left: column (cellIndex - 1), rows [rowIndex ... rowIndex + rowspan - 1]
            const targetCol = cellIndex - 1
            if (targetCol >= 0) {
                for (let r = rowIndex; r < rowIndex + rowspan; r++) {
                    if (r < this.data.rows.length && targetCol < this.data.rows[r].cells.length) {
                        const targetCell = this.data.rows[r].cells[targetCol]
                        if (!targetCell._merged) {
                            adjacentCells.push({ rowIndex: r, cellIndex: targetCol })
                        }
                    }
                }
            }
        }

        return adjacentCells
    }

    /**
     * Set borders for cells
     * @param {Array} cells - Selected cells
     * @param {Object} sides - Object with sides as keys and boolean values (true=add, false=remove)
     * @param {Object} borderStyle - { width: '1px', style: 'solid', color: '#000000' }
     */
    setBorders(cells, sides, borderStyle) {
        cells.forEach(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)
            const cellData = this.data.rows[rowIndex].cells[cellIndex]

            if (!cellData.borders) {
                cellData.borders = {}
            }

            // Apply border changes for each side
            Object.keys(sides).forEach(side => {
                const shouldAdd = sides[side] === true
                const shouldRemove = sides[side] === false

                if (shouldAdd || shouldRemove) {
                    // Apply to current cell
                    if (shouldAdd) {
                        cellData.borders[side] = {
                            width: borderStyle.width,
                            style: borderStyle.style,
                            color: borderStyle.color
                        }
                    } else {
                        delete cellData.borders[side]
                    }

                    // Apply to adjacent cells on opposite side
                    const adjacentCells = this.findAdjacentCells(rowIndex, cellIndex, side)
                    const oppositeSide = this.getOppositeSide(side)

                    adjacentCells.forEach(({ rowIndex: adjRow, cellIndex: adjCol }) => {
                        const adjCellData = this.data.rows[adjRow].cells[adjCol]

                        if (!adjCellData.borders) {
                            adjCellData.borders = {}
                        }

                        if (shouldAdd) {
                            adjCellData.borders[oppositeSide] = {
                                width: borderStyle.width,
                                style: borderStyle.style,
                                color: borderStyle.color
                            }
                        } else {
                            delete adjCellData.borders[oppositeSide]
                        }
                    })
                }
                // If null (mixed), don't change
            })
        })

        this.rerender()
        this.notifyChange()
    }

    /**
     * Set colors for cells
     */
    setColors(cells, colorType, value) {
        cells.forEach(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)
            const cellData = this.data.rows[rowIndex].cells[cellIndex]

            if (colorType === 'background') {
                cellData.backgroundColor = value
            } else if (colorType === 'text') {
                cellData.textColor = value
            } else if (colorType === 'hoverBackground') {
                cellData.hoverBgColor = value
            } else if (colorType === 'hoverText') {
                cellData.hoverTextColor = value
            }
        })

        this.rerender()
        this.notifyChange()
    }

    /**
     * Set horizontal alignment for cells
     */
    setAlignment(cells, alignment) {
        cells.forEach(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)

            this.data.rows[rowIndex].cells[cellIndex].alignment = alignment
        })

        this.rerender()
        this.notifyChange()
    }

    /**
     * Set vertical alignment for cells
     */
    setVerticalAlignment(cells, verticalAlignment) {
        cells.forEach(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)

            this.data.rows[rowIndex].cells[cellIndex].verticalAlignment = verticalAlignment
        })

        this.rerender()
        this.notifyChange()
    }

    /**
     * Set column width
     */
    setColumnWidth(colIndex, width) {
        this.data.columnWidths[colIndex] = width

        const colgroup = this.tableElement.querySelector('colgroup')
        const cols = colgroup.querySelectorAll('col')
        if (cols[colIndex]) {
            cols[colIndex].style.width = width
        }

        this.notifyChange()
    }

    /**
     * Set row height
     */
    setRowHeight(rowIndex, height) {
        this.data.rows[rowIndex].height = height

        const rows = this.tableElement.querySelectorAll('tr')
        if (rows[rowIndex]) {
            rows[rowIndex].style.height = height
        }

        this.notifyChange()
    }

    /**
     * Re-render the table
     */
    rerender() {
        const currentSelection = this.selection.cells.map(cell => ({
            row: parseInt(cell.dataset.rowIndex),
            col: parseInt(cell.dataset.cellIndex)
        }))

        this.render(this.container)

        // Restore selection if possible
        if (currentSelection.length > 0) {
            const cells = []
            currentSelection.forEach(({ row, col }) => {
                const cell = this.tableElement.querySelector(
                    `td[data-row-index="${row}"][data-cell-index="${col}"]`
                )
                if (cell) cells.push(cell)
            })

            if (cells.length > 0) {
                this.selection.cells = cells
                this.selection.active = true
                cells.forEach(c => c.classList.add('selected'))
            }
        }
    }

    /**
     * Validate table structure
     * Returns { isValid: boolean, issues: string[], expectedColumns: number }
     */
    validateTableStructure() {
        const issues = []

        // Calculate expected number of columns from columnWidths
        const expectedColumns = this.data.columnWidths.length

        // Check each row
        this.data.rows.forEach((row, rowIndex) => {
            // Count actual columns including colspan
            let columnCount = 0
            row.cells.forEach(cell => {
                if (!cell._merged) {
                    columnCount += (cell.colspan || 1)
                }
            })

            if (columnCount !== expectedColumns) {
                issues.push(`Row ${rowIndex + 1}: has ${columnCount} columns, expected ${expectedColumns}`)
            }

            // Check for orphaned _merged cells
            const mergedCells = row.cells.filter(c => c._merged)
            if (mergedCells.length > 0) {
                const visibleCells = row.cells.filter(c => !c._merged)
                if (visibleCells.length === 0) {
                    issues.push(`Row ${rowIndex + 1}: all cells marked as merged (orphaned)`)
                }
            }
        })

        // Check for inconsistent number of cells in rows (even counting _merged)
        const cellCounts = this.data.rows.map(row => row.cells.length)
        const uniqueCounts = [...new Set(cellCounts)]
        if (uniqueCounts.length > 1) {
            issues.push(`Inconsistent cell counts: rows have ${uniqueCounts.join(', ')} cells`)
        }

        return {
            isValid: issues.length === 0,
            issues,
            expectedColumns
        }
    }

    /**
     * Fix table structure to ensure consistent grid
     */
    fixTableStructure() {
        // First pass: Remove all _merged markers and reset merges
        this.data.rows.forEach(row => {
            row.cells = row.cells.filter(cell => !cell._merged)
            row.cells.forEach(cell => {
                delete cell._merged
                // Reset all spans to 1
                cell.colspan = 1
                cell.rowspan = 1
            })
        })

        // Calculate target number of columns as the maximum from all rows
        let targetColumns = 0
        this.data.rows.forEach(row => {
            const rowColumns = row.cells.length
            targetColumns = Math.max(targetColumns, rowColumns)
        })

        // If no rows or all empty, use minimum of 2 columns
        if (targetColumns === 0) {
            targetColumns = 2
        }

        // Second pass: Ensure each row has exactly targetColumns cells
        this.data.rows.forEach(row => {
            if (row.cells.length < targetColumns) {
                // Add missing cells
                const missing = targetColumns - row.cells.length
                for (let i = 0; i < missing; i++) {
                    row.cells.push({
                        contentType: 'text',
                        content: '',
                        colspan: 1,
                        rowspan: 1,
                        fontStyle: 'normal',
                        alignment: 'left',
                        verticalAlignment: 'top'
                    })
                }
            } else if (row.cells.length > targetColumns) {
                // Remove excess cells (prefer removing empty cells from end)
                while (row.cells.length > targetColumns) {
                    // Try to find an empty cell to remove
                    let removedEmpty = false
                    for (let i = row.cells.length - 1; i >= 0; i--) {
                        const cell = row.cells[i]
                        if (!cell.content || cell.content.trim() === '') {
                            row.cells.splice(i, 1)
                            removedEmpty = true
                            break
                        }
                    }

                    // If no empty cells, remove from end
                    if (!removedEmpty) {
                        row.cells.pop()
                    }
                }
            }
        })

        // Update columnWidths to match
        this.data.columnWidths = Array(targetColumns).fill('auto')

        this.rerender()
        this.notifyChange()

        return this.validateTableStructure()
    }

    /**
     * Export table data to JSON
     */
    toJSON() {
        // Filter out merged cells
        const cleanedData = {
            ...this.data,
            rows: this.data.rows.map(row => ({
                ...row,
                cells: row.cells.filter(cell => !cell._merged)
            }))
        }

        return cleanedData
    }

    /**
     * Update table with new data
     */
    updateTable(newData) {
        this.data = this.normalizeData(newData)
        this.rerender()
    }

    /**
     * Notify change listeners
     */
    notifyChange() {
        if (this.options.onChange) {
            this.options.onChange(this.toJSON())
        }
    }

    /**
     * Notify selection change listeners
     */
    notifySelectionChange() {
        if (this.options.onSelectionChange) {
            this.options.onSelectionChange(this.selection.cells)
        }
    }

    /**
     * Handle selection change - show/hide floating toolbar
     */
    handleSelectionChange() {
        // Only show floating toolbar when in edit mode
        if (!this.isEditMode) {
            this.floatingToolbar.hide()
            return
        }

        const textSel = this.getTextSelection()

        if (textSel && textSel.text.trim() && this.isSelectionInTable(textSel.selection)) {
            this.floatingToolbar.show(textSel.rect)
            this.floatingToolbar.updateButtonStates(textSel.selection)
        } else {
            this.floatingToolbar.hide()
        }
    }

    /**
     * Check if selection is within this table
     */
    isSelectionInTable(selection) {
        if (!selection || !selection.rangeCount) return false

        let node = selection.getRangeAt(0).startContainer

        while (node && node !== document.body) {
            if (node === this.tableElement) return true
            node = node.parentNode
        }

        return false
    }

    /**
     * Get text selection information
     */
    getTextSelection() {
        const selection = window.getSelection()
        if (!selection || selection.isCollapsed) return null

        const text = selection.toString()
        if (!text || !text.trim()) return null

        try {
            const range = selection.getRangeAt(0)
            const rect = range.getBoundingClientRect()

            return {
                selection,
                range,
                text,
                rect
            }
        } catch (err) {
            return null
        }
    }

    /**
     * Check if has text selection
     */
    hasTextSelection() {
        const selection = window.getSelection()
        return selection && !selection.isCollapsed && selection.toString().trim().length > 0
    }

    /**
     * Handle context menu
     */
    handleContextMenu(e) {
        // Check global context menu config first, then LayoutRenderer
        const globalEnabled = window.__contextMenuConfig?.enabled ?? true
        const layoutEnabled = window.__layoutRenderer?.uiConfig?.enableContextMenu ?? true
        const enabled = globalEnabled && layoutEnabled
        
        if (!enabled) {
            return
        }

        e.preventDefault()

        const cell = e.target.closest('td')
        const context = {
            selectedCells: this.getSelectedCells(),
            textSelection: this.getTextSelection(),
            clickedCell: cell
        }

        this.contextMenu.show(e, context)
    }

    /**
     * Show link modal
     */
    async showLinkModal() {
        const textSel = this.getTextSelection()
        if (!textSel) return

        // Check if selection contains existing link
        const linkElement = this.findLinkAtSelection(textSel.selection)

        const linkData = {
            url: linkElement?.getAttribute('href') || '',
            text: textSel.text,
            openInNewTab: linkElement?.getAttribute('target') === '_blank',
            linkElement,
            range: textSel.range
        }

        try {
            const result = await this.linkModal.show(linkData)

            if (result.action === 'remove') {
                this.removeLink(linkElement)
            } else if (result.action === 'insert') {
                this.insertLink(result.url, result.text, textSel.range, result.openInNewTab)
            }
        } catch (err) {
            // User cancelled
        }
    }

    /**
     * Find link element at selection
     */
    findLinkAtSelection(selection) {
        if (!selection) selection = window.getSelection()
        if (!selection || !selection.rangeCount) return null

        let node = selection.getRangeAt(0).startContainer

        // Traverse up to find link element
        while (node && node !== this.tableElement) {
            if (node.nodeName === 'A') return node
            node = node.parentNode
        }

        return null
    }

    /**
     * Remove a link element
     */
    removeLink(linkElement) {
        if (!linkElement) return

        const parent = linkElement.parentNode
        while (linkElement.firstChild) {
            parent.insertBefore(linkElement.firstChild, linkElement)
        }
        parent.removeChild(linkElement)

        // Update cell content in data model
        const cell = parent.closest('td')
        if (cell) {
            const rowIndex = parseInt(cell.dataset.rowIndex)
            const cellIndex = parseInt(cell.dataset.cellIndex)
            this.data.rows[rowIndex].cells[cellIndex].content = cell.innerHTML
            this.notifyChange()
        }
    }

    /**
     * Get active cell from selection
     */
    getActiveCellFromSelection(selection) {
        if (!selection || !selection.rangeCount) return null

        let node = selection.getRangeAt(0).startContainer

        while (node && node !== this.tableElement) {
            if (node.nodeName === 'TD') return node
            node = node.parentNode
        }

        return null
    }

    /**
     * Destroy the editor and clean up
     */
    /**
     * Activate the table editor (for detached toolbar mode)
     * Registers with the global toolbar manager
     */
    activate() {
        if (this.isActive) return;

        this.isActive = true;

        // Register with toolbar manager if in detached toolbar mode
        if (this.options.detachedToolbar) {
            tableToolbarManager.registerEditor(this);

            // Set up command listener
            this.setupCommandListener();
        }

        // Add visual indication of active state
        if (this.container) {
            this.container.classList.add('table-editor-active');
        }
    }

    /**
     * Deactivate the table editor
     * Unregisters from the global toolbar manager
     */
    deactivate() {
        if (!this.isActive) return;

        this.isActive = false;

        // Unregister from toolbar manager if in detached toolbar mode
        if (this.options.detachedToolbar) {
            tableToolbarManager.unregisterEditor(this);

            // Remove command listener
            if (this.handleCommandBound && this.container) {
                this.container.removeEventListener('table-command', this.handleCommandBound);
                this.handleCommandBound = null;
            }
        }

        // Remove visual indication
        if (this.container) {
            this.container.classList.remove('table-editor-active');
        }

        // Clear selection
        this.clearSelection();
    }

    /**
     * Set up listener for commands from detached toolbar
     */
    setupCommandListener() {
        if (!this.container) return;

        // Remove existing listener if any
        if (this.handleCommandBound) {
            this.container.removeEventListener('table-command', this.handleCommandBound);
        }

        // Create bound handler
        this.handleCommandBound = (event) => {
            const { command, value } = event.detail;
            this.handleToolbarCommand(command, value);
        };

        // Add listener
        this.container.addEventListener('table-command', this.handleCommandBound);
    }

    /**
     * Handle commands from the global toolbar
     */
    handleToolbarCommand(command, value) {
        const selectedCells = this.getSelectedCells();

        switch (command) {
            // Structure commands
            case 'addRow':
                this.addRow(value || 'end');
                break;
            case 'removeRow':
                if (selectedCells.length > 0) {
                    const rowIndex = parseInt(selectedCells[0].dataset.rowIndex);
                    this.removeRow(rowIndex);
                }
                break;
            case 'addColumn':
                this.addColumn(value || 'end');
                break;
            case 'removeColumn':
                if (selectedCells.length > 0) {
                    const colIndex = parseInt(selectedCells[0].dataset.cellIndex);
                    this.removeColumn(colIndex);
                }
                break;

            // Cell operations
            case 'mergeCells':
                this.mergeCells();
                break;
            case 'splitCell':
                if (selectedCells.length === 1) {
                    this.splitCell(selectedCells[0]);
                }
                break;
            case 'growCell':
                if (selectedCells.length === 1) {
                    this.growCell(selectedCells[0]);
                }
                break;
            case 'shrinkCell':
                if (selectedCells.length === 1) {
                    this.shrinkCell(selectedCells[0]);
                }
                break;

            // Content type
            case 'setCellType':
                this.setCellType(selectedCells, value);
                break;

            // Formatting
            case 'bold':
                if (selectedCells.length > 0) {
                    this.applyCellBold(selectedCells);
                }
                break;
            case 'italic':
                if (selectedCells.length > 0) {
                    this.applyCellItalic(selectedCells);
                }
                break;

            // Alignment
            case 'alignLeft':
            case 'alignCenter':
            case 'alignRight':
                this.setAlignment(selectedCells, value || command.replace('align', '').toLowerCase());
                break;
            case 'alignTop':
            case 'alignMiddle':
            case 'alignBottom':
                this.setVerticalAlignment(selectedCells, value || command.replace('align', '').toLowerCase());
                break;

            // Font style
            case 'fontStyle':
                this.applyFontStyle(selectedCells, value);
                break;

            // Borders
            case 'setBorders':
                this.setBorders(selectedCells, value.sides, value.style);
                break;

            // Colors
            case 'setColor':
                this.setColors(selectedCells, value.type, value.color);
                break;

            // Import
            case 'openImport':
                // Trigger import modal (handled by React wrapper)
                if (this.container) {
                    const event = new CustomEvent('open-import-modal');
                    this.container.dispatchEvent(event);
                }
                break;

            // Toggle grid
            case 'toggleGrid':
                this.toggleGrid();
                break;
        }
    }

    /**
     * Toggle grid visibility for better cell visibility
     */
    toggleGrid() {
        this.showGrid = !this.showGrid;

        if (this.tableElement) {
            if (this.showGrid) {
                this.tableElement.classList.add('show-grid');
            } else {
                this.tableElement.classList.remove('show-grid');
            }
        }
    }

    /**
     * Get current toolbar state for the global toolbar UI
     */
    getToolbarState() {
        const selectedCells = this.getSelectedCells();

        // Check if the selected cell can be split, grown, or shrunk
        let canSplit = false;
        let canGrow = false;
        let canShrink = false;

        if (selectedCells.length === 1) {
            canSplit = this.canSplit(selectedCells[0]);

            // Check if cell can grow
            const cell = selectedCells[0];
            const rowIndex = parseInt(cell.dataset.rowIndex);
            const cellIndex = parseInt(cell.dataset.cellIndex);
            const cellData = this.data.rows[rowIndex]?.cells[cellIndex];

            if (cellData) {
                const currentColspan = cellData.colspan || 1;
                const totalColumns = this.data.rows[0].cells.reduce((sum, c) => sum + (c.colspan || 1), 0);

                // Can grow if not at edge of table
                canGrow = (cellIndex + currentColspan < totalColumns);

                // Can shrink if colspan > 1
                canShrink = currentColspan > 1;
            }
        }

        const state = {
            selectedCellsCount: selectedCells.length,
            canMerge: selectedCells.length > 1,
            canSplit: canSplit,
            canGrow: canGrow,
            canShrink: canShrink,
            hasSelection: selectedCells.length > 0,
            showGrid: this.showGrid,
            borders: null,
            colors: null,
            alignment: null,
            verticalAlignment: null,
            fontStyle: null
        };

        // Get border state from first selected cell
        if (selectedCells.length > 0 && this.data.rows) {
            try {
                const firstCell = selectedCells[0];
                const rowIndex = parseInt(firstCell.dataset.rowIndex);
                const cellIndex = parseInt(firstCell.dataset.cellIndex);
                const cellData = this.data.rows[rowIndex]?.cells[cellIndex];

                if (cellData) {
                    state.borders = cellData.borders || null;
                    state.colors = {
                        background: cellData.backgroundColor || '#ffffff',
                        text: cellData.textColor || '#000000',
                        hoverBackground: cellData.hoverBackgroundColor || '#f3f4f6',
                        hoverText: cellData.hoverTextColor || '#000000'
                    };
                    state.alignment = cellData.alignment || 'left';
                    state.verticalAlignment = cellData.verticalAlignment || 'top';
                    state.fontStyle = cellData.fontStyle || 'normal';
                }
            } catch (error) {
                // Ignore errors in state retrieval
            }
        }

        return state;
    }

    destroy() {
        // Deactivate if active
        if (this.isActive) {
            this.deactivate();
        }

        // Exit edit mode if active
        if (this.isEditMode) {
            this.exitEditMode()
        }

        // Clean up event listeners
        document.removeEventListener('selectionchange', this.handleSelectionChangeBound)
        document.removeEventListener('mousedown', this.handleClickOutsideBound)
        document.removeEventListener('keydown', this.handleKeyDownBound)

        // Destroy components
        if (this.floatingToolbar) {
            this.floatingToolbar.destroy()
            this.floatingToolbar = null
        }

        if (this.contextMenu) {
            this.contextMenu.destroy()
            this.contextMenu = null
        }

        if (this.container) {
            this.container.innerHTML = ''
        }
    }
}

export default TableEditorCore

