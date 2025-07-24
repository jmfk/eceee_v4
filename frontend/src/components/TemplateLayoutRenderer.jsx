import { useEffect, useRef, useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import DOMPurify from 'dompurify'
import { Monitor, AlertTriangle, Code } from 'lucide-react'

/**
 * TemplateLayoutRenderer Component
 * 
 * React Portal-based layout renderer for HTML templates with CSS injection and widget mounting.
 * This is the Phase 3.1 implementation that supports:
 * - HTML template rendering with dangerouslySetInnerHTML
 * - CSS injection and cleanup
 * - React Portal mounting for widgets into HTML slots
 * - Slot element detection and mapping
 * - Security with HTML sanitization
 */
const TemplateLayoutRenderer = ({
    layout,
    theme,
    widgetsBySlot = {},
    pageTitle,
    pageDescription,
    onWidgetEdit,
    onWidgetAdd,
    onSlotClick,
    className = '',
    mode = 'preview',
    showInheritance = false,
    children
}) => {
    const containerRef = useRef()
    const [slotElements, setSlotElements] = useState({})
    const [cssInjected, setCssInjected] = useState(false)
    const [portalWidgets, setPortalWidgets] = useState([])
    const [sanitizationErrors, setSanitizationErrors] = useState([])

    // Check if this layout supports HTML templates
    const isTemplateBasedLayout = layout?.template_based || layout?.html

    // Sanitize HTML content with DOMPurify
    const sanitizedHTML = isTemplateBasedLayout ? DOMPurify.sanitize(layout.html || '', {
        ALLOWED_TAGS: [
            'div', 'section', 'main', 'aside', 'header', 'footer', 'article', 'nav',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'img', 'ul', 'ol', 'li',
            'a', 'strong', 'em', 'br', 'hr'
        ],
        ALLOWED_ATTR: [
            'class', 'id', 'data-widget-slot', 'data-slot-title', 'data-slot-description',
            'data-slot-max-widgets', 'role', 'aria-label', 'aria-describedby'
        ],
        KEEP_CONTENT: true,
        ALLOW_DATA_ATTR: true,
        SANITIZE_DOM: true
    }) : ''

    // Inject CSS for template-based layouts
    useEffect(() => {
        if (!isTemplateBasedLayout) return

        const layoutCSS = layout.css || layout.css_classes
        if (layoutCSS && !cssInjected) {
            const styleId = `template-layout-style-${layout.name}`

            // Remove existing style element
            const existingStyle = document.getElementById(styleId)
            if (existingStyle) {
                existingStyle.remove()
            }

            // Create new style element
            const styleElement = document.createElement('style')
            styleElement.id = styleId
            styleElement.textContent = layoutCSS
            document.head.appendChild(styleElement)

            setCssInjected(true)

            // Cleanup function
            return () => {
                const styleToRemove = document.getElementById(styleId)
                if (styleToRemove) {
                    styleToRemove.remove()
                }
                setCssInjected(false)
            }
        }
    }, [layout?.css, layout?.css_classes, layout?.name, cssInjected, isTemplateBasedLayout])

    // Find and map slot elements after HTML is rendered
    useEffect(() => {
        if (!isTemplateBasedLayout || !containerRef.current) return

        const slots = {}
        const errors = []

        // Find slot elements using data-widget-slot attribute
        const slotElements = containerRef.current.querySelectorAll('[data-widget-slot]')

        slotElements.forEach(element => {
            const slotName = element.getAttribute('data-widget-slot')
            if (slotName) {
                // Clear any placeholder content
                element.innerHTML = ''

                // Add CSS class for styling
                element.classList.add('widget-slot-container')

                slots[slotName] = element
            } else {
                errors.push(`Found element with data-widget-slot but no slot name`)
            }
        })

        // Also check layout slot configuration for additional slots
        if (layout.slot_configuration?.slots) {
            layout.slot_configuration.slots.forEach(slot => {
                if (!slots[slot.name] && slot.selector) {
                    const element = containerRef.current.querySelector(slot.selector)
                    if (element) {
                        element.innerHTML = ''
                        element.classList.add('widget-slot-container')
                        slots[slot.name] = element
                    }
                }
            })
        }

        setSlotElements(slots)
        setSanitizationErrors(errors)
    }, [layout, sanitizedHTML, isTemplateBasedLayout])

    // Create portal widgets when slot elements or widgets change
    useEffect(() => {
        if (!isTemplateBasedLayout || Object.keys(slotElements).length === 0) {
            setPortalWidgets([])
            return
        }

        const newPortalWidgets = []

        Object.entries(slotElements).forEach(([slotName, element]) => {
            const slotWidgets = widgetsBySlot[slotName] || []

            slotWidgets.forEach((widgetData, index) => {
                newPortalWidgets.push({
                    key: `${widgetData.widget?.id || index}-${slotName}`,
                    element,
                    slotName,
                    widgetData,
                    index
                })
            })
        })

        setPortalWidgets(newPortalWidgets)
    }, [slotElements, widgetsBySlot, isTemplateBasedLayout])

    // Apply theme CSS variables
    const getThemeStyles = useCallback(() => {
        const themeStyles = {}
        if (theme?.css_variables) {
            Object.entries(theme.css_variables).forEach(([key, value]) => {
                themeStyles[`--${key}`] = value
            })
        }
        return themeStyles
    }, [theme])

    // Render theme CSS injection
    const renderThemeCSS = () => (
        <>
            {theme?.custom_css && (
                <style dangerouslySetInnerHTML={{ __html: theme.custom_css }} />
            )}
        </>
    )

    // Render page header (optional)
    const renderPageHeader = () => {
        if (!pageTitle && !pageDescription) return null

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
            </header>
        )
    }

    // Widget wrapper component for portal mounting
    const WidgetWrapper = ({ widgetData, slotName, onEdit }) => {
        const { widget, inherited_from, is_override } = widgetData

        const handleClick = useCallback(() => {
            if (mode === 'edit' && onEdit) {
                onEdit(widget)
            }
        }, [widget, onEdit])

        const renderWidgetContent = () => {
            // Simplified widget content based on type
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
                case 'Header':
                    return (
                        <h2 className="text-2xl font-bold">
                            {widget.configuration?.title || 'Sample Header'}
                        </h2>
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
                default:
                    return (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                            <div className="text-sm font-medium text-blue-900">
                                {widget.widget_type?.name || 'Unknown'} Widget
                            </div>
                            <div className="text-xs text-blue-700 mt-1">
                                Widget content would appear here
                            </div>
                        </div>
                    )
            }
        }

        const renderInheritanceInfo = () => {
            if (!showInheritance) return null

            return (
                <div className="mt-2 text-xs text-gray-500">
                    {inherited_from && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-orange-100 text-orange-800 mr-2">
                            Inherited from: {inherited_from.title}
                        </span>
                    )}
                    {is_override && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                            Override
                        </span>
                    )}
                </div>
            )
        }

        return (
            <div
                className={`
                    widget-wrapper mb-3 p-3 rounded-lg border transition-colors
                    ${inherited_from ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'}
                    ${mode === 'edit' ? 'hover:shadow-md cursor-pointer' : ''}
                `}
                onClick={handleClick}
                role={mode === 'edit' ? 'button' : undefined}
                tabIndex={mode === 'edit' ? 0 : -1}
                data-widget-id={widget.id}
                data-widget-type={widget.widget_type?.name}
                data-slot={slotName}
            >
                {renderWidgetContent()}
                {renderInheritanceInfo()}
            </div>
        )
    }

    // Render template-based layout with portals
    const renderTemplateLayout = () => {
        if (!sanitizedHTML) {
            return (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
                    <Code className="w-8 h-8 mx-auto mb-2" />
                    <div className="text-sm">No template HTML available</div>
                    <div className="text-xs mt-1">Template may not be loaded yet</div>
                </div>
            )
        }

        return (
            <>
                {/* Render HTML template structure */}
                <div
                    ref={containerRef}
                    className="template-layout-container"
                    dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
                />

                {/* Portal widgets into slots */}
                {portalWidgets.map(({ key, element, slotName, widgetData }) =>
                    ReactDOM.createPortal(
                        <WidgetWrapper
                            key={key}
                            widgetData={widgetData}
                            slotName={slotName}
                            onEdit={onWidgetEdit}
                        />,
                        element
                    )
                )}
            </>
        )
    }

    // Fallback to regular layout renderer for non-template layouts
    const renderFallbackLayout = () => {
        return (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
                <Monitor className="w-8 h-8 mx-auto mb-2" />
                <div className="text-sm">Not a template-based layout</div>
                <div className="text-xs mt-1">Use LayoutRenderer for code-based layouts</div>
            </div>
        )
    }

    // Main render
    return (
        <div
            className={`template-layout-renderer h-full bg-white ${className}`}
            style={getThemeStyles()}
        >
            {renderThemeCSS()}

            <div className="layout-content p-6 h-full overflow-auto">
                {renderPageHeader()}

                {isTemplateBasedLayout ? renderTemplateLayout() : renderFallbackLayout()}

                {children}
            </div>

            {/* Error Display */}
            {sanitizationErrors.length > 0 && (
                <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
                    <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="font-medium text-red-800">Template Errors</span>
                    </div>
                    <ul className="text-sm text-red-700 space-y-1">
                        {sanitizationErrors.map((error, index) => (
                            <li key={index}>• {error}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

export default TemplateLayoutRenderer 