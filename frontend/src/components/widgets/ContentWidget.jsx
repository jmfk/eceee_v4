import React, { useState, useRef, useEffect, useCallback, memo } from 'react'
import { FileText, Bold, Italic, List, ListOrdered, Undo, Redo, Type, Eraser } from 'lucide-react'
import { useRenderTracker, useStabilityTracker } from '../../utils/debugHooks'
import { useContentEditorTheme } from '../../hooks/useTheme'

/**
 * Clean up HTML content by removing unsupported tags and attributes
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
 * Content Editor Component
 */
const ContentEditor = memo(({ content, onChange, className }) => {
    const editorRef = useRef(null)

    useEffect(() => {
        if (editorRef.current && content !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = content
        }
    }, [content])

    const handleContentChange = useCallback(() => {
        if (editorRef.current && onChange) {
            const cleanedContent = cleanHTML(editorRef.current.innerHTML)
            // Only call onChange if content actually changed
            if (cleanedContent !== content) {
                onChange(cleanedContent)
            }
        }
    }, [onChange, content])

    const execCommand = useCallback((command, value = null) => {
        document.execCommand(command, false, value)
        handleContentChange()
    }, [handleContentChange])

    const handlePaste = useCallback((e) => {
        e.preventDefault()
        const paste = (e.clipboardData || window.clipboardData).getData('text/html') ||
            (e.clipboardData || window.clipboardData).getData('text/plain')
        const cleanedPaste = cleanHTML(paste)
        document.execCommand('insertHTML', false, cleanedPaste)
        handleContentChange()
    }, [handleContentChange])

    const handleKeyDown = useCallback((e) => {
        // Tab handling for indentation
        if (e.key === 'Tab') {
            e.preventDefault()
            if (e.shiftKey) {
                execCommand('outdent')
            } else {
                execCommand('indent')
            }
        }
        // Enter key handling for lists
        else if (e.key === 'Enter') {
            setTimeout(handleContentChange, 0)
        }
    }, [execCommand, handleContentChange])

    return (
        <div className="content-editor">
            {/* Toolbar */}
            <div className="toolbar flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
                <button
                    type="button"
                    onClick={() => execCommand('bold')}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Bold"
                >
                    <Bold className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('italic')}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Italic"
                >
                    <Italic className="h-4 w-4" />
                </button>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <select
                    onChange={(e) => execCommand('formatBlock', e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                    defaultValue=""
                >
                    <option value="">Format</option>
                    <option value="<h1>">Heading 1</option>
                    <option value="<h2>">Heading 2</option>
                    <option value="<h3>">Heading 3</option>
                    <option value="<h4>">Heading 4</option>
                    <option value="<h5>">Heading 5</option>
                    <option value="<h6>">Heading 6</option>
                    <option value="<p>">Paragraph</option>
                </select>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <button
                    type="button"
                    onClick={() => execCommand('insertUnorderedList')}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Bullet List"
                >
                    <List className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('insertOrderedList')}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Numbered List"
                >
                    <ListOrdered className="h-4 w-4" />
                </button>

                <div className="w-px h-6 bg-gray-300 mx-1"></div>

                <button
                    type="button"
                    onClick={() => execCommand('undo')}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Undo"
                >
                    <Undo className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => execCommand('redo')}
                    className="p-1 hover:bg-gray-200 rounded"
                    title="Redo"
                >
                    <Redo className="h-4 w-4" />
                </button>
            </div>

            {/* Editor */}
            <div
                ref={editorRef}
                contentEditable
                className="p-3 min-h-32 outline-none"
                onInput={handleContentChange}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                style={{ lineHeight: '1.6' }}
                suppressContentEditableWarning={true}
            />
        </div>
    )
})

/**
 * Content Widget Component
 * Renders HTML content with sanitization options
 */
