import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Monitor, Grid3X3, Eye, EyeOff, Palette, Code, AlertTriangle } from 'lucide-react'
import cssInjectionManager from '../utils/cssInjectionManager'

/**
 * Enhanced LayoutRenderer Component
 * 
 * Advanced layout renderer with comprehensive CSS injection capabilities:
 * - Dynamic CSS injection with scoping and validation
 * - Widget-specific CSS support
 * - Page-specific CSS overrides
 * - Real-time CSS updates
 * - Performance optimization with caching
 * - Security validation and sanitization
 */
const EnhancedLayoutRenderer = ({
    layout,
    theme,
    widgetsBySlot = {},
    pageData = {},
    showInheritance = false,
    mode = 'preview',
    pageTitle,
    pageDescription,
    onWidgetEdit,
    onWidgetAdd,
    onSlotClick,
    className = '',
    showSlotHeaders = true,
    showEmptySlots = true,
    enableCSSInjection = true,
    cssValidationErrors = [],
    onCSSError,
    children
}) => {
    const containerRef = useRef()
    const [cssErrors, setCSSErrors] = useState([])
    const [injectedStyles, setInjectedStyles] = useState(new Set())
    const [cssDebugInfo, setCSSDebugInfo] = useState(null)

    // Generate unique scope ID for this renderer instance
    const scopeId = useMemo(() =>
        cssInjectionManager.generateScopeId({
            pageId: pageData?.id,
            type: 'layout-renderer'
        }), [pageData?.id]
    )

    // CSS injection effect
    useEffect(() => {
        if (!enableCSSInjection) return

        const errors = []
        const injectedIds = new Set()

        // Inject theme CSS
        if (theme?.custom_css) {
            const themeId = `theme-${theme.id}`
            const success = cssInjectionManager.injectCSS({
                css: theme.custom_css,
                id: themeId,
                scopeType: 'global',
                context: `Theme: ${theme.name}`,
                priority: 'high'
            })

            if (success) {
                injectedIds.add(themeId)
            } else {
                errors.push(`Failed to inject theme CSS: ${theme.name}`)
            }
        }

        // Inject layout CSS
        if (layout?.css_classes) {
            const layoutId = `layout-${layout.name}`
            const success = cssInjectionManager.injectCSS({
                css: layout.css_classes,
                id: layoutId,
                scopeId: scopeId,
                scopeType: 'widget',
                context: `Layout: ${layout.name}`,
                priority: 'high'
            })

            if (success) {
                injectedIds.add(layoutId)
            } else {
                errors.push(`Failed to inject layout CSS: ${layout.name}`)
            }
        }

        // Inject page-specific CSS
        if (pageData?.page_custom_css) {
            const pageId = `page-${pageData.id}`
            const success = cssInjectionManager.injectCSS({
                css: pageData.page_custom_css,
                id: pageId,
                scopeId: scopeId,
                scopeType: 'page',
                context: `Page: ${pageData.title}`,
                priority: 'normal'
            })

            if (success) {
                injectedIds.add(pageId)
            } else {
                errors.push(`Failed to inject page CSS: ${pageData.title}`)
            }
        }

        // Inject widget-specific CSS
        Object.entries(widgetsBySlot).forEach(([slotName, widgets]) => {
            widgets.forEach((widgetData) => {
                const { widget } = widgetData

                // Check if widget has CSS to inject
                if (widget.css_data?.widget_css) {
                    const widgetScopeId = cssInjectionManager.generateScopeId({
                        widgetId: widget.id,
                        pageId: pageData?.id,
                        slotName: slotName
                    })

                    const widgetId = `widget-${widget.id}`
                    const success = cssInjectionManager.injectCSS({
                        css: widget.css_data.widget_css,
                        id: widgetId,
                        scopeId: widgetScopeId,
                        scopeType: widget.css_data.scope || 'widget',
                        context: `Widget: ${widget.widget_type?.name}`,
                        priority: 'normal'
                    })

                    if (success) {
                        injectedIds.add(widgetId)
                    } else {
                        errors.push(`Failed to inject widget CSS: ${widget.widget_type?.name}`)
                    }
                }
            })
        })

        // Update state
        setInjectedStyles(injectedIds)
        setCSSErrors(errors)

        // Report errors
        if (errors.length > 0 && onCSSError) {
            onCSSError(errors)
        }

        // Cleanup function
        return () => {
            injectedIds.forEach(id => cssInjectionManager.removeCSS(id))
        }
    }, [theme, layout, widgetsBySlot, pageData, enableCSSInjection, scopeId, onCSSError])

    // Apply CSS variables (enhanced version)
    const getThemeStyles = useCallback(() => {
        const themeStyles = {}

        // Theme CSS variables
        if (theme?.css_variables) {
            Object.entries(theme.css_variables).forEach(([key, value]) => {
                const cssVar = key.startsWith('--') ? key : `--${key}`
                themeStyles[cssVar] = value
            })
        }

        // Page-specific CSS variables (override theme)
        if (pageData?.page_css_variables) {
            Object.entries(pageData.page_css_variables).forEach(([key, value]) => {
                const cssVar = key.startsWith('--') ? key : `--${key}`
                themeStyles[cssVar] = value
            })
        }

        return themeStyles
    }, [theme, pageData])

    // Enhanced widget preview with CSS support
    const WidgetPreview = ({ widgetData, showInheritance, slotName }) => {
        const { widget, inherited_from, is_override } = widgetData
        const widgetRef = useRef()

        // Generate widget-specific scope ID
        const widgetScopeId = useMemo(() =>
            cssInjectionManager.generateScopeId({
                widgetId: widget.id,
                pageId: pageData?.id,
                slotName: slotName
            }), [widget.id, pageData?.id, slotName]
        )

        // Apply widget scope class
        useEffect(() => {
            if (widgetRef.current && widget.css_data?.scope !== 'global') {
                widgetRef.current.classList.add(widgetScopeId)
            }
        }, [widgetScopeId, widget.css_data])

        const renderWidgetContent = () => {
            // Enhanced widget content rendering based on type
            switch (widget.widget_type?.name) {
                case 'TextBlock':
                case 'Text Block':
                    return (
                        <div className="prose max-w-none">
                            {widget.configuration?.title && (
                                <h3 className="text-lg font-semibold mb-2">
                                    {widget.configuration.title}
                                </h3>
                            )}
                            <div
                                className={`text-${widget.configuration?.alignment || 'left'} ${widget.configuration?.style === 'bold' ? 'font-bold' :
                                        widget.configuration?.style === 'italic' ? 'italic' : ''
                                    }`}
                            >
                                {widget.configuration?.content || 'Sample text content'}
                            </div>
                        </div>
                    )

                case 'Button':
                    return (
                        <button
                            className={`px-4 py-2 rounded-lg text-white ${widget.configuration?.style === 'secondary' ? 'bg-gray-600' : 'bg-blue-600'
                                }`}
                            disabled
                        >
                            {widget.configuration?.text || 'Sample Button'}
                        </button>
                    )

                case 'Image':
                    return (
                        <div className="bg-gray-200 rounded-lg p-8 text-center">
                            <div className="text-gray-500">
                                📷 {widget.configuration?.alt_text || 'Sample Image'}
                            </div>
                            {widget.configuration?.caption && (
                                <p className="text-sm text-gray-600 mt-2">
                                    {widget.configuration.caption}
                                </p>
                            )}
                        </div>
                    )

                default:
                    return (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                            <div className="text-sm font-medium text-blue-900">
                                {widget.widget_type?.name || 'Unknown'} Widget
                            </div>
                            <div className="text-xs text-blue-700 mt-1">
                                Widget content would appear here
                            </div>
                            {widget.css_data && (
                                <div className="text-xs text-purple-600 mt-1">
                                    ✨ Enhanced with custom CSS
                                </div>
                            )}
                        </div>
                    )
            }
        }

        const renderInheritanceInfo = () => {
            if (!showInheritance || !inherited_from) return null

            return (
                <div className="mt-2 pt-2 border-t border-orange-200">
                    <div className="flex items-center text-xs text-orange-600">
                        <Eye className="w-3 h-3 mr-1" />
                        <span>Inherited from: {inherited_from.title}</span>
                        {is_override && (
                            <span className="ml-2 text-red-600">(Override)</span>
                        )}
                    </div>
                </div>
            )
        }

        return (
            <div
                ref={widgetRef}
                className={`
                    widget-preview p-3 mb-3 rounded-lg border transition-colors
                    ${inherited_from ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'}
                    ${!widget.is_visible ? 'opacity-60' : ''}
                    ${mode === 'edit' ? 'hover:shadow-md cursor-pointer' : ''}
                    ${widget.css_data ? 'ring-1 ring-purple-200' : ''}
                `}
                onClick={mode === 'edit' ? () => onWidgetEdit?.(widget) : undefined}
                role={mode === 'edit' ? 'button' : undefined}
                tabIndex={mode === 'edit' ? 0 : -1}
                data-widget-id={widget.id}
                data-widget-type={widget.widget_type?.name}
            >
                {renderWidgetContent()}
                {renderInheritanceInfo()}

                {/* CSS debug info in development */}
                {process.env.NODE_ENV === 'development' && widget.css_data && (
                    <div className="mt-2 p-2 bg-purple-50 rounded text-xs">
                        <div className="font-mono text-purple-700">
                            CSS Scope: {widgetScopeId}
                        </div>
                        {widget.css_data.widget_css && (
                            <div className="text-purple-600 mt-1">
                                CSS Rules: {(widget.css_data.widget_css.match(/\{/g) || []).length}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // Enhanced slot rendering
    const renderSlot = (slot, index) => {
        const slotWidgets = widgetsBySlot[slot.name] || []
        const slotScopeId = cssInjectionManager.generateScopeId({
            pageId: pageData?.id,
            slotName: slot.name
        })

        return (
            <div
                key={slot.name || index}
                className={`layout-slot mb-4 ${slot.css_classes || ''} ${slotScopeId}`}
                data-slot={slot.name}
                data-slot-scope={slotScopeId}
                onClick={mode === 'edit' ? () => onSlotClick?.(slot) : undefined}
                role={mode === 'edit' && onSlotClick ? 'button' : undefined}
                tabIndex={mode === 'edit' && onSlotClick ? 0 : -1}
            >
                {showSlotHeaders && (
                    <div className="slot-header mb-2 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-gray-700">
                                {slot.title || slot.name}
                            </h4>
                            {slot.css_classes && (
                                <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">
                                    Styled
                                </span>
                            )}
                        </div>

                        {mode === 'edit' && (
                            <div className="flex items-center space-x-1">
                                <span className="text-xs text-gray-500">
                                    {slotWidgets.length} widget{slotWidgets.length !== 1 ? 's' : ''}
                                </span>
                                {slot.max_widgets && (
                                    <span className="text-xs text-gray-400">
                                        (max: {slot.max_widgets})
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="slot-content">
                    {slotWidgets.length > 0 ? (
                        slotWidgets.map((widgetData, widgetIndex) => (
                            <WidgetPreview
                                key={widgetData.widget?.id || widgetIndex}
                                widgetData={widgetData}
                                showInheritance={showInheritance}
                                slotName={slot.name}
                            />
                        ))
                    ) : showEmptySlots ? (
                        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
                            <Grid3X3 className="w-6 h-6 mx-auto mb-2" />
                            <div className="text-sm">No widgets in this slot</div>
                            <div className="text-xs mt-1">
                                {mode === 'edit' ? 'Click "Add Widget" to get started' : 'Widgets would appear here'}
                            </div>
                            {mode === 'edit' && onWidgetAdd && (
                                <button
                                    onClick={() => onWidgetAdd(slot)}
                                    className="mt-2 px-3 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                                >
                                    Add Widget
                                </button>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        )
    }

    // Enhanced layout structure rendering
    const renderLayout = () => {
        if (!layout) {
            return (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
                    <Monitor className="w-8 h-8 mx-auto mb-2" />
                    <div className="text-sm">No layout selected</div>
                    <div className="text-xs mt-1">Choose a layout to see the structure</div>
                </div>
            )
        }

        const slots = layout.slot_configuration?.slots || []

        if (slots.length === 0) {
            return (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
                    <Grid3X3 className="w-8 h-8 mx-auto mb-2" />
                    <div className="text-sm">Layout has no slots defined</div>
                    <div className="text-xs mt-1">Configure the layout to add slots</div>
                </div>
            )
        }

        return (
            <div className={`page-layout layout-${layout.name?.toLowerCase()} ${scopeId}`}>
                {slots.map(renderSlot)}
            </div>
        )
    }

    // Enhanced page header with CSS info
    const renderPageHeader = () => {
        if (!pageTitle && !pageDescription && !cssErrors.length) return null

        return (
            <header className="mb-6">
                {pageTitle && (
                    <h1
                        className="text-3xl font-bold text-gray-900 mb-2"
                        style={{ color: 'var(--text, #1f2937)' }}
                    >
                        {pageTitle}
                    </h1>
                )}
                {pageDescription && (
                    <p
                        className="text-lg text-gray-600"
                        style={{ color: 'var(--text-muted, #6b7280)' }}
                    >
                        {pageDescription}
                    </p>
                )}

                {/* CSS status indicators */}
                {enableCSSInjection && (
                    <div className="mt-4 flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-1">
                            <Palette className="w-4 h-4 text-purple-500" />
                            <span className="text-gray-600">
                                {injectedStyles.size} CSS {injectedStyles.size === 1 ? 'style' : 'styles'} injected
                            </span>
                        </div>

                        {cssErrors.length > 0 && (
                            <div className="flex items-center space-x-1 text-red-600">
                                <AlertTriangle className="w-4 h-4" />
                                <span>{cssErrors.length} CSS error{cssErrors.length === 1 ? '' : 's'}</span>
                            </div>
                        )}

                        {process.env.NODE_ENV === 'development' && (
                            <button
                                onClick={() => setCSSDebugInfo(cssInjectionManager.getInjectedStyles())}
                                className="flex items-center space-x-1 text-gray-500 hover:text-gray-700"
                            >
                                <Code className="w-4 h-4" />
                                <span>Debug CSS</span>
                            </button>
                        )}
                    </div>
                )}

                {/* CSS debug panel */}
                {cssDebugInfo && (
                    <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">CSS Debug Information</h4>
                            <button
                                onClick={() => setCSSDebugInfo(null)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="space-y-2 text-xs font-mono">
                            {cssDebugInfo.map((style, index) => (
                                <div key={index} className="grid grid-cols-4 gap-2">
                                    <span className="text-blue-600">{style.id}</span>
                                    <span className="text-green-600">{style.priority}</span>
                                    <span className="text-purple-600">{style.rules} rules</span>
                                    <span className="text-gray-600">{style.size}b</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </header>
        )
    }

    // Main render
    return (
        <div
            ref={containerRef}
            className={`enhanced-layout-renderer h-full bg-white ${className} ${scopeId}`}
            style={getThemeStyles()}
            data-page-id={pageData?.id}
            data-layout={layout?.name}
            data-theme={theme?.name}
        >
            <div className="layout-content p-6 h-full overflow-auto">
                {renderPageHeader()}
                {renderLayout()}
                {children}
            </div>

            {/* CSS Error Display */}
            {cssErrors.length > 0 && (
                <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
                    <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="font-medium text-red-800">CSS Injection Errors</span>
                    </div>
                    <ul className="text-sm text-red-700 space-y-1">
                        {cssErrors.map((error, index) => (
                            <li key={index}>• {error}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

export default EnhancedLayoutRenderer 