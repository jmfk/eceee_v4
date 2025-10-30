/**
 * EASY Content Widget
 * 
 * EASY-specific implementation of the Content widget.
 * Widget type: easy_widgets.ContentWidget
 */

import React, { useRef, useEffect, useCallback, memo, useState } from 'react'
import { FileText } from 'lucide-react'
import ContentWidgetEditorRenderer from './ContentWidgetEditorRenderer.js'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { OperationTypes } from '../../contexts/unified-data/types/operations';
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils';

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
const ContentWidgetEditor = memo(({ content, onChange, className, namespace, slotDimensions }) => {
    const containerRef = useRef(null)
    const rendererRef = useRef(null)
    const lastExternalContentRef = useRef(content)
    const focusHandlerRef = useRef(null)
    const blurHandlerRef = useRef(null)

    useEffect(() => {
        if (containerRef.current && !rendererRef.current) {
            // Initialize vanilla JS renderer with detached toolbar mode
            rendererRef.current = new ContentWidgetEditorRenderer(containerRef.current, {
                content,
                onChange,
                className,
                namespace,  // Pass namespace for media browser
                slotDimensions,  // Pass slot dimensions for imgproxy sizing
                detachedToolbar: true  // Enable global toolbar mode
            })
            rendererRef.current.render()
            lastExternalContentRef.current = content

            // Set up focus/blur handlers for activation/deactivation
            // Wait for the editor element to be created
            setTimeout(() => {
                const editorElement = containerRef.current?.querySelector('[contenteditable="true"]')
                if (editorElement && rendererRef.current) {
                    // Create handler functions
                    focusHandlerRef.current = () => {
                        if (rendererRef.current) {
                            rendererRef.current.activate()
                        }
                    }

                    blurHandlerRef.current = () => {
                        if (rendererRef.current) {
                            rendererRef.current.deactivate()
                        }
                    }

                    // Add event listeners
                    editorElement.addEventListener('focus', focusHandlerRef.current)
                    editorElement.addEventListener('blur', blurHandlerRef.current)
                }
            }, 0)
        }
    }, [])

    // Separate effect for content updates - only update if content is externally changed
    useEffect(() => {
        if (rendererRef.current && content !== lastExternalContentRef.current) {
            const currentEditorContent = rendererRef.current.content
            // Only update if the new content differs from what the editor currently has
            // This prevents the editor from updating itself when it's the source of the change
            if (content !== currentEditorContent) {
                rendererRef.current.updateConfig({ content })
                lastExternalContentRef.current = content
            }
        }
    }, [content])

    // Separate effect for onChange, className, namespace, and slotDimensions updates
    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.updateConfig({ onChange, className, namespace, slotDimensions })
        }
    }, [onChange, className, namespace, slotDimensions])

    useEffect(() => {
        return () => {
            // Clean up event listeners
            const editorElement = containerRef.current?.querySelector('[contenteditable="true"]')
            if (editorElement) {
                if (focusHandlerRef.current) {
                    editorElement.removeEventListener('focus', focusHandlerRef.current)
                }
                if (blurHandlerRef.current) {
                    editorElement.removeEventListener('blur', blurHandlerRef.current)
                }
            }

            // Destroy renderer
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
    // Widget path for infinite nesting
    widgetPath = [],
    // Legacy nested widget context (deprecated)
    nestedParentWidgetId = null,
    nestedParentSlotName = null,
    // Namespace for media browser (optional, defaults to current site)
    namespace = null,
    // Slot configuration (for dimensions)
    slotConfig = null,
    //context = {}
}) => {
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData();
    const configRef = useRef(config);
    const [, forceRerender] = useState({});
    const setConfig = (newConfig) => {
        configRef.current = newConfig;
    }
    const componentId = `widget-${widgetId}`;
    const contextType = useEditorContext();

    useEffect(() => {
        if (!widgetId || !slotName) {
            return;
        }
        const currentState = getState();
        const widget = lookupWidget(currentState, widgetId, slotName, contextType, widgetPath);
        const udcConfig = widget?.config;
        if (udcConfig && hasWidgetContentChanged(configRef.current, udcConfig)) {
            setConfig(udcConfig);
            forceRerender({});
        }
    }, []);

    // Subscribe to external changes
    useExternalChanges(componentId, (state) => {
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath);
        const newConfig = widget?.config;
        if (newConfig && hasWidgetContentChanged(configRef.current, newConfig)) {
            setConfig(newConfig);
            forceRerender({});
        }
    });

    // Enhanced content change handler with stable references
    const handleContentChange = useCallback(async (newContent) => {
        if (newContent !== configRef.current.content) {
            const updatedConfig = {
                ...configRef.current,
                content: newContent
            };
            setConfig(updatedConfig);
            publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: updatedConfig,
                // NEW: Path-based approach (supports infinite nesting)
                widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
                // LEGACY: For backward compatibility with old approach
                slotName: slotName,
                contextType: contextType,
                ...(nestedParentWidgetId && {
                    parentWidgetId: nestedParentWidgetId,
                    parentSlotName: nestedParentSlotName
                })
            });
        }
    }, [componentId, widgetId, slotName, contextType, publishUpdate, onConfigChange])

    if (mode === 'editor') {
        return (
            <ContentWidgetEditor
                content={configRef.current.content}
                onChange={handleContentChange}
                className=""
                namespace={namespace}
                slotDimensions={slotConfig?.dimensions}
            />
        )
    }

    return (
        <div className="content-widget min-h-32 theme-content widget-content">
            {configRef.current.content && <div dangerouslySetInnerHTML={{ __html: configRef.current.content }} />}
        </div>
    )
}, (prevProps, nextProps) => {
    // Custom comparison to prevent re-renders when only object references change
    return (
        prevProps.config?.content === nextProps.config?.content &&
        prevProps.mode === nextProps.mode &&
        prevProps.themeId === nextProps.themeId &&
        prevProps.widgetId === nextProps.widgetId &&
        prevProps.slotName === nextProps.slotName &&
        prevProps.widgetType === nextProps.widgetType
        // Note: onConfigChange is intentionally not compared to allow function updates
    );
})

// === COLOCATED METADATA ===
ContentWidget.displayName = 'Content'
ContentWidget.widgetType = 'easy_widgets.ContentWidget'

// Default configuration
ContentWidget.defaultConfig = {
    content: '<h2>Content</h2><p>This is a content widget.</p>',
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
    description: 'EASY-specific HTML content widget',
    category: 'content',
    icon: FileText,
    tags: ['content', 'html'],
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