const ContentWidget = memo(({ config = {}, mode = 'editor', onConfigChange, themeId = null }) => {
    // Debug tracking
    const renderCount = useRenderTracker('ContentWidget', { config, mode, onConfigChange })
    useStabilityTracker(config, 'ContentWidget.config')
    useStabilityTracker(onConfigChange, 'ContentWidget.onConfigChange')

    // Apply theme to content editor
    const { getThemeClassName } = useContentEditorTheme({
        themeId,
        enabled: !!themeId
    })

    const {
        content = 'Content will appear here...',
        allow_scripts = false,
        sanitize_html = true
    } = config

    // Memoize the content change handler to prevent unnecessary re-renders
    const handleContentChange = useCallback((newContent) => {
        console.log('handleContentChange', newContent)
        if (onConfigChange && newContent !== content) {
            onConfigChange({
                ...config,
                content: newContent
            })
        }
    }, [onConfigChange, config, content])
    console.log(mode)
    if (mode === 'editor') {
        return (
            <ContentEditor
                content={content}
                onChange={handleContentChange}
                className={`${getThemeClassName()}`}
            />
        )
    }

    return (
        <div className={`content-widget min-h-32 ${getThemeClassName()} theme-content widget-content`}>
            {content && <div dangerouslySetInnerHTML={{ __html: content }} />}
        </div>
    )
})

// === COLOCATED METADATA ===
ContentWidget.displayName = 'ContentWidget'
ContentWidget.widgetType = 'core_widgets.ContentWidget'

// Default configuration
ContentWidget.defaultConfig = {
    content: '<h2>Welcome</h2><p>This is sample content. You can add any HTML here including headings, paragraphs, lists, links, and more.</p>',
    allow_scripts: false,
    sanitize_html: true
}

// Action handlers for widget menu items
ContentWidget.actionHandlers = {
    'format-content': (widgetInstance, layoutRenderer) => {
        // Get the widget element
        const widgetElement = document.querySelector(`[data-widget-id="${widgetInstance.id}"]`)
        if (!widgetElement) return

        // Find the content editor within this widget
        const editorElement = widgetElement.querySelector('[contenteditable="true"]')
        if (editorElement) {
            // Apply basic formatting cleanup
            const currentContent = editorElement.innerHTML
            const cleanedContent = cleanHTML(currentContent)
            editorElement.innerHTML = cleanedContent

            // Trigger change event to save the cleaned content
            const event = new Event('input', { bubbles: true })
            editorElement.dispatchEvent(event)
        }
    },

    'clear-formatting': (widgetInstance, layoutRenderer) => {
        // Get the widget element
        const widgetElement = document.querySelector(`[data-widget-id="${widgetInstance.id}"]`)
        if (!widgetElement) return

        // Find the content editor within this widget
        const editorElement = widgetElement.querySelector('[contenteditable="true"]')
        if (editorElement) {
            // Strip all formatting, keep only text content
            const textOnly = editorElement.textContent || editorElement.innerText
            editorElement.innerHTML = `<p>${textOnly}</p>`

            // Trigger change event to save the plain content
            const event = new Event('input', { bubbles: true })
            editorElement.dispatchEvent(event)
        }
    },

    'insert-template': (widgetInstance, layoutRenderer) => {
        // Get the widget element
        const widgetElement = document.querySelector(`[data-widget-id="${widgetInstance.id}"]`)
        if (!widgetElement) return

        // Find the content editor within this widget
        const editorElement = widgetElement.querySelector('[contenteditable="true"]')
        if (editorElement) {
            // Insert a basic content template
            const template = `
                <h2>Welcome</h2>
                <p>This is a sample content template with:</p>
                <ul>
                    <li>A heading</li>
                    <li>Some text</li>
                    <li>A bullet list</li>
                </ul>
                <p>You can edit this content using the toolbar above.</p>
            `
            editorElement.innerHTML = cleanHTML(template)

            // Trigger change event to save the template
            const event = new Event('input', { bubbles: true })
            editorElement.dispatchEvent(event)
        }
    }
}

// Display metadata
ContentWidget.metadata = {
    name: 'Content',
    description: 'HTML content with sanitization options for rich text display',
    category: 'content',
    icon: FileText,
    tags: ['content', 'html', 'text', 'rich', 'editor'],
    menuItems: [
        {
            icon: 'svg:type',
            label: 'Clean Formatting',
            action: 'format-content',
            className: 'text-blue-700 hover:bg-blue-50'
        },
        {
            icon: 'svg:eraser',
            label: 'Remove All Formatting',
            action: 'clear-formatting',
            className: 'text-orange-700 hover:bg-orange-50'
        },
        {
            type: 'separator'
        },
        {
            icon: 'svg:file-text',
            label: 'Insert Template',
            action: 'insert-template',
            className: 'text-green-700 hover:bg-green-50'
        }
    ]
}

export default ContentWidget