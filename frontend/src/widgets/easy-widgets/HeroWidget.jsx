import React, { useState, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { getImgproxyUrlFromImage } from '../../utils/imgproxySecure'

/**
 * EASY Hero Widget Component
 * Hero section with header text, optional before/after text, background image, and customizable colors
 */
const HeroWidget = ({ config = {}, mode = 'preview' }) => {
    // Extract configuration with defaults
    const {
        header = '',
        beforeText = '',
        afterText = '',
        image = null,
        backgroundColor = '#000000',
        textColor = '#ffffff',
        decorColor = '#cccccc',
        componentStyle = 'default'
    } = config

    // State for optimized image URL
    const [backgroundUrl, setBackgroundUrl] = useState('')
    const [imageLoading, setImageLoading] = useState(false)

    // Load optimized background image URL from backend API
    useEffect(() => {
        const loadImage = async () => {
            if (!image) {
                setBackgroundUrl('')
                return
            }

            setImageLoading(true)

            try {
                // Large hero size (1920x1080)
                const url = await getImgproxyUrlFromImage(image, {
                    width: 1920,
                    height: 1080,
                    resizeType: 'fill'
                })
                setBackgroundUrl(url)
            } catch (error) {
                console.error('Failed to load optimized hero image:', error)
            } finally {
                setImageLoading(false)
            }
        }

        loadImage()
    }, [image])

    // Build inline styles
    const containerStyle = {
        position: 'relative',
        padding: '4rem 2rem',
        backgroundColor,
        color: textColor,
        overflow: 'hidden',
        minHeight: '400px',
    }

    const backgroundStyle = image && backgroundUrl ? {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundImage: `url('${backgroundUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        zIndex: 0,
        opacity: 0.8,
    } : null

    const contentStyle = {
        position: 'relative',
        zIndex: 1,
        maxWidth: '1200px',
        margin: '0 auto',
        textAlign: 'center',
    }

    const beforeTextStyle = {
        fontSize: '1.125rem',
        marginBottom: '1rem',
        color: decorColor,
    }

    const headerStyle = {
        fontSize: '3rem',
        fontWeight: '700',
        margin: '1rem 0',
        lineHeight: '1.2',
        color: textColor,
    }

    const afterTextStyle = {
        fontSize: '1.25rem',
        marginTop: '1rem',
        color: textColor,
    }

    // Editor mode: show placeholder if no header
    if (mode === 'editor') {
        if (!header) {
            return (
                <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center text-gray-400" style={{ minHeight: '300px' }}>
                    <Sparkles className="w-12 h-12 mb-2" />
                    <p className="text-sm">No hero header configured</p>
                    <p className="text-xs mt-1">Configure this widget to add hero content</p>
                </div>
            )
        }

        return (
            <div className="hero-widget" style={containerStyle}>
                {imageLoading && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10">
                        Optimizing image...
                    </div>
                )}
                {backgroundStyle && <div style={backgroundStyle} />}
                <div style={contentStyle}>
                    {beforeText && (
                        <div className="before-text" style={beforeTextStyle}>
                            {beforeText}
                        </div>
                    )}
                    <h1 style={headerStyle}>{header}</h1>
                    {afterText && (
                        <div className="after-text" style={afterTextStyle}>
                            {afterText}
                        </div>
                    )}
                </div>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media (max-width: 768px) {
                        .hero-widget {
                            padding: 2rem 1rem !important;
                        }
                        .hero-widget h1 {
                            font-size: 2rem !important;
                        }
                        .hero-widget .before-text {
                            font-size: 1rem !important;
                        }
                        .hero-widget .after-text {
                            font-size: 1.125rem !important;
                        }
                    }
                `}} />
            </div>
        )
    }

    // Preview mode
    if (!header) {
        return null
    }

    return (
        <div className="hero-widget" style={containerStyle}>
            {backgroundStyle && <div style={backgroundStyle} />}
            <div style={contentStyle}>
                {beforeText && (
                    <div className="before-text" style={beforeTextStyle}>
                        {beforeText}
                    </div>
                )}
                <h1 style={headerStyle}>{header}</h1>
                {afterText && (
                    <div className="after-text" style={afterTextStyle}>
                        {afterText}
                    </div>
                )}
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                @media (max-width: 768px) {
                    .hero-widget {
                        padding: 2rem 1rem !important;
                    }
                    .hero-widget h1 {
                        font-size: 2rem !important;
                    }
                    .hero-widget .before-text {
                        font-size: 1rem !important;
                    }
                    .hero-widget .after-text {
                        font-size: 1.125rem !important;
                    }
                }
            `}} />
        </div>
    )
}

// === COLOCATED METADATA ===
HeroWidget.displayName = 'HeroWidget'
HeroWidget.widgetType = 'easy_widgets.HeroWidget'

// Default configuration
HeroWidget.defaultConfig = {
    header: '',
    beforeText: '',
    afterText: '',
    image: null,
    backgroundColor: '#000000',
    textColor: '#ffffff',
    decorColor: '#cccccc',
    componentStyle: 'default'
}

// Display metadata
HeroWidget.metadata = {
    name: 'Hero',
    description: 'Hero section with header text, optional before/after text, image, and customizable colors',
    category: 'content',
    icon: Sparkles,
    tags: ['eceee', 'hero', 'header', 'banner', 'layout']
}

export default HeroWidget

