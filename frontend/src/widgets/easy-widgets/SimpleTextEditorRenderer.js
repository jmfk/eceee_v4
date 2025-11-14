/**
 * SimpleTextEditorRenderer.js
 * Vanilla JS text editor for Hero, Banner, and ContentCard widgets
 * 
 * Supports two modes:
 * - text-only: Plain text editing, no formatting, no toolbar
 * - inline-rich: Bold, italic, link formatting via global toolbar (no block elements)
 * 
 * Integrates with the global WYSIWYG toolbar system (wysiwygToolbarManager)
 */

/**
 * Clean HTML to only allow inline formatting
 */
const cleanInlineHTML = (html) => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html

    // Only allow inline tags
    const allowedTags = ['strong', 'b', 'em', 'i', 'a', 'br']
    const allowedAttributes = ['href', 'target']

    // Remove all non-allowed tags
    const allElements = tempDiv.querySelectorAll('*')
    const elementsToProcess = Array.from(allElements).reverse()

    elementsToProcess.forEach(el => {
        const tagName = el.tagName.toLowerCase()

        if (!allowedTags.includes(tagName)) {
            // Unwrap disallowed tags, keep content
            while (el.firstChild) {
                el.parentNode.insertBefore(el.firstChild, el)
            }
            el.remove()
        } else {
            // Clean attributes
            const attrs = Array.from(el.attributes)
            attrs.forEach(attr => {
                if (!allowedAttributes.includes(attr.name)) {
                    el.removeAttribute(attr.name)
                }
            })
        }
    })

    return tempDiv.innerHTML
}

/**
 * Strip all HTML tags, return plain text
 */
const stripHTML = (html) => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    return tempDiv.textContent || tempDiv.innerText || ''
}

/**
 * SimpleTextEditorRenderer class
 */
export class SimpleTextEditorRenderer {
    constructor(container, options = {}) {
        this.container = container
        this.options = {
            content: '',
            mode: 'text-only', // 'text-only' or 'inline-rich'
            onChange: null,
            placeholder: '',
            element: 'div', // HTML element type: 'div', 'h1', 'h2', 'h5', 'h6'
            ...options
        }

        this.editorElement = null
        this.isActive = false

        // Bind methods
        this.handleContentChange = this.handleContentChange.bind(this)
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.handlePaste = this.handlePaste.bind(this)
        this.handleCommand = this.handleCommand.bind(this)
        this.activate = this.activate.bind(this)
        this.deactivate = this.deactivate.bind(this)
    }

    /**
     * Render the editor
     */
    render() {
        // Clear container
        this.container.innerHTML = ''

        // Create editor element
        this.createEditor()
        this.container.appendChild(this.editorElement)

        // Set initial content
        this.setContent(this.options.content)
    }

    /**
     * Create editor element
     */
    createEditor() {
        this.editorElement = document.createElement(this.options.element)
        this.editorElement.contentEditable = true
        this.editorElement.className = 'simple-text-editor outline-none'
        
        // Add placeholder attribute if provided
        if (this.options.placeholder) {
            this.editorElement.setAttribute('data-placeholder', this.options.placeholder)
        }

        // Add event listeners
        this.editorElement.addEventListener('input', this.handleContentChange)
        this.editorElement.addEventListener('paste', this.handlePaste)
        this.editorElement.addEventListener('keydown', this.handleKeyDown)

        // For inline-rich mode, listen for commands from global toolbar
        if (this.options.mode === 'inline-rich') {
            this.editorElement.addEventListener('wysiwyg-command', this.handleCommand)
        }

        // Focus/blur handlers for activation/deactivation
        this.editorElement.addEventListener('focus', this.activate)
        this.editorElement.addEventListener('blur', this.deactivate)
    }

    /**
     * Set content
     */
    setContent(content) {
        if (!this.editorElement) return

        if (this.options.mode === 'text-only') {
            // Plain text only
            this.editorElement.textContent = stripHTML(content || '')
        } else {
            // Inline rich - clean and set HTML
            this.editorElement.innerHTML = cleanInlineHTML(content || '')
        }
    }

    /**
     * Get content
     */
    getContent() {
        if (!this.editorElement) return ''

        if (this.options.mode === 'text-only') {
            return this.editorElement.textContent || ''
        } else {
            return cleanInlineHTML(this.editorElement.innerHTML)
        }
    }

    /**
     * Handle content change
     */
    handleContentChange() {
        if (this.options.onChange) {
            const content = this.getContent()
            this.options.onChange(content)
        }
    }

    /**
     * Handle paste
     */
    handlePaste(e) {
        e.preventDefault()

        // Get plain text from clipboard
        const text = e.clipboardData.getData('text/plain')

        if (this.options.mode === 'text-only') {
            // Insert as plain text
            document.execCommand('insertText', false, text)
        } else {
            // Get HTML if available
            const html = e.clipboardData.getData('text/html')
            
            if (html) {
                // Clean and insert HTML
                const cleaned = cleanInlineHTML(html)
                document.execCommand('insertHTML', false, cleaned)
            } else {
                // Insert plain text
                document.execCommand('insertText', false, text)
            }
        }
    }

