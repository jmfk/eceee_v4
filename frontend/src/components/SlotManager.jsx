import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Plus,
    Package,
    AlertTriangle,
    Loader2,
    Code,
    Layout,
    Search,
    Layers
} from 'lucide-react'
import { api } from '../api/client'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'

import WidgetLibrary from './WidgetLibrary'
import WidgetConfigurator from './WidgetConfigurator'
import TemplateLayoutRenderer from './TemplateLayoutRenderer'
import WidgetPortalManager from './WidgetPortalManager'
import HtmlSlotCard from './slot-manager/HtmlSlotCard'
import HtmlSlotDetectionPanel from './slot-manager/HtmlSlotDetectionPanel'
import WidgetCard from './slot-manager/WidgetCard'
import {
    getPageWidgets,
    updateWidget,
    deleteWidget,
    addWidget
} from '../api/versions'
import { SlotStateFactory } from '../utils/slotState'
import { widgetHelpers, createWidgetModel } from '../utils/widgetHelpers'
import { useHtmlSlots } from '../hooks/useHtmlSlots'

/**
 * Enhanced SlotManager component for managing widget layouts
 * 
 * Supports both traditional code-based layouts and new HTML-based layouts with:
 * - Automatic slot detection from HTML templates
 * - Visual slot management with React Portals
 * - Widget inheritance and priority system
 * - Comprehensive validation and error handling
 */
