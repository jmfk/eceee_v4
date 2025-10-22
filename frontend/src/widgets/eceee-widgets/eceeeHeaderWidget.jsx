import React, { useState, useEffect } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { getImgproxyUrlFromImage } from '../../utils/imgproxySecure'

/**
 * ECEEE Header Widget Component
 * Responsive header widget that displays an optimized image via imgproxy
 * - Height scales dynamically from 60px (mobile) to 132px (desktop)
 * - Uses object-fit: cover to fill the space
 * - Supports alignment (left, center, right)
 */
const eceeeHeaderWidget = ({ config = {}, mode = 'preview' }) => {
    const { image, alignment = 'center' } = config

    // State for secure imgproxy URL (desktop version)
    const [optimizedImageUrl, setOptimizedImageUrl] = useState('')
    const [imageLoading, setImageLoading] = useState(false)

    // Load optimized image URL from backend API
    useEffect(() => {
        if (image) {
            // In editor mode, use thumbnail for faster preview
            if (mode === 'editor') {
                const thumbnailUrl = image.thumbnailUrl || image.thumbnail_url || image.imgproxyBaseUrl || image.fileUrl
                setOptimizedImageUrl(thumbnailUrl)
                setImageLoading(false)
                return
            }

            // In preview mode, get full-size optimized image
            setImageLoading(true)
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
                    // Fallback to thumbnail or original URL
                    setOptimizedImageUrl(image.thumbnailUrl || image.thumbnail_url || image.imgproxyBaseUrl || image.fileUrl || '')
                    setImageLoading(false)
                })
        }
    }, [image, mode])

    // Map alignment to object-position
    const objectPositionMap = {
        left: 'left center',
        center: 'center center',
        right: 'right center'
    }
    const objectPosition = objectPositionMap[alignment] || 'center center'

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
            <div className="header-widget w-full overflow-hidden relative">
                {imageLoading && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10">
                        Optimizing image...
                    </div>
                )}
                {optimizedImageUrl && (
                    <img
                        src={optimizedImageUrl}
                        alt={image.title || 'Header Image'}
                        className={`header-image w-full block align-${alignment}`}
                        style={{
                            objectFit: 'cover',
                            objectPosition: objectPosition
                        }}
                    />
                )}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .header-widget .header-image {
                        width: 100%;
                        height: clamp(60px, 12vw, 132px) !important;
                        object-fit: cover;
                        display: block;
                    }
                    
                    @media (max-width: 375px) {
                        .header-widget .header-image {
                            height: 60px !important;
                        }
                    }
                    
                    @media (min-width: 1200px) {
                        .header-widget .header-image {
                            height: 132px !important;
                        }
                    }
                `}} />
            </div>
        )
    }

    // Preview mode: server-rendered HTML already has optimized images
    if (!image) {
        return null
    }

    return (
        <div className="header-widget w-full overflow-hidden relative">
            {optimizedImageUrl && (
                <img
                    src={optimizedImageUrl}
                    alt={image.title || 'Header Image'}
                    className={`header-image w-full block align-${alignment}`}
                    style={{
                        objectFit: 'cover',
                        objectPosition: objectPosition
                    }}
                />
            )}
            <style dangerouslySetInnerHTML={{
                __html: `
                .header-widget .header-image {
                    width: 100%;
                    height: clamp(60px, 12vw, 132px) !important;
                    object-fit: cover;
                    display: block;
                }
                
                @media (max-width: 375px) {
                    .header-widget .header-image {
                        height: 60px !important;
                    }
                }
                
                @media (min-width: 1200px) {
                    .header-widget .header-image {
                        height: 132px !important;
                    }
                }
            `}} />
        </div>
    )
}

// === COLOCATED METADATA ===
eceeeHeaderWidget.displayName = 'HeaderWidget'
eceeeHeaderWidget.widgetType = 'eceee_widgets.HeaderWidget'

// Default configuration
eceeeHeaderWidget.defaultConfig = {
    image: null,
    alignment: 'center'
}

// Display metadata
eceeeHeaderWidget.metadata = {
    name: 'Header',
    description: 'Responsive header with dynamic height (60px-132px) and alignment options',
    category: 'layout',
    icon: ImageIcon,
    tags: ['eceee', 'header', 'image', 'layout', 'responsive', 'cover']
}

export default eceeeHeaderWidget
