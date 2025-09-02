/**
 * WidgetRenderer - Universal widget rendering component
 * 
 * Renders widgets consistently across both page and object contexts
 * while adapting to context-specific requirements and behaviors.
 */

import React, { useMemo, useCallback } from 'react'
import { Layout, Plus, Settings, Trash2, Copy, Move, Eye } from 'lucide-react'
import { useWidgetContext } from '../context/WidgetContext'
import { useEditorContext } from '../context/EditorContext'
import { getWidgetEditorComponent } from '../utils/widgetFactory'
import { validateWidgetConfig } from '../utils/validation'

/**
 * WidgetRenderer Component
 */
export function WidgetRenderer({
    slots = [],
    slotConfigurations = {},
    editable = true,
    showSlotBorders = true,
    showWidgetBorders = true,
    onWidgetClick,
    onSlotClick,
    onWidgetDoubleClick,
    className = '',
    emptySlotMessage = 'No widgets in this slot',
    renderCustomWidget = null,
    children
}) {
    const {
        widgets,
        context,
        getSlotWidgets,
        getAvailableWidgetTypes,
        validationResults
    } = useWidgetContext()

    const {
        selectedSlot,
        preferences,
        dragState,
        selectSlot
    } = useEditorContext()

    /**
     * Render individual widget
     */
    const renderWidget = useCallback((widget, slotName, index) => {
        const isSelected = selectedSlot === slotName
        const validation = validationResults[widget.id]
        const hasErrors = validation && !validation.isValid
        const hasWarnings = validation && validation.hasWarnings

        // Use custom renderer if provided
        if (renderCustomWidget) {
            const customWidget = renderCustomWidget(widget, slotName, index, {
                isSelected,
                hasErrors,
                hasWarnings,
                editable
            })
            if (customWidget) return customWidget
        }

        return (
            <WidgetItem
                key={widget.id}
                widget={widget}
                slotName={slotName}
                index={index}
                isSelected={isSelected}
                hasErrors={hasErrors}
                hasWarnings={hasWarnings}
                editable={editable}
                showBorders={showWidgetBorders}
                onWidgetClick={onWidgetClick}
                onWidgetDoubleClick={onWidgetDoubleClick}
            />
        )
    }, [
        selectedSlot,
        validationResults,
        showWidgetBorders,
        editable,
        onWidgetClick,
        onWidgetDoubleClick,
        renderCustomWidget
    ])

    /**
     * Render slot container
     */
    const renderSlot = useCallback((slot) => {
        const slotName = slot.name || slot
        const slotConfig = slotConfigurations[slotName] || {}
        const slotWidgets = getSlotWidgets(slotName)
        const isSelected = selectedSlot === slotName
        const availableTypes = getAvailableWidgetTypes(slotConfig)
        const isDragOver = dragState.dropTarget === slotName

        return (
            <SlotContainer
                key={slotName}
                slotName={slotName}
                slotConfig={slotConfig}
                widgets={slotWidgets}
                availableTypes={availableTypes}
                isSelected={isSelected}
                isDragOver={isDragOver}
                editable={editable}
                showBorders={showSlotBorders}
                emptyMessage={emptySlotMessage}
                onSlotClick={() => {
                    selectSlot(slotName)
                    onSlotClick?.(slotName)
                }}
                renderWidget={renderWidget}
            />
        )
    }, [
        slotConfigurations,
        getSlotWidgets,
        getAvailableWidgetTypes,
        selectedSlot,
        dragState.dropTarget,
        editable,
        showSlotBorders,
        emptySlotMessage,
        selectSlot,
        onSlotClick,
        renderWidget
    ])

    const containerClasses = `widget-renderer ${context}-context ${className}`

    return (
        <div className={containerClasses}>
            {slots.map(renderSlot)}
            {children}
        </div>
    )
}

/**
 * Individual Widget Item Component
 */
