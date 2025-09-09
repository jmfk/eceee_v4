/**
 * ObjectEditor Event System
 * 
 * Event system specifically designed for ObjectEditor with support for
 * object type configurations, slot-based management, and simpler workflows.
 */

/**
 * ObjectEditor-specific event types
 */
export const OBJECT_EDITOR_EVENTS = {
    // Widget events with ObjectEditor context
    WIDGET_CHANGED: 'object-editor:widget:changed',
    WIDGET_SAVED: 'object-editor:widget:saved',
    WIDGET_ADDED: 'object-editor:widget:added',
    WIDGET_REMOVED: 'object-editor:widget:removed',
    WIDGET_MOVED: 'object-editor:widget:moved',
    WIDGET_DUPLICATED: 'object-editor:widget:duplicated',
    WIDGET_VALIDATED: 'object-editor:widget:validated',
    WIDGET_ERROR: 'object-editor:widget:error',

    // Slot events
    SLOT_CLEARED: 'object-editor:slot:cleared',
    SLOT_VALIDATED: 'object-editor:slot:validated',
    SLOT_CONSTRAINT_VIOLATED: 'object-editor:slot:constraint-violated',
    SLOT_WIDGET_LIMIT_REACHED: 'object-editor:slot:widget-limit-reached',

    // Object events
    OBJECT_VALIDATED: 'object-editor:object:validated',
    OBJECT_SAVED: 'object-editor:object:saved',
    OBJECT_TYPE_CHANGED: 'object-editor:object-type:changed',

    // Editor events
    EDITOR_MODE_CHANGED: 'object-editor:mode:changed',
    BULK_OPERATION_STARTED: 'object-editor:bulk:started',
    BULK_OPERATION_COMPLETED: 'object-editor:bulk:completed'
}

/**
 * ObjectEditor change types for widget events
 */
export const OBJECT_EDITOR_CHANGE_TYPES = {
    CONFIG: 'config',
    POSITION: 'position',
    SLOT: 'slot',
    DUPLICATION: 'duplication',
    BULK: 'bulk'
}

/**
 * ObjectEditor Event Emitter Class
 * 
 * Provides ObjectEditor-specific event emission with additional context
 * like object type information, slot configurations, and validation state.
 */
export class ObjectEditorEventEmitter {
    constructor(baseEventSystem) {
        this.emit = baseEventSystem.emit
        this.subscribe = baseEventSystem.subscribe
    }

