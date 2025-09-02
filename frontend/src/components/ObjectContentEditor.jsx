import React, { forwardRef, useState, useMemo } from 'react'
import { Layout, Plus, Settings, Trash2, Eye, Check, X } from 'lucide-react'
import { WidgetFactory } from './widgets'
import { useWidgets, getWidgetDisplayName, createDefaultWidgetConfig } from '../hooks/useWidgets'
import { convertAllWidgetsToNewFormat } from '../utils/widgetFormatConverter'

const ObjectContentEditor = forwardRef(({ objectType, widgets = {}, onWidgetChange, mode = 'object' }, ref) => {
    const [selectedSlot, setSelectedSlot] = useState(null)
    const [selectedWidgets, setSelectedWidgets] = useState({}) // For bulk operations

    // Ensure all widgets are in new format
    const normalizedWidgets = useMemo(() => {
        return convertAllWidgetsToNewFormat(widgets)
    }, [widgets])

    // Use the shared widget hook (but we'll override widgetTypes with object type's configuration)
    const {
        addWidget,
        updateWidget,
        deleteWidget
    } = useWidgets(normalizedWidgets)

    // Get available widget types from the object type's slot configurations
    const availableWidgetTypes = useMemo(() => {
        if (!objectType?.slotConfiguration?.slots) return []

        const allWidgetControls = []
        objectType.slotConfiguration.slots.forEach(slot => {
            if (slot.widgetControls && Array.isArray(slot.widgetControls)) {
                slot.widgetControls.forEach(control => {
                    // Avoid duplicates
                    if (!allWidgetControls.some(existing => existing.widgetType === control.widgetType)) {
                        allWidgetControls.push({
                            type: control.widgetType,
                            display_name: control.label || getWidgetDisplayName(control.widgetType),
                            name: control.label || getWidgetDisplayName(control.widgetType),
                            defaultConfig: control.defaultConfig || {}
                        })
                    }
                })
            }
        })

        return allWidgetControls
    }, [objectType?.slotConfiguration?.slots])

    if (!objectType?.slotConfiguration?.slots || !Array.isArray(objectType.slotConfiguration.slots)) {
        return (
            <div className="text-center py-8 text-gray-500">
                <Layout className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p>No widget slots configured</p>
            </div>
        )
    }

    const handleAddWidget = (slotName, widgetTypeToAdd = null) => {
        const slot = objectType.slotConfiguration.slots.find(s => s.name === slotName)
        if (!slot) return

        let widgetType = 'core_widgets.TextBlockWidget'
        let widgetConfig = {}

        if (widgetTypeToAdd) {
            // Use the specified widget type
            widgetType = widgetTypeToAdd
            // Try to get default config from the slot's widget control
            const widgetControl = slot.widgetControls?.find(c => c.widgetType === widgetType)
            widgetConfig = widgetControl?.defaultConfig || createDefaultWidgetConfig(widgetType)
        } else {
            // Use the first available widget control from the slot
            const availableControls = slot.widgetControls || []
            if (availableControls.length > 0) {
                const firstControl = availableControls[0]
                widgetType = firstControl.widgetType
                widgetConfig = firstControl.defaultConfig || createDefaultWidgetConfig(widgetType)
            } else {
                // Fallback if no widget controls are configured
                widgetConfig = createDefaultWidgetConfig(widgetType)
            }
        }

        // Use the shared addWidget function
        const newWidget = addWidget(slotName, widgetType, widgetConfig)

        // Notify parent component of the change (using normalized widgets)
        if (onWidgetChange) {
            const currentSlotWidgets = normalizedWidgets[slotName] || []
            const updatedWidgets = {
                ...normalizedWidgets,
                [slotName]: [...currentSlotWidgets, newWidget]
            }
            onWidgetChange(updatedWidgets)
        }
    }



    // Remove redundant function - use the shared one from useWidgets hook

    const handleEditWidget = (slotName, widgetIndex, widget) => {
        // TODO: Open widget editor with the specific widget
        // console.log('Edit widget:', { slotName, widgetIndex, widget })
    }

    const handleDeleteWidget = (slotName, widgetIndex, widget) => {
        // Use the shared deleteWidget function
        deleteWidget(slotName, widgetIndex)

        // Remove from selection if selected
        const widgetKey = `${slotName}-${widgetIndex}`
        if (selectedWidgets[widgetKey]) {
            setSelectedWidgets(prev => {
                const newSelection = { ...prev }
                delete newSelection[widgetKey]
                return newSelection
            })
        }

        // Notify parent component of the change (using normalized widgets)
        if (onWidgetChange) {
            const currentSlotWidgets = normalizedWidgets[slotName] || []
            const updatedSlotWidgets = currentSlotWidgets.filter((_, index) => index !== widgetIndex)
            const updatedWidgets = {
                ...normalizedWidgets,
                [slotName]: updatedSlotWidgets
            }
            onWidgetChange(updatedWidgets)
        }
    }

    // Toggle widget selection for bulk operations
    const handleToggleWidgetSelection = (slotName, widgetIndex, widget) => {
        const widgetKey = `${slotName}-${widgetIndex}`
        setSelectedWidgets(prev => ({
            ...prev,
            [widgetKey]: prev[widgetKey] ? undefined : { slotName, widgetIndex, widget }
        }))
    }

    // Delete selected widgets
    const handleDeleteSelectedWidgets = () => {
        const updatedWidgets = { ...normalizedWidgets }

        // Group deletions by slot to handle index changes
        const deletionsBySlot = {}
        Object.values(selectedWidgets).forEach(({ slotName, widgetIndex }) => {
            if (!deletionsBySlot[slotName]) {
                deletionsBySlot[slotName] = []
            }
            deletionsBySlot[slotName].push(widgetIndex)
        })

        // Delete widgets from each slot (in reverse order to maintain indices)
        Object.entries(deletionsBySlot).forEach(([slotName, indices]) => {
            const sortedIndices = indices.sort((a, b) => b - a)
            let slotWidgets = [...(updatedWidgets[slotName] || [])]

            sortedIndices.forEach(index => {
                slotWidgets.splice(index, 1)
            })

            updatedWidgets[slotName] = slotWidgets
        })

        // Clear selection
        setSelectedWidgets({})

        // Notify parent component
        if (onWidgetChange) {
            onWidgetChange(updatedWidgets)
        }
    }

    // Clear all widgets in a slot
    const handleClearSlot = (slotName) => {
        const updatedWidgets = {
            ...normalizedWidgets,
            [slotName]: []
        }

        // Clear any selections for this slot
        setSelectedWidgets(prev => {
            const newSelection = { ...prev }
            Object.keys(newSelection).forEach(key => {
                if (key.startsWith(`${slotName}-`)) {
                    delete newSelection[key]
                }
            })
            return newSelection
        })

        if (onWidgetChange) {
            onWidgetChange(updatedWidgets)
        }
    }

    const renderWidget = (widget, slotName, index) => {
        const widgetKey = `${slotName}-${index}`
        const isSelected = !!selectedWidgets[widgetKey]

        return (
            <div key={widget.id || index} className="relative">
                <button
                    onClick={() => handleToggleWidgetSelection(slotName, index, widget)}
                    className={`absolute top-2 left-2 z-10 p-1 rounded transition-colors ${isSelected ? 'text-blue-600 bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600 bg-white/80'
                        }`}
                    title="Select for bulk operations"
                >
                    {isSelected ? <Check className="h-3 w-3" /> : <div className="h-3 w-3 border border-gray-300 rounded-sm bg-white" />}
                </button>
                <WidgetFactory
                    widget={widget}
                    slotName={slotName}
                    index={index}
                    onEdit={handleEditWidget}
                    onDelete={handleDeleteWidget}
                    mode="editor"
                    showControls={true}
                    className={`mb-2 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                />
            </div>
        )
    }

    const renderSlot = (slot) => {
        const slotWidgets = normalizedWidgets[slot.name] || []
        const isSelected = selectedSlot === slot.name
        const slotSelections = Object.keys(selectedWidgets).filter(key => key.startsWith(`${slot.name}-`))
        const hasSelections = slotSelections.length > 0

        return (
            <div
                key={slot.name}
                className={`border rounded-lg p-4 transition-colors ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
                onClick={() => setSelectedSlot(slot.name)}
            >
                {/* Slot Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center">
                            <Layout className="h-4 w-4 mr-2 text-gray-400" />
                            <h4 className="text-sm font-medium text-gray-900">
                                {slot.label}
                                <span className="ml-2 text-xs text-gray-500">
                                    ({slotWidgets.length} widgets)
                                </span>
                                {slot.required && (
                                    <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                        Required
                                    </span>
                                )}
                            </h4>
                        </div>
                        {(slot.description || slot.maxWidgets) && (
                            <p className="text-xs text-gray-500 mt-1 ml-6">
                                {slot.description}
                                {slot.maxWidgets && (slot.description ? ` • Max: ${slot.maxWidgets}` : `Max: ${slot.maxWidgets}`)}
                            </p>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                        {/* Bulk Actions (show when widgets are selected) */}
                        {hasSelections && (
                            <div className="flex items-center space-x-1 mr-2">
                                <span className="text-xs text-gray-500">
                                    {slotSelections.length} selected
                                </span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteSelectedWidgets()
                                    }}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete selected widgets"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        )}

                        {/* Add Widget Dropdown */}
                        <div className="relative">
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleAddWidget(slot.name, e.target.value)
                                        e.target.value = '' // Reset
                                    }
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md transition-colors text-sm border-0 focus:ring-2 focus:ring-blue-500"
                                defaultValue=""
                                onClick={(e) => e.stopPropagation()}
                            >
                                <option value="" disabled>
                                    {(!slot.widgetControls || slot.widgetControls.length === 0) ? 'No widgets configured' : 'Add Widget...'}
                                </option>
                                {slot.widgetControls && slot.widgetControls.map((control, index) => (
                                    <option key={control.id || index} value={control.widgetType} className="text-gray-900">
                                        {control.label || getWidgetDisplayName(control.widgetType)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Widgets List - Always Visible */}
                <div className="space-y-2">
                    {slotWidgets.length > 0 ? (
                        <div className="space-y-1">
                            {slotWidgets.map((widget, index) => renderWidget(widget, slot.name, index, true))}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                            <Layout className="h-6 w-6 mx-auto mb-2" />
                            <p className="text-sm">No widgets in this slot</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const totalSelections = Object.keys(selectedWidgets).length

    // Only count widgets in slots that are configured for this object type
    const totalWidgets = useMemo(() => {
        if (!objectType?.slotConfiguration?.slots) return 0

        return objectType.slotConfiguration.slots.reduce((total, slot) => {
            const slotWidgets = normalizedWidgets[slot.name] || []
            return total + slotWidgets.length
        }, 0)
    }, [normalizedWidgets, objectType?.slotConfiguration?.slots])

    return (
        <div ref={ref} className="space-y-4">

            {/* Slots */}
            <div className="space-y-4">
                {objectType.slotConfiguration.slots.map(renderSlot)}
            </div>

            {objectType.slotConfiguration.slots.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <Layout className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No Slots Configured</h4>
                    <p>This object type doesn't have any widget slots configured.</p>
                </div>
            )}
        </div>
    )
})

ObjectContentEditor.displayName = 'ObjectContentEditor'

export default ObjectContentEditor
