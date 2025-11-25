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
 * Check if content is truly empty (handles whitespace, <br> tags, etc.)
 */
const isEmptyContent = (content) => {
    if (!content) return true
    
    // Strip HTML and check if only whitespace remains
    const text = stripHTML(content).trim()
    if (text.length === 0) return true
    
    // Check if content is just a single <br> tag
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = content.trim()
    const children = Array.from(tempDiv.childNodes)
    if (children.length === 1 && children[0].tagName === 'BR') {
        return true
    }
    
    return false
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
            allowedButtons: ['bold', 'italic', 'link', 'format', 'list', 'code', 'quote', 'image'], // Which toolbar buttons to show
            ...options
        }

        this.editorElement = null
        this.isActive = false

        // Track last externally-provided content to prevent unnecessary updates
        this.lastExternalContent = options.content || ''
        // Track whether we're currently processing an internal change
        this.isInternalChange = false

        // Bind methods
        this.handleContentChange = this.handleContentChange.bind(this)
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.handlePaste = this.handlePaste.bind(this)
        this.handleCommand = this.handleCommand.bind(this)
        this.activate = this.activate.bind(this)
        this.deactivate = this.deactivate.bind(this)
        this.updateEmptyState = this.updateEmptyState.bind(this)
    }

    /**
     * Get current content property (for external access)
     */
    get content() {
        return this.getContent()
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
        
        // Update empty state after initial render
        setTimeout(() => {
            this.updateEmptyState()
        }, 0)
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

        // Check if content actually changed from current editor content
        const currentContent = this.getContent()
        if (content === currentContent) {
            // No change needed
            return
        }

        // Mark as internal change to prevent onChange from triggering
        this.isInternalChange = true

        if (this.options.mode === 'text-only') {
            // Plain text only
            this.editorElement.textContent = stripHTML(content || '')
        } else {
            // Inline rich - clean and set HTML
            this.editorElement.innerHTML = cleanInlineHTML(content || '')
        }

        // Update last external content
        this.lastExternalContent = content || ''

        // Reset internal change flag after a tick
        setTimeout(() => {
            this.isInternalChange = false
            // Update empty state after content is set
            this.updateEmptyState()
        }, 0)
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
     * Update empty state class on editor element
     */
    updateEmptyState() {
        if (!this.editorElement) return
        
        // Check both the content string and the actual DOM element
        const content = this.getContent()
        let isEmpty = isEmptyContent(content)
        
        // Also check if the DOM element is visually empty (only has <br> or whitespace)
        if (!isEmpty) {
            const children = Array.from(this.editorElement.childNodes)
            const hasOnlyBr = children.length === 1 && 
                             children[0].nodeType === Node.ELEMENT_NODE && 
                             children[0].tagName === 'BR'
            const hasOnlyText = children.length === 1 && 
                               children[0].nodeType === Node.TEXT_NODE && 
                               (!children[0].textContent || children[0].textContent.trim() === '')
            const hasOnlyWhitespace = children.length > 0 && 
                                     children.every(node => {
                                         if (node.nodeType === Node.TEXT_NODE) {
                                             return !node.textContent || node.textContent.trim() === ''
                                         }
                                         if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
                                             return true
                                         }
                                         return false
                                     })
            
            isEmpty = hasOnlyBr || hasOnlyText || hasOnlyWhitespace
        }
        
        if (isEmpty) {
            this.editorElement.classList.add('is-empty')
        } else {
            this.editorElement.classList.remove('is-empty')
        }
    }

    /**
     * Handle content change
     */
    handleContentChange() {
        // Update empty state
        this.updateEmptyState()
        
        // Don't trigger onChange if this is an internal change (from setContent)
        if (this.isInternalChange) {
            return
        }

        if (this.options.onChange) {
            const content = this.getContent()
            // Only call onChange if content actually changed from last external content
            if (content !== this.lastExternalContent) {
                this.lastExternalContent = content
                this.options.onChange(content)
            }
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
        } else if (command === 'formatBlock') {
            document.execCommand('formatBlock', false, value)
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
                link: false,
                allowedButtons: this.options.allowedButtons || []
            }
        }

        const selection = window.getSelection()
        const state = {
            mode: 'inline-rich',
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            link: false,
            format: 'Paragraph', // Default
            insertUnorderedList: false,
            insertOrderedList: false,
            code: false,
            quote: false,
            allowedButtons: this.options.allowedButtons || ['bold', 'italic', 'link', 'format', 'list', 'code', 'quote', 'image']
        }

        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            
            // Check for block format
            let currentElement = range.commonAncestorContainer
            if (currentElement.nodeType === Node.TEXT_NODE) {
                currentElement = currentElement.parentElement
            }

            // Walk up to find the formatting element
            while (currentElement && currentElement !== this.editorElement) {
                const tagName = currentElement.tagName?.toLowerCase()

                if (tagName === 'p') {
                    state.format = 'Paragraph'
                    break
                } else if (tagName && tagName.match(/^h[1-6]$/)) {
                    const level = tagName.charAt(1)
                    state.format = `Heading ${level}`
                    break
                }

                currentElement = currentElement.parentElement
            }

            // Check for links
            let node = selection.anchorNode
            while (node && node !== this.editorElement) {
                if (node.tagName === 'A') {
                    state.link = true
                    break
                }
                node = node.parentElement
            }
        }

        return state
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
        // Update onChange callback without re-rendering
        if (newOptions.onChange !== undefined) {
            this.options.onChange = newOptions.onChange
        }

        // Update other options
        if (newOptions.mode !== undefined) {
            this.options.mode = newOptions.mode
        }
        if (newOptions.element !== undefined) {
            this.options.element = newOptions.element
        }
        if (newOptions.placeholder !== undefined) {
            this.options.placeholder = newOptions.placeholder
            if (this.editorElement) {
                this.editorElement.setAttribute('data-placeholder', newOptions.placeholder)
            }
        }

        // Update content if it changed and is different from current editor content
        if (newOptions.content !== undefined) {
            const currentContent = this.getContent()
            // Only update if external content is different from what editor currently has
            // AND it's different from what we last set externally
            if (newOptions.content !== currentContent && newOptions.content !== this.lastExternalContent) {
                this.setContent(newOptions.content)
                // Update empty state after content is set
                setTimeout(() => {
                    this.updateEmptyState()
                }, 0)
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

