import { useEffect, useState, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { AlertTriangle, Plus, Edit3, Trash2 } from 'lucide-react'

/**
 * WidgetPortalManager Component
 * 
 * Manages React Portal mounting for widgets in template-based layouts.
 * This component provides:
 * - Portal creation and cleanup
 * - Widget lifecycle management
 * - Error boundaries for individual widgets
 * - Widget management overlay for editing
 */
const WidgetPortalManager = ({
    slotElements,
    widgetsBySlot = {},
    layout,
    mode = 'preview',
    showInheritance = false,
    onWidgetEdit,
    onWidgetAdd,
    onWidgetDelete,
    onWidgetReorder,
    showManagementOverlay = false
}) => {
    const [portalErrors, setPortalErrors] = useState({})
    const [mountedPortals, setMountedPortals] = useState([])

    // Create portals when slot elements or widgets change
    useEffect(() => {
        if (!slotElements || Object.keys(slotElements).length === 0) {
            setMountedPortals([])
            return
        }

        const newPortals = []
        const errors = {}

        Object.entries(slotElements).forEach(([slotName, element]) => {
            try {
                const slotWidgets = widgetsBySlot[slotName] || []

                slotWidgets.forEach((widgetData, index) => {
                    const portalKey = `${widgetData.widget?.id || index}-${slotName}-${index}`

                    newPortals.push({
                        key: portalKey,
                        slotName,
                        element,
                        widgetData,
                        index
                    })
                })
            } catch (error) {
                errors[slotName] = error.message
            }
        })

        setMountedPortals(newPortals)
        setPortalErrors(errors)
    }, [slotElements, widgetsBySlot])

    // Widget error boundary component
    const WidgetErrorBoundary = ({ children, widgetData, slotName }) => {
        const [hasError, setHasError] = useState(false)

        useEffect(() => {
            setHasError(false)
        }, [widgetData])

        if (hasError) {
            return (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-red-800">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">Widget Error</span>
                    </div>
                    <p className="text-xs text-red-600 mt-1">
                        Failed to render {widgetData.widget?.widget_type?.name || 'widget'}
                        in slot "{slotName}"
                    </p>
                </div>
            )
        }

        try {
            return children
        } catch (error) {
            setHasError(true)
            console.error('Widget render error:', error)
            return null
        }
    }

    // Widget wrapper with management controls
    const WidgetWrapper = ({ widgetData, slotName, index }) => {
        const { widget, inherited_from, is_override } = widgetData

        const handleEdit = useCallback(() => {
            if (onWidgetEdit) {
                onWidgetEdit(widget, slotName)
            }
        }, [widget, slotName])

        const handleDelete = useCallback(() => {
            if (onWidgetDelete) {
                onWidgetDelete(widget.id, slotName)
            }
        }, [widget.id, slotName])

        const renderWidgetContent = () => {
            // Enhanced widget content rendering
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
                                {widget.configuration?.description || 'Widget content would appear here'}
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

        const renderManagementControls = () => {
            if (!showManagementOverlay || mode !== 'edit') return null

            return (
                <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={handleEdit}
                        className="p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                        title="Edit widget"
                    >
                        <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                        title="Delete widget"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            )
        }

        return (
            <div
                className={`
                    widget-portal-wrapper group relative mb-3 p-3 rounded-lg border transition-all
                    ${inherited_from ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'}
                    ${!widget.is_visible ? 'opacity-60' : ''}
                    ${mode === 'edit' ? 'hover:shadow-md cursor-pointer' : ''}
                    ${showManagementOverlay ? 'hover:border-blue-300' : ''}
                `}
                onClick={mode === 'edit' ? handleEdit : undefined}
                role={mode === 'edit' ? 'button' : undefined}
                tabIndex={mode === 'edit' ? 0 : -1}
                data-widget-id={widget.id}
                data-widget-type={widget.widget_type?.name}
                data-slot={slotName}
                data-index={index}
            >
                {renderWidgetContent()}
                {renderInheritanceInfo()}
                {renderManagementControls()}
            </div>
        )
    }

    // Slot management overlay
    const SlotManagementOverlay = ({ slotName, element }) => {
        const slotWidgets = widgetsBySlot[slotName] || []
        const slotConfig = layout?.slot_configuration?.slots?.find(s => s.name === slotName)
        const maxWidgets = slotConfig?.max_widgets

        const handleAddWidget = useCallback(() => {
            if (onWidgetAdd) {
                onWidgetAdd(slotName, slotConfig)
            }
        }, [slotName, slotConfig])

        if (!showManagementOverlay || mode !== 'edit') return null

        return ReactDOM.createPortal(
            <div className="slot-management-overlay">
                {slotWidgets.length === 0 && (
                    <div className="empty-slot-indicator border-2 border-dashed border-blue-200 rounded-lg p-4 text-center text-blue-600">
                        <Plus className="w-6 h-6 mx-auto mb-2" />
                        <div className="text-sm font-medium">
                            {slotConfig?.title || slotName}
                        </div>
                        {slotConfig?.description && (
                            <div className="text-xs mt-1 text-gray-500">
                                {slotConfig.description}
                            </div>
                        )}
                        <button
                            onClick={handleAddWidget}
                            className="mt-2 px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                        >
                            Add Widget
                        </button>
                    </div>
                )}

                {maxWidgets && slotWidgets.length >= maxWidgets && (
                    <div className="slot-limit-indicator mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                        Maximum widgets reached ({maxWidgets})
                    </div>
                )}
            </div>,
            element
        )
    }

    // Render all portals
    return (
        <>
            {/* Widget portals */}
            {mountedPortals.map(({ key, slotName, element, widgetData, index }) =>
                ReactDOM.createPortal(
                    <WidgetErrorBoundary key={key} widgetData={widgetData} slotName={slotName}>
                        <WidgetWrapper
                            widgetData={widgetData}
                            slotName={slotName}
                            index={index}
                        />
                    </WidgetErrorBoundary>,
                    element
                )
            )}

            {/* Slot management overlays */}
            {showManagementOverlay && Object.entries(slotElements).map(([slotName, element]) => (
                <SlotManagementOverlay
                    key={`overlay-${slotName}`}
                    slotName={slotName}
                    element={element}
                />
            ))}

            {/* Portal error display */}
            {Object.keys(portalErrors).length > 0 && (
                <div className="fixed bottom-16 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md z-50">
                    <div className="flex items-center space-x-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="font-medium text-red-800">Portal Errors</span>
                    </div>
                    <ul className="text-sm text-red-700 space-y-1">
                        {Object.entries(portalErrors).map(([slotName, error]) => (
                            <li key={slotName}>
                                <strong>{slotName}:</strong> {error}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    )
}

export default WidgetPortalManager 