    /**
     * Handle keydown
     */
    handleKeyDown(e) {
        // Prevent Enter key from creating new elements in both modes
        if (e.key === 'Enter') {
            e.preventDefault()
            // Insert a line break
            document.execCommand('insertHTML', false, '<br>')
        }

        // Shortcuts for inline-rich mode
        if (this.options.mode === 'inline-rich') {
            if (e.metaKey || e.ctrlKey) {
                if (e.key === 'b') {
                    e.preventDefault()
                    document.execCommand('bold', false, null)
                    this.handleContentChange()
                } else if (e.key === 'i') {
                    e.preventDefault()
                    document.execCommand('italic', false, null)
                    this.handleContentChange()
                } else if (e.key === 'k') {
                    e.preventDefault()
                    this.insertLink()
                }
            }
        }
    }

    /**
     * Handle command from global toolbar
     */
    handleCommand(e) {
        const { command, value } = e.detail

        if (command === 'createLink') {
            this.insertLink()
        } else if (command === 'bold' || command === 'italic') {
            document.execCommand(command, false, null)
            this.editorElement.focus()
            this.handleContentChange()
        }
    }

    /**
     * Insert/edit link
     */
    insertLink() {
        const selection = window.getSelection()
        if (!selection.rangeCount) return

        let url = ''
        let linkElement = null

        // Check if we're inside a link
        let node = selection.anchorNode
        while (node && node !== this.editorElement) {
            if (node.tagName === 'A') {
                linkElement = node
                url = linkElement.href
                break
            }
            node = node.parentElement
        }

        // Prompt for URL
        const newUrl = window.prompt('Enter URL:', url)

        if (newUrl === null) {
            // User cancelled
            return
        }

        if (newUrl === '') {
            // Remove link
            if (linkElement) {
                const parent = linkElement.parentNode
                while (linkElement.firstChild) {
                    parent.insertBefore(linkElement.firstChild, linkElement)
                }
                parent.removeChild(linkElement)
            }
        } else {
            // Create or update link
            if (linkElement) {
                linkElement.href = newUrl
            } else {
                document.execCommand('createLink', false, newUrl)
            }
        }

        this.editorElement.focus()
        this.handleContentChange()
    }

    /**
     * Get toolbar state for global toolbar
     * Returns formatting state at current cursor position
     */
    getToolbarState() {
        if (this.options.mode !== 'inline-rich') {
            return {
                mode: 'text-only',
                bold: false,
                italic: false,
                link: false
            }
        }

        const selection = window.getSelection()
        let isLink = false
        
        if (selection.rangeCount > 0) {
            let node = selection.anchorNode
            while (node && node !== this.editorElement) {
                if (node.tagName === 'A') {
                    isLink = true
                    break
                }
                node = node.parentElement
            }
        }

        return {
            mode: 'inline-rich',
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            link: isLink,
            // Disable all other formatting options
            format: 'p',
            insertUnorderedList: false,
            insertOrderedList: false,
            code: false,
            quote: false
        }
    }

    /**
     * Activate editor (register with global toolbar for inline-rich mode)
     */
    activate() {
        this.isActive = true
        
        // Only register with toolbar manager for inline-rich mode
        if (this.options.mode === 'inline-rich') {
            // Dynamically import to avoid circular dependencies
            import('../../utils/wysiwygToolbarManager.js').then(({ toolbarManager }) => {
                toolbarManager.registerEditor(this)
            })
        }
    }

    /**
     * Deactivate editor (unregister from global toolbar)
     */
    deactivate() {
        // Small delay to allow button clicks to register
        setTimeout(() => {
            this.isActive = false
            
            // Unregister from toolbar manager for inline-rich mode
            if (this.options.mode === 'inline-rich') {
                import('../../utils/wysiwygToolbarManager.js').then(({ toolbarManager }) => {
                    toolbarManager.unregisterEditor(this)
                })
            }
        }, 200)
    }

    /**
     * Update configuration
     */
    updateConfig(newOptions) {
        this.options = { ...this.options, ...newOptions }
        
        // Update content if it changed
        if (newOptions.content !== undefined) {
            const currentContent = this.getContent()
            if (newOptions.content !== currentContent) {
                this.setContent(newOptions.content)
            }
        }
    }

    /**
     * Destroy editor
     */
    destroy() {
        // Deactivate if active
        if (this.isActive) {
            this.deactivate()
        }

        // Remove event listeners
        if (this.editorElement) {
            this.editorElement.removeEventListener('input', this.handleContentChange)
            this.editorElement.removeEventListener('paste', this.handlePaste)
            this.editorElement.removeEventListener('keydown', this.handleKeyDown)
            this.editorElement.removeEventListener('wysiwyg-command', this.handleCommand)
            this.editorElement.removeEventListener('focus', this.activate)
            this.editorElement.removeEventListener('blur', this.deactivate)
        }

        // Clear container
        if (this.container) {
            this.container.innerHTML = ''
        }

        this.editorElement = null
    }
}

export default SimpleTextEditorRenderer

