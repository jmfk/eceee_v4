/**
 * ContentWidgetEditorRenderer.js
 * Vanilla JS WYSIWYG editor renderer for ContentWidget
 * 
 * This class replaces the React-based ContentWidgetEditor with pure DOM manipulation
 * to avoid conflicts between React and document.execCommand() operations.
 */

/**
 * Clean up HTML content by only allowing basic HTML elements and attributes
 * Converts complex structures like tables to simple paragraphs
 */
const cleanHTML = (html) => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html

    // Define allowed HTML tags (whitelist approach)
    const blockTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li']
    const inlineTags = ['strong', 'b', 'em', 'i', 'a', 'br']
    const allowedTags = [...blockTags, ...inlineTags]
    const allowedAttributes = ['href', 'target']

    // Convert tables to paragraphs before cleaning
    convertTablesToParagraphs(tempDiv)

    // First pass: Remove all non-allowed tags while preserving their text content
    const allElements = tempDiv.querySelectorAll('*')
    const elementsToProcess = Array.from(allElements).reverse() // Process from innermost to outermost

    elementsToProcess.forEach(el => {
        const tagName = el.tagName.toLowerCase()

        if (!allowedTags.includes(tagName)) {
            // Convert disallowed elements to their text content or appropriate replacement
            if (['div', 'span', 'section', 'article', 'header', 'footer', 'main', 'aside'].includes(tagName)) {
                // Convert block/inline containers to paragraphs if they contain substantial content
                if (el.textContent.trim().length > 0) {
                    const p = document.createElement('p')
                    p.innerHTML = el.innerHTML
                    el.parentNode.replaceChild(p, el)
                } else {
                    // Remove empty containers
                    el.remove()
                }
            } else {
                // For other disallowed tags, just unwrap them (keep content, remove tag)
                while (el.firstChild) {
                    el.parentNode.insertBefore(el.firstChild, el)
                }
                el.remove()
            }
        }
    })

    // Clean attributes on remaining elements
    const finalElements = tempDiv.querySelectorAll('*')
    finalElements.forEach(el => {
        const attrs = Array.from(el.attributes)
        attrs.forEach(attr => {
            if (!allowedAttributes.includes(attr.name)) {
                el.removeAttribute(attr.name)
            }
        })
    })

    // Clean up empty paragraphs and normalize whitespace
    cleanupEmptyElements(tempDiv)

    // Second pass: Ensure all text nodes that aren't inside block elements are wrapped in <p> tags
    const wrapTextNodesInParagraphs = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim()
            if (text) {
                // Create a new paragraph and replace the text node
                const p = document.createElement('p')
                p.textContent = node.textContent
                node.parentNode.replaceChild(p, node)
            } else {
                // Remove empty text nodes
                node.remove()
            }
            return
        }

        // For element nodes, check if it's a block element
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase()

            // If it's not a block element, we need to process its children
            if (!blockTags.includes(tagName)) {
                // Convert the contents to an array because the NodeList will be live
                // and will change as we modify the DOM
                const children = Array.from(node.childNodes)
                children.forEach(child => wrapTextNodesInParagraphs(child))
            }
        }
    }

    // Clean up whitespace in block elements
    const cleanBlockElement = (element) => {
        const inlineTags = ['strong', 'b', 'em', 'i', 'a', 'br'];

        // First clean up text nodes
        Array.from(element.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                // Check if this text node is adjacent to inline elements
                const prevIsInline = node.previousSibling &&
                    node.previousSibling.nodeType === Node.ELEMENT_NODE &&
                    inlineTags.includes(node.previousSibling.tagName.toLowerCase());
                const nextIsInline = node.nextSibling &&
                    node.nextSibling.nodeType === Node.ELEMENT_NODE &&
                    inlineTags.includes(node.nextSibling.tagName.toLowerCase());

                // Only collapse excessive whitespace (3+ spaces), preserve single/double spaces
                let text = node.textContent.replace(/\s{3,}/g, ' ');

                // Only trim if not adjacent to inline elements
                if (!prevIsInline && !nextIsInline) {
                    text = text.trim();
                }

                node.textContent = text;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                cleanBlockElement(node);
            }
        });

        // Remove empty text nodes at the start and end only if they're truly empty (no inline siblings)
        while (element.firstChild &&
            element.firstChild.nodeType === Node.TEXT_NODE &&
            !element.firstChild.textContent.trim() &&
            !(element.firstChild.nextSibling &&
                element.firstChild.nextSibling.nodeType === Node.ELEMENT_NODE &&
                inlineTags.includes(element.firstChild.nextSibling.tagName.toLowerCase()))) {
            element.removeChild(element.firstChild);
        }
        while (element.lastChild &&
            element.lastChild.nodeType === Node.TEXT_NODE &&
            !element.lastChild.textContent.trim() &&
            !(element.lastChild.previousSibling &&
                element.lastChild.previousSibling.nodeType === Node.ELEMENT_NODE &&
                inlineTags.includes(element.lastChild.previousSibling.tagName.toLowerCase()))) {
            element.removeChild(element.lastChild);
        }
    };

    // Process all block elements first
    blockTags.forEach(tag => {
        const elements = tempDiv.getElementsByTagName(tag);
        Array.from(elements).forEach(cleanBlockElement);
    });

    // Process all direct children of the container
    Array.from(tempDiv.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            // Only collapse excessive whitespace, preserve meaningful spaces
            const text = node.textContent.replace(/\s{3,}/g, ' ').trim()
            if (text) {
                // Create a new paragraph and replace the text node
                const p = document.createElement('p')
                p.textContent = text
                node.parentNode.replaceChild(p, node)
            } else {
                // Remove empty text nodes
                node.remove()
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase()
            if (!blockTags.includes(tagName)) {
                // If it's not a block element, wrap it in a paragraph
                const p = document.createElement('p')
                node.parentNode.insertBefore(p, node)
                p.appendChild(node)
            }
        }
    })

    // Get the HTML content and format it
    let content = tempDiv.innerHTML;

    // Add newlines after block elements
    blockTags.forEach(tag => {
        const regex = new RegExp(`</${tag}>`, 'g');
        content = content.replace(regex, `</${tag}>\n`);
    });

    // Clean up multiple newlines
    content = content
        .replace(/\n\s*\n/g, '\n')  // Replace multiple newlines with single
        .replace(/^\s+|\s+$/g, ''); // Trim whitespace at start and end

    return content;
}

/**
 * Convert table structures to readable paragraphs
 */
const convertTablesToParagraphs = (container) => {
    const tables = container.querySelectorAll('table')

    tables.forEach(table => {
        const paragraphsContainer = document.createElement('div')

        // Process table headers
        const headers = table.querySelectorAll('th')
        if (headers.length > 0) {
            const headerText = Array.from(headers).map(th => th.textContent.trim()).filter(text => text).join(' | ')
            if (headerText) {
                const headerP = document.createElement('p')
                headerP.innerHTML = `<strong>${headerText}</strong>`
                paragraphsContainer.appendChild(headerP)
            }
        }

        // Process table rows
        const rows = table.querySelectorAll('tr')
        rows.forEach(row => {
            const cells = row.querySelectorAll('td, th')
            if (cells.length > 0) {
                const rowText = Array.from(cells).map(cell => cell.textContent.trim()).filter(text => text).join(' | ')
                if (rowText && !row.querySelector('th')) { // Skip header rows we already processed
                    const rowP = document.createElement('p')
                    rowP.textContent = rowText
                    paragraphsContainer.appendChild(rowP)
                }
            }
        })

        // Replace table with paragraphs
        if (paragraphsContainer.children.length > 0) {
            table.parentNode.replaceChild(paragraphsContainer, table)
        } else {
            table.remove()
        }
    })
}

/**
 * Clean up empty elements and normalize whitespace
 */
const cleanupEmptyElements = (container) => {
    // Remove empty paragraphs and other elements
    const emptyElements = container.querySelectorAll('p:empty, h1:empty, h2:empty, h3:empty, h4:empty, h5:empty, h6:empty, ul:empty, ol:empty, li:empty')
    emptyElements.forEach(el => el.remove())

    // Remove paragraphs that only contain whitespace
    const paragraphs = container.querySelectorAll('p')
    paragraphs.forEach(p => {
        if (!p.textContent.trim()) {
            p.remove()
        }
    })

    // Merge consecutive <br> tags and limit to max 2
    const brs = container.querySelectorAll('br')
    let consecutiveBrs = 0
    brs.forEach(br => {
        const nextSibling = br.nextSibling
        if (nextSibling && nextSibling.tagName === 'BR') {
            consecutiveBrs++
            if (consecutiveBrs > 1) {
                br.remove()
            }
        } else {
            consecutiveBrs = 0
        }
    })
}

/**
 * Fix invalid HTML nesting after paste
 * Block tags (h1-h6, p, ul, ol, li) cannot be nested inside:
 * - Inline tags (strong, em, a)
 * - Certain other block tags (h1-h6, p)
 */
const fixInvalidNesting = (container) => {
    const blockTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li']
    const inlineTags = ['strong', 'em', 'a']
    const noNestedBlocksTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'] // These cannot contain block elements

    // Find all block elements
    const allBlocks = container.querySelectorAll(blockTags.join(','))

    Array.from(allBlocks).forEach(blockEl => {
        let parent = blockEl.parentNode
        let invalidParent = null

        // Walk up to find if we're inside an invalid parent
        while (parent && parent !== container) {
            const parentTag = parent.tagName ? parent.tagName.toLowerCase() : null

            // Check if block is inside an inline tag
            if (parentTag && inlineTags.includes(parentTag)) {
                invalidParent = parent
                break
            }

            // Check if block is inside a tag that can't contain blocks
            if (parentTag && noNestedBlocksTags.includes(parentTag)) {
                invalidParent = parent
                break
            }

            parent = parent.parentNode
        }

        // If we found an invalid parent, unwrap the block element
        if (invalidParent) {
            // Insert the block element after the invalid parent
            invalidParent.parentNode.insertBefore(blockEl, invalidParent.nextSibling)
        }
    })

    return container
}

