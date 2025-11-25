/**
 * ContentWidgetEditorRenderer.js
 * Vanilla JS WYSIWYG editor renderer for ContentWidget
 * 
 * This class replaces the React-based ContentWidgetEditor with pure DOM manipulation
 * to avoid conflicts between React and document.execCommand() operations.
 */

import { WysiwygContextMenu } from '../../components/wysiwyg/WysiwygContextMenu.js'

/**
 * Clean up HTML content by only allowing basic HTML elements and attributes
 * Converts complex structures like tables to simple paragraphs
 */
const cleanHTML = (html) => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html

    // Define allowed HTML tags (whitelist approach)
    const blockTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote']
    const inlineTags = ['strong', 'b', 'em', 'i', 'a', 'br', 'code']
    const mediaInsertTags = ['img'] // For media inserts (div is only allowed for media-insert containers)
    const allowedTags = [...blockTags, ...inlineTags, ...mediaInsertTags]
    const allowedAttributes = ['href', 'target']
    const mediaInsertAttributes = [
        'class', 'data-media-insert', 'data-media-type', 'data-media-id',
        'data-width', 'data-align', 'data-gallery-style', 'data-caption', 'data-alt-text', 'data-title',
        'contenteditable', 'draggable',
        'src', 'alt', 'width', 'height', 'loading'
    ]
    const allAllowedAttributes = [...allowedAttributes, ...mediaInsertAttributes]

    // Convert tables to paragraphs before cleaning
    convertTablesToParagraphs(tempDiv)

    // First pass: Remove all non-allowed tags while preserving their text content
    const allElements = tempDiv.querySelectorAll('*')
    const elementsToProcess = Array.from(allElements).reverse() // Process from innermost to outermost

    elementsToProcess.forEach(el => {
        const tagName = el.tagName.toLowerCase()

        // Check if this is a media-insert element - preserve it completely
        if (el.hasAttribute('data-media-insert') && tagName === 'div') {
            return // Skip processing for media inserts
        }

        // Check if this is inside a media-insert - preserve it
        if (el.closest('[data-media-insert]')) {
            return // Skip processing for elements inside media inserts
        }

        if (!allowedTags.includes(tagName)) {
            // Special handling for div - only allowed if it's a media insert
            if (tagName === 'div') {
                // Already handled above - this branch won't be reached for media inserts
                // Convert non-media-insert divs to paragraphs or unwrap
                if (el.textContent.trim().length > 0) {
                    const p = document.createElement('p')
                    p.innerHTML = el.innerHTML
                    el.parentNode.replaceChild(p, el)
                } else {
                    el.remove()
                }
            } else if (tagName === 'span') {
                // Always remove spans (except in media inserts, already checked above)
                // Unwrap span, keep content
                while (el.firstChild) {
                    el.parentNode.insertBefore(el.firstChild, el)
                }
                el.remove()
            } else if (['section', 'article', 'header', 'footer', 'main', 'aside'].includes(tagName)) {
                // Convert block containers to paragraphs if they contain substantial content
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
        // Skip attribute cleaning for media inserts and their children
        if (el.hasAttribute('data-media-insert') || el.closest('[data-media-insert]')) {
            return
        }

        const attrs = Array.from(el.attributes)
        attrs.forEach(attr => {
            // Remove class and style attributes always (except media inserts)
            // Also remove any attributes not in allowed list
            if (attr.name === 'class' || attr.name === 'style' || !allAllowedAttributes.includes(attr.name)) {
                el.removeAttribute(attr.name)
            }
        })
    })

    // Clean up empty paragraphs and normalize whitespace
    cleanupEmptyElements(tempDiv)

    // Fix any invalid nesting before processing text nodes
    fixInvalidNesting(tempDiv)

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
 * Block tags (h1-h6, p, ul, ol, li, blockquote) cannot be nested inside:
 * - Inline tags (strong, em, a, code)
 * - Certain other block tags (h1-h6, p, blockquote)
 * 
 * Strategy: Remove inner block tags completely, keeping only their text content
 */
const fixInvalidNesting = (container) => {
    const blockTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote']
    const inlineTags = ['strong', 'em', 'a', 'code']
    const noNestedBlocksTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote']

    // Find all block elements nested inside tags that can't contain blocks
    const invalidNests = []

    container.querySelectorAll(blockTags.join(',')).forEach(blockEl => {
        let parent = blockEl.parentNode
        while (parent && parent !== container) {
            const parentTag = parent.tagName ? parent.tagName.toLowerCase() : null

            // Check if block is inside an inline tag or a no-nested-blocks tag
            if ((parentTag && inlineTags.includes(parentTag)) ||
                (parentTag && noNestedBlocksTags.includes(parentTag))) {
                invalidNests.push({ block: blockEl, parent })
                break
            }
            parent = parent.parentNode
        }
    })

    // Fix invalid nesting by removing inner block tags, keeping only text
    invalidNests.forEach(({ block }) => {
        // Extract text content and replace block with text nodes
        const textContent = block.textContent
        const textNode = document.createTextNode(textContent)
        block.parentNode.replaceChild(textNode, block)
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
    image: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
    code: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    quote: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>`,
    undo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="m21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>`,
    redo: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="m3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3-2.3"/></svg>`,
    cleanup: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9"/><path d="M7 14h10v2c0 1.1-.9 2-2 2H9c-1.1 0-2-.9-2-2v-2z"/><path d="M9 18v3M15 18v3M12 18v3"/></svg>`
}

/**
 * Inject CSS styles for media inserts
 */
const injectMediaInsertStyles = () => {
    const styleId = 'media-insert-styles'

    // Check if styles are already injected
    if (document.getElementById(styleId)) {
        return
    }

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
        /* Media Insert Base Styles */
        .media-insert {
            display: block;
            margin: 16px 0;
            padding: 8px;
            border: 2px solid transparent;
            border-radius: 4px;
            transition: border-color 0.2s, box-shadow 0.2s;
            cursor: pointer;
            position: relative;
            clear: both;
        }
        
        .media-insert:hover {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .media-insert:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }
        
        /* Width Variants */
        .media-width-full {
            width: 100%;
            max-width: 100%;
        }
        
        .media-width-half {
            width: 50%;
            max-width: 50%;
        }
        
        .media-width-third {
            width: 33.333%;
            max-width: 33.333%;
        }
        
        /* Alignment Variants */
        .media-align-left {
            float: left;
            margin-right: 16px;
            margin-left: 0;
        }
        
        .media-align-center {
            margin-left: auto;
            margin-right: auto;
            float: none;
            clear: both;
        }
        
        .media-align-right {
            float: right;
            margin-left: 16px;
            margin-right: 0;
        }
        
        /* Media Insert Images */
        .media-insert img {
            width: 100%;
            height: auto;
            display: block;
            border-radius: 4px;
        }
        
        /* Media Caption */
        .media-caption {
            margin-top: 8px;
            padding: 4px 8px;
            font-size: 14px;
            color: #6b7280;
            font-style: italic;
            text-align: center;
            background: #f9fafb;
            border-radius: 4px;
        }
        
        /* Media Gallery */
        .media-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px;
            padding: 8px;
        }
        
        .media-gallery-item img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border-radius: 4px;
        }
        
        .media-gallery-empty {
            padding: 32px;
            text-align: center;
            color: #9ca3af;
            font-style: italic;
        }
        
        /* Drag and Drop States */
        .media-insert[draggable="true"] {
            cursor: move;
        }
        
        .media-insert.dragging {
            opacity: 0.4;
        }
        
        .media-drop-indicator {
            height: 2px;
            background: #3b82f6;
            margin: 4px 0;
            border-radius: 1px;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
            .media-width-half,
            .media-width-third {
                width: 100%;
                max-width: 100%;
                float: none;
                margin-left: 0;
                margin-right: 0;
            }
            
            .media-gallery {
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 8px;
            }
        }
    `

    document.head.appendChild(style)
}

// Inject styles when the script loads
injectMediaInsertStyles()

class ContentWidgetEditorRenderer {
    constructor(container, options = {}) {
        this.container = container
        this.content = options.content || ''
        this.className = options.className || ''
        this.onChange = options.onChange || (() => { })
        this.namespace = options.namespace || null // Namespace for media browser
        this.slotDimensions = options.slotDimensions || null // Slot dimensions for imgproxy sizing
        this.pageId = options.pageId || null // Page ID for theme context

        // Theme configuration
        this.maxHeaderLevel = options.maxHeaderLevel || this.getThemeHeaderLevel() || 3
        this.allowedFormats = options.allowedFormats || null // Restrict allowed paragraph formats

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

        // Media insert state
        this.mediaInsertModal = null

        // Bind context menu handler
        this.handleContextMenu = this.handleContextMenu.bind(this)
        this.mediaEditModal = null
        this.draggedElement = null
        this.dropIndicator = null

        // Context menu
        this.contextMenu = null

        // Bind methods to maintain 'this' context
        this.handleContentChange = this.handleContentChange.bind(this)
        this.handlePaste = this.handlePaste.bind(this)
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.execCommand = this.execCommand.bind(this)
        this.handleContextMenu = this.handleContextMenu.bind(this)
        this.handleMediaInsertClick = this.handleMediaInsertClick.bind(this)
        this.handleMediaInsertDragStart = this.handleMediaInsertDragStart.bind(this)
        this.handleMediaInsertDragEnd = this.handleMediaInsertDragEnd.bind(this)
        this.handleMediaInsertDragOver = this.handleMediaInsertDragOver.bind(this)
        this.handleMediaInsertDrop = this.handleMediaInsertDrop.bind(this)
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

        // Code button
        const codeButton = this.createToolbarButton('formatCode', 'Code', ICONS.code)
        this.toolbarButtons.set('formatCode', codeButton)
        this.toolbarElement.appendChild(codeButton)

        // Quote button
        const quoteButton = this.createToolbarButton('formatBlockquote', 'Quote', ICONS.quote)
        this.toolbarButtons.set('formatBlockquote', quoteButton)
        this.toolbarElement.appendChild(quoteButton)

        // Separator
        this.toolbarElement.appendChild(this.createSeparator())

        // Insert Image button
        const imageButton = this.createImageInsertButton()
        this.toolbarButtons.set('insertImage', imageButton)
        this.toolbarElement.appendChild(imageButton)

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

        // Format options - build all possible options
        const allFormatOptions = [
            { value: '<p>', label: 'Paragraph' },
            ...Array.from({ length: 6 }, (_, i) => ({
                value: `<h${i + 1}>`,
                label: `Heading ${i + 1}`
            }))
        ];

        // Filter based on allowedFormats or maxHeaderLevel
        const formatOptions = this.allowedFormats
            ? allFormatOptions.filter(opt => this.allowedFormats.includes(opt.value))
            : [
                { value: '<p>', label: 'Paragraph' },
                ...Array.from({ length: this.maxHeaderLevel }, (_, i) => ({
                    value: `<h${i + 1}>`,
                    label: `Heading ${i + 1}`
                }))
            ];

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
        this.editorElement.className = 'p-3 min-h-32 outline-none default'
        this.editorElement.style.lineHeight = '1.6'

        // Add event listeners
        this.editorElement.addEventListener('input', this.handleContentChange)
        this.editorElement.addEventListener('paste', this.handlePaste)
        this.editorElement.addEventListener('keydown', this.handleKeyDown)
        this.editorElement.addEventListener('mouseup', this.updateButtonStates.bind(this))
        this.editorElement.addEventListener('keyup', this.updateButtonStates.bind(this))

        // Add drag-and-drop listeners for media inserts
        this.editorElement.addEventListener('dragover', this.handleMediaInsertDragOver)
        this.editorElement.addEventListener('drop', this.handleMediaInsertDrop)

        // Add context menu listener
        this.editorElement.addEventListener('contextmenu', this.handleContextMenu)

        // Add blur listener for cleanup
        const blurHandler = () => {
            // Clean up on blur
            setTimeout(() => {
                if (this.editorElement) {
                    fixInvalidNesting(this.editorElement)
                    this.removeDisallowedTags()
                    this.handleContentChange()
                }
            }, 100)
        }
        this.editorElement.addEventListener('blur', blurHandler)

        // Track event listeners for cleanup
        this.eventListeners.set(this.editorElement, () => {
            this.editorElement.removeEventListener('input', this.handleContentChange)
            this.editorElement.removeEventListener('paste', this.handlePaste)
            this.editorElement.removeEventListener('keydown', this.handleKeyDown)
            this.editorElement.removeEventListener('mouseup', this.updateButtonStates.bind(this))
            this.editorElement.removeEventListener('keyup', this.updateButtonStates.bind(this))
            this.editorElement.removeEventListener('dragover', this.handleMediaInsertDragOver)
            this.editorElement.removeEventListener('drop', this.handleMediaInsertDrop)
            this.editorElement.removeEventListener('contextmenu', this.handleContextMenu)
            this.editorElement.removeEventListener('blur', blurHandler)
        })

        // Set up command listener for detached toolbar mode
        if (this.detachedToolbar) {
            this.setupCommandListener();
        }

        // Initialize context menu
        this.contextMenu = new WysiwygContextMenu(this)

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
     * Inserts content at root level, breaking up block elements if needed
     */
    handlePaste(e) {
        e.preventDefault()

        // Get pasted content
        const paste = (e.clipboardData || window.clipboardData).getData('text/html') ||
            (e.clipboardData || window.clipboardData).getData('text/plain')

        if (!paste) return

        // Clean the pasted HTML
        const cleanedPaste = this.cleanHTMLStrict(paste)

        // Get current selection
        const selection = window.getSelection()
        if (!selection.rangeCount) return

        const range = selection.getRangeAt(0)

        // Delete the current selection if any
        if (!selection.isCollapsed) {
            range.deleteContents()
        }

        // Parse the cleaned HTML into DOM elements
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = cleanedPaste

        // Get the elements to insert
        const elementsToInsert = Array.from(tempDiv.childNodes)

        if (elementsToInsert.length === 0) return

        // Find the block element we're currently in
        let currentBlock = range.startContainer
        if (currentBlock.nodeType === Node.TEXT_NODE) {
            currentBlock = currentBlock.parentNode
        }

        // Walk up to find a block-level element
        const blockTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote']
        while (currentBlock && currentBlock !== this.editorElement) {
            if (blockTags.includes(currentBlock.tagName?.toLowerCase())) {
                break
            }
            currentBlock = currentBlock.parentNode
        }

        // If we're at the root level, just insert normally
        if (currentBlock === this.editorElement) {
            elementsToInsert.forEach(element => {
                range.insertNode(element)
                range.setStartAfter(element)
                range.setEndAfter(element)
            })
        } else {
            // We're inside a block element - need to split it
            const blockTagName = currentBlock.tagName?.toLowerCase()

            // Check if we're pasting block-level content
            const hasBlockContent = elementsToInsert.some(el =>
                el.nodeType === Node.ELEMENT_NODE &&
                blockTags.includes(el.tagName?.toLowerCase())
            )

            if (hasBlockContent) {
                // Split the current block at the cursor position
                // Get content before cursor
                const beforeRange = document.createRange()
                beforeRange.setStart(currentBlock, 0)
                beforeRange.setEnd(range.startContainer, range.startOffset)
                const beforeContent = beforeRange.cloneContents()

                // Get content after cursor
                const afterRange = document.createRange()
                afterRange.setStart(range.startContainer, range.startOffset)
                afterRange.setEnd(currentBlock, currentBlock.childNodes.length)
                const afterContent = afterRange.cloneContents()

                // Create before block if it has content
                let beforeBlock = null
                if (beforeContent.textContent.trim()) {
                    beforeBlock = document.createElement(blockTagName)
                    beforeBlock.appendChild(beforeContent)
                }

                // Create after block if it has content
                let afterBlock = null
                if (afterContent.textContent.trim()) {
                    afterBlock = document.createElement(blockTagName)
                    afterBlock.appendChild(afterContent)
                }

                // Insert all the new elements in order
                const insertionPoint = currentBlock
                const parent = currentBlock.parentNode

                // Insert before block if exists
                if (beforeBlock) {
                    parent.insertBefore(beforeBlock, insertionPoint)
                }

                // Insert pasted elements
                elementsToInsert.forEach(element => {
                    parent.insertBefore(element, insertionPoint)
                })

                // Insert after block if exists
                if (afterBlock) {
                    parent.insertBefore(afterBlock, insertionPoint)
                }

                // Remove the original block
                parent.removeChild(insertionPoint)

                // Set cursor after the last inserted element
                const lastInserted = elementsToInsert[elementsToInsert.length - 1]
                range.setStartAfter(lastInserted)
                range.setEndAfter(lastInserted)
                selection.removeAllRanges()
                selection.addRange(range)
            } else {
                // Pasting inline content - just insert normally
                elementsToInsert.forEach(element => {
                    range.insertNode(element)
                    range.setStartAfter(element)
                    range.setEndAfter(element)
                })
                selection.removeAllRanges()
                selection.addRange(range)
            }
        }

        // Fix invalid nesting and remove disallowed tags
        setTimeout(() => {
            if (this.editorElement) {
                fixInvalidNesting(this.editorElement)
                this.removeDisallowedTags()
                this.handleContentChange()
            }
        }, 0)
    }

    /**
     * Handle key down events
     */
    handleKeyDown(e) {
        const isMod = e.metaKey || e.ctrlKey // Cmd on Mac, Ctrl on Windows/Linux

        // Tab handling for indentation
        if (e.key === 'Tab') {
            e.preventDefault()
            if (e.shiftKey) {
                this.execCommand('outdent')
            } else {
                this.execCommand('indent')
            }
            return
        }

        // Keyboard shortcuts with Cmd/Ctrl
        if (isMod) {
            // Cmd/Ctrl + 0: Paragraph
            if (e.key === '0') {
                if (!this.allowedFormats || this.allowedFormats.includes('<p>')) {
                    e.preventDefault()
                    this.execCommand('formatBlock', '<p>')
                }
                return
            }

            // Cmd/Ctrl + 1-6: Headings
            if (e.key >= '1' && e.key <= '6') {
                const level = parseInt(e.key)
                const formatValue = `<h${level}>`;
                if (level <= this.maxHeaderLevel) {
                    if (!this.allowedFormats || this.allowedFormats.includes(formatValue)) {
                        e.preventDefault()
                        this.execCommand('formatBlock', formatValue)
                    }
                }
                return
            }

            // Cmd/Ctrl + 7: Bullet list
            if (e.key === '7') {
                e.preventDefault()
                this.execCommand('insertUnorderedList')
                return
            }

            // Cmd/Ctrl + 8: Numbered list
            if (e.key === '8') {
                e.preventDefault()
                this.execCommand('insertOrderedList')
                return
            }

            // Cmd/Ctrl + L: Link
            if (e.key === 'l' || e.key === 'L') {
                e.preventDefault()
                this.handleLinkAction()
                return
            }

            // Cmd/Ctrl + ,: Outdent
            if (e.key === ',') {
                e.preventDefault()
                this.execCommand('outdent')
                return
            }

            // Cmd/Ctrl + .: Indent
            if (e.key === '.') {
                e.preventDefault()
                this.execCommand('indent')
                return
            }

            // Cmd/Ctrl + K: Code
            if (e.key === 'k' || e.key === 'K') {
                e.preventDefault()
                this.formatAsCode()
                return
            }

            // Cmd/Ctrl + J: Blockquote
            if (e.key === 'j' || e.key === 'J') {
                e.preventDefault()
                this.formatAsBlockquote()
                return
            }
        }

        // Enter key handling for lists
        if (e.key === 'Enter') {
            setTimeout(this.handleContentChange, 0)
        }
    }

    /**
     * Format selection as inline code
     */
    formatAsCode() {
        const selection = window.getSelection()
        if (!selection.rangeCount || selection.isCollapsed) return

        const range = selection.getRangeAt(0)
        const selectedText = selection.toString()

        // Check if already inside a code tag
        let element = range.commonAncestorContainer
        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement
        }

        // Walk up to find if we're inside a code tag
        let insideCode = false
        let codeElement = null
        let tempElement = element
        while (tempElement && tempElement !== this.editorElement) {
            if (tempElement.tagName === 'CODE') {
                insideCode = true
                codeElement = tempElement
                break
            }
            tempElement = tempElement.parentElement
        }

        if (insideCode && codeElement) {
            // Remove code formatting
            const parent = codeElement.parentNode
            while (codeElement.firstChild) {
                parent.insertBefore(codeElement.firstChild, codeElement)
            }
            parent.removeChild(codeElement)
        } else {
            // Add code formatting
            const codeTag = document.createElement('code')
            codeTag.textContent = selectedText
            range.deleteContents()
            range.insertNode(codeTag)

            // Move cursor after the code element
            range.setStartAfter(codeTag)
            range.setEndAfter(codeTag)
            selection.removeAllRanges()
            selection.addRange(range)
        }

        this.handleContentChange()
    }

    /**
     * Format current block as blockquote
     */
    formatAsBlockquote() {
        const selection = window.getSelection()
        if (!selection.rangeCount) return

        const range = selection.getRangeAt(0)
        let element = range.commonAncestorContainer
        if (element.nodeType === Node.TEXT_NODE) {
            element = element.parentElement
        }

        // Find the block element
        while (element && element !== this.editorElement) {
            const tagName = element.tagName?.toLowerCase()
            if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'].includes(tagName)) {
                break
            }
            element = element.parentElement
        }

        if (!element || element === this.editorElement) return

        // Toggle blockquote
        if (element.tagName === 'BLOCKQUOTE') {
            // Remove blockquote - convert to paragraph
            const p = document.createElement('p')
            p.innerHTML = element.innerHTML
            element.parentNode.replaceChild(p, element)
        } else if (element.parentElement.tagName === 'BLOCKQUOTE') {
            // Already inside blockquote, remove it
            const blockquote = element.parentElement
            const p = document.createElement('p')
            p.innerHTML = element.innerHTML
            blockquote.parentNode.replaceChild(p, blockquote)
        } else {
            // Wrap in blockquote
            const blockquote = document.createElement('blockquote')
            element.parentNode.insertBefore(blockquote, element)
            blockquote.appendChild(element)
        }

        this.handleContentChange()
    }

    /**
     * Handle context menu
     */
    handleContextMenu(e) {
        // Check global context menu config first, then LayoutRenderer
        const globalEnabled = window.__contextMenuConfig?.enabled ?? true
        const layoutEnabled = window.__layoutRenderer?.uiConfig?.enableContextMenu ?? true
        const enabled = globalEnabled && layoutEnabled

        console.log('ContentWidget context menu check:', {
            globalEnabled,
            layoutEnabled,
            finalEnabled: enabled
        })

        if (!enabled) {
            console.log('Context menu blocked by config')
            return
        }

        e.preventDefault()

        if (!this.contextMenu || this.isDestroyed) {
            return
        }

        const selection = window.getSelection()
        const hasTextSelection = selection && !selection.isCollapsed && selection.toString().trim().length > 0

        // Get current state
        const state = this.getToolbarState()

        // Check if cursor is on a link
        let isOnLink = false
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            let element = range.commonAncestorContainer
            if (element.nodeType === Node.TEXT_NODE) {
                element = element.parentElement
            }
            while (element && element !== this.editorElement) {
                if (element.tagName === 'A') {
                    isOnLink = true
                    break
                }
                element = element.parentElement
            }
        }

        // Check if cursor is on a media insert
        let isOnMedia = false
        let mediaElement = null
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            let element = range.commonAncestorContainer
            if (element.nodeType === Node.TEXT_NODE) {
                element = element.parentElement
            }
            while (element && element !== this.editorElement) {
                if (element.hasAttribute && element.hasAttribute('data-media-insert')) {
                    isOnMedia = true
                    mediaElement = element
                    break
                }
                element = element.parentElement
            }
        }

        // Build context object
        const context = {
            hasTextSelection,
            isOnLink,
            isOnMedia,
            mediaElement,
            bold: state.bold,
            italic: state.italic,
            insertUnorderedList: state.insertUnorderedList,
            insertOrderedList: state.insertOrderedList,
            format: state.format,
            maxHeaderLevel: state.maxHeaderLevel,
            allowedFormats: this.allowedFormats
        }

        // Show context menu
        this.contextMenu.show(e, context)
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
        overlay.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50'
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

        // Check for code
        let codeElement = range.commonAncestorContainer
        if (codeElement.nodeType === Node.TEXT_NODE) {
            codeElement = codeElement.parentElement
        }

        while (codeElement && codeElement !== this.editorElement) {
            if (codeElement.tagName === 'CODE') {
                const codeButton = this.toolbarButtons.get('formatCode')
                if (codeButton) {
                    codeButton.classList.add('bg-blue-500', 'text-white')
                    codeButton.classList.remove('hover:bg-gray-200')
                }
                break
            }
            codeElement = codeElement.parentElement
        }

        // Check for blockquote
        let quoteElement = range.commonAncestorContainer
        if (quoteElement.nodeType === Node.TEXT_NODE) {
            quoteElement = quoteElement.parentElement
        }

        while (quoteElement && quoteElement !== this.editorElement) {
            if (quoteElement.tagName === 'BLOCKQUOTE') {
                const quoteButton = this.toolbarButtons.get('formatBlockquote')
                if (quoteButton) {
                    quoteButton.classList.add('bg-blue-500', 'text-white')
                    quoteButton.classList.remove('hover:bg-gray-200')
                }
                break
            }
            quoteElement = quoteElement.parentElement
        }

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
     * Create Insert Image button
     */
    createImageInsertButton() {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'p-1 hover:bg-gray-200 rounded'
        button.title = 'Insert Image or Collection'
        button.innerHTML = ICONS.image

        const clickHandler = (e) => {
            e.preventDefault()
            this.openMediaInsertModal()
        }

        button.addEventListener('click', clickHandler)
        this.eventListeners.set(button, () => {
            button.removeEventListener('click', clickHandler)
        })

        return button
    }

    /**
     * Open media insert modal
     */
    async openMediaInsertModal() {
        // Dynamically import React and the modal component
        const React = await import('react')
        const ReactDOM = await import('react-dom/client')
        const { default: MediaInsertModal } = await import('@/components/media/MediaInsertModal.jsx')
        const { GlobalNotificationProvider } = await import('@/contexts/GlobalNotificationContext.jsx')
        const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
        const { namespacesApi } = await import('@/api')

        // Create a QueryClient for this modal
        const queryClient = new QueryClient()

        // Get namespace - use provided one or fetch default
        let namespace = this.namespace
        if (!namespace) {
            try {
                const defaultNamespace = await namespacesApi.getDefault()
                namespace = defaultNamespace?.slug || 'default'
            } catch (error) {
                console.error('Failed to load default namespace:', error)
                namespace = 'default' // Fallback
            }
        }

        // Create modal container
        const modalContainer = document.createElement('div')
        document.body.appendChild(modalContainer)

        // Create root and render modal
        const root = ReactDOM.createRoot(modalContainer)

        const handleInsert = async (config) => {
            await this.insertMediaAtCursor(config, this.slotDimensions)
            root.unmount()
            modalContainer.remove()
            // Re-inject styles after React cleanup completes
            setTimeout(() => injectMediaInsertStyles(), 100)
        }

        const handleClose = () => {
            root.unmount()
            modalContainer.remove()
            // Re-inject styles after React cleanup completes
            setTimeout(() => injectMediaInsertStyles(), 100)
        }

        // Wrap modal with required providers
        root.render(
            React.createElement(QueryClientProvider, { client: queryClient },
                React.createElement(GlobalNotificationProvider, {},
                    React.createElement(MediaInsertModal, {
                        isOpen: true,
                        onClose: handleClose,
                        onInsert: handleInsert,
                        namespace: namespace,
                        pageId: this.pageId
                    })
                )
            )
        )
    }

    /**
     * Insert media at cursor position
     */
    async insertMediaAtCursor(config, slotDimensions = null) {
        if (!this.editorElement) return

        const { createMediaInsertHTML } = await import('@/utils/mediaInsertRenderer.js')

        try {
            // Generate HTML for media insert
            const html = await createMediaInsertHTML(config.mediaData, config, slotDimensions)

            // Get selection and insert at cursor
            const selection = window.getSelection()
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0)
                range.deleteContents()

                // Create temporary div to parse HTML
                const tempDiv = document.createElement('div')
                tempDiv.innerHTML = html
                const mediaElement = tempDiv.firstChild

                // Insert the media element
                range.insertNode(mediaElement)

                // Set up event listeners for the new media insert
                this.setupMediaInsertListeners(mediaElement)

                // Move cursor after the inserted element
                range.setStartAfter(mediaElement)
                range.setEndAfter(mediaElement)
                selection.removeAllRanges()
                selection.addRange(range)
            } else {
                // No selection, append to end
                const tempDiv = document.createElement('div')
                tempDiv.innerHTML = html
                const mediaElement = tempDiv.firstChild

                this.editorElement.appendChild(mediaElement)
                this.setupMediaInsertListeners(mediaElement)
            }

            this.handleContentChange()
        } catch (error) {
            console.error('Failed to insert media:', error)
            alert('Failed to insert media. Please try again.')
        }
    }

    /**
     * Setup event listeners for a media insert element
     */
    setupMediaInsertListeners(element) {
        if (!element || !element.hasAttribute('data-media-insert')) return

        // Clean up any orphaned opacity styles or dragging classes
        element.style.opacity = ''
        element.classList.remove('dragging')

        // Click handler for editing
        element.addEventListener('click', this.handleMediaInsertClick)

        // Drag handlers
        element.addEventListener('dragstart', this.handleMediaInsertDragStart)
        element.addEventListener('dragend', this.handleMediaInsertDragEnd)
    }

    /**
     * Handle click on media insert (open edit modal)
     */
    async handleMediaInsertClick(e) {
        const mediaElement = e.currentTarget
        if (!mediaElement || !mediaElement.hasAttribute('data-media-insert')) return

        e.preventDefault()
        e.stopPropagation()

        // Extract current config
        const { extractMediaConfig, fetchMediaData } = await import('@/utils/mediaInsertRenderer.js')
        const config = extractMediaConfig(mediaElement)

        let mediaData = null
        let mediaLoadError = null

        try {
            // Fetch media data
            mediaData = await fetchMediaData(config.mediaId, config.mediaType)
        } catch (error) {
            console.error('Failed to load media data:', error)
            mediaLoadError = error
            // Continue to open modal with error state
        }

        // Open edit modal (even if media failed to load)
        this.openMediaEditModal(mediaElement, config, mediaData, mediaLoadError)
    }

    /**
     * Open media edit modal
     */
    async openMediaEditModal(mediaElement, initialConfig, mediaData, mediaLoadError = null) {
        const React = await import('react')
        const ReactDOM = await import('react-dom/client')
        const { default: MediaEditModal } = await import('@/components/media/MediaEditModal.jsx')
        const { GlobalNotificationProvider } = await import('@/contexts/GlobalNotificationContext.jsx')
        const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
        const { namespacesApi } = await import('@/api')

        // Create a QueryClient for this modal
        const queryClient = new QueryClient()

        // Get namespace - use provided one or fetch default
        let namespace = this.namespace
        if (!namespace) {
            try {
                const defaultNamespace = await namespacesApi.getDefault()
                namespace = defaultNamespace?.slug || 'default'
            } catch (error) {
                console.error('Failed to load default namespace:', error)
                namespace = 'default' // Fallback
            }
        }

        // Create modal container
        const modalContainer = document.createElement('div')
        document.body.appendChild(modalContainer)

        // Create root and render modal
        const root = ReactDOM.createRoot(modalContainer)

        const handleSave = async (updatedConfig) => {
            // updatedConfig now includes the new mediaData if it was changed
            await this.updateMediaInsert(mediaElement, updatedConfig.mediaData, updatedConfig, this.slotDimensions)
            root.unmount()
            modalContainer.remove()
            // Re-inject styles after React cleanup completes
            setTimeout(() => injectMediaInsertStyles(), 100)
        }

        const handleDelete = () => {
            this.deleteMediaInsert(mediaElement)
            root.unmount()
            modalContainer.remove()
            // Re-inject styles after React cleanup completes
            setTimeout(() => injectMediaInsertStyles(), 100)
        }

        const handleClose = () => {
            root.unmount()
            modalContainer.remove()
            // Re-inject styles after React cleanup completes
            setTimeout(() => injectMediaInsertStyles(), 100)
        }

        // Wrap modal with required providers
        root.render(
            React.createElement(QueryClientProvider, { client: queryClient },
                React.createElement(GlobalNotificationProvider, {},
                    React.createElement(MediaEditModal, {
                        isOpen: true,
                        onClose: handleClose,
                        onSave: handleSave,
                        onDelete: handleDelete,
                        initialConfig: { ...initialConfig, mediaType: initialConfig.mediaType },
                        mediaData: mediaData,
                        mediaLoadError: mediaLoadError,
                        namespace: namespace,
                        pageId: this.pageId
                    })
                )
            )
        )
    }

    /**
     * Update media insert with new configuration
     */
    async updateMediaInsert(element, mediaData, config, slotDimensions = null) {
        const { updateMediaInsertHTML } = await import('@/utils/mediaInsertRenderer.js')

        try {
            updateMediaInsertHTML(element, mediaData, config, slotDimensions)

            // Force content update - get fresh innerHTML after DOM modification
            if (this.editorElement) {
                const currentContent = this.editorElement.innerHTML
                this.content = currentContent
                this.onChange(currentContent)
            }

            // Update button states
            setTimeout(() => this.updateButtonStates(), 0)
        } catch (error) {
            console.error('Failed to update media insert:', error)
            alert('Failed to update media. Please try again.')
        }
    }

    /**
     * Delete media insert
     */
    deleteMediaInsert(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element)
            this.handleContentChange()
        }
    }

    /**
     * Handle drag start for media insert
     */
    handleMediaInsertDragStart(e) {
        this.draggedElement = e.currentTarget
        e.currentTarget.classList.add('dragging')
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/html', e.currentTarget.outerHTML)
    }

    /**
     * Handle drag end for media insert
     */
    handleMediaInsertDragEnd(e) {
        e.currentTarget.classList.remove('dragging')

        // Remove any drop indicators
        if (this.dropIndicator && this.dropIndicator.parentNode) {
            this.dropIndicator.parentNode.removeChild(this.dropIndicator)
            this.dropIndicator = null
        }

        // Clean up any orphaned dragging classes (defensive)
        if (this.editorElement) {
            const draggingElements = this.editorElement.querySelectorAll('.media-insert.dragging')
            draggingElements.forEach(el => el.classList.remove('dragging'))
        }
    }

    /**
     * Handle drag over for repositioning
     */
    handleMediaInsertDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault()
        }

        e.dataTransfer.dropEffect = 'move'

        // Show drop indicator
        const target = e.target
        if (target && target !== this.draggedElement) {
            // Find the nearest block element or media insert
            let blockElement = target
            while (blockElement && blockElement !== this.editorElement) {
                if (blockElement.hasAttribute('data-media-insert') ||
                    ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI'].includes(blockElement.tagName)) {
                    break
                }
                blockElement = blockElement.parentElement
            }

            if (blockElement && blockElement !== this.editorElement && blockElement !== this.draggedElement) {
                // Create or update drop indicator
                if (!this.dropIndicator) {
                    this.dropIndicator = document.createElement('div')
                    this.dropIndicator.className = 'media-drop-indicator'
                    this.dropIndicator.style.cssText = 'height: 2px; background: #3b82f6; margin: 4px 0;'
                }

                // Determine if we should insert before or after
                const rect = blockElement.getBoundingClientRect()
                const midpoint = rect.top + rect.height / 2

                if (e.clientY < midpoint) {
                    blockElement.parentNode.insertBefore(this.dropIndicator, blockElement)
                } else {
                    blockElement.parentNode.insertBefore(this.dropIndicator, blockElement.nextSibling)
                }
            }
        }

        return false
    }

    /**
     * Handle drop for repositioning
     */
    handleMediaInsertDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation()
        }

        if (this.draggedElement && this.dropIndicator && this.dropIndicator.parentNode) {
            // Move the dragged element to the drop location
            this.dropIndicator.parentNode.insertBefore(this.draggedElement, this.dropIndicator)
            this.dropIndicator.parentNode.removeChild(this.dropIndicator)
            this.dropIndicator = null

            this.handleContentChange()
        }

        return false
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
            } else if (!['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'p', 'li', 'ul', 'ol', 'a', 'br', 'code', 'blockquote'].includes(tagName)) {
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
     * Remove disallowed tags (span, div) and attributes (class, style)
     * Preserves media inserts and their special attributes
     */
    removeDisallowedTags() {
        if (!this.editorElement) return

        // Remove all spans (except in media inserts)
        const spans = Array.from(this.editorElement.querySelectorAll('span'))
        spans.forEach(span => {
            if (!span.closest('[data-media-insert]')) {
                // Unwrap span, keep content
                while (span.firstChild) {
                    span.parentNode.insertBefore(span.firstChild, span)
                }
                span.remove()
            }
        })

        // Remove all divs (except media inserts themselves)
        const divs = Array.from(this.editorElement.querySelectorAll('div'))
        divs.forEach(div => {
            if (!div.hasAttribute('data-media-insert') && !div.closest('[data-media-insert]')) {
                // Unwrap div, keep content
                while (div.firstChild) {
                    div.parentNode.insertBefore(div.firstChild, div)
                }
                div.remove()
            }
        })

        // Remove class and style attributes (except on media inserts)
        const allElements = this.editorElement.querySelectorAll('*')
        allElements.forEach(el => {
            if (!el.hasAttribute('data-media-insert') && !el.closest('[data-media-insert]')) {
                el.removeAttribute('class')
                el.removeAttribute('style')
            }
        })
    }

    /**
     * Execute editor commands
     */
    execCommand(command, value = null) {
        // Handle special commands
        if (command === 'addImage') {
            this.openMediaInsertModal()
            return
        }

        if (command === 'editImage') {
            // Find the media element in the current selection or context
            const selection = window.getSelection()
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0)
                let element = range.commonAncestorContainer
                if (element.nodeType === Node.TEXT_NODE) {
                    element = element.parentElement
                }
                while (element && element !== this.editorElement) {
                    if (element.hasAttribute && element.hasAttribute('data-media-insert')) {
                        this.handleMediaInsertClick({ currentTarget: element })
                        return
                    }
                    element = element.parentElement
                }
            }
            return
        }

        if (command === 'formatCode') {
            this.formatAsCode()
            return
        }

        if (command === 'formatBlockquote') {
            this.formatAsBlockquote()
            return
        }

        // Handle standard document commands
        document.execCommand(command, false, value)

        // Apply strict cleanup after formatBlock to fix nesting
        if (command === 'formatBlock') {
            setTimeout(() => {
                if (this.editorElement) {
                    fixInvalidNesting(this.editorElement)
                    // Also remove any spans/divs that might have been created
                    this.removeDisallowedTags()
                    this.handleContentChange()
                }
            }, 0)
        } else {
            this.handleContentChange()
        }
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

            // Setup listeners for any media inserts in the content
            this.setupExistingMediaInserts();
        }, 0);
    }

    /**
     * Setup listeners for existing media inserts in the content
     */
    setupExistingMediaInserts() {
        if (!this.editorElement) return;

        const mediaInserts = this.editorElement.querySelectorAll('[data-media-insert]');
        mediaInserts.forEach(element => {
            this.setupMediaInsertListeners(element);
        });
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
        if (options.namespace !== undefined) {
            this.namespace = options.namespace
        }
        if (options.slotDimensions !== undefined) {
            this.slotDimensions = options.slotDimensions
        }
        if (options.pageId !== undefined) {
            this.pageId = options.pageId
        }
        if (options.allowedFormats !== undefined) {
            this.allowedFormats = options.allowedFormats
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

        // Destroy context menu
        if (this.contextMenu) {
            this.contextMenu.destroy()
            this.contextMenu = null
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
            } else if (command === 'insertImage') {
                this.openMediaInsertModal();
            } else if (command === 'formatCode') {
                this.formatAsCode();
            } else if (command === 'formatBlockquote') {
                this.formatAsBlockquote();
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
            code: false,
            blockquote: false,
            format: 'Format',
            maxHeaderLevel: this.maxHeaderLevel,
            allowedFormats: this.allowedFormats
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

        // Check for code
        let codeElement = range.commonAncestorContainer;
        if (codeElement.nodeType === Node.TEXT_NODE) {
            codeElement = codeElement.parentElement;
        }

        while (codeElement && codeElement !== this.editorElement) {
            if (codeElement.tagName === 'CODE') {
                state.code = true;
                break;
            }
            codeElement = codeElement.parentElement;
        }

        // Check for blockquote
        let quoteElement = range.commonAncestorContainer;
        if (quoteElement.nodeType === Node.TEXT_NODE) {
            quoteElement = quoteElement.parentElement;
        }

        while (quoteElement && quoteElement !== this.editorElement) {
            if (quoteElement.tagName === 'BLOCKQUOTE') {
                state.blockquote = true;
                break;
            }
            quoteElement = quoteElement.parentElement;
        }

        return state;
    }
}

export default ContentWidgetEditorRenderer

