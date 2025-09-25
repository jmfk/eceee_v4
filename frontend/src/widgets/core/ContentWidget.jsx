import React, { useRef, useEffect, useCallback, memo, useState } from 'react'
import { FileText, Type, Eraser } from 'lucide-react'
import ContentWidgetEditorRenderer from './ContentWidgetEditorRenderer.js'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { OperationTypes } from '../../contexts/unified-data/types/operations';
import { getWidgetContent, hasWidgetContentChanged } from '../../utils/widgetUtils';

/**
 * Clean up HTML content by removing unsupported tags and attributes
 */
const cleanHTML = (html) => {
    const tempDiv = document.createElement('p')
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
 * Vanilla JS Editor Wrapper Component
 * Wraps the vanilla JS ContentWidgetEditorRenderer for React integration
 */
const ContentWidgetEditor = memo(({ content, onChange, className }) => {
    const containerRef = useRef(null)
    const rendererRef = useRef(null)

    useEffect(() => {
        if (containerRef.current && !rendererRef.current) {
            // Initialize vanilla JS renderer
            rendererRef.current = new ContentWidgetEditorRenderer(containerRef.current, {
                content,
                onChange,
                className
            })
            rendererRef.current.render()
        }
    }, [])

    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.updateConfig({
                content,
                onChange,
                className
            })
        }
    }, [content, onChange, className])

    useEffect(() => {
        return () => {
            if (rendererRef.current) {
                rendererRef.current.destroy()
                rendererRef.current = null
            }
        }
    }, [])

    return <div ref={containerRef} />
})

/**
 * Content Widget Component
 * Renders HTML content with WYSIWYG editing capabilities
 */
const ContentWidget = memo(({
    config = {},
    mode = 'editor',
    onConfigChange,
    themeId = null,
    widgetId = null,
    slotName = null,
    widgetType = null,
    context = {}
}) => {
    const { useExternalChanges, publishUpdate } = useUnifiedData();
    const [content, setContent] = useState(config.content || 'Content will appear here...');
    const componentId = `widget-${widgetId}`;
    const contextType = useEditorContext();

    // Initialize widget in UnifiedDataContext when component mounts
    useEffect(() => {
        if (widgetId) {
            // First add the widget to the state
            const initialConfig = {
                content: config.content || ContentWidget.defaultConfig.content,
                allow_scripts: config.allow_scripts ?? ContentWidget.defaultConfig.allow_scripts,
                sanitize_html: config.sanitize_html ?? ContentWidget.defaultConfig.sanitize_html
            };
        }
    }, [widgetId]);

    // Subscribe to external changes
    useExternalChanges(componentId, (state) => {
        const { content: newContent } = getWidgetContent(state, widgetId, slotName);
        if (hasWidgetContentChanged(content, newContent)) {
            setContent(newContent);
        }
    });

    // Enhanced content change handler with update lock
    const handleContentChange = useCallback(async (newContent) => {
        if (newContent !== content) {
            setContent(newContent);
            publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                slotName: slotName,
                contextType: contextType,
                config: {
                    ...config,
                    content: newContent
                }
            });
            if (onConfigChange) {
                const updatedConfig = {
                    ...config,
                    content: newContent
                };
                onConfigChange(updatedConfig);
            }
        }
    }, [config, content, onConfigChange])

    if (mode === 'editor') {
        return (
            <ContentWidgetEditor
                content={content}
                onChange={handleContentChange}
                className=""
            />
        )
    }

    return (
        <div className="content-widget min-h-32 theme-content widget-content">
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
    description: 'HTML content with WYSIWYG editing capabilities',
    category: 'content',
    icon: FileText,
    tags: ['content', 'html', 'text', 'rich', 'editor', 'wysiwyg'],
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
