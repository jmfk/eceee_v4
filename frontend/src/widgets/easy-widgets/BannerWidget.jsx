import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { FileText, Type, AlignLeft } from 'lucide-react'
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
    const headerFieldComponentId = useMemo(() => `field-${widgetId || 'preview'}-headerContent`, [widgetId])
    const textFieldComponentId = useMemo(() => `field-${widgetId || 'preview'}-textContent`, [widgetId])
    const contextType = useEditorContext()

    // State for optimized image URLs
    const [image1Url, setImage1Url] = useState('')
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

    // Subscribe to field-level updates for headerContent field (from form field)
    useExternalChanges(headerFieldComponentId, (state, metadata) => {
        if (!widgetId || !slotName) {
            return
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newHeaderContent = widget?.config?.headerContent

        // Check if update came from this widget's WYSIWYG (self-update)
        const sourceId = metadata?.sourceId || ''
        const isSelfUpdate = sourceId === componentId || sourceId === headerFieldComponentId

        if (newHeaderContent !== undefined && newHeaderContent !== configRef.current.headerContent && !isSelfUpdate) {
            // External update - update WYSIWYG editor if in header mode
            if (contentEditorRef.current && bannerMode === 'header') {
                contentEditorRef.current.updateConfig({ content: newHeaderContent })
            }
            // Update our config ref
            setConfig({ ...configRef.current, headerContent: newHeaderContent })
        }
    })

    // Subscribe to field-level updates for textContent field (from form field)
    useExternalChanges(textFieldComponentId, (state, metadata) => {
        if (!widgetId || !slotName) {
            return
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newTextContent = widget?.config?.textContent

        // Check if update came from this widget's WYSIWYG (self-update)
        const sourceId = metadata?.sourceId || ''
        const isSelfUpdate = sourceId === componentId || sourceId === textFieldComponentId

        if (newTextContent !== undefined && newTextContent !== configRef.current.textContent && !isSelfUpdate) {
            // External update - update WYSIWYG editor if in text mode
            if (contentEditorRef.current && bannerMode === 'text') {
                contentEditorRef.current.updateConfig({ content: newTextContent })
            }
            // Update our config ref
            setConfig({ ...configRef.current, textContent: newTextContent })
        }
    })

    // Get image objects from config
    const imageSize = configRef.current.imageSize || 'square'
    const bannerMode = configRef.current.bannerMode || 'text'
    const image1 = configRef.current.image1
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

                // Load image URL based on imageSize (only for text mode)
                if (bannerMode === 'text' && image1) {
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
                console.error('Failed to load optimized banner images:', error)
            } finally {
                setImageLoading(false)
            }
        }

        loadImages()
    }, [image1, imageSize, backgroundImage, bannerMode])

    // Determine text position - removed, no longer used

    // Content change handler - use configRef for stable reference
    // Saves to different field based on current mode
    const handleContentChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const fieldName = bannerMode === 'header' ? 'headerContent' : 'textContent'
            const updatedConfig = { ...configRef.current, [fieldName]: newContent }
            setConfig(updatedConfig)

            // Publish to field-level path for form field sync
            const fieldComponentId = bannerMode === 'header' ? headerFieldComponentId : textFieldComponentId
            const fieldSourceId = `${componentId}-field-${fieldName}`
            publishUpdate(fieldSourceId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: { [fieldName]: newContent }, // Only publish the changed field
                widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
                slotName: slotName,
                contextType: contextType
            })

            if (onConfigChange) {
                onConfigChange(updatedConfig)
            }
        }
    }, [bannerMode, componentId, headerFieldComponentId, textFieldComponentId, widgetId, slotName, publishUpdate, contextType, widgetPath, onConfigChange])

    // Mode conversion handler
    const handleModeToggle = useCallback(() => {
        if (!widgetId || !slotName) return

        const newMode = bannerMode === 'header' ? 'text' : 'header'
        const updatedConfig = { ...configRef.current, bannerMode: newMode }
        setConfig(updatedConfig)

        // Publish mode change to UDC
        publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetId,
            config: { bannerMode: newMode },
            widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
            slotName: slotName,
            contextType: contextType
        })

        if (onConfigChange) {
            onConfigChange(updatedConfig)
        }
    }, [bannerMode, widgetId, slotName, componentId, publishUpdate, contextType, widgetPath, onConfigChange])

    // Initialize editor in editor mode
    useEffect(() => {
        if (mode === 'editor') {
            if (contentContainerRef.current && !contentEditorRef.current) {
                // Text mode: inline-rich with toolbar (bold, italic, link)
                // Header mode: inline-plain with no toolbar, max 1 line break
                const editorMode = bannerMode === 'header' ? 'inline-plain' : 'inline-rich'
                const element = bannerMode === 'header' ? 'h2' : 'div'
                const allowedButtons = bannerMode === 'header'
                    ? undefined
                    : ['format', 'bold', 'italic', 'link']
                const allowedFormatsForMode = bannerMode === 'text' ? ['<p>', '<h3>'] : undefined
                const content = bannerMode === 'header'
                    ? (configRef.current.headerContent || '')
                    : (configRef.current.textContent || '')

                contentEditorRef.current = new SimpleTextEditorRenderer(contentContainerRef.current, {
                    content: content,
                    mode: editorMode,
                    onChange: handleContentChange,
                    placeholder: bannerMode === 'header' ? 'Enter banner header...' : 'Enter banner content...',
                    element: element,
                    allowedButtons: allowedButtons,
                    allowedFormats: allowedFormatsForMode,
                    maxBreaks: bannerMode === 'header' ? 1 : undefined
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
    }, [mode, bannerMode])

    // Update onChange callback when handler changes
    useEffect(() => {
        if (mode === 'editor') {
            if (contentEditorRef.current) {
                contentEditorRef.current.updateConfig({ onChange: handleContentChange })
            }
        }
    }, [handleContentChange, mode])

    // Handle bannerMode changes from widget form - reinitialize editor with new element
    useEffect(() => {
        if (mode === 'editor' && contentEditorRef.current) {
            const currentElement = contentEditorRef.current.options?.element || 'div'
            const newElement = bannerMode === 'header' ? 'h2' : 'div'

            // If element type changed, destroy and let initialization effect recreate
            if (currentElement !== newElement) {
                contentEditorRef.current.destroy()
                contentEditorRef.current = null
                // Editor will be recreated by the initialization effect
            }
        }
    }, [bannerMode, mode])

    // Update editor content when config changes externally (from UDC/widget form)
    useEffect(() => {
        if (mode === 'editor') {
            if (contentEditorRef.current) {
                const element = bannerMode === 'header' ? 'h2' : 'div'
                const content = bannerMode === 'header'
                    ? (configRef.current.headerContent || '')
                    : (configRef.current.textContent || '')

                // Only update if element matches current editor element
                const currentElement = contentEditorRef.current.options?.element || 'div'
                if (currentElement === element) {
                    contentEditorRef.current.updateConfig({
                        content: content
                    })
                }
            }
        }
    }, [configRef.current.headerContent, configRef.current.textContent, bannerMode, mode])

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
                    // Select content based on mode
                    const content = bannerMode === 'header'
                        ? (configRef.current.headerContent || '')
                        : (configRef.current.textContent || '')

                    // Prepare context for Mustache rendering
                    const mustacheContext = prepareComponentContext(
                        content,
                        configRef.current.anchor || '',
                        style.variables || {},
                        configRef.current
                    )

                    // Add banner specific context
                    mustacheContext.bannerMode = bannerMode
                    mustacheContext.headerContent = configRef.current.headerContent || ''
                    mustacheContext.textContent = configRef.current.textContent || ''
                    mustacheContext.imageSize = imageSize
                    mustacheContext.image1 = image1Url

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
            `mode-${bannerMode}`,
            `image-size-${imageSize}`
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
                        <div className="banner-text content" style={{ position: 'relative' }} ref={contentContainerRef}>
                            {/* Mode toggle button */}
                            <button
                                onClick={handleModeToggle}
                                className="absolute top-2 right-2 z-10 px-2 py-1 text-xs bg-white/90 hover:bg-white border border-gray-300 rounded shadow-sm flex items-center gap-1 transition-colors"
                                title={`Switch to ${bannerMode === 'header' ? 'Text' : 'Header'} mode`}
                                type="button"
                            >
                                {bannerMode === 'header' ? (
                                    <>
                                        <Type className="h-3 w-3" />
                                        <span>Header</span>
                                    </>
                                ) : (
                                    <>
                                        <AlignLeft className="h-3 w-3" />
                                        <span>Text</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {bannerMode === 'text' && image1Url && (
                            <div className="banner-images image">
                                <img className="banner-image" src={image1Url} alt="" />
                            </div>
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
                    <div className="banner-text content">
                        <div dangerouslySetInnerHTML={{
                            __html: bannerMode === 'header'
                                ? (configRef.current.headerContent || '')
                                : (configRef.current.textContent || '')
                        }} />
                    </div>

                    {bannerMode === 'text' && image1Url && (
                        <div className="banner-images image">
                            <img className="banner-image" src={image1Url} alt="" />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // Default rendering (no custom style)
    const hasContent = configRef.current.headerContent || configRef.current.textContent || image1 || backgroundImage

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
    headerContent: '',
    textContent: '',
    backgroundImage: null,
    imageSize: 'square',
    image1: null,
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

