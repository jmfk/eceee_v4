import React, { forwardRef, useState, useMemo, useRef, useCallback, useImperativeHandle, useEffect } from 'react'
import { Layout, Plus, Settings, Trash2, Eye, Check, X } from 'lucide-react'
import { WidgetFactory } from './widgets'
import { useWidgets, getWidgetDisplayName, createDefaultWidgetConfig } from '../hooks/useWidgets'
import { filterAvailableWidgetTypes } from '../utils/widgetTypeValidation'

import WidgetEditorPanel from './WidgetEditorPanel'

const ObjectContentEditor = forwardRef(({ objectType, widgets = {}, onWidgetChange, mode = 'object' }, ref) => {
    const [selectedWidgets, setSelectedWidgets] = useState({}) // For bulk operations

    // Widget editor panel state
    const [widgetEditorOpen, setWidgetEditorOpen] = useState(false)
    const [editingWidget, setEditingWidget] = useState(null)
    const [widgetHasUnsavedChanges, setWidgetHasUnsavedChanges] = useState(false)
    const widgetEditorRef = useRef(null)

    // Use widgets directly since migration is complete
    const normalizedWidgets = useMemo(() => {
        return widgets
    }, [widgets])

    // Use the shared widget hook (but we'll override widgetTypes with object type's configuration)
    const {
        addWidget,
        updateWidget,
        deleteWidget
    } = useWidgets(normalizedWidgets)

    // State for filtered widget types
    const [filteredWidgetTypes, setFilteredWidgetTypes] = useState([])
    const [isFilteringTypes, setIsFilteringTypes] = useState(false)

    // Get available widget types from the object type's slot configurations
    const rawAvailableWidgetTypes = useMemo(() => {
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
                            defaultConfig: control.defaultConfig || {},
                            widgetType: control.widgetType // Keep original for filtering
                        })
                    }
                })
            }
        })

        return allWidgetControls
    }, [objectType?.slotConfiguration?.slots])

    // Filter widget types to only include available ones from server
    useEffect(() => {
        const filterTypes = async () => {
            if (rawAvailableWidgetTypes.length === 0) {
                setFilteredWidgetTypes([])
                return
            }

            setIsFilteringTypes(true)
            try {
                const filtered = await filterAvailableWidgetTypes(rawAvailableWidgetTypes)
                setFilteredWidgetTypes(filtered)
            } catch (error) {
                console.error('Error filtering widget types:', error)
                // Fallback to raw types on error
                setFilteredWidgetTypes(rawAvailableWidgetTypes)
            } finally {
                setIsFilteringTypes(false)
            }
        }

        filterTypes()
    }, [rawAvailableWidgetTypes])

    // Use filtered types as the available widget types
    const availableWidgetTypes = filteredWidgetTypes

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

    // Widget editor handlers
    const handleOpenWidgetEditor = useCallback((widgetData) => {
        // Toggle functionality: check if the same widget is already being edited
        // Use widget ID as primary identifier, only if both widgets have IDs
        const isSameWidget = editingWidget &&
            widgetData.id &&
            editingWidget.id &&
            editingWidget.id === widgetData.id;

        if (isSameWidget) {
            setWidgetEditorOpen(false)
            setEditingWidget(null)
            setWidgetHasUnsavedChanges(false)
        } else {
            // Open panel with new widget
            setEditingWidget(widgetData)
            setWidgetEditorOpen(true)
            setWidgetHasUnsavedChanges(false)
        }
    }, [editingWidget])

    const handleCloseWidgetEditor = useCallback(() => {
        setWidgetEditorOpen(false)
        setEditingWidget(null)
        setWidgetHasUnsavedChanges(false)
    }, [])

    const handleSaveWidget = useCallback((updatedWidget) => {
        if (!editingWidget || !onWidgetChange) return

        // Update the widget in the widgets object
        const updatedWidgets = { ...normalizedWidgets }
        const slotName = editingWidget.slotName || 'main'

        if (updatedWidgets[slotName]) {
            updatedWidgets[slotName] = updatedWidgets[slotName].map(w =>
                w.id === editingWidget.id ? updatedWidget : w
            )
        }

        onWidgetChange(updatedWidgets)
        setWidgetHasUnsavedChanges(false)
        handleCloseWidgetEditor()
    }, [editingWidget, normalizedWidgets, onWidgetChange, handleCloseWidgetEditor])

    const handleEditWidget = (slotName, widgetIndex, widget) => {
        // Add slotName to widget data for editor
        const widgetWithSlot = { ...widget, slotName }
        handleOpenWidgetEditor(widgetWithSlot)
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

    // Move widget up in the slot
    const handleMoveWidgetUp = (slotName, widgetIndex, widget) => {
        if (widgetIndex <= 0) return // Can't move the first widget up

        const currentSlotWidgets = [...(normalizedWidgets[slotName] || [])]
        if (currentSlotWidgets.length <= 1) return

        // Swap with previous widget
        const temp = currentSlotWidgets[widgetIndex]
        currentSlotWidgets[widgetIndex] = currentSlotWidgets[widgetIndex - 1]
        currentSlotWidgets[widgetIndex - 1] = temp

        const updatedWidgets = {
            ...normalizedWidgets,
            [slotName]: currentSlotWidgets
        }

        // Notify parent component of the change
        if (onWidgetChange) {
            onWidgetChange(updatedWidgets)
        }
    }

    // Move widget down in the slot
    const handleMoveWidgetDown = (slotName, widgetIndex, widget) => {
        const currentSlotWidgets = [...(normalizedWidgets[slotName] || [])]
        if (widgetIndex >= currentSlotWidgets.length - 1) return // Can't move the last widget down

        // Swap with next widget
        const temp = currentSlotWidgets[widgetIndex]
        currentSlotWidgets[widgetIndex] = currentSlotWidgets[widgetIndex + 1]
        currentSlotWidgets[widgetIndex + 1] = temp

        const updatedWidgets = {
            ...normalizedWidgets,
            [slotName]: currentSlotWidgets
        }

        // Notify parent component of the change
        if (onWidgetChange) {
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
        const slotWidgets = normalizedWidgets[slotName] || []

        return (
            <div key={widget.id || index} className="relative">
                <WidgetFactory
                    widget={widget}
                    slotName={slotName}
                    index={index}
                    onEdit={handleEditWidget}
                    onDelete={handleDeleteWidget}
                    onMoveUp={handleMoveWidgetUp}
                    onMoveDown={handleMoveWidgetDown}
                    canMoveUp={index > 0}
                    canMoveDown={index < slotWidgets.length - 1}
                    mode="editor"
                    showControls={true}
                    className={`mb-2 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                />
            </div>
        )
    }

    const renderSlot = (slot) => {
        const slotWidgets = normalizedWidgets[slot.name] || []
        const slotSelections = Object.keys(selectedWidgets).filter(key => key.startsWith(`${slot.name}-`))
        const hasSelections = slotSelections.length > 0

        return (
            <div
                key={slot.name}
                className="border p-4 transition-colors border-gray-200"
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
                        {/* Add Widget Dropdown */}
                        <div className="relative">
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleAddWidget(slot.name, e.target.value)
                                        e.target.value = '' // Reset
                                    }
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md transition-colors text-sm border-0 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                defaultValue=""
                                onClick={(e) => e.stopPropagation()}
                                disabled={isFilteringTypes}
                            >
                                <option value="" disabled>
                                    {isFilteringTypes
                                        ? 'Loading widget types...'
                                        : (!slot.widgetControls || slot.widgetControls.length === 0)
                                            ? 'No widgets configured'
                                            : availableWidgetTypes.length === 0
                                                ? 'No available widget types'
                                                : 'Add Widget...'
                                    }
                                </option>
                                {!isFilteringTypes && slot.widgetControls && slot.widgetControls
                                    .filter(control => {
                                        // Only show widget controls that are available on the server
                                        return availableWidgetTypes.some(available =>
                                            available.type === control.widgetType ||
                                            available.widgetType === control.widgetType
                                        )
                                    })
                                    .map((control, index) => (
                                        <option key={control.id || index} value={control.widgetType} className="text-gray-900">
                                            {control.label || getWidgetDisplayName(control.widgetType)}
                                        </option>
                                    ))
                                }
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

    // Expose widget editor functionality to parent
    useImperativeHandle(ref, () => ({
        // Widget editor state
        widgetEditorOpen,
        editingWidget,
        widgetHasUnsavedChanges,
        widgetEditorRef,
        // Widget editor handlers
        handleOpenWidgetEditor,
        handleCloseWidgetEditor,
        handleSaveWidget
    }), [widgetEditorOpen, editingWidget, widgetHasUnsavedChanges, handleOpenWidgetEditor, handleCloseWidgetEditor, handleSaveWidget])

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
