/**
 * WysiwygContextMenu - Context menu for WYSIWYG editor
 * 
 * Shows context-aware options on right-click in the WYSIWYG editor
 */

export class WysiwygContextMenu {
    constructor(editorRenderer, options = {}) {
        this.editorRenderer = editorRenderer
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
        this.menu.className = 'wysiwyg-context-menu'
        this.menu.style.display = 'none'
        this.menu.style.position = 'fixed'
        this.menu.style.zIndex = '10001'

        document.body.appendChild(this.menu)
    }

    /**
     * Attach global event listeners
     */
    attachGlobalListeners() {
        // Close menu on click outside
        this.clickOutsideHandler = (e) => {
            if (this.visible && !this.menu.contains(e.target)) {
                this.hide()
            }
        }
        document.addEventListener('click', this.clickOutsideHandler)

        // Close menu on escape key
        this.escapeHandler = (e) => {
            if (e.key === 'Escape' && this.visible) {
                this.hide()
            }
        }
        document.addEventListener('keydown', this.escapeHandler)
    }

    /**
     * Show the context menu
     * @param {MouseEvent} e - Mouse event
     * @param {Object} context - Editor context information
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
        if (context.hasTextSelection) {
            items.push(
                {
                    label: 'Bold',
                    icon: 'B',
                    action: () => this.handleBold(),
                    isActive: context.bold
                },
                {
                    label: 'Italic',
                    icon: 'I',
                    action: () => this.handleItalic(),
                    isActive: context.italic
                },
                { type: 'separator' }
            )
        }

        // Format blocks (always available)
        items.push(
            {
                label: 'Paragraph',
                action: () => this.handleFormatBlock('<p>'),
                isActive: context.format === 'Paragraph'
            }
        )

        // Add heading options based on maxHeaderLevel
        const maxHeaderLevel = context.maxHeaderLevel || 3
        for (let i = 1; i <= maxHeaderLevel; i++) {
            items.push({
                label: `Heading ${i}`,
                action: () => this.handleFormatBlock(`<h${i}>`),
                isActive: context.format === `Heading ${i}`
            })
        }

        items.push({ type: 'separator' })

        // List formatting (always available)
        items.push(
            {
                label: 'Bullet List',
                action: () => this.handleInsertUnorderedList(),
                isActive: context.insertUnorderedList
            },
            {
                label: 'Numbered List',
                action: () => this.handleInsertOrderedList(),
                isActive: context.insertOrderedList
            },
            { type: 'separator' }
        )

        // Link options (context-aware)
        if (context.hasTextSelection && !context.isOnLink) {
            items.push({
                label: 'Insert Link',
                action: () => this.handleInsertLink()
            })
        }

        if (context.isOnLink) {
            items.push(
                {
                    label: 'Edit Link',
                    action: () => this.handleEditLink()
                },
                {
                    label: 'Remove Link',
                    action: () => this.handleRemoveLink()
                }
            )
        }

        if (context.hasTextSelection || context.isOnLink) {
            items.push({ type: 'separator' })
        }

        // Media options
        items.push({
            label: 'Add Image',
            action: () => this.handleAddImage()
        })

        if (context.isOnMedia) {
            items.push({
                label: 'Edit Image',
                action: () => this.handleEditImage()
            })
        }

        items.push({ type: 'separator' })

        // History (always available)
        items.push(
            {
                label: 'Undo',
                action: () => this.handleUndo()
            },
            {
                label: 'Redo',
                action: () => this.handleRedo()
            },
            { type: 'separator' }
        )

        // Cleanup (always available)
        items.push({
            label: 'Clean HTML',
            action: () => this.handleCleanup()
        })

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
                separator.className = 'wysiwyg-context-menu-separator'
                this.menu.appendChild(separator)
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
        menuItem.className = 'wysiwyg-context-menu-item'

        if (item.className) {
            menuItem.className += ' ' + item.className
        }

        // Add icon if present
        if (item.icon) {
            const icon = document.createElement('span')
            icon.className = 'menu-item-icon font-bold text-xs'
            icon.textContent = item.icon
            menuItem.appendChild(icon)
        }

        // Add checkmark for active items
        if (item.isActive) {
            const checkmark = document.createElement('span')
            checkmark.className = 'menu-item-checkmark'
            checkmark.textContent = '✓'
            menuItem.appendChild(checkmark)
        } else if (!item.icon) {
            // Add spacer if no icon and not active (for alignment)
            const spacer = document.createElement('span')
            spacer.className = 'menu-item-spacer'
            menuItem.appendChild(spacer)
        }

        // Add label
        const label = document.createElement('span')
        label.textContent = item.label
        menuItem.appendChild(label)

        // Add click handler
        menuItem.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            item.action()
            this.hide()
        })

        return menuItem
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

    // Action handlers - delegate to editor renderer

    handleBold() {
        this.editorRenderer.execCommand('bold')
    }

    handleItalic() {
        this.editorRenderer.execCommand('italic')
    }

    handleFormatBlock(format) {
        this.editorRenderer.execCommand('formatBlock', format)
    }

    handleInsertUnorderedList() {
        this.editorRenderer.execCommand('insertUnorderedList')
    }

    handleInsertOrderedList() {
        this.editorRenderer.execCommand('insertOrderedList')
    }

    handleInsertLink() {
        this.editorRenderer.execCommand('createLink')
    }

    handleEditLink() {
        this.editorRenderer.execCommand('createLink')
    }

    handleRemoveLink() {
        this.editorRenderer.execCommand('unlink')
    }

    handleAddImage() {
        this.editorRenderer.execCommand('addImage')
    }

    handleEditImage() {
        this.editorRenderer.execCommand('editImage')
    }

    handleUndo() {
        this.editorRenderer.execCommand('undo')
    }

    handleRedo() {
        this.editorRenderer.execCommand('redo')
    }

    handleCleanup() {
        this.editorRenderer.execCommand('cleanup')
    }

    /**
     * Destroy the context menu
     */
    destroy() {
        // Remove event listeners
        if (this.clickOutsideHandler) {
            document.removeEventListener('click', this.clickOutsideHandler)
        }
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler)
        }

        // Remove DOM element
        if (this.menu && this.menu.parentNode) {
            this.menu.parentNode.removeChild(this.menu)
        }
        this.menu = null
    }
}

export default WysiwygContextMenu

