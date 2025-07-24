import { Monitor, Grid3X3, Eye, EyeOff } from 'lucide-react'

/**
 * LayoutRenderer Component
 * 
 * A reusable component for rendering page layouts with themes, slots, and widgets.
 * Extracted from PagePreview to provide consistent layout rendering across the application.
 * 
 * Features:
 * - Theme CSS variables and custom CSS application
 * - Layout slot structure rendering
 * - Widget placement within slots
 * - Support for different rendering modes (preview, edit, display)
 * - Inheritance information display
 * - Accessibility and semantic markup
 */
const LayoutRenderer = ({
    layout,
    theme,
    widgetsBySlot = {},
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
    children
}) => {
    // Apply theme CSS variables
    const getThemeStyles = () => {
        const themeStyles = {}
        if (theme?.css_variables) {
            Object.entries(theme.css_variables).forEach(([key, value]) => {
                themeStyles[`--${key}`] = value
            })
        }
        return themeStyles
    }

    // Render theme CSS injection
    const renderThemeCSS = () => (
        <>
            {theme?.custom_css && (
                <style dangerouslySetInnerHTML={{ __html: theme.custom_css }} />
            )}
            {layout?.css_classes && (
                <style dangerouslySetInnerHTML={{ __html: layout.css_classes }} />
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

    // Render widget preview
    const WidgetPreview = ({ widgetData, showInheritance }) => {
        const { widget, inherited_from, is_override } = widgetData

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
                    {!widget.is_visible && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                            <EyeOff className="w-3 h-3 mr-1" />
                            Hidden
                        </span>
                    )}
                </div>
            )
        }

        return (
            <div
                className={`
                    widget-preview p-3 mb-3 rounded-lg border transition-colors
                    ${inherited_from ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'}
                    ${!widget.is_visible ? 'opacity-60' : ''}
                    ${mode === 'edit' ? 'hover:shadow-md cursor-pointer' : ''}
                `}
                onClick={mode === 'edit' ? () => onWidgetEdit?.(widget) : undefined}
                role={mode === 'edit' ? 'button' : undefined}
                tabIndex={mode === 'edit' ? 0 : -1}
                onKeyDown={(e) => {
                    if (mode === 'edit' && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        onWidgetEdit?.(widget)
                    }
                }}
            >
                {renderWidgetContent()}
                {renderInheritanceInfo()}
            </div>
        )
    }

    // Render empty slot placeholder
    const renderEmptySlot = (slot) => {
        if (!showEmptySlots) return null

        return (
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
        )
    }

    // Render slot header
    const renderSlotHeader = (slot) => {
        if (!showSlotHeaders) return null

        return (
            <div className="slot-header mb-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                        {slot.display_name || slot.title || slot.name}
                    </span>
                    {showInheritance && (
                        <span className="text-xs text-gray-500">
                            Slot: {slot.name}
                        </span>
                    )}
                </div>
                {slot.description && (
                    <p className="text-xs text-gray-500">{slot.description}</p>
                )}
                {mode === 'edit' && slot.max_widgets && (
                    <p className="text-xs text-blue-600">
                        Max widgets: {slot.max_widgets}
                    </p>
                )}
            </div>
        )
    }

    // Render individual slot
    const renderSlot = (slot, index) => {
        const slotWidgets = widgetsBySlot[slot.name] || []

        return (
            <div
                key={slot.name || index}
                className={`layout-slot mb-4 ${slot.css_classes || ''}`}
                data-slot={slot.name}
                onClick={mode === 'edit' ? () => onSlotClick?.(slot) : undefined}
                role={mode === 'edit' && onSlotClick ? 'button' : undefined}
                tabIndex={mode === 'edit' && onSlotClick ? 0 : -1}
            >
                {renderSlotHeader(slot)}

                <div className="slot-content">
                    {slotWidgets.length > 0 ? (
                        slotWidgets.map((widgetData, widgetIndex) => (
                            <WidgetPreview
                                key={widgetData.widget?.id || widgetIndex}
                                widgetData={widgetData}
                                showInheritance={showInheritance}
                            />
                        ))
                    ) : (
                        renderEmptySlot(slot)
                    )}
                </div>
            </div>
        )
    }

    // Render layout structure
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
            <div className={`page-layout layout-${layout.name?.toLowerCase()}`}>
                {slots.map(renderSlot)}
            </div>
        )
    }

    // Main render
    return (
        <div
            className={`layout-renderer h-full bg-white ${className}`}
            style={getThemeStyles()}
        >
            {renderThemeCSS()}

            <div className="layout-content p-6 h-full overflow-auto">
                {renderPageHeader()}
                {renderLayout()}
                {children}
            </div>
        </div>
    )
}



export default LayoutRenderer 