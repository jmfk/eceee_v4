import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Type } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { useEditorContext } from '../../contexts/unified-data/hooks'
import { lookupWidget, hasWidgetContentChanged } from '../../utils/widgetUtils'
import { renderMustache, prepareComponentContext } from '../../utils/mustacheRenderer'
import ComponentStyleRenderer from '../../components/ComponentStyleRenderer'
import { SimpleTextEditorRenderer } from './SimpleTextEditorRenderer'
import { OperationTypes } from '../../contexts/unified-data/types/operations'

/**
 * EASY Headline Widget Component
 * Header text widget for page sections
 */
const HeadlineWidget = ({
    config = {},
    mode = 'preview',
    widgetId = null,
    slotName = null,
    onConfigChange = null,
    context,
    widgetPath = []
}) => {
    const pageId = context?.pageId

    // Get current theme for component styles
    const { currentTheme } = useTheme({ pageId })

    // Use configRef for stable reference (prevents callback recreation issues)
    const configRef = useRef(config)
    const [, forceRerender] = useState({})
    const setConfig = (newConfig) => {
        configRef.current = newConfig
    }

    // UDC Integration
    const { useExternalChanges, getState, publishUpdate } = useUnifiedData()
    const componentId = useMemo(() => `headlinewidget-${widgetId || 'preview'}`, [widgetId])
    const fieldComponentId = useMemo(() => `field-${widgetId || 'preview'}-content`, [widgetId])
    const contextType = useEditorContext()

    // Refs for editor renderer
    const contentEditorRef = useRef(null)
    const contentContainerRef = useRef(null)

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

    // Subscribe to external changes via UDC (widget-level)
    useExternalChanges(componentId, (state) => {
        if (!widgetId || !slotName) return
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newConfig = widget?.config
        if (newConfig && hasWidgetContentChanged(configRef.current, newConfig)) {
            setConfig(newConfig)
            forceRerender({})
        }
    })

    // Subscribe to field-level updates for content field (from form field)
    useExternalChanges(fieldComponentId, (state, metadata) => {
        if (!widgetId || !slotName) {
            return
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newContent = widget?.config?.content

        // Check if update came from this widget's WYSIWYG (self-update)
        const sourceId = metadata?.sourceId || ''
        const isSelfUpdate = sourceId === componentId || sourceId === fieldComponentId

        if (newContent !== undefined && newContent !== configRef.current.content && !isSelfUpdate) {
            // External update (from form field) - update WYSIWYG editor
            if (contentEditorRef.current) {
                contentEditorRef.current.updateConfig({ content: newContent })
            }
            // Also update our config ref
            setConfig({ ...configRef.current, content: newContent })
        }
    })

    // Content change handler - use configRef for stable reference
    const handleContentChange = useCallback((newContent) => {
        if (widgetId && slotName) {
            const updatedConfig = { ...configRef.current, content: newContent }
            setConfig(updatedConfig)

            // Publish to field-level path for form field sync
            const fieldSourceId = `${componentId}-field-content`
            publishUpdate(fieldSourceId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                config: { content: newContent },
                widgetPath: widgetPath.length > 0 ? widgetPath : undefined,
                slotName: slotName,
                contextType: contextType
            })

            if (onConfigChange) {
                onConfigChange(updatedConfig)
            }
        }
    }, [fieldComponentId, widgetId, slotName, publishUpdate, contextType, widgetPath, onConfigChange])

    // Initialize editor in editor mode
    useEffect(() => {
        if (mode === 'editor') {
            if (contentContainerRef.current && !contentEditorRef.current) {
                // Use SimpleTextEditorRenderer with inline-rich mode (same as Banner header mode)
                contentEditorRef.current = new SimpleTextEditorRenderer(contentContainerRef.current, {
                    content: configRef.current.content || '',
                    mode: 'inline-rich',
                    onChange: handleContentChange,
                    placeholder: 'Enter headline...',
                    element: 'h2',
                    allowedButtons: ['bold', 'italic', 'link']
                })
                contentEditorRef.current.render()
            }
        }

        return () => {
            if (contentEditorRef.current) {
                contentEditorRef.current.destroy()
                contentEditorRef.current = null
            }
        }
    }, [mode])

    // Update onChange callback when handler changes
    useEffect(() => {
        if (mode === 'editor') {
            if (contentEditorRef.current) {
                contentEditorRef.current.updateConfig({ onChange: handleContentChange })
            }
        }
    }, [handleContentChange, mode])

    // Update editor content when config changes externally (from UDC/widget form)
    useEffect(() => {
        if (mode === 'editor') {
            if (contentEditorRef.current) {
                contentEditorRef.current.updateConfig({
                    content: configRef.current.content || ''
                })
            }
        }
    }, [configRef.current.content, mode])

    // Check if using component style with Mustache template
    const componentStyle = configRef.current.componentStyle || 'default'
    const useCustomStyle = componentStyle && componentStyle !== 'default' && currentTheme?.componentStyles

    if (useCustomStyle) {
        const style = currentTheme.componentStyles[componentStyle]

        if (style) {
            try {
                // Check for passthru mode
                const isPassthru = style.template?.trim() === '{{passthru}}'

                if (!isPassthru) {
                    // Prepare context for Mustache rendering
                    const mustacheContext = prepareComponentContext(
                        configRef.current.content || '',
                        configRef.current.anchor || '',
                        style.variables || {},
                        configRef.current
                    )

                    // Use ComponentStyleRenderer for consistent scoped rendering
                    const styleId = `headline-${widgetId || 'preview'}-${componentStyle}`

                    return (
                        <ComponentStyleRenderer
                            template={style.template}
                            context={mustacheContext}
                            css={style.css}
                            styleId={styleId}
                            className=""
                        />
                    )
                }

                // Passthru mode: render default with custom CSS
                const styleId = `headline-${widgetId || 'preview'}-${componentStyle}`

                return (
                    <div data-style-id={styleId}>
                        {style.css && <style>{`[data-style-id="${styleId}"] { ${style.css} }`}</style>}
                        {renderDefaultHeadline()}
                    </div>
                )
            } catch (error) {
                console.error('Error rendering custom component style:', error)
                return (
                    <div>
                        <div className="text-red-500 text-sm p-2">Error rendering custom style</div>
                    </div>
                )
            }
        }
    }

    // Default rendering helper function
    function renderDefaultHeadline() {
        if (mode === 'editor') {
            return (
                <div
                    className="headline-widget widget-type-easy-widgets-headlinewidget container cms-content"
                    id={configRef.current.anchor || undefined}
                >
                    <div className="headline-content" ref={contentContainerRef}>
                        {/* Editor will be initialized here */}
                    </div>
                </div>
            )
        }

        return (
            <div
                className="headline-widget widget-type-easy-widgets-headlinewidget container cms-content"
                id={configRef.current.anchor || undefined}
            >
                <div className="headline-content">
                    <div dangerouslySetInnerHTML={{ __html: configRef.current.content || '' }} />
                </div>
            </div>
        )
    }

    // Default rendering (no custom style)
    const hasContent = configRef.current.content

    if (mode === 'editor') {
        return (
            <div className="headline-widget-editor">
                {renderDefaultHeadline()}
            </div>
        )
    }

    // Preview mode
    if (!hasContent) {
        return (
            <div className="headline-widget">
                <div className="bg-gray-200 h-24 flex items-center justify-center text-gray-500">
                    <Type className="h-8 w-8 mr-2" />
                    No headline
                </div>
            </div>
        )
    }

    return renderDefaultHeadline()
}

// === COLOCATED METADATA ===
HeadlineWidget.displayName = 'HeadlineWidget'
HeadlineWidget.widgetType = 'easy_widgets.HeadlineWidget'

// Default configuration
HeadlineWidget.defaultConfig = {
    anchor: '',
    content: '',
    componentStyle: 'default',
    showBorder: true
}

// Display metadata
HeadlineWidget.metadata = {
    name: 'Headline',
    description: 'Header text widget for page sections',
    category: 'content',
    icon: Type,
    tags: ['eceee', 'headline', 'header', 'content']
}

export default HeadlineWidget

