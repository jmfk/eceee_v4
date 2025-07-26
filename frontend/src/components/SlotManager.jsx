import React, { useState, useEffect, useMemo } from 'react'
import { Plus, X, Eye, EyeOff } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

// API
import { layoutsApi } from '../api/layouts'
import WidgetCard from './slot-manager/WidgetCard'
import HtmlSlotCard from './slot-manager/HtmlSlotCard'
import WidgetLibrary from './WidgetLibrary'
import CustomWidgetCreator from './CustomWidgetCreator'
import { useHtmlSlots } from '../hooks/useHtmlSlots'

const SlotManager = ({
    layout,
    widgetsBySlot = {},
    onSlotUpdate,
    onConfigChange,
    pageId = null,
    className = "",
    showWidgetLibrary = true,
    allowSlotAddition = false,
    readonly = false
}) => {
    const [selectedSlot, setSelectedSlot] = useState('')
    const [showLibrary, setShowLibrary] = useState(false)
    const [showCustomCreator, setShowCustomCreator] = useState(false)
    const [isPreviewMode, setIsPreviewMode] = useState(false)
    const [localWidgetsBySlot, setLocalWidgetsBySlot] = useState(widgetsBySlot)
    const [draggedWidget, setDraggedWidget] = useState(null)
    const [isEditingSlots, setIsEditingSlots] = useState(false)
    const [slotVisibility, setSlotVisibility] = useState({})
    const queryClient = useQueryClient()

    // HTML slot detection for code-based layouts
    const htmlSlots = useHtmlSlots({
        htmlContent: '',
        layoutName: layout?.name,
        enabled: false,
        autoDetect: false,
        pageId
    })

    // Always use layout configuration for code layouts
    const slots = layout?.slot_configuration?.slots || []

    // Update local state when props change
    useEffect(() => {
        setLocalWidgetsBySlot(widgetsBySlot)
    }, [widgetsBySlot])

    // Initialize slot visibility
    useEffect(() => {
        const initialVisibility = {}
        slots.forEach(slot => {
            initialVisibility[slot.name] = true
        })
        setSlotVisibility(initialVisibility)
    }, [slots])

    // Get widgets for a specific slot
    const getSlotWidgets = (slotName) => {
        return localWidgetsBySlot[slotName] || []
    }

    // Handle adding widget to slot
    const handleAddToSlot = (slotName, widgetData) => {
        if (readonly) return

        const currentWidgets = getSlotWidgets(slotName)
        const newWidget = {
            ...widgetData,
            id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sort_order: currentWidgets.length,
            slot_name: slotName
        }

        const updatedWidgets = [...currentWidgets, newWidget]
        const newWidgetsBySlot = {
            ...localWidgetsBySlot,
            [slotName]: updatedWidgets
        }

        setLocalWidgetsBySlot(newWidgetsBySlot)
        onSlotUpdate?.(slotName, updatedWidgets)

        toast.success(`${widgetData.name} added to ${slotName} slot`)
    }

    // Handle removing widget from slot
    const handleRemoveFromSlot = (slotName, widgetId) => {
        if (readonly) return

        const currentWidgets = getSlotWidgets(slotName)
        const updatedWidgets = currentWidgets.filter(w => w.id !== widgetId)
        const newWidgetsBySlot = {
            ...localWidgetsBySlot,
            [slotName]: updatedWidgets
        }

        setLocalWidgetsBySlot(newWidgetsBySlot)
        onSlotUpdate?.(slotName, updatedWidgets)

        toast.success('Widget removed')
    }

    // Handle reordering widgets within a slot
    const handleReorderWidgets = (slotName, reorderedWidgets) => {
        if (readonly) return

        const newWidgetsBySlot = {
            ...localWidgetsBySlot,
            [slotName]: reorderedWidgets
        }

        setLocalWidgetsBySlot(newWidgetsBySlot)
        onSlotUpdate?.(slotName, reorderedWidgets)
    }

    // Handle slot visibility toggle
    const toggleSlotVisibility = (slotName) => {
        setSlotVisibility(prev => ({
            ...prev,
            [slotName]: !prev[slotName]
        }))
    }

    // Handle opening widget library for specific slot
    const openWidgetLibrary = (slotName) => {
        if (readonly) return
        setSelectedSlot(slotName)
        setShowLibrary(true)
    }

    // Count total widgets
    const totalWidgets = useMemo(() => {
        return Object.values(localWidgetsBySlot).reduce((total, widgets) => total + widgets.length, 0)
    }, [localWidgetsBySlot])

    return (
        <div className={`slot-manager ${className}`}>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Slot Manager</h3>
                        <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                            <span className="font-medium text-gray-900">Code Layout</span>
                            <span>•</span>
                            <span>{slots.length} slots available</span>
                            <span>•</span>
                            <span>{totalWidgets} widgets total</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        {!readonly && (
                            <button
                                onClick={() => setIsPreviewMode(!isPreviewMode)}
                                className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${isPreviewMode
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                {isPreviewMode ? (
                                    <>
                                        <EyeOff className="h-4 w-4 mr-1 inline" />
                                        Exit Preview
                                    </>
                                ) : (
                                    <>
                                        <Eye className="h-4 w-4 mr-1 inline" />
                                        Preview
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Slots List */}
            <div className="flex-1 overflow-auto">
                {slots.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="text-gray-400 text-lg mb-2">📋</div>
                        <h4 className="text-lg font-medium text-gray-900 mb-2">No Slots Available</h4>
                        <p className="text-gray-600">
                            This layout doesn't define any widget slots.
                        </p>
                    </div>
                ) : (
                    <div className="p-6 space-y-6">
                        {slots.map((slot) => (
                            <div key={slot.name}>
                                <HtmlSlotCard
                                    slot={slot}
                                    widgets={getSlotWidgets(slot.name)}
                                    onAddWidget={(slot, widget) => handleAddToSlot(slot.name, widget)}
                                    onRemoveWidget={(widgetId) => handleRemoveFromSlot(slot.name, widgetId)}
                                    onReorderWidgets={(reorderedWidgets) => handleReorderWidgets(slot.name, reorderedWidgets)}
                                    onConfigChange={onConfigChange}
                                    isVisible={slotVisibility[slot.name]}
                                    onToggleVisibility={() => toggleSlotVisibility(slot.name)}
                                    isPreviewMode={isPreviewMode}
                                    readonly={readonly}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Widget Library Modal */}
            {showLibrary && (
                <WidgetLibrary
                    onSelect={(widget) => handleAddToSlot(selectedSlot, widget)}
                    onClose={() => {
                        setShowLibrary(false)
                        setSelectedSlot('')
                    }}
                    slotName={selectedSlot}
                />
            )}

            {/* Custom Widget Creator Modal */}
            {showCustomCreator && (
                <CustomWidgetCreator
                    onSave={(widget) => {
                        if (selectedSlot) {
                            handleAddToSlot(selectedSlot, widget)
                        }
                        setShowCustomCreator(false)
                    }}
                    onClose={() => setShowCustomCreator(false)}
                />
            )}
        </div>
    )
}

export default SlotManager 