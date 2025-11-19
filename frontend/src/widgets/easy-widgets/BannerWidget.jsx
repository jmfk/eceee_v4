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
 * EASY Banner Widget Component
 * Flexible banner with text content and configurable image layouts
 */
const BannerWidget = ({
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
    const componentId = useMemo(() => `bannerwidget-${widgetId || 'preview'}`, [widgetId])
    const fieldComponentId = useMemo(() => `field-${widgetId || 'preview'}-content`, [widgetId])
    const contextType = useEditorContext()

    // State for optimized image URLs
    const [image1Url, setImage1Url] = useState('')
    const [image2Url, setImage2Url] = useState('')
    const [image3Url, setImage3Url] = useState('')
    const [image4Url, setImage4Url] = useState('')
    const [backgroundImageUrl, setBackgroundImageUrl] = useState('')
    const [imageLoading, setImageLoading] = useState(false)

    // Refs for editor renderers
    const contentEditorRef = useRef(null)
    const contentContainerRef = useRef(null)

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

    // Subscribe to field-level updates for content field (from form field)
    // Form publishes with isolated-form-* componentId, so sourceId = isolated-form-*
    // Widget publishes with bannerwidget-* or field-* componentId, so sourceId = bannerwidget-* or field-*
    useExternalChanges(fieldComponentId, (state, metadata) => {
        if (!widgetId || !slotName) {
            return
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newContent = widget?.config?.content

        // Check if update came from this widget's WYSIWYG (self-update)
        const sourceId = metadata?.sourceId || ''
        // Self-update if: widget-level (bannerwidget-123) OR field-level (field-123-content) from this widget
        const isSelfUpdate = sourceId === componentId || sourceId === fieldComponentId
        // Form publishes with isolated-form-* so it will update WYSIWYG (not self)

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
    const imageCount = configRef.current.imageCount || 1
    const bannerMode = configRef.current.bannerMode || 'text'
    const image1 = configRef.current.image1
    const image2 = configRef.current.image2
    const image3 = configRef.current.image3
    const image4 = configRef.current.image4
    const backgroundImage = configRef.current.backgroundImage

    // Load optimized image URLs from backend API
    useEffect(() => {
        const loadImages = async () => {
            setImageLoading(true)

            try {
                // Load background image
                if (backgroundImage) {
                    const url = await getImgproxyUrlFromImage(backgroundImage, {
                        width: 1920,
                        height: 600,
                        resizeType: 'fill'
                    })
                    setBackgroundImageUrl(url)
                } else {
                    setBackgroundImageUrl('')
                }

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
                console.error('Failed to load optimized banner images:', error)
            } finally {
                setImageLoading(false)
            }
        }

        loadImages()
    }, [image1, image2, image3, image4, imageCount, backgroundImage])

    // Determine text position
    const textPosition = configRef.current.textPosition || 'left'

    // Content change handler - use configRef for stable reference
    const handleContentChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const updatedConfig = { ...configRef.current, content: newContent }
            setConfig(updatedConfig)
            
            // Publish to field-level path for form field sync
            // Use sourceId with widget type prefix: bannerwidget-${widgetId}-field-content
            // Content field subscribes to field-${widgetId}-content, so sourceId !== componentId
            const fieldSourceId = `${componentId}-field-content` // bannerwidget-${widgetId}-field-content
            publishUpdate(fieldSourceId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: { content: newContent }, // Only publish the changed field
                widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
                slotName: slotName,
                contextType: contextType
            })
            
            // REMOVED: Widget-level publish - not needed for form sync
            // Form only needs field-level updates, and widget-level publish causes form rerenders
            // If other components need widget-level updates, they can subscribe to field-level paths
            
            if (onConfigChange) {
                onConfigChange(updatedConfig)
            }
        }
    }, [fieldComponentId, widgetId, slotName, publishUpdate, contextType, widgetPath, onConfigChange])

    // Initialize editor in editor mode (only once)
    useEffect(() => {
        if (mode === 'editor' && imageCount !== 4) {
            if (contentContainerRef.current && !contentEditorRef.current) {
                const editorMode = bannerMode === 'header' ? 'text-only' : 'inline-rich'
                const element = bannerMode === 'header' ? 'h2' : 'div'

                contentEditorRef.current = new SimpleTextEditorRenderer(contentContainerRef.current, {
                    content: configRef.current.content || '',
                    mode: editorMode,
                    onChange: handleContentChange,
                    placeholder: bannerMode === 'header' ? 'Enter banner header...' : 'Enter banner content...',
                    element: element
                })
                contentEditorRef.current.render()
            }
        }

        return () => {
            if (contentEditorRef.current) {
                contentEditorRef.current.destroy()
                contentEditorRef.current = null
            }
        }
    }, [mode, imageCount, bannerMode])

    // Update onChange callback when handler changes
    useEffect(() => {
        if (mode === 'editor' && imageCount !== 4) {
            if (contentEditorRef.current) {
                contentEditorRef.current.updateConfig({ onChange: handleContentChange })
            }
        }
    }, [handleContentChange, mode, imageCount])

    // Update editor content when config changes externally (from UDC/widget form)
    useEffect(() => {
        if (mode === 'editor' && imageCount !== 4) {
            if (contentEditorRef.current) {
                const editorMode = bannerMode === 'header' ? 'text-only' : 'inline-rich'
                const element = bannerMode === 'header' ? 'h2' : 'div'

                contentEditorRef.current.updateConfig({
                    content: configRef.current.content || '',
                    mode: editorMode,
                    element: element
                })
            }
        }
    }, [configRef.current.content, mode, imageCount, bannerMode])

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

                    // Add banner specific context
                    mustacheContext.textPosition = textPosition
                    mustacheContext.imageCount = imageCount
                    mustacheContext.image1 = image1Url
                    mustacheContext.image2 = image2Url
                    mustacheContext.image3 = image3Url
                    mustacheContext.image4 = image4Url

                    // Render template
                    const html = renderMustache(style.template, mustacheContext)

                    // Use ComponentStyleRenderer for consistent scoped rendering
                    const styleId = `banner-${widgetId || 'preview'}-${componentStyle}`

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
                const styleId = `banner-${widgetId || 'preview'}-${componentStyle}`

                return (
                    <div data-style-id={styleId}>
                        {style.css && <style>{`[data-style-id="${styleId}"] { ${style.css} }`}</style>}
                        {renderDefaultBanner()}
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
    function renderDefaultBanner() {
        const bodyClasses = [
            'banner-body',
            `text-${textPosition}`,
            `image-count-${imageCount}`
        ].join(' ')

        if (mode === 'editor') {
            return (
                <div
                    className="banner-widget widget-type-easy-widgets-bannerwidget container"
                    id={configRef.current.anchor || undefined}
                    style={{ position: 'relative' }}
                >
                    {backgroundImageUrl && (
                        <div
                            className="banner-background background"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                backgroundImage: `url('${backgroundImageUrl}')`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat',
                                zIndex: 0,
                                opacity: 0.8
                            }}
                        />
                    )}
                    <div className={bodyClasses} style={{ position: 'relative', zIndex: 1 }}>
                        {imageCount === 4 ? (
                            // 4 images layout - no text
                            <div className="banner-images image layout-4">
                                {image1Url && <img className="banner-image" src={image1Url} alt="" />}
                                {image2Url && <img className="banner-image" src={image2Url} alt="" />}
                                {image3Url && <img className="banner-image" src={image3Url} alt="" />}
                                {image4Url && <img className="banner-image" src={image4Url} alt="" />}
                            </div>
                        ) : (
                            // 1 or 2 images layout - with text
                            <>
                                <div className="banner-text content" ref={contentContainerRef} />

                                <div className={`banner-images image layout-${imageCount}`}>
                                    {image1Url && <img className="banner-image" src={image1Url} alt="" />}
                                    {image2Url && imageCount >= 2 && <img className="banner-image" src={image2Url} alt="" />}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )
        }

        return (
            <div
                className="banner-widget widget-type-easy-widgets-bannerwidget container"
                id={configRef.current.anchor || undefined}
                style={{ position: 'relative' }}
            >
                {backgroundImageUrl && (
                    <div
                        className="banner-background background"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundImage: `url('${backgroundImageUrl}')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            zIndex: 0,
                            opacity: 0.8
                        }}
                    />
                )}
                <div className={bodyClasses} style={{ position: 'relative', zIndex: 1 }}>
                    {imageCount === 4 ? (
                        // 4 images layout - no text
                        <div className="banner-images image layout-4">
                            {image1Url && <img className="banner-image" src={image1Url} alt="" />}
                            {image2Url && <img className="banner-image" src={image2Url} alt="" />}
                            {image3Url && <img className="banner-image" src={image3Url} alt="" />}
                            {image4Url && <img className="banner-image" src={image4Url} alt="" />}
                        </div>
                    ) : (
                        // 1 or 2 images layout - with text
                        <>
                            <div className="banner-text content">
                                <div dangerouslySetInnerHTML={{ __html: configRef.current.content || '' }} />
                            </div>

                            <div className={`banner-images image layout-${imageCount}`}>
                                {image1Url && <img className="banner-image" src={image1Url} alt="" />}
                                {image2Url && imageCount >= 2 && <img className="banner-image" src={image2Url} alt="" />}
                            </div>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // Default rendering (no custom style)
    const hasContent = configRef.current.content || image1 || image2 || image3 || image4 || backgroundImage

    if (mode === 'editor') {
        return (
            <div className="banner-widget-editor">
                {renderDefaultBanner()}
            </div>
        )
    }

    // Preview mode
    if (!hasContent) {
        return (
            <div className="banner-widget">
                <div className="bg-gray-200 h-48 flex items-center justify-center text-gray-500">
                    <FileText className="h-8 w-8 mr-2" />
                    No media
                </div>
            </div>
        )
    }

    return renderDefaultBanner()
}

// === COLOCATED METADATA ===
BannerWidget.displayName = 'BannerWidget'
BannerWidget.widgetType = 'easy_widgets.BannerWidget'

// Default configuration
BannerWidget.defaultConfig = {
    anchor: '',
    bannerMode: 'text',
    content: '',
    backgroundImage: null,
    textPosition: 'left',
    imageCount: 1,
    image1: null,
    image2: null,
    image3: null,
    image4: null,
    componentStyle: 'default'
}

// Display metadata
BannerWidget.metadata = {
    name: 'Banner',
    description: 'Flexible banner with text content and configurable image layouts',
    category: 'content',
    icon: FileText,
    tags: ['eceee', 'banner', 'content', 'images', 'layout']
}

export default BannerWidget