function WidgetItem({
    widget,
    slotName,
    index,
    isSelected,
    hasErrors,
    hasWarnings,
    editable,
    showBorders,
    onWidgetClick,
    onWidgetDoubleClick
}) {
    const { updateWidget, deleteWidget } = useWidgetContext()
    const { copyWidget, startDrag } = useEditorContext()

    const handleWidgetClick = useCallback((e) => {
        e.stopPropagation()
        onWidgetClick?.(widget, slotName, index)
    }, [widget, slotName, index, onWidgetClick])

    const handleWidgetDoubleClick = useCallback((e) => {
        e.stopPropagation()
        onWidgetDoubleClick?.(widget, slotName, index)
    }, [widget, slotName, index, onWidgetDoubleClick])

    const handleDeleteWidget = useCallback((e) => {
        e.stopPropagation()
        deleteWidget(slotName, widget.id)
    }, [deleteWidget, slotName, widget.id])

    const handleCopyWidget = useCallback((e) => {
        e.stopPropagation()
        copyWidget(widget)
    }, [copyWidget, widget])

    const handleDragStart = useCallback((e) => {
        if (!editable) return
        startDrag(widget, slotName, index)
    }, [editable, startDrag, widget, slotName, index])

    const borderClasses = showBorders
        ? `border-2 ${isSelected ? 'border-blue-400' : hasErrors ? 'border-red-300' : hasWarnings ? 'border-yellow-300' : 'border-gray-200'}`
        : ''

    const backgroundClasses = isSelected
        ? 'bg-blue-50'
        : hasErrors
            ? 'bg-red-50'
            : hasWarnings
                ? 'bg-yellow-50'
                : 'bg-white'

    return (
        <div
            className={`widget-item relative p-3 rounded-lg transition-all duration-200 hover:shadow-md ${borderClasses} ${backgroundClasses}`}
            onClick={handleWidgetClick}
            onDoubleClick={handleWidgetDoubleClick}
            draggable={editable}
            onDragStart={handleDragStart}
        >
            {/* Widget Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                    <Layout className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">
                        {widget.name || widget.type || 'Widget'}
                    </span>
                    {(hasErrors || hasWarnings) && (
                        <div className={`w-2 h-2 rounded-full ${hasErrors ? 'bg-red-400' : 'bg-yellow-400'}`} />
                    )}
                </div>

                {editable && (
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={handleCopyWidget}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Copy widget"
                        >
                            <Copy className="h-3 w-3" />
                        </button>
                        <button
                            onClick={handleWidgetClick}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Edit widget"
                        >
                            <Settings className="h-3 w-3" />
                        </button>
                        <button
                            onClick={handleDeleteWidget}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete widget"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                        <div
                            className="p-1 text-gray-400 hover:text-gray-600 cursor-move"
                            title="Drag to move"
                        >
                            <Move className="h-3 w-3" />
                        </div>
                    </div>
                )}
            </div>

            {/* Widget Type Badge */}
            <div className="text-xs text-gray-500 mb-2">
                {widget.slug || widget.type}
            </div>

            {/* Widget Preview/Content */}
            <WidgetPreview widget={widget} />
        </div>
    )
}

/**
 * Slot Container Component
 */
function SlotContainer({
    slotName,
    slotConfig,
    widgets,
    availableTypes,
    isSelected,
    isDragOver,
    editable,
    showBorders,
    emptyMessage,
    onSlotClick,
    renderWidget
}) {
    const { addWidget } = useWidgetContext()
    const { endDrag } = useEditorContext()

    const handleAddWidget = useCallback(() => {
        if (!editable || availableTypes.length === 0) return

        // For object context with single type, add directly
        if (availableTypes.length === 1) {
            const type = availableTypes[0]
            const widget = createWidget(type.slug || type, {
                context: 'object',
                controlId: type.controlId
            })
            addWidget(slotName, widget, slotConfig)
        } else {
            // For multiple types, could trigger widget picker
            // For now, add first available type
            const firstType = availableTypes[0]
            const widget = createWidget(firstType.slug || firstType, {
                context: 'page'
            })
            addWidget(slotName, widget, slotConfig)
        }
    }, [editable, availableTypes, addWidget, slotName, slotConfig])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        endDrag()
        // Handle drop logic would go here
    }, [endDrag])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
    }, [])

    const borderClasses = showBorders
        ? `border-2 ${isDragOver ? 'border-blue-400 border-dashed' : isSelected ? 'border-blue-300' : 'border-gray-200'}`
        : ''

    const backgroundClasses = isDragOver
        ? 'bg-blue-50'
        : isSelected
            ? 'bg-blue-25'
            : 'bg-gray-50'

    return (
        <div
            className={`slot-container p-4 rounded-lg transition-all duration-200 ${borderClasses} ${backgroundClasses}`}
            onClick={onSlotClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            {/* Slot Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                    <Layout className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">
                        {slotConfig.label || slotName}
                    </span>
                    {slotConfig.required && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                            Required
                        </span>
                    )}
                </div>

                {editable && availableTypes.length > 0 && (
                    <button
                        onClick={handleAddWidget}
                        className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        title="Add widget"
                    >
                        <Plus className="h-3 w-3" />
                        <span>Add</span>
                    </button>
                )}
            </div>

            {/* Slot Description */}
            {slotConfig.description && (
                <p className="text-xs text-gray-500 mb-3">
                    {slotConfig.description}
                </p>
            )}

            {/* Widgets */}
            <div className="space-y-2 group">
                {widgets.length > 0 ? (
                    widgets.map((widget, index) => renderWidget(widget, slotName, index))
                ) : (
                    <div className="text-center py-6 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                        <Layout className="h-6 w-6 mx-auto mb-2" />
                        <p className="text-sm">{emptyMessage}</p>
                        {availableTypes.length > 0 && (
                            <p className="text-xs mt-1">
                                Click Add to insert a widget
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * Widget Preview Component
 */
function WidgetPreview({ widget }) {
    const previewContent = useMemo(() => {
        const config = widget.config || {}

        switch (widget.slug) {
            case 'text-block':
                return config.content || config.title || 'Text content'
            case 'image':
                return config.alt || config.src ? 'Image: ' + (config.alt || 'No alt text') : 'No image configured'
            case 'button':
                return config.text || 'Button'
            case 'html-block':
                return 'HTML content'
            case 'spacer':
                return `Spacer: ${config.height || 20}${config.unit || 'px'}`
            default:
                return JSON.stringify(config, null, 2).slice(0, 100) + '...'
        }
    }, [widget.config, widget.slug])

    return (
        <div className="text-sm text-gray-600 bg-white p-2 rounded border">
            <div className="truncate">{previewContent}</div>
        </div>
    )
}

export default WidgetRenderer
