/**
 * ObjectWidgetWrapper - Object-specific widget wrapper
 * 
 * Wraps shared widget components with object-specific functionality
 * like widget controls, type restrictions, and object context.
 */

import React, { useMemo, useCallback } from 'react'
import {
    WidgetRenderer,
    SlotContainer,
    WithSharedWidgets,
    createContextOperations,
    WIDGET_CONTEXTS
} from '../shared'

/**
 * ObjectWidgetRenderer - Object context widget renderer
 */
export function ObjectWidgetRenderer({
    objectType,
    objectWidgets = {},
    onWidgetChange,
    editable = true,
    showRestrictions = true,
    onSlotClick,
    onWidgetEdit,
    className = ''
}) {
    // Extract slots from object type configuration
    const slots = useMemo(() => {
        if (!objectType?.slotConfiguration?.slots) return []
        return objectType.slotConfiguration.slots.map(slot => ({
            name: slot.name,
            ...slot
        }))
    }, [objectType])

    // Get slot configurations with object-specific enhancements
    const slotConfigurations = useMemo(() => {
        const configs = {}

        slots.forEach(slot => {
            configs[slot.name] = {
                ...slot,
                // Object-specific properties
                supportsInheritance: false,
                strictTypes: true,
                widgetControls: slot.widgetControls || [],
                allowedTypes: slot.widgetControls?.map(c => c.widgetType) || null,
                maxWidgets: slot.maxWidgets || 1, // Default to 1 for objects
                context: 'object'
            }
        })

        return configs
    }, [slots])

    /**
     * Handle widget changes
     */
    const handleWidgetChange = useCallback((newWidgets) => {
        if (onWidgetChange) {
            onWidgetChange(newWidgets)
        }
    }, [onWidgetChange])

    /**
     * Handle slot click with object-specific logic
     */
    const handleSlotClick = useCallback((slotName) => {
        if (onSlotClick) {
            onSlotClick(slotName, {
                objectTypeId: objectType?.id,
                slotConfig: slotConfigurations[slotName],
                widgetControls: slotConfigurations[slotName]?.widgetControls || []
            })
        }
    }, [onSlotClick, objectType?.id, slotConfigurations])

    /**
     * Handle widget edit with object context
     */
    const handleWidgetEdit = useCallback((widget, slotName, index) => {
        if (onWidgetEdit) {
            onWidgetEdit(widget, slotName, index, {
                context: 'object',
                objectTypeId: objectType?.id,
                strictTypes: true,
                widgetControl: widget.controlId ?
                    slotConfigurations[slotName]?.widgetControls?.find(c => c.id === widget.controlId)
                    : null
            })
        }
    }, [onWidgetEdit, objectType?.id, slotConfigurations])

    if (!objectType?.slotConfiguration?.slots || slots.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500">
                <div className="w-12 h-12 mx-auto mb-3 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-gray-400">🎛️</span>
                </div>
                <p>No widget slots configured for this object type</p>
            </div>
        )
    }

    return (
        <WithSharedWidgets
            context={WIDGET_CONTEXTS.OBJECT}
            widgets={objectWidgets}
            onWidgetChange={handleWidgetChange}
            editorMode="edit"
        >
            <div className={`object-widget-renderer ${className}`}>
                <WidgetRenderer
                    slots={slots}
                    slotConfigurations={slotConfigurations}
                    editable={editable}
                    showSlotBorders={true}
                    showWidgetBorders={true}
                    onSlotClick={handleSlotClick}
                    onWidgetDoubleClick={handleWidgetEdit}
                    emptySlotMessage="No widgets configured for this slot"
                />

                {/* Object-specific restrictions indicators */}
                {showRestrictions && (
                    <RestrictionIndicators
                        slots={slots}
                        objectType={objectType}
                    />
                )}
            </div>
        </WithSharedWidgets>
    )
}

/**
 * ObjectSlotContainer - Object-specific slot container
 */
export function ObjectSlotContainer({
    slotName,
    slotConfig,
    objectType,
    slotWidgets = [],
    editable = true,
    showControls = true,
    onWidgetChange,
    onSlotClick,
    onWidgetEdit,
    className = ''
}) {
    // Enhanced slot config for object context
    const enhancedSlotConfig = useMemo(() => ({
        ...slotConfig,
        label: slotConfig.label || slotName,
        supportsInheritance: false,
        strictTypes: true,
        widgetControls: slotConfig.widgetControls || [],
        allowedTypes: slotConfig.widgetControls?.map(c => c.widgetType) || null,
        context: 'object'
    }), [slotConfig, slotName])

    /**
     * Handle widget operations
     */
    const handleWidgetChange = useCallback((newWidgets) => {
        if (onWidgetChange) {
            onWidgetChange(slotName, newWidgets)
        }
    }, [onWidgetChange, slotName])

    return (
        <WithSharedWidgets
            context={WIDGET_CONTEXTS.OBJECT}
            widgets={{ [slotName]: slotWidgets }}
            onWidgetChange={(allWidgets) => handleWidgetChange(allWidgets[slotName] || [])}
        >
            <SlotContainer
                slotName={slotName}
                slotConfig={enhancedSlotConfig}
                showHeader={true}
                showAddButton={true}
                editable={editable}
                collapsible={false}
                emptyMessage="No widgets in this slot"
                onSlotClick={onSlotClick}
                onWidgetEdit={onWidgetEdit}
                className={className}
            >
                {/* Object-specific slot content */}
                {showControls && enhancedSlotConfig.widgetControls.length > 0 && (
                    <WidgetControlsInfo
                        widgetControls={enhancedSlotConfig.widgetControls}
                        slotWidgets={slotWidgets}
                    />
                )}
            </SlotContainer>
        </WithSharedWidgets>
    )
}

