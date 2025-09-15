import React, { useState, useEffect } from 'react'
import { Image } from 'lucide-react'
import { mediaCollectionsApi, namespacesApi } from '../../api'
import { useTheme } from '../../hooks/useTheme'

/**
 * Image Widget Component
 * Renders images, galleries, and videos with multiple display modes
 */
const ImageWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        mediaItems = [],
        collectionId = null,
        collectionConfig = {},
        displayType = 'gallery',
        imageStyle = null,
        enableLightbox = true,
        autoPlay = false,
        autoPlayInterval = 3,
        showCaptions = true,
        // Backward compatibility
        imageUrl = '',
        altText = 'Image',
        caption = '',
        alignment = 'center', // Legacy support
        galleryColumns = 3 // Legacy support
    } = config

    // Get current theme for image styles
    const { currentTheme } = useTheme()

    // State for collection images
    const [collectionImages, setCollectionImages] = useState([])
    const [loadingCollection, setLoadingCollection] = useState(false)

    // Carousel state - always initialized to avoid hook order issues
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isPlaying, setIsPlaying] = useState(autoPlay)

    // Resolve image style from theme
    const resolvedImageStyle = React.useMemo(() => {
        if (!imageStyle || !currentTheme?.image_styles) {
            // Fallback to legacy values or defaults
            return {
                alignment: alignment || 'center',
                galleryColumns: galleryColumns || 3,
                spacing: 'normal'
            }
        }

        const themeStyle = currentTheme.image_styles[imageStyle]
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
    }, [imageStyle, currentTheme, alignment, galleryColumns])

    // Memoize collection config to prevent unnecessary re-renders
    const stableCollectionConfig = React.useMemo(() => ({
        randomize: collectionConfig.randomize || false,
        maxItems: collectionConfig.maxItems || 0
    }), [collectionConfig.randomize, collectionConfig.maxItems])

    // Load collection images when collectionId is present
    useEffect(() => {
        const loadCollectionImages = async () => {
            if (!collectionId) {
                setCollectionImages([])
                return
            }

            setLoadingCollection(true)
            try {
                // Get default namespace
                const defaultNamespace = await namespacesApi.getDefault()
                const namespace = defaultNamespace?.slug

                if (namespace) {
                    // Fetch collection images
                    const result = await mediaCollectionsApi.getFiles(collectionId, {
                        namespace,
                        pageSize: 100
                    })()

                    const images = result.results || result || []

                    // Convert to mediaItems format
                    const collectionMediaItems = images.map(image => ({
                        id: image.id,
                        url: image.imgproxyBaseUrl || image.fileUrl,
                        type: 'image',
                        title: image.title || '',
                        altText: image.altText || image.title || '',
                        caption: image.description || '',
                        photographer: image.photographer || '',
                        source: image.source || '',
                        width: image.width,
                        height: image.height,
                        thumbnailUrl: image.imgproxyBaseUrl || image.fileUrl
                    }))

                    // Apply collection configuration
                    let finalImages = collectionMediaItems

                    // Apply randomization if requested
                    if (stableCollectionConfig.randomize) {
                        finalImages = [...finalImages].sort(() => Math.random() - 0.5)
                    }

                    // Apply max items limit
                    if (stableCollectionConfig.maxItems > 0) {
                        finalImages = finalImages.slice(0, stableCollectionConfig.maxItems)
                    }

                    setCollectionImages(finalImages)
                }
            } catch (error) {
                console.error('Failed to load collection images:', error)
                setCollectionImages([])
            } finally {
                setLoadingCollection(false)
            }
        }

        loadCollectionImages()
    }, [collectionId, stableCollectionConfig])

    // Determine which images to use: collection images or individual media items
    const effectiveMediaItems = collectionId ? collectionImages : mediaItems

    // Handle backward compatibility
    const items = effectiveMediaItems.length > 0 ? effectiveMediaItems : (imageUrl ? [{
        url: imageUrl,
        type: 'image',
        altText: altText,
        caption: caption
    }] : [])

    // Auto-play functionality for carousel
    useEffect(() => {
        // Only run if we're actually using carousel mode and have multiple items
        if (displayType !== 'carousel' || !isPlaying || items.length <= 1) return

        const interval = setInterval(() => {
            setCurrentIndex(prev => prev < items.length - 1 ? prev + 1 : 0)
        }, (autoPlayInterval || 3) * 1000)

        return () => clearInterval(interval)
    }, [displayType, isPlaying, items.length, autoPlayInterval])

    // Show loading state when collection is being loaded
    if (collectionId && loadingCollection) {
        return (
            <div className={`image-widget ${mode === 'editor' ? 'p-4' : ''}`}>
                <div className="bg-gray-100 h-32 rounded flex items-center justify-center text-gray-500">
                    <Image className="h-6 w-6 mr-2 animate-pulse" />
                    Loading collection...
                </div>
            </div>
        )
    }

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
        if (item.type === 'video') {
            return (
                <video
                    key={index}
                    controls
                    autoPlay={autoPlay}
                    className="max-w-full h-auto rounded shadow-sm"
                    poster={item.thumbnail}
                >
                    <source src={item.url} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>
            )
        }

        return (
            <img
                key={index}
                src={item.url}
                alt={item.altText || 'Image'}
                className="max-w-full h-auto rounded shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                onClick={enableLightbox ? () => {
                    // Lightbox functionality would be implemented here
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
            <div className={`grid ${gridClasses[columns] || 'grid-cols-2 md:grid-cols-3'} ${styleClasses}`}>
                {items.map((item, index) => (
                    <div key={index} className="gallery-item">
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
                            <img
                                src={item.url}
                                alt={item.altText || `Gallery image ${index + 1}`}
                                className="w-full h-48 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={enableLightbox ? () => {
                                    // TODO: Implement lightbox modal
                                } : undefined}
                            />
                        )}
                        {showCaptions && item.caption && (
                            <p className="text-sm text-gray-600 mt-1">{item.caption}</p>
                        )}
                    </div>
                ))}
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
                                {showCaptions && item.caption && (
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
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-md transition-all"
                        >
                            ←
                        </button>
                        <button
                            onClick={() => {
                                setCurrentIndex(prev => prev < items.length - 1 ? prev + 1 : 0)
                                setIsPlaying(false) // Pause autoplay when manually navigating
                            }}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-md transition-all"
                        >
                            →
                        </button>

                        {/* Play/Pause button */}
                        <button
                            onClick={() => setIsPlaying(prev => !prev)}
                            className="absolute top-2 right-2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-md transition-all"
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

    if (mode === 'editor') {
        return (
            <div className="image-widget-editor p-4">
                <div className={`${alignmentClasses[resolvedImageStyle.alignment]}`}>
                    {items.length > 0 ? (
                        items.length === 1 ? (
                            // Single image display regardless of displayType setting
                            <div>
                                {renderMediaItem(items[0])}
                                {showCaptions && items[0].caption && (
                                    <p className="text-sm text-gray-600 mt-2 italic">{items[0].caption}</p>
                                )}
                            </div>
                        ) : (
                            // Multiple images: use displayType setting
                            displayType === 'carousel' ? renderCarousel() : renderGallery()
                        )
                    ) : (
                        <div className="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">
                            <Image className="h-8 w-8 mr-2" />
                            Image placeholder
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (items.length === 0) {
        return (
            <div className={`image-widget ${alignmentClasses[resolvedImageStyle.alignment]}`}>
                <div className="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">
                    <Image className="h-8 w-8 mr-2" />
                    No media
                </div>
            </div>
        )
    }

    return (
        <div className={`image-widget ${alignmentClasses[resolvedImageStyle.alignment]} mx-auto`}>
            {items.length === 1 ? (
                // Single image display regardless of displayType setting
                <div>
                    {renderMediaItem(items[0])}
                    {showCaptions && items[0].caption && (
                        <p className="text-sm text-gray-600 mt-2">{items[0].caption}</p>
                    )}
                </div>
            ) : (
                // Multiple images: use displayType setting
                displayType === 'carousel' ? renderCarousel() : renderGallery()
            )}
        </div>
    )
}

// === COLOCATED METADATA ===
ImageWidget.displayName = 'ImageWidget'
ImageWidget.widgetType = 'core_widgets.ImageWidget'

// Default configuration
ImageWidget.defaultConfig = {
    mediaItems: [],
    displayType: 'gallery',
    imageStyle: null, // Will use theme default or fallback to legacy values
    enableLightbox: true,
    autoPlay: false,
    autoPlayInterval: 3,
    showCaptions: true,
    // Backward compatibility
    imageUrl: '',
    altText: '',
    caption: '',
    alignment: 'center', // Legacy fallback
    galleryColumns: 3 // Legacy fallback
}

// Display metadata
ImageWidget.metadata = {
    name: 'Image',
    description: 'Images, galleries, and videos with multiple display modes and responsive design',
    category: 'media',
    icon: Image,
    tags: ['image', 'picture', 'photo', 'video', 'gallery', 'media', 'carousel']
}

export default ImageWidget
