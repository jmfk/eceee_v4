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
    // 1. STATE & HOOKS (Top level)
    const [selectedWidgets, setSelectedWidgets] = useState(() => new Set())
    const [cutWidgets, setCutWidgets] = useState(() => new Set())
    const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false)
    const { clipboardData, pasteModeActive, pasteModePaused, togglePasteMode, clearClipboardState, refreshClipboard } = useClipboard()
    const { useExternalChanges, publishUpdate } = useUnifiedData()
    const [widgetEditorOpen, setWidgetEditorOpen] = useState(false)
    const [editingWidget, setEditingWidget] = useState(null)
    const widgetEditorRef = useRef(null)
    const [widgetModalOpen, setWidgetModalOpen] = useState(false)
    const [selectedSlotForModal, setSelectedSlotForModal] = useState(null)
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [importSlotName, setImportSlotName] = useState(null)
    const contextType = useEditorContext()
    const [internalWidgets, setInternalWidgets] = useState(widgets)
    const isInitialized = useRef(false)
    const internalWidgetsRef = useRef(internalWidgets)
    const instanceId = context.instanceId
    const componentId = useMemo(() => `object-content-editor-${instanceId || 'new'}`, [instanceId])
    const normalizedWidgets = useMemo(() => internalWidgets, [internalWidgets])
    const normalizedWidgetsRef = useRef(internalWidgets)
    const { widgetTypes } = useWidgets(internalWidgets)
    const [filteredWidgetTypes, setFilteredWidgetTypes] = useState([])
    const [isFilteringTypes, setIsFilteringTypes] = useState(false)

    // 2. EFFECTS
    useEffect(() => {
        internalWidgetsRef.current = internalWidgets
        normalizedWidgetsRef.current = internalWidgets
    }, [internalWidgets])

    useEffect(() => {
        if (!isInitialized.current) {
            setInternalWidgets(widgets)
            isInitialized.current = true
        }
    }, [widgets])

    useEffect(() => {
        if (clipboardData?.operation === 'cut' && clipboardData.metadata?.widgetPaths) {
            setCutWidgets(new Set(clipboardData.metadata.widgetPaths))
        } else if (clipboardData?.operation === 'cut' && clipboardData.metadata?.widgets) {
            const paths = []
            Object.entries(clipboardData.metadata.widgets).forEach(([slot, ids]) => {
                ids.forEach(id => paths.push(`${slot}/${id}`))
            })
            setCutWidgets(new Set(paths))
        } else {
            setCutWidgets(new Set())
        }
    }, [clipboardData])

    useExternalChanges(componentId, (state) => {
        if (state && instanceId) {
            const objectData = state.objects?.[instanceId]
            if (objectData?.widgets) {
                const newWidgets = objectData.widgets
                const currentWidgets = internalWidgetsRef.current
                const allSlots = new Set([...Object.keys(newWidgets), ...Object.keys(currentWidgets)])
                const structureChanged = Array.from(allSlots).some(slotName => {
                    const newSlot = newWidgets[slotName] || []
                    const currentSlot = currentWidgets[slotName] || []
                    if (newSlot.length !== currentSlot.length) return true
                    return newSlot.some((w, idx) => w.id !== currentSlot[idx]?.id)
                })
                if (structureChanged) setInternalWidgets(newWidgets)
            }
        }
    })

    const rawAvailableWidgetTypes = useMemo(() => {
        const slots = objectType?.slotConfiguration?.slots
        if (!slots) return []
        const allWidgetControls = []
        slots.forEach(slot => {
            if (slot.widgetControls && Array.isArray(slot.widgetControls)) {
                slot.widgetControls.forEach(control => {
                    if (!allWidgetControls.some(existing => existing.widgetType === control.widgetType)) {
                        allWidgetControls.push({
                            type: control.widgetType,
                            display_name: control.label || getWidgetDisplayName(control.widgetType, widgetTypes),
                            name: control.label || getWidgetDisplayName(control.widgetType, widgetTypes),
                            defaultConfig: control.defaultConfig || {},
                            widgetType: control.widgetType
                        })
                    }
                })
            }
        })
        return allWidgetControls
    }, [objectType, widgetTypes])

    useEffect(() => {
        const filterTypes = async () => {
            setIsFilteringTypes(true)
            try {
                if (rawAvailableWidgetTypes.length === 0) {
                    const { widgetsApi } = await import('../api')
                    const allWidgets = await widgetsApi.getTypes(true)
                    setFilteredWidgetTypes(allWidgets || [])
                } else {
                    const filtered = await filterAvailableWidgetTypes(rawAvailableWidgetTypes)
                    setFilteredWidgetTypes(filtered)
                }
            } catch (error) {
                console.error('Error filtering widget types:', error)
                setFilteredWidgetTypes(rawAvailableWidgetTypes)
            } finally {
                setIsFilteringTypes(false)
            }
        }
        filterTypes()
    }, [rawAvailableWidgetTypes])

    useEffect(() => {
        const handleEscape = (e) => { if (e.key === 'Escape' && pasteModeActive && !pasteModePaused) togglePasteMode() }
        const handleContextMenu = (e) => { if (pasteModeActive && !pasteModePaused) { e.preventDefault(); togglePasteMode() } }
        document.addEventListener('keydown', handleEscape)
        document.addEventListener('contextmenu', handleContextMenu)
        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.removeEventListener('contextmenu', handleContextMenu)
        }
    }, [pasteModeActive, pasteModePaused, togglePasteMode])

    useEffect(() => { if (selectedWidgets.size === 0) setIsToolbarCollapsed(false) }, [selectedWidgets.size])

    // 3. HANDLERS
    const buildWidgetPath = useCallback((slotName, widgetId) => `${slotName}/${widgetId}`, [])
    const parseWidgetPath = useCallback((widgetPath) => {
        const parts = widgetPath.split('/')
        return parts.length === 2 ? { slotName: parts[0], widgetId: parts[1] } : null
    }, [])

    const toggleWidgetSelection = useCallback((slotName, widgetId) => {
        const widgetPath = buildWidgetPath(slotName, widgetId)
        setSelectedWidgets(prev => {
            const newSet = new Set(prev)
            if (newSet.has(widgetPath)) newSet.delete(widgetPath)
            else newSet.add(widgetPath)
            return newSet
        })
    }, [buildWidgetPath])

    const isWidgetSelected = useCallback((slotName, widgetId) => selectedWidgets.has(buildWidgetPath(slotName, widgetId)), [selectedWidgets, buildWidgetPath])
    const isWidgetCut = useCallback((slotName, widgetId) => cutWidgets.has(buildWidgetPath(slotName, widgetId)), [cutWidgets, buildWidgetPath])
    const getSelectedCount = useCallback(() => selectedWidgets.size, [selectedWidgets])

    const getSelectedWidgets = useCallback(() => {
        const selected = []
        selectedWidgets.forEach(widgetPath => {
            const parsed = parseWidgetPath(widgetPath)
            if (!parsed) return
            const slotWidgets = internalWidgetsRef.current[parsed.slotName] || []
            const widget = slotWidgets.find(w => w.id === parsed.widgetId)
            if (widget) selected.push({ widget, slotName: parsed.slotName, widgetPath })
        })
        return selected
    }, [selectedWidgets, parseWidgetPath])

    const handleCopySelected = useCallback(async () => {
        const selected = getSelectedWidgets()
        if (selected.length === 0) return
        await copyWidgetsToClipboard(selected.map(item => item.widget))
        await refreshClipboard()
    }, [getSelectedWidgets, refreshClipboard])

    const handleCutSelected = useCallback(async () => {
        const selected = getSelectedWidgets()
        if (selected.length === 0) return
        const widgetsToCut = selected.map(item => item.widget)
        const cutMetadata = { instanceId, widgetPaths: selected.map(item => item.widgetPath), widgets: {} }
        selected.forEach(({ widget, slotName }) => {
            if (!cutMetadata.widgets[slotName]) cutMetadata.widgets[slotName] = []
            cutMetadata.widgets[slotName].push(widget.id)
        })
        setCutWidgets(new Set(selected.map(item => item.widgetPath)))
        await cutWidgetsToClipboard(widgetsToCut, cutMetadata)
        await refreshClipboard()
    }, [getSelectedWidgets, instanceId, refreshClipboard])

    const clearSelection = useCallback(() => {
        setSelectedWidgets(new Set())
        setCutWidgets(new Set())
    }, [])

    const handleAddWidget = useCallback(async (slotName, widgetTypeToAdd = null) => {
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)
        if (!slot) return
        let widgetType = widgetTypeToAdd || (slot.widgetControls?.[0]?.widgetType) || 'easy_widgets.ContentWidget'
        const widgetControl = slot.widgetControls?.find(c => c.widgetType === widgetType)
        const widgetConfig = widgetControl?.defaultConfig || createDefaultWidgetConfig(widgetType)
        const newWidget = {
            id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: widgetType, config: widgetConfig,
            name: getWidgetDisplayName(widgetType, widgetTypes) || widgetType
        }
        const currentSlotWidgets = internalWidgetsRef.current[slotName] || []
        setInternalWidgets(prev => ({ ...prev, [slotName]: [...(prev[slotName] || []), newWidget] }))
        await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
            id: newWidget.id, type: newWidget.type, config: newWidget.config,
            slot: slotName, contextType, order: currentSlotWidgets.length
        })
    }, [objectType, widgetTypes, componentId, contextType, publishUpdate])

    const handleOpenWidgetEditor = useCallback((widgetData) => {
        if (editingWidget?.id === widgetData.id) {
            setWidgetEditorOpen(false)
            setEditingWidget(null)
        } else {
            setEditingWidget(widgetData)
            setWidgetEditorOpen(true)
        }
    }, [editingWidget])

    const handleCloseWidgetEditor = useCallback(() => {
        setWidgetEditorOpen(false)
        setEditingWidget(null)
    }, [])

    const handleSaveWidget = useCallback(async (updatedWidget) => {
        if (!editingWidget) return
        const slotName = editingWidget.slotName || 'main'
        await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: updatedWidget.id, slotName, contextType, config: updatedWidget.config
        })
        handleCloseWidgetEditor()
    }, [editingWidget, componentId, contextType, handleCloseWidgetEditor, publishUpdate])

    const handleDeleteCutWidgets = useCallback(async (cutMetadata) => {
        const sourceInstanceId = cutMetadata.instanceId
        if (sourceInstanceId && instanceId && sourceInstanceId !== instanceId) {
            if (cutMetadata.widgetPaths) {
                for (const widgetPath of cutMetadata.widgetPaths) {
                    const parsed = parseWidgetPath(widgetPath)
                    if (parsed) await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                        id: parsed.widgetId, contextType, instanceId: sourceInstanceId
                    })
                }
            }
            return
        }
        const updatedWidgets = { ...internalWidgetsRef.current }
        let hasChanges = false
        if (cutMetadata.widgetPaths) {
            for (const widgetPath of cutMetadata.widgetPaths) {
                const parsed = parseWidgetPath(widgetPath)
                if (parsed && updatedWidgets[parsed.slotName]) {
                    const originalLength = updatedWidgets[parsed.slotName].length
                    updatedWidgets[parsed.slotName] = updatedWidgets[parsed.slotName].filter(w => w.id !== parsed.widgetId)
                    if (updatedWidgets[parsed.slotName].length !== originalLength) {
                        hasChanges = true
                        await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, { id: parsed.widgetId, contextType })
                    }
                }
            }
        }
        if (hasChanges) setInternalWidgets(updatedWidgets)
        setCutWidgets(new Set())
        setSelectedWidgets(new Set())
    }, [instanceId, publishUpdate, componentId, contextType, parseWidgetPath])

    const handlePasteAtPosition = useCallback(async (slotName, position, keepClipboard = false) => {
        if (!clipboardData?.data?.length) return
        const pastedWidgets = clipboardData.data.map(w => ({
            ...w, id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }))
        const slotWidgets = [...(internalWidgetsRef.current[slotName] || [])]
        slotWidgets.splice(position, 0, ...pastedWidgets)
        setInternalWidgets(prev => ({ ...prev, [slotName]: slotWidgets }))
        for (let i = 0; i < pastedWidgets.length; i++) {
            await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                id: pastedWidgets[i].id, type: pastedWidgets[i].type, config: pastedWidgets[i].config,
                slot: slotName, contextType, order: position + i
            })
        }
        if (clipboardData.operation === 'cut' && clipboardData.metadata) await handleDeleteCutWidgets(clipboardData.metadata)
        if (!keepClipboard || clipboardData.operation === 'cut') await clearClipboardState()
    }, [clipboardData, componentId, contextType, handleDeleteCutWidgets, clearClipboardState, publishUpdate])

    const handleEditWidget = useCallback((slotName, widgetIndex, widget) => {
        handleOpenWidgetEditor({
            ...widget, slotName,
            context: { ...context, slotName, widgetId: widget?.id, mode: 'edit', contextType }
        })
    }, [handleOpenWidgetEditor, context, contextType])

    const handleDeleteWidget = useCallback(async (slotName, widgetIndex, widget) => {
        setInternalWidgets(prev => {
            const next = { ...prev }
            if (next[slotName]) next[slotName] = next[slotName].filter((_, i) => i !== widgetIndex)
            return next
        })
        if (widget?.id) await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, { id: widget.id, contextType })
        const widgetPath = buildWidgetPath(slotName, widget.id)
        setSelectedWidgets(prev => {
            if (!prev.has(widgetPath)) return prev
            const next = new Set(prev)
            next.delete(widgetPath)
            return next
        })
    }, [componentId, contextType, publishUpdate, buildWidgetPath])

    const handleMoveWidget = useCallback(async (slotName, widgetIndex, widget, direction) => {
        const slotWidgets = [...(internalWidgetsRef.current[slotName] || [])]
        const newIndex = direction === 'up' ? widgetIndex - 1 : widgetIndex + 1
        if (newIndex < 0 || newIndex >= slotWidgets.length) return
        const [moved] = slotWidgets.splice(widgetIndex, 1)
        slotWidgets.splice(newIndex, 0, moved)
        setInternalWidgets(prev => ({ ...prev, [slotName]: slotWidgets }))
        await publishUpdate(componentId, OperationTypes.MOVE_WIDGET, {
            id: widget.id, slotName, fromIndex: widgetIndex, toIndex: newIndex, contextType
        })
    }, [componentId, contextType, publishUpdate])

    const handleClearSlot = useCallback(async (slotName) => {
        const existing = internalWidgetsRef.current[slotName] || []
        setInternalWidgets(prev => ({ ...prev, [slotName]: [] }))
        for (const w of existing) await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, { id: w.id, contextType })
        setSelectedWidgets(prev => {
            const next = new Set(prev)
            existing.forEach(w => next.delete(buildWidgetPath(slotName, w.id)))
            return next
        })
    }, [componentId, contextType, publishUpdate, buildWidgetPath])

    const handleImportContent = useCallback((slotName) => {
        setImportSlotName(slotName)
        setImportDialogOpen(true)
    }, [])

    const handleImportComplete = useCallback(async (importedWidgets, metadata = {}) => {
        if (!importSlotName || !importedWidgets?.length) return
        const current = internalWidgetsRef.current[importSlotName] || []
        setInternalWidgets(prev => ({ ...prev, [importSlotName]: [...(prev[importSlotName] || []), ...importedWidgets] }))
        for (let i = 0; i < importedWidgets.length; i++) {
            await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                id: importedWidgets[i].id, type: importedWidgets[i].type, config: importedWidgets[i].config,
                slot: importSlotName, contextType, order: current.length + i
            })
        }
        if (metadata.pageWasUpdated) await publishUpdate(componentId, OperationTypes.RELOAD_DATA, {
            reason: 'Import update', updatedFields: ['title', 'tags']
        })
    }, [importSlotName, componentId, contextType, publishUpdate])

    const handleSlotAction = useCallback(async (action, slotName, widget) => {
        if (action === 'duplicate' && widget) {
            const newWidget = {
                ...widget, id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: `${widget.name} (Copy)`
            }
            const current = internalWidgetsRef.current[slotName] || []
            setInternalWidgets(prev => ({ ...prev, [slotName]: [...(prev[slotName] || []), newWidget] }))
            await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                id: newWidget.id, type: newWidget.type, config: newWidget.config,
                slot: slotName, contextType, order: current.length
            })
        }
    }, [componentId, contextType, publishUpdate])

    const stableConfigChangeHandler = useCallback(async (widgetId, slotName, newConfig) => {
        const current = internalWidgetsRef.current[slotName] || []
        const idx = current.findIndex(w => w.id === widgetId)
        if (idx !== -1) {
            const updated = { ...current[idx], config: newConfig }
            setInternalWidgets(prev => {
                const next = { ...prev }
                next[slotName] = [...(prev[slotName] || [])]
                next[slotName][idx] = updated
                return next
            })
            if (editingWidget?.id === widgetId) setEditingWidget({ ...updated, slotName })
        }
    }, [editingWidget])

    const handleShowWidgetModal = useCallback((slot) => {
        setSelectedSlotForModal(slot)
        setWidgetModalOpen(true)
    }, [])

    const handleCloseWidgetModal = useCallback(() => {
        setWidgetModalOpen(false)
        setSelectedSlotForModal(null)
    }, [])

    const handleWidgetSelection = useCallback((widgetType) => {
        if (selectedSlotForModal) {
            handleAddWidget(selectedSlotForModal.name, widgetType)
        }
        handleCloseWidgetModal()
    }, [selectedSlotForModal, handleAddWidget, handleCloseWidgetModal])

    // 4. Render helpers (Hoisted via function declaration)
    function renderWidget(widget, slotName, index) {
        const slotWidgets = normalizedWidgets[slotName] || []
        const slot = objectType?.slotConfiguration?.slots?.find(s => s.name === slotName)
        return (
            <div key={widget.id || `${slotName}-${index}`} className="relative">
                <ObjectWidgetFactory
                    widget={widget} slotName={slotName} index={index}
                    onEdit={handleEditWidget} onDelete={handleDeleteWidget}
                    onMoveUp={(s, i, w) => handleMoveWidget(s, i, w, 'up')}
                    onMoveDown={(s, i, w) => handleMoveWidget(s, i, w, 'down')}
                    onConfigChange={stableConfigChangeHandler}
                    canMoveUp={index > 0} canMoveDown={index < slotWidgets.length - 1}
                    mode="editor" showControls={true} objectType={objectType} slotConfig={slot}
                    onSlotAction={handleSlotAction} allowedWidgetTypes={filteredWidgetTypes?.map(w => w.type) || []}
                    maxWidgets={slot?.maxWidgets} widgetId={widget.id} className="mb-2"
                    context={{ ...context, componentId, instanceId }}
                    isWidgetSelected={isWidgetSelected(slotName, widget.id)}
                    isWidgetCut={isWidgetCut(slotName, widget.id)}
                    onToggleWidgetSelection={toggleWidgetSelection}
                    pasteModeActive={pasteModeActive}
                    onPasteAtPosition={handlePasteAtPosition}
                />
            </div>
        )
    }

    function renderSlot(slot) {
        const slotWidgets = normalizedWidgets[slot.name] || []
        return (
            <div key={slot.name} className="relative border p-4 transition-colors border-gray-200 min-h-[100px]" data-slot-name={slot.name} data-slot-title={slot.label}>
                <SlotIconMenu
                    slotName={slot.name} slot={slot} availableWidgetTypes={filteredWidgetTypes}
                    isFilteringTypes={isFilteringTypes} onAddWidget={handleAddWidget}
                    onClearSlot={handleClearSlot} onShowWidgetModal={handleShowWidgetModal}
                    onImportContent={handleImportContent} context={context}
                    pasteModeActive={pasteModeActive} onPasteAtPosition={handlePasteAtPosition}
                />
                <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center">
                            <Layout className="h-4 w-4 mr-2 text-gray-400" />
                            <div className="text-sm font-medium text-gray-900" role="heading" aria-level="4">
                                {slot.label} <span className="ml-2 text-xs text-gray-500">({slotWidgets.length} widgets)</span>
                                {slot.required && <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Required</span>}
                            </div>
                        </div>
                        {(slot.description || slot.maxWidgets) && (
                            <div className="text-xs text-gray-500 mt-1 ml-6">
                                {slot.description} {slot.maxWidgets && `• Max: ${slot.maxWidgets}`}
                            </div>
                        )}
                    </div>
                </div>
                <div className="space-y-2">
                    {slotWidgets.length > 0 ? (
                        <div className="space-y-1">{slotWidgets.map((w, i) => renderWidget(w, slot.name, i))}</div>
                    ) : (
                        <div className="slot-placeholder p-4 border-2 border-dashed border-gray-300 text-center text-gray-500">
                            <div className="text-sm font-medium">{slot.label}</div>
                            {slot.description && <div className="text-xs mt-1">{slot.description}</div>}
                            <div className="text-xs mt-2 opacity-75">Click ••• to add widgets</div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    // 5. Final render
    const slots = objectType?.slotConfiguration?.slots
    if (!slots || !Array.isArray(slots) || slots.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <Layout className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <div>No widget slots configured</div>
            </div>
        )
    }

    const totalSelections = getSelectedCount()

    return (
        <div className="space-y-4 relative">
            {totalSelections > 0 && (
                <>
                    {isToolbarCollapsed ? (
                        <button onClick={() => setIsToolbarCollapsed(false)} className="fixed top-4 right-4 z-[10010] bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg transition-all hover:scale-110 flex items-center justify-center">
                            <div className="flex items-center gap-2"><span className="text-sm font-semibold">{totalSelections}</span><ChevronUp className="h-4 w-4" /></div>
                        </button>
                    ) : (
                        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[10010] bg-white border border-gray-300 rounded-lg shadow-xl px-4 py-2 flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-700">{totalSelections} widget{totalSelections !== 1 ? 's' : ''} selected</span>
                            <div className="h-4 w-px bg-gray-300"></div>
                            <button onClick={handleCopySelected} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"><Clipboard className="h-4 w-4" />Copy</button>
                            <button onClick={handleCutSelected} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"><Scissors className="h-4 w-4" />Cut</button>
                            <button onClick={clearSelection} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"><X className="h-4 w-4" />Clear</button>
                            <div className="h-4 w-px bg-gray-300"></div>
                            <button onClick={() => setIsToolbarCollapsed(true)} className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"><ChevronDown className="h-4 w-4" /></button>
                        </div>
                    )}
                </>
            )}
            <div className="space-y-4">{slots.map(renderSlot)}</div>
            <WidgetSelectionModal
                isOpen={widgetModalOpen} onClose={handleCloseWidgetModal}
                onSelectWidget={handleWidgetSelection} slot={selectedSlotForModal}
                availableWidgetTypes={filteredWidgetTypes} isFilteringTypes={isFilteringTypes} context={context}
            />
            <ImportDialog
                isOpen={importDialogOpen} onClose={() => { setImportDialogOpen(false); setImportSlotName(null) }}
                slotName={importSlotName} onImportComplete={handleImportComplete}
            />
        </div>
    )
}

ObjectContentEditor.displayName = 'ObjectContentEditor'
export default ObjectContentEditor
