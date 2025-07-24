import { useState, useEffect, useRef } from 'react'
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
    ArrowDown,
    Code,
    Layout,
    Search,
    Target,
    CheckCircle,
    XCircle,
    Info
} from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useNotificationContext } from './NotificationManager'
import WidgetLibrary from './WidgetLibrary'
import WidgetConfigurator from './WidgetConfigurator'
import TemplateLayoutRenderer from './TemplateLayoutRenderer'
import WidgetPortalManager from './WidgetPortalManager'
import {
    getPageWidgets,
    addWidget,
    updateWidget,
    deleteWidget,
    toggleWidgetVisibility,
    reorderWidgets,
    getWidgetsBySlot,
    createWidgetHelper
} from '../api/versions'
import { SlotStateFactory } from '../utils/slotState'
import { widgetHelpers, createWidgetModel } from '../utils/widgetHelpers'
import { useHtmlSlots } from '../hooks/useHtmlSlots'

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

// Enhanced HTML Slot Card Component for template-based layouts
const HtmlSlotCard = ({
    slot,
    widgets = [],
    isActive = false,
    onAddWidget,
    onEditWidget,
    onDeleteWidget,
    onSlotClick,
    onSlotValidate
}) => {
    const [isHighlighted, setIsHighlighted] = useState(false)

    const handleSlotClick = () => {
        if (onSlotClick) onSlotClick(slot)
        setIsHighlighted(!isHighlighted)
    }

    const slotValidation = slot.isValid ?
        { isValid: true, errors: [], warnings: [] } :
        { isValid: false, errors: slot.errors || [], warnings: slot.warnings || [] }

    return (
        <div className={`
            bg-white border rounded-lg transition-all duration-200
            ${isActive ? 'border-blue-500 shadow-lg' : 'border-gray-200'}
            ${isHighlighted ? 'ring-2 ring-blue-200' : ''}
            ${!slotValidation.isValid ? 'border-red-300 bg-red-50' : ''}
        `}>
            {/* Slot Header */}
            <div
                className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                onClick={handleSlotClick}
            >
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center space-x-2">
                            <Target className="w-4 h-4 text-gray-400" />
                            <h4 className="font-medium text-gray-900">
                                {slot.display_name || slot.name}
                            </h4>
                            {!slotValidation.isValid && (
                                <XCircle className="w-4 h-4 text-red-500" />
                            )}
                            {slotValidation.isValid && widgets.length === 0 && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                    Empty
                                </span>
                            )}
                            {widgets.length > 0 && (
                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                                    {widgets.length} widget{widgets.length !== 1 ? 's' : ''}
                                </span>
                            )}
                            {slot.max_widgets && (
                                <span className="text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded">
                                    Max: {slot.max_widgets}
                                </span>
                            )}
                        </div>
                        {slot.description && (
                            <p className="text-sm text-gray-500 mt-1">
                                {slot.description}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onAddWidget(slot)
                        }}
                        disabled={slot.max_widgets && widgets.length >= slot.max_widgets}
                        className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Widget
                    </button>
                </div>

                {/* Validation Errors */}
                {!slotValidation.isValid && (
                    <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded text-sm">
                        <div className="flex items-center space-x-1 text-red-700 font-medium mb-1">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Slot Validation Errors</span>
                        </div>
                        <ul className="text-red-600 space-y-1 text-xs">
                            {slotValidation.errors.map((error, index) => (
                                <li key={index}>• {error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Validation Warnings */}
                {slotValidation.warnings.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-100 border border-yellow-200 rounded text-sm">
                        <div className="flex items-center space-x-1 text-yellow-700 font-medium mb-1">
                            <Info className="w-4 h-4" />
                            <span>Warnings</span>
                        </div>
                        <ul className="text-yellow-600 space-y-1 text-xs">
                            {slotValidation.warnings.map((warning, index) => (
                                <li key={index}>• {warning}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Slot Widgets */}
            <div className="p-4">
                {widgets.length > 0 ? (
                    <div className="space-y-3">
                        {widgets.map((widget, index) => (
                            <WidgetCard
                                key={widget.id}
                                widget={widget}
                                index={index}
                                totalWidgets={widgets.length}
                                onEdit={onEditWidget}
                                onDelete={onDeleteWidget}
                                onMove={(widget, direction) => {
                                    // HTML slots don't support traditional move operations
                                    // This could be enhanced with drag-and-drop in the future
                                    toast.info('Widget reordering in HTML slots will be available soon')
                                }}
                                onVisibilityToggle={(widget) => {
                                    // Visibility toggle still works for HTML slots
                                    onVisibilityToggle?.(widget)
                                }}
                                onPriorityChange={(widget, priority) => {
                                    // Priority changes still work for HTML slots
                                    onPriorityChange?.(widget, priority)
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        <Layers className="w-6 h-6 mx-auto mb-2" />
                        <p className="text-sm">No widgets in this slot</p>
                        <p className="text-xs">Click "Add Widget" to get started</p>
                        {slot.allowed_widget_types && slot.allowed_widget_types.length > 0 && (
                            <p className="text-xs mt-1 text-gray-400">
                                Accepts: {slot.allowed_widget_types.join(', ')}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Slot Debug Info (development only) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="border-t border-gray-200 p-3 bg-gray-50">
                    <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                            Debug Info
                        </summary>
                        <div className="mt-2 space-y-1 text-gray-500">
                            <div>Selector: {slot.selector}</div>
                            <div>Element: {slot.element ? 'Available' : 'Missing'}</div>
                            <div>CSS Classes: {slot.css_classes || 'None'}</div>
                            {slot.responsive && <div>Responsive: Yes</div>}
                        </div>
                    </details>
                </div>
            )}
        </div>
    )
}

// HTML Slot Detection Panel
const HtmlSlotDetectionPanel = ({
    validation,
    slotsConfiguration,
    onSlotHighlight,
    onSlotUnhighlight,
    onRefreshSlots
}) => {
    const stats = {
        total: slotsConfiguration.length,
        valid: slotsConfiguration.filter(s => s.isValid).length,
        invalid: slotsConfiguration.filter(s => !s.isValid).length,
        empty: slotsConfiguration.filter(s => !s.widgets || s.widgets.length === 0).length
    }

    return (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">HTML Slot Detection</h3>
                <button
                    onClick={onRefreshSlots}
                    className="inline-flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                    <Search className="w-4 h-4 mr-1" />
                    Refresh
                </button>
            </div>

            {/* Detection Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                    <div className="text-xs text-gray-500">Total Slots</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.valid}</div>
                    <div className="text-xs text-gray-500">Valid</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{stats.invalid}</div>
                    <div className="text-xs text-gray-500">Invalid</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{stats.empty}</div>
                    <div className="text-xs text-gray-500">Empty</div>
                </div>
            </div>

            {/* Validation Status */}
            <div className={`p-3 rounded-lg ${validation.isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center space-x-2">
                    {validation.isValid ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-medium ${validation.isValid ? 'text-green-800' : 'text-red-800'}`}>
                        {validation.isValid ? 'All slots are valid' : `${validation.errors.length} validation error(s)`}
                    </span>
                </div>

                {!validation.isValid && validation.errors.length > 0 && (
                    <ul className="mt-2 text-sm text-red-700 space-y-1">
                        {validation.errors.slice(0, 3).map((error, index) => (
                            <li key={index}>• {error}</li>
                        ))}
                        {validation.errors.length > 3 && (
                            <li className="text-red-600">... and {validation.errors.length - 3} more</li>
                        )}
                    </ul>
                )}

                {validation.warnings.length > 0 && (
                    <div className="mt-2">
                        <div className="text-yellow-700 font-medium text-sm">Warnings:</div>
                        <ul className="text-sm text-yellow-600 space-y-1">
                            {validation.warnings.slice(0, 2).map((warning, index) => (
                                <li key={index}>• {warning}</li>
                            ))}
                            {validation.warnings.length > 2 && (
                                <li className="text-yellow-600">... and {validation.warnings.length - 2} more</li>
                            )}
                        </ul>
                    </div>
                )}
            </div>

            {/* Slot Actions */}
            <div className="flex space-x-2 mt-4">
                <button
                    onClick={onSlotHighlight}
                    className="flex-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                    Highlight All Slots
                </button>
                <button
                    onClick={onSlotUnhighlight}
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                    Remove Highlights
                </button>
            </div>
        </div>
    )
}

const SlotManager = ({ pageId, layout, onWidgetChange }) => {
    const [selectedSlot, setSelectedSlot] = useState(null)
    const [showWidgetLibrary, setShowWidgetLibrary] = useState(false)
    const [editingWidget, setEditingWidget] = useState(null)
    const [configuringWidget, setConfiguringWidget] = useState(null)
    const queryClient = useQueryClient()
    const { showConfirm } = useNotificationContext()

    // References for HTML slot detection
    const templateContainerRef = useRef(null)

    // Fetch page widgets from current version
    const { data: pageWidgetsData, isLoading } = useQuery({
        queryKey: ['page-widgets', pageId],
        queryFn: async () => {
            const result = await getPageWidgets(pageId)
            return result.widgets || []
        },
        enabled: !!pageId
    })

    // Create slot state manager
    const slotState = SlotStateFactory.createFromQuery({ widgets: pageWidgetsData })

    // Check if this is a template-based layout
    const isTemplateBasedLayout = layout?.template_based || layout?.html

    // HTML slot detection for template-based layouts
    const htmlSlots = useHtmlSlots({
        containerElement: templateContainerRef.current,
        layout,
        widgetsBySlot: slotState.getWidgetsBySlot(),
        autoDetect: isTemplateBasedLayout,
        observeChanges: false,
        enableHighlighting: true,
        onSlotChange: (slotsConfig) => {
            // Notify parent component of slot changes if needed
            onWidgetChange?.()
        },
        onSlotValidation: (validation) => {
            if (!validation.isValid) {
                console.warn('HTML slot validation issues:', validation.errors)
            }
        },
        onSlotError: (errors) => {
            errors.forEach(error => toast.error(error))
        }
    })

    // Use detected HTML slots for template layouts, fallback to layout configuration for code layouts
    const slots = isTemplateBasedLayout ? htmlSlots.slotsConfiguration : (layout.slot_configuration?.slots || [])
    const widgetsBySlot = slotState.getWidgetsBySlot()

    // Fetch widget types for the library - now returns direct array
    const { data: widgetTypes } = useQuery({
        queryKey: ['widget-types'],
        queryFn: async () => {
            const response = await axios.get('/api/v1/webpages/widget-types/')
            // New API returns direct array, filter active ones
            return response.data?.filter(widget => widget.is_active) || []
        }
    })

    // Widget mutations using new API
    const createWidgetMutation = useMutation({
        mutationFn: async ({ widgetTypeName, slotName, configuration }) => {
            return addWidget(pageId, {
                widget_type_id: widgetTypeName,
                slot_name: slotName,
                configuration,
                sort_order: 0,
                inherit_from_parent: true,
                override_parent: false,
                inheritance_behavior: 'inherit',
                priority: 0,
                is_visible: true
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['page-widgets', pageId])
            setShowWidgetLibrary(false)
            setConfiguringWidget(null)
            onWidgetChange?.()
            toast.success('Widget added successfully')
        },
        onError: (error) => {
            toast.error('Failed to add widget: ' + error.message)
        }
    })

    const updateWidgetMutation = useMutation({
        mutationFn: async ({ widgetId, configuration }) => {
            return updateWidget(pageId, widgetId, { configuration })
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['page-widgets', pageId])
            setEditingWidget(null)
            setConfiguringWidget(null)
            onWidgetChange?.()
            toast.success('Widget updated successfully')
        },
        onError: (error) => {
            toast.error('Failed to update widget: ' + error.message)
        }
    })

    const deleteWidgetMutation = useMutation({
        mutationFn: async (widgetId) => {
            return deleteWidget(pageId, widgetId)
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['page-widgets', pageId])
            onWidgetChange?.()
            toast.success('Widget deleted successfully')
        },
        onError: (error) => {
            toast.error('Failed to delete widget: ' + error.message)
        }
    })

    const toggleVisibilityMutation = useMutation({
        mutationFn: async (widgetId) => {
            return toggleWidgetVisibility(pageId, widgetId)
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['page-widgets', pageId])
            onWidgetChange?.()
        },
        onError: (error) => {
            toast.error('Failed to toggle visibility: ' + error.message)
        }
    })

    const reorderWidgetMutation = useMutation({
        mutationFn: async ({ slotName, widgetOrders }) => {
            return reorderWidgets(pageId, slotName, widgetOrders)
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['page-widgets', pageId])
            onWidgetChange?.()
            toast.success('Widgets reordered successfully')
        },
        onError: (error) => {
            toast.error('Failed to reorder widgets: ' + error.message)
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
            widgetTypeName: configuringWidget.widgetType.name, // Use name instead of ID
            slotName: configuringWidget.slotName,
            configuration,
            ...inheritanceSettings
        })
    }

    const handleEditWidget = (widget) => {
        const widgetType = widgetTypes?.find(wt => wt.name === widget.widget_type)
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

    const handleDeleteWidget = async (widget) => {
        const validation = slotState.validateWidgetAction(widget, 'delete')

        if (!validation.isValid) {
            validation.errors.forEach(error => toast.error(error))
            return
        }

        const confirmed = await showConfirm({
            title: 'Delete Widget',
            message: 'Are you sure you want to delete this widget?',
            confirmText: 'Delete',
            confirmButtonStyle: 'danger'
        })

        if (confirmed) {
            deleteWidgetMutation.mutate(widget.id)
        }
    }

    const handlePriorityChange = (widget, newPriority) => {
        updateWidgetMutation.mutate({
            widgetId: widget.id,
            configuration: widget.configuration,
            priority: parseInt(newPriority) || 0
        })
    }

    const handleVisibilityToggle = (widget) => {
        toggleVisibilityMutation.mutate(widget.id)
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

        // Update the specific widget's sort order
        updateWidgetMutation.mutate({
            widgetId: widget.id,
            sort_order: newSortOrder
        })
    }

    // HTML slot management handlers
    const handleSlotClick = (slot) => {
        if (isTemplateBasedLayout) {
            htmlSlots.setActiveSlot(slot.name)
        }
    }

    const handleSlotHighlight = () => {
        if (isTemplateBasedLayout) {
            htmlSlots.highlightSlots()
        }
    }

    const handleSlotUnhighlight = () => {
        if (isTemplateBasedLayout) {
            htmlSlots.unhighlightSlots()
        }
    }

    const handleRefreshSlots = () => {
        if (isTemplateBasedLayout) {
            htmlSlots.detectSlots()
        }
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

    // Variables will be defined above after HTML slot detection

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

    // For template-based layouts, use the new template renderer with portal system
    if (isTemplateBasedLayout) {
        return (
            <div className="space-y-6">
                {/* Header with template indicator */}
                <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center space-x-2">
                                <h3 className="text-lg font-medium text-gray-900">Template Layout: {layout.name}</h3>
                                <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">
                                    <Layout className="w-3 h-3 mr-1" />
                                    HTML Template
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                                Widgets are managed through React portals in the HTML template structure
                            </p>
                        </div>
                    </div>
                </div>

                {/* HTML Slot Detection Panel */}
                <HtmlSlotDetectionPanel
                    validation={htmlSlots.validation}
                    slotsConfiguration={htmlSlots.slotsConfiguration}
                    onSlotHighlight={handleSlotHighlight}
                    onSlotUnhighlight={handleSlotUnhighlight}
                    onRefreshSlots={handleRefreshSlots}
                />

                {/* Template-based layout renderer with portal management */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div ref={templateContainerRef}>
                        <TemplateLayoutRenderer
                            layout={layout}
                            widgetsBySlot={widgetsBySlot}
                            mode="edit"
                            showInheritance={true}
                            onWidgetEdit={handleEditWidget}
                            onWidgetAdd={handleAddWidget}
                            onSlotClick={handleSlotClick}
                            className="min-h-96"
                        />
                    </div>

                    {/* Widget portal manager for actual widget mounting */}
                    <WidgetPortalManager
                        slotElements={htmlSlots.slotElements}
                        widgetsBySlot={widgetsBySlot}
                        layout={layout}
                        mode="edit"
                        showInheritance={true}
                        onWidgetEdit={handleEditWidget}
                        onWidgetAdd={handleAddWidget}
                        onWidgetDelete={(widgetId) => {
                            const widget = pageWidgetsData?.find(w => w.id === widgetId)
                            if (widget) handleDeleteWidget(widget)
                        }}
                        showManagementOverlay={true}
                    />
                </div>

                {/* Enhanced HTML Slot Management Grid */}
                {htmlSlots.hasSlots && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-gray-900">HTML Slots</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {htmlSlots.slotsConfiguration.map((slot) => {
                                const slotWidgets = widgetsBySlot[slot.name] || []
                                return (
                                    <HtmlSlotCard
                                        key={slot.name}
                                        slot={slot}
                                        widgets={slotWidgets}
                                        isActive={htmlSlots.activeSlot === slot.name}
                                        onAddWidget={handleAddWidget}
                                        onEditWidget={handleEditWidget}
                                        onDeleteWidget={handleDeleteWidget}
                                        onSlotClick={handleSlotClick}
                                        onVisibilityToggle={handleVisibilityToggle}
                                        onPriorityChange={handlePriorityChange}
                                    />
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* No slots detected message */}
                {!htmlSlots.hasSlots && !htmlSlots.isDetecting && (
                    <div className="bg-white rounded-lg shadow p-8">
                        <div className="text-center text-gray-500">
                            <Search className="w-8 h-8 mx-auto mb-2" />
                            <p>No HTML slots detected in this template.</p>
                            <p className="text-sm mt-1">
                                Add <code className="bg-gray-100 px-1 rounded">data-widget-slot="slot-name"</code> attributes to HTML elements to create slots.
                            </p>
                        </div>
                    </div>
                )}

                {/* Template layout debugging info (development only) */}
                {process.env.NODE_ENV === 'development' && (
                    <div className="bg-gray-50 rounded-lg p-4">
                        <details className="text-sm">
                            <summary className="font-medium text-gray-700 cursor-pointer">
                                Template Debug Info
                            </summary>
                            <div className="mt-2 space-y-2 text-gray-600">
                                <div>Template File: {layout.template_file || 'Not specified'}</div>
                                <div>HTML Length: {layout.html?.length || 0} characters</div>
                                <div>CSS Length: {layout.css?.length || 0} characters</div>
                                <div>Slots: {slots.length}</div>
                                <div>Total Widgets: {Object.values(widgetsBySlot).flat().length}</div>
                            </div>
                        </details>
                    </div>
                )}

                {/* Widget Library Modal */}
                {showWidgetLibrary && (
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-10 flex items-center justify-center z-50">
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
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-10 flex items-center justify-center z-50">
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
                    <div className="fixed inset-0 bg-gray-600 bg-opacity-10 flex items-center justify-center z-50">
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

    // Traditional code-based layout rendering
    return (
        <div className="space-y-6">
            {/* Header with code-based indicator */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">Code Layout: {layout.name}</h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs">
                        <Code className="w-3 h-3 mr-1" />
                        Code-Based
                    </span>
                </div>
                <p className="text-sm text-gray-600">
                    Traditional slot-based widget management with drag-and-drop interface
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
                <div className="fixed inset-0 bg-gray-600 bg-opacity-10 flex items-center justify-center z-50">
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
                <div className="fixed inset-0 bg-gray-600 bg-opacity-10 flex items-center justify-center z-50">
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
                <div className="fixed inset-0 bg-gray-600 bg-opacity-10 flex items-center justify-center z-50">
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