/**
 * SVG Icons (replacing Lucide React icons)
 */
const ICONS = {
    bold: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>`,
    italic: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>`,
    link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    h1: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M4 18V6M8 18V6"/><circle cx="18" cy="9" r="3" fill="currentColor"/><text x="18" y="13" font-size="6" font-weight="bold" fill="white" text-anchor="middle">1</text></svg>`,
    h2: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M4 18V6M8 18V6"/><circle cx="18" cy="9" r="3" fill="currentColor"/><text x="18" y="13" font-size="6" font-weight="bold" fill="white" text-anchor="middle">2</text></svg>`,
    h3: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M4 18V6M8 18V6"/><circle cx="18" cy="9" r="3" fill="currentColor"/><text x="18" y="13" font-size="6" font-weight="bold" fill="white" text-anchor="middle">3</text></svg>`,
    h4: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M4 18V6M8 18V6"/><circle cx="18" cy="9" r="3" fill="currentColor"/><text x="18" y="13" font-size="6" font-weight="bold" fill="white" text-anchor="middle">4</text></svg>`,
    h5: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M4 18V6M8 18V6"/><circle cx="18" cy="9" r="3" fill="currentColor"/><text x="18" y="13" font-size="6" font-weight="bold" fill="white" text-anchor="middle">5</text></svg>`,
    h6: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M4 18V6M8 18V6"/><circle cx="18" cy="9" r="3" fill="currentColor"/><text x="18" y="13" font-size="6" font-weight="bold" fill="white" text-anchor="middle">6</text></svg>`,
    paragraph: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4h6"/><path d="M12 6v14"/><path d="M10 20h4"/><path d="M6 16c0 1.1.9 2 2 2h2V10H8a2 2 0 0 0-2 2z"/></svg>`,
    list: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
    listOrdered: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1.5S2 14 2 15"/></svg>`,
    undo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="m21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>`,
    redo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="m3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3-2.3"/></svg>`,
    cleanup: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9"/><path d="M7 14h10v2c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2v-2z"/><path d="M9 18v3M15 18v3M12 18v3"/></svg>`
}

class ContentWidgetEditorRenderer {
    constructor(container, options = {}) {
        this.container = container
        this.content = options.content || ''
        this.className = options.className || ''
        this.onChange = options.onChange || (() => { })

        // Theme configuration
        this.maxHeaderLevel = options.maxHeaderLevel || this.getThemeHeaderLevel() || 3

        // Detached toolbar mode - if true, toolbar is managed externally
        this.detachedToolbar = options.detachedToolbar || false

        // DOM elements
        this.rootElement = null
        this.toolbarElement = null
        this.editorElement = null

        // State
        this.isDestroyed = false
        this.isActive = false
        this.eventListeners = new Map() // Track event listeners for cleanup

        // Toolbar element references for state updates
        this.toolbarButtons = new Map()
        this.formatSelect = null

        // Bind methods to maintain 'this' context
        this.handleContentChange = this.handleContentChange.bind(this)
        this.handlePaste = this.handlePaste.bind(this)
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.execCommand = this.execCommand.bind(this)
    }

    /**
     * Get theme-configured maximum header level
     */
    getThemeHeaderLevel() {
        // Check CSS custom property for theme configuration
        const computedStyle = getComputedStyle(document.documentElement)
        const themeHeaderLevel = computedStyle.getPropertyValue('--editor-max-header-level')
        return themeHeaderLevel ? parseInt(themeHeaderLevel.trim()) : null
    }

    /**
     * Create and render the editor DOM structure
     */
    render() {
        if (this.isDestroyed) {
            // Silently return when instance is destroyed - this is expected behavior
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

        // Initialize button states
        setTimeout(() => this.updateButtonStates(), 0)
    }

    /**
     * Create toolbar with all buttons and controls
     */
    createToolbar() {
        // Skip toolbar creation if in detached mode
        if (this.detachedToolbar) {
            return;
        }

        this.toolbarElement = document.createElement('div')
        this.toolbarElement.className = 'toolbar flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50'

        // Bold button
        const boldButton = this.createToolbarButton('bold', 'Bold', ICONS.bold)
        this.toolbarButtons.set('bold', boldButton)
        this.toolbarElement.appendChild(boldButton)

        // Italic button
        const italicButton = this.createToolbarButton('italic', 'Italic', ICONS.italic)
        this.toolbarButtons.set('italic', italicButton)
        this.toolbarElement.appendChild(italicButton)

        // Link button
        const linkButton = this.createLinkButton()
        this.toolbarButtons.set('link', linkButton)
        this.toolbarElement.appendChild(linkButton)

        // Separator
        this.toolbarElement.appendChild(this.createSeparator())

        // Format dropdown (headers and paragraph)
        this.createFormatDropdown()

        // Separator
        this.toolbarElement.appendChild(this.createSeparator())

        // Unordered list button
        const ulButton = this.createToolbarButton('insertUnorderedList', 'Bullet List', ICONS.list)
        this.toolbarButtons.set('insertUnorderedList', ulButton)
        this.toolbarElement.appendChild(ulButton)

        // Ordered list button
        const olButton = this.createToolbarButton('insertOrderedList', 'Numbered List', ICONS.listOrdered)
        this.toolbarButtons.set('insertOrderedList', olButton)
        this.toolbarElement.appendChild(olButton)

        // Separator
        this.toolbarElement.appendChild(this.createSeparator())

        // Undo button
        const undoButton = this.createToolbarButton('undo', 'Undo', ICONS.undo)
        this.toolbarElement.appendChild(undoButton)

        // Redo button
        const redoButton = this.createToolbarButton('redo', 'Redo', ICONS.redo)
        this.toolbarElement.appendChild(redoButton)

        // Separator
        this.toolbarElement.appendChild(this.createSeparator())

        // Cleanup button
        const cleanupButton = this.createCleanupButton()
        this.toolbarElement.appendChild(cleanupButton)

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
     * Create modern format dropdown
     */
    createFormatDropdown() {
        // Create dropdown container
        const dropdownContainer = document.createElement('div')
        dropdownContainer.className = 'relative'

        // Create dropdown button
        const dropdownButton = document.createElement('button')
        dropdownButton.type = 'button'
        dropdownButton.className = 'flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
        dropdownButton.innerHTML = `
            <span class="format-label">Format</span>
            <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
        `

        // Create dropdown menu
        const dropdownMenu = document.createElement('div')
        dropdownMenu.className = 'absolute left-0 mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-50 hidden'
        dropdownMenu.style.zIndex = '1000'

        // Format options
        const formatOptions = [
            { value: '<p>', label: 'Paragraph' },
            ...Array.from({ length: this.maxHeaderLevel }, (_, i) => ({
                value: `<h${i + 1}>`,
                label: `Heading ${i + 1}`
            }))
        ]

        // Create menu items
        formatOptions.forEach(option => {
            const menuItem = document.createElement('button')
            menuItem.type = 'button'
            menuItem.className = 'w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:bg-blue-50'
            menuItem.innerHTML = `<span>${option.label}</span>`

            menuItem.addEventListener('click', (e) => {
                e.preventDefault()
                e.stopPropagation()
                this.execCommand('formatBlock', option.value)
                dropdownButton.querySelector('.format-label').textContent = option.label
                this.hideDropdown(dropdownMenu)
            })

            dropdownMenu.appendChild(menuItem)
        })

        // Toggle dropdown on button click
        dropdownButton.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            this.toggleDropdown(dropdownMenu)
        })

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdownContainer.contains(e.target)) {
                this.hideDropdown(dropdownMenu)
            }
        })

        // Assemble dropdown
        dropdownContainer.appendChild(dropdownButton)
        dropdownContainer.appendChild(dropdownMenu)
        this.toolbarElement.appendChild(dropdownContainer)

        // Store references
        this.formatDropdown = {
            container: dropdownContainer,
            button: dropdownButton,
            menu: dropdownMenu
        }

        // Track for cleanup
        this.eventListeners.set(dropdownContainer, () => {
            // Cleanup will be handled by the main cleanup method
        })
    }

    /**
     * Toggle dropdown visibility
     */
    toggleDropdown(menu) {
        const isHidden = menu.classList.contains('hidden')
        if (isHidden) {
            this.showDropdown(menu)
        } else {
            this.hideDropdown(menu)
        }
    }

    /**
     * Show dropdown menu
     */
    showDropdown(menu) {
        menu.classList.remove('hidden')
    }

    /**
     * Hide dropdown menu
     */
    hideDropdown(menu) {
        menu.classList.add('hidden')
    }


    /**
     * Create link button with special handling
     */
    createLinkButton() {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'p-1 hover:bg-gray-200 rounded'
        button.title = 'Insert/Edit Link'
        button.innerHTML = ICONS.link

        const clickHandler = (e) => {
            e.preventDefault()
            this.handleLinkAction()
        }

        button.addEventListener('click', clickHandler)
        this.eventListeners.set(button, () => {
            button.removeEventListener('click', clickHandler)
        })

        return button
    }

    /**
     * Create cleanup button
     */
    createCleanupButton() {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'p-1 hover:bg-gray-200 rounded'
        button.title = 'Clean HTML (removes unwanted tags and attributes)'
        button.innerHTML = ICONS.cleanup

        const clickHandler = (e) => {
            e.preventDefault()
            this.cleanupHTML()
        }

        button.addEventListener('click', clickHandler)
        this.eventListeners.set(button, () => {
            button.removeEventListener('click', clickHandler)
        })

        return button
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
        this.editorElement.className = 'p-3 min-h-32 outline-none theme-content widget-content content-editor-theme'
        this.editorElement.style.lineHeight = '1.6'

        // Add event listeners
        this.editorElement.addEventListener('input', this.handleContentChange)
        this.editorElement.addEventListener('paste', this.handlePaste)
        this.editorElement.addEventListener('keydown', this.handleKeyDown)
        this.editorElement.addEventListener('mouseup', this.updateButtonStates.bind(this))
        this.editorElement.addEventListener('keyup', this.updateButtonStates.bind(this))

        // Track event listeners for cleanup
        this.eventListeners.set(this.editorElement, () => {
            this.editorElement.removeEventListener('input', this.handleContentChange)
            this.editorElement.removeEventListener('paste', this.handlePaste)
            this.editorElement.removeEventListener('keydown', this.handleKeyDown)
            this.editorElement.removeEventListener('mouseup', this.updateButtonStates.bind(this))
            this.editorElement.removeEventListener('keyup', this.updateButtonStates.bind(this))
        })

        // Set up command listener for detached toolbar mode
        if (this.detachedToolbar) {
            this.setupCommandListener();
        }

        this.rootElement.appendChild(this.editorElement)
    }

    /**
     * Handle content changes
     */
    handleContentChange() {
        if (this.editorElement) {
            const currentContent = this.editorElement.innerHTML
            // Only call onChange if content actually changed
            if (currentContent !== this.content) {
                this.content = currentContent

                // Call onChange to notify parent of changes
                // The parent component (ContentWidget) will handle the update lock
                this.onChange(currentContent)
            }
        }

        // Update button states after content change
        setTimeout(() => this.updateButtonStates(), 0)
    }

    /**
     * Handle paste events - automatically clean pasted HTML and fix invalid nesting
     */
    handlePaste(e) {
        e.preventDefault()
        const paste = (e.clipboardData || window.clipboardData).getData('text/html') ||
            (e.clipboardData || window.clipboardData).getData('text/plain')
        const cleanedPaste = this.cleanHTMLStrict(paste)

        // Insert the cleaned HTML
        document.execCommand('insertHTML', false, cleanedPaste)

        // Fix any invalid nesting that resulted from the paste
        setTimeout(() => {
            if (this.editorElement) {
                fixInvalidNesting(this.editorElement)
                this.handleContentChange()
            }
        }, 0)
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
     * Handle link insertion/editing
     */
    handleLinkAction() {
        const selection = window.getSelection()
        if (!selection.rangeCount) return

        const range = selection.getRangeAt(0)
        let linkElement = null
        let existingHref = ''
        let selectedText = selection.toString()

        // Check if we're inside an existing link
        let node = range.commonAncestorContainer
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode
        }

        // Walk up the DOM to find a link element
        while (node && node !== this.editorElement) {
            if (node.tagName === 'A') {
                linkElement = node
                existingHref = linkElement.getAttribute('href') || ''
                if (!selectedText) {
                    selectedText = linkElement.textContent
                }
                break
            }
            node = node.parentNode
        }

        // Create and show the link dialog
        this.showLinkDialog(existingHref, selectedText, linkElement, range)
    }

    /**
     * Show link dialog for URL input
     */
    showLinkDialog(existingHref, selectedText, linkElement, range) {
        // Create modal overlay
        const overlay = document.createElement('div')
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
        overlay.style.zIndex = '9999'

        // Create dialog
        const dialog = document.createElement('div')
        dialog.className = 'bg-white rounded-lg p-6 w-96 max-w-full mx-4'

        // Dialog title
        const title = document.createElement('h3')
        title.className = 'text-lg font-semibold mb-4'
        title.textContent = linkElement ? 'Edit Link' : 'Insert Link'
        dialog.appendChild(title)

        // URL input
        const urlLabel = document.createElement('label')
        urlLabel.className = 'block text-sm font-medium text-gray-700 mb-2'
        urlLabel.textContent = 'URL'
        dialog.appendChild(urlLabel)

        const urlInput = document.createElement('input')
        urlInput.type = 'url'
        urlInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4'
        urlInput.placeholder = 'https://example.com'
        urlInput.value = existingHref
        dialog.appendChild(urlInput)

        // Text input
        const textLabel = document.createElement('label')
        textLabel.className = 'block text-sm font-medium text-gray-700 mb-2'
        textLabel.textContent = 'Link Text'
        dialog.appendChild(textLabel)

        const textInput = document.createElement('input')
        textInput.type = 'text'
        textInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4'
        textInput.placeholder = 'Link text'
        textInput.value = selectedText
        dialog.appendChild(textInput)

        // Target checkbox
        const checkboxContainer = document.createElement('div')
        checkboxContainer.className = 'flex items-center mb-4'
        dialog.appendChild(checkboxContainer)

        const targetCheckbox = document.createElement('input')
        targetCheckbox.type = 'checkbox'
        targetCheckbox.id = 'link-target-checkbox'
        targetCheckbox.className = 'mr-2'
        targetCheckbox.checked = linkElement && linkElement.getAttribute('target') === '_blank'
        checkboxContainer.appendChild(targetCheckbox)

        const checkboxLabel = document.createElement('label')
        checkboxLabel.htmlFor = 'link-target-checkbox'
        checkboxLabel.className = 'text-sm text-gray-700'
        checkboxLabel.textContent = 'Open in new tab'
        checkboxContainer.appendChild(checkboxLabel)

        // Buttons container
        const buttonsContainer = document.createElement('div')
        buttonsContainer.className = 'flex justify-end gap-2'
        dialog.appendChild(buttonsContainer)

        // Cancel button
        const cancelButton = document.createElement('button')
        cancelButton.type = 'button'
        cancelButton.className = 'px-4 py-2 text-gray-600 hover:text-gray-800'
        cancelButton.textContent = 'Cancel'
        buttonsContainer.appendChild(cancelButton)

        // Remove link button (only if editing existing link)
        if (linkElement) {
            const removeButton = document.createElement('button')
            removeButton.type = 'button'
            removeButton.className = 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700'
            removeButton.textContent = 'Remove Link'
            buttonsContainer.appendChild(removeButton)

            removeButton.addEventListener('click', () => {
                this.removeLink(linkElement)
                document.body.removeChild(overlay)
                this.editorElement.focus()
            })
        }

        // Insert/Update button
        const insertButton = document.createElement('button')
        insertButton.type = 'button'
        insertButton.className = 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
        insertButton.textContent = linkElement ? 'Update Link' : 'Insert Link'
        buttonsContainer.appendChild(insertButton)

        // Event handlers
        const handleClose = () => {
            document.body.removeChild(overlay)
            this.editorElement.focus()
        }

        const handleInsert = () => {
            const url = urlInput.value.trim()
            const text = textInput.value.trim()
            const openInNewTab = targetCheckbox.checked

            if (!url) {
                urlInput.focus()
                return
            }

            if (linkElement) {
                this.updateLink(linkElement, url, text, openInNewTab)
            } else {
                this.insertLink(url, text, range, openInNewTab)
            }

            handleClose()
        }

        // Button event listeners
        cancelButton.addEventListener('click', handleClose)
        insertButton.addEventListener('click', handleInsert)

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleClose()
            }
        })

        // Handle Enter key
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault()
                handleInsert()
            } else if (e.key === 'Escape') {
                e.preventDefault()
                handleClose()
            }
        }

        urlInput.addEventListener('keydown', handleKeyDown)
        textInput.addEventListener('keydown', handleKeyDown)

        // Show dialog
        overlay.appendChild(dialog)
        document.body.appendChild(overlay)

        // Focus URL input
        setTimeout(() => urlInput.focus(), 100)
    }

    /**
     * Insert a new link
     */
    insertLink(url, text, range, openInNewTab = false) {
        // Restore selection
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)

        if (text && text !== selection.toString()) {
            // Store the original start position
            const startContainer = range.startContainer
            const startOffset = range.startOffset

            // Replace selection with new text
            document.execCommand('insertText', false, text)

            // Create a new range to select the inserted text
            const newRange = document.createRange()
            newRange.setStart(startContainer, startOffset)
            newRange.setEnd(startContainer, startOffset + text.length)

            selection.removeAllRanges()
            selection.addRange(newRange)
        }

        // Create link
        document.execCommand('createLink', false, url)

        // Set target attribute if needed
        if (openInNewTab) {
            // Find the newly created link
            const newLink = this.findLinkAtSelection()
            if (newLink) {
                newLink.setAttribute('target', '_blank')
            }
        }

        this.handleContentChange()
    }

    /**
     * Update an existing link
     */
    updateLink(linkElement, url, text, openInNewTab = false) {
        linkElement.setAttribute('href', url)
        if (text && text !== linkElement.textContent) {
            linkElement.textContent = text
        }

        // Set or remove target attribute
        if (openInNewTab) {
            linkElement.setAttribute('target', '_blank')
        } else {
            linkElement.removeAttribute('target')
        }

        this.handleContentChange()
    }

    /**
     * Find link element at current selection
     */
    findLinkAtSelection() {
        const selection = window.getSelection()
        if (!selection.rangeCount) return null

        const range = selection.getRangeAt(0)
        let node = range.commonAncestorContainer

        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode
        }

        // Walk up the DOM to find a link element
        while (node && node !== this.editorElement) {
            if (node.tagName === 'A') {
                return node
            }
            node = node.parentNode
        }

        return null
    }

    /**
     * Update button states based on current selection
     */
    updateButtonStates() {
        if (!this.editorElement) return

        // Reset all button states
        this.toolbarButtons.forEach((button, command) => {
            button.classList.remove('bg-blue-500', 'text-white')
            button.classList.add('hover:bg-gray-200')
        })

        // Check current formatting
        const selection = window.getSelection()
        if (!selection.rangeCount) return

        // Check for bold
        if (document.queryCommandState('bold')) {
            const boldButton = this.toolbarButtons.get('bold')
            if (boldButton) {
                boldButton.classList.add('bg-blue-500', 'text-white')
                boldButton.classList.remove('hover:bg-gray-200')
            }
        }

        // Check for italic
        if (document.queryCommandState('italic')) {
            const italicButton = this.toolbarButtons.get('italic')
            if (italicButton) {
                italicButton.classList.add('bg-blue-500', 'text-white')
                italicButton.classList.remove('hover:bg-gray-200')
            }
        }

        // Check for lists
        if (document.queryCommandState('insertUnorderedList')) {
            const ulButton = this.toolbarButtons.get('insertUnorderedList')
            if (ulButton) {
                ulButton.classList.add('bg-blue-500', 'text-white')
                ulButton.classList.remove('hover:bg-gray-200')
            }
        }

        if (document.queryCommandState('insertOrderedList')) {
            const olButton = this.toolbarButtons.get('insertOrderedList')
            if (olButton) {
                olButton.classList.add('bg-blue-500', 'text-white')
                olButton.classList.remove('hover:bg-gray-200')
            }
        }

        // Get range for format and link checking
        const range = selection.getRangeAt(0)

        // Update format dropdown label based on current element
        if (this.formatDropdown) {
            let currentElement = range.commonAncestorContainer
            if (currentElement.nodeType === Node.TEXT_NODE) {
                currentElement = currentElement.parentElement
            }

            // Walk up to find the formatting element
            let formatLabel = 'Format'
            while (currentElement && currentElement !== this.editorElement) {
                const tagName = currentElement.tagName?.toLowerCase()

                if (tagName === 'p') {
                    formatLabel = 'Paragraph'
                    break
                } else if (tagName && tagName.match(/^h[1-6]$/)) {
                    const level = tagName.charAt(1)
                    formatLabel = `Heading ${level}`
                    break
                }

                currentElement = currentElement.parentElement
            }

            // Update dropdown label
            const labelElement = this.formatDropdown.button.querySelector('.format-label')
            if (labelElement) {
                labelElement.textContent = formatLabel
            }
        }

        // Check for links
        let linkElement = range.commonAncestorContainer
        if (linkElement.nodeType === Node.TEXT_NODE) {
            linkElement = linkElement.parentElement
        }

        while (linkElement && linkElement !== this.editorElement) {
            if (linkElement.tagName === 'A') {
                const linkButton = this.toolbarButtons.get('link')
                if (linkButton) {
                    linkButton.classList.add('bg-blue-500', 'text-white')
                    linkButton.classList.remove('hover:bg-gray-200')
                }
                break
            }
            linkElement = linkElement.parentElement
        }
    }

    /**
     * Remove a link element
     */
    removeLink(linkElement) {
        const parent = linkElement.parentNode
        while (linkElement.firstChild) {
            parent.insertBefore(linkElement.firstChild, linkElement)
        }
        parent.removeChild(linkElement)
        this.handleContentChange()
    }

    /**
     * Clean HTML strictly - only allow specific tags and attributes
     * Converts b → strong and i → em
     * Only allows h1-h6, strong, em, p, li, ul, ol, a, br
     * For links, only allows href, target, and name attributes
     */
    cleanHTMLStrict(html) {
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = html

        // Process all elements bottom-up (from innermost to outermost)
        const allElements = Array.from(tempDiv.querySelectorAll('*')).reverse()

        allElements.forEach(el => {
            const tagName = el.tagName.toLowerCase()

            // Convert b → strong, i → em
            if (tagName === 'b') {
                const strong = document.createElement('strong')
                strong.innerHTML = el.innerHTML
                el.parentNode.replaceChild(strong, el)
            } else if (tagName === 'i') {
                const em = document.createElement('em')
                em.innerHTML = el.innerHTML
                el.parentNode.replaceChild(em, el)
            } else if (!['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'p', 'li', 'ul', 'ol', 'a', 'br'].includes(tagName)) {
                // Remove disallowed tags, keep content
                while (el.firstChild) {
                    el.parentNode.insertBefore(el.firstChild, el)
                }
                el.remove()
            } else if (tagName === 'a') {
                // Clean attributes on links - only allow href, target, and name
                const allowedAttrs = ['href', 'target', 'name']
                Array.from(el.attributes).forEach(attr => {
                    if (!allowedAttrs.includes(attr.name)) {
                        el.removeAttribute(attr.name)
                    }
                })
            } else {
                // For all other allowed tags, remove all attributes
                Array.from(el.attributes).forEach(attr => {
                    el.removeAttribute(attr.name)
                })
            }
        })

        return tempDiv.innerHTML
    }

    /**
     * Cleanup HTML in selection or entire content
     * If there's a selection, cleans only the selection
     * Otherwise, cleans the entire editor content
     */
    cleanupHTML() {
        const selection = window.getSelection()

        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            // Clean selection only
            const range = selection.getRangeAt(0)
            const fragment = range.cloneContents()
            const tempDiv = document.createElement('div')
            tempDiv.appendChild(fragment)

            const cleaned = this.cleanHTMLStrict(tempDiv.innerHTML)
            document.execCommand('insertHTML', false, cleaned)
            this.handleContentChange()
        } else {
            // Clean entire content
            const cleaned = this.cleanHTMLStrict(this.editorElement.innerHTML)
            this.editorElement.innerHTML = cleaned
            this.handleContentChange()
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
        if (!this.editorElement) return;

        // First set the raw content to ensure editor is usable
        if (content !== this.editorElement.innerHTML) {
            const oldContent = this.content;
            this.content = content;
            this.editorElement.innerHTML = content;

            // Only trigger onChange if this is not the initial content
            if (oldContent !== undefined && oldContent !== content) {
                this.onChange(content);
            }
        }

        // Then schedule the HTML cleaning for the next tick
        // This ensures the editor is responsive before cleaning
        setTimeout(() => {
            if (!this.editorElement) return;

            // Store selection
            const selection = window.getSelection();
            let range = null;
            if (selection && selection.rangeCount > 0) {
                range = selection.getRangeAt(0);
            }

            // Clean the HTML
            const cleanedContent = cleanHTML(this.editorElement.innerHTML);
            if (cleanedContent !== this.editorElement.innerHTML) {
                this.content = cleanedContent;
                this.editorElement.innerHTML = cleanedContent;

                // Restore selection if we had one
                if (range && selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        }, 0);
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
        // Deactivate if active
        if (this.isActive) {
            this.deactivate();
        }
        this.cleanup()
        this.isDestroyed = true
    }

    /**
     * Set up command listener for detached toolbar mode
     * Listens for custom 'wysiwyg-command' events dispatched by the toolbar manager
     */
    setupCommandListener() {
        const handler = (event) => {
            const { command, value } = event.detail;

            // Handle special commands
            if (command === 'createLink') {
                this.handleLinkAction();
            } else if (command === 'cleanup') {
                this.cleanupHTML();
            } else {
                this.execCommand(command, value);
            }
        };

        this.editorElement.addEventListener('wysiwyg-command', handler);

        // Track for cleanup
        const existingCleanup = this.eventListeners.get('wysiwyg-command');
        if (existingCleanup) {
            existingCleanup();
        }
        this.eventListeners.set('wysiwyg-command', () => {
            this.editorElement.removeEventListener('wysiwyg-command', handler);
        });
    }

    /**
     * Activate this editor (register with global toolbar manager)
     */
    activate() {
        if (!this.isActive && !this.isDestroyed) {
            this.isActive = true;

            // Import and register with toolbar manager
            import('../../utils/wysiwygToolbarManager.js').then(({ toolbarManager }) => {
                toolbarManager.registerEditor(this);
            });
        }
    }

    /**
     * Deactivate this editor (unregister from global toolbar manager)
     */
    deactivate() {
        if (this.isActive) {
            this.isActive = false;

            // Import and unregister from toolbar manager
            import('../../utils/wysiwygToolbarManager.js').then(({ toolbarManager }) => {
                toolbarManager.unregisterEditor(this);
            });
        }
    }

    /**
     * Get the current toolbar state for external rendering
     * @returns {Object} Toolbar state with button states and format info
     */
    getToolbarState() {
        if (!this.editorElement || this.isDestroyed) {
            return null;
        }

        const selection = window.getSelection();
        const state = {
            bold: false,
            italic: false,
            insertUnorderedList: false,
            insertOrderedList: false,
            link: false,
            format: 'Format',
            maxHeaderLevel: this.maxHeaderLevel
        };

        if (!selection.rangeCount) {
            return state;
        }

        // Check formatting states
        state.bold = document.queryCommandState('bold');
        state.italic = document.queryCommandState('italic');
        state.insertUnorderedList = document.queryCommandState('insertUnorderedList');
        state.insertOrderedList = document.queryCommandState('insertOrderedList');

        // Get current format
        const range = selection.getRangeAt(0);
        let currentElement = range.commonAncestorContainer;
        if (currentElement.nodeType === Node.TEXT_NODE) {
            currentElement = currentElement.parentElement;
        }

        // Walk up to find the formatting element
        while (currentElement && currentElement !== this.editorElement) {
            const tagName = currentElement.tagName?.toLowerCase();

            if (tagName === 'p') {
                state.format = 'Paragraph';
                break;
            } else if (tagName && tagName.match(/^h[1-6]$/)) {
                const level = tagName.charAt(1);
                state.format = `Heading ${level}`;
                break;
            }

            currentElement = currentElement.parentElement;
        }

        // Check for links
        let linkElement = range.commonAncestorContainer;
        if (linkElement.nodeType === Node.TEXT_NODE) {
            linkElement = linkElement.parentElement;
        }

        while (linkElement && linkElement !== this.editorElement) {
            if (linkElement.tagName === 'A') {
                state.link = true;
                break;
            }
            linkElement = linkElement.parentElement;
        }

        return state;
    }
}

export default ContentWidgetEditorRenderer

