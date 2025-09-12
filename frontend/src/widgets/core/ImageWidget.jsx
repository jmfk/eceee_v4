import React, { useState, useEffect } from 'react'
import { Image } from 'lucide-react'
import { mediaCollectionsApi, namespacesApi } from '../../api'

/**
 * Image Widget Component
 * Renders images, galleries, and videos with multiple display modes
 */
const ImageWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        mediaItems = [],
        collectionId = null,
        collectionConfig = {},
        displayType = 'single',
        alignment = 'center',
        galleryColumns = 3,
        enableLightbox = true,
        autoPlay = false,
        showCaptions = true,
        // Backward compatibility
        imageUrl = '',
        altText = 'Image',
        caption = ''
    } = config

    // State for collection images
    const [collectionImages, setCollectionImages] = useState([])
    const [loadingCollection, setLoadingCollection] = useState(false)

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
                    if (collectionConfig.randomize) {
                        finalImages = [...finalImages].sort(() => Math.random() - 0.5)
                    }

                    // Apply max items limit
                    if (collectionConfig.maxItems > 0) {
                        finalImages = finalImages.slice(0, collectionConfig.maxItems)
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
    }, [collectionId, collectionConfig])

    console.log("mode", mode)
    console.log("mediaItems", mediaItems)
    console.log("collectionId", collectionId)
    console.log("collectionImages", collectionImages)

    // Determine which images to use: collection images or individual media items
    const effectiveMediaItems = collectionId ? collectionImages : mediaItems

    // Handle backward compatibility
    const items = effectiveMediaItems.length > 0 ? effectiveMediaItems : (imageUrl ? [{
        url: imageUrl,
        type: 'image',
        altText: altText,
        caption: caption
    }] : [])

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

        return (
            <div className={`grid ${gridClasses[galleryColumns] || 'grid-cols-2 md:grid-cols-3'} gap-4`}>
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
        // Simple carousel implementation with navigation
        const [currentIndex, setCurrentIndex] = React.useState(0)

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
                            onClick={() => setCurrentIndex(prev => prev > 0 ? prev - 1 : items.length - 1)}
                            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-md transition-all"
                        >
                            ←
                        </button>
                        <button
                            onClick={() => setCurrentIndex(prev => prev < items.length - 1 ? prev + 1 : 0)}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-md transition-all"
                        >
                            →
                        </button>

                        <div className="flex justify-center mt-4 gap-2">
                            {items.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentIndex(index)}
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
    console.log("items", items)
    if (mode === 'editor') {
        return (
            <div className="image-widget-editor p-4">
                <div className={`${alignmentClasses[alignment]}`}>
                    {items.length > 0 ? (
                        displayType === 'gallery' ? renderGallery() :
                            displayType === 'carousel' ? renderCarousel() : (
                                <div>
                                    {renderMediaItem(items[0])}
                                    {showCaptions && items[0].caption && (
                                        <p className="text-sm text-gray-600 mt-2 italic">{items[0].caption}</p>
                                    )}
                                </div>
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
            <div className={`image-widget ${alignmentClasses[alignment]}`}>
                <div className="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">
                    <Image className="h-8 w-8 mr-2" />
                    No media
                </div>
            </div>
        )
    }

    return (
        <div className={`image-widget ${alignmentClasses[alignment]} mx-auto`}>
            {displayType === 'gallery' ? renderGallery() :
                displayType === 'carousel' ? renderCarousel() : (
                    <div>
                        {renderMediaItem(items[0])}
                        {showCaptions && items[0].caption && (
                            <p className="text-sm text-gray-600 mt-2">{items[0].caption}</p>
                        )}
                    </div>
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
    displayType: 'single',
    alignment: 'center',
    galleryColumns: 3,
    enableLightbox: true,
    autoPlay: false,
    showCaptions: true,
    // Backward compatibility
    imageUrl: '',
    altText: '',
    caption: ''
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
