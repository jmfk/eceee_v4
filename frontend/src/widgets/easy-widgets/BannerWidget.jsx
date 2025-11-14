import React, { useState, useEffect, useMemo } from 'react'
import { FileText } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'
import { renderMustache, prepareComponentContext } from '../../utils/mustacheRenderer'
import ComponentStyleRenderer from '../../components/ComponentStyleRenderer'
import { getImgproxyUrlFromImage } from '../../utils/imgproxySecure'

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

    // UDC Integration
    const { useExternalChanges, getState } = useUnifiedData()
    const componentId = useMemo(() => `bannerwidget-${widgetId || 'preview'}`, [widgetId])
    const contextType = useEditorContext()

    const [localConfig, setLocalConfig] = useState(config)

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
                console.error('Failed to load optimized banner images:', error)
            } finally {
                setImageLoading(false)
            }
        }

        loadImages()
    }, [image1, image2, image3, image4, imageCount])

    // Determine text position
    const textPosition = localConfig.textPosition || 'left'

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

        return (
            <div
                className="banner-widget"
                id={localConfig.anchor || undefined}
            >
                <div className={bodyClasses}>
                    {imageCount === 4 ? (
                        // 4 images layout - no text
                        <div className="banner-images layout-4">
                            {image1Url && <img src={image1Url} alt="" />}
                            {image2Url && <img src={image2Url} alt="" />}
                            {image3Url && <img src={image3Url} alt="" />}
                            {image4Url && <img src={image4Url} alt="" />}
                        </div>
                    ) : (
                        // 1 or 2 images layout - with text
                        <>
                            <div className="banner-text">
                                <div dangerouslySetInnerHTML={{ __html: localConfig.content || '' }} />
                            </div>

                            <div className={`banner-images layout-${imageCount}`}>
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
            <div className="banner-widget-editor">
                {!hasImages && (
                    <div className="bg-gray-200 h-48 flex items-center justify-center text-gray-500 mb-4">
                        <FileText className="h-8 w-8 mr-2" />
                        Banner placeholder - Add images to get started
                    </div>
                )}
                {renderDefaultBanner()}
            </div>
        )
    }

    // Preview mode
    if (!hasImages) {
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
BannerWidget.metadata = {
    name: 'Banner',
    description: 'Flexible banner with text content and configurable image layouts',
    category: 'content',
    icon: FileText,
    tags: ['eceee', 'banner', 'content', 'images', 'layout']
}

export default BannerWidget

