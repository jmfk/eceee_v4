import React from 'react'
import { Image as ImageIcon } from 'lucide-react'

/**
 * EASY Header Widget Component
 * Responsive header widget with fixed sizes per breakpoint
 * - Mobile: 640x80px (default)
 * - Tablet: 1024x112px (default)
 * - Desktop: 1280x112px (default)
 * - Uses original images as-is, CSS handles clipping/overflow
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

    // Helper function to extract original URL from image object
    const getImageUrl = (imageObj) => {
        if (!imageObj) return ''
        return imageObj.imgproxyBaseUrl || imageObj.fileUrl || imageObj.imgproxy_base_url || imageObj.file_url || ''
    }

    // Get original image URLs directly (no resizing)
    const desktopUrl = getImageUrl(image)
    const tabletUrl = getImageUrl(tabletImage) || desktopUrl
    const mobileUrl = getImageUrl(mobileImage) || tabletUrl || desktopUrl

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
                <div className="header-image w-full" />
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .header-widget .header-image {
                        width: 100%;
                        height: ${mobileHeight}px;
                        background-image: ${mobileUrl ? `url('${mobileUrl}')` : 'none'};
                        background-size: cover;
                        background-position: ${getBackgroundPosition(mobileAlignment)};
                        background-repeat: no-repeat;
                    }
                    
                    @media (min-width: ${mobileWidth}px) {
                        .header-widget .header-image {
                            height: ${tabletHeight}px;
                            background-image: ${tabletUrl ? `url('${tabletUrl}')` : 'none'};
                            background-position: ${getBackgroundPosition(tabletAlignment)};
                        }
                    }
                    
                    @media (min-width: ${tabletWidth}px) {
                        .header-widget .header-image {
                            height: ${height}px;
                            background-image: ${desktopUrl ? `url('${desktopUrl}')` : 'none'};
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
                    background-image: ${mobileUrl ? `url('${mobileUrl}')` : 'none'};
                    background-size: cover;
                    background-position: ${getBackgroundPosition(mobileAlignment)};
                    background-repeat: no-repeat;
                }
                
                @media (min-width: ${mobileWidth}px) {
                    .header-widget .header-image {
                        height: ${tabletHeight}px;
                        background-image: ${tabletUrl ? `url('${tabletUrl}')` : 'none'};
                        background-position: ${getBackgroundPosition(tabletAlignment)};
                    }
                }
                
                @media (min-width: ${tabletWidth}px) {
                    .header-widget .header-image {
                        height: ${height}px;
                        background-image: ${desktopUrl ? `url('${desktopUrl}')` : 'none'};
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
