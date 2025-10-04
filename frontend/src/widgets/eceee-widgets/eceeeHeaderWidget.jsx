import React, { useState, useEffect } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { getImgproxyUrlFromImage } from '../../utils/imgproxySecure'

/**
 * ECEEE Header Widget Component
 * Simple header widget that displays an optimized image via imgproxy
 * Matches backend template: width=1280, height=132, resize_type='fill', gravity='sm'
 */
const eceeeHeaderWidget = ({ config = {}, mode = 'preview' }) => {
    const { image } = config

    // State for secure imgproxy URL
    const [optimizedImageUrl, setOptimizedImageUrl] = useState('')
    const [imageLoading, setImageLoading] = useState(false)

    // Load optimized image URL from backend API
    useEffect(() => {
        if (image) {
            setImageLoading(true)

            // Get signed imgproxy URL from backend with same params as template
            getImgproxyUrlFromImage(image, {
                width: 1280,
                height: 132,
                resizeType: 'fill',
                gravity: 'sm'
            })
                .then(url => {
                    setOptimizedImageUrl(url)
                    setImageLoading(false)
                })
                .catch(error => {
                    console.error('Failed to load optimized header image:', error)
                    // Fallback to original URL
                    setOptimizedImageUrl(image.imgproxyBaseUrl || image.fileUrl || '')
                    setImageLoading(false)
                })
        }
    }, [image, mode])

    // Editor mode: show placeholder if no image
    if (mode === 'editor') {
        if (!image) {
            return (
                <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center text-gray-400">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <p className="text-sm">No header image selected</p>
                    <p className="text-xs mt-1">Configure this widget to add an image</p>
                </div>
            )
        }

        return (
            <div className="w-full relative">
                {imageLoading && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10">
                        Optimizing image...
                    </div>
                )}
                {optimizedImageUrl && (<img
                    src={optimizedImageUrl}
                    alt={image.title || 'Header Image'}
                    className="w-full h-auto block header-image"
                />)}
            </div>
        )
    }

    // Preview mode: server-rendered HTML already has optimized images
    if (!image) {
        return null
    }

    return (
        <div className="w-full">
            {optimizedImageUrl && (<img
                src={optimizedImageUrl}
                alt={image.title || 'Header Image'}
                className="w-full h-auto block header-image"
            />)}
        </div>
    )
}

// === COLOCATED METADATA ===
eceeeHeaderWidget.displayName = 'HeaderWidget'
eceeeHeaderWidget.widgetType = 'eceee_widgets.HeaderWidget'

// Default configuration
eceeeHeaderWidget.defaultConfig = {
    image: null
}

// Display metadata
eceeeHeaderWidget.metadata = {
    name: 'Header',
    description: 'Simple header widget with image',
    category: 'layout',
    icon: ImageIcon,
    tags: ['eceee', 'header', 'image', 'layout']
}

export default eceeeHeaderWidget
