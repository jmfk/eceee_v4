/**
 * useWidgetOperations - Shared widget operation hooks
 * 
 * Provides reusable hooks for common widget operations like
 * CRUD operations, validation, drag-and-drop, and clipboard functionality.
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import { useWidgetContext } from '../context/WidgetContext'
import { useEditorContext } from '../context/EditorContext'
import { createWidget, cloneWidget, updateWidgetConfig } from '../utils/widgetFactory'
import { validateWidgetConfig, validateWidgetsInSlot } from '../utils/validation'

/**
 * Hook for basic widget CRUD operations
 * @param {string} slotName - Target slot name
 * @param {Object} slotConfig - Slot configuration
 * @returns {Object} Widget operation functions
 */
export function useWidgetCRUD(slotName, slotConfig = {}) {
    const {
        context,
        addWidget: contextAddWidget,
        updateWidget: contextUpdateWidget,
        deleteWidget: contextDeleteWidget,
        clearSlot: contextClearSlot,
        getSlotWidgets,
        adapter
    } = useWidgetContext()

    const widgets = getSlotWidgets(slotName)

    /**
     * Add a new widget to the slot
     */
    const addWidget = useCallback(async (widgetSlug, config = {}, options = {}) => {
        try {
            const widget = createWidget(widgetSlug, {
                context,
                config,
                ...options
            })

            const result = contextAddWidget(slotName, widget, slotConfig)
            return { success: true, widget, result }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }, [context, contextAddWidget, slotName, slotConfig])

    /**
     * Update an existing widget
     */
    const updateWidget = useCallback(async (widgetId, newConfig, options = {}) => {
        try {
            const existingWidget = widgets.find(w => w.id === widgetId)
            if (!existingWidget) {
                throw new Error('Widget not found')
            }

            const updatedWidget = updateWidgetConfig(existingWidget, newConfig)
            const result = contextUpdateWidget(slotName, widgetId, updatedWidget, slotConfig)

            return { success: true, widget: updatedWidget, result }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }, [widgets, contextUpdateWidget, slotName, slotConfig])

    /**
     * Delete a widget
     */
    const deleteWidget = useCallback(async (widgetId) => {
        try {
            const result = contextDeleteWidget(slotName, widgetId, slotConfig)
            return { success: true, result }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }, [contextDeleteWidget, slotName, slotConfig])

    /**
     * Clear all widgets from slot
     */
    const clearSlot = useCallback(async () => {
        try {
            const result = contextClearSlot(slotName, slotConfig)
            return { success: true, result }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }, [contextClearSlot, slotName, slotConfig])

    /**
     * Duplicate a widget
     */
    const duplicateWidget = useCallback(async (widgetId) => {
        try {
            const existingWidget = widgets.find(w => w.id === widgetId)
            if (!existingWidget) {
                throw new Error('Widget not found')
            }

            const clonedWidget = cloneWidget(existingWidget)
            const result = contextAddWidget(slotName, clonedWidget, slotConfig)

            return { success: true, widget: clonedWidget, result }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }, [widgets, contextAddWidget, slotName, slotConfig])

    return {
        widgets,
        addWidget,
        updateWidget,
        deleteWidget,
        clearSlot,
        duplicateWidget,
        slotConfig,
        widgetCount: widgets.length,
        canAddWidget: !slotConfig.maxWidgets || widgets.length < slotConfig.maxWidgets,
        isSlotRequired: slotConfig.required || false
    }
}

/**
 * Hook for widget validation operations
 * @param {string} slotName - Target slot name
 * @param {Object} slotConfig - Slot configuration
 * @returns {Object} Validation functions and state
 */
export function useWidgetValidation(slotName, slotConfig = {}) {
    const { context, getSlotWidgets, validationResults } = useWidgetContext()
    const [validationState, setValidationState] = useState({})

    const widgets = getSlotWidgets(slotName)

    /**
     * Validate a single widget
     */
    const validateWidget = useCallback((widget) => {
        return validateWidgetConfig(widget, {
            context,
            slotConfig,
            existingWidgets: widgets.filter(w => w.id !== widget.id)
        })
    }, [context, slotConfig, widgets])

    /**
     * Validate all widgets in slot
     */
    const validateSlot = useCallback(() => {
        return validateWidgetsInSlot(widgets, slotConfig, context)
    }, [widgets, slotConfig, context])

    /**
     * Get validation for specific widget
     */
    const getWidgetValidation = useCallback((widgetId) => {
        return validationResults[widgetId] || { isValid: true, errors: [], warnings: [] }
    }, [validationResults])

    /**
     * Check if slot is valid
     */
    const isSlotValid = useCallback(() => {
        const slotValidation = validateSlot()
        return slotValidation.isValid
    }, [validateSlot])

    return {
        validateWidget,
        validateSlot,
        getWidgetValidation,
        isSlotValid,
        validationState,
        hasValidationErrors: widgets.some(w => {
            const validation = getWidgetValidation(w.id)
            return !validation.isValid
        })
    }
}

/**
 * Hook for drag and drop operations
 * @param {string} slotName - Target slot name
 * @param {Object} slotConfig - Slot configuration
 * @returns {Object} Drag and drop functions
 */
export function useWidgetDragDrop(slotName, slotConfig = {}) {
    const { reorderWidgets } = useWidgetContext()
    const {
        dragState,
        startDrag,
        endDrag,
        setDragTarget
    } = useEditorContext()

    const dropRef = useRef(null)

    /**
     * Handle drag start
     */
    const handleDragStart = useCallback((widget, index) => {
        startDrag(widget, slotName, index)
    }, [startDrag, slotName])

    /**
     * Handle drag over
     */
    const handleDragOver = useCallback((e) => {
        e.preventDefault()

        // Check if drop is valid
        const canDrop = !slotConfig.maxWidgets ||
            dragState.draggedFromSlot === slotName ||
            getSlotWidgets(slotName).length < slotConfig.maxWidgets

        setDragTarget(slotName, canDrop)
    }, [slotConfig, dragState.draggedFromSlot, slotName, setDragTarget])

    /**
     * Handle drop
     */
    const handleDrop = useCallback((e, targetIndex = -1) => {
        e.preventDefault()

        const { draggedWidget, draggedFromSlot, draggedFromIndex } = dragState

        if (!draggedWidget) return

        // Same slot reorder
        if (draggedFromSlot === slotName) {
            const newIndex = targetIndex >= 0 ? targetIndex : getSlotWidgets(slotName).length
            if (draggedFromIndex !== newIndex) {
                reorderWidgets(slotName, draggedFromIndex, newIndex)
            }
        } else {
            // Cross-slot move (would need additional logic)
            console.log('Cross-slot drag not implemented yet')
        }

        endDrag()
    }, [dragState, slotName, reorderWidgets, endDrag])

    /**
     * Handle drag end
     */
    const handleDragEnd = useCallback(() => {
        endDrag()
    }, [endDrag])

    return {
        dropRef,
        isDragOver: dragState.dropTarget === slotName,
        isDragging: dragState.isDragging,
        draggedWidget: dragState.draggedWidget,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleDragEnd,
        canAcceptDrop: !slotConfig.maxWidgets || getSlotWidgets(slotName).length < slotConfig.maxWidgets
    }
}

/**
 * Hook for clipboard operations
 * @returns {Object} Clipboard functions and state
 */
export function useWidgetClipboard() {
    const {
        clipboard,
        copyWidget,
        cutWidget,
        clearClipboard
    } = useEditorContext()

    const { addWidget } = useWidgetContext()

    /**
     * Copy widget to clipboard
     */
    const handleCopyWidget = useCallback((widget) => {
        copyWidget(widget)
    }, [copyWidget])

    /**
     * Cut widget to clipboard
     */
    const handleCutWidget = useCallback((widget) => {
        cutWidget(widget)
    }, [cutWidget])

    /**
     * Paste widget from clipboard
     */
    const pasteWidget = useCallback((slotName, slotConfig = {}) => {
        if (!clipboard.widget) return { success: false, error: 'No widget in clipboard' }

        try {
            const clonedWidget = cloneWidget(clipboard.widget)
            const result = addWidget(slotName, clonedWidget, slotConfig)

            // Clear clipboard if it was a cut operation
            if (clipboard.operation === 'cut') {
                clearClipboard()
            }

            return { success: true, widget: clonedWidget, result }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }, [clipboard, addWidget, clearClipboard])

    /**
     * Check if can paste to slot
     */
    const canPasteToSlot = useCallback((slotName, slotConfig = {}) => {
        if (!clipboard.widget) return false

        // Check slot constraints
        if (slotConfig.allowedTypes && !slotConfig.allowedTypes.includes(clipboard.widget.slug)) {
            return false
        }

        return true
    }, [clipboard.widget])

    return {
        clipboard,
        hasClipboardContent: !!clipboard.widget,
        clipboardOperation: clipboard.operation,
        copyWidget: handleCopyWidget,
        cutWidget: handleCutWidget,
        pasteWidget,
        clearClipboard,
        canPasteToSlot
    }
}

/**
 * Hook for widget search and filtering
 * @param {Array} widgets - Widgets to search
 * @returns {Object} Search functions and filtered results
 */
export function useWidgetSearch(widgets = []) {
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filteredWidgets, setFilteredWidgets] = useState(widgets)

    /**
     * Filter widgets based on search term and type
     */
    useEffect(() => {
        let filtered = widgets

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(widget =>
                (widget.name || '').toLowerCase().includes(term) ||
                (widget.type || '').toLowerCase().includes(term) ||
                (widget.slug || '').toLowerCase().includes(term) ||
                JSON.stringify(widget.config || {}).toLowerCase().includes(term)
            )
        }

        // Filter by type
        if (filterType) {
            filtered = filtered.filter(widget =>
                widget.slug === filterType || widget.type === filterType
            )
        }

        setFilteredWidgets(filtered)
    }, [widgets, searchTerm, filterType])

    /**
     * Clear all filters
     */
    const clearFilters = useCallback(() => {
        setSearchTerm('')
        setFilterType('')
    }, [])

    /**
     * Get unique widget types
     */
    const getWidgetTypes = useCallback(() => {
        const types = new Set()
        widgets.forEach(widget => {
            if (widget.slug) types.add(widget.slug)
            if (widget.type) types.add(widget.type)
        })
        return Array.from(types)
    }, [widgets])

    return {
        searchTerm,
        setSearchTerm,
        filterType,
        setFilterType,
        filteredWidgets,
        clearFilters,
        availableTypes: getWidgetTypes(),
        hasActiveFilters: searchTerm || filterType,
        resultCount: filteredWidgets.length
    }
}

/**
 * Hook for widget history/undo operations
 * @param {string} slotName - Target slot name
 * @returns {Object} History functions
 */
export function useWidgetHistory(slotName) {
    const { widgets } = useWidgetContext()
    const { addHistoryEntry, undo, redo, canUndo, canRedo } = useEditorContext()

    /**
     * Record widget state for history
     */
    const recordWidgetState = useCallback((action, widgetData = null) => {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            slotName,
            widgetData,
            slotState: widgets[slotName] ? [...widgets[slotName]] : []
        }

        addHistoryEntry(entry)
    }, [widgets, slotName, addHistoryEntry])

    return {
        recordWidgetState,
        undo,
        redo,
        canUndo,
        canRedo
    }
}
