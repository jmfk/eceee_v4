import React, { createContext, useContext, useCallback, useRef, useEffect, useState } from 'react'
import { useUnifiedData } from './unified-data'

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

export const WidgetEventProvider = ({ children }) => {
    // Create event bus
    const listenersRef = useRef(new Map())

    // Get UnifiedDataContext
    const { setIsDirty } = useUnifiedData()

    // Global dirty state tracking
    const [widgetHasUnsavedChanges, setWidgetHasUnsavedChanges] = useState(false)

    // Emit an event to all subscribers
    const emit = useCallback((eventType, payload = {}) => {
        if (DEBUG_ENABLED) {
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

    // Update dirty state based on events
    useEffect(() => {

        const handleWidgetChanged = (payload) => {
            if (payload.changeType === 'config') {
                setIsDirty(true)
            }
        }

        const handleWidgetSaved = () => {
            setIsDirty(false)
            setWidgetHasUnsavedChanges(false)
        }

        const handleWidgetEditorChanges = (payload) => {
            setWidgetHasUnsavedChanges(payload.hasUnsavedChanges)
        }

        // Subscribe to relevant events
        const unsubscribeChanged = subscribe('widget:changed', handleWidgetChanged)
        const unsubscribeSaved = subscribe('widget:saved', handleWidgetSaved)
        const unsubscribeEditor = subscribe('widget:editor:changes', handleWidgetEditorChanges)

        return () => {
            unsubscribeChanged()
            unsubscribeSaved()
            unsubscribeEditor()
        }
    }, [subscribe])

    const contextValue = {
        emit,
        subscribe,
        widgetHasUnsavedChanges,
        setWidgetHasUnsavedChanges
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


export default WidgetEventContext
