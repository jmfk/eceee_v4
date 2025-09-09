/**
 * ContentWidgetEditorRenderer.js
 * Vanilla JS WYSIWYG editor renderer for ContentWidget
 * 
 * This class replaces the React-based ContentWidgetEditor with pure DOM manipulation
 * to avoid conflicts between React and document.execCommand() operations.
 */

/**
 * Clean up HTML content by removing unsupported tags and attributes
 * Ported from ContentWidget.jsx cleanHTML function
 */
const cleanHTML = (html) => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html

    // Remove unsupported tags
    const unsupportedTags = ['script', 'style', 'link', 'meta', 'iframe', 'embed', 'object', 'img', 'video', 'audio', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'form', 'input', 'button', 'select', 'textarea']
    unsupportedTags.forEach(tag => {
        const elements = tempDiv.querySelectorAll(tag)
        elements.forEach(el => el.remove())
    })

    // Remove all attributes except basic ones
    const allowedAttributes = ['href']
    const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_ELEMENT)
    const elements = []
    let node
    while (node = walker.nextNode()) {
        elements.push(node)
    }

    elements.forEach(el => {
        const attrs = Array.from(el.attributes)
        attrs.forEach(attr => {
            if (!allowedAttributes.includes(attr.name)) {
                el.removeAttribute(attr.name)
            }
        })
    })

    return tempDiv.innerHTML
}

/**
 * SVG Icons (replacing Lucide React icons)
 */
const ICONS = {
    bold: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>`,
    italic: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>`,
    list: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
    listOrdered: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1.5S2 14 2 15"/></svg>`,
    undo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="m21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>`,
    redo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="m3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/></svg>`
}

class ContentWidgetEditorRenderer {
    constructor(container, options = {}) {
        this.container = container
        this.content = options.content || ''
        this.onChange = options.onChange || (() => { })
        this.className = options.className || ''

        // DOM elements
        this.rootElement = null
        this.toolbarElement = null
        this.editorElement = null

        // State
        this.isDestroyed = false
        this.eventListeners = new Map() // Track event listeners for cleanup

        // Bind methods to maintain 'this' context
        this.handleContentChange = this.handleContentChange.bind(this)
        this.handlePaste = this.handlePaste.bind(this)
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.execCommand = this.execCommand.bind(this)
    }

    /**
     * Create and render the editor DOM structure
     */
    render() {
        if (this.isDestroyed) {
            console.warn('ContentWidgetEditorRenderer: Cannot render on destroyed instance')
            return
        }

        // Clean up existing content
        this.cleanup()

        // Create root container
        this.rootElement = document.createElement('div')
        this.rootElement.className = `content-editor ${this.className}`

        // Create toolbar
        this.createToolbar()

        // Create editor area
        this.createEditor()

        // Append to container
        this.container.appendChild(this.rootElement)

        // Set initial content
        this.setContent(this.content)
    }

    /**
     * Create toolbar with all buttons and controls
     */
    createToolbar() {
        this.toolbarElement = document.createElement('div')
        this.toolbarElement.className = 'toolbar flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50'

        // Bold button
        const boldButton = this.createToolbarButton('bold', 'Bold', ICONS.bold)
        this.toolbarElement.appendChild(boldButton)

        // Italic button
        const italicButton = this.createToolbarButton('italic', 'Italic', ICONS.italic)
        this.toolbarElement.appendChild(italicButton)

        // Separator
        this.toolbarElement.appendChild(this.createSeparator())

        // Format dropdown
        const formatSelect = this.createFormatDropdown()
        this.toolbarElement.appendChild(formatSelect)

        // Separator
        this.toolbarElement.appendChild(this.createSeparator())

        // Unordered list button
        const ulButton = this.createToolbarButton('insertUnorderedList', 'Bullet List', ICONS.list)
        this.toolbarElement.appendChild(ulButton)

        // Ordered list button
        const olButton = this.createToolbarButton('insertOrderedList', 'Numbered List', ICONS.listOrdered)
        this.toolbarElement.appendChild(olButton)

        // Separator
        this.toolbarElement.appendChild(this.createSeparator())

        // Undo button
        const undoButton = this.createToolbarButton('undo', 'Undo', ICONS.undo)
        this.toolbarElement.appendChild(undoButton)

        // Redo button
        const redoButton = this.createToolbarButton('redo', 'Redo', ICONS.redo)
        this.toolbarElement.appendChild(redoButton)

        this.rootElement.appendChild(this.toolbarElement)
    }

    /**
     * Create a toolbar button
     */
    createToolbarButton(command, title, iconSvg) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'p-1 hover:bg-gray-200 rounded'
        button.title = title
        button.innerHTML = iconSvg

        const clickHandler = (e) => {
            e.preventDefault()
            this.execCommand(command)
        }

        button.addEventListener('click', clickHandler)
        this.eventListeners.set(button, () => {
            button.removeEventListener('click', clickHandler)
        })