    // Widget events with ObjectEditor context
    emitWidgetChanged(widgetId, slotName, updatedWidget, changeType = 'config', context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.WIDGET_CHANGED, {
            widgetId,
            slotName,
            widget: updatedWidget,
            changeType,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetSaved(widgetId, slotName, savedWidget, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.WIDGET_SAVED, {
            widgetId,
            slotName,
            widget: savedWidget,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetAdded(slotName, newWidget, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.WIDGET_ADDED, {
            slotName,
            widget: newWidget,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            widgetCount: context.widgetCount,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetRemoved(slotName, widgetId, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.WIDGET_REMOVED, {
            slotName,
            widgetId,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            widgetCount: context.widgetCount,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetMoved(slotName, widgetId, fromIndex, toIndex, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.WIDGET_MOVED, {
            slotName,
            widgetId,
            fromIndex,
            toIndex,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetDuplicated(slotName, originalWidgetId, duplicatedWidget, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.WIDGET_DUPLICATED, {
            slotName,
            originalWidgetId,
            duplicatedWidget,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetValidated(widgetId, slotName, validationResult, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.WIDGET_VALIDATED, {
            widgetId,
            slotName,
            isValid: validationResult.isValid,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetError(widgetId, slotName, error, errorContext = 'unknown', context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.WIDGET_ERROR, {
            widgetId,
            slotName,
            error: error.message || error,
            context: errorContext,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            timestamp: Date.now(),
            ...context
        })
    }

    // Slot events
    emitSlotCleared(slotName, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.SLOT_CLEARED, {
            slotName,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            previousWidgetCount: context.previousWidgetCount,
            timestamp: Date.now(),
            ...context
        })
    }

    emitSlotValidated(slotName, validationResult, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.SLOT_VALIDATED, {
            slotName,
            isValid: validationResult.isValid,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            widgetCount: context.widgetCount,
            timestamp: Date.now(),
            ...context
        })
    }

    emitSlotConstraintViolated(slotName, constraint, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.SLOT_CONSTRAINT_VIOLATED, {
            slotName,
            constraint,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            currentState: context.currentState,
            timestamp: Date.now(),
            ...context
        })
    }

    emitSlotWidgetLimitReached(slotName, limit, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.SLOT_WIDGET_LIMIT_REACHED, {
            slotName,
            limit,
            objectType: context.objectType,
            slotConfig: context.slotConfig,
            currentCount: context.currentCount,
            timestamp: Date.now(),
            ...context
        })
    }

    // Object events
    emitObjectValidated(validationResult, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.OBJECT_VALIDATED, {
            isValid: validationResult.isValid,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            slotResults: validationResult.slotResults,
            objectType: context.objectType,
            timestamp: Date.now(),
            ...context
        })
    }

    emitObjectSaved(objectData, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.OBJECT_SAVED, {
            objectData,
            objectType: context.objectType,
            saveStrategy: context.saveStrategy,
            timestamp: Date.now(),
            ...context
        })
    }

    emitObjectTypeChanged(oldType, newType, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.OBJECT_TYPE_CHANGED, {
            oldType,
            newType,
            migrationRequired: context.migrationRequired,
            affectedSlots: context.affectedSlots,
            timestamp: Date.now(),
            ...context
        })
    }

    // Editor events
    emitEditorModeChanged(newMode, previousMode, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.EDITOR_MODE_CHANGED, {
            newMode,
            previousMode,
            objectType: context.objectType,
            timestamp: Date.now(),
            ...context
        })
    }

    emitBulkOperationStarted(operation, targets, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.BULK_OPERATION_STARTED, {
            operation,
            targets,
            objectType: context.objectType,
            timestamp: Date.now(),
            ...context
        })
    }

    emitBulkOperationCompleted(operation, results, context = {}) {
        this.emit(OBJECT_EDITOR_EVENTS.BULK_OPERATION_COMPLETED, {
            operation,
            results,
            objectType: context.objectType,
            successCount: results.filter(r => r.success).length,
            errorCount: results.filter(r => !r.success).length,
            timestamp: Date.now(),
            ...context
        })
    }
}

/**
 * ObjectEditor Event Listener Class
 * 
 * Enhanced event listener with ObjectEditor-specific event filtering
 * and context extraction.
 */
export class ObjectEditorEventListener {
    constructor(baseEventSystem) {
        this.subscribe = baseEventSystem.subscribe
    }

    // Listen to widget events with slot filtering
    onWidgetChanged(callback, slotFilter = null) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.WIDGET_CHANGED, (payload) => {
            if (slotFilter && payload.slotName !== slotFilter) {
                return // Skip events from different slots
            }
            callback(payload)
        })
    }

    onWidgetSaved(callback, slotFilter = null) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.WIDGET_SAVED, (payload) => {
            if (slotFilter && payload.slotName !== slotFilter) {
                return
            }
            callback(payload)
        })
    }

    onWidgetAdded(callback, slotFilter = null) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.WIDGET_ADDED, (payload) => {
            if (slotFilter && payload.slotName !== slotFilter) {
                return
            }
            callback(payload)
        })
    }

    onWidgetRemoved(callback, slotFilter = null) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.WIDGET_REMOVED, (payload) => {
            if (slotFilter && payload.slotName !== slotFilter) {
                return
            }
            callback(payload)
        })
    }

    onWidgetDuplicated(callback, slotFilter = null) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.WIDGET_DUPLICATED, (payload) => {
            if (slotFilter && payload.slotName !== slotFilter) {
                return
            }
            callback(payload)
        })
    }

    // Slot events
    onSlotCleared(callback, slotFilter = null) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.SLOT_CLEARED, (payload) => {
            if (slotFilter && payload.slotName !== slotFilter) {
                return
            }
            callback(payload)
        })
    }

    onSlotValidated(callback, slotFilter = null) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.SLOT_VALIDATED, (payload) => {
            if (slotFilter && payload.slotName !== slotFilter) {
                return
            }
            callback(payload)
        })
    }

    onSlotConstraintViolated(callback) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.SLOT_CONSTRAINT_VIOLATED, callback)
    }

    onSlotWidgetLimitReached(callback) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.SLOT_WIDGET_LIMIT_REACHED, callback)
    }

    // Object events
    onObjectValidated(callback) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.OBJECT_VALIDATED, callback)
    }

    onObjectSaved(callback) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.OBJECT_SAVED, callback)
    }

    onObjectTypeChanged(callback) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.OBJECT_TYPE_CHANGED, callback)
    }

    // Editor events
    onEditorModeChanged(callback) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.EDITOR_MODE_CHANGED, callback)
    }

    onBulkOperationStarted(callback) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.BULK_OPERATION_STARTED, callback)
    }

    onBulkOperationCompleted(callback) {
        return this.subscribe(OBJECT_EDITOR_EVENTS.BULK_OPERATION_COMPLETED, callback)
    }
}

