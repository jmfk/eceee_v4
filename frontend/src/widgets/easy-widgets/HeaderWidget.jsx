import React, { useState, useEffect } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { getImgproxyUrlFromImage } from '../../utils/imgproxySecure'

/**
 * EASY Header Widget Component
 * Responsive header widget with fixed sizes per breakpoint
 * - Mobile: 640x80px (default)
 * - Tablet: 1024x112px (default)
 * - Desktop: 1280x112px (default)
 * - Uses object-fit: cover to fill the space
 * - Supports per-breakpoint alignment (left, center, right)
 */
const HeaderWidget = ({ config = {}, mode = 'preview' }) => {
    // Extract configuration with defaults
    const {
        mobileImage,
        mobileWidth = 640,
        mobileHeight = 80,
        mobileAlignment = 'center',
        tabletImage,
        tabletWidth = 1024,
        tabletHeight = 112,
        tabletAlignment = 'center',
        image,
        width = 1280,
        height = 112,
        alignment = 'center'
    } = config

    // State for optimized image URLs
    const [mobileUrl, setMobileUrl] = useState('')
    const [tabletUrl, setTabletUrl] = useState('')
    const [desktopUrl, setDesktopUrl] = useState('')
    const [imageLoading, setImageLoading] = useState(false)

    // Load optimized image URLs from backend API
    useEffect(() => {
        const loadImages = async () => {
            setImageLoading(true)

            try {
                // Desktop image
                if (image) {
                    const url = await getImgproxyUrlFromImage(image, {
                        width,
                        height,
                        resizeType: 'fill'
                    })
                    setDesktopUrl(url)
                }

                // Tablet image (fallback to desktop)
                if (tabletImage) {
                    const url = await getImgproxyUrlFromImage(tabletImage, {
                        width: tabletWidth,
                        height: tabletHeight,
                        resizeType: 'fill'
                    })
                    setTabletUrl(url)
                } else if (image) {
                    const url = await getImgproxyUrlFromImage(image, {
                        width: tabletWidth,
                        height: tabletHeight,
                        resizeType: 'fill'
                    })
                    setTabletUrl(url)
                }

                // Mobile image (fallback to tablet or desktop)
                if (mobileImage) {
                    const url = await getImgproxyUrlFromImage(mobileImage, {
                        width: mobileWidth,
                        height: mobileHeight,
                        resizeType: 'fill'
                    })
                    setMobileUrl(url)
                } else if (tabletImage) {
                    const url = await getImgproxyUrlFromImage(tabletImage, {
                        width: mobileWidth,
                        height: mobileHeight,
                        resizeType: 'fill'
                    })
                    setMobileUrl(url)
                } else if (image) {
                    const url = await getImgproxyUrlFromImage(image, {
                        width: mobileWidth,
                        height: mobileHeight,
                        resizeType: 'fill'
                    })
                    setMobileUrl(url)
                }
            } catch (error) {
                console.error('Failed to load optimized header images:', error)
            } finally {
                setImageLoading(false)
            }
        }

        if (image || tabletImage || mobileImage) {
            loadImages()
        }
    }, [image, tabletImage, mobileImage, width, height, tabletWidth, tabletHeight, mobileWidth, mobileHeight])

    // Map alignment to background-position
    const getBackgroundPosition = (align) => {
        const positionMap = {
            left: 'left center',
            center: 'center center',
            right: 'right center'
        }
        return positionMap[align] || 'center center'
    }

    // Editor mode: show placeholder if no image
    if (mode === 'editor') {
        if (!image && !tabletImage && !mobileImage) {
            return (
                <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center text-gray-400">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <p className="text-sm">No header images selected</p>
                    <p className="text-xs mt-1">Configure this widget to add images</p>
                </div>
            )
        }

        return (
            <div className="header-widget w-full overflow-hidden relative">
                {imageLoading && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10">
                        Optimizing images...
                    </div>
                )}
                <div className="header-image w-full" />
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .header-widget .header-image {
                        width: 100%;
                        height: ${mobileHeight}px;
                        background-image: url('${mobileUrl}');
                        background-size: cover;
                        background-position: ${getBackgroundPosition(mobileAlignment)};
                        background-repeat: no-repeat;
                    }
                    
                    @media (min-width: ${mobileWidth}px) {
                        .header-widget .header-image {
                            height: ${tabletHeight}px;
                            background-image: url('${tabletUrl || mobileUrl}');
                            background-position: ${getBackgroundPosition(tabletAlignment)};
                        }
                    }
                    
                    @media (min-width: ${tabletWidth}px) {
                        .header-widget .header-image {
                            height: ${height}px;
                            background-image: url('${desktopUrl || tabletUrl || mobileUrl}');
                            background-position: ${getBackgroundPosition(alignment)};
                        }
                    }
                `}} />
            </div>
        )
    }

    // Preview mode: server-rendered HTML already has optimized images
    if (!image && !tabletImage && !mobileImage) {
        return null
    }

    return (
        <div className="header-widget w-full overflow-hidden relative">
            <div className="header-image w-full" />
            <style dangerouslySetInnerHTML={{
                __html: `
                .header-widget .header-image {
                    width: 100%;
                    height: ${mobileHeight}px;
                    background-image: url('${mobileUrl}');
                    background-size: cover;
                    background-position: ${getBackgroundPosition(mobileAlignment)};
                    background-repeat: no-repeat;
                }
                
                @media (min-width: ${mobileWidth}px) {
                    .header-widget .header-image {
                        height: ${tabletHeight}px;
                        background-image: url('${tabletUrl || mobileUrl}');
                        background-position: ${getBackgroundPosition(tabletAlignment)};
                    }
                }
                
                @media (min-width: ${tabletWidth}px) {
                    .header-widget .header-image {
                        height: ${height}px;
                        background-image: url('${desktopUrl || tabletUrl || mobileUrl}');
                        background-position: ${getBackgroundPosition(alignment)};
                    }
                }
            `}} />
        </div>
    )
}

// === COLOCATED METADATA ===
HeaderWidget.displayName = 'HeaderWidget'
HeaderWidget.widgetType = 'easy_widgets.HeaderWidget'

// Default configuration
HeaderWidget.defaultConfig = {
    mobileImage: null,
    mobileWidth: 640,
    mobileHeight: 80,
    mobileAlignment: 'center',
    tabletImage: null,
    tabletWidth: 1024,
    tabletHeight: 112,
    tabletAlignment: 'center',
    image: null,
    width: 1280,
    height: 112,
    alignment: 'center'
}

// Display metadata
HeaderWidget.metadata = {
    name: 'Header',
    description: 'Responsive header with fixed sizes per breakpoint and alignment options',
    category: 'layout',
    icon: ImageIcon,
    tags: ['eceee', 'header', 'image', 'layout', 'responsive']
}

export default HeaderWidget
