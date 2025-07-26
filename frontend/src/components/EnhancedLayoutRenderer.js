/**
 * Enhanced LayoutRenderer with built-in UI capabilities
 * Extends LayoutRenderer.js with dynamic UI without React dependencies
 */
import LayoutRenderer from './LayoutRenderer.js'

class EnhancedLayoutRenderer extends LayoutRenderer {
    constructor() {
        super()
        this.uiElements = new Map() // Track UI elements
        this.uiCallbacks = new Map() // Track UI callbacks
    }

    /**
     * Add UI overlay to a slot
     * @param {string} slotName - Name of the slot
     * @param {Object} uiConfig - UI configuration
     */
    addSlotUI(slotName, uiConfig = {}) {
        const slotElement = this.slotContainers.get(slotName)
        if (!slotElement) {
            console.warn(`EnhancedLayoutRenderer: Slot "${slotName}" not found`)
            return
        }

        // Create UI container
        const uiContainer = document.createElement('div')
        uiContainer.className = 'slot-ui-overlay absolute top-2 right-2 z-10'

        // Add edit button
        if (uiConfig.showEditButton !== false) {
            const editBtn = this.createButton('Edit', 'bg-blue-500 hover:bg-blue-600', () => {
                uiConfig.onEdit?.(slotName)
            })
            uiContainer.appendChild(editBtn)
        }

        // Add widget button
        if (uiConfig.showAddWidget) {
            const addBtn = this.createButton('+ Widget', 'bg-green-500 hover:bg-green-600', () => {
                uiConfig.onAddWidget?.(slotName)
            })
            uiContainer.appendChild(addBtn)
        }

        // Add visibility toggle
        if (uiConfig.showVisibilityToggle) {
            const toggleBtn = this.createButton('👁', 'bg-gray-500 hover:bg-gray-600', () => {
                this.toggleSlotVisibility(slotName)
                uiConfig.onToggleVisibility?.(slotName)
            })
            uiContainer.appendChild(toggleBtn)
        }

        // Position container relative
        slotElement.style.position = 'relative'
        slotElement.appendChild(uiContainer)

        // Track UI elements
        this.uiElements.set(slotName, uiContainer)
    }

    /**
     * Create a button element
     * @param {string} text - Button text
     * @param {string} className - CSS classes
     * @param {Function} onClick - Click handler
     * @returns {HTMLElement} Button element
     */
    createButton(text, className, onClick) {
        const button = document.createElement('button')
        button.textContent = text
        button.className = `px-2 py-1 text-white text-xs rounded mr-1 ${className}`

        if (onClick) {
            const cleanup = () => {
                button.removeEventListener('click', onClick)
            }
            button.addEventListener('click', onClick)
            this.eventListeners.set(button, cleanup)
        }

        return button
    }

    /**
     * Toggle slot visibility
     * @param {string} slotName - Name of the slot
     */
    toggleSlotVisibility(slotName) {
        const slotElement = this.slotContainers.get(slotName)
        if (slotElement) {
            const isVisible = slotElement.style.display !== 'none'
            slotElement.style.display = isVisible ? 'none' : 'block'
            slotElement.style.opacity = isVisible ? '0.5' : '1'
        }
    }

    /**
     * Add drag and drop UI to slot
     * @param {string} slotName - Name of the slot
     * @param {Object} dragConfig - Drag configuration
     */
    addDragDropUI(slotName, dragConfig = {}) {
        const slotElement = this.slotContainers.get(slotName)
        if (!slotElement) return

        // Make slot droppable
        slotElement.setAttribute('draggable', 'false')
        slotElement.style.minHeight = '60px'

        // Add drop zone styling
        const addDropZoneStyle = () => {
            slotElement.classList.add('border-2', 'border-dashed', 'border-blue-300', 'bg-blue-50')
        }

        const removeDropZoneStyle = () => {
            slotElement.classList.remove('border-2', 'border-dashed', 'border-blue-300', 'bg-blue-50')
        }

        // Drag events
        const handleDragOver = (e) => {
            e.preventDefault()
            addDropZoneStyle()
        }

        const handleDragLeave = (e) => {
            if (!slotElement.contains(e.relatedTarget)) {
                removeDropZoneStyle()
            }
        }

        const handleDrop = (e) => {
            e.preventDefault()
            removeDropZoneStyle()

            try {
                const data = JSON.parse(e.dataTransfer.getData('text/plain'))
                dragConfig.onDrop?.(slotName, data)
            } catch (error) {
                console.error('EnhancedLayoutRenderer: Error handling drop', error)
            }
        }

        // Add event listeners
        slotElement.addEventListener('dragover', handleDragOver)
        slotElement.addEventListener('dragleave', handleDragLeave)
        slotElement.addEventListener('drop', handleDrop)

        // Track cleanup
        this.eventListeners.set(slotElement, () => {
            slotElement.removeEventListener('dragover', handleDragOver)
            slotElement.removeEventListener('dragleave', handleDragLeave)
            slotElement.removeEventListener('drop', handleDrop)
        })
    }

    /**
     * Add contextual menu to slot
     * @param {string} slotName - Name of the slot
     * @param {Array} menuItems - Menu items configuration
     */
    addContextMenu(slotName, menuItems = []) {
        const slotElement = this.slotContainers.get(slotName)
        if (!slotElement) return

        const handleContextMenu = (e) => {
            e.preventDefault()
            this.showContextMenu(e.clientX, e.clientY, menuItems, slotName)
        }

        slotElement.addEventListener('contextmenu', handleContextMenu)
        this.eventListeners.set(`context-${slotName}`, () => {
            slotElement.removeEventListener('contextmenu', handleContextMenu)
        })
    }

    /**
     * Show context menu
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Array} items - Menu items
     * @param {string} slotName - Slot name
     */
    showContextMenu(x, y, items, slotName) {
        // Remove existing menus
        document.querySelectorAll('.layout-context-menu').forEach(menu => menu.remove())

        const menu = document.createElement('div')
        menu.className = 'layout-context-menu fixed bg-white border border-gray-200 rounded shadow-lg z-50'
        menu.style.left = `${x}px`
        menu.style.top = `${y}px`

        items.forEach(item => {
            const menuItem = document.createElement('button')
            menuItem.className = 'block w-full text-left px-4 py-2 text-sm hover:bg-gray-100'
            menuItem.textContent = item.label
            menuItem.onclick = () => {
                item.action?.(slotName)
                menu.remove()
            }
            menu.appendChild(menuItem)
        })

        document.body.appendChild(menu)

        // Remove on click outside
        const handleClickOutside = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove()
                document.removeEventListener('click', handleClickOutside)
            }
        }
        setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
    }

    /**
     * Remove UI from slot
     * @param {string} slotName - Name of the slot
     */
    removeSlotUI(slotName) {
        const uiElement = this.uiElements.get(slotName)
        if (uiElement) {
            uiElement.remove()
            this.uiElements.delete(slotName)
        }
    }

    /**
     * Enhanced cleanup
     */
    destroy() {
        // Remove all UI elements
        this.uiElements.forEach(element => element.remove())
        this.uiElements.clear()
        this.uiCallbacks.clear()

        // Remove context menus
        document.querySelectorAll('.layout-context-menu').forEach(menu => menu.remove())

        // Call parent cleanup
        super.destroy()
    }
}

export default EnhancedLayoutRenderer 