/**
 * Create ObjectEditor event system from base event system
 * @param {Object} baseEventSystem - Base widget event system
 * @returns {Object} ObjectEditor event system
 */
export const createObjectEditorEventSystem = (baseEventSystem) => {
    const emitter = new ObjectEditorEventEmitter(baseEventSystem)
    const listener = new ObjectEditorEventListener(baseEventSystem)

    return {
        // Base methods
        emit: emitter.emit.bind(emitter),
        subscribe: listener.subscribe.bind(listener),
        emitter,
        listener,

        // Emitter methods
        emitWidgetChanged: emitter.emitWidgetChanged.bind(emitter),
        emitWidgetSaved: emitter.emitWidgetSaved.bind(emitter),
        emitWidgetAdded: emitter.emitWidgetAdded.bind(emitter),
        emitWidgetRemoved: emitter.emitWidgetRemoved.bind(emitter),
        emitWidgetMoved: emitter.emitWidgetMoved.bind(emitter),
        emitWidgetDuplicated: emitter.emitWidgetDuplicated.bind(emitter),
        emitWidgetValidated: emitter.emitWidgetValidated.bind(emitter),
        emitWidgetError: emitter.emitWidgetError.bind(emitter),
        emitSlotCleared: emitter.emitSlotCleared.bind(emitter),
        emitSlotValidated: emitter.emitSlotValidated.bind(emitter),
        emitSlotConstraintViolated: emitter.emitSlotConstraintViolated.bind(emitter),
        emitSlotWidgetLimitReached: emitter.emitSlotWidgetLimitReached.bind(emitter),
        emitObjectValidated: emitter.emitObjectValidated.bind(emitter),
        emitObjectSaved: emitter.emitObjectSaved.bind(emitter),
        emitObjectTypeChanged: emitter.emitObjectTypeChanged.bind(emitter),
        emitEditorModeChanged: emitter.emitEditorModeChanged.bind(emitter),
        emitBulkOperationStarted: emitter.emitBulkOperationStarted.bind(emitter),
        emitBulkOperationCompleted: emitter.emitBulkOperationCompleted.bind(emitter),

        // Listener methods
        onWidgetChanged: listener.onWidgetChanged.bind(listener),
        onWidgetSaved: listener.onWidgetSaved.bind(listener),
        onWidgetAdded: listener.onWidgetAdded.bind(listener),
        onWidgetRemoved: listener.onWidgetRemoved.bind(listener),
        onWidgetDuplicated: listener.onWidgetDuplicated.bind(listener),
        onSlotCleared: listener.onSlotCleared.bind(listener),
        onSlotValidated: listener.onSlotValidated.bind(listener),
        onSlotConstraintViolated: listener.onSlotConstraintViolated.bind(listener),
        onSlotWidgetLimitReached: listener.onSlotWidgetLimitReached.bind(listener),
        onObjectValidated: listener.onObjectValidated.bind(listener),
        onObjectSaved: listener.onObjectSaved.bind(listener),
        onObjectTypeChanged: listener.onObjectTypeChanged.bind(listener),
        onEditorModeChanged: listener.onEditorModeChanged.bind(listener),
        onBulkOperationStarted: listener.onBulkOperationStarted.bind(listener),
        onBulkOperationCompleted: listener.onBulkOperationCompleted.bind(listener)
    }
}
