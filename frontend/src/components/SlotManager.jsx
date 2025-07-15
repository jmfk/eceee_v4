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
    AlertCircle
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import WidgetLibrary from './WidgetLibrary'
import WidgetConfigurator from './WidgetConfigurator'
import { WidgetCommandFactory, WidgetOperations } from '../utils/widgetCommands'
import { SlotStateFactory } from '../utils/slotState'

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
            const response = await axios.get(`/api/webpages/api/widgets/by_page/?page_id=${pageId}`)
            return response.data.widgets || []
        },
        enabled: !!pageId
    })

    // Create slot state manager
    const slotState = SlotStateFactory.createFromQuery({ widgets: pageWidgetsData })

    // Fetch widget types for the library
    const { data: widgetTypes } = useQuery({
        queryKey: ['widget-types'],
        queryFn: async () => {
            const response = await axios.get('/api/webpages/api/widget-types/')
            return response.data.filter(widget => widget.is_active)
        }
    })

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

    const handleConfigureSave = (configuration) => {
        createWidgetMutation.mutate({
            widgetTypeId: configuringWidget.widgetType.id,
            slotName: configuringWidget.slotName,
            configuration
        })
    }

    const handleEditWidget = (widget) => {
        const widgetType = widgetTypes?.find(wt => wt.id === widget.widget_type.id)
        setEditingWidget({
            widget,
            widgetType
        })
    }

    const handleEditSave = (configuration) => {
        updateWidgetMutation.mutate({
            widgetId: editingWidget.widget.id,
            configuration
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
                                                <div
                                                    key={widget.id}
                                                    className={`p-3 border rounded-lg ${widget.is_inherited
                                                        ? 'border-orange-200 bg-orange-50'
                                                        : 'border-gray-200 bg-white'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center space-x-2">
                                                                <h5 className="font-medium text-gray-900">
                                                                    {widget.widget_type.name}
                                                                </h5>
                                                                {widget.is_inherited && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                                        Inherited
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {widget.widget_type.description}
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center space-x-1">
                                                            {/* Move buttons */}
                                                            {!widget.is_inherited && (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleMoveWidget(widget, 'up')}
                                                                        disabled={index === 0}
                                                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                                                        title="Move up"
                                                                    >
                                                                        <ChevronUp className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleMoveWidget(widget, 'down')}
                                                                        disabled={index === slotWidgets.length - 1}
                                                                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                                                        title="Move down"
                                                                    >
                                                                        <ChevronDown className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}

                                                            {/* Edit button */}
                                                            <button
                                                                onClick={() => handleEditWidget(widget)}
                                                                className="p-1 text-blue-600 hover:text-blue-700"
                                                                title="Edit widget"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>

                                                            {/* Delete button */}
                                                            {!widget.is_inherited && (
                                                                <button
                                                                    onClick={() => handleDeleteWidget(widget)}
                                                                    className="p-1 text-red-600 hover:text-red-700"
                                                                    title="Delete widget"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
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
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
                        <div className="overflow-y-auto max-h-[90vh]">
                            <WidgetConfigurator
                                widgetType={configuringWidget.widgetType}
                                onSave={handleConfigureSave}
                                onCancel={() => setConfiguringWidget(null)}
                                title={`Add ${configuringWidget.widgetType.name}`}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Widget Edit Modal */}
            {editingWidget && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
                        <div className="overflow-y-auto max-h-[90vh]">
                            <WidgetConfigurator
                                widgetType={editingWidget.widgetType}
                                initialConfig={editingWidget.widget.configuration}
                                onSave={handleEditSave}
                                onCancel={() => setEditingWidget(null)}
                                title={`Edit ${editingWidget.widgetType.name}`}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SlotManager 