import React, { forwardRef, useState } from 'react'
import { Layout, Plus, Settings, Trash2, Eye } from 'lucide-react'

const ObjectContentEditor = forwardRef(({ objectType, widgets = {}, onWidgetChange, mode = 'object' }, ref) => {
    const [selectedSlot, setSelectedSlot] = useState(null)

    if (!objectType?.slotConfiguration?.slots || !Array.isArray(objectType.slotConfiguration.slots)) {
        return (
            <div className="text-center py-8 text-gray-500">
                <Layout className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p>No widget slots configured</p>
            </div>
        )
    }

    const handleAddWidget = (slotName) => {
        // For now, just add a placeholder widget
        const newWidget = {
            id: `widget_${Date.now()}`,
            type: 'Text Block',
            name: 'New Text Block',
            config: {
                content: 'Click to edit this content...'
            }
        }

        const currentSlotWidgets = widgets[slotName] || []
        const updatedWidgets = {
            ...widgets,
            [slotName]: [...currentSlotWidgets, newWidget]
        }

        onWidgetChange?.(updatedWidgets)
    }

    const handleEditWidget = (slotName, widgetIndex) => {
        // TODO: Open widget editor

    }

    const handleDeleteWidget = (slotName, widgetIndex) => {
        const currentSlotWidgets = widgets[slotName] || []
        const updatedSlotWidgets = currentSlotWidgets.filter((_, index) => index !== widgetIndex)
        const updatedWidgets = {
            ...widgets,
            [slotName]: updatedSlotWidgets
        }

        onWidgetChange?.(updatedWidgets)
    }

    const renderWidget = (widget, slotName, index) => {
        return (
            <div
                key={widget.id || index}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                        <Layout className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-700">
                            {widget.name || widget.type || 'Widget'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={() => handleEditWidget(slotName, index)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit widget"
                        >
                            <Settings className="h-3 w-3" />
                        </button>
                        <button
                            onClick={() => handleDeleteWidget(slotName, index)}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete widget"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </div>
                </div>

                <div className="text-xs text-gray-500 mb-2">
                    Type: {widget.type}
                </div>

                {/* Widget preview/content */}
                <div className="text-sm text-gray-600 bg-white p-2 rounded border">
                    {widget.config?.content || widget.config?.title || 'No content configured'}
                </div>
            </div>
        )
    }

    const renderSlot = (slot) => {
        const slotWidgets = widgets[slot.name] || []
        const isSelected = selectedSlot === slot.name

        return (
            <div
                key={slot.name}
                className={`border rounded-lg p-4 transition-colors ${isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
                    }`}
                onClick={() => setSelectedSlot(slot.name)}
            >
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h4 className="text-sm font-medium text-gray-900 flex items-center">
                            <Layout className="h-4 w-4 mr-2" />
                            {slot.label}
                            {slot.required && (
                                <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                    Required
                                </span>
                            )}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                            {slot.description || `Slot: ${slot.name}`}
                            {slot.maxWidgets && ` • Max: ${slot.maxWidgets}`}
                        </p>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleAddWidget(slot.name)
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md transition-colors"
                        title="Add widget"
                    >
                        <Plus className="h-3 w-3" />
                    </button>
                </div>

                <div className="space-y-2">
                    {slotWidgets.length > 0 ? (
                        slotWidgets.map((widget, index) => renderWidget(widget, slot.name, index))
                    ) : (
                        <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                            <Layout className="h-6 w-6 mx-auto mb-2" />
                            <p className="text-sm">No widgets in this slot</p>
                            <p className="text-xs">Click the + button to add a widget</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div ref={ref} className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Widget Slots</h3>
                <div className="text-sm text-gray-500">
                    {objectType.slotConfiguration.slots.length} slots configured
                </div>
            </div>

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
