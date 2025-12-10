import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Image } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'
import { renderMustache, prepareGalleryContext, prepareCarouselContext, prepareComponentContext } from '../../utils/mustacheRenderer'
import ComponentStyleRenderer from '../../components/ComponentStyleRenderer'
import { generateCSSFromBreakpoints } from '../../utils/cssBreakpointUtils'
import { getGridStyle, getObjectFitClass } from '../../utils/imageGridLayout'
import { mediaCollectionsApi } from '../../api/media'

/**
 * EASY Image Widget Component
 * Renders images, galleries, and videos with multiple display modes
 */
const ImageWidget = ({
    config = {},
    mode = 'preview',
    widgetId = null,
    slotName = null,
    onConfigChange = null,
    context,
    widgetPath = []
}) => {
    const pageId = context?.pageId;

    // Get current theme for image styles (includes inheritance)
    const { currentTheme } = useTheme({ pageId, enabled: !!pageId })

    // ODC Integration
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData()
    const componentId = useMemo(() => `imagewidget-${widgetId || 'preview'}`, [widgetId])
    const contextType = useEditorContext()

    const [localConfig, setLocalConfig] = useState(config)

    // Collection resolution state
    const [collectionMediaItems, setCollectionMediaItems] = useState([])
    const [loadingCollection, setLoadingCollection] = useState(false)

    // Carousel state - always initialized to avoid hook order issues
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isPlaying, setIsPlaying] = useState(localConfig.autoPlay || false)

    // ODC Config Synchronization - Initialize from ODC state if available
    // useEffect(() => {
    //     if (!widgetId || !slotName) return

    //     const currentState = getState()
    //     const widget = lookupWidget(currentState, widgetId, slotName, contextType)
    //     if (widget && widget.config) {
    //         setLocalConfig(widget.config)
    //     }
    // }, [])

    // ODC External Changes Subscription
    useExternalChanges(componentId, (state) => {
        if (!widgetId || !slotName) return
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        if (widget && widget.config && hasWidgetContentChanged(localConfig, widget.config)) {
            setLocalConfig(widget.config)
        }
    })

    // Resolve image style from theme
    const resolvedImageStyle = React.useMemo(() => {
        if (!(localConfig.imageStyle) || !currentTheme?.image_styles) {
            // Fallback to legacy values or defaults
            return {
                alignment: (localConfig.alignment || 'center'),
                galleryColumns: (localConfig.galleryColumns || 3),
                spacing: 'normal'
            }
        }

        const themeStyle = currentTheme.image_styles[localConfig.imageStyle]
        if (!themeStyle) {
            // Style not found in theme, use default
            return {
                alignment: 'center',
                galleryColumns: 3,
                spacing: 'normal'
            }
        }

        return {
            alignment: themeStyle.alignment || 'center',
            galleryColumns: themeStyle.galleryColumns || 3,
            spacing: themeStyle.spacing || 'normal',
            borderRadius: themeStyle.borderRadius || 'normal',
            shadow: themeStyle.shadow || 'sm'
        }
    }, [localConfig.imageStyle, currentTheme, localConfig.alignment, localConfig.galleryColumns])

    // Check if image field is a collection and resolve it
    const isCollection = useMemo(() => {
        const image = localConfig.image
        if (!image || typeof image !== 'object') return false
        // Check for explicit type marker
        if (image.type === 'collection') {
            return true
        }
        // Check for collection-specific properties (fileCount, sampleImages, slug)
        // A MediaFile would have url/fileUrl, but not fileCount or slug
        const hasCollectionProps = image.fileCount !== undefined || image.sampleImages !== undefined || image.slug !== undefined
        const hasFileProps = image.url || image.fileUrl || image.imgproxyBaseUrl
        // If it has collection properties but no file URL properties, and has an ID, it's a collection
        return hasCollectionProps && !hasFileProps && !!image.id
    }, [localConfig.image])

    // Resolve collection files when image is a collection
    useEffect(() => {
        const image = localConfig.image
        if (!isCollection || !image?.id) {
            setCollectionMediaItems([])
            return
        }

        const fetchCollectionFiles = async () => {
            setLoadingCollection(true)
            try {
                const result = await mediaCollectionsApi.getFiles(image.id, { page_size: 100 })()
                const files = result.results || result || []

                // Convert collection files to media_items format
                const mediaItems = files.map(file => {
                    // Get URL - prefer imgproxyBaseUrl for images, fallback to fileUrl/url
                    // For display, use imgproxyBaseUrl if available (it's the full-size processed URL)
                    const fullUrl = file.imgproxyBaseUrl || file.imgproxy_base_url || file.fileUrl || file.file_url || file.url || ''
                    // Thumbnail URL - prefer thumbnailUrl, fallback to imgproxyBaseUrl or fullUrl
                    const thumbUrl = file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl || file.imgproxy_base_url || fullUrl || ''
                    return {
                        id: String(file.id),
                        url: fullUrl,
                        type: file.fileType === 'video' ? 'video' : 'image',
                        altText: file.title || file.altText || 'Image',
                        caption: file.description || file.caption || '',
                        annotation: file.metadata?.annotation || '',
                        title: file.title || '',
                        photographer: '',
                        source: '',
                        width: file.width,
                        height: file.height,
                        thumbnailUrl: thumbUrl
                    }
                })
                setCollectionMediaItems(mediaItems)
            } catch (error) {
                console.error('Failed to load collection files:', error)
                setCollectionMediaItems([])
            } finally {
                setLoadingCollection(false)
            }
        }

        fetchCollectionFiles()
    }, [isCollection, localConfig.image])

    // Backend now provides media_items in config (resolved from image field)
    // Use media_items directly from config, or resolved collection files
    let effectiveMediaItems = localConfig.mediaItems || localConfig.media_items || []

    // If we have resolved collection files, use those instead
    if (isCollection && collectionMediaItems.length > 0) {
        effectiveMediaItems = collectionMediaItems
    }

    // Apply randomization if enabled (backend handles collection randomization, but we can still randomize here for backward compat)
    if (localConfig.randomize && effectiveMediaItems.length > 0) {
        effectiveMediaItems = [...effectiveMediaItems].sort(() => Math.random() - 0.5)
    }

    // Handle backward compatibility
    const items = effectiveMediaItems.length > 0 ? effectiveMediaItems : (localConfig.imageUrl ? [{
        url: localConfig.imageUrl,
        type: 'image',
        altText: localConfig.altText || 'Image',
        caption: localConfig.caption || ''
    }] : [])

    // Auto-play functionality for carousel
    useEffect(() => {
        // Only run if we're actually using carousel mode and have multiple items
        if ((localConfig.displayType || 'gallery') !== 'carousel' || !isPlaying || items.length <= 1) return

        const interval = setInterval(() => {
            setCurrentIndex(prev => prev < items.length - 1 ? prev + 1 : 0)
        }, ((localConfig.autoPlayInterval || 3) * 1000))

        return () => clearInterval(interval)
    }, [localConfig.displayType, isPlaying, items.length, localConfig.autoPlayInterval])


    const alignmentClasses = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right'
    }

    // Generate CSS classes based on resolved image style
    const getStyleClasses = () => {
        const classes = []

        // Spacing classes
        if (resolvedImageStyle.spacing === 'tight') {
            classes.push('gap-2')
        } else if (resolvedImageStyle.spacing === 'loose') {
            classes.push('gap-6')
        } else {
            classes.push('gap-4') // normal
        }

        // Shadow classes
        if (resolvedImageStyle.shadow === 'none') {
            // No shadow
        } else if (resolvedImageStyle.shadow === 'lg') {
            classes.push('shadow-lg')
        } else {
            classes.push('shadow-sm') // default
        }

        // Border radius classes
        if (resolvedImageStyle.borderRadius === 'none') {
            // No border radius
        } else if (resolvedImageStyle.borderRadius === 'large') {
            classes.push('rounded-lg')
        } else if (resolvedImageStyle.borderRadius === 'full') {
            classes.push('rounded-full')
        } else {
            classes.push('rounded') // normal
        }

        return classes.join(' ')
    }

    const renderMediaItem = (item, index = 0) => {
        if (!item || !item.url) {
            return null
        }

        if (item.type === 'video') {
            return (
                <video
                    key={index}
                    controls
                    autoPlay={localConfig.autoPlay || false}
                    className="max-w-full h-auto rounded shadow-sm"
                    poster={item.thumbnail}
                >
                    <source src={item.url} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>
            )
        }

        // Always use full image URL for page editor preview
        const displayUrl = item.url

        return (
            <img
                key={index}
                src={displayUrl}
                alt={item.altText || 'Image'}
                className="max-w-full h-auto rounded shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                onClick={(localConfig.enableLightbox !== false) ? () => {
                    // Lightbox functionality would be implemented here with full-size image (item.url)
                    // TODO: Implement lightbox modal
                } : undefined}
            />
        )
    }

    const renderGallery = () => {
        const gridClasses = {
            1: 'grid-cols-1',
            2: 'grid-cols-1 md:grid-cols-2',
            3: 'grid-cols-2 md:grid-cols-3',
            4: 'grid-cols-2 md:grid-cols-4',
            5: 'grid-cols-2 md:grid-cols-5',
            6: 'grid-cols-2 md:grid-cols-6'
        }

        const styleClasses = getStyleClasses()
        const columns = resolvedImageStyle.galleryColumns

        return (
            <div className={`grid ${gridClasses[columns] || 'grid-cols-2 md:grid-cols-3'} ${styleClasses}`} style={{ gridAutoFlow: 'dense' }}>
                {items.map((item, index) => {
                    const gridStyle = getGridStyle(item);
                    const objectFitClass = getObjectFitClass(item);

                    return (
                        <div key={index} className="gallery-item" style={gridStyle}>
                            {item.type === 'video' ? (
                                <video
                                    className="w-full h-48 object-cover rounded cursor-pointer"
                                    poster={item.thumbnail}
                                    muted
                                    onClick={() => {
                                        // Play/pause functionality
                                        const video = event.target
                                        video.paused ? video.play() : video.pause()
                                    }}
                                >
                                    <source src={item.url} type="video/mp4" />
                                </video>
                            ) : (
                                item.url ? (
                                    <img
                                        src={item.url}
                                        alt={item.altText || `Gallery image ${index + 1}`}
                                        className={`w-full h-48 ${objectFitClass} rounded cursor-pointer hover:opacity-90 transition-opacity`}
                                        onClick={(localConfig.enableLightbox !== false) ? () => {
                                            // TODO: Implement lightbox modal
                                        } : undefined}
                                    />
                                ) : null
                            )}
                            {(localConfig.showCaptions !== false) && item.caption && (
                                <p className="text-sm text-gray-600 mt-1">{item.caption}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        )
    }

    const renderCarousel = () => {

        if (items.length === 0) return null

        return (
            <div className="relative">
                <div className="overflow-hidden rounded-lg">
                    <div
                        className="flex transition-transform duration-300 ease-in-out"
                        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                    >
                        {items.map((item, index) => (
                            <div key={index} className="w-full flex-shrink-0">
                                {renderMediaItem(item, index)}
                                {(localConfig.showCaptions !== false) && item.caption && (
                                    <p className="text-sm text-gray-600 mt-2 text-center">{item.caption}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {items.length > 1 && (
                    <>
                        <button
                            onClick={() => {
                                setCurrentIndex(prev => prev > 0 ? prev - 1 : items.length - 1)
                                setIsPlaying(false) // Pause autoplay when manually navigating
                            }}
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white/100 rounded-full p-2 shadow-md transition-all"
                        >
                            ←
                        </button>
                        <button
                            onClick={() => {
                                setCurrentIndex(prev => prev < items.length - 1 ? prev + 1 : 0)
                                setIsPlaying(false) // Pause autoplay when manually navigating
                            }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white/100 rounded-full p-2 shadow-md transition-all"
                        >
                            →
                        </button>

                        {/* Play/Pause button */}
                        <button
                            onClick={() => setIsPlaying(prev => !prev)}
                            className="absolute top-2 right-2 bg-white/80 hover:bg-white/100 rounded-full p-2 shadow-md transition-all"
                            title={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
                        >
                            {isPlaying ? '⏸️' : '▶️'}
                        </button>

                        <div className="flex justify-center mt-4 gap-2">
                            {items.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        setCurrentIndex(index)
                                        setIsPlaying(false) // Pause autoplay when manually selecting
                                    }}
                                    className={`w-2 h-2 rounded-full transition-colors ${index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
                                        }`}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        )
    }

    // Check if using component style with Mustache template (takes precedence over imageStyle)
    const componentStyle = localConfig.componentStyle || 'default';
    const useComponentStyle = componentStyle && componentStyle !== 'default' && currentTheme?.componentStyles;

    if (useComponentStyle) {
        const style = currentTheme.componentStyles[componentStyle];

        if (style) {
            try {
                // Check for passthru mode
                const isPassthru = style.template?.trim() === '{{passthru}}';

                if (!isPassthru) {
                    // Prepare context for Mustache rendering
                    const mustacheContext = prepareComponentContext(
                        '', // No content for image
                        localConfig.anchor || '',
                        style.variables || {},
                        localConfig
                    );

                    // Add image specific context
                    mustacheContext.mediaItems = items;
                    mustacheContext.imageCount = items.length;

                    // Use ComponentStyleRenderer for consistent scoped rendering
                    const styleId = `image-${widgetId || 'preview'}-${componentStyle}`;

                    return (
                        <ComponentStyleRenderer
                            template={style.template}
                            context={mustacheContext}
                            css={generateCSSFromBreakpoints(style.css, currentTheme)}
                            styleId={styleId}
                            className=""
                        />
                    );
                }

                // Passthru mode: render default with custom CSS
                const styleId = `image-${widgetId || 'preview'}-${componentStyle}`;

                return (
                    <div data-style-id={styleId}>
                        {style.css && <style>{`[data-style-id="${styleId}"] { ${generateCSSFromBreakpoints(style.css, currentTheme)} }`}</style>}
                        {renderDefaultImage()}
                    </div>
                );
            } catch (error) {
                console.error('Error rendering custom component style:', error);
                return (
                    <div>
                        <div className="text-red-500 text-sm p-2">Error rendering custom style</div>
                    </div>
                );
            }
        }
    }

    // Check if custom imageStyle should be used (Mustache rendering)
    // This applies to BOTH editor and preview modes for WYSIWYG consistency
    const useCustomStyle = localConfig.imageStyle && localConfig.imageStyle !== 'default' && items.length > 0

    if (useCustomStyle && currentTheme) {
        const imageStyles = currentTheme.imageStyles || {}
        const style = imageStyles[localConfig.imageStyle]

        if (style) {
            try {
                // Prepare context for Mustache rendering
                const context = (localConfig.displayType || 'gallery') === 'carousel'
                    ? prepareCarouselContext(items, localConfig, style.variables)
                    : prepareGalleryContext(items, localConfig, style.variables, style.lightboxConfig)

                // Render template
                const html = renderMustache(style.template, context)

                // Render custom style for both editor and preview modes
                const wrapperClass = mode === 'editor'
                    ? 'image-widget-editor p-4 custom-style'
                    : 'image-widget custom-style'

                return (
                    <div className={wrapperClass}>
                        {style.css && <style>{generateCSSFromBreakpoints(style.css, currentTheme)}</style>}
                        <div dangerouslySetInnerHTML={{ __html: html }} />
                    </div>
                )
            } catch (error) {
                console.error('Error rendering custom image style:', error)
                // Still return early - don't fall back to default rendering
                const wrapperClass = mode === 'editor'
                    ? 'image-widget-editor p-4 custom-style'
                    : 'image-widget custom-style'
                return (
                    <div className={wrapperClass}>
                        <div className="text-red-500 text-sm p-2">Error rendering custom style</div>
                    </div>
                )
            }
        }
    }

    // Helper function for default rendering
    function renderDefaultImage() {
        if (mode === 'editor') {
            return (
                <div className="image-widget-editor p-4">
                    <div className={`${alignmentClasses[resolvedImageStyle.alignment]}`}>
                        {items.length > 0 ? (
                            items.length === 1 ? (
                                // Single image display regardless of displayType setting
                                <div>
                                    {renderMediaItem(items[0])}
                                    {(localConfig.showCaptions !== false) && items[0].caption && (
                                        <p className="text-sm text-gray-600 mt-2 italic">{items[0].caption}</p>
                                    )}
                                </div>
                            ) : (
                                // Multiple images: use displayType setting
                                (localConfig.displayType || 'gallery') === 'carousel' ? renderCarousel() : renderGallery()
                            )
                        ) : (
                            <div className="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">
                                <Image className="h-8 w-8 mr-2" />
                                Image placeholder
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (items.length === 0) {
            return (
                <div className={`image-widget ${alignmentClasses[resolvedImageStyle.alignment]}`}>
                    <div className="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">
                        <Image className="h-8 w-8 mr-2" />
                        No media
                    </div>
                </div>
            );
        }

        return (
            <div className={`image-widget ${alignmentClasses[resolvedImageStyle.alignment]} mx-auto`}>
                {items.length === 1 ? (
                    // Single image display regardless of displayType setting
                    <div>
                        {renderMediaItem(items[0])}
                        {(localConfig.showCaptions !== false) && items[0].caption && (
                            <p className="text-sm text-gray-600 mt-2">{items[0].caption}</p>
                        )}
                    </div>
                ) : (
                    // Multiple images: use displayType setting
                    (localConfig.displayType || 'gallery') === 'carousel' ? renderCarousel() : renderGallery()
                )}
            </div>
        );
    }

    // Default rendering (no custom style selected)
    return renderDefaultImage()
}

// === COLOCATED METADATA ===
ImageWidget.displayName = 'ImageWidget'
ImageWidget.widgetType = 'easy_widgets.ImageWidget'

// Default configuration
ImageWidget.defaultConfig = {
    mediaItems: [],
    collectionId: null,
    displayType: 'gallery',
    imageStyle: null,
    componentStyle: 'default',
    enableLightbox: true,
    autoPlay: false,
    autoPlayInterval: 3,
    showCaptions: true,
    randomize: false,
    collectionConfig: {
        randomize: false,
        maxItems: 0
    },
    // Backward compatibility
    imageUrl: '',
    altText: '',
    caption: '',
    alignment: 'center',
    galleryColumns: 3
}

// Schema for schema-driven form
ImageWidget.schema = {
    image: {
        type: 'object',
        component: 'ImageInput',
        mediaTypes: ['image'],
        allowCollections: true,
        multiple: false,
        label: 'Image or Collection',
        description: 'Select a single image or collection to display',
        namespace: null // Will be set from context
    },
    displayType: {
        type: 'string',
        enum: ['gallery', 'carousel'],
        label: 'Display Type',
        description: 'How to display multiple images',
        default: 'gallery'
    },
    imageStyle: {
        type: 'string',
        format: 'imageStyle',
        label: 'Image Style',
        description: 'Custom image style from theme (gallery or carousel)',
        conditionalOn: {
            field: 'componentStyle',
            condition: 'equals',
            value: 'default'
        }
    },
    componentStyle: {
        type: 'string',
        format: 'componentStyle',
        label: 'Component Style',
        description: 'Advanced: Custom component style (overrides image style)',
        default: 'default'
    },
    enableLightbox: {
        type: 'boolean',
        label: 'Enable Lightbox',
        description: 'Allow clicking images to open in lightbox',
        default: true
    },
    showCaptions: {
        type: 'boolean',
        label: 'Show Captions',
        description: 'Display image captions',
        default: true
    },
    randomize: {
        type: 'boolean',
        label: 'Randomize Order',
        description: 'Randomize the order of images',
        default: false
    },
    autoPlay: {
        type: 'boolean',
        label: 'Auto Play Carousel',
        description: 'Automatically advance carousel slides',
        default: false,
        conditionalOn: {
            field: 'displayType',
            condition: 'equals',
            value: 'carousel'
        }
    },
    autoPlayInterval: {
        type: 'number',
        label: 'Auto Play Interval (seconds)',
        description: 'Seconds between carousel slides',
        default: 3,
        min: 1,
        max: 30,
        conditionalOn: {
            field: 'autoPlay',
            condition: 'equals',
            value: true
        }
    },
}

// Display metadata
ImageWidget.metadata = {
    name: 'Image',
    description: 'Images, galleries, and videos with multiple display modes and responsive design',
    category: 'media',
    icon: Image,
    tags: ['eceee', 'image', 'picture', 'photo', 'video', 'gallery', 'media', 'carousel']
    // No longer uses specialEditor - now uses schema-driven form
}

export default ImageWidget
