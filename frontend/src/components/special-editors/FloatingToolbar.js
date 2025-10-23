/**
 * FloatingToolbar - Floating text formatting toolbar for table cells
 * 
 * Appears above/below selected text with Bold, Italic, and Link buttons
 */

const ICONS = {
    bold: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
        <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
    </svg>`,
    italic: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="19" y1="4" x2="10" y2="4"></line>
        <line x1="14" y1="20" x2="5" y2="20"></line>
        <line x1="15" y1="4" x2="9" y2="20"></line>
    </svg>`,
    link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>`
}

export class FloatingToolbar {
    constructor(container, options = {}) {
        this.container = container
        this.toolbar = null
        this.visible = false
        this.options = {
            onBold: options.onBold || (() => { }),
            onItalic: options.onItalic || (() => { }),
            onLink: options.onLink || (() => { }),
            ...options
        }

        this.buttons = new Map()
        this.createToolbar()
    }

    /**
     * Create the floating toolbar element
     */
    createToolbar() {
        this.toolbar = document.createElement('div')
        this.toolbar.className = 'table-floating-toolbar'
        this.toolbar.style.display = 'none'
        this.toolbar.style.position = 'absolute'
        this.toolbar.style.zIndex = '10000'

        // Bold button
        const boldButton = this.createButton('bold', 'Bold', ICONS.bold, () => {
            this.options.onBold()
            // Update button states after formatting
            setTimeout(() => this.updateButtonStates(window.getSelection()), 10)
        })
        this.buttons.set('bold', boldButton)
        this.toolbar.appendChild(boldButton)

        // Italic button
        const italicButton = this.createButton('italic', 'Italic', ICONS.italic, () => {
            this.options.onItalic()
            // Update button states after formatting
            setTimeout(() => this.updateButtonStates(window.getSelection()), 10)
        })
        this.buttons.set('italic', italicButton)
        this.toolbar.appendChild(italicButton)

        // Link button
        const linkButton = this.createButton('link', 'Insert/Edit Link', ICONS.link, () => {
            this.options.onLink()
        })
        this.buttons.set('link', linkButton)
        this.toolbar.appendChild(linkButton)

        // Append to container
        this.container.appendChild(this.toolbar)
    }

    /**
     * Create a toolbar button
     */
    createButton(name, title, icon, onClick) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'table-floating-toolbar-button'
        button.title = title
        button.innerHTML = icon

        button.addEventListener('mousedown', (e) => {
            // Prevent losing text selection
            e.preventDefault()
        })

        button.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            onClick()
        })

        return button
    }

    /**
     * Show the toolbar positioned near the selected text
     */
    show(rect) {
        if (!rect) return

        this.visible = true
        this.toolbar.style.display = 'flex'

        // Position toolbar
        const toolbarRect = this.toolbar.getBoundingClientRect()
        const containerRect = this.container.getBoundingClientRect()

        // Calculate position relative to container
        let top = rect.top - containerRect.top - toolbarRect.height - 8
        let left = rect.left - containerRect.left + (rect.width / 2) - (toolbarRect.width / 2)

        // If toolbar would go above viewport, show it below the selection
        if (rect.top - toolbarRect.height - 8 < 0) {
            top = rect.bottom - containerRect.top + 8
        }

        // Keep toolbar within container bounds
        const maxLeft = containerRect.width - toolbarRect.width - 8
        left = Math.max(8, Math.min(left, maxLeft))

        this.toolbar.style.top = `${top}px`
        this.toolbar.style.left = `${left}px`
    }

    /**
     * Hide the toolbar
     */
    hide() {
        this.visible = false
        this.toolbar.style.display = 'none'
    }

    /**
     * Update button states based on current selection
     */
    updateButtonStates(selection) {
        if (!selection || selection.isCollapsed) {
            // Clear all active states
            this.buttons.forEach(button => button.classList.remove('active'))
            return
        }

        // Check if selection is bold
        const isBold = document.queryCommandState('bold')
        const boldButton = this.buttons.get('bold')
        if (boldButton) {
            if (isBold) {
                boldButton.classList.add('active')
            } else {
                boldButton.classList.remove('active')
            }
        }

        // Check if selection is italic
        const isItalic = document.queryCommandState('italic')
        const italicButton = this.buttons.get('italic')
        if (italicButton) {
            if (isItalic) {
                italicButton.classList.add('active')
            } else {
                italicButton.classList.remove('active')
            }
        }

        // Check if selection contains a link
        const linkButton = this.buttons.get('link')
        if (linkButton) {
            const hasLink = this.isSelectionInLink(selection)
            if (hasLink) {
                linkButton.classList.add('active')
            } else {
                linkButton.classList.remove('active')
            }
        }
    }

    /**
     * Check if selection is within a link
     */
    isSelectionInLink(selection) {
        if (!selection || !selection.rangeCount) return false

        let node = selection.getRangeAt(0).startContainer

        // Traverse up to find link element
        while (node && node !== this.container) {
            if (node.nodeName === 'A') return true
            node = node.parentNode
        }

        return false
    }

    /**
     * Destroy the toolbar
     */
    destroy() {
        if (this.toolbar && this.toolbar.parentNode) {
            this.toolbar.parentNode.removeChild(this.toolbar)
        }
        this.toolbar = null
        this.buttons.clear()
    }
}

export default FloatingToolbar

