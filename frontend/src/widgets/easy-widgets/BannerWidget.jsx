import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { FileText, Type, AlignLeft, ImagePlus, Layers, Square, RectangleHorizontal, Baseline, PaintBucket } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'
import { renderMustache, prepareComponentContext } from '../../utils/mustacheRenderer'
import ComponentStyleRenderer from '../../components/ComponentStyleRenderer'
import { getImgproxyUrlFromImage } from '../../utils/imgproxySecure'
import { SimpleTextEditorRenderer } from './SimpleTextEditorRenderer'
import OptimizedImage from '../../components/media/OptimizedImage'
import MediaSelectModal from '../../components/media/MediaSelectModal'
import { getBannerRenderConfig, getBannerPresentationStyle } from '../../utils/bannerConfig'
import ColorSelector from '../../components/theme/form-fields/ColorSelector'
import Tooltip from '../../components/Tooltip'

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
    context = {},
    widgetPath = [],
    namespace = null
}) => {
    const pageId = context?.pageId

    // Get current theme for component styles
    const { currentTheme } = useTheme({ pageId, enabled: !!pageId })

    // Use configRef for stable reference (prevents callback recreation issues)
    const configRef = useRef(config)
    const [, forceRerender] = useState({})
    const setConfig = (newConfig) => {
        configRef.current = newConfig
    }

    // UDC Integration
    const { useExternalChanges, getState } = useUnifiedData()
    const componentId = useMemo(() => `bannerwidget-${widgetId || 'preview'}`, [widgetId])
    const headerFieldComponentId = useMemo(() => `field-${widgetId || 'preview'}-headerContent`, [widgetId])
    const textFieldComponentId = useMemo(() => `field-${widgetId || 'preview'}-textContent`, [widgetId])
    const contextType = useEditorContext()

    // State for optimized image URLs (1x and 2x for retina)
    const [image1Url, setImage1Url] = useState('')
    const [backgroundImageUrl, setBackgroundImageUrl] = useState('')
    const [backgroundImageUrl2x, setBackgroundImageUrl2x] = useState('')
    const [imageLoading, setImageLoading] = useState(false)

    // State for image edit modal
    const [showImageModal, setShowImageModal] = useState(false)
    const [editingField, setEditingField] = useState(null)

    // Refs for editor renderers
    const contentEditorRef = useRef(null)
    const contentContainerRef = useRef(null)
    const presentationToolbarRef = useRef(null)
    const presentationPaletteOpenRef = useRef(false)
    const presentationSelectionRef = useRef(null)

    const handlePaletteOpenChange = open => {
        presentationPaletteOpenRef.current = open
        if (!open) return
        const selection = window.getSelection()
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null
        presentationSelectionRef.current = range && contentEditorRef.current?.editorElement?.contains(range.commonAncestorContainer)
            ? range.cloneRange() : null
    }
    const handlePaletteClose = (reason, target) => {
        const range = presentationSelectionRef.current
        presentationSelectionRef.current = null
        const editor = contentEditorRef.current
        const resumesEditing = reason !== 'outside' || presentationToolbarRef.current?.contains(target)
        if (resumesEditing && range && editor?.editorElement?.contains(range.commonAncestorContainer)) {
            editor.editorElement.focus()
            const selection = window.getSelection()
            selection.removeAllRanges()
            selection.addRange(range)
            return true
        }
        editor?.deactivate()
        return false
    }

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
    const renderConfig = getBannerRenderConfig(configRef.current)
    const imageSize = renderConfig.imageSize || 'square'
    const bannerMode = configRef.current.bannerMode || 'text'
    const image1 = renderConfig.image1
    const backgroundImage = renderConfig.backgroundImage
    const componentStyle = configRef.current.componentStyle || 'default'
    const useCustomStyle = componentStyle !== 'default' && currentTheme?.componentStyles
    const usesCustomMarkup = Boolean(useCustomStyle?.[componentStyle])
        && useCustomStyle[componentStyle].template?.trim() !== '{{passthru}}'
    const textColor = configRef.current.textColor || configRef.current.text_color || '#000000'
    const backgroundColor = configRef.current.backgroundColor || configRef.current.background_color || '#ffffff'

    // Build inline styles for colors and background image
    const bannerStyle = {
        ...getBannerPresentationStyle(configRef.current),
        ...(backgroundImage && backgroundImageUrl && backgroundImageUrl2x ? {
            backgroundImage: `image-set(url('${backgroundImageUrl}') 1x, url('${backgroundImageUrl2x}') 2x)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        } : backgroundImage && backgroundImageUrl ? {
            backgroundImage: `url('${backgroundImageUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        } : {})
    }

    // Load optimized image URLs from backend API
    useEffect(() => {
        let active = true
        const loadImages = async () => {
            setImageLoading(true)
            setBackgroundImageUrl('')
            setBackgroundImageUrl2x('')
            setImage1Url('')

            try {
                // Load background image (1x and 2x)
                if (backgroundImage) {
                    const url1x = await getImgproxyUrlFromImage(backgroundImage, {
                        width: 1920,
                        height: 600,
                        resizeType: 'fill'
                    })
                    const url2x = await getImgproxyUrlFromImage(backgroundImage, {
                        width: 3840,
                        height: 1200,
                        resizeType: 'fill'
                    })
                    if (active) {
                        setBackgroundImageUrl(url1x)
                        setBackgroundImageUrl2x(url2x)
                    }
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
                    if (active) setImage1Url(url)
                }
            } catch (error) {
                console.error('Failed to load optimized banner images:', error)
            } finally {
                if (active) setImageLoading(false)
            }
        }

        loadImages()
        return () => { active = false }
    }, [image1, imageSize, backgroundImage, bannerMode])

    // Determine text position - removed, no longer used

    // Content change handler - use configRef for stable reference
    // Saves to different field based on current mode
    const handleContentChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const fieldName = bannerMode === 'header' ? 'headerContent' : 'textContent'
            const updatedConfig = { ...configRef.current, [fieldName]: newContent }
            setConfig(updatedConfig)

            if (onConfigChange) {
                onConfigChange(updatedConfig)
            }
        }
    }, [bannerMode, widgetId, slotName, onConfigChange])

    // Mode conversion handler
    const handleModeToggle = useCallback(() => {
        if (!widgetId || !slotName) return

        const newMode = bannerMode === 'header' ? 'text' : 'header'
        const updatedConfig = { ...configRef.current, bannerMode: newMode }
        setConfig(updatedConfig)
        forceRerender({})
        setShowImageModal(false)
        setEditingField(null)

        if (onConfigChange) {
            onConfigChange(updatedConfig)
        }
    }, [bannerMode, widgetId, slotName, onConfigChange])

    const handleImageSizeToggle = useCallback(() => {
        const updatedConfig = { ...configRef.current, imageSize: imageSize === 'square' ? 'rectangle' : 'square' }
        setConfig(updatedConfig)
        forceRerender({})
        onConfigChange?.(updatedConfig)
    }, [imageSize, onConfigChange])

    // Image change handler for quick edit
    const handleImageChange = useCallback((fieldName, newImage) => {
        const updatedConfig = { ...configRef.current, [fieldName]: newImage }
        setConfig(updatedConfig)
        forceRerender({})
        if (onConfigChange) {
            onConfigChange(updatedConfig)
        }
    }, [onConfigChange])

    const handlePresentationChange = useCallback((fieldName, value) => {
        const updatedConfig = { ...configRef.current, [fieldName]: value }
        setConfig(updatedConfig)
        forceRerender({})
        onConfigChange?.(updatedConfig)
    }, [onConfigChange])

    // Initialize editor in editor mode
    useEffect(() => {
        if (mode === 'editor' && !usesCustomMarkup) {
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
                    maxBreaks: bannerMode === 'header' ? 1 : undefined,
                    pageId: pageId,
                    siteRootId: context?.siteRootId,
                    isToolbarActive: () => presentationPaletteOpenRef.current || Boolean(presentationToolbarRef.current?.contains(document.activeElement))
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
    }, [mode, bannerMode, componentStyle, usesCustomMarkup])

    // Separate effect for onChange, className, namespace, slotDimensions, and pageId updates
    useEffect(() => {
        if (mode === 'editor' && contentEditorRef.current) {
            contentEditorRef.current.updateConfig({
                onChange: handleContentChange,
                pageId: pageId,
                siteRootId: context?.siteRootId,
                namespace: namespace || context?.namespace
            })
        }
    }, [handleContentChange, pageId, context?.siteRootId, namespace, context?.namespace, mode])

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
                        style.variables || {}
                    )
                    mustacheContext.anchor = renderConfig.anchor || ''
                    mustacheContext.config = renderConfig

                    // Add banner specific context
                    mustacheContext.bannerMode = bannerMode
                    mustacheContext.headerContent = configRef.current.headerContent || ''
                    mustacheContext.textContent = configRef.current.textContent || ''
                    mustacheContext.imageSize = imageSize
                    mustacheContext.image1 = image1 ? image1Url : ''
                    mustacheContext.backgroundImage = backgroundImage
                    mustacheContext.backgroundImageUrl = backgroundImage ? backgroundImageUrl : ''

                    // Render template
                    const html = renderMustache(style.template, mustacheContext)

                    // Use ComponentStyleRenderer for consistent scoped rendering
                    const styleId = `banner-${widgetId || 'preview'}-${componentStyle}`

                    return renderWithEditorControls(
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

                return renderWithEditorControls(
                    <div data-style-id={styleId}>
                        {style.css && <style>{`[data-style-id="${styleId}"] { ${style.css} }`}</style>}
                        {renderDefaultBanner()}
                    </div>
                )
            } catch (error) {
                console.error('Error rendering custom component style:', error)
                return renderWithEditorControls(
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
        const showBorder = configRef.current.showBorder ?? configRef.current.show_border ?? false

        if (mode === 'editor') {
            return (
                <div
                    className={`banner-widget cms-content relative group${showBorder ? ' border-enabled' : ''}`}
                    id={configRef.current.anchor || undefined}
                    style={{ position: 'relative', ...bannerStyle }}
                >
                    <div className={bodyClasses} style={{ position: 'relative', zIndex: 1 }}>
                        <div className="banner-text content" style={{ position: 'relative', zIndex: 1 }}>
                            <div ref={contentContainerRef} style={{ display: 'contents' }} />
                        </div>

                        {bannerMode === 'text' && image1 && (
                            <div className="banner-images image relative group/image">
                                <OptimizedImage
                                    src={image1.imgproxyBaseUrl || image1.fileUrl || image1.url}
                                    alt={image1.alt || image1.altText || ''}
                                    width={imageSize === 'rectangle' ? 280 : 140}
                                    height={140}
                                    resizeType="fill"
                                    loading="lazy"
                                    className="banner-image"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )
        }

        return (
            <div
                className={`banner-widget cms-content${showBorder ? ' border-enabled' : ''}`}
                id={configRef.current.anchor || undefined}
                style={{ position: 'relative', height: '140px', ...bannerStyle }}
            >
                <div className={bodyClasses} style={{ position: 'relative' }}>
                    <div className="banner-text content">
                        <div dangerouslySetInnerHTML={{
                            __html: bannerMode === 'header'
                                ? (configRef.current.headerContent || '')
                                : (configRef.current.textContent || '')
                        }} />
                    </div>

                    {bannerMode === 'text' && image1 && image1Url && (
                        <div className="banner-images image">
                            <img className="banner-image" src={image1Url} alt="" />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    function renderWithEditorControls(content) {
        if (mode !== 'editor') return content
        const isHeader = bannerMode === 'header'
        const isRectangle = imageSize === 'rectangle'
        const buttonClassName = 'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
        return <div className="banner-widget-editor group/banner relative isolate min-h-10">
            <div ref={presentationToolbarRef} role="toolbar" aria-label="Banner controls"
                className="eceee-editor-ui absolute right-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-end gap-1 opacity-0 pointer-events-none group-hover/banner:opacity-100 group-hover/banner:pointer-events-auto group-focus-within/banner:opacity-100 group-focus-within/banner:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto"
                onClick={event => event.stopPropagation()}
                onBlurCapture={() => contentEditorRef.current?.deactivate()}>
                <Tooltip text={`Switch to ${isHeader ? 'Text' : 'Header'} mode`}>
                <button type="button" onClick={handleModeToggle} className={buttonClassName}
                    aria-label={`Switch to ${isHeader ? 'Text' : 'Header'} mode`}
                    title={`Switch to ${isHeader ? 'Text' : 'Header'} mode`}>
                    {isHeader ? <Type className="h-4 w-4" /> : <AlignLeft className="h-4 w-4" />}
                </button>
                </Tooltip>
                <Tooltip text={isHeader ? 'Edit background image' : 'Edit image'}>
                <button type="button" className={buttonClassName}
                    aria-label={isHeader ? 'Background image' : 'Image'}
                    title={isHeader ? 'Edit background image' : 'Edit image'}
                    onClick={() => {
                        setEditingField(isHeader ? 'backgroundImage' : 'image1')
                        setShowImageModal(true)
                    }}>
                    {isHeader ? <Layers className="h-4 w-4" /> : <ImagePlus className="h-4 w-4" />}
                </button>
                </Tooltip>
                {!isHeader && <Tooltip text={`Change image shape to ${isRectangle ? 'Square' : 'Rectangle'}`}>
                <button type="button" className={buttonClassName} onClick={handleImageSizeToggle}
                    aria-label={`Image size: ${isRectangle ? 'Rectangle' : 'Square'}`}
                    title={`Change image shape to ${isRectangle ? 'Square' : 'Rectangle'}`}>
                    {isRectangle ? <RectangleHorizontal className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                </button>
                </Tooltip>}
                <ColorSelector value={textColor} colors={currentTheme?.colors || {}}
                    onChange={value => handlePresentationChange('textColor', value)}
                    onOpenChange={handlePaletteOpenChange} onClose={handlePaletteClose}
                    icon={<Baseline className="h-4 w-4" />} title="Text color" compact />
                <ColorSelector value={backgroundColor} colors={currentTheme?.colors || {}}
                    onChange={value => handlePresentationChange('backgroundColor', value)}
                    onOpenChange={handlePaletteOpenChange} onClose={handlePaletteClose}
                    icon={<PaintBucket className="h-4 w-4" />} title="Background color" compact />
            </div>
            <div className="relative z-0">{content}</div>
            {showImageModal && editingField === (isHeader ? 'backgroundImage' : 'image1') && <MediaSelectModal
                isOpen={showImageModal}
                onClose={() => { setShowImageModal(false); setEditingField(null) }}
                onSelect={selectedItems => {
                    if (selectedItems === null) handleImageChange(editingField, null)
                    else if (selectedItems?.length > 0) handleImageChange(editingField, selectedItems[0])
                    setShowImageModal(false)
                    setEditingField(null)
                }}
                mediaTypes={['image']}
                allowCollections={false}
                currentSelection={isHeader ? backgroundImage : image1}
                namespace={namespace || context?.namespace}
                pageId={pageId}
                customTitle={isHeader ? 'Edit Banner Background Image' : 'Edit Banner Image'}
            />}
        </div>
    }

    // Default rendering (no custom style)
    const hasContent = configRef.current.headerContent || configRef.current.textContent || image1 || backgroundImage

    if (mode === 'editor') {
        return renderWithEditorControls(renderDefaultBanner())
    }

    // Preview mode
    if (!hasContent) {
        return null
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
    textColor: '#000000',
    backgroundColor: '#ffffff',
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
