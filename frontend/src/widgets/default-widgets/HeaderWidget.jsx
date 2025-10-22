import React, { useState, useEffect } from 'react'
import { Layout } from 'lucide-react'
import { getImgproxyUrlFromImage } from '../../utils/imgproxySecure'

/**
 * Header Widget Component
 * Renders header content with hero sections, background images, and overlays
 * Uses secure server-side imgproxy URL signing
 */
const HeaderWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        image = null, // MediaFile image object
        content = 'Header content will appear here...',
        background_color = '#ffffff',
        background_image = '', // Legacy: kept for backwards compatibility
        background_size = 'cover',
        background_position = 'center',
        text_color = '#1f2937',
        padding = '2rem 1rem',
        text_align = 'center',
        show_overlay = false,
        overlay_color = 'rgba(0, 0, 0, 0.5)',
        overlay_opacity = 0.5,
        hero_style = false,
        min_height = '',
        css_class = '',
        custom_css = ''
    } = config

    // State for securely generated imgproxy URL
    const [optimizedImageUrl, setOptimizedImageUrl] = useState('')
    const [imageLoading, setImageLoading] = useState(false)

    // Load optimized image URL from backend
    useEffect(() => {
        if (image) {
            // In editor mode, use thumbnail for faster preview
            if (mode === 'editor') {
                const thumbnailUrl = image.thumbnailUrl || image.thumbnail_url || image.imgproxy_base_url || image.file_url
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
                    console.error('Failed to load optimized image:', error)
                    // Fallback to thumbnail or original URL
                    setOptimizedImageUrl(image.thumbnailUrl || image.thumbnail_url || image.imgproxy_base_url || image.file_url || '')
                    setImageLoading(false)
                })
        }
    }, [image, mode])

    // Determine which background image to use
    const backgroundImageUrl = image ? optimizedImageUrl : background_image

    const headerStyle = {
        backgroundColor: background_color,
        backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : 'none',
        backgroundSize: background_size,
        backgroundPosition: background_position,
        backgroundRepeat: 'no-repeat',
        color: text_color,
        padding: padding,
        textAlign: text_align,
        minHeight: min_height || (hero_style ? '60vh' : 'auto'),
        position: 'relative',
        overflow: 'hidden'
    }

    const overlayStyle = show_overlay && backgroundImageUrl ? {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: overlay_color,
        opacity: overlay_opacity,
        zIndex: 0
    } : null

    const contentStyle = {
        position: 'relative',
        zIndex: 1,
        maxWidth: '1200px',
        margin: '0 auto',
        height: '100%',
        display: hero_style ? 'flex' : 'block',
        alignItems: hero_style ? 'center' : 'normal',
        justifyContent: hero_style ? 'center' : 'normal'
    }

    if (mode === 'editor') {
        return (
            <div className="header-widget-editor p-4">
                <header
                    className={`header-widget rounded ${hero_style ? 'hero-header' : ''} ${css_class}`}
                    style={headerStyle}
                >
                    {overlayStyle && <div className="header-overlay" style={overlayStyle}></div>}

                    <div className="header-content" style={contentStyle}>
                        {imageLoading && image && (
                            <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                                Loading optimized image...
                            </div>
                        )}
                        <div dangerouslySetInnerHTML={{ __html: content }} />
                    </div>

                    {custom_css && (
                        <style dangerouslySetInnerHTML={{ __html: custom_css }} />
                    )}
                </header>
            </div>
        )
    }

    // Preview mode: server-rendered HTML already has optimized images
    return (
        <>
            <div dangerouslySetInnerHTML={{ __html: content }} />
        </>
    )
}

// === COLOCATED METADATA ===
HeaderWidget.displayName = 'HeaderWidget'
HeaderWidget.widgetType = 'default_widgets.HeaderWidget'

// Default configuration
HeaderWidget.defaultConfig = {
    image: null, // MediaFile image object (use image picker in editor)
    content: '<h1>Welcome to Our Website</h1><p>Your journey starts here</p>',
    background_color: '#ffffff',
    background_image: '', // Legacy fallback
    background_size: 'cover',
    background_position: 'center',
    text_color: '#1f2937',
    padding: '2rem 1rem',
    text_align: 'center',
    show_overlay: false,
    overlay_color: 'rgba(0, 0, 0, 0.5)',
    overlay_opacity: 0.5,
    hero_style: false,
    min_height: ''
}

// Display metadata
HeaderWidget.metadata = {
    name: 'Header',
    description: 'Website header with hero sections, background images, and overlay support',
    category: 'layout',
    icon: Layout,
    tags: ['header', 'hero', 'banner', 'layout', 'title', 'intro']
}

export default HeaderWidget
