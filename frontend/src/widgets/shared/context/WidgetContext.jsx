/**
 * Widget Context - Global widget state management
 * 
 * Provides shared state and functionality for widget operations
 * across both page and object editing contexts.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react'
import { createWidgetAdapter, WIDGET_CONTEXTS } from '../utils/adapters'
import { validateWidgetConfig } from '../utils/validation'

/**
 * Widget actions
 */
export const WIDGET_ACTIONS = {
    SET_CONTEXT: 'SET_CONTEXT',
    SET_WIDGETS: 'SET_WIDGETS',
    ADD_WIDGET: 'ADD_WIDGET',
    UPDATE_WIDGET: 'UPDATE_WIDGET',
    DELETE_WIDGET: 'DELETE_WIDGET',
    CLEAR_SLOT: 'CLEAR_SLOT',
    REORDER_WIDGETS: 'REORDER_WIDGETS',
    SET_SELECTED_WIDGET: 'SET_SELECTED_WIDGET',
    SET_VALIDATION_RESULTS: 'SET_VALIDATION_RESULTS',
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR',
    CLEAR_ERROR: 'CLEAR_ERROR'
}

/**
 * Initial widget state
 */
const initialState = {
    context: WIDGET_CONTEXTS.PAGE,
    widgets: {},
    selectedWidget: null,
    validationResults: {},
    isLoading: false,
    error: null,
    adapter: null
}

/**
 * Widget state reducer
 */
function widgetReducer(state, action) {
    switch (action.type) {
        case WIDGET_ACTIONS.SET_CONTEXT:
            return {
                ...state,
                context: action.payload.context,
                adapter: createWidgetAdapter(action.payload.context)
            }

        case WIDGET_ACTIONS.SET_WIDGETS:
            return {
                ...state,
                widgets: action.payload.widgets
            }

        case WIDGET_ACTIONS.ADD_WIDGET:
            const { slotName, widget } = action.payload
            const currentSlotWidgets = state.widgets[slotName] || []
            return {
                ...state,
                widgets: {
                    ...state.widgets,
                    [slotName]: [...currentSlotWidgets, widget]
                }
            }

        case WIDGET_ACTIONS.UPDATE_WIDGET:
            const { slotName: updateSlotName, widgetId, updatedWidget } = action.payload
            const updatedSlotWidgets = state.widgets[updateSlotName]?.map(w =>
                w.id === widgetId ? updatedWidget : w
            ) || []
            return {
                ...state,
                widgets: {
                    ...state.widgets,
                    [updateSlotName]: updatedSlotWidgets
                }
            }

        case WIDGET_ACTIONS.DELETE_WIDGET:
            const { slotName: deleteSlotName, widgetId: deleteWidgetId } = action.payload
            const filteredWidgets = state.widgets[deleteSlotName]?.filter(w =>
                w.id !== deleteWidgetId
            ) || []
            return {
                ...state,
                widgets: {
                    ...state.widgets,
                    [deleteSlotName]: filteredWidgets
                },
                selectedWidget: state.selectedWidget?.id === deleteWidgetId ? null : state.selectedWidget
            }

        case WIDGET_ACTIONS.CLEAR_SLOT:
            return {
                ...state,
                widgets: {
                    ...state.widgets,
                    [action.payload.slotName]: []
                },
                selectedWidget: null
            }

        case WIDGET_ACTIONS.REORDER_WIDGETS:
            const { slotName: reorderSlotName, fromIndex, toIndex } = action.payload
            const slotWidgets = [...(state.widgets[reorderSlotName] || [])]
            const [movedWidget] = slotWidgets.splice(fromIndex, 1)
            slotWidgets.splice(toIndex, 0, movedWidget)
            return {
                ...state,
                widgets: {
                    ...state.widgets,
                    [reorderSlotName]: slotWidgets
                }
            }

        case WIDGET_ACTIONS.SET_SELECTED_WIDGET:
            return {
                ...state,
                selectedWidget: action.payload.widget
            }

        case WIDGET_ACTIONS.SET_VALIDATION_RESULTS:
            return {
                ...state,
                validationResults: action.payload.results
            }

        case WIDGET_ACTIONS.SET_LOADING:
            return {
                ...state,
                isLoading: action.payload.loading
            }

        case WIDGET_ACTIONS.SET_ERROR:
            return {
                ...state,
                error: action.payload.error,
                isLoading: false
            }

        case WIDGET_ACTIONS.CLEAR_ERROR:
            return {
                ...state,
                error: null
            }

        default:
            return state
    }
}