const SlotManager = ({ pageId, layout, onWidgetChange }) => {
    const [selectedSlot, setSelectedSlot] = useState(null)
    const [showWidgetLibrary, setShowWidgetLibrary] = useState(false)
    const [editingWidget, setEditingWidget] = useState(null)
    const [configuringWidget, setConfiguringWidget] = useState(null)
    const queryClient = useQueryClient()
    const templateContainerRef = useRef(null)
    const { addNotification } = useGlobalNotifications()

    // Fetch page widgets
    const { data: pageWidgetsData = [], isLoading, error, refetch } = useQuery({
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
            onWidgetChange?.()
        },
        onSlotValidation: (validation) => {
            if (!validation.isValid) {
                console.warn('HTML slot validation issues:', validation.errors)
            }
        },
        onSlotError: (errors) => {
            errors.forEach(error => addNotification(error, 'error', 'slot-error'))
        }
    })

    // Use detected HTML slots for template layouts, fallback to layout configuration for code layouts
    const slots = isTemplateBasedLayout ? htmlSlots.slotsConfiguration : (layout.slot_configuration?.slots || [])
    const widgetsBySlot = slotState.getWidgetsBySlot()

    // Fetch widget types for the library
    const { data: widgetTypes } = useQuery({
        queryKey: ['widget-types'],
        queryFn: async () => {
            const response = await api.get('/api/v1/webpages/widget-types/')
            return response.data.results || response.data
        }
    })

    // Widget mutations
    const createWidgetMutation = useMutation({
        mutationFn: ({ page, ...widgetData }) => addWidget(page, widgetData, 'Added widget'),
        onSuccess: () => {
            queryClient.invalidateQueries(['page-widgets', pageId])
            addNotification('Widget created successfully', 'success', 'widget-create')
            onWidgetChange?.()
        },
        onError: (error) => {
            addNotification('Failed to create widget', 'error', 'widget-create')
        }
    })

    const updateWidgetMutation = useMutation({
        mutationFn: ({ widgetId, data }) => updateWidget(pageId, widgetId, data, 'Updated widget'),
        onSuccess: () => {
            queryClient.invalidateQueries(['page-widgets', pageId])
            addNotification('Widget updated successfully', 'success', 'widget-update')
            onWidgetChange?.()
        },
        onError: (error) => {
            addNotification('Failed to update widget', 'error', 'widget-update')
        }
    })

    const deleteWidgetMutation = useMutation({
        mutationFn: ({ widgetId }) => deleteWidget(pageId, widgetId, 'Deleted widget'),
        onSuccess: () => {
            queryClient.invalidateQueries(['page-widgets', pageId])
            addNotification('Widget deleted successfully', 'success', 'widget-delete')
            onWidgetChange?.()
        },
        onError: (error) => {
            addNotification('Failed to delete widget', 'error', 'widget-delete')
        }
    })

    // Event handlers
    const handleAddWidget = (slot) => {
        setSelectedSlot(slot)
        setShowWidgetLibrary(true)
    }

    const handleEditWidget = (widget) => {
        setEditingWidget(widget)
        setConfiguringWidget(widget)
    }

    const handleDeleteWidget = (widget) => {
        deleteWidgetMutation.mutate({ widgetId: widget.id })
    }

    const handleCreateWidget = async (widgetTypeId, config) => {
        if (!selectedSlot) return

        const slotName = selectedSlot.name || selectedSlot
        await createWidgetMutation.mutateAsync({
            page: pageId,
            slot: slotName,
            widget_type: widgetTypeId,
            config: config || {},
            sort_order: (widgetsBySlot[slotName] || []).length
        })

        setShowWidgetLibrary(false)
        setSelectedSlot(null)
    }

    const handleUpdateWidget = async (widgetId, updates) => {
        await updateWidgetMutation.mutateAsync({ widgetId, data: updates })
        setConfiguringWidget(null)
        setEditingWidget(null)
    }

    const handleVisibilityToggle = (widget) => {
        const newVisibility = !createWidgetModel(widget, widget.widget_type).isVisible()
        handleUpdateWidget(widget.id, {
            is_visible: newVisibility
        })
    }

    const handlePriorityChange = (widget, newPriority) => {
        handleUpdateWidget(widget.id, {
            priority: parseInt(newPriority) || 0
        })
    }

    const handleMove = (widget, direction) => {
        const currentSlotWidgets = widgetsBySlot[widget.slot] || []
        const currentIndex = currentSlotWidgets.findIndex(w => w.id === widget.id)

        let newSortOrder
        if (direction === 'up' && currentIndex > 0) {
            newSortOrder = currentSlotWidgets[currentIndex - 1].sort_order
        } else if (direction === 'down' && currentIndex < currentSlotWidgets.length - 1) {
            newSortOrder = currentSlotWidgets[currentIndex + 1].sort_order
        } else {
            return
        }

        handleUpdateWidget(widget.id, { sort_order: newSortOrder })
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
            <div className="bg-white rounded-lg shadow p-8">
                <div className="text-center text-gray-500">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    <p>No layout selected</p>
                    <p className="text-sm">Please select a layout to manage widgets</p>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg shadow p-8">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-600" />
                    <p className="text-gray-600">Loading widgets...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg shadow p-8">
                <div className="text-center text-red-600">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                    <p>Error loading widgets</p>
                    <button
                        onClick={refetch}
                        className="mt-2 px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Layout type indicator */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-2">
                    {isTemplateBasedLayout ? (
                        <>
                            <Code className="w-5 h-5 text-blue-600" />
                            <span className="font-medium text-gray-900">Template-based Layout</span>
                            <span className="text-sm text-gray-500">HTML with slot detection</span>
                        </>
                    ) : (
                        <>
                            <Layout className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-gray-900">Code-based Layout</span>
                            <span className="text-sm text-gray-500">Programmatic slot configuration</span>
                        </>
                    )}
                </div>
            </div>

            {isTemplateBasedLayout ? (
                // Template-based layout interface
                <div className="space-y-6">
                    {/* HTML Slot Detection Panel */}
                    <HtmlSlotDetectionPanel
                        validation={htmlSlots.validation}
                        slotsConfiguration={htmlSlots.slotsConfiguration}
                        onSlotHighlight={handleSlotHighlight}
                        onSlotUnhighlight={handleSlotUnhighlight}
                        onRefreshSlots={handleRefreshSlots}
                    />

                    {/* Template renderer with portal management */}
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

                    {/* HTML slots management grid */}
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
                </div>
            ) : (
                // Traditional code-based layout interface
                <div className="space-y-6">
                    {slots.length > 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {slots.map((slot) => {
                                const slotWidgets = widgetsBySlot[slot.name] || []
                                return (
                                    <div key={slot.name} className="bg-white border border-gray-200 rounded-lg">
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
                                                    className="inline-flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                                >
                                                    <Plus className="w-4 h-4 mr-1" />
                                                    Add Widget
                                                </button>
                                            </div>
                                        </div>
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
                                                            onMove={handleMove}
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
                                <Package className="w-8 h-8 mx-auto mb-2" />
                                <p>No slots configured for this layout</p>
                                <p className="text-sm">Configure slots in the layout settings</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Widget Library Modal */}
            {showWidgetLibrary && (
                <WidgetLibrary
                    widgetTypes={widgetTypes || []}
                    onSelect={handleCreateWidget}
                    onClose={() => {
                        setShowWidgetLibrary(false)
                        setSelectedSlot(null)
                    }}
                    selectedSlot={selectedSlot}
                />
            )}

            {/* Widget Configurator Modal */}
            {configuringWidget && (
                <WidgetConfigurator
                    widget={configuringWidget}
                    onSave={handleUpdateWidget}
                    onClose={() => {
                        setConfiguringWidget(null)
                        setEditingWidget(null)
                    }}
                />
            )}
        </div>
    )
}

export default SlotManager 