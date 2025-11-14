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

    // UDC Integration
    const { useExternalChanges, getState, publishUpdate } = useUnifiedData()
    const componentId = useMemo(() => `contentcardwidget-${widgetId || 'preview'}`, [widgetId])
    const contextType = useEditorContext()

    const [localConfig, setLocalConfig] = useState(config)

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

    // UDC External Changes Subscription
    useExternalChanges(componentId, (state) => {
        if (!widgetId || !slotName) return
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        if (widget && widget.config && hasWidgetContentChanged(localConfig, widget.config)) {
            setLocalConfig(widget.config)
        }
    })

    // Get image objects from config
    const imageCount = localConfig.imageCount || 1
    const image1 = localConfig.image1
    const image2 = localConfig.image2
    const image3 = localConfig.image3
    const image4 = localConfig.image4

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
    const textPosition = localConfig.textPosition || 'left'

    // Content change handlers
    const handleHeaderChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const updatedConfig = { ...localConfig, header: newContent }
            setLocalConfig(updatedConfig)
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
    }, [componentId, widgetId, slotName, localConfig, publishUpdate, contextType, widgetPath, onConfigChange])

    const handleContentChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const updatedConfig = { ...localConfig, content: newContent }
            setLocalConfig(updatedConfig)
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
    }, [componentId, widgetId, slotName, localConfig, publishUpdate, contextType, widgetPath, onConfigChange])

    // Initialize editors in editor mode
    useEffect(() => {
        if (mode === 'editor') {
            // Initialize header editor
            if (headerContainerRef.current && !headerEditorRef.current) {
                headerEditorRef.current = new SimpleTextEditorRenderer(headerContainerRef.current, {
                    content: localConfig.header || '',
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
                    content: localConfig.content || '',
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

    // Update editor content when config changes externally
    useEffect(() => {
        if (mode === 'editor') {
            if (headerEditorRef.current) {
                headerEditorRef.current.updateConfig({ content: localConfig.header || '' })
            }
            if (contentEditorRef.current && imageCount !== 4) {
                contentEditorRef.current.updateConfig({ content: localConfig.content || '' })
            }
        }
    }, [localConfig.header, localConfig.content, mode, imageCount])

    // Check if using component style with Mustache template
    const componentStyle = localConfig.componentStyle || 'default'
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
                        localConfig.content || '',
                        localConfig.anchor || '',
                        style.variables || {},
                        localConfig
                    )

                    // Add content card specific context
                    mustacheContext.header = localConfig.header || ''
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
                    className="content-card-widget"
                    id={localConfig.anchor || undefined}
                >
                    <div className="content-card-header" ref={headerContainerRef} />

                    <div className={bodyClasses}>
                        {imageCount === 4 ? (
                            // 4 images layout - no text
                            <div className="content-card-images layout-4">
                                {image1Url && <img src={image1Url} alt="" />}
                                {image2Url && <img src={image2Url} alt="" />}
                                {image3Url && <img src={image3Url} alt="" />}
                                {image4Url && <img src={image4Url} alt="" />}
                            </div>
                        ) : (
                            // 1 or 2 images layout - with text
                            <>
                                <div className="content-card-text" ref={contentContainerRef} />

                                <div className={`content-card-images layout-${imageCount}`}>
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
                className="content-card-widget"
                id={localConfig.anchor || undefined}
            >
                {localConfig.header && (
                    <div className="content-card-header">
                        {localConfig.header.split('\n').map((line, idx) => (
                            <React.Fragment key={idx}>
                                {line}
                                {idx < localConfig.header.split('\n').length - 1 && <br />}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                <div className={bodyClasses}>
                    {imageCount === 4 ? (
                        // 4 images layout - no text
                        <div className="content-card-images layout-4">
                            {image1Url && <img src={image1Url} alt="" />}
                            {image2Url && <img src={image2Url} alt="" />}
                            {image3Url && <img src={image3Url} alt="" />}
                            {image4Url && <img src={image4Url} alt="" />}
                        </div>
                    ) : (
                        // 1 or 2 images layout - with text
                        <>
                            <div className="content-card-text">
                                <div dangerouslySetInnerHTML={{ __html: localConfig.content || '' }} />
                            </div>

                            <div className={`content-card-images layout-${imageCount}`}>
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

