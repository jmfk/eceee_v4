/**
 * EASY Bio Widget
 * 
 * EASY-specific implementation of the Bio widget.
 * Widget type: easy_widgets.BioWidget
 */

import React, { useRef, useEffect, useCallback, memo, useState } from 'react'
import { User } from 'lucide-react'
import ContentWidgetEditorRenderer from './ContentWidgetEditorRenderer.js'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'

/**
 * Vanilla JS Editor Wrapper Component for Bio Text
 * Wraps the vanilla JS ContentWidgetEditorRenderer for React integration
 */
const BioTextEditor = memo(({ content, onChange, className, namespace, slotDimensions, pageId }) => {
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
                namespace,
                slotDimensions,
                pageId,
                detachedToolbar: true,
                allowedFormats: ['<p>', '<h2>', '<h3>']
            })
            rendererRef.current.render()
            lastExternalContentRef.current = content

            // Set up focus/blur handlers for activation/deactivation
            setTimeout(() => {
                const editorElement = containerRef.current?.querySelector('[contenteditable="true"]')
                if (editorElement && rendererRef.current) {
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

                    editorElement.addEventListener('focus', focusHandlerRef.current)
                    editorElement.addEventListener('blur', blurHandlerRef.current)
                }
            }, 0)
        }
    }, [])

    // Separate effect for content updates
    useEffect(() => {
        if (rendererRef.current && content !== lastExternalContentRef.current) {
            const currentEditorContent = rendererRef.current.content
            if (content !== currentEditorContent) {
                rendererRef.current.updateConfig({ content })
                lastExternalContentRef.current = content
            }
        }
    }, [content])

    // Separate effect for other config updates
    useEffect(() => {
        if (rendererRef.current) {
            rendererRef.current.updateConfig({ onChange, className, namespace, slotDimensions, pageId })
        }
    }, [onChange, className, namespace, slotDimensions, pageId])

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

    return <div ref={containerRef} className="bio-widget__text cms-content" />
})

/**
 * Bio Widget Component
 * Renders image and biography text with inline WYSIWYG editing
 */
const BioWidget = memo(({
    config = {},
    mode = 'editor',
    onConfigChange,
    themeId = null,
    widgetId = null,
    slotName = null,
    widgetType = null,
    widgetPath = [],
    nestedParentWidgetId = null,
    nestedParentSlotName = null,
    namespace = null,
    slotConfig = null,
    context = {}
}) => {
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData()
    const configRef = useRef(config)
    const [, forceRerender] = useState({})
    const setConfig = (newConfig) => {
        configRef.current = newConfig
    }
    const componentId = `widget-${widgetId}`
    const contextType = useEditorContext()

    useEffect(() => {
        if (!widgetId || !slotName) {
            return
        }
        const currentState = getState()
        const widget = lookupWidget(currentState, widgetId, slotName, contextType, widgetPath)
        const udcConfig = widget?.config
        if (udcConfig && hasWidgetContentChanged(configRef.current, udcConfig)) {
            setConfig(udcConfig)
            forceRerender({})
        }
    }, [])

    // Subscribe to external changes
    useExternalChanges(componentId, (state) => {
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newConfig = widget?.config
        if (newConfig && hasWidgetContentChanged(configRef.current, newConfig)) {
            setConfig(newConfig)
            forceRerender({})
        }
    })

    // Bio text change handler
    const handleBioTextChange = useCallback(async (newContent) => {
        if (newContent !== configRef.current.bioText) {
            const updatedConfig = {
                ...configRef.current,
                bioText: newContent
            }
            setConfig(updatedConfig)
            publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: updatedConfig,
                widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
                slotName: slotName,
                contextType: contextType,
                ...(nestedParentWidgetId && {
                    parentWidgetId: nestedParentWidgetId,
                    parentSlotName: nestedParentSlotName
                })
            })
        }
    }, [componentId, widgetId, slotName, contextType, publishUpdate, widgetPath, nestedParentWidgetId, nestedParentSlotName])

    const image = configRef.current.image
    const bioText = configRef.current.bioText || ''
    const textLayout = configRef.current.textLayout || 'column'
    const caption = configRef.current.caption || ''
    const useContentMargins = configRef.current.useContentMargins || false
    const anchor = configRef.current.anchor || ''

    if (mode === 'editor') {
        return (
            <div 
                className={`bio-widget bio-widget--${textLayout} widget-type-easy-widgets-biowidget${useContentMargins ? ' xl:pl-[80px] xl:pr-[60px]' : ''}`}
                {...(anchor && { id: anchor })}
            >
                <div className="bio-widget__container">
                    {image && image.url && (
                        <div className="bio-widget__image">
                            <img 
                                src={image.url} 
                                alt={image.altText || ''}
                                loading="lazy"
                            />
                            {caption && (
                                <div className="bio-widget__caption">{caption}</div>
                            )}
                        </div>
                    )}
                    <BioTextEditor
                        content={bioText}
                        onChange={handleBioTextChange}
                        className=""
                        namespace={namespace}
                        slotDimensions={slotConfig?.dimensions}
                        pageId={context?.pageId}
                    />
                </div>
            </div>
        )
    }

    return (
        <div 
            className={`bio-widget bio-widget--${textLayout} widget-type-easy-widgets-biowidget${useContentMargins ? ' xl:pl-[80px] xl:pr-[60px]' : ''}`}
            {...(anchor && { id: anchor })}
        >
            <div className="bio-widget__container">
                {image && image.url && (
                    <div className="bio-widget__image">
                        <img 
                            src={image.url} 
                            alt={image.altText || ''}
                            loading="lazy"
                        />
                        {caption && (
                            <div className="bio-widget__caption">{caption}</div>
                        )}
                    </div>
                )}
                <div className="bio-widget__text cms-content">
                    {bioText && <div dangerouslySetInnerHTML={{ __html: bioText }} />}
                </div>
            </div>
        </div>
    )
}, (prevProps, nextProps) => {
    return (
        prevProps.config?.bioText === nextProps.config?.bioText &&
        prevProps.config?.image?.url === nextProps.config?.image?.url &&
        prevProps.config?.textLayout === nextProps.config?.textLayout &&
        prevProps.config?.caption === nextProps.config?.caption &&
        prevProps.config?.useContentMargins === nextProps.config?.useContentMargins &&
        prevProps.config?.anchor === nextProps.config?.anchor &&
        prevProps.mode === nextProps.mode &&
        prevProps.themeId === nextProps.themeId &&
        prevProps.widgetId === nextProps.widgetId &&
        prevProps.slotName === nextProps.slotName &&
        prevProps.widgetType === nextProps.widgetType
    )
})

// === COLOCATED METADATA ===
BioWidget.displayName = 'Bio'
BioWidget.widgetType = 'easy_widgets.BioWidget'

// Default configuration
BioWidget.defaultConfig = {
    image: null,
    bioText: '<p>Enter biography text here. You can use the toolbar to format your text.</p>',
    caption: '',
    textLayout: 'column'
}

// Display metadata
BioWidget.metadata = {
    name: 'Bio',
    description: 'Biography widget with image and text',
    category: 'content',
    icon: User,
    tags: ['bio', 'profile', 'content']
}

export default BioWidget

