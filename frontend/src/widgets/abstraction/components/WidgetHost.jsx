/**
 * WidgetHost Component - Rendering Abstraction Layer
 * 
 * Provides a unified interface for rendering widgets in different contexts
 * without requiring widgets to know which editor they're in.
 */

import React, { createContext, useContext, useMemo, useEffect, useState } from 'react'
import { PageWidgetContext } from '../contexts/PageWidgetContext'
import { ObjectWidgetContext } from '../contexts/ObjectWidgetContext'
import { detectWidgetContext } from '../../shared/utils/adapters'

/**
 * Widget Context for React components
 */
const WidgetContextReact = createContext()

/**
 * Hook to access the current widget context
 */
export function useWidgetContext() {
    const context = useContext(WidgetContextReact)
    if (!context) {
        throw new Error('useWidgetContext must be used within a WidgetHost')
    }
    return context
}

/**
 * WidgetHost - Main component that provides context abstraction
 * 
 * Automatically detects the context and provides the appropriate
 * widget context implementation to child components.
 */
export function WidgetHost({
    children,
    context,

    // Page-specific props
    layoutJson,
    pageVersionData,
    webpageData,
    onUpdate,

    // Object-specific props
    objectType,
    objectInstance,
    objectWidgets,
    onWidgetChange,

    // Common props
    editable = true,
    onError,
    renderingMode = 'edit',

    // Context override
    forceContext = null,

    ...otherProps
}) {
    const [contextInstance, setContextInstance] = useState(null)
    const [error, setError] = useState(null)

    // Determine context type
    const contextType = useMemo(() => {
        if (forceContext) return forceContext
        if (context) return context

        // Auto-detect context from props
        return detectWidgetContext({
            objectType,
            objectInstance,
            layoutJson,
            pageVersionData,
            webpageData
        })
    }, [forceContext, context, objectType, objectInstance, layoutJson, pageVersionData, webpageData])

    // Create context instance
    useEffect(() => {
        try {
            let instance

            if (contextType === 'page') {
                instance = new PageWidgetContext({
                    layoutJson,
                    pageVersionData,
                    webpageData,
                    onUpdate,
                    onError: (err) => {
                        setError(err)
                        onError?.(err)
                    },
                    editable
                })
            } else if (contextType === 'object') {
                instance = new ObjectWidgetContext({
                    objectType,
                    objectInstance,
                    objectWidgets,
                    onWidgetChange,
                    onError: (err) => {
                        setError(err)
                        onError?.(err)
                    },
                    editable
                })
            } else {
                throw new Error(`Unknown context type: ${contextType}`)
            }

            setContextInstance(instance)
            setError(null)
        } catch (err) {
            setError(err)
            setContextInstance(null)
        }
    }, [
        contextType,
        layoutJson,
        pageVersionData,
        webpageData,
        onUpdate,
        objectType,
        objectInstance,
        objectWidgets,
        onWidgetChange,
        onError,
        editable
    ])

    // Update context instance when data changes
    useEffect(() => {
        if (contextInstance && contextType === 'page') {
            contextInstance.updateData({
                layoutJson,
                pageVersionData,
                webpageData
            })
        }
    }, [contextInstance, contextType, layoutJson, pageVersionData, webpageData])

    useEffect(() => {
        if (contextInstance && contextType === 'object') {
            contextInstance.updateData({
                objectType,
                objectInstance,
                objectWidgets
            })
        }
    }, [contextInstance, contextType, objectType, objectInstance, objectWidgets])

    // Context value for React components
    const contextValue = useMemo(() => {
        if (!contextInstance) return null

        return {
            // Core context interface
            context: contextInstance,
            type: contextInstance.type,
            renderingMode,

            // Convenience methods
            getSlots: () => contextInstance.getSlots(),
            getWidgets: (slotId) => contextInstance.getWidgets(slotId),
            addWidget: (slotId, widget) => contextInstance.addWidget(slotId, widget),
            removeWidget: (widgetId) => contextInstance.removeWidget(widgetId),
            updateWidget: (widgetId, config) => contextInstance.updateWidget(widgetId, config),
            validateWidget: (widget) => contextInstance.validateWidget(widget),
            canAddWidget: (slotId, widgetType) => contextInstance.canAddWidget(slotId, widgetType),
            getAvailableWidgetTypes: (slotId) => contextInstance.getAvailableWidgetTypes(slotId),
            save: () => contextInstance.save(),

            // State
            isEditable: () => contextInstance.isEditable(),
            getMetadata: () => contextInstance.getMetadata(),

            // Error state
            error,
            clearError: () => setError(null)
        }
    }, [contextInstance, renderingMode, error])

    // Show error state
    if (error && !contextInstance) {
        return (
            <div className="widget-host-error p-4 border border-red-300 bg-red-50 rounded-lg">
                <h3 className="text-red-800 font-medium mb-2">Widget Context Error</h3>
                <p className="text-red-700 text-sm">{error.message}</p>
                <button
                    onClick={() => setError(null)}
                    className="mt-2 px-3 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200"
                >
                    Retry
                </button>
            </div>
        )
    }

    // Show loading state
    if (!contextInstance) {
        return (
            <div className="widget-host-loading p-4 text-center text-gray-500">
                <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-2"></div>
                <p className="text-sm">Initializing widget context...</p>
            </div>
        )
    }

    return (
        <WidgetContextReact.Provider value={contextValue}>
            <div className={`widget-host widget-host--${contextType}`} {...otherProps}>
                {error && (
                    <div className="widget-host-error-banner bg-yellow-50 border border-yellow-200 p-2 mb-4 rounded">
                        <div className="flex items-center justify-between">
                            <span className="text-yellow-800 text-sm">
                                Warning: {error.message}
                            </span>
                            <button
                                onClick={() => setError(null)}
                                className="text-yellow-600 hover:text-yellow-800"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}
                {children}
            </div>
        </WidgetContextReact.Provider>
    )
}

/**
 * Higher-order component for widgets that need context access
 * 
 * @param {React.Component} WrappedComponent - Component to wrap
 * @returns {React.Component} Component with context access
 */
export function withWidgetContext(WrappedComponent) {
    return function WidgetWithContext(props) {
        const context = useWidgetContext()
        return <WrappedComponent {...props} widgetContext={context} />
    }
}

/**
 * Hook for widget operations in the current context
 * 
 * @param {string} slotId - Optional slot ID to scope operations
 * @returns {Object} Widget operations for the current context
 */
export function useWidgetOperations(slotId = null) {
    const context = useWidgetContext()

    return useMemo(() => {
        const operations = {
            // Core operations
            addWidget: context.addWidget,
            removeWidget: context.removeWidget,
            updateWidget: context.updateWidget,
            validateWidget: context.validateWidget,
            save: context.save,

            // Query operations
            getSlots: context.getSlots,
            getWidgets: context.getWidgets,
            canAddWidget: context.canAddWidget,
            getAvailableWidgetTypes: context.getAvailableWidgetTypes,

            // State
            type: context.type,
            isEditable: context.isEditable(),
            metadata: context.getMetadata()
        }

        // Add slot-scoped operations if slotId provided
        if (slotId) {
            operations.slotId = slotId
            operations.slotWidgets = context.getWidgets(slotId)
            operations.availableTypes = context.getAvailableWidgetTypes(slotId)
            operations.addToSlot = (widget) => context.addWidget(slotId, widget)
            operations.canAddToSlot = (widgetType) => context.canAddWidget(slotId, widgetType)
        }

        return operations
    }, [context, slotId])
}

/**
 * Hook for slot-specific operations
 * 
 * @param {string} slotId - Slot identifier
 * @returns {Object} Slot-specific operations and data
 */
export function useSlotOperations(slotId) {
    const context = useWidgetContext()

    return useMemo(() => {
        const slot = context.context.getSlot?.(slotId)

        return {
            slot,
            slotId,
            widgets: context.getWidgets(slotId),
            availableTypes: context.getAvailableWidgetTypes(slotId),
            canAddWidget: (widgetType) => context.canAddWidget(slotId, widgetType),
            addWidget: (widget) => context.addWidget(slotId, widget),

            // Slot metadata
            label: slot?.label || slotId,
            accepts: slot?.accepts || null,
            maxWidgets: slot?.maxWidgets || null,
            minWidgets: slot?.minWidgets || 0,
            hasSpace: slot?.hasSpace?.() || true,
            isValid: slot?.validate?.()?.isValid || true
        }
    }, [context, slotId])
}

/**
 * Context-aware widget renderer component
 * 
 * Renders widgets appropriately based on the current context
 */
export function ContextAwareWidgetRenderer({
    widget,
    slotId,
    onEdit,
    onDelete,
    className = ''
}) {
    const context = useWidgetContext()

    // Get widget editor component (would typically come from registry)
    const WidgetComponent = useMemo(() => {
        // This would typically use the widget registry to get the component
        // For now, return a placeholder
        return function DefaultWidgetRenderer({ widget, onEdit, onDelete }) {
            return (
                <div className={`widget-renderer widget-renderer--${widget.type} ${className}`}>
                    <div className="widget-header flex justify-between items-center p-2 bg-gray-50 border-b">
                        <span className="text-sm font-medium">{widget.type}</span>
                        {context.isEditable() && (
                            <div className="widget-actions flex gap-1">
                                <button
                                    onClick={() => onEdit?.(widget)}
                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => onDelete?.(widget.id)}
                                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="widget-content p-4">
                        <pre className="text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto">
                            {JSON.stringify(widget.config, null, 2)}
                        </pre>
                    </div>
                </div>
            )
        }
    }, [widget.type, className, context])

    const handleEdit = () => {
        onEdit?.(widget, slotId)
    }

    const handleDelete = () => {
        if (onDelete) {
            onDelete(widget.id, slotId)
        } else {
            context.removeWidget(widget.id)
        }
    }

    return (
        <WidgetComponent
            widget={widget}
            slotId={slotId}
            context={context}
            onEdit={handleEdit}
            onDelete={handleDelete}
        />
    )
}

export default WidgetHost
