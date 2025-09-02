import React from 'react'
import { ImageIcon, Grid3X3 } from 'lucide-react'

/**
 * Gallery Widget Component
 * Displays a grid of images with optional title
 */
const GalleryWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        title = '',
        images = [],
        columns = 3,
        spacing = 'normal',
        show_captions: showCaptions = true
    } = config

    const getGridClasses = () => {
        const colClasses = {
            1: 'grid-cols-1',
            2: 'grid-cols-1 md:grid-cols-2',
            3: 'grid-cols-2 md:grid-cols-3',
            4: 'grid-cols-2 md:grid-cols-4',
            5: 'grid-cols-2 md:grid-cols-5',
            6: 'grid-cols-2 md:grid-cols-6'
        }

        const gapClasses = {
            tight: 'gap-1',
            normal: 'gap-2',
            loose: 'gap-4'
        }

        return `grid ${colClasses[columns] || colClasses[3]} ${gapClasses[spacing] || gapClasses.normal}`
    }

    if (mode === 'editor') {
        return (
            <div className="gallery-widget-editor p-2 border border-dashed border-gray-300 rounded">
                <div className="flex items-center mb-2">
                    <Grid3X3 className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">Gallery</span>
                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {images.length} images
                    </span>
                </div>

                {title && (
                    <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
                )}

                <div className={getGridClasses()}>
                    {images.length > 0 ? (
                        images.map((image, index) => (
                            <div key={index} className="relative group">
                                <img
                                    src={image.url || image.src}
                                    alt={image.alt || `Gallery image ${index + 1}`}
                                    className="w-full h-24 object-cover rounded shadow-sm"
                                />
                                {showCaptions && image.caption && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b">
                                        {image.caption}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full bg-gray-200 h-24 rounded flex items-center justify-center text-gray-500">
                            <ImageIcon className="h-8 w-8 mr-2" />
                            Gallery placeholder
                        </div>
                    )}
                </div>

                <div className="text-xs text-gray-500 mt-2">
                    {columns} columns, {spacing} spacing
                </div>
            </div>
        )
    }

    return (
        <div className="gallery-widget">
            {title && (
                <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
            )}

            <div className={getGridClasses()}>
                {images.length > 0 ? (
                    images.map((image, index) => (
                        <div key={index} className="relative group">
                            <img
                                src={image.url || image.src}
                                alt={image.alt || `Gallery image ${index + 1}`}
                                className="w-full h-auto object-cover rounded transition-transform group-hover:scale-105"
                            />
                            {showCaptions && image.caption && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-2 rounded-b">
                                    {image.caption}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="col-span-full bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">
                        <ImageIcon className="h-8 w-8 mr-2" />
                        No images in gallery
                    </div>
                )}
            </div>
        </div>
    )
}

GalleryWidget.displayName = 'GalleryWidget'
GalleryWidget.widgetType = 'core_widgets.GalleryWidget'
GalleryWidget.defaultConfig = {
    title: '',
    images: [],
    columns: 3,
    spacing: 'normal',
    show_captions: true
}

export default GalleryWidget
