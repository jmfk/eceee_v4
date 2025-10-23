/**
 * TableContextMenu - Context menu for table editor
 * 
 * Shows context-aware options on right-click
 */

export class TableContextMenu {
    constructor(tableCore, options = {}) {
        this.tableCore = tableCore
        this.options = options
        this.menu = null
        this.visible = false
        this.currentContext = null

        this.createMenu()
        this.attachGlobalListeners()
    }

    /**
     * Create the context menu element
     */
    createMenu() {
        this.menu = document.createElement('div')
        this.menu.className = 'table-context-menu'
        this.menu.style.display = 'none'
        this.menu.style.position = 'fixed'
        this.menu.style.zIndex = '10000'

        document.body.appendChild(this.menu)
    }

    /**
     * Attach global event listeners
     */
    attachGlobalListeners() {
        // Close menu on click outside
        document.addEventListener('click', (e) => {
            if (this.visible && !this.menu.contains(e.target)) {
                this.hide()
            }
        })

        // Close menu on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.visible) {
                this.hide()
            }
        })
    }

    /**
     * Show the context menu
     * @param {MouseEvent} e - Mouse event
     * @param {Object} context - { selectedCells, textSelection, clickedCell }
     */
    show(e, context) {
        this.currentContext = context

        // Build menu items based on context
        const items = this.getContextMenuItems(context)

        if (items.length === 0) {
            return // Don't show empty menu
        }

        // Render menu items
        this.renderMenuItems(items)

        // Position menu
        this.positionMenu(e.clientX, e.clientY)

        // Show menu
        this.visible = true
        this.menu.style.display = 'block'
    }

    /**
     * Get context menu items based on current context
     */
    getContextMenuItems(context) {
        const items = []

        // Text formatting options (if text is selected)
        if (context.textSelection && context.textSelection.text.trim()) {
            items.push(
                { label: 'Bold', icon: 'B', action: () => this.handleBold() },
                { label: 'Italic', icon: 'I', action: () => this.handleItalic() },
                { label: 'Insert Link', action: () => this.handleInsertLink() },
                { type: 'separator' }
            )
        }

        // Cell operations (if cells are selected)
        if (context.selectedCells && context.selectedCells.length > 1) {
            const canMerge = this.tableCore.canMerge(context.selectedCells)
            if (canMerge) {
                items.push(
                    { label: 'Merge Cells', action: () => this.handleMergeCells() }
                )
            }
        }

        if (context.selectedCells && context.selectedCells.length === 1) {
            const cell = context.selectedCells[0]
            if (this.tableCore.canSplit(cell)) {
                items.push(
                    { label: 'Split Cell', action: () => this.handleSplitCell(cell) }
                )
            }
        }

        // Alignment options (if cells are selected)
        if (context.selectedCells && context.selectedCells.length > 0) {
            if (items.length > 0) {
                items.push({ type: 'separator' })
            }

            items.push(
                {
                    label: 'Horizontal Alignment',
                    type: 'submenu',
                    submenu: [
                        { label: 'Left', action: () => this.handleSetAlignment('left') },
                        { label: 'Center', action: () => this.handleSetAlignment('center') },
                        { label: 'Right', action: () => this.handleSetAlignment('right') }
                    ]
                },
                {
                    label: 'Vertical Alignment',
                    type: 'submenu',
                    submenu: [
                        { label: 'Top', action: () => this.handleSetVerticalAlignment('top') },
                        { label: 'Middle', action: () => this.handleSetVerticalAlignment('middle') },
                        { label: 'Bottom', action: () => this.handleSetVerticalAlignment('bottom') }
                    ]
                }
            )
        }

        // Row/column operations (if a cell was clicked)
        if (context.clickedCell) {
            if (items.length > 0) {
                items.push({ type: 'separator' })
            }

            const rowIndex = parseInt(context.clickedCell.dataset.rowIndex)
            const colIndex = parseInt(context.clickedCell.dataset.cellIndex)

            items.push(
                { label: 'Insert Row Above', action: () => this.handleInsertRow(rowIndex) },
                { label: 'Insert Row Below', action: () => this.handleInsertRow(rowIndex + 1) },
                { label: 'Insert Column Left', action: () => this.handleInsertColumn(colIndex) },
                { label: 'Insert Column Right', action: () => this.handleInsertColumn(colIndex + 1) }
            )

            // Dimensions
            items.push({ type: 'separator' })
            items.push(
                { label: 'Set Row Height', action: () => this.handleSetRowHeight(rowIndex) },
                { label: 'Set Column Width', action: () => this.handleSetColumnWidth(colIndex) }
            )

            // Delete options
            items.push({ type: 'separator' })
            items.push(
                { label: 'Delete Row', className: 'text-red-700', action: () => this.handleDeleteRow(rowIndex) },
                { label: 'Delete Column', className: 'text-red-700', action: () => this.handleDeleteColumn(colIndex) }
            )
        }

        // Table utilities (always available)
        items.push({ type: 'separator' })
        items.push(
            { label: 'Fix Table Layout', action: () => this.handleFixTableLayout() }
        )

        return items
    }

    /**
     * Render menu items into the menu element
     */
    renderMenuItems(items) {
        this.menu.innerHTML = ''

        items.forEach(item => {
            if (item.type === 'separator') {
                const separator = document.createElement('div')
                separator.className = 'table-context-menu-separator'
                this.menu.appendChild(separator)
            } else if (item.type === 'submenu') {
                const menuItem = this.createSubmenuItem(item)
                this.menu.appendChild(menuItem)
            } else {
                const menuItem = this.createMenuItem(item)
                this.menu.appendChild(menuItem)
            }
        })
    }

    /**
     * Create a regular menu item
     */
    createMenuItem(item) {
        const menuItem = document.createElement('div')
        menuItem.className = 'table-context-menu-item'

        if (item.className) {
            menuItem.className += ' ' + item.className
        }

        if (item.icon) {
            const icon = document.createElement('span')
            icon.className = 'font-bold text-xs'
            icon.textContent = item.icon
            menuItem.appendChild(icon)
        }

        const label = document.createElement('span')
        label.textContent = item.label
        menuItem.appendChild(label)

        menuItem.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            item.action()
            this.hide()
        })

        return menuItem
    }

    /**
     * Create a submenu item
     */
    createSubmenuItem(item) {
        const menuItemWrapper = document.createElement('div')
        menuItemWrapper.className = 'table-context-menu-item-wrapper'

        const menuItem = document.createElement('div')
        menuItem.className = 'table-context-menu-item has-submenu'

        const label = document.createElement('span')
        label.textContent = item.label
        menuItem.appendChild(label)

        // Arrow indicator
        const arrow = document.createElement('span')
        arrow.className = 'submenu-arrow'
        arrow.innerHTML = '▶'
        menuItem.appendChild(arrow)

        // Create submenu
        const submenu = document.createElement('div')
        submenu.className = 'table-context-submenu'
        submenu.style.display = 'none'

        // Add submenu items
        item.submenu.forEach(subitem => {
            if (subitem.type === 'separator') {
                const separator = document.createElement('div')
                separator.className = 'table-context-menu-separator'
                submenu.appendChild(separator)
            } else {
                const subMenuItem = this.createMenuItem(subitem)
                submenu.appendChild(subMenuItem)
            }
        })

        // Show/hide submenu on hover
        let hideTimeout = null

        menuItemWrapper.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout)
            submenu.style.display = 'block'

            // Position submenu to the right of the menu item
            const rect = menuItemWrapper.getBoundingClientRect()
            submenu.style.left = `${menuItemWrapper.offsetWidth}px`
            submenu.style.top = '0px'

            // Check if submenu goes off screen
            setTimeout(() => {
                const submenuRect = submenu.getBoundingClientRect()
                if (submenuRect.right > window.innerWidth - 10) {
                    // Show submenu to the left instead
                    submenu.style.left = 'auto'
                    submenu.style.right = `${menuItemWrapper.offsetWidth}px`
                }
            }, 0)
        })

        menuItemWrapper.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                submenu.style.display = 'none'
            }, 200)
        })

        menuItemWrapper.appendChild(menuItem)
        menuItemWrapper.appendChild(submenu)

        return menuItemWrapper
    }

    /**
     * Position the menu at the specified coordinates
     */
    positionMenu(x, y) {
        // Show menu off-screen first to measure it
        this.menu.style.left = '-9999px'
        this.menu.style.top = '-9999px'
        this.menu.style.display = 'block'

        const menuRect = this.menu.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        // Calculate position, ensuring menu stays within viewport
        let left = x
        let top = y

        // Adjust if menu would go off right edge
        if (left + menuRect.width > viewportWidth - 10) {
            left = viewportWidth - menuRect.width - 10
        }

        // Adjust if menu would go off bottom edge
        if (top + menuRect.height > viewportHeight - 10) {
            top = viewportHeight - menuRect.height - 10
        }

        // Ensure menu doesn't go off left or top edges
        left = Math.max(10, left)
        top = Math.max(10, top)

        this.menu.style.left = `${left}px`
        this.menu.style.top = `${top}px`
    }

    /**
     * Hide the context menu
     */
    hide() {
        this.visible = false
        this.menu.style.display = 'none'
        this.currentContext = null
    }

    // Action handlers

    handleBold() {
        this.tableCore.applyFormatting('bold')
    }

    handleItalic() {
        this.tableCore.applyFormatting('italic')
    }

    handleInsertLink() {
        this.tableCore.showLinkModal()
    }

    handleMergeCells() {
        this.tableCore.mergeCells()
    }

    handleSplitCell(cell) {
        this.tableCore.splitCell(cell)
    }

    handleInsertRow(position) {
        this.tableCore.addRow(position)
    }

    handleInsertColumn(position) {
        this.tableCore.addColumn(position)
    }

    handleDeleteRow(rowIndex) {
        this.tableCore.removeRow(rowIndex)
    }

    handleDeleteColumn(colIndex) {
        this.tableCore.removeColumn(colIndex)
    }

    handleSetRowHeight(rowIndex) {
        const currentHeight = this.tableCore.data.rows[rowIndex].height || 'auto'
        const height = prompt('Enter row height (e.g., auto, 50px, 3rem):', currentHeight)

        if (height !== null) {
            this.tableCore.setRowHeight(rowIndex, height)
        }
    }

    handleSetColumnWidth(colIndex) {
        const currentWidth = this.tableCore.data.columnWidths[colIndex] || 'auto'
        const width = prompt('Enter column width (e.g., auto, 200px, 30%):', currentWidth)

        if (width !== null) {
            this.tableCore.setColumnWidth(colIndex, width)
        }
    }

    handleSetAlignment(alignment) {
        const selectedCells = this.tableCore.getSelectedCells()
        if (selectedCells.length === 0) return

        this.tableCore.setAlignment(selectedCells, alignment)
    }

    handleSetVerticalAlignment(verticalAlignment) {
        const selectedCells = this.tableCore.getSelectedCells()
        if (selectedCells.length === 0) return

        this.tableCore.setVerticalAlignment(selectedCells, verticalAlignment)
    }

    handleFixTableLayout() {
        if (confirm('This will normalize the table structure, reset all merges to colspan=1 and rowspan=1, and ensure all rows have the same number of columns. Continue?')) {
            const result = this.tableCore.fixTableStructure()

            if (result.isValid) {
                alert('Table structure has been fixed! All rows now have consistent columns.')
            } else {
                alert('Table structure was normalized. Some manual adjustments may still be needed.')
            }
        }
    }

    /**
     * Destroy the context menu
     */
    destroy() {
        if (this.menu && this.menu.parentNode) {
            this.menu.parentNode.removeChild(this.menu)
        }
        this.menu = null
    }
}

export default TableContextMenu

