import React, { forwardRef, useState, useMemo, useRef, useCallback, useImperativeHandle, useEffect } from 'react'
import { Layout, Plus, Settings, Trash2, Eye, Check, X, MoreHorizontal } from 'lucide-react'
import { WidgetFactory } from './widgets'
import { useWidgets, getWidgetDisplayName, createDefaultWidgetConfig } from '../hooks/useWidgets'
import { filterAvailableWidgetTypes } from '../utils/widgetTypeValidation'
import {
    getWidgetIcon,
    getWidgetCategory,
    getWidgetDescription
} from './widgets/widgetRegistry'

import WidgetEditorPanel from './WidgetEditorPanel'

// WidgetSelectionModal component that replicates the PageEditor widget selection modal
const WidgetSelectionModal = ({ isOpen, onClose, onSelectWidget, slot, availableWidgetTypes, isFilteringTypes }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const modalRef = useRef(null)

    // Filter available widget types based on slot configuration and search term
    const filteredWidgets = useMemo(() => {
        if (!slot?.widgetControls || !availableWidgetTypes) return []

        let widgets = slot.widgetControls
            .filter(control => {
                // Only show widget controls that are available on the server
                return availableWidgetTypes.some(available =>
                    available.type === control.widgetType ||
                    available.widgetType === control.widgetType
                )
            })
            .map(control => {
                const widgetType = availableWidgetTypes.find(available =>
                    available.type === control.widgetType ||
                    available.widgetType === control.widgetType
                )
                return {
                    type: control.widgetType,
                    name: control.label || getWidgetDisplayName(control.widgetType),
                    description: getWidgetDescription(control.widgetType) || widgetType?.description || 'No description available',
                    category: getWidgetCategory(control.widgetType) || widgetType?.category || 'General',
                    icon: getWidgetIcon(control.widgetType) || widgetType?.icon || '🧩'
                }
            })

        // Filter by search term
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase()
            widgets = widgets.filter(widget =>
                widget.name.toLowerCase().includes(term) ||
                widget.description.toLowerCase().includes(term) ||
                widget.category.toLowerCase().includes(term) ||
                widget.type.toLowerCase().includes(term)
            )
        }

        return widgets
    }, [slot, availableWidgetTypes, searchTerm])

    // Close modal when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen, onClose])

    // Close modal on Escape key
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            return () => document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    const handleWidgetSelect = (widgetType) => {
        onSelectWidget(widgetType)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div
                ref={modalRef}
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
            >
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Add Widget to Slot</h3>
                            <p className="text-sm text-gray-600">{slot?.label || slot?.name}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Search widgets..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Widget Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                        {isFilteringTypes ? (
                            <div className="col-span-full flex items-center justify-center py-12">
                                <div className="text-center">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <p className="mt-2 text-sm text-gray-600">Loading widgets...</p>
                                </div>
                            </div>
                        ) : filteredWidgets.length === 0 ? (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                <div className="text-4xl mb-2">🔍</div>
                                <p className="text-sm">No widgets found</p>
                                {searchTerm && (
                                    <p className="text-xs mt-1">Try adjusting your search terms</p>
                                )}
                            </div>
                        ) : (
                            filteredWidgets.map((widget, index) => (
                                <div
                                    key={widget.type + index}
                                    onClick={() => handleWidgetSelect(widget.type)}
                                    className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                                >
                                    <div className="flex items-start space-x-3">
                                        <div className="bg-gray-100 rounded-lg w-12 h-12 flex items-center justify-center text-gray-600">
                                            {widget.icon && typeof widget.icon === 'function' ? (
                                                React.createElement(widget.icon, { className: "h-6 w-6" })
                                            ) : React.isValidElement(widget.icon) ? (
                                                React.cloneElement(widget.icon, { className: "h-6 w-6" })
                                            ) : (
                                                <span className="text-xl font-bold">{widget.icon || '🧩'}</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-semibold text-gray-900 mb-1">{widget.name}</h4>
                                            <p className="text-xs text-gray-600 leading-relaxed">{widget.description}</p>
                                            <div className="mt-2">
                                                <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                                    {widget.category}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// SlotIconMenu component that replicates the PageEditor three-dot menu
const SlotIconMenu = ({ slotName, slot, availableWidgetTypes, isFilteringTypes, onAddWidget, onClearSlot, onShowWidgetModal }) => {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef(null)

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const handleMenuToggle = () => {
        setIsOpen(!isOpen)
    }

    const handleAddWidgetClick = () => {
        onShowWidgetModal(slot)
        setIsOpen(false)
    }

    const handleClearSlotClick = () => {
        onClearSlot(slotName)
        setIsOpen(false)
    }

    return (
        <div className="absolute top-2 right-2 z-20 opacity-80 hover:opacity-100 transition-opacity" ref={menuRef}>
            {/* Menu Button (3 dots icon) */}
            <button
                onClick={handleMenuToggle}
                className="bg-gray-700 hover:bg-gray-800 text-white p-2 rounded-md transition-colors"
                title={`Slot: ${slotName}`}
            >
                <MoreHorizontal className="h-4 w-4" />
            </button>

            {/* Menu Dropdown */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-48">
                    {/* Add Widget */}
                    {!isFilteringTypes && slot.widgetControls && slot.widgetControls.length > 0 && (
                        <>
                            <button
                                onClick={handleAddWidgetClick}
                                className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors text-green-700 hover:bg-green-50"
                            >
                                <Plus className="h-4 w-4 mr-3 text-gray-600" />
                                <span className="text-gray-900">Add Widget</span>
                            </button>
                            <div className="border-t border-gray-200 my-1"></div>
                        </>
                    )}

                    {/* Clear Slot */}
                    <button
                        onClick={handleClearSlotClick}
                        className="flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors text-red-700 hover:bg-red-50"
                    >
                        <Trash2 className="h-4 w-4 mr-3 text-gray-600" />
                        <span className="text-gray-900">Clear Slot</span>
                    </button>
                </div>
            )}
        </div>
    )
}

const ObjectContentEditor = forwardRef(({ objectType, widgets = {}, onWidgetChange, mode = 'object' }, ref) => {
    const [selectedWidgets, setSelectedWidgets] = useState({}) // For bulk operations

    // Widget editor panel state
    const [widgetEditorOpen, setWidgetEditorOpen] = useState(false)
    const [editingWidget, setEditingWidget] = useState(null)
    const [widgetHasUnsavedChanges, setWidgetHasUnsavedChanges] = useState(false)
    const widgetEditorRef = useRef(null)

    // Widget selection modal state
    const [widgetModalOpen, setWidgetModalOpen] = useState(false)
    const [selectedSlotForModal, setSelectedSlotForModal] = useState(null)

    // Use widgets directly since migration is complete
    const normalizedWidgets = useMemo(() => {
        return widgets
    }, [widgets])

    // Use the shared widget hook (but we'll override widgetTypes with object type's configuration)
    const {
        widgetTypes,
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
                            display_name: control.label || getWidgetDisplayName(control.widgetType, widgetTypes),
                            name: control.label || getWidgetDisplayName(control.widgetType, widgetTypes),
                            defaultConfig: control.defaultConfig || {},
                            widgetType: control.widgetType // Keep original for filtering
                        })
                    }
                })
            }
        })

        return allWidgetControls
    }, [objectType?.slotConfiguration?.slots, widgetTypes])

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

    // Widget modal handlers
    const handleShowWidgetModal = (slot) => {
        setSelectedSlotForModal(slot)
        setWidgetModalOpen(true)
    }

    const handleCloseWidgetModal = () => {
        setWidgetModalOpen(false)
        setSelectedSlotForModal(null)
    }

    const handleWidgetSelection = (widgetType) => {
        if (selectedSlotForModal) {
            handleAddWidget(selectedSlotForModal.name, widgetType)
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
                className="relative border p-4 transition-colors border-gray-200 min-h-[100px]"
                data-slot-name={slot.name}
                data-slot-title={slot.label}
            >
                {/* Slot Menu - Three Dot Menu */}
                <SlotIconMenu
                    slotName={slot.name}
                    slot={slot}
                    availableWidgetTypes={availableWidgetTypes}
                    isFilteringTypes={isFilteringTypes}
                    onAddWidget={handleAddWidget}
                    onClearSlot={handleClearSlot}
                    onShowWidgetModal={handleShowWidgetModal}
                />

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
                </div>

                {/* Widgets List - Always Visible */}
                <div className="space-y-2">
                    {slotWidgets.length > 0 ? (
                        <div className="space-y-1">
                            {slotWidgets.map((widget, index) => renderWidget(widget, slot.name, index, true))}
                        </div>
                    ) : (
                        <div className="slot-placeholder p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-500">
                            <div className="text-sm font-medium">{slot.label}</div>
                            {slot.description && (
                                <div className="text-xs mt-1">{slot.description}</div>
                            )}
                            <div className="text-xs mt-2 opacity-75">Click ••• to add widgets</div>
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

            {/* Widget Selection Modal */}
            <WidgetSelectionModal
                isOpen={widgetModalOpen}
                onClose={handleCloseWidgetModal}
                onSelectWidget={handleWidgetSelection}
                slot={selectedSlotForModal}
                availableWidgetTypes={availableWidgetTypes}
                isFilteringTypes={isFilteringTypes}
            />
        </div>
    )
})

ObjectContentEditor.displayName = 'ObjectContentEditor'

export default ObjectContentEditor
