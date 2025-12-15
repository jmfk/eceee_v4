import React from 'react'
import { Image as ImageIcon } from 'lucide-react'

/**
 * EASY Header Widget Component
 * Responsive header widget with configurable breakpoints
 * - Each breakpoint has: image, width (min-width), and height
 * - Breakpoints are automatically sorted by width for proper CSS media query ordering
 * - Uses original images as-is, CSS handles clipping/overflow
 * - Defaults to three breakpoints: Mobile (640px), Tablet (1024px), Desktop (1280px)
 */
const HeaderWidget = ({ config = {}, mode = 'preview' }) => {
    // Extract configuration with defaults
    const { breakpoints = [] } = config

    // Helper function to extract original URL from image object
    const getImageUrl = (imageObj) => {
        if (!imageObj) return ''
        return imageObj.imgproxyBaseUrl || imageObj.fileUrl || imageObj.imgproxy_base_url || imageObj.file_url || ''
    }

    // Handle migration from old format to new format
    let processedBreakpoints = breakpoints
    if (!processedBreakpoints || processedBreakpoints.length === 0) {
        // Check for old format fields
        const { mobileImage, mobileWidth = 640, mobileHeight = 80, tabletImage, tabletWidth = 1024, tabletHeight = 112, image, width = 1280, height = 112 } = config
        
        if (mobileWidth || mobileImage || tabletWidth || tabletImage || width || image) {
            processedBreakpoints = []
            if (mobileWidth || mobileImage) {
                processedBreakpoints.push({ image: mobileImage, width: mobileWidth, height: mobileHeight })
            }
            if (tabletWidth || tabletImage) {
                processedBreakpoints.push({ image: tabletImage, width: tabletWidth, height: tabletHeight })
            }
            if (width || image) {
                processedBreakpoints.push({ image, width, height })
            }
        }
        
        // If still empty, use defaults
        if (!processedBreakpoints || processedBreakpoints.length === 0) {
            processedBreakpoints = [
                { image: null, width: 640, height: 80 },
                { image: null, width: 1024, height: 112 },
                { image: null, width: 1280, height: 112 }
            ]
        }
    }

    // Sort breakpoints by width (ascending) for proper CSS media query ordering
    const sortedBreakpoints = [...processedBreakpoints].sort((a, b) => (a.width || 0) - (b.width || 0))

    // Build image fallback chain (each breakpoint falls back to previous)
    let lastImage = null
    const breakpointsWithFallback = sortedBreakpoints.map(bp => {
        const image = bp.image || lastImage
        if (bp.image) {
            lastImage = bp.image
        }
        return {
            ...bp,
            image,
            width: bp.width || 640,
            height: bp.height || 80
        }
    })

    // Check if any breakpoint has an image
    const hasAnyImage = breakpointsWithFallback.some(bp => bp.image)

    // Generate CSS dynamically
    const generateCSS = () => {
        if (breakpointsWithFallback.length === 0) return ''

        const cssParts = []
        
        // Base styles (first/smallest breakpoint)
        const firstBp = breakpointsWithFallback[0]
        const firstUrl = getImageUrl(firstBp.image)
        
        cssParts.push(`
            .header-widget .header-image {
                width: 100%;
                height: ${firstBp.height}px;
                background-image: ${firstUrl ? `url('${firstUrl}')` : 'none'};
                background-size: cover;
                background-repeat: no-repeat;
                background-position: center center;
            }`)

        // Media queries for subsequent breakpoints
        for (let i = 1; i < breakpointsWithFallback.length; i++) {
            const bp = breakpointsWithFallback[i]
            const url = getImageUrl(bp.image)
            
            cssParts.push(`
            @media (min-width: ${bp.width}px) {
                .header-widget .header-image {
                    height: ${bp.height}px;
                    background-image: ${url ? `url('${url}')` : 'none'};
                    aspect-ratio: auto;
                    background-size: auto 100%;
                    background-position: top left;
                }
            }`)
        }

        return cssParts.join('\n')
    }

    // Editor mode: show placeholder if no image
    if (mode === 'editor') {
        if (!hasAnyImage) {
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
                <style dangerouslySetInnerHTML={{ __html: generateCSS() }} />
            </div>
        )
    }

    // Preview mode: server-rendered HTML already has optimized images
    if (!hasAnyImage) {
        return null
    }

    return (
        <div className="header-widget w-full overflow-hidden relative">
            <div className="header-image w-full" />
            <style dangerouslySetInnerHTML={{ __html: generateCSS() }} />
        </div>
    )
}

// === COLOCATED METADATA ===
HeaderWidget.displayName = 'HeaderWidget'
HeaderWidget.widgetType = 'easy_widgets.HeaderWidget'

// Default configuration
HeaderWidget.defaultConfig = {
    breakpoints: [
        { image: null, width: 640, height: 80 },   // Mobile
        { image: null, width: 1024, height: 112 }, // Tablet
        { image: null, width: 1280, height: 112 }  // Desktop
    ]
}

// Display metadata
HeaderWidget.metadata = {
    name: 'Header',
    description: 'Responsive header with configurable breakpoints (image, width, height)',
    category: 'layout',
    icon: ImageIcon,
    tags: ['eceee', 'header', 'image', 'layout', 'responsive']
}

export default HeaderWidget