/**
 * RestrictionIndicators - Shows object type restrictions
 */
function RestrictionIndicators({ slots, objectType }) {
    const restrictedSlots = useMemo(() => {
        return slots.filter(slot =>
            slot.widgetControls && slot.widgetControls.length > 0
        )
    }, [slots])

    if (restrictedSlots.length === 0) return null

    return (
        <div className="restriction-indicators mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="text-sm font-medium text-orange-900 mb-2">
                Widget Restrictions
            </h4>
            <div className="space-y-2">
                {restrictedSlots.map(slot => (
                    <div key={slot.name} className="text-xs">
                        <div className="font-medium text-orange-800">
                            {slot.label || slot.name}
                        </div>
                        <div className="text-orange-700 mt-1">
                            Allowed: {slot.widgetControls.map(c =>
                                c.label || c.widgetType
                            ).join(', ')}
                        </div>
                        {slot.maxWidgets && (
                            <div className="text-orange-600">
                                Max widgets: {slot.maxWidgets}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

/**
 * WidgetControlsInfo - Shows available widget controls for slot
 */
function WidgetControlsInfo({ widgetControls, slotWidgets }) {
    const usedControls = useMemo(() => {
        return slotWidgets.filter(w => w.controlId).map(w => w.controlId)
    }, [slotWidgets])

    return (
        <div className="widget-controls-info mt-3 p-2 bg-orange-50 rounded border border-orange-200">
            <div className="text-xs text-orange-800 font-medium mb-2">
                Available Widget Types
            </div>
            <div className="space-y-1">
                {widgetControls.map(control => {
                    const isUsed = usedControls.includes(control.id)
                    return (
                        <div key={control.id} className="flex items-center justify-between">
                            <span className="text-xs text-orange-700">
                                {control.label || control.widgetType}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded ${isUsed
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                {isUsed ? 'In Use' : 'Available'}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/**
 * ObjectTypeSelector - Select widget based on object type controls
 */
export function ObjectTypeWidgetSelector({
    slotConfig,
    onWidgetSelect,
    className = ''
}) {
    const { widgetControls = [] } = slotConfig

    const handleControlSelect = useCallback((control) => {
        if (onWidgetSelect) {
            onWidgetSelect(control.widgetType, {
                controlId: control.id,
                defaultConfig: control.defaultConfig || {},
                label: control.label
            })
        }
    }, [onWidgetSelect])

    if (widgetControls.length === 0) {
        return (
            <div className="text-center py-4 text-gray-500">
                <p className="text-sm">No widget types configured for this slot</p>
            </div>
        )
    }

    if (widgetControls.length === 1) {
        const control = widgetControls[0]
        return (
            <button
                onClick={() => handleControlSelect(control)}
                className={`w-full p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors ${className}`}
            >
                <div className="font-medium text-sm text-gray-900">
                    {control.label || control.widgetType}
                </div>
                {control.description && (
                    <div className="text-xs text-gray-500 mt-1">
                        {control.description}
                    </div>
                )}
            </button>
        )
    }

    return (
        <div className={`object-widget-selector space-y-2 ${className}`}>
            <div className="text-sm font-medium text-gray-700 mb-2">
                Select Widget Type
            </div>
            {widgetControls.map(control => (
                <button
                    key={control.id}
                    onClick={() => handleControlSelect(control)}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                    <div className="font-medium text-sm text-gray-900">
                        {control.label || control.widgetType}
                    </div>
                    {control.description && (
                        <div className="text-xs text-gray-500 mt-1">
                            {control.description}
                        </div>
                    )}
                </button>
            ))}
        </div>
    )
}

/**
 * ObjectWidgetProvider - Context provider with object-specific defaults
 */
export function ObjectWidgetProvider({ children, objectType, objectData, onWidgetChange }) {
    const contextOperations = useMemo(() =>
        createContextOperations(WIDGET_CONTEXTS.OBJECT),
        []
    )

    const initialWidgets = objectData?.widgets || {}

    return (
        <WithSharedWidgets
            context={WIDGET_CONTEXTS.OBJECT}
            widgets={initialWidgets}
            onWidgetChange={onWidgetChange}
            editorMode="edit"
        >
            <div className="object-widget-provider">
                {typeof children === 'function'
                    ? children(contextOperations)
                    : children
                }
            </div>
        </WithSharedWidgets>
    )
}

export default ObjectWidgetRenderer
