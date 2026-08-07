/**
 * EASY Content Widget
 * 
 * EASY-specific implementation of the Content widget.
 * Widget type: easy_widgets.ContentWidget
 */

import React, { useRef, useEffect, useLayoutEffect, useCallback, memo, useState } from 'react'
import { FileText } from 'lucide-react'
import ContentWidgetEditorRenderer from './ContentWidgetEditorRenderer.js'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
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
    while ((node = walker.nextNode())) {
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
const ContentWidgetEditor = memo(({ content, contentUpdateSource = 'external', onChange, className, namespace, slotDimensions, pageId, siteRootId, widgetId }) => {
    const containerRef = useRef(null)
    const rendererRef = useRef(null)
    const lastExternalContentRef = useRef(content)
    const editorElementRef = useRef(null)
    const focusHandlerRef = useRef(null)
    const blurHandlerRef = useRef(null)
    const listenerSetupTimeoutRef = useRef(null)

    const removeEditorListeners = useCallback(() => {
        const editorElement = editorElementRef.current
        if (editorElement) {
            if (focusHandlerRef.current) {
                editorElement.removeEventListener('focus', focusHandlerRef.current)
            }
            if (blurHandlerRef.current) {
                editorElement.removeEventListener('blur', blurHandlerRef.current)
            }
        }

        editorElementRef.current = null
        focusHandlerRef.current = null
        blurHandlerRef.current = null
    }, [])

    const bindEditorListeners = useCallback(() => {
        const editorElement = containerRef.current?.querySelector('[contenteditable="true"]') ||
            rendererRef.current?.editorElement
        if (!editorElement || !rendererRef.current) {
            return false
        }

        if (
            editorElementRef.current === editorElement &&
            focusHandlerRef.current &&
            blurHandlerRef.current
        ) {
            return true
        }

        removeEditorListeners()

        focusHandlerRef.current = () => {
            rendererRef.current?.activate()
        }

        blurHandlerRef.current = () => {
            rendererRef.current?.deactivate()
        }

        editorElement.addEventListener('focus', focusHandlerRef.current)
        editorElement.addEventListener('blur', blurHandlerRef.current)
        editorElementRef.current = editorElement
        return true
    }, [removeEditorListeners])

    useLayoutEffect(() => {
        if (containerRef.current && !rendererRef.current) {
            // Initialize vanilla JS renderer with detached toolbar mode
            rendererRef.current = new ContentWidgetEditorRenderer(containerRef.current, {
                content,
                onChange,
                className,
                namespace,  // Pass namespace for media browser
                slotDimensions,  // Pass slot dimensions for imgproxy sizing
                pageId,  // Pass pageId for theme context
                siteRootId,  // Pass siteRootId for link picker navigation
                detachedToolbar: true,  // Enable global toolbar mode
                allowedFormats: ['<p>', '<h1>', '<h2>', '<h3>', '<h4>']  // Restrict to Paragraph, H1-H4
            })
            rendererRef.current.render()
            lastExternalContentRef.current = content

            if (!bindEditorListeners()) {
                listenerSetupTimeoutRef.current = setTimeout(bindEditorListeners, 0)
            }
        }

        return () => {
            if (listenerSetupTimeoutRef.current) {
                clearTimeout(listenerSetupTimeoutRef.current)
                listenerSetupTimeoutRef.current = null
            }

            removeEditorListeners()

            if (rendererRef.current) {
                rendererRef.current.destroy()
                rendererRef.current = null
            }
        }
    }, [bindEditorListeners, removeEditorListeners])

    // Separate effect for content updates - keep the vanilla renderer aligned with React's canonical prop.
    useEffect(() => {
        if (rendererRef.current) {
            const currentEditorContent = rendererRef.current.content
            if (contentUpdateSource !== 'local' && content !== currentEditorContent) {
                rendererRef.current.updateConfig({ content })
            }
            lastExternalContentRef.current = content
        }
    }, [content, contentUpdateSource])

    // Separate effect for onChange, className, namespace, slotDimensions, and pageId updates
    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.updateConfig({
                onChange,
                className,
                namespace,
                slotDimensions,
                pageId,
                siteRootId
            })
            if (!editorElementRef.current) {
                bindEditorListeners()
            }
        }
    }, [onChange, className, namespace, slotDimensions, pageId, siteRootId, bindEditorListeners])

    return <div ref={containerRef} className="" data-testid={widgetId ? `content-widget-editor-${widgetId}` : undefined} />
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
    context = {}
}) => {
    const { useExternalChanges } = useUnifiedData();
    const [localConfig, setLocalConfig] = useState(config);
    const localConfigRef = useRef(localConfig);
    const onConfigChangeRef = useRef(onConfigChange);
    const contentUpdateSourceRef = useRef('external');
    const latestLocalContentRef = useRef(config?.content);
    const pendingLocalContentEchoesRef = useRef(new Set());
    const componentId = `widget-${widgetId}`;
    const contextType = useEditorContext();
    const ownerComponentId = context?.pageId && context?.versionId
        ? `page-editor-${context.pageId}-${context.versionId}`
        : null;

    // Keep refs in sync for stable callback references
    localConfigRef.current = localConfig;
    onConfigChangeRef.current = onConfigChange;

    const syncIncomingConfig = useCallback((nextConfig) => {
        const nextContent = nextConfig?.content;
        const isPendingLocalEcho = pendingLocalContentEchoesRef.current.has(nextContent);

        if (!hasWidgetContentChanged(localConfigRef.current, nextConfig)) {
            if (isPendingLocalEcho) {
                pendingLocalContentEchoesRef.current.delete(nextContent);
            }
            return;
        }

        if (isPendingLocalEcho && nextContent !== latestLocalContentRef.current) {
            pendingLocalContentEchoesRef.current.delete(nextContent);
            return;
        }

        if (isPendingLocalEcho) {
            pendingLocalContentEchoesRef.current.delete(nextContent);
            contentUpdateSourceRef.current = 'local';
        } else {
            pendingLocalContentEchoesRef.current.clear();
            contentUpdateSourceRef.current = 'external';
        }

        localConfigRef.current = nextConfig;
        setLocalConfig(nextConfig);
    }, []);

    // Sync from incoming prop changes (e.g. undo, conflict resolution, WidgetEditorPanel save)
    useEffect(() => {
        syncIncomingConfig(config);
    }, [config, syncIncomingConfig]);

    // Subscribe to external UDC changes (e.g. cross-tab sync, WidgetEditorPanel writing to same widget)
    useExternalChanges(componentId, (state, metadata) => {
        if (ownerComponentId && metadata?.sourceId === ownerComponentId) {
            return;
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath);
        const newConfig = widget?.config;
        if (newConfig) {
            syncIncomingConfig(newConfig);
        }
    });

    // Route inline edits through onConfigChange so ReactLayoutRenderer -> updateLocalWidgets ->
    // pageVersionData.widgets is updated synchronously, which lets recomputeDirtyState see
    // the change and ensures handleActualSave saves the current content.
    const handleContentChange = useCallback((newContent) => {
        if (newContent !== localConfigRef.current.content) {
            const updatedConfig = {
                ...localConfigRef.current,
                content: newContent
            };
            latestLocalContentRef.current = newContent;
            pendingLocalContentEchoesRef.current.add(newContent);
            contentUpdateSourceRef.current = 'local';
            localConfigRef.current = updatedConfig;
            setLocalConfig(updatedConfig);
            if (onConfigChangeRef.current) {
                onConfigChangeRef.current(updatedConfig);
            }
        }
    }, [])

    if (mode === 'editor') {
        return (
            <ContentWidgetEditor
                content={localConfig.content}
                contentUpdateSource={contentUpdateSourceRef.current}
                onChange={handleContentChange}
                className=""
                namespace={namespace}
                slotDimensions={slotConfig?.dimensions}
                pageId={context?.pageId}
                siteRootId={context?.siteRootId}
                widgetId={widgetId}
            />
        )
    }

    return (
        <div className="content-widget widget-type-easy-widgets-contentwidget min-h-32">
            {localConfig.content && <div dangerouslySetInnerHTML={{ __html: localConfig.content }} />}
        </div>
    )
}, (prevProps, nextProps) => {
    return (
        prevProps.config?.content === nextProps.config?.content &&
        prevProps.mode === nextProps.mode &&
        prevProps.themeId === nextProps.themeId &&
        prevProps.widgetId === nextProps.widgetId &&
        prevProps.slotName === nextProps.slotName &&
        prevProps.widgetType === nextProps.widgetType &&
        prevProps.onConfigChange === nextProps.onConfigChange &&
        prevProps.context?.pageId === nextProps.context?.pageId &&
        prevProps.context?.versionId === nextProps.context?.versionId
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