/**
 * Widget Context
 */
const WidgetContext = createContext()

/**
 * Widget Context Provider
 */
export function WidgetProvider({
    children,
    initialContext = WIDGET_CONTEXTS.PAGE,
    initialWidgets = {},
    onWidgetChange
}) {
    const [state, dispatch] = useReducer(widgetReducer, {
        ...initialState,
        context: initialContext,
        widgets: initialWidgets,
        adapter: createWidgetAdapter(initialContext)
    })

    // Sync external widget changes
    useEffect(() => {
        if (JSON.stringify(initialWidgets) !== JSON.stringify(state.widgets)) {
            dispatch({
                type: WIDGET_ACTIONS.SET_WIDGETS,
                payload: { widgets: initialWidgets }
            })
        }
    }, [initialWidgets, state.widgets])

    // Notify parent of widget changes
    useEffect(() => {
        if (onWidgetChange) {
            onWidgetChange(state.widgets)
        }
    }, [state.widgets, onWidgetChange])

    /**
     * Set widget context
     */
    const setContext = useCallback((context) => {
        dispatch({
            type: WIDGET_ACTIONS.SET_CONTEXT,
            payload: { context }
        })
    }, [])

    /**
     * Add widget to slot
     */
    const addWidget = useCallback((slotName, widget, slotConfig = null) => {
        if (!state.adapter) return

        const result = state.adapter.handleOperation('add', {
            slotName,
            widgetData: widget,
            widgets: state.widgets,
            slotConfig
        })

        if (result.success) {
            dispatch({
                type: WIDGET_ACTIONS.SET_WIDGETS,
                payload: { widgets: result.widgets }
            })
        } else {
            dispatch({
                type: WIDGET_ACTIONS.SET_ERROR,
                payload: { error: result.error }
            })
        }

        return result
    }, [state.adapter, state.widgets])

    /**
     * Update widget configuration
     */
    const updateWidget = useCallback((slotName, widgetId, updatedWidget, slotConfig = null) => {
        if (!state.adapter) return

        // Validate updated widget
        const validation = validateWidgetConfig(updatedWidget, {
            context: state.context,
            slotConfig
        })

        if (!validation.isValid) {
            dispatch({
                type: WIDGET_ACTIONS.SET_VALIDATION_RESULTS,
                payload: { results: { [widgetId]: validation } }
            })
        }

        const result = state.adapter.handleOperation('edit', {
            slotName,
            widgetData: updatedWidget,
            widgets: state.widgets,
            slotConfig
        })

        if (result.success) {
            dispatch({
                type: WIDGET_ACTIONS.SET_WIDGETS,
                payload: { widgets: result.widgets }
            })
        } else {
            dispatch({
                type: WIDGET_ACTIONS.SET_ERROR,
                payload: { error: result.error }
            })
        }

        return result
    }, [state.adapter, state.widgets, state.context])

    /**
     * Delete widget from slot
     */
    const deleteWidget = useCallback((slotName, widgetId, slotConfig = null) => {
        if (!state.adapter) return

        const result = state.adapter.handleOperation('delete', {
            slotName,
            widgetData: widgetId,
            widgets: state.widgets,
            slotConfig
        })

        if (result.success) {
            dispatch({
                type: WIDGET_ACTIONS.SET_WIDGETS,
                payload: { widgets: result.widgets }
            })
        } else {
            dispatch({
                type: WIDGET_ACTIONS.SET_ERROR,
                payload: { error: result.error }
            })
        }

        return result
    }, [state.adapter, state.widgets])

    /**
     * Clear all widgets from slot
     */
    const clearSlot = useCallback((slotName, slotConfig = null) => {
        if (!state.adapter) return

        const result = state.adapter.handleOperation('clear', {
            slotName,
            widgets: state.widgets,
            slotConfig
        })

        if (result.success) {
            dispatch({
                type: WIDGET_ACTIONS.SET_WIDGETS,
                payload: { widgets: result.widgets }
            })
        } else {
            dispatch({
                type: WIDGET_ACTIONS.SET_ERROR,
                payload: { error: result.error }
            })
        }

        return result
    }, [state.adapter, state.widgets])

    /**
     * Reorder widgets in slot
     */
    const reorderWidgets = useCallback((slotName, fromIndex, toIndex) => {
        dispatch({
            type: WIDGET_ACTIONS.REORDER_WIDGETS,
            payload: { slotName, fromIndex, toIndex }
        })
    }, [])

    /**
     * Select widget for editing
     */
    const selectWidget = useCallback((widget) => {
        dispatch({
            type: WIDGET_ACTIONS.SET_SELECTED_WIDGET,
            payload: { widget }
        })
    }, [])

    /**
     * Get widgets for a specific slot
     */
    const getSlotWidgets = useCallback((slotName) => {
        return state.widgets[slotName] || []
    }, [state.widgets])

    /**
     * Get available widget types for current context
     */
    const getAvailableWidgetTypes = useCallback((slotConfig = {}) => {
        if (!state.adapter) return []
        return state.adapter.getAvailableWidgetTypes(slotConfig)
    }, [state.adapter])

    /**
     * Validate all widgets
     */
    const validateAllWidgets = useCallback(() => {
        const results = {}

        Object.entries(state.widgets).forEach(([slotName, slotWidgets]) => {
            slotWidgets.forEach(widget => {
                const validation = validateWidgetConfig(widget, {
                    context: state.context
                })
                results[widget.id] = validation
            })
        })

        dispatch({
            type: WIDGET_ACTIONS.SET_VALIDATION_RESULTS,
            payload: { results }
        })

        return results
    }, [state.widgets, state.context])

    /**
     * Clear error state
     */
    const clearError = useCallback(() => {
        dispatch({ type: WIDGET_ACTIONS.CLEAR_ERROR })
    }, [])

    const contextValue = {
        // State
        context: state.context,
        widgets: state.widgets,
        selectedWidget: state.selectedWidget,
        validationResults: state.validationResults,
        isLoading: state.isLoading,
        error: state.error,
        adapter: state.adapter,

        // Actions
        setContext,
        addWidget,
        updateWidget,
        deleteWidget,
        clearSlot,
        reorderWidgets,
        selectWidget,
        getSlotWidgets,
        getAvailableWidgetTypes,
        validateAllWidgets,
        clearError
    }

    return (
        <WidgetContext.Provider value={contextValue}>
            {children}
        </WidgetContext.Provider>
    )
}

/**
 * Hook to use widget context
 */
export function useWidgetContext() {
    const context = useContext(WidgetContext)
    if (!context) {
        throw new Error('useWidgetContext must be used within a WidgetProvider')
    }
    return context
}

/**
 * Hook to use widget operations
 */
export function useWidgetOperations(slotName, slotConfig = null) {
    const {
        addWidget,
        updateWidget,
        deleteWidget,
        clearSlot,
        reorderWidgets,
        getSlotWidgets,
        getAvailableWidgetTypes
    } = useWidgetContext()

    return {
        widgets: getSlotWidgets(slotName),
        availableTypes: getAvailableWidgetTypes(slotConfig),
        addWidget: (widget) => addWidget(slotName, widget, slotConfig),
        updateWidget: (widgetId, updatedWidget) => updateWidget(slotName, widgetId, updatedWidget, slotConfig),
        deleteWidget: (widgetId) => deleteWidget(slotName, widgetId, slotConfig),
        clearSlot: () => clearSlot(slotName, slotConfig),
        reorderWidgets: (fromIndex, toIndex) => reorderWidgets(slotName, fromIndex, toIndex)
    }
}
