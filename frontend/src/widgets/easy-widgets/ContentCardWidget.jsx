import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { FileText } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'
import { renderMustache, prepareComponentContext } from '../../utils/mustacheRenderer'
import ComponentStyleRenderer from '../../components/ComponentStyleRenderer'
import { getImgproxyUrlFromImage } from '../../utils/imgproxySecure'
import { SimpleTextEditorRenderer } from './SimpleTextEditorRenderer'
import { OperationTypes } from '../../contexts/unified-data/types/operations'

/**
 * EASY Content Card Widget Component
 * Flexible card with header, text content, and configurable image layouts
 */
const ContentCardWidget = ({
    config = {},
    mode = 'preview',
    widgetId = null,
    slotName = null,
    onConfigChange = null,
    context,
    widgetPath = []
}) => {
    const pageId = context?.pageId

    // Get current theme for component styles
    const { currentTheme } = useTheme({ pageId })

    // Use configRef for stable reference (prevents callback recreation issues)
    const configRef = useRef(config)
    const [, forceRerender] = useState({})
    const setConfig = (newConfig) => {
        configRef.current = newConfig
    }

    // UDC Integration
    const { useExternalChanges, getState, publishUpdate } = useUnifiedData()
    const componentId = useMemo(() => `contentcardwidget-${widgetId || 'preview'}`, [widgetId])
    const headerFieldComponentId = useMemo(() => `field-${widgetId || 'preview'}-header`, [widgetId])
    const contentFieldComponentId = useMemo(() => `field-${widgetId || 'preview'}-content`, [widgetId])
    const contextType = useEditorContext()

    // Refs for editor renderers
    const headerEditorRef = useRef(null)
    const contentEditorRef = useRef(null)
    const headerContainerRef = useRef(null)
    const contentContainerRef = useRef(null)

    // State for optimized image URLs
    const [image1Url, setImage1Url] = useState('')
    const [imageLoading, setImageLoading] = useState(false)

    // Initialize from UDC state on mount
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

    // Subscribe to external changes via UDC (widget-level)
    useExternalChanges(componentId, (state) => {
        if (!widgetId || !slotName) return
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newConfig = widget?.config
        if (newConfig && hasWidgetContentChanged(configRef.current, newConfig)) {
            setConfig(newConfig)
            forceRerender({})
        }
    })

    // Subscribe to field-level updates for header field (from form field)
    useExternalChanges(headerFieldComponentId, (state, metadata) => {
        if (!widgetId || !slotName) {
            return
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newHeader = widget?.config?.header

        // Check if update came from this widget's WYSIWYG (self-update)
        const sourceId = metadata?.sourceId || ''
        const isSelfUpdate = sourceId === componentId || sourceId === headerFieldComponentId

        if (newHeader !== undefined && newHeader !== configRef.current.header && !isSelfUpdate) {
            // External update (from form field with isolated-form-* sourceId) - update WYSIWYG editor
            if (headerEditorRef.current) {
                headerEditorRef.current.updateConfig({ content: newHeader })
            }
            // Also update our config ref
            setConfig({ ...configRef.current, header: newHeader })
        }
    })

    // Subscribe to field-level updates for content field (from form field)
    useExternalChanges(contentFieldComponentId, (state, metadata) => {
        if (!widgetId || !slotName) {
            return
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newContent = widget?.config?.content

        // Check if update came from this widget's WYSIWYG (self-update)
        const sourceId = metadata?.sourceId || ''
        const isSelfUpdate = sourceId === componentId || sourceId === contentFieldComponentId

        if (newContent !== undefined && newContent !== configRef.current.content && !isSelfUpdate) {
            // External update (from form field with isolated-form-* sourceId) - update WYSIWYG editor
            if (contentEditorRef.current) {
                contentEditorRef.current.updateConfig({ content: newContent })
            }
            // Also update our config ref
            setConfig({ ...configRef.current, content: newContent })
        }
    })

    // Get image objects from config
    const imageSize = configRef.current.imageSize || 'square'
    const image1 = configRef.current.image1

    // Load optimized image URLs from backend API
    useEffect(() => {
        const loadImages = async () => {
            setImageLoading(true)

            try {
                // Load image URL based on imageSize
                if (image1) {
                    const dimensions = imageSize === 'rectangle'
                        ? { width: 280, height: 140 }
                        : { width: 140, height: 140 }
                    const url = await getImgproxyUrlFromImage(image1, {
                        ...dimensions,
                        resizeType: 'fill'
                    })
                    setImage1Url(url)
                } else {
                    setImage1Url('')
                }
            } catch (error) {
                console.error('Failed to load optimized content card images:', error)
            } finally {
                setImageLoading(false)
            }
        }

        loadImages()
    }, [image1, imageSize])

    // Content change handlers - use configRef for stable references
    const handleHeaderChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const updatedConfig = { ...configRef.current, header: newContent }
            setConfig(updatedConfig)

            // Publish to field-level path for form field sync
            // Use sourceId with widget type prefix: contentcardwidget-${widgetId}-field-header
            const fieldSourceId = `${componentId}-field-header` // contentcardwidget-${widgetId}-field-header
            publishUpdate(fieldSourceId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: { header: newContent }, // Only publish the changed field
                widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
                slotName: slotName,
                contextType: contextType
            })

            if (onConfigChange) {
                onConfigChange(updatedConfig)
            }
        }
    }, [componentId, widgetId, slotName, publishUpdate, contextType, widgetPath, onConfigChange])

    const handleContentChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const updatedConfig = { ...configRef.current, content: newContent }
            setConfig(updatedConfig)

            // Publish to field-level path for form field sync
            // Use sourceId with widget type prefix: contentcardwidget-${widgetId}-field-content
            const fieldSourceId = `${componentId}-field-content` // contentcardwidget-${widgetId}-field-content
            publishUpdate(fieldSourceId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: { content: newContent }, // Only publish the changed field
                widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
                slotName: slotName,
                contextType: contextType
            })

            if (onConfigChange) {
                onConfigChange(updatedConfig)
            }
        }
    }, [componentId, widgetId, slotName, publishUpdate, contextType, widgetPath, onConfigChange])

    // Initialize editors in editor mode (only once)
    useEffect(() => {
        if (mode === 'editor') {
            // Initialize header editor
            if (headerContainerRef.current && !headerEditorRef.current) {
                headerEditorRef.current = new SimpleTextEditorRenderer(headerContainerRef.current, {
                    content: configRef.current.header || '',
                    mode: 'inline-plain',
                    onChange: handleHeaderChange,
                    placeholder: 'Enter card header...',
                    element: 'h2',
                    allowedButtons: undefined,
                    allowedFormats: undefined
                })
                headerEditorRef.current.render()
            }

            // Initialize content editor
            if (contentContainerRef.current && !contentEditorRef.current) {
                contentEditorRef.current = new SimpleTextEditorRenderer(contentContainerRef.current, {
                    content: configRef.current.content || '',
                    mode: 'inline-rich',
                    onChange: handleContentChange,
                    placeholder: 'Enter card content...',
                    element: 'div',
                    allowedButtons: ['format', 'bold', 'italic', 'link'],
                    allowedFormats: ['<p>', '<h2>', '<h3>']
                })
                contentEditorRef.current.render()
            }
        }

        return () => {
            if (headerEditorRef.current) {
                headerEditorRef.current.destroy()
                headerEditorRef.current = null
            }
            if (contentEditorRef.current) {
                contentEditorRef.current.destroy()
                contentEditorRef.current = null
            }
        }
    }, [mode])

    // Update onChange callbacks when handlers change
    useEffect(() => {
        if (mode === 'editor') {
            if (headerEditorRef.current) {
                headerEditorRef.current.updateConfig({ onChange: handleHeaderChange })
            }
            if (contentEditorRef.current) {
                contentEditorRef.current.updateConfig({ onChange: handleContentChange })
            }
        }
    }, [handleHeaderChange, handleContentChange, mode])

    // Update editor content when config changes externally
    useEffect(() => {
        if (mode === 'editor') {
            if (headerEditorRef.current) {
                headerEditorRef.current.updateConfig({ content: configRef.current.header || '' })
            }
            if (contentEditorRef.current) {
                contentEditorRef.current.updateConfig({ content: configRef.current.content || '' })
            }
        }
    }, [configRef.current.header, configRef.current.content, mode])

    // Check if using component style with Mustache template
    const componentStyle = configRef.current.componentStyle || 'default'
    const useCustomStyle = componentStyle && componentStyle !== 'default' && currentTheme?.componentStyles

    if (useCustomStyle) {
        const style = currentTheme.componentStyles[componentStyle]

        if (style) {
            try {
                // Check for passthru mode
                const isPassthru = style.template?.trim() === '{{passthru}}'

                if (!isPassthru) {
                    // Prepare context for Mustache rendering
                    const mustacheContext = prepareComponentContext(
                        configRef.current.content || '',
                        configRef.current.anchor || '',
                        style.variables || {},
                        configRef.current
                    )

                    // Add content card specific context
                    mustacheContext.header = configRef.current.header || ''
                    mustacheContext.imageSize = imageSize
                    mustacheContext.image1 = image1Url

                    // Render template
                    const html = renderMustache(style.template, mustacheContext)

                    // Use ComponentStyleRenderer for consistent scoped rendering
                    const styleId = `content-card-${widgetId || 'preview'}-${componentStyle}`

                    return (
                        <ComponentStyleRenderer
                            template={style.template}
                            context={mustacheContext}
                            css={style.css}
                            styleId={styleId}
                            className=""
                        />
                    )
                }

                // Passthru mode: render default with custom CSS
                const styleId = `content-card-${widgetId || 'preview'}-${componentStyle}`

                return (
                    <div data-style-id={styleId}>
                        {style.css && <style>{`[data-style-id="${styleId}"] { ${style.css} }`}</style>}
                        {renderDefaultCard()}
                    </div>
                )
            } catch (error) {
                console.error('Error rendering custom component style:', error)
                return (
                    <div>
                        <div className="text-red-500 text-sm p-2">Error rendering custom style</div>
                    </div>
                )
            }
        }
    }

    // Default rendering helper function
    function renderDefaultCard() {
        const bodyClasses = [
            'content-card-body',
            `image-size-${imageSize}`
        ].join(' ')

        if (mode === 'editor') {
            return (
                <div
                    className="content-card-widget widget-type-easy-widgets-contentcardwidget container"
                    id={configRef.current.anchor || undefined}
                >
                    <div className="content-card-header header" ref={headerContainerRef} />

                    <div className={bodyClasses}>
                        <div className="content-card-text content" ref={contentContainerRef} />

                        {image1Url && (
                            <div className="content-card-images image">
                                <img className="content-card-image" src={image1Url} alt="" />
                            </div>
                        )}
                    </div>
                </div>
            )
        }

        return (
            <div
                className="content-card-widget widget-type-easy-widgets-contentcardwidget container"
                id={configRef.current.anchor || undefined}
            >
                {configRef.current.header && (
                    <div className="content-card-header header">
                        {configRef.current.header.split('\n').map((line, idx) => (
                            <React.Fragment key={idx}>
                                {line}
                                {idx < configRef.current.header.split('\n').length - 1 && <br />}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                <div className={bodyClasses}>
                    <div className="content-card-text content">
                        <div dangerouslySetInnerHTML={{ __html: configRef.current.content || '' }} />
                    </div>

                    {image1Url && (
                        <div className="content-card-images image">
                            <img className="content-card-image" src={image1Url} alt="" />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Default rendering (no custom style)
    const hasContent = configRef.current.header || configRef.current.content || image1

    if (mode === 'editor') {
        return (
            <div className="content-card-widget-editor">
                {renderDefaultCard()}
            </div>
        )
    }

    // Preview mode
    if (!hasContent) {
        return (
            <div className="content-card-widget">
                <div className="bg-gray-200 h-48 flex items-center justify-center text-gray-500">
                    <FileText className="h-8 w-8 mr-2" />
                    No media
                </div>
            </div>
        )
    }

    return renderDefaultCard()
}

// === COLOCATED METADATA ===
ContentCardWidget.displayName = 'ContentCardWidget'
ContentCardWidget.widgetType = 'easy_widgets.ContentCardWidget'

// Default configuration
ContentCardWidget.defaultConfig = {
    anchor: '',
    header: '',
    content: '',
    imageSize: 'square',
    image1: null,
    componentStyle: 'default'
}

// Display metadata
ContentCardWidget.metadata = {
    name: 'Content Card',
    description: 'Flexible content card with header, text, and configurable image layouts',
    category: 'content',
    icon: FileText,
    tags: ['eceee', 'card', 'content', 'images', 'layout']
}

export default ContentCardWidget

