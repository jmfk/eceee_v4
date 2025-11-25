import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { getImgproxyUrlFromImage } from '../../utils/imgproxySecure'
import { SimpleTextEditorRenderer } from './SimpleTextEditorRenderer'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'

/**
 * EASY Hero Widget Component
 * Hero section with header text, optional before/after text, background image, and customizable colors
 */
const HeroWidget = ({
    config = {},
    mode = 'preview',
    widgetId = null,
    slotName = null,
    onConfigChange = null,
    widgetPath = []
}) => {
    // Use configRef for stable reference (prevents callback recreation issues)
    const configRef = useRef(config)
    const [, forceRerender] = useState({})
    const setConfig = (newConfig) => {
        configRef.current = newConfig
    }

    // State for optimized image URL
    const [backgroundUrl, setBackgroundUrl] = useState('')
    const [imageLoading, setImageLoading] = useState(false)

    // UDC Integration
    const { publishUpdate, getState, useExternalChanges } = useUnifiedData()
    const contextType = useEditorContext()
    const componentId = useMemo(() => `herowidget-${widgetId || 'preview'}`, [widgetId])

    // Extract configuration with defaults from configRef
    const {
        header = '',
        beforeText = '',
        afterText = '',
        image = null,
        backgroundColor = '#000000',
        textColor = '#ffffff',
        decorColor = '#cccccc',
        componentStyle = 'default'
    } = configRef.current

    // Refs for editor renderers
    const headerEditorRef = useRef(null)
    const beforeTextEditorRef = useRef(null)
    const afterTextEditorRef = useRef(null)
    const headerContainerRef = useRef(null)
    const beforeTextContainerRef = useRef(null)
    const afterTextContainerRef = useRef(null)

    // Initialize from UDC state on mount
    useEffect(() => {
        if (!widgetId || !slotName) {
            return
        }
        const currentState = getState()
        const widget = lookupWidget(currentState, widgetId, slotName, contextType, widgetPath)
        const udcConfig = widget?.config
        if (udcConfig && hasWidgetContentChanged(configRef.current, udcConfig)) {
            setConfig(udcConfig)
            forceRerender({})
        }
    }, [])

    // Subscribe to external changes via UDC
    useExternalChanges(componentId, (state) => {
        if (!widgetId || !slotName) return
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newConfig = widget?.config
        if (newConfig && hasWidgetContentChanged(configRef.current, newConfig)) {
            setConfig(newConfig)
            forceRerender({})
        }
    })

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

    // Build inline styles with CSS variables
    const heroStyle = {
        '--hero-text-color': textColor,
        '--hero-decor-color': decorColor,
        '--hero-bg-color': backgroundColor,
    }

    const backgroundStyle = image && backgroundUrl ? {
        backgroundImage: `url('${backgroundUrl}')`,
    } : null

    // Content change handlers - use configRef for stable references
    const handleHeaderChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const updatedConfig = { ...configRef.current, header: newContent }
            setConfig(updatedConfig)
            publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: updatedConfig,
                widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
                slotName: slotName,
                contextType: contextType
            })
            if (onConfigChange) {
                onConfigChange(updatedConfig)
            }
        }
    }, [componentId, widgetId, slotName, publishUpdate, contextType, widgetPath, onConfigChange])

    const handleBeforeTextChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const updatedConfig = { ...configRef.current, beforeText: newContent }
            setConfig(updatedConfig)
            publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: updatedConfig,
                widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
                slotName: slotName,
                contextType: contextType
            })
            if (onConfigChange) {
                onConfigChange(updatedConfig)
            }
        }
    }, [componentId, widgetId, slotName, publishUpdate, contextType, widgetPath, onConfigChange])

    const handleAfterTextChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const updatedConfig = { ...configRef.current, afterText: newContent }
            setConfig(updatedConfig)
            publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: updatedConfig,
                widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
                slotName: slotName,
                contextType: contextType
            })
            if (onConfigChange) {
                onConfigChange(updatedConfig)
            }
        }
    }, [componentId, widgetId, slotName, publishUpdate, contextType, widgetPath, onConfigChange])

    // Initialize editors in editor mode (only once)
    useEffect(() => {
        if (mode === 'editor') {
            // Initialize header editor
            if (headerContainerRef.current && !headerEditorRef.current) {
                headerEditorRef.current = new SimpleTextEditorRenderer(headerContainerRef.current, {
                    content: configRef.current.header,
                    mode: 'text-only',
                    onChange: handleHeaderChange,
                    placeholder: 'Enter hero header...',
                    element: 'h1'
                })
                headerEditorRef.current.render()
            }

            // Initialize beforeText editor if needed
            if (beforeTextContainerRef.current && !beforeTextEditorRef.current) {
                beforeTextEditorRef.current = new SimpleTextEditorRenderer(beforeTextContainerRef.current, {
                    content: configRef.current.beforeText,
                    mode: 'text-only',
                    onChange: handleBeforeTextChange,
                    placeholder: 'Enter text before header...',
                    element: 'h5'
                })
                beforeTextEditorRef.current.render()
            }

            // Initialize afterText editor if needed
            if (afterTextContainerRef.current && !afterTextEditorRef.current) {
                afterTextEditorRef.current = new SimpleTextEditorRenderer(afterTextContainerRef.current, {
                    content: configRef.current.afterText,
                    mode: 'text-only',
                    onChange: handleAfterTextChange,
                    placeholder: 'Enter text after header...',
                    element: 'h6'
                })
                afterTextEditorRef.current.render()
            }
        }

        return () => {
            if (headerEditorRef.current) {
                headerEditorRef.current.destroy()
                headerEditorRef.current = null
            }
            if (beforeTextEditorRef.current) {
                beforeTextEditorRef.current.destroy()
                beforeTextEditorRef.current = null
            }
            if (afterTextEditorRef.current) {
                afterTextEditorRef.current.destroy()
                afterTextEditorRef.current = null
            }
        }
    }, [mode])

    // Update onChange callbacks when handlers change
    useEffect(() => {
        if (mode === 'editor') {
            if (headerEditorRef.current) {
                headerEditorRef.current.updateConfig({ onChange: handleHeaderChange })
            }
            if (beforeTextEditorRef.current) {
                beforeTextEditorRef.current.updateConfig({ onChange: handleBeforeTextChange })
            }
            if (afterTextEditorRef.current) {
                afterTextEditorRef.current.updateConfig({ onChange: handleAfterTextChange })
            }
        }
    }, [handleHeaderChange, handleBeforeTextChange, handleAfterTextChange, mode])

    // Update editor content when config changes externally (from UDC/widget form)
    useEffect(() => {
        if (mode === 'editor') {
            if (headerEditorRef.current) {
                headerEditorRef.current.updateConfig({ content: header, onChange: handleHeaderChange })
            }
            if (beforeTextEditorRef.current) {
                beforeTextEditorRef.current.updateConfig({ content: beforeText, onChange: handleBeforeTextChange })
            }
            if (afterTextEditorRef.current) {
                afterTextEditorRef.current.updateConfig({ content: afterText, onChange: handleAfterTextChange })
            }
        }
    }, [header, beforeText, afterText, mode, handleHeaderChange, handleBeforeTextChange, handleAfterTextChange])

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
            <div className="hero-widget widget-type-easy-widgets-herowidget cms-content" style={heroStyle}>
                {imageLoading && (
                    <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10">
                        Optimizing image...
                    </div>
                )}
                {backgroundStyle && <div className="hero-background" style={backgroundStyle} />}
                <div className="hero-content">
                    <div className="before-text" ref={beforeTextContainerRef} />
                    <div ref={headerContainerRef} />
                    <div className="after-text" ref={afterTextContainerRef} />
                </div>
            </div>
        )
    }

    // Preview mode
    if (!header) {
        return null
    }

    return (
        <div className="hero-widget widget-type-easy-widgets-herowidget cms-content" style={heroStyle}>
            {backgroundStyle && <div className="hero-background" style={backgroundStyle} />}
            <div className="hero-content">
                {beforeText && (
                    <h5 className="before-text">
                        {beforeText}
                    </h5>
                )}
                <div><h1>{header}</h1></div>
                {afterText && (
                    <h6 className="after-text">
                        {afterText}
                    </h6>
                )}
            </div>
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

