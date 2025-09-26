import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Layout, Plus, Settings, Trash2, Eye, Check, X, MoreHorizontal } from 'lucide-react'
import { ObjectWidgetFactory, createObjectEditorEventSystem } from '../editors/object-editor'
import { useWidgets, getWidgetDisplayName, createDefaultWidgetConfig } from '../hooks/useWidgets'
import { filterAvailableWidgetTypes } from '../utils/widgetTypeValidation'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../contexts/unified-data/types/operations'
import WidgetSelectionModal from './WidgetSelectionModal'
import SlotIconMenu from './SlotIconMenu'
import { useWidgetEvents } from '../contexts/WidgetEventContext'
import { useEditorContext } from '../contexts/unified-data/hooks'


const ObjectContentEditor = ({ objectType, widgets = {}, onWidgetChange, mode = 'object', onWidgetEditorStateChange, context }) => {
    const [selectedWidgets, setSelectedWidgets] = useState({}) // For bulk operations

    console.log("ObjectContentEditor")

    // Get update lock and UnifiedData context
    const { useExternalChanges, publishUpdate } = useUnifiedData();

    // Stable component identifier for UDC source tracking
    const instanceId = context.instanceId
    const componentId = useMemo(() => `object-instance-editor-${instanceId || 'new'}`, [instanceId])

    // Centralized function to notify parent of widget changes
    const notifyWidgetChange = useCallback((updatedWidgets, widgetId) => {
        if (onWidgetChange) {
            onWidgetChange(updatedWidgets, { sourceId: widgetId })
        }
    }, [])

    // Widget editor panel state
    const [widgetEditorOpen, setWidgetEditorOpen] = useState(false)
    const [editingWidget, setEditingWidget] = useState(null)
    //const { widgetHasUnsavedChanges, setWidgetHasUnsavedChanges } = useWidgetEvents()
    const widgetEditorRef = useRef(null)

    // Widget selection modal state
    const [widgetModalOpen, setWidgetModalOpen] = useState(false)
    const [selectedSlotForModal, setSelectedSlotForModal] = useState(null)

    const contextType = useEditorContext()

    // console.log("widgets2")
    // console.log(widgets)

    // Use widgets directly since migration is complete
    const normalizedWidgets = useMemo(() => {
        return widgets
    }, [widgets])

    // Listen to widget events (similar to PageEditor) - STABLE listeners that register once
    // Use refs to access current values without causing re-subscriptions
    const normalizedWidgetsRef = useRef(normalizedWidgets)

    // Update refs when values change (no re-renders)
    useEffect(() => {
        normalizedWidgetsRef.current = normalizedWidgets
    }, [normalizedWidgets])

    // Subscribe to external changes via Unified Data Context
    useExternalChanges(componentId, (state) => {
        // External updates can be handled here if needed
        //console.log("useExternalChanges::ObjectContentEditor")
    })

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

    const handleAddWidget = async (slotName, widgetTypeToAdd = null) => {
        console.log("handleAddWidget", slotName, widgetTypeToAdd)
        const slot = objectType.slotConfiguration.slots.find(s => s.name === slotName)
        if (!slot) return

        let widgetType = 'core_widgets.ContentWidget'
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

        // Compute updated widgets and notify parent
        const currentWidgets = normalizedWidgets
        const currentSlotWidgets = currentWidgets[slotName] || []
        const updatedWidgets = {
            ...currentWidgets,
            [slotName]: [...currentSlotWidgets, newWidget]
        }
        //notifyWidgetChange(updatedWidgets, newWidget.id)

        // Publish to Unified Data Context
        await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
            id: newWidget.id,
            type: newWidget.type,
            config: newWidget.config,
            slot: slotName,
            contextType: contextType,
            order: (updatedWidgets[slotName]?.length || 1) - 1
        })
    }

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
            //setWidgetHasUnsavedChanges(false)
        } else {
            // Open panel with new widget
            setEditingWidget(widgetData)
            setWidgetEditorOpen(true)
            //setWidgetHasUnsavedChanges(false)
        }
    }, [editingWidget])

    const handleCloseWidgetEditor = useCallback(() => {
        setWidgetEditorOpen(false)
        setEditingWidget(null)
        //setWidgetHasUnsavedChanges(false)
    }, [])

    const handleSaveWidget = useCallback(async (updatedWidget) => {
        if (!editingWidget) return

        const slotName = editingWidget.slotName || 'main'
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)

        // Publish config update to Unified Data Context
        await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: updatedWidget.id,
            slotName,
            contextType: contextType,
            config: updatedWidget.config
        })

        //setWidgetHasUnsavedChanges(false)
        handleCloseWidgetEditor()
    }, [editingWidget, handleCloseWidgetEditor, objectType, publishUpdate, componentId])

    // Notify parent of widget editor state changes
    useEffect(() => {
        if (onWidgetEditorStateChange) {
            //console.log("onWidgetEditorStateChange changed")
            onWidgetEditorStateChange({
                isOpen: widgetEditorOpen,
                editingWidget,
                //hasUnsavedChanges: widgetHasUnsavedChanges,
                widgetEditorRef,
                handleCloseWidgetEditor,
                handleSaveWidget
            })
        }
    }, [widgetEditorOpen, editingWidget, onWidgetEditorStateChange, handleCloseWidgetEditor, handleSaveWidget])

    const handleEditWidget = (slotName, widgetIndex, widget) => {
        // Add slotName and computed editor context to widget data for editor
        //console.log("handleEditWidget")
        const widgetWithSlot = {
            ...widget,
            slotName,
            context: {
                ...context,
                slotName,
                widgetId: widget?.id,
                objectId: (normalizedWidgetsRef.current && (Object.keys(normalizedWidgetsRef.current)[0] || undefined)),
                mode: 'edit',
                contextType: contextType
            }
        }
        handleOpenWidgetEditor(widgetWithSlot)
    }

    const handleDeleteWidget = async (slotName, widgetIndex, widget) => {
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)

        // Compute updated widgets and notify parent
        const currentWidgets = normalizedWidgets
        const updatedWidgets = { ...currentWidgets }
        if (updatedWidgets[slotName]) {
            updatedWidgets[slotName] = updatedWidgets[slotName].filter((_, i) => i !== widgetIndex)
        }
        //notifyWidgetChange(updatedWidgets, widget?.id)

        // Publish removal to Unified Data Context
        if (widget?.id) {
            await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                id: widget.id,
                contextType: contextType
            })
        }

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
    }

    // Move widget up in the slot
    const handleMoveWidgetUp = (slotName, widgetIndex, widget) => {
        console.log("handleMoveWidgetUp", slotName, widgetIndex, widget)
        if (widgetIndex <= 0) return // Can't move the first widget up
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)
        const currentWidgets = normalizedWidgets
        const slotWidgets = [...(currentWidgets[slotName] || [])]

        if (widgetIndex < slotWidgets.length) {
            const [movedWidget] = slotWidgets.splice(widgetIndex, 1)
            slotWidgets.splice(widgetIndex - 1, 0, movedWidget)

            const updatedWidgets = {
                ...currentWidgets,
                [slotName]: slotWidgets
            }
            onWidgetChange(updatedWidgets)
        }
    }

    // Move widget down in the slot
    const handleMoveWidgetDown = (slotName, widgetIndex, widget) => {
        console.log("handleMoveWidgetDown", slotName, widgetIndex, widget)
        const slotWidgets = normalizedWidgets[slotName] || []
        if (widgetIndex >= slotWidgets.length - 1) {
            return // Can't move the last widget down
        }
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)
        const currentWidgets = normalizedWidgets
        const currentSlotWidgets = [...(currentWidgets[slotName] || [])]

        if (widgetIndex >= 0 && widgetIndex < currentSlotWidgets.length - 1) {
            const [movedWidget] = currentSlotWidgets.splice(widgetIndex, 1)
            currentSlotWidgets.splice(widgetIndex + 1, 0, movedWidget)

            const updatedWidgets = {
                ...currentWidgets,
                [slotName]: currentSlotWidgets
            }
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
    const handleClearSlot = async (slotName) => {
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)
        const previousWidgetCount = (normalizedWidgets[slotName] || []).length

        const updatedWidgets = {
            ...normalizedWidgets,
            [slotName]: []
        }

        // Publish removal of all widgets in the slot to Unified Data Context
        const existingWidgetsInSlot = normalizedWidgets[slotName] || []
        for (const w of existingWidgetsInSlot) {
            await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                id: w.id, contextType: contextType,
            })
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

        // Notify parent component via callback
        //notifyWidgetChange(updatedWidgets, `slot-${slotName}`)
    }

    // Handle ObjectEditor-specific slot actions
    const handleSlotAction = useCallback(async (action, slotName, widget) => {
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)

        switch (action) {
            case 'duplicate':
                if (widget) {
                    const duplicatedWidget = {
                        ...widget,
                        id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: `${widget.name} (Copy)`
                    }

                    // Add the duplicated widget
                    const newWidget = addWidget(slotName, widget.type, duplicatedWidget.config)

                    // Compute updated widgets and notify parent
                    const currentWidgets = normalizedWidgets
                    const currentSlotWidgets = currentWidgets[slotName] || []
                    const updatedWidgets = {
                        ...currentWidgets,
                        [slotName]: [...currentSlotWidgets, newWidget]
                    }
                    //notifyWidgetChange(updatedWidgets, newWidget.id)

                    // Publish duplication as add operation to UDC
                    await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                        id: newWidget.id,
                        type: newWidget.type,
                        config: newWidget.config,
                        slot: slotName,
                        contextType: contextType,
                        order: (updatedWidgets[slotName]?.length || 1) - 1
                    })
                }
                break;

            case 'move_to_slot':
                // This would open a slot selection modal - for now just log
                // TODO: Implement slot selection modal
                break;

            default:
                console.warn('Unknown slot action:', action)
        }
    }, [objectType, addWidget, publishUpdate, componentId, normalizedWidgets])

    // Stable config change handler that doesn't depend on widget.config
    const stableConfigChangeHandler = useCallback(async (widgetId, slotName, newConfig) => {
        // Get the current widget from the store to avoid stale closure
        const currentWidgets = normalizedWidgets[slotName] || [];
        const widgetIndex = currentWidgets.findIndex(w => w.id === widgetId);
        if (widgetIndex !== -1) {
            const currentWidget = currentWidgets[widgetIndex];
            const updatedWidget = {
                ...currentWidget,
                config: newConfig
            };
            updateWidget(slotName, widgetIndex, updatedWidget);

            // Update editingWidget if this is the widget being edited
            if (editingWidget && editingWidget.id === widgetId) {
                setEditingWidget({
                    ...updatedWidget,
                    slotName: editingWidget.slotName // Preserve slotName
                });
            }

            // Create updated widgets object and notify parent
            const updatedWidgets = { ...normalizedWidgets };
            updatedWidgets[slotName] = [...currentWidgets];
            updatedWidgets[slotName][widgetIndex] = updatedWidget;

            //await notifyWidgetChange(updatedWidgets);
        }
    }, [normalizedWidgets, updateWidget, editingWidget]);

    const renderWidget = (widget, slotName, index) => {
        const widgetKey = `${slotName}-${index}`
        const isSelected = !!selectedWidgets[widgetKey]
        const slotWidgets = normalizedWidgets[slotName] || []
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)
        //console.log("widget", widget)
        return (
            <div key={widget.id || index} className="relative">
                <ObjectWidgetFactory
                    widget={widget}
                    slotName={slotName}
                    index={index}
                    onEdit={handleEditWidget}
                    onDelete={handleDeleteWidget}
                    onMoveUp={handleMoveWidgetUp}
                    onMoveDown={handleMoveWidgetDown}
                    onConfigChange={stableConfigChangeHandler}
                    canMoveUp={index > 0}
                    canMoveDown={index < slotWidgets.length - 1}
                    mode="editor"
                    showControls={true}
                    // ObjectEditor-specific props
                    objectType={objectType}
                    slotConfig={slot}
                    onSlotAction={handleSlotAction}
                    allowedWidgetTypes={availableWidgetTypes?.map(w => w.type) || []}
                    maxWidgets={slot?.maxWidgets}
                    // Pass widget identity for event system
                    widgetId={widget.id}
                    className={`mb-2 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                    context={context}
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
                    context={context}
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


    return (
        <div className="space-y-4">
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
                context={context}
            />
        </div>
    )
}

ObjectContentEditor.displayName = 'ObjectContentEditor'

export default ObjectContentEditor

