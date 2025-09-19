/**
 * Widget Event Types and Constants
 * 
 * Centralized definition of all widget event types and their expected payloads.
 * This provides type safety and documentation for the event system.
 */

// Event type constants
export const WIDGET_EVENTS = {
    // Real-time changes (for live preview)
    CHANGED: 'widget:changed',

    // Persistent changes (saved to backend)
    SAVED: 'widget:saved',

    // CRUD operations
    ADDED: 'widget:added',
    REMOVED: 'widget:removed',
    MOVED: 'widget:moved',

    // Validation
    ERROR: 'widget:error',

    // Editor state
    EDITOR_OPENED: 'widget:editor:opened',
    EDITOR_CLOSED: 'widget:editor:closed',

    // Bulk operations
    BULK_UPDATE: 'widget:bulk:update',
    SLOT_CLEARED: 'widget:slot:cleared'
}

// Change types for widget:changed events
export const WIDGET_CHANGE_TYPES = {
    CONFIG: 'config',        // Configuration change
    POSITION: 'position',    // Position/order change
    SLOT: 'slot',           // Slot assignment change
    METADATA: 'metadata'     // Widget metadata change
}

// Validation result structure
export const createValidationResult = (isValid, errors = {}, warnings = {}) => ({
    isValid,
    errors,
    warnings,
    timestamp: Date.now()
})

// Event payload creators for type safety
export const createWidgetChangedPayload = (widgetId, slotName, widget, changeType = WIDGET_CHANGE_TYPES.CONFIG) => ({
    widgetId,
    slotName,
    widget,
    changeType,
    timestamp: Date.now()
})

export const createWidgetSavedPayload = (widgetId, slotName, widget) => ({
    widgetId,
    slotName,
    widget,
    timestamp: Date.now()
})

export const createWidgetAddedPayload = (slotName, widget) => ({
    slotName,
    widget,
    timestamp: Date.now()
})

export const createWidgetRemovedPayload = (slotName, widgetId) => ({
    slotName,
    widgetId,
    timestamp: Date.now()
})

export const createWidgetMovedPayload = (slotName, widgetId, fromIndex, toIndex) => ({
    slotName,
    widgetId,
    fromIndex,
    toIndex,
    timestamp: Date.now()
})

export const createWidgetValidatedPayload = (widgetId, slotName, validationResult) => ({
    widgetId,
    slotName,
    ...validationResult,
    timestamp: Date.now()
})

export const createWidgetErrorPayload = (widgetId, slotName, error, context = 'unknown') => ({
    widgetId,
    slotName,
    error: error.message || error,
    context,
    timestamp: Date.now()
})

// Helper to validate event payloads (for development)
export const validateEventPayload = (eventType, payload) => {
    if (process.env.NODE_ENV !== 'development') return true

    const requiredFields = {
        [WIDGET_EVENTS.CHANGED]: ['widgetId', 'slotName', 'widget', 'changeType'],
        [WIDGET_EVENTS.SAVED]: ['widgetId', 'slotName', 'widget'],
        [WIDGET_EVENTS.ADDED]: ['slotName', 'widget'],
        [WIDGET_EVENTS.REMOVED]: ['slotName', 'widgetId'],
        [WIDGET_EVENTS.MOVED]: ['slotName', 'widgetId', 'fromIndex', 'toIndex'],
        [WIDGET_EVENTS.ERROR]: ['widgetId', 'slotName', 'error']
    }

    const required = requiredFields[eventType]
    if (!required) {
        console.warn(`Unknown widget event type: ${eventType}`)
        return false
    }

    const missing = required.filter(field => !(field in payload))
    if (missing.length > 0) {
        console.warn(`Widget event ${eventType} missing required fields:`, missing)
        return false
    }

    return true
}