        return button
    }

    /**
     * Create format dropdown
     */
    createFormatDropdown() {
        const select = document.createElement('select')
        select.className = 'text-sm border border-gray-300 rounded px-2 py-1'

        const options = [
            { value: '', label: 'Format' },
            { value: '<h1>', label: 'Heading 1' },
            { value: '<h2>', label: 'Heading 2' },
            { value: '<h3>', label: 'Heading 3' },
            { value: '<h4>', label: 'Heading 4' },
            { value: '<h5>', label: 'Heading 5' },
            { value: '<h6>', label: 'Heading 6' },
            { value: '<p>', label: 'Paragraph' }
        ]

        options.forEach(opt => {
            const option = document.createElement('option')
            option.value = opt.value
            option.textContent = opt.label
            if (opt.value === '') option.selected = true
            select.appendChild(option)
        })

        const changeHandler = (e) => {
            if (e.target.value) {
                this.execCommand('formatBlock', e.target.value)
                e.target.value = '' // Reset to default
            }
        }

        select.addEventListener('change', changeHandler)
        this.eventListeners.set(select, () => {
            select.removeEventListener('change', changeHandler)
        })

        return select
    }

    /**
     * Create separator element
     */
    createSeparator() {
        const separator = document.createElement('div')
        separator.className = 'w-px h-6 bg-gray-300 mx-1'
        return separator
    }

    /**
     * Create contentEditable editor area
     */
    createEditor() {
        this.editorElement = document.createElement('div')
        this.editorElement.contentEditable = true
        this.editorElement.className = 'p-3 min-h-32 outline-none'
        this.editorElement.style.lineHeight = '1.6'

        // Add event listeners
        this.editorElement.addEventListener('input', this.handleContentChange)
        this.editorElement.addEventListener('paste', this.handlePaste)
        this.editorElement.addEventListener('keydown', this.handleKeyDown)

        // Track event listeners for cleanup
        this.eventListeners.set(this.editorElement, () => {
            this.editorElement.removeEventListener('input', this.handleContentChange)
            this.editorElement.removeEventListener('paste', this.handlePaste)
            this.editorElement.removeEventListener('keydown', this.handleKeyDown)
        })

        this.rootElement.appendChild(this.editorElement)
    }

    /**
     * Handle content changes
     */
    handleContentChange() {
        if (this.editorElement && this.onChange) {
            const cleanedContent = cleanHTML(this.editorElement.innerHTML)
            // Only call onChange if content actually changed
            if (cleanedContent !== this.content) {
                this.content = cleanedContent
                this.onChange(cleanedContent)
            }
        }
    }

    /**
     * Handle paste events
     */
    handlePaste(e) {
        e.preventDefault()
        const paste = (e.clipboardData || window.clipboardData).getData('text/html') ||
            (e.clipboardData || window.clipboardData).getData('text/plain')
        const cleanedPaste = cleanHTML(paste)
        document.execCommand('insertHTML', false, cleanedPaste)
        this.handleContentChange()
    }

    /**
     * Handle key down events
     */
    handleKeyDown(e) {
        // Tab handling for indentation
        if (e.key === 'Tab') {
            e.preventDefault()
            if (e.shiftKey) {
                this.execCommand('outdent')
            } else {
                this.execCommand('indent')
            }
        }
        // Enter key handling for lists
        else if (e.key === 'Enter') {
            setTimeout(this.handleContentChange, 0)
        }
    }

    /**
     * Execute editor commands
     */
    execCommand(command, value = null) {
        document.execCommand(command, false, value)
        this.handleContentChange()
    }

    /**
     * Set editor content
     */
    setContent(content) {
        if (this.editorElement && content !== this.editorElement.innerHTML) {
            this.content = content
            this.editorElement.innerHTML = content
        }
    }

    /**
     * Update configuration
     */
    updateConfig(options = {}) {
        if (options.content !== undefined) {
            this.setContent(options.content)
        }
        if (options.onChange !== undefined) {
            this.onChange = options.onChange
        }
        if (options.className !== undefined) {
            this.className = options.className
            if (this.rootElement) {
                this.rootElement.className = `content-editor ${this.className}`
            }
        }
    }

    /**
     * Clean up event listeners and DOM elements
     */
    cleanup() {
        // Remove all event listeners
        this.eventListeners.forEach((cleanup, element) => {
            if (typeof cleanup === 'function') {
                cleanup()
            }
        })
        this.eventListeners.clear()

        // Remove DOM elements
        if (this.rootElement && this.rootElement.parentNode) {
            this.rootElement.parentNode.removeChild(this.rootElement)
        }

        // Reset references
        this.rootElement = null
        this.toolbarElement = null
        this.editorElement = null
    }

    /**
     * Destroy the renderer
     */
    destroy() {
        this.cleanup()
        this.isDestroyed = true
        this.onChange = null
    }
}

export default ContentWidgetEditorRenderer
