import React, { useState, useEffect, useMemo } from 'react'
import { FileText } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'
import { renderMustache, prepareComponentContext } from '../../utils/mustacheRenderer'
import ComponentStyleRenderer from '../../components/ComponentStyleRenderer'

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
    const { useExternalChanges, getState } = useUnifiedData()
    const componentId = useMemo(() => `contentcardwidget-${widgetId || 'preview'}`, [widgetId])
    const contextType = useEditorContext()

    const [localConfig, setLocalConfig] = useState(config)

    // UDC External Changes Subscription
    useExternalChanges(componentId, (state) => {
        if (!widgetId || !slotName) return
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        if (widget && widget.config && hasWidgetContentChanged(localConfig, widget.config)) {
            setLocalConfig(widget.config)
        }
    })

    // Get image URLs
    const imageCount = localConfig.imageCount || 1
    const image1 = localConfig.image1
    const image2 = localConfig.image2
    const image3 = localConfig.image3
    const image4 = localConfig.image4

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

                    // Add content card specific context
                    mustacheContext.header = localConfig.header || ''
                    mustacheContext.textPosition = textPosition
                    mustacheContext.imageCount = imageCount
                    mustacheContext.image1 = image1
                    mustacheContext.image2 = image2
                    mustacheContext.image3 = image3
                    mustacheContext.image4 = image4

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
                            {image1 && <img src={image1} alt="" />}
                            {image2 && <img src={image2} alt="" />}
                            {image3 && <img src={image3} alt="" />}
                            {image4 && <img src={image4} alt="" />}
                        </div>
                    ) : (
                        // 1 or 2 images layout - with text
                        <>
                            <div className="content-card-text">
                                <div dangerouslySetInnerHTML={{ __html: localConfig.content || '' }} />
                            </div>

                            <div className={`content-card-images layout-${imageCount}`}>
                                {image1 && <img src={image1} alt="" />}
                                {image2 && imageCount >= 2 && <img src={image2} alt="" />}
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

