import React from 'react'
import { Image } from 'lucide-react'

/**
 * Image Widget Component
 * Renders images, galleries, and videos with multiple display modes
 */
const ImageWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        media_items = [],
        display_type = 'single',
        size = 'medium',
        alignment = 'center',
        gallery_columns = 3,
        enable_lightbox = true,
        auto_play = false,
        show_captions = true,
        // Backward compatibility
        image_url = '',
        alt_text = 'Image',
        caption = ''
    } = config

    // Handle backward compatibility
    const items = media_items.length > 0 ? media_items : (image_url ? [{
        url: image_url,
        type: 'image',
        alt_text: alt_text,
        caption: caption
    }] : [])

    const alignmentClasses = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right'
    }

    const sizeClasses = {
        small: 'max-w-sm',
        medium: 'max-w-2xl',
        large: 'max-w-4xl',
        full: 'w-full'
    }

    const renderMediaItem = (item, index = 0) => {
        if (item.type === 'video') {
            return (
                <video
                    key={index}
                    controls
                    autoPlay={auto_play}
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
                alt={item.alt_text || 'Image'}
                className="max-w-full h-auto rounded shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                onClick={enable_lightbox ? () => {
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
            <div className={`grid ${gridClasses[gallery_columns] || 'grid-cols-2 md:grid-cols-3'} gap-4`}>
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
                                alt={item.alt_text || `Gallery image ${index + 1}`}
                                className="w-full h-48 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={enable_lightbox ? () => {
                                    // TODO: Implement lightbox modal
                                } : undefined}
                            />
                        )}
                        {show_captions && item.caption && (
                            <p className="text-sm text-gray-600 mt-1">{item.caption}</p>
                        )}
                    </div>
                ))}
            </div>
        )
    }

    if (mode === 'editor') {
        return (
            <div className="image-widget-editor p-4">
                <div className={`${alignmentClasses[alignment]} ${sizeClasses[size]}`}>
                    {items.length > 0 ? (
                        display_type === 'gallery' ? renderGallery() : (
                            <div>
                                {renderMediaItem(items[0])}
                                {show_captions && items[0].caption && (
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
        <div className={`image-widget ${alignmentClasses[alignment]} ${sizeClasses[size]} mx-auto`}>
            {display_type === 'gallery' ? renderGallery() : (
                <div>
                    {renderMediaItem(items[0])}
                    {show_captions && items[0].caption && (
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
    media_items: [],
    display_type: 'single',
    size: 'medium',
    alignment: 'center',
    gallery_columns: 3,
    enable_lightbox: true,
    auto_play: false,
    show_captions: true,
    // Backward compatibility
    image_url: '',
    alt_text: '',
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
