import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Layout, Plus, Settings, Trash2, Eye, Check, X, MoreHorizontal, Clipboard, Scissors, ChevronDown, ChevronUp } from 'lucide-react'
import { ObjectWidgetFactory, createObjectEditorEventSystem } from '../editors/object-editor'
import { useWidgets, getWidgetDisplayName, createDefaultWidgetConfig } from '../hooks/useWidgets'
import { filterAvailableWidgetTypes } from '../utils/widgetTypeValidation'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../contexts/unified-data/types/operations'
import WidgetSelectionModal from './WidgetSelectionModal'
import SlotIconMenu from './SlotIconMenu'
import { useWidgetEvents } from '../contexts/WidgetEventContext'
import { useEditorContext } from '../contexts/unified-data/hooks'
import { useClipboard } from '../contexts/ClipboardContext'
import { copyWidgetsToClipboard, cutWidgetsToClipboard } from '../utils/clipboardService'
import ImportDialog from './ImportDialog'


const ObjectContentEditor = ({ objectType, widgets = {}, mode = 'object', onWidgetEditorStateChange, context }) => {
    // Widget selection state: Set<widgetPath> where widgetPath = "slotName/widgetId"
    const [selectedWidgets, setSelectedWidgets] = useState(() => new Set())

    // Cut widgets state: tracks widgets that have been cut (waiting for paste)
    const [cutWidgets, setCutWidgets] = useState(() => new Set())

    // Toolbar collapse state
    const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false)

    // Get global clipboard state
    const { clipboardData, pasteModeActive, pasteModePaused, togglePasteMode, clearClipboardState, refreshClipboard } = useClipboard()

    // Sync cut widgets from clipboard data
    useEffect(() => {
        if (clipboardData?.operation === 'cut' && clipboardData.metadata?.widgetPaths) {
            setCutWidgets(new Set(clipboardData.metadata.widgetPaths))
        } else if (clipboardData?.operation === 'cut' && clipboardData.metadata?.widgets) {
            // Handle backward compatibility
            const paths = []
            Object.entries(clipboardData.metadata.widgets).forEach(([slot, ids]) => {
                ids.forEach(id => paths.push(`${slot}/${id}`))
            })
            setCutWidgets(new Set(paths))
        } else {
            setCutWidgets(new Set())
        }
    }, [clipboardData])

    // Helper: Build widget path string from slotName and widgetId
    const buildWidgetPath = useCallback((slotName, widgetId) => {
        return `${slotName}/${widgetId}`
    }, [])

    // Helper: Parse widget path to extract components
    const parseWidgetPath = useCallback((widgetPath) => {
        const parts = widgetPath.split('/')
        if (parts.length === 2) {
            return { slotName: parts[0], widgetId: parts[1] }
        }
        return null
    }, [])

    // Get update lock and UnifiedData context
    const { useExternalChanges, publishUpdate } = useUnifiedData();

    // Stable component identifier for UDC source tracking
    const instanceId = context.instanceId
    const componentId = useMemo(() => `object-content-editor-${instanceId || 'new'}`, [instanceId])

    // Widget editor panel state
    const [widgetEditorOpen, setWidgetEditorOpen] = useState(false)
    const [editingWidget, setEditingWidget] = useState(null)
    //const { widgetHasUnsavedChanges, setWidgetHasUnsavedChanges } = useWidgetEvents()
    const widgetEditorRef = useRef(null)

    // Widget selection modal state
    const [widgetModalOpen, setWidgetModalOpen] = useState(false)
    const [selectedSlotForModal, setSelectedSlotForModal] = useState(null)

    // Import dialog state
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [importSlotName, setImportSlotName] = useState(null)

    const contextType = useEditorContext()

    // State for normalized widgets that can be updated from UDC
    const [internalWidgets, setInternalWidgets] = useState(widgets)
    const isInitialized = useRef(false)
    const internalWidgetsRef = useRef(internalWidgets)

    // Use widgets directly since migration is complete
    const normalizedWidgets = useMemo(() => {
        return internalWidgets
    }, [internalWidgets])

    // Keep ref in sync
    useEffect(() => {
        internalWidgetsRef.current = internalWidgets
    }, [internalWidgets])

    // Initialize widgets from props only once on mount
    // After that, updates come from optimistic updates or UDC subscription
    useEffect(() => {
        if (!isInitialized.current) {
            setInternalWidgets(widgets)
            isInitialized.current = true
        }
    }, [widgets])

    // Subscribe to external changes via Unified Data Context
    useExternalChanges(componentId, (state) => {
        // When widgets are updated through UDC, extract widgets for this specific object
        if (state && instanceId) {
            // Objects store widgets under state.objects[objectId].widgets[slotName]
            // For object editing, we want all slots, so we take the entire widgets object
            const objectData = state.objects?.[instanceId]
            if (objectData?.widgets) {
                // Check if this is just a config update (not structural)
                const newWidgets = objectData.widgets
                const currentWidgets = internalWidgetsRef.current

                // Check if the structure changed (widget added/removed/reordered)
                // Check all slots in both old and new widgets
                const allSlots = new Set([
                    ...Object.keys(newWidgets),
                    ...Object.keys(currentWidgets)
                ])

                const structureChanged = Array.from(allSlots).some(slotName => {
                    const newSlot = newWidgets[slotName] || []
                    const currentSlot = currentWidgets[slotName] || []

                    // Different number of widgets = structure changed
                    if (newSlot.length !== currentSlot.length) return true

                    // Different widget IDs or order = structure changed
                    return newSlot.some((w, idx) => w.id !== currentSlot[idx]?.id)
                })

                // Only update if structure changed (not just config)
                // ContentWidget handles its own config updates via refs
                if (structureChanged) {
                    setInternalWidgets(newWidgets)
                }
            }
        }
    })

    // Listen to widget events (similar to PageEditor) - STABLE listeners that register once
    // Use refs to access current values without causing re-subscriptions
    const normalizedWidgetsRef = useRef(normalizedWidgets)

    // Update refs when values change (no re-renders)
    useEffect(() => {
        normalizedWidgetsRef.current = normalizedWidgets
    }, [normalizedWidgets])

    // Use the shared widget hook to get widget types
    const { widgetTypes } = useWidgets(normalizedWidgets)

    // Selection handlers
    const toggleWidgetSelection = useCallback((slotName, widgetId) => {
        const widgetPath = buildWidgetPath(slotName, widgetId)
        setSelectedWidgets(prev => {
            const newSet = new Set(prev)
            if (newSet.has(widgetPath)) {
                newSet.delete(widgetPath)
            } else {
                newSet.add(widgetPath)
            }
            return newSet
        })
    }, [buildWidgetPath])

    const selectAllInSlot = useCallback((slotName) => {
        const slotWidgets = normalizedWidgets[slotName] || []
        if (slotWidgets.length === 0) return

        setSelectedWidgets(prev => {
            const newSet = new Set(prev)
            slotWidgets.forEach(widget => {
                const widgetPath = buildWidgetPath(slotName, widget.id)
                newSet.add(widgetPath)
            })
            return newSet
        })
    }, [normalizedWidgets, buildWidgetPath])

    const clearSelection = useCallback(() => {
        setSelectedWidgets(new Set())
        setCutWidgets(new Set())
    }, [])

    const isWidgetSelected = useCallback((slotName, widgetId) => {
        const widgetPath = buildWidgetPath(slotName, widgetId)
        return selectedWidgets.has(widgetPath)
    }, [selectedWidgets, buildWidgetPath])

    const isWidgetCut = useCallback((slotName, widgetId) => {
        const widgetPath = buildWidgetPath(slotName, widgetId)
        return cutWidgets.has(widgetPath)
    }, [cutWidgets, buildWidgetPath])

    const getSelectedCount = useCallback(() => {
        return selectedWidgets.size
    }, [selectedWidgets])

    const getSelectedWidgets = useCallback(() => {
        const selected = []
        selectedWidgets.forEach(widgetPath => {
            const parsed = parseWidgetPath(widgetPath)
            if (!parsed) return

            const slotWidgets = normalizedWidgets[parsed.slotName] || []
            const widget = slotWidgets.find(w => w.id === parsed.widgetId)
            if (widget) {
                selected.push({ widget, slotName: parsed.slotName, widgetPath })
            }
        })
        return selected
    }, [selectedWidgets, normalizedWidgets, parseWidgetPath])

    // Bulk action handlers
    const handleCopySelected = useCallback(async () => {
        const selected = getSelectedWidgets()
        if (selected.length === 0) return

        const widgetsToCopy = selected.map(item => item.widget)
        await copyWidgetsToClipboard(widgetsToCopy)
        await refreshClipboard()
    }, [getSelectedWidgets, refreshClipboard])

    const handleCutSelected = useCallback(async () => {
        const selected = getSelectedWidgets()
        if (selected.length === 0) return

        const widgetsToCut = selected.map(item => item.widget)
        const cutMetadata = {
            instanceId: instanceId,
            widgetPaths: selected.map(item => item.widgetPath),
            widgets: {}
        }

        selected.forEach(({ widget, slotName }) => {
            if (!cutMetadata.widgets[slotName]) {
                cutMetadata.widgets[slotName] = []
            }
            cutMetadata.widgets[slotName].push(widget.id)
        })

        setCutWidgets(new Set(selected.map(item => item.widgetPath)))
        await cutWidgetsToClipboard(widgetsToCut, cutMetadata)
        await refreshClipboard()
    }, [getSelectedWidgets, instanceId, refreshClipboard])

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
                // Fetch all available widgets as fallback (matches backend behavior)
                setIsFilteringTypes(true)
                try {
                    const { widgetsApi } = await import('../api')
                    const allWidgets = await widgetsApi.getTypes(true)
                    setFilteredWidgetTypes(allWidgets || [])
                } catch (error) {
                    console.error('[ObjectContentEditor] Error fetching all widgets:', error)
                    setFilteredWidgetTypes([])
                }
                setIsFilteringTypes(false)
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
                <div>No widget slots configured</div>
            </div>
        )
    }

    const handleAddWidget = async (slotName, widgetTypeToAdd = null) => {
        const slot = objectType.slotConfiguration.slots.find(s => s.name === slotName)
        if (!slot) return

        let widgetType = 'easy_widgets.ContentWidget'
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

        // Create new widget object
        const newWidget = {
            id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: widgetType,
            config: widgetConfig,
            name: getWidgetDisplayName(widgetType, widgetTypes) || widgetType
        }

        // Optimistically update local state
        const currentSlotWidgets = normalizedWidgets[slotName] || []
        const updatedWidgets = {
            ...normalizedWidgets,
            [slotName]: [...currentSlotWidgets, newWidget]
        }
        setInternalWidgets(updatedWidgets)

        // Publish to Unified Data Context (for persistence and other subscribers)
        const addWidgetPayload = {
            id: newWidget.id,
            type: newWidget.type,
            config: newWidget.config,
            slot: slotName,
            contextType: contextType,
            order: currentSlotWidgets.length
        }
        await publishUpdate(componentId, OperationTypes.ADD_WIDGET, addWidgetPayload)
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

        // Optimistically update local state
        const updatedWidgets = { ...normalizedWidgets }
        if (updatedWidgets[slotName]) {
            updatedWidgets[slotName] = updatedWidgets[slotName].filter((_, i) => i !== widgetIndex)
        }
        setInternalWidgets(updatedWidgets)

        // Publish removal to Unified Data Context
        if (widget?.id) {
            await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                id: widget.id,
                contextType: contextType
            })
        }

        // Remove from selection if selected
        const widgetPath = buildWidgetPath(slotName, widget.id)
        if (selectedWidgets.has(widgetPath)) {
            setSelectedWidgets(prev => {
                const newSet = new Set(prev)
                newSet.delete(widgetPath)
                return newSet
            })
        }
    }

    const handleDeleteCutWidgets = useCallback(async (cutMetadata) => {
        const sourceInstanceId = cutMetadata.instanceId
        const isCrossObject = sourceInstanceId && instanceId && sourceInstanceId !== instanceId

        if (isCrossObject) {
            if (cutMetadata.widgetPaths) {
                for (const widgetPath of cutMetadata.widgetPaths) {
                    const parsed = parseWidgetPath(widgetPath)
                    if (!parsed) continue
                    await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                        id: parsed.widgetId,
                        contextType: contextType,
                        instanceId: sourceInstanceId
                    })
                }
            }
            return
        }

        const updatedWidgets = { ...normalizedWidgets }
        let hasChanges = false

        if (cutMetadata.widgetPaths) {
            for (const widgetPath of cutMetadata.widgetPaths) {
                const parsed = parseWidgetPath(widgetPath)
                if (!parsed) continue

                if (updatedWidgets[parsed.slotName]) {
                    const originalLength = updatedWidgets[parsed.slotName].length
                    updatedWidgets[parsed.slotName] = updatedWidgets[parsed.slotName].filter(
                        w => w.id !== parsed.widgetId
                    )
                    if (updatedWidgets[parsed.slotName].length !== originalLength) {
                        hasChanges = true
                        await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                            id: parsed.widgetId,
                            contextType: contextType
                        })
                    }
                }
            }
        }

        if (hasChanges) {
            setInternalWidgets(updatedWidgets)
        }
        setCutWidgets(new Set())
        setSelectedWidgets(new Set())
    }, [normalizedWidgets, instanceId, publishUpdate, componentId, contextType, parseWidgetPath])

    const handlePasteAtPosition = useCallback(async (slotName, position, keepClipboard = false) => {
        if (!clipboardData || !clipboardData.data || clipboardData.data.length === 0) return

        const widgetsToPaste = clipboardData.data
        const isCut = clipboardData.operation === 'cut'

        const pastedWidgets = widgetsToPaste.map(w => ({
            ...w,
            id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }))

        const slotWidgets = [...(normalizedWidgets[slotName] || [])]
        slotWidgets.splice(position, 0, ...pastedWidgets)

        const updatedWidgets = {
            ...normalizedWidgets,
            [slotName]: slotWidgets
        }
        setInternalWidgets(updatedWidgets)

        for (let i = 0; i < pastedWidgets.length; i++) {
            const widget = pastedWidgets[i]
            await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                id: widget.id,
                type: widget.type,
                config: widget.config,
                slot: slotName,
                contextType: contextType,
                order: position + i
            })
        }

        if (isCut && clipboardData.metadata) {
            await handleDeleteCutWidgets(clipboardData.metadata)
        }

        if (!keepClipboard || isCut) {
            await clearClipboardState()
        }
    }, [clipboardData, normalizedWidgets, publishUpdate, componentId, contextType, handleDeleteCutWidgets, clearClipboardState])

    // Move widget up in the slot
    const handleMoveWidgetUp = async (slotName, widgetIndex, widget) => {
        if (widgetIndex <= 0) return // Can't move the first widget up

        // Optimistically update local state
        const slotWidgets = [...(normalizedWidgets[slotName] || [])]
        const [movedWidget] = slotWidgets.splice(widgetIndex, 1)
        slotWidgets.splice(widgetIndex - 1, 0, movedWidget)
        const updatedWidgets = {
            ...normalizedWidgets,
            [slotName]: slotWidgets
        }
        setInternalWidgets(updatedWidgets)

        // Publish move operation to UDC
        await publishUpdate(componentId, OperationTypes.MOVE_WIDGET, {
            id: widget.id,
            slotName,
            fromIndex: widgetIndex,
            toIndex: widgetIndex - 1,
            contextType: contextType
        })
    }

    // Move widget down in the slot
    const handleMoveWidgetDown = async (slotName, widgetIndex, widget) => {
        const slotWidgets = normalizedWidgets[slotName] || []
        if (widgetIndex >= slotWidgets.length - 1) {
            return // Can't move the last widget down
        }

        // Optimistically update local state
        const currentSlotWidgets = [...slotWidgets]
        const [movedWidget] = currentSlotWidgets.splice(widgetIndex, 1)
        currentSlotWidgets.splice(widgetIndex + 1, 0, movedWidget)
        const updatedWidgets = {
            ...normalizedWidgets,
            [slotName]: currentSlotWidgets
        }
        setInternalWidgets(updatedWidgets)

        // Publish move operation to UDC
        await publishUpdate(componentId, OperationTypes.MOVE_WIDGET, {
            id: widget.id,
            slotName,
            fromIndex: widgetIndex,
            toIndex: widgetIndex + 1,
            contextType: contextType
        })
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

    // Import content handlers
    const handleImportContent = useCallback((slotName) => {
        setImportSlotName(slotName)
        setImportDialogOpen(true)
    }, [])

    const handleImportComplete = useCallback(async (importedWidgets, metadata = {}) => {
        if (!importSlotName || !importedWidgets || importedWidgets.length === 0) return

        const currentSlotWidgets = normalizedWidgets[importSlotName] || []
        const updatedWidgets = {
            ...normalizedWidgets,
            [importSlotName]: [...currentSlotWidgets, ...importedWidgets]
        }
        setInternalWidgets(updatedWidgets)

        for (const widget of importedWidgets) {
            await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                id: widget.id,
                type: widget.type,
                config: widget.config,
                slot: importSlotName,
                contextType: contextType,
                order: currentSlotWidgets.length + importedWidgets.indexOf(widget)
            })
        }

        if (metadata.pageWasUpdated) {
            await publishUpdate(componentId, OperationTypes.RELOAD_DATA, {
                reason: 'Object metadata updated during import',
                updatedFields: ['title', 'tags'],
            })
        }
    }, [importSlotName, normalizedWidgets, publishUpdate, componentId, contextType])

    // Clear all widgets in a slot
    const handleClearSlot = async (slotName) => {
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)
        const existingWidgetsInSlot = normalizedWidgets[slotName] || []

        // Optimistically update local state
        const updatedWidgets = {
            ...normalizedWidgets,
            [slotName]: []
        }
        setInternalWidgets(updatedWidgets)

        // Publish removal of all widgets in the slot to Unified Data Context
        for (const w of existingWidgetsInSlot) {
            await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                id: w.id, contextType: contextType,
            })
        }

        // Clear any selections for this slot
        setSelectedWidgets(prev => {
            const newSet = new Set(prev)
            existingWidgetsInSlot.forEach(w => {
                newSet.delete(buildWidgetPath(slotName, w.id))
            })
            return newSet
        })
    }

    // Handle ObjectEditor-specific slot actions
    const handleSlotAction = useCallback(async (action, slotName, widget) => {
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)

        switch (action) {
            case 'duplicate':
                if (widget) {
                    // Create duplicated widget object
                    const newWidget = {
                        ...widget,
                        id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        name: `${widget.name} (Copy)`
                    }

                    // Optimistically update local state
                    const currentSlotWidgets = normalizedWidgets[slotName] || []
                    const updatedWidgets = {
                        ...normalizedWidgets,
                        [slotName]: [...currentSlotWidgets, newWidget]
                    }
                    setInternalWidgets(updatedWidgets)

                    // Publish duplication as add operation to UDC
                    await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                        id: newWidget.id,
                        type: newWidget.type,
                        config: newWidget.config,
                        slot: slotName,
                        contextType: contextType,
                        order: currentSlotWidgets.length
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
    }, [objectType, publishUpdate, componentId, normalizedWidgets, contextType])

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

            // Optimistically update local state
            const updatedWidgets = { ...normalizedWidgets };
            updatedWidgets[slotName] = [...currentWidgets];
            updatedWidgets[slotName][widgetIndex] = updatedWidget;
            setInternalWidgets(updatedWidgets);

            // Update editingWidget if this is the widget being edited
            if (editingWidget && editingWidget.id === widgetId) {
                setEditingWidget({
                    ...updatedWidget,
                    slotName: editingWidget.slotName // Preserve slotName
                });
            }

            // Note: Config updates are handled via UDC publishUpdate in the save handler
            // This is just the local preview during editing
        }
    }, [normalizedWidgets, editingWidget]);

    const renderWidget = (widget, slotName, index) => {
        const slotWidgets = normalizedWidgets[slotName] || []
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)

        // Create a unique key that combines slot name, widget ID, and index to prevent collisions
        const uniqueKey = widget.id ? `${slotName}-${widget.id}-${index}` : `${slotName}-index-${index}`;

        return (
            <div key={uniqueKey} className="relative">
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
                    className="mb-2"
                    context={{ ...context, componentId }}
                    // Selection props
                    isWidgetSelected={isWidgetSelected(slotName, widget.id)}
                    isWidgetCut={isWidgetCut(slotName, widget.id)}
                    onToggleWidgetSelection={toggleWidgetSelection}
                    // Paste mode props
                    pasteModeActive={pasteModeActive}
                    onPasteAtPosition={handlePasteAtPosition}
                />
            </div>
        )
    }

    const renderSlot = (slot) => {
        const slotWidgets = normalizedWidgets[slot.name] || []

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
                    onImportContent={handleImportContent}
                    context={context}
                    // Paste mode props
                    pasteModeActive={pasteModeActive}
                    onPasteAtPosition={handlePasteAtPosition}
                />

                {/* Slot Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center">
                            <Layout className="h-4 w-4 mr-2 text-gray-400" />
                            <div className="text-sm font-medium text-gray-900" role="heading" aria-level="4">
                                {slot.label}
                                <span className="ml-2 text-xs text-gray-500">
                                    ({slotWidgets.length} widgets)
                                </span>
                                {slot.required && (
                                    <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                        Required
                                    </span>
                                )}
                            </div>
                        </div>
                        {(slot.description || slot.maxWidgets) && (
                            <div className="text-xs text-gray-500 mt-1 ml-6">
                                {slot.description}
                                {slot.maxWidgets && (slot.description ? ` • Max: ${slot.maxWidgets}` : `Max: ${slot.maxWidgets}`)}
                            </div>
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
                        <div className="slot-placeholder p-4 border-2 border-dashed border-gray-300 text-center text-gray-500">
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

    const totalSelections = getSelectedCount()

    // Only count widgets in slots that are configured for this object type
    const totalWidgets = useMemo(() => {
        if (!objectType?.slotConfiguration?.slots) return 0

        return objectType.slotConfiguration.slots.reduce((total, slot) => {
            const slotWidgets = normalizedWidgets[slot.name] || []
            return total + slotWidgets.length
        }, 0)
    }, [normalizedWidgets, objectType?.slotConfiguration?.slots])

    // ESC and right-click handlers to pause paste mode
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && pasteModeActive && !pasteModePaused) {
                togglePasteMode()
            }
        }

        const handleContextMenu = (e) => {
            if (pasteModeActive && !pasteModePaused) {
                e.preventDefault()
                togglePasteMode()
            }
        }

        document.addEventListener('keydown', handleEscape)
        document.addEventListener('contextmenu', handleContextMenu)

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.removeEventListener('contextmenu', handleContextMenu)
        }
    }, [pasteModeActive, pasteModePaused, togglePasteMode])

    // Reset toolbar collapse when selection changes
    useEffect(() => {
        if (totalSelections === 0) {
            setIsToolbarCollapsed(false)
        }
    }, [totalSelections])

    return (
        <div className="space-y-4 relative">
            {/* Bulk Action Toolbar - Floating */}
            {totalSelections > 0 && (
                <>
                    {isToolbarCollapsed ? (
                        <button
                            onClick={() => setIsToolbarCollapsed(false)}
                            className="fixed top-4 right-4 z-[10010] bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-all hover:scale-110 flex items-center justify-center"
                            title={`${totalSelections} widget${totalSelections !== 1 ? 's' : ''} selected - Click to expand`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{totalSelections}</span>
                                <ChevronUp className="h-4 w-4" />
                            </div>
                        </button>
                    ) : (
                        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[10010] bg-white border border-gray-300 rounded-lg shadow-xl px-4 py-2 flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">
                                {totalSelections} widget{totalSelections !== 1 ? 's' : ''} selected
                            </span>
                            <div className="h-4 w-px bg-gray-300"></div>
                            <button
                                onClick={handleCopySelected}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
                                title="Copy selected widgets"
                            >
                                <Clipboard className="h-4 w-4" />
                                Copy
                            </button>
                            <button
                                onClick={handleCutSelected}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
                                title="Cut selected widgets"
                            >
                                <Scissors className="h-4 w-4" />
                                Cut
                            </button>
                            <button
                                onClick={clearSelection}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
                                title="Clear selection"
                            >
                                <X className="h-4 w-4" />
                                Clear
                            </button>
                            <div className="h-4 w-px bg-gray-300"></div>
                            <button
                                onClick={() => setIsToolbarCollapsed(true)}
                                className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                                title="Collapse toolbar"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Slots */}
            <div className="space-y-4">
                {objectType.slotConfiguration.slots.map(renderSlot)}
            </div>

            {objectType.slotConfiguration.slots.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <Layout className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <div className="text-lg font-medium text-gray-900 mb-2" role="heading" aria-level="4">No Slots Configured</div>
                    <div>This object type doesn't have any widget slots configured.</div>
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

            <ImportDialog
                isOpen={importDialogOpen}
                onClose={() => {
                    setImportDialogOpen(false)
                    setImportSlotName(null)
                }}
                slotName={importSlotName}
                // For objects, we don't have pageId, but we might have instanceId
                // ImportDialog might need to be adapted or passed null
                onImportComplete={handleImportComplete}
            />
        </div>
    )
}

ObjectContentEditor.displayName = 'ObjectContentEditor'

export default ObjectContentEditor

