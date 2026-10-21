/**
 * EASY Bio Widget
 * 
 * EASY-specific implementation of the Bio widget.
 * Widget type: easy_widgets.BioWidget
 */

import React, { useRef, useEffect, useCallback, memo, useState } from 'react'
import { User, ImagePlus } from 'lucide-react'
import ContentWidgetEditorRenderer from './ContentWidgetEditorRenderer.js'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'
import OptimizedImage from '../../components/media/OptimizedImage'
import MediaSelectModal from '../../components/media/MediaSelectModal'
import { SimpleTextEditorRenderer } from './SimpleTextEditorRenderer'
import WidgetEditorControls, { WidgetEditorButton, ImageSizeButton } from './WidgetEditorControls'

/**
 * Vanilla JS Editor Wrapper Component for Bio Text
 * Wraps the vanilla JS ContentWidgetEditorRenderer for React integration
 */
const BioTextEditor = memo(({ content, contentUpdateSource = 'external', onChange, className, namespace, slotDimensions, pageId, siteRootId }) => {
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
                siteRootId,  // Pass siteRootId for link picker navigation
                detachedToolbar: true,
                allowedFormats: ['<p>', '<h3>', '<h4>']
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

    // Separate effect for other config updates
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
        }
    }, [onChange, className, namespace, slotDimensions, pageId, siteRootId])

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

    return <div ref={containerRef} className="bio-widget__text" />
})

