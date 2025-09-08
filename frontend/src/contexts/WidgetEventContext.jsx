import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react'

/**
 * Widget Event Context - Centralized event system for widget communication
 * 
 * This eliminates prop drilling by allowing any component to emit and listen
 * to widget-related events directly.
 * 
 * Event Types:
 * - widget:changed - When widget config changes (real-time updates)
 * - widget:saved - When widget is saved
 * - widget:added - When widget is added to slot
 * - widget:removed - When widget is removed from slot
 * - widget:moved - When widget is reordered
 * - widget:validated - When widget passes validation
 * - widget:error - When widget has validation errors
 * 
 * TO TURN OFF DEBUG LOGGING:
 * Set DEBUG_ENABLED to false below to disable all console output from widget events
 * 
 * TO TURN ON DEBUG LOGGING:
 * Set DEBUG_ENABLED to true below to enable all debug console output
 */

// Global debug flag - set to false to disable all debug logging
const DEBUG_ENABLED = false

const WidgetEventContext = createContext()

export const WidgetEventProvider = ({ children, sharedEventBus = null }) => {
    // If we have a shared event bus, use its functions directly
    if (sharedEventBus) {
        // Return the shared context directly
        return React.createElement(
            WidgetEventContext.Provider,
            { value: sharedEventBus },
            children
        )
    }

    // Create new event bus if no shared one provided
    const listenersRef = useRef(new Map())

    // Emit an event to all subscribers
    const emit = useCallback((eventType, payload = {}) => {
        if (DEBUG_ENABLED) {
            console.log(`🔔 Widget Event: ${eventType}`, payload)
        }

        const listeners = listenersRef.current.get(eventType) || []

        // Execute listeners asynchronously to prevent blocking
        Promise.resolve().then(() => {
            listeners.forEach((callback, index) => {
                try {
                    callback(payload)
                } catch (error) {
                    console.error(`Widget event error for ${eventType} (listener ${index}):`, error)
                }
            })
        })
    }, [])

    // Subscribe to an event type
    const subscribe = useCallback((eventType, callback) => {
        if (typeof callback !== 'function') {
            console.warn(`Widget event callback for ${eventType} is not a function`)
            return () => { }
        }

        if (!listenersRef.current.has(eventType)) {
            listenersRef.current.set(eventType, [])
        }

        const listeners = listenersRef.current.get(eventType)
        listeners.push(callback)

        if (DEBUG_ENABLED) {
            console.log(`📡 Subscribed to widget event: ${eventType} (${listeners.length} total listeners)`)
        }

        // Return unsubscribe function
        return () => {
            const currentListeners = listenersRef.current.get(eventType) || []
            const index = currentListeners.indexOf(callback)
            if (index > -1) {
                currentListeners.splice(index, 1)
                if (DEBUG_ENABLED) {
                    console.log(`📡 Unsubscribed from widget event: ${eventType} (${currentListeners.length} remaining listeners)`)
                }
            }
        }
    }, [])

    // Get current listener count for debugging
    const getListenerCount = useCallback((eventType) => {
        return listenersRef.current.get(eventType)?.length || 0
    }, [])

    // Clear all listeners (useful for cleanup)
    const clearAllListeners = useCallback(() => {
        listenersRef.current.clear()
        if (DEBUG_ENABLED) {
            console.log('🧹 Cleared all widget event listeners')
        }
    }, [])

    const contextValue = {
        emit,
        subscribe,
        getListenerCount,
        clearAllListeners
    }

    return (
        <WidgetEventContext.Provider value={contextValue}>
            {children}
        </WidgetEventContext.Provider>
    )
}

// Hook to use widget events
export const useWidgetEvents = () => {
    const context = useContext(WidgetEventContext)
    if (!context) {
        throw new Error('useWidgetEvents must be used within WidgetEventProvider')
    }
    return context
}

// Convenience hook for subscribing to events with automatic cleanup
export const useWidgetEventListener = (eventType, callback, dependencies = []) => {
    const { subscribe } = useWidgetEvents()

    useEffect(() => {
        const unsubscribe = subscribe(eventType, callback)
        return unsubscribe
    }, [subscribe, eventType, callback]) // Remove spread dependencies to prevent infinite loops
}

// Convenience hook for emitting events
export const useWidgetEventEmitter = () => {
    const { emit } = useWidgetEvents()

    const emitWidgetChanged = useCallback((widgetId, slotName, updatedWidget, changeType = 'config') => {
        emit('widget:changed', {
            widgetId,
            slotName,
            widget: updatedWidget,
            changeType,
            timestamp: Date.now()
        })
    }, [emit])

    const emitWidgetSaved = useCallback((widgetId, slotName, savedWidget) => {
        emit('widget:saved', {
            widgetId,
            slotName,
            widget: savedWidget,
            timestamp: Date.now()
        })
    }, [emit])

    const emitWidgetAdded = useCallback((slotName, newWidget) => {
        emit('widget:added', {
            slotName,
            widget: newWidget,
            timestamp: Date.now()
        })
    }, [emit])

    const emitWidgetRemoved = useCallback((slotName, widgetId) => {
        emit('widget:removed', {
            slotName,
            widgetId,
            timestamp: Date.now()
        })
    }, [emit])

    const emitWidgetMoved = useCallback((slotName, widgetId, fromIndex, toIndex) => {
        emit('widget:moved', {
            slotName,
            widgetId,
            fromIndex,
            toIndex,
            timestamp: Date.now()
        })
    }, [emit])

    const emitWidgetValidated = useCallback((widgetId, slotName, validationResult) => {
        emit('widget:validated', {
            widgetId,
            slotName,
            isValid: validationResult.isValid,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            timestamp: Date.now()
        })
    }, [emit])

    const emitWidgetError = useCallback((widgetId, slotName, error, context = 'unknown') => {
        emit('widget:error', {
            widgetId,
            slotName,
            error: error.message || error,
            context,
            timestamp: Date.now()
        })
    }, [emit])

    return {
        emit,
        emitWidgetChanged,
        emitWidgetSaved,
        emitWidgetAdded,
        emitWidgetRemoved,
        emitWidgetMoved,
        emitWidgetValidated,
        emitWidgetError
    }
}

export default WidgetEventContext
