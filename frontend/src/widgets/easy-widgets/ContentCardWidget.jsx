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
    const contextType = useEditorContext()

    // Refs for editor renderers
    const headerEditorRef = useRef(null)
    const contentEditorRef = useRef(null)
    const headerContainerRef = useRef(null)
    const contentContainerRef = useRef(null)

    // State for optimized image URLs
    const [image1Url, setImage1Url] = useState('')
    const [image2Url, setImage2Url] = useState('')
    const [image3Url, setImage3Url] = useState('')
    const [image4Url, setImage4Url] = useState('')
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

    // Subscribe to external changes via UDC
    useExternalChanges(componentId, (state) => {
        if (!widgetId || !slotName) return
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newConfig = widget?.config
        if (newConfig && hasWidgetContentChanged(configRef.current, newConfig)) {
            setConfig(newConfig)
            forceRerender({})
        }
    })

    // Get image objects from config
    const imageCount = configRef.current.imageCount || 1
    const image1 = configRef.current.image1
    const image2 = configRef.current.image2
    const image3 = configRef.current.image3
    const image4 = configRef.current.image4

    // Load optimized image URLs from backend API
    useEffect(() => {
        const loadImages = async () => {
            setImageLoading(true)

            try {
                // Load image URLs based on imageCount
                if (image1) {
                    const url = await getImgproxyUrlFromImage(image1, {
                        width: 800,
                        height: 600,
                        resizeType: 'fill'
                    })
                    setImage1Url(url)
                } else {
                    setImage1Url('')
                }

                if (image2 && imageCount >= 2) {
                    const url = await getImgproxyUrlFromImage(image2, {
                        width: 800,
                        height: 600,
                        resizeType: 'fill'
                    })
                    setImage2Url(url)
                } else {
                    setImage2Url('')
                }

                if (image3 && imageCount >= 4) {
                    const url = await getImgproxyUrlFromImage(image3, {
                        width: 800,
                        height: 600,
                        resizeType: 'fill'
                    })
                    setImage3Url(url)
                } else {
                    setImage3Url('')
                }

                if (image4 && imageCount >= 4) {
                    const url = await getImgproxyUrlFromImage(image4, {
                        width: 800,
                        height: 600,
                        resizeType: 'fill'
                    })
                    setImage4Url(url)
                } else {
                    setImage4Url('')
                }
            } catch (error) {
                console.error('Failed to load optimized content card images:', error)
            } finally {
                setImageLoading(false)
            }
        }

        loadImages()
    }, [image1, image2, image3, image4, imageCount])

    // Determine text position
    const textPosition = configRef.current.textPosition || 'left'

    // Content change handlers - use configRef for stable references
    const handleHeaderChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const updatedConfig = { ...configRef.current, header: newContent }
            setConfig(updatedConfig)
            publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: updatedConfig,
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
            publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: updatedConfig,
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
                    mode: 'text-only',
                    onChange: handleHeaderChange,
                    placeholder: 'Enter card header...',
                    element: 'h2'
                })
                headerEditorRef.current.render()
            }

            // Initialize content editor
            if (contentContainerRef.current && !contentEditorRef.current && imageCount !== 4) {
                contentEditorRef.current = new SimpleTextEditorRenderer(contentContainerRef.current, {
                    content: configRef.current.content || '',
                    mode: 'inline-rich',
                    onChange: handleContentChange,
                    placeholder: 'Enter card content...',
                    element: 'div'
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
    }, [mode, imageCount])

    // Update onChange callbacks when handlers change
    useEffect(() => {
        if (mode === 'editor') {
            if (headerEditorRef.current) {
                headerEditorRef.current.updateConfig({ onChange: handleHeaderChange })
            }
            if (contentEditorRef.current && imageCount !== 4) {
                contentEditorRef.current.updateConfig({ onChange: handleContentChange })
            }
        }
    }, [handleHeaderChange, handleContentChange, mode, imageCount])

    // Update editor content when config changes externally
    useEffect(() => {
        if (mode === 'editor') {
            if (headerEditorRef.current) {
                headerEditorRef.current.updateConfig({ content: configRef.current.header || '' })
            }
            if (contentEditorRef.current && imageCount !== 4) {
                contentEditorRef.current.updateConfig({ content: configRef.current.content || '' })
            }
        }
    }, [configRef.current.header, configRef.current.content, mode, imageCount])

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
                    mustacheContext.textPosition = textPosition
                    mustacheContext.imageCount = imageCount
                    mustacheContext.image1 = image1Url
                    mustacheContext.image2 = image2Url
                    mustacheContext.image3 = image3Url
                    mustacheContext.image4 = image4Url

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
            `text-${textPosition}`,
            `image-count-${imageCount}`
        ].join(' ')

        if (mode === 'editor') {
            return (
                <div
                    className="content-card-widget container"
                    id={configRef.current.anchor || undefined}
                >
                    <div className="content-card-header header" ref={headerContainerRef} />

                    <div className={bodyClasses}>
                        {imageCount === 4 ? (
                            // 4 images layout - no text
                            <div className="content-card-images image layout-4">
                                {image1Url && <img src={image1Url} alt="" />}
                                {image2Url && <img src={image2Url} alt="" />}
                                {image3Url && <img src={image3Url} alt="" />}
                                {image4Url && <img src={image4Url} alt="" />}
                            </div>
                        ) : (
                            // 1 or 2 images layout - with text
                            <>
                                <div className="content-card-text content" ref={contentContainerRef} />

                                <div className={`content-card-images image layout-${imageCount}`}>
                                    {image1Url && <img src={image1Url} alt="" />}
                                    {image2Url && imageCount >= 2 && <img src={image2Url} alt="" />}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )
        }

        return (
            <div
                className="content-card-widget container"
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
                    {imageCount === 4 ? (
                        // 4 images layout - no text
                        <div className="content-card-images image layout-4">
                            {image1Url && <img src={image1Url} alt="" />}
                            {image2Url && <img src={image2Url} alt="" />}
                            {image3Url && <img src={image3Url} alt="" />}
                            {image4Url && <img src={image4Url} alt="" />}
                        </div>
                    ) : (
                        // 1 or 2 images layout - with text
                        <>
                            <div className="content-card-text content">
                                <div dangerouslySetInnerHTML={{ __html: configRef.current.content || '' }} />
                            </div>

                            <div className={`content-card-images image layout-${imageCount}`}>
                                {image1Url && <img src={image1Url} alt="" />}
                                {image2Url && imageCount >= 2 && <img src={image2Url} alt="" />}
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // Default rendering (no custom style)
    const hasImages = image1 || image2 || image3 || image4

    if (mode === 'editor') {
        return (
            <div className="content-card-widget-editor">
                {!hasImages && (
                    <div className="bg-gray-200 h-48 flex items-center justify-center text-gray-500 mb-4">
                        <FileText className="h-8 w-8 mr-2" />
                        Content Card placeholder - Add images to get started
                    </div>
                )}
                {renderDefaultCard()}
            </div>
        )
    }

    // Preview mode
    if (!hasImages) {
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
    textPosition: 'left',
    imageCount: 1,
    image1: null,
    image2: null,
    image3: null,
    image4: null,
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

