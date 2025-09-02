/**
 * PageWidgetWrapper - Page-specific widget wrapper
 * 
 * Wraps shared widget components with page-specific functionality
 * like layout inheritance, template-based configurations, and page context.
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
 * PageWidgetRenderer - Page context widget renderer
 */
export function PageWidgetRenderer({
    layoutJson,
    pageVersionData,
    webpageData,
    onUpdate,
    editable = true,
    showInheritance = true,
    onSlotClick,
    onWidgetEdit,
    className = ''
}) {
    // Extract slots from layout JSON
    const slots = useMemo(() => {
        if (!layoutJson?.slots) return []
        return Object.keys(layoutJson.slots).map(slotName => ({
            name: slotName,
            ...layoutJson.slots[slotName]
        }))
    }, [layoutJson])

    // Get slot configurations with page-specific enhancements
    const slotConfigurations = useMemo(() => {
        const configs = {}

        slots.forEach(slot => {
            configs[slot.name] = {
                ...slot,
                // Page-specific properties
                supportsInheritance: true,
                allowedTypes: slot.allowedTypes || null, // null means all types allowed
                maxWidgets: slot.maxWidgets || null, // null means unlimited
                templateWidgets: slot.templateWidgets || [],
                inheritanceLevel: slot.inheritanceLevel || 0
            }
        })

        return configs
    }, [slots])

    // Current widgets from page version
    const currentWidgets = pageVersionData?.widgets || {}

    /**
     * Handle widget changes
     */
    const handleWidgetChange = useCallback((newWidgets) => {
        if (onUpdate) {
            onUpdate({ widgets: newWidgets })
        }
    }, [onUpdate])

    /**
     * Handle slot click with page-specific logic
     */
    const handleSlotClick = useCallback((slotName) => {
        if (onSlotClick) {
            onSlotClick(slotName, {
                pageId: webpageData?.id,
                layoutId: layoutJson?.id,
                slotConfig: slotConfigurations[slotName]
            })
        }
    }, [onSlotClick, webpageData?.id, layoutJson?.id, slotConfigurations])

    /**
     * Handle widget edit with page context
     */
    const handleWidgetEdit = useCallback((widget, slotName, index) => {
        if (onWidgetEdit) {
            onWidgetEdit(widget, slotName, index, {
                context: 'page',
                pageId: webpageData?.id,
                canInherit: true,
                templateBased: true
            })
        }
    }, [onWidgetEdit, webpageData?.id])

    return (
        <WithSharedWidgets
            context={WIDGET_CONTEXTS.PAGE}
            widgets={currentWidgets}
            onWidgetChange={handleWidgetChange}
            editorMode="edit"
        >
            <div className={`page-widget-renderer ${className}`}>
                <WidgetRenderer
                    slots={slots}
                    slotConfigurations={slotConfigurations}
                    editable={editable}
                    showSlotBorders={true}
                    showWidgetBorders={true}
                    onSlotClick={handleSlotClick}
                    onWidgetDoubleClick={handleWidgetEdit}
                    emptySlotMessage="Click to add widgets to this section"
                />

                {/* Page-specific inheritance indicators */}
                {showInheritance && (
                    <InheritanceIndicators
                        slots={slots}
                        widgets={currentWidgets}
                        layoutJson={layoutJson}
                    />
                )}
            </div>
        </WithSharedWidgets>
    )
}

/**
 * PageSlotContainer - Page-specific slot container
 */
export function PageSlotContainer({
    slotName,
    layoutSlotConfig = {},
    pageWidgets = [],
    templateWidgets = [],
    editable = true,
    showInheritance = true,
    onWidgetChange,
    onSlotClick,
    onWidgetEdit,
    className = ''
}) {
    // Enhanced slot config for page context
    const slotConfig = useMemo(() => ({
        ...layoutSlotConfig,
        label: layoutSlotConfig.label || slotName,
        supportsInheritance: true,
        templateWidgets,
        allowOverride: true,
        context: 'page'
    }), [layoutSlotConfig, slotName, templateWidgets])

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
            context={WIDGET_CONTEXTS.PAGE}
            widgets={{ [slotName]: pageWidgets }}
            onWidgetChange={(allWidgets) => handleWidgetChange(allWidgets[slotName] || [])}
        >
            <SlotContainer
                slotName={slotName}
                slotConfig={slotConfig}
                showHeader={true}
                showAddButton={true}
                editable={editable}
                collapsible={false}
                emptyMessage="No widgets in this section"
                onSlotClick={onSlotClick}
                onWidgetEdit={onWidgetEdit}
                className={className}
            >
                {/* Page-specific slot content */}
                {showInheritance && templateWidgets.length > 0 && (
                    <TemplateWidgetIndicator
                        templateWidgets={templateWidgets}
                        pageWidgets={pageWidgets}
                    />
                )}
            </SlotContainer>
        </WithSharedWidgets>
    )
}

/**
 * InheritanceIndicators - Shows inheritance relationships
 */
function InheritanceIndicators({ slots, widgets, layoutJson }) {
    const inheritedSlots = useMemo(() => {
        return slots.filter(slot =>
            slot.templateWidgets && slot.templateWidgets.length > 0
        )
    }, [slots])

    if (inheritedSlots.length === 0) return null

    return (
        <div className="inheritance-indicators mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
                Template Inheritance
            </h4>
            <div className="space-y-1">
                {inheritedSlots.map(slot => {
                    const hasOverrides = widgets[slot.name] && widgets[slot.name].length > 0
                    return (
                        <div key={slot.name} className="flex items-center justify-between text-xs">
                            <span className="text-blue-700">
                                {slot.label || slot.name}
                            </span>
                            <span className={`px-2 py-1 rounded ${hasOverrides
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                {hasOverrides ? 'Overridden' : 'Inherited'}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

/**
 * TemplateWidgetIndicator - Shows template widgets in slot
 */
function TemplateWidgetIndicator({ templateWidgets, pageWidgets }) {
    const hasOverrides = pageWidgets.length > 0

    return (
        <div className="template-widget-indicator mt-3 p-2 bg-blue-50 rounded border border-blue-200">
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <span className="text-blue-700">
                        {templateWidgets.length} template widget{templateWidgets.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${hasOverrides
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                    {hasOverrides ? 'Customized' : 'Using Template'}
                </span>
            </div>

            {hasOverrides && (
                <div className="mt-1 text-xs text-blue-600">
                    Page widgets will override template widgets
                </div>
            )}
        </div>
    )
}

/**
 * PageWidgetProvider - Context provider with page-specific defaults
 */
export function PageWidgetProvider({ children, pageData, layoutData, onWidgetChange }) {
    const contextOperations = useMemo(() =>
        createContextOperations(WIDGET_CONTEXTS.PAGE),
        []
    )

    const initialWidgets = pageData?.widgets || {}

    return (
        <WithSharedWidgets
            context={WIDGET_CONTEXTS.PAGE}
            widgets={initialWidgets}
            onWidgetChange={onWidgetChange}
            editorMode="edit"
        >
            <div className="page-widget-provider">
                {typeof children === 'function'
                    ? children(contextOperations)
                    : children
                }
            </div>
        </WithSharedWidgets>
    )
}

export default PageWidgetRenderer
