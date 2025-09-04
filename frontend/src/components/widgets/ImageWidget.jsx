import React from 'react'
import { Image } from 'lucide-react'

/**
 * Image Widget Component
 * Renders images with optional caption and styling
 */
const ImageWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        image_url: imageUrl = '',
        alt_text: altText = 'Image',
        caption = '',
        alignment = 'center'
    } = config

    const alignmentClasses = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right'
    }

    if (mode === 'editor') {
        return (
            <div className="image-widget-editor p-2 border border-dashed border-gray-300 rounded">
                <div className="flex items-center mb-2">
                    <Image className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">Image</span>
                </div>
                <div className={alignmentClasses[alignment]}>
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={altText}
                            className="max-w-full h-auto rounded shadow-sm"
                        />
                    ) : (
                        <div className="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">
                            <Image className="h-8 w-8 mr-2" />
                            Image placeholder
                        </div>
                    )}
                    {caption && (
                        <p className="text-sm text-gray-600 mt-2 italic">{caption}</p>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className={`image-widget ${alignmentClasses[alignment]}`}>
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={altText}
                    className="max-w-full h-auto rounded"
                />
            ) : (
                <div className="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">
                    <Image className="h-8 w-8 mr-2" />
                    Image placeholder
                </div>
            )}
            {caption && (
                <p className="text-sm text-gray-600 mt-2">{caption}</p>
            )}
        </div>
    )
}

// === COLOCATED METADATA ===
ImageWidget.displayName = 'ImageWidget'
ImageWidget.widgetType = 'core_widgets.ImageWidget'

// Default configuration
ImageWidget.defaultConfig = {
    image_url: '',
    alt_text: '',
    caption: '',
    alignment: 'center'
}

// Display metadata
ImageWidget.metadata = {
    name: 'Image',
    description: 'Image display with caption and sizing options',
    category: 'media',
    icon: Image,
    tags: ['image', 'picture', 'photo', 'media']
}

export default ImageWidget
