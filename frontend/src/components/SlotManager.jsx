import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Plus,
    Trash2,
    Edit3,
    Move,
    Eye,
    EyeOff,
    ChevronUp,
    ChevronDown,
    Settings,
    Layers,
    AlertCircle,
    GripVertical,
    Hash,
    ArrowUp,
    ArrowDown
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import WidgetLibrary from './WidgetLibrary'
import WidgetConfigurator from './WidgetConfigurator'
import { WidgetCommandFactory, WidgetOperations } from '../utils/widgetCommands'
import { SlotStateFactory } from '../utils/slotState'
import { widgetHelpers, createWidgetModel } from '../utils/widgetHelpers'

// Extracted component for widget action buttons
const WidgetActionButtons = ({
    widget,
    index,
    totalWidgets,
    onEdit,
    onDelete,
    onMove,
    onVisibilityToggle
}) => (
    <div className="flex items-center space-x-1">
        {/* Visibility toggle */}
        {!createWidgetModel(widget, widget.widget_type).isInherited() && (
            <button
                onClick={() => onVisibilityToggle(widget)}
                className={`p-1 ${createWidgetModel(widget, widget.widget_type).isVisible()
                    ? 'text-green-600 hover:text-green-700'
                    : 'text-gray-400 hover:text-gray-600'
                    }`}
                title={createWidgetModel(widget, widget.widget_type).isVisible() ? 'Hide widget' : 'Show widget'}
            >
                {createWidgetModel(widget, widget.widget_type).isVisible() ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
        )}

        {/* Move buttons */}
        {!createWidgetModel(widget, widget.widget_type).isInherited() && (
            <>
                <button
                    onClick={() => onMove(widget, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    title="Move up"
                >
                    <ArrowUp className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onMove(widget, 'down')}
                    disabled={index === totalWidgets - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    title="Move down"
                >
                    <ArrowDown className="w-4 h-4" />
                </button>
            </>
        )}

        {/* Edit button */}
        <button
            onClick={() => onEdit(widget)}
            className="p-1 text-blue-600 hover:text-blue-700"
            title="Edit widget"
        >
            <Edit3 className="w-4 h-4" />
        </button>

        {/* Delete button */}
        {!createWidgetModel(widget, widget.widget_type).isInherited() && (
            <button
                onClick={() => onDelete(widget)}
                className="p-1 text-red-600 hover:text-red-700"
                title="Delete widget"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        )}
    </div>
)

// Extracted component for widget priority controls
const WidgetPriorityControls = ({ widget, onPriorityChange }) => {
    const widgetModel = createWidgetModel(widget, widget.widget_type)
    if (widgetModel.isInherited()) return null

    return (
        <div className="flex items-center space-x-4 pt-2 border-t border-gray-100">
            <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-600">Priority:</label>
                <input
                    type="number"
                    min="0"
                    max="100"
                    value={widgetModel.getPriority()}
                    onChange={(e) => onPriorityChange(widget, e.target.value)}
                    className="w-16 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
            </div>
            <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600">
                    Behavior: {widgetModel.getInheritanceBehavior()}
                </span>
            </div>
            {widget.max_inheritance_depth && (
                <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-600">
                        Max depth: {widget.max_inheritance_depth}
                    </span>
                </div>
            )}
        </div>
    )
}

// Extracted component for individual widget card
const WidgetCard = ({
    widget,
    index,
    totalWidgets,
    onEdit,
    onDelete,
    onMove,
    onVisibilityToggle,
    onPriorityChange
}) => {
    // Use WidgetModel for cleaner property access
    const widgetModel = createWidgetModel(widget, widget.widget_type)

    return (
        <div className={`p-3 border rounded-lg transition-colors ${widgetModel.getCardClasses()}`}>
            {/* Widget Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                    <div className="flex items-center space-x-2">
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <h5 className="font-medium text-gray-900">
                            {widgetModel.getTypeName()}
                        </h5>
                        {widgetModel.isInherited() && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                Inherited
                            </span>
                        )}
                        {widgetModel.getPriority() > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                <Hash className="w-3 h-3 mr-1" />
                                {widgetModel.getPriority()}
                            </span>
                        )}
                        {!widgetModel.isVisible() && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                Hidden
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        {widgetModel.getTypeDescription()}
                    </p>
                </div>

                <WidgetActionButtons
                    widget={widget}
                    index={index}
                    totalWidgets={totalWidgets}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMove={onMove}
                    onVisibilityToggle={onVisibilityToggle}
                />
            </div>

            <WidgetPriorityControls
                widget={widget}
                onPriorityChange={onPriorityChange}
            />
        </div>
    )
}

const SlotManager = ({ pageId, layout, onWidgetChange }) => {
    const [selectedSlot, setSelectedSlot] = useState(null)
    const [showWidgetLibrary, setShowWidgetLibrary] = useState(false)
    const [editingWidget, setEditingWidget] = useState(null)
    const [configuringWidget, setConfiguringWidget] = useState(null)
    const queryClient = useQueryClient()

    // Initialize command factory and operations
    const commandFactory = new WidgetCommandFactory(axios)
    const widgetOperations = new WidgetOperations(commandFactory, queryClient)

    // Fetch page widgets including inherited ones
    const { data: pageWidgetsData, isLoading } = useQuery({
        queryKey: ['page-widgets', pageId],
        queryFn: async () => {
            const response = await axios.get(`/api/v1/webpages/widgets/by_page/?page_id=${pageId}`)
            return response.data.widgets || []
        },
        enabled: !!pageId
    })

    // Create slot state manager
    const slotState = SlotStateFactory.createFromQuery({ widgets: pageWidgetsData })

    // Fetch widget types for the library
    const { data: widgetTypesResponse } = useQuery({
        queryKey: ['widget-types'],
        queryFn: async () => {
            const response = await axios.get('/api/v1/webpages/widget-types/')
            return response.data
        }
    })

    // Extract widget types array from paginated response and filter active ones
    const widgetTypes = widgetTypesResponse?.results?.filter(widget => widget.is_active) || []

    // Simplified mutations using command objects
    const createWidgetMutation = useMutation({
        mutationFn: async ({ widgetTypeId, slotName, configuration }) => {
            return widgetOperations.addWidget({
                pageId,
                widgetTypeId,
                slotName,
                configuration
            })
        },
        onSuccess: () => {
            setShowWidgetLibrary(false)
            setConfiguringWidget(null)
            onWidgetChange?.()
        }
    })

    const updateWidgetMutation = useMutation({
        mutationFn: async ({ widgetId, configuration }) => {
            return widgetOperations.updateWidget({
                widgetId,
                configuration,
                pageId
            })
        },
        onSuccess: () => {
            setEditingWidget(null)
            onWidgetChange?.()
        }
    })

    const deleteWidgetMutation = useMutation({
        mutationFn: async (widgetId) => {
            return widgetOperations.deleteWidget({
                widgetId,
                pageId
            })
        },
        onSuccess: () => {
            onWidgetChange?.()
        }
    })

    const reorderWidgetMutation = useMutation({
        mutationFn: async ({ widgetId, newSortOrder }) => {
            return widgetOperations.reorderWidget({
                widgetId,
                newSortOrder,
                pageId
            })
        },
        onSuccess: () => {
            onWidgetChange?.()
        }
    })

    const handleAddWidget = (slot) => {
        setSelectedSlot(slot)
        setShowWidgetLibrary(true)
    }

    const handleSelectWidget = (widgetType) => {
        setConfiguringWidget({
            widgetType,
            slotName: selectedSlot.name
        })
        setShowWidgetLibrary(false)
    }

    const handleConfigureSave = (saveData) => {
        const { configuration, ...inheritanceSettings } = saveData
        createWidgetMutation.mutate({
            widgetTypeId: configuringWidget.widgetType.id,
            slotName: configuringWidget.slotName,
            configuration,
            ...inheritanceSettings
        })
    }

    const handleEditWidget = (widget) => {
        const widgetType = widgetTypes?.find(wt => wt.id === widget.widget_type.id)
        setEditingWidget({
            widget,
            widgetType
        })
    }

    const handleEditSave = (saveData) => {
        const { configuration, ...inheritanceSettings } = saveData
        updateWidgetMutation.mutate({
            widgetId: editingWidget.widget.id,
            configuration,
            ...inheritanceSettings
        })
    }

    const handleDeleteWidget = (widget) => {
        const validation = slotState.validateWidgetAction(widget, 'delete')

        if (!validation.isValid) {
            validation.errors.forEach(error => toast.error(error))
            return
        }

        if (window.confirm('Are you sure you want to delete this widget?')) {
            deleteWidgetMutation.mutate(widget.id)
        }
    }

    const handlePriorityChange = (widget, newPriority) => {
        updateWidgetMutation.mutate({
            widgetId: widget.id,
            priority: parseInt(newPriority) || 0
        })
    }

    const handleVisibilityToggle = (widget) => {
        updateWidgetMutation.mutate({
            widgetId: widget.id,
            is_visible: !widget.is_visible
        })
    }

    const handleMoveWidget = (widget, direction) => {
        const validation = slotState.validateWidgetAction(widget, 'move')

        if (!validation.isValid) {
            validation.errors.forEach(error => toast.error(error))
            return
        }

        const newSortOrder = slotState.getMoveSortOrder(widget, direction)

        if (newSortOrder === null) {
            return
        }

        reorderWidgetMutation.mutate({
            widgetId: widget.id,
            newSortOrder
        })
    }

    if (!layout) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center text-gray-500">
                    <Layers className="w-8 h-8 mx-auto mb-2" />
                    <p>No layout selected. Please select a layout to manage widgets.</p>
                </div>
            </div>
        )
    }

    const slots = layout.slot_configuration?.slots || []
    const widgetsBySlot = slotState.getWidgetsBySlot()

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-24 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Widget Management</h3>
                <p className="text-sm text-gray-600">
                    Layout: <strong>{layout.name}</strong> - Manage widgets in each slot
                </p>
            </div>

            {/* Slots */}
            {slots.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {slots.map((slot) => {
                        const slotWidgets = widgetsBySlot[slot.name] || []

                        return (
                            <div key={slot.name} className="bg-white rounded-lg shadow">
                                {/* Slot Header */}
                                <div className="p-4 border-b border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-medium text-gray-900">
                                                {slot.display_name || slot.name}
                                            </h4>
                                            {slot.description && (
                                                <p className="text-sm text-gray-500 mt-1">
                                                    {slot.description}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleAddWidget(slot)}
                                            className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            <Plus className="w-4 h-4 mr-1" />
                                            Add Widget
                                        </button>
                                    </div>
                                </div>

                                {/* Slot Widgets */}
                                <div className="p-4">
                                    {slotWidgets.length > 0 ? (
                                        <div className="space-y-3">
                                            {slotWidgets.map((widget, index) => (
                                                <WidgetCard
                                                    key={widget.id}
                                                    widget={widget}
                                                    index={index}
                                                    totalWidgets={slotWidgets.length}
                                                    onEdit={handleEditWidget}
                                                    onDelete={handleDeleteWidget}
                                                    onMove={handleMoveWidget}
                                                    onVisibilityToggle={handleVisibilityToggle}
                                                    onPriorityChange={handlePriorityChange}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            <Layers className="w-6 h-6 mx-auto mb-2" />
                                            <p className="text-sm">No widgets in this slot</p>
                                            <p className="text-xs">Click "Add Widget" to get started</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow p-8">
                    <div className="text-center text-gray-500">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                        <p>This layout has no slots defined.</p>
                        <p className="text-sm mt-1">Edit the layout to add slots before managing widgets.</p>
                    </div>
                </div>
            )}

            {/* Widget Library Modal */}
            {showWidgetLibrary && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden">
                        <div className="p-4 border-b">
                            <h3 className="text-lg font-medium">
                                Add Widget to "{selectedSlot?.display_name || selectedSlot?.name}"
                            </h3>
                        </div>
                        <div className="overflow-y-auto max-h-[70vh]">
                            <WidgetLibrary
                                onSelectWidget={handleSelectWidget}
                            />
                        </div>
                        <div className="p-4 border-t">
                            <button
                                onClick={() => {
                                    setShowWidgetLibrary(false)
                                    setSelectedSlot(null)
                                }}
                                className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Widget Configuration Modal */}
            {configuringWidget && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden">
                        <div className="overflow-y-auto max-h-[90vh]">
                            <WidgetConfigurator
                                widgetType={configuringWidget.widgetType}
                                onSave={handleConfigureSave}
                                onCancel={() => setConfiguringWidget(null)}
                                title={`Add ${configuringWidget.widgetType.name}`}
                                showInheritanceControls={true}
                                isEditing={false}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Widget Edit Modal */}
            {editingWidget && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden">
                        <div className="overflow-y-auto max-h-[90vh]">
                            <WidgetConfigurator
                                widgetType={editingWidget.widgetType}
                                initialConfig={editingWidget.widget.configuration}
                                initialInheritanceSettings={widgetHelpers.extractInheritanceSettings(editingWidget.widget)}
                                onSave={handleEditSave}
                                onCancel={() => setEditingWidget(null)}
                                title={`Edit ${editingWidget.widgetType.name}`}
                                showInheritanceControls={true}
                                isEditing={true}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SlotManager 