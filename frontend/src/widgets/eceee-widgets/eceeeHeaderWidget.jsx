import React from 'react'
import { Layout } from 'lucide-react'

/**
 * ECEEE Header Widget Component
 * Renders header content with hero sections, background images, and overlays
 */
const eceeeHeaderWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        content = 'Header content will appear here...',
        background_color = '#ffffff',
        background_image = '',
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

    const headerStyle = {
        backgroundColor: background_color,
        backgroundImage: background_image ? `url(${background_image})` : 'none',
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

    const overlayStyle = show_overlay && background_image ? {
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
            <div dangerouslySetInnerHTML={{ __html: content }} />
        )
    }

    return (
        <>
            <div dangerouslySetInnerHTML={{ __html: content }} />
        </>
    )
}

// === COLOCATED METADATA ===
eceeeHeaderWidget.displayName = 'HeaderWidget'
eceeeHeaderWidget.widgetType = 'eceee_widgets.HeaderWidget'

// Default configuration
eceeeHeaderWidget.defaultConfig = {
    content: '<h1>Welcome to Our Website</h1><p>Your journey starts here</p>',
    background_color: '#ffffff',
    background_image: '',
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
eceeeHeaderWidget.metadata = {
    name: 'HeaderWidget',
    description: 'Website header with hero sections, background images, and overlay support',
    category: 'layout',
    icon: Layout,
    tags: ['eceee', 'header', 'hero', 'banner', 'layout', 'title', 'intro']
}

export default eceeeHeaderWidget