const BioCaptionEditor = ({ content, onChange }) => {
    const container = useRef(null)
    const renderer = useRef(null)
    useEffect(() => {
        renderer.current = new SimpleTextEditorRenderer(container.current, {
            content, onChange, mode: 'inline-plain', element: 'p', placeholder: 'Add a caption...',
        })
        renderer.current.render()
        return () => { renderer.current.destroy(); renderer.current = null }
    }, [])
    useEffect(() => { renderer.current?.updateConfig({ content, onChange }) }, [content, onChange])
    return <div ref={container} className="bio-widget__caption" />
}

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
    const { useExternalChanges, getState } = useUnifiedData()
    const configRef = useRef(config)
    const bioTextUpdateSourceRef = useRef('external')
    const latestLocalBioTextRef = useRef(config?.bioText)
    const pendingLocalBioTextEchoesRef = useRef(new Set())
    const [, forceRerender] = useState({})
    const setConfig = (newConfig) => {
        configRef.current = newConfig
    }
    const componentId = `widget-${widgetId}`
    const contextType = useEditorContext()
    const ownerComponentId = context?.pageId && context?.versionId
        ? `page-editor-${context.pageId}-${context.versionId}`
        : null

    // State for image edit modal
    const [showImageModal, setShowImageModal] = useState(false)

    const syncIncomingConfig = useCallback((nextConfig) => {
        const nextBioText = nextConfig?.bioText
        const isPendingLocalEcho = pendingLocalBioTextEchoesRef.current.has(nextBioText)

        if (!hasWidgetContentChanged(configRef.current, nextConfig)) {
            if (isPendingLocalEcho) {
                pendingLocalBioTextEchoesRef.current.delete(nextBioText)
            }
            return
        }

        if (isPendingLocalEcho && nextBioText !== latestLocalBioTextRef.current) {
            pendingLocalBioTextEchoesRef.current.delete(nextBioText)
            return
        }

        if (isPendingLocalEcho) {
            pendingLocalBioTextEchoesRef.current.delete(nextBioText)
            bioTextUpdateSourceRef.current = 'local'
        } else {
            pendingLocalBioTextEchoesRef.current.clear()
            bioTextUpdateSourceRef.current = 'external'
        }

        setConfig(nextConfig)
        forceRerender({})
    }, [])

    useEffect(() => {
        syncIncomingConfig(config)
    }, [config, syncIncomingConfig])

    useEffect(() => {
        if (!widgetId || !slotName) {
            return
        }
        const currentState = getState()
        const widget = lookupWidget(currentState, widgetId, slotName, contextType, widgetPath)
        const udcConfig = widget?.config
        if (udcConfig) {
            syncIncomingConfig(udcConfig)
        }
    }, [])

    // Subscribe to external changes
    useExternalChanges(componentId, (state, metadata) => {
        if (ownerComponentId && metadata?.sourceId === ownerComponentId) {
            return
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newConfig = widget?.config
        if (newConfig) {
            syncIncomingConfig(newConfig)
        }
    })

    // Bio text change handler
    const handleBioTextChange = useCallback(async (newContent) => {
        if (newContent !== configRef.current.bioText) {
            const updatedConfig = {
                ...configRef.current,
                bioText: newContent
            }
            latestLocalBioTextRef.current = newContent
            pendingLocalBioTextEchoesRef.current.add(newContent)
            bioTextUpdateSourceRef.current = 'local'
            setConfig(updatedConfig)
            onConfigChange?.(updatedConfig)
        }
    }, [onConfigChange])

    // Image change handler for quick edit
    const handleImageChange = useCallback((fieldName, newImage) => {
        const updatedConfig = { ...configRef.current, [fieldName]: newImage }
        setConfig(updatedConfig)
        forceRerender({})
        onConfigChange?.(updatedConfig)
    }, [onConfigChange])

    const imageSize = configRef.current.imageSize || 'original'
    const imageStyle = imageSize === 'original' ? undefined : { aspectRatio: imageSize === 'rectangle' ? '2 / 1' : '1' }
    const imageClass = imageSize === 'original' ? 'w-full h-auto' : 'w-full object-cover'
    const image = configRef.current.image
    const bioText = configRef.current.bioText || ''
    const textLayout = configRef.current.textLayout || 'column'
    const caption = configRef.current.caption || ''
    const anchor = configRef.current.anchor || ''

    if (mode === 'editor') {
        return (
            <WidgetEditorControls mode={mode} label="Bio" controls={<>
                <WidgetEditorButton title="Edit bio image" onClick={() => setShowImageModal(true)}><ImagePlus className="h-4 w-4" />Image</WidgetEditorButton>
                <ImageSizeButton value={imageSize} allowOriginal onChange={value => handleImageChange('imageSize', value)} />
            </>} picker={showImageModal && <MediaSelectModal isOpen onClose={() => setShowImageModal(false)}
                onSelect={selected => {
                    if (selected === null) handleImageChange('image', null)
                    else if (selected?.length) handleImageChange('image', selected[0])
                    setShowImageModal(false)
                }} mediaTypes={['image']} allowCollections={false} currentSelection={image}
                namespace={namespace || context?.namespace} pageId={context?.pageId} customTitle="Edit Bio Image" />}>
            <div
                className={`bio-widget bio-widget--${textLayout} bio-widget--image-${imageSize}`}
                {...(anchor && { id: anchor })}
            >
                <div className="bio-widget__container">
                    {image && (image.url || image.imgproxyBaseUrl || image.fileUrl) && (
                        <div className="bio-widget__image relative group/image">
                            <OptimizedImage
                                src={image.imgproxyBaseUrl || image.fileUrl || image.url}
                                alt={image.altText || image.alt || ''}
                                responsive={true}
                                slotDimensions={slotConfig?.dimensions}
                                widthMultiplier={textLayout === 'row' ? 0.5 : 1.0}
                                resizeType={imageSize === 'original' ? 'fit' : 'fill'}
                                loading="lazy"
                                className={imageClass}
                                style={imageStyle}
                            />
                            <BioCaptionEditor content={caption} onChange={value => handleImageChange('caption', value)} />
                        </div>
                    )}
                    <BioTextEditor
                        content={bioText}
                        contentUpdateSource={bioTextUpdateSourceRef.current}
                        onChange={handleBioTextChange}
                        className=""
                        namespace={namespace}
                        slotDimensions={slotConfig?.dimensions}
                        pageId={context?.pageId}
                        siteRootId={context?.siteRootId}
                    />
                </div>

            </div>
            </WidgetEditorControls>
        )
    }

    return (
        <div
            className={`bio-widget bio-widget--${textLayout} bio-widget--image-${imageSize}`}
            {...(anchor && { id: anchor })}
        >
            <div className="bio-widget__container">
                {image && (image.url || image.imgproxyBaseUrl || image.fileUrl) && (
                    <div className="bio-widget__image">
                        <OptimizedImage
                            src={image.imgproxyBaseUrl || image.fileUrl || image.url}
                            alt={image.altText || image.alt || ''}
                            responsive={true}
                            slotDimensions={slotConfig?.dimensions}
                            widthMultiplier={textLayout === 'row' ? 0.5 : 1.0}
                            resizeType={imageSize === 'original' ? 'fit' : 'fill'}
                            loading="lazy"
                            className={imageClass}
                                style={imageStyle}
                        />
                        {caption && (
                            <div className="bio-widget__caption">{caption}</div>
                        )}
                    </div>
                )}
                <div className="bio-widget__text">
                    {bioText && <div dangerouslySetInnerHTML={{ __html: bioText }} />}
                </div>
            </div>
        </div>
    )
}, (prevProps, nextProps) => {
    return (
        prevProps.config?.bioText === nextProps.config?.bioText &&
        prevProps.config?.image === nextProps.config?.image &&
        prevProps.config?.textLayout === nextProps.config?.textLayout &&
        prevProps.config?.imageSize === nextProps.config?.imageSize &&
        prevProps.config?.caption === nextProps.config?.caption &&
        prevProps.config?.anchor === nextProps.config?.anchor &&
        prevProps.mode === nextProps.mode &&
        prevProps.themeId === nextProps.themeId &&
        prevProps.widgetId === nextProps.widgetId &&
        prevProps.slotName === nextProps.slotName &&
        prevProps.widgetType === nextProps.widgetType &&
        prevProps.onConfigChange === nextProps.onConfigChange &&
        prevProps.context?.pageId === nextProps.context?.pageId &&
        prevProps.context?.versionId === nextProps.context?.versionId
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
    imageSize: 'original',
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
