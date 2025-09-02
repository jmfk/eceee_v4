/**
 * SlotContainer - Reusable slot rendering component
 * 
 * Provides a consistent interface for rendering widget slots with
 * drag-and-drop support, validation feedback, and context-aware behavior.
 */

import React, { useCallback, useMemo } from 'react'
import { Layout, Plus, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useWidgetContext } from '../context/WidgetContext'
import { useEditorContext, useDragAndDrop } from '../context/EditorContext'
import WidgetToolbar from './WidgetToolbar'
import WidgetLibraryPanel from './WidgetLibraryPanel'

/**
 * SlotContainer Component
 */
export function SlotContainer({
    slotName,
    slotConfig = {},
    showHeader = true,
    showAddButton = true,
    showValidation = true,
    editable = true,
    collapsible = false,
    defaultCollapsed = false,
    emptyMessage = 'No widgets in this slot',
    onWidgetClick,
    onWidgetEdit,
    onSlotClick,
    className = '',
    children
}) {
    const {
        context,
        getSlotWidgets,
        getAvailableWidgetTypes,
        validationResults
    } = useWidgetContext()

    const {
        selectedSlot,
        selectSlot,
        toggleWidgetLibrary,
        ui
    } = useEditorContext()

    const {
        dropRef,
        isDragOver,
        handleDragOver,
        handleDrop
    } = useDragAndDrop()

    const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
    const [showLibrary, setShowLibrary] = React.useState(false)

    const slotWidgets = getSlotWidgets(slotName)
    const availableTypes = getAvailableWidgetTypes(slotConfig)
    const isSelected = selectedSlot === slotName

    /**
     * Handle slot click
     */
    const handleSlotClick = useCallback((e) => {
        e.stopPropagation()
        selectSlot(slotName)

        if (onSlotClick) {
            onSlotClick(slotName, slotConfig)
        }
    }, [selectSlot, slotName, onSlotClick, slotConfig])

    /**
     * Handle add widget
     */
    const handleAddWidget = useCallback(() => {
        if (!editable || availableTypes.length === 0) return

        setShowLibrary(true)
    }, [editable, availableTypes.length])

    /**
     * Handle widget click
     */
    const handleWidgetClick = useCallback((widget, index) => {
        if (onWidgetClick) {
            onWidgetClick(widget, slotName, index)
        }
    }, [onWidgetClick, slotName])

    /**
     * Handle widget edit
     */
    const handleWidgetEdit = useCallback((widget, index) => {
        if (onWidgetEdit) {
            onWidgetEdit(widget, slotName, index)
        }
    }, [onWidgetEdit, slotName])

    /**
     * Toggle collapsed state
     */
    const toggleCollapsed = useCallback(() => {
        setIsCollapsed(!isCollapsed)
    }, [isCollapsed])

    // Slot validation state
    const slotValidation = useMemo(() => {
        const widgetValidations = slotWidgets.map(widget =>
            validationResults[widget.id] || { isValid: true, errors: [], warnings: [] }
        )

        const errors = widgetValidations.flatMap(v => v.errors || [])
        const warnings = widgetValidations.flatMap(v => v.warnings || [])

        // Check slot-level constraints
        const slotErrors = []
        const slotWarnings = []

        // Required slot validation
        if (slotConfig.required && slotWidgets.length === 0) {
            slotErrors.push({ message: 'This slot is required and cannot be empty' })
        }

        // Max widgets validation
        if (slotConfig.maxWidgets && slotWidgets.length > slotConfig.maxWidgets) {
            slotErrors.push({
                message: `This slot can only contain ${slotConfig.maxWidgets} widget(s)`
            })
        }

        return {
            isValid: errors.length === 0 && slotErrors.length === 0,
            hasWarnings: warnings.length > 0 || slotWarnings.length > 0,
            errors: [...errors, ...slotErrors],
            warnings: [...warnings, ...slotWarnings],
            widgetCount: slotWidgets.length,
            validatedWidgets: widgetValidations.filter(v => !v.isValid).length
        }
    }, [slotWidgets, validationResults, slotConfig])

    // Container classes
    const containerClasses = useMemo(() => {
        const baseClasses = 'slot-container transition-all duration-200'
        const stateClasses = []

        if (isSelected) stateClasses.push('ring-2 ring-blue-400 ring-opacity-50')
        if (isDragOver) stateClasses.push('bg-blue-50 border-blue-300 border-dashed')
        if (!slotValidation.isValid) stateClasses.push('border-red-300 bg-red-50')
        else if (slotValidation.hasWarnings) stateClasses.push('border-yellow-300 bg-yellow-50')
        else stateClasses.push('border-gray-200 bg-white')

        return `${baseClasses} ${stateClasses.join(' ')} ${className}`
    }, [isSelected, isDragOver, slotValidation, className])

    return (
        <>
            <div
                ref={dropRef}
                className={`${containerClasses} border-2 rounded-lg p-4`}
                onClick={handleSlotClick}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Slot Header */}
                {showHeader && (
                    <SlotHeader
                        slotName={slotName}
                        slotConfig={slotConfig}
                        slotValidation={slotValidation}
                        isCollapsed={isCollapsed}
                        collapsible={collapsible}
                        showAddButton={showAddButton}
                        editable={editable}
                        availableTypes={availableTypes}
                        onToggleCollapsed={toggleCollapsed}
                        onAddWidget={handleAddWidget}
                    />
                )}

                {/* Validation Messages */}
                {showValidation && !slotValidation.isValid && !isCollapsed && (
                    <ValidationMessages validation={slotValidation} />
                )}

                {/* Slot Content */}
                {!isCollapsed && (
                    <div className="slot-content">
                        {slotWidgets.length > 0 ? (
                            <div className="space-y-3">
                                {slotWidgets.map((widget, index) => (
                                    <WidgetItem
                                        key={widget.id}
                                        widget={widget}
                                        slotName={slotName}
                                        widgetIndex={index}
                                        slotConfig={slotConfig}
                                        editable={editable}
                                        onClick={() => handleWidgetClick(widget, index)}
                                        onEdit={() => handleWidgetEdit(widget, index)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptySlotMessage
                                message={emptyMessage}
                                availableTypes={availableTypes}
                                onAddWidget={handleAddWidget}
                                showAddButton={showAddButton && editable}
                            />
                        )}

                        {/* Custom children */}
                        {children}
                    </div>
                )}
            </div>

            {/* Widget Library Panel */}
            <WidgetLibraryPanel
                isOpen={showLibrary}
                onClose={() => setShowLibrary(false)}
                targetSlot={slotName}
                slotConfig={slotConfig}
                onWidgetSelect={() => setShowLibrary(false)}
            />
        </>
    )
}

/**
 * Slot Header Component
 */
function SlotHeader({
    slotName,
    slotConfig,
    slotValidation,
    isCollapsed,
    collapsible,
    showAddButton,
    editable,
    availableTypes,
    onToggleCollapsed,
    onAddWidget
}) {
    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
                {/* Collapse Toggle */}
                {collapsible && (
                    <button
                        onClick={onToggleCollapsed}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        {isCollapsed ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronUp className="h-4 w-4" />
                        )}
                    </button>
                )}

                {/* Slot Icon */}
                <Layout className="h-4 w-4 text-gray-500" />

                {/* Slot Name and Info */}
                <div>
                    <h4 className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                        <span>{slotConfig.label || slotName}</span>

                        {/* Required Badge */}
                        {slotConfig.required && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                Required
                            </span>
                        )}

                        {/* Widget Count */}
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {slotValidation.widgetCount}
                            {slotConfig.maxWidgets && ` / ${slotConfig.maxWidgets}`}
                        </span>

                        {/* Validation Status */}
                        {!slotValidation.isValid && (
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                        )}
                        {slotValidation.hasWarnings && slotValidation.isValid && (
                            <Info className="h-3 w-3 text-yellow-500" />
                        )}
                    </h4>

                    {/* Description */}
                    {slotConfig.description && (
                        <p className="text-xs text-gray-500 mt-1">
                            {slotConfig.description}
                        </p>
                    )}
                </div>
            </div>

            {/* Add Widget Button */}
            {showAddButton && editable && availableTypes.length > 0 && !isCollapsed && (
                <AddWidgetButton
                    availableTypes={availableTypes}
                    onAddWidget={onAddWidget}
                />
            )}
        </div>
    )
}

/**
 * Add Widget Button Component
 */
function AddWidgetButton({ availableTypes, onAddWidget }) {
    if (availableTypes.length === 1) {
        const type = availableTypes[0]
        return (
            <button
                onClick={onAddWidget}
                className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm transition-colors"
                title={`Add ${type.name || type}`}
            >
                <Plus className="h-3 w-3" />
                <span>{type.name || type}</span>
            </button>
        )
    }

    return (
        <button
            onClick={onAddWidget}
            className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm transition-colors"
            title="Add widget"
        >
            <Plus className="h-3 w-3" />
            <span>Add Widget</span>
        </button>
    )
}

/**
 * Validation Messages Component
 */
function ValidationMessages({ validation }) {
    const { errors, warnings } = validation

    if (errors.length === 0 && warnings.length === 0) return null

    return (
        <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200">
            {errors.length > 0 && (
                <div className="mb-2">
                    <div className="flex items-center space-x-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-red-800">
                            {errors.length} error{errors.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                        {errors.map((error, index) => (
                            <li key={index} className="text-xs text-red-700">
                                {error.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {warnings.length > 0 && (
                <div>
                    <div className="flex items-center space-x-2 mb-1">
                        <Info className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium text-yellow-800">
                            {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <ul className="list-disc list-inside space-y-1">
                        {warnings.map((warning, index) => (
                            <li key={index} className="text-xs text-yellow-700">
                                {warning.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

/**
 * Widget Item Component
 */
function WidgetItem({
    widget,
    slotName,
    widgetIndex,
    slotConfig,
    editable,
    onClick,
    onEdit
}) {
    const { validationResults } = useWidgetContext()
    const validation = validationResults[widget.id]
    const hasErrors = validation && !validation.isValid
    const hasWarnings = validation && validation.hasWarnings

    return (
        <div
            className={`widget-item p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer group ${hasErrors
                    ? 'border-red-300 bg-red-50'
                    : hasWarnings
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
            onClick={onClick}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Layout className="h-4 w-4 text-gray-400" />
                    <div>
                        <span className="text-sm font-medium text-gray-700">
                            {widget.name || widget.type || 'Widget'}
                        </span>
                        <div className="text-xs text-gray-500">
                            {widget.slug || widget.type}
                        </div>
                    </div>

                    {/* Validation Indicators */}
                    {hasErrors && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    {hasWarnings && !hasErrors && <Info className="h-3 w-3 text-yellow-500" />}
                </div>

                {/* Widget Toolbar */}
                {editable && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <WidgetToolbar
                            widget={widget}
                            slotName={slotName}
                            widgetIndex={widgetIndex}
                            slotConfig={slotConfig}
                            onEdit={onEdit}
                            compact={true}
                            position="overlay"
                        />
                    </div>
                )}
            </div>

            {/* Widget Preview */}
            <WidgetPreview widget={widget} />
        </div>
    )
}

/**
 * Widget Preview Component
 */
function WidgetPreview({ widget }) {
    const config = widget.config || {}

    const previewContent = useMemo(() => {
        switch (widget.slug) {
            case 'text-block':
                return config.content || config.title || 'No content'
            case 'image':
                return config.alt || config.src ? `Image: ${config.alt || 'No alt text'}` : 'No image'
            case 'button':
                return config.text || 'Button'
            case 'html-block':
                return 'HTML content'
            default:
                return Object.keys(config).length > 0
                    ? JSON.stringify(config).slice(0, 100) + '...'
                    : 'No configuration'
        }
    }, [widget.slug, config])

    return (
        <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
            <div className="truncate">{previewContent}</div>
        </div>
    )
}

/**
 * Empty Slot Message Component
 */
function EmptySlotMessage({ message, availableTypes, onAddWidget, showAddButton }) {
    return (
        <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
            <Layout className="h-8 w-8 mx-auto mb-3" />
            <p className="text-sm mb-2">{message}</p>

            {availableTypes.length > 0 && (
                <p className="text-xs mb-4">
                    Available: {availableTypes.map(t => t.name || t).join(', ')}
                </p>
            )}

            {showAddButton && availableTypes.length > 0 && (
                <button
                    onClick={onAddWidget}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                    Add your first widget
                </button>
            )}
        </div>
    )
}

export default SlotContainer
