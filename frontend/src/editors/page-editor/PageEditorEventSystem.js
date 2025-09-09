/**
 * PageEditor Event System
 * 
 * Event system specifically designed for PageEditor with support for
 * version management, publishing workflows, and layout-based rendering.
 */

/**
 * PageEditor-specific event types
 */
export const PAGE_EDITOR_EVENTS = {
    // Widget events with PageEditor context
    WIDGET_CHANGED: 'page-editor:widget:changed',
    WIDGET_SAVED: 'page-editor:widget:saved',
    WIDGET_ADDED: 'page-editor:widget:added',
    WIDGET_REMOVED: 'page-editor:widget:removed',
    WIDGET_MOVED: 'page-editor:widget:moved',
    WIDGET_VALIDATED: 'page-editor:widget:validated',
    WIDGET_ERROR: 'page-editor:widget:error',

    // Layout events
    LAYOUT_CHANGED: 'page-editor:layout:changed',
    LAYOUT_RENDERED: 'page-editor:layout:rendered',
    SLOT_UPDATED: 'page-editor:slot:updated',

    // Version events
    VERSION_CREATED: 'page-editor:version:created',
    VERSION_SWITCHED: 'page-editor:version:switched',
    VERSION_PUBLISHED: 'page-editor:version:published',
    VERSION_UNPUBLISHED: 'page-editor:version:unpublished',

    // Page events
    PAGE_SAVED: 'page-editor:page:saved',
    PAGE_PUBLISHED: 'page-editor:page:published',
    PAGE_SCHEDULED: 'page-editor:page:scheduled',

    // Editor events
    EDITOR_MODE_CHANGED: 'page-editor:mode:changed',
    PREVIEW_MODE_TOGGLED: 'page-editor:preview:toggled'
}

/**
 * PageEditor change types for widget events
 */
export const PAGE_EDITOR_CHANGE_TYPES = {
    CONFIG: 'config',
    POSITION: 'position',
    SLOT: 'slot',
    VERSION: 'version',
    PUBLISHING: 'publishing'
}

/**
 * PageEditor Event Emitter Class
 * 
 * Provides PageEditor-specific event emission with additional context
 * like version information, publishing status, and layout state.
 */
export class PageEditorEventEmitter {
    constructor(baseEventSystem) {
        this.emit = baseEventSystem.emit
        this.subscribe = baseEventSystem.subscribe
    }

    // Widget events with PageEditor context
    emitWidgetChanged(widgetId, slotName, updatedWidget, changeType = 'config', context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.WIDGET_CHANGED, {
            widgetId,
            slotName,
            widget: updatedWidget,
            changeType,
            versionId: context.versionId,
            isPublished: context.isPublished,
            layoutRenderer: context.layoutRenderer,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetSaved(widgetId, slotName, savedWidget, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.WIDGET_SAVED, {
            widgetId,
            slotName,
            widget: savedWidget,
            versionId: context.versionId,
            isPublished: context.isPublished,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetAdded(slotName, newWidget, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.WIDGET_ADDED, {
            slotName,
            widget: newWidget,
            versionId: context.versionId,
            layoutRenderer: context.layoutRenderer,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetRemoved(slotName, widgetId, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.WIDGET_REMOVED, {
            slotName,
            widgetId,
            versionId: context.versionId,
            isPublished: context.isPublished,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetMoved(slotName, widgetId, fromIndex, toIndex, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.WIDGET_MOVED, {
            slotName,
            widgetId,
            fromIndex,
            toIndex,
            versionId: context.versionId,
            layoutRenderer: context.layoutRenderer,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetValidated(widgetId, slotName, validationResult, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.WIDGET_VALIDATED, {
            widgetId,
            slotName,
            isValid: validationResult.isValid,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            versionId: context.versionId,
            timestamp: Date.now(),
            ...context
        })
    }

    emitWidgetError(widgetId, slotName, error, errorContext = 'unknown', context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.WIDGET_ERROR, {
            widgetId,
            slotName,
            error: error.message || error,
            context: errorContext,
            versionId: context.versionId,
            timestamp: Date.now(),
            ...context
        })
    }

    // Layout events
    emitLayoutChanged(layoutId, layoutData, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.LAYOUT_CHANGED, {
            layoutId,
            layoutData,
            versionId: context.versionId,
            timestamp: Date.now(),
            ...context
        })
    }

    emitLayoutRendered(layoutRenderer, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.LAYOUT_RENDERED, {
            layoutRenderer,
            versionId: context.versionId,
            timestamp: Date.now(),
            ...context
        })
    }

    emitSlotUpdated(slotName, slotData, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.SLOT_UPDATED, {
            slotName,
            slotData,
            versionId: context.versionId,
            layoutRenderer: context.layoutRenderer,
            timestamp: Date.now(),
            ...context
        })
    }

    // Version events
    emitVersionCreated(newVersion, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.VERSION_CREATED, {
            version: newVersion,
            pageId: context.pageId,
            previousVersionId: context.previousVersionId,
            timestamp: Date.now(),
            ...context
        })
    }

    emitVersionSwitched(fromVersion, toVersion, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.VERSION_SWITCHED, {
            fromVersion,
            toVersion,
            pageId: context.pageId,
            timestamp: Date.now(),
            ...context
        })
    }

    emitVersionPublished(versionId, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.VERSION_PUBLISHED, {
            versionId,
            pageId: context.pageId,
            publishedAt: context.publishedAt || new Date().toISOString(),
            timestamp: Date.now(),
            ...context
        })
    }

    emitVersionUnpublished(versionId, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.VERSION_UNPUBLISHED, {
            versionId,
            pageId: context.pageId,
            unpublishedAt: context.unpublishedAt || new Date().toISOString(),
            timestamp: Date.now(),
            ...context
        })
    }

    // Page events
    emitPageSaved(pageData, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.PAGE_SAVED, {
            pageData,
            versionId: context.versionId,
            saveStrategy: context.saveStrategy,
            timestamp: Date.now(),
            ...context
        })
    }

    emitPagePublished(pageData, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.PAGE_PUBLISHED, {
            pageData,
            versionId: context.versionId,
            publishedAt: context.publishedAt || new Date().toISOString(),
            timestamp: Date.now(),
            ...context
        })
    }

    emitPageScheduled(pageData, scheduledDate, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.PAGE_SCHEDULED, {
            pageData,
            versionId: context.versionId,
            scheduledDate,
            timestamp: Date.now(),
            ...context
        })
    }

    // Editor events
    emitEditorModeChanged(newMode, previousMode, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.EDITOR_MODE_CHANGED, {
            newMode,
            previousMode,
            versionId: context.versionId,
            timestamp: Date.now(),
            ...context
        })
    }

    emitPreviewModeToggled(isPreviewMode, context = {}) {
        this.emit(PAGE_EDITOR_EVENTS.PREVIEW_MODE_TOGGLED, {
            isPreviewMode,
            versionId: context.versionId,
            layoutRenderer: context.layoutRenderer,
            timestamp: Date.now(),
            ...context
        })
    }
}

/**
 * PageEditor Event Listener Hook
 * 
 * Enhanced event listener with PageEditor-specific event filtering
 * and context extraction.
 */
export class PageEditorEventListener {
    constructor(baseEventSystem) {
        this.subscribe = baseEventSystem.subscribe
    }

    // Listen to widget events with version filtering
    onWidgetChanged(callback, versionFilter = null) {
        return this.subscribe(PAGE_EDITOR_EVENTS.WIDGET_CHANGED, (payload) => {
            if (versionFilter && payload.versionId !== versionFilter) {
                return // Skip events from different versions
            }
            callback(payload)
        })
    }

    onWidgetSaved(callback, versionFilter = null) {
        return this.subscribe(PAGE_EDITOR_EVENTS.WIDGET_SAVED, (payload) => {
            if (versionFilter && payload.versionId !== versionFilter) {
                return
            }
            callback(payload)
        })
    }

    onWidgetAdded(callback, versionFilter = null) {
        return this.subscribe(PAGE_EDITOR_EVENTS.WIDGET_ADDED, (payload) => {
            if (versionFilter && payload.versionId !== versionFilter) {
                return
            }
            callback(payload)
        })
    }

    onWidgetRemoved(callback, versionFilter = null) {
        return this.subscribe(PAGE_EDITOR_EVENTS.WIDGET_REMOVED, (payload) => {
            if (versionFilter && payload.versionId !== versionFilter) {
                return
            }
            callback(payload)
        })
    }

    // Layout events
    onLayoutChanged(callback) {
        return this.subscribe(PAGE_EDITOR_EVENTS.LAYOUT_CHANGED, callback)
    }

    onLayoutRendered(callback) {
        return this.subscribe(PAGE_EDITOR_EVENTS.LAYOUT_RENDERED, callback)
    }

    onSlotUpdated(callback, slotFilter = null) {
        return this.subscribe(PAGE_EDITOR_EVENTS.SLOT_UPDATED, (payload) => {
            if (slotFilter && payload.slotName !== slotFilter) {
                return
            }
            callback(payload)
        })
    }

    // Version events
    onVersionCreated(callback) {
        return this.subscribe(PAGE_EDITOR_EVENTS.VERSION_CREATED, callback)
    }

    onVersionSwitched(callback) {
        return this.subscribe(PAGE_EDITOR_EVENTS.VERSION_SWITCHED, callback)
    }

    onVersionPublished(callback) {
        return this.subscribe(PAGE_EDITOR_EVENTS.VERSION_PUBLISHED, callback)
    }

    // Page events
    onPageSaved(callback) {
        return this.subscribe(PAGE_EDITOR_EVENTS.PAGE_SAVED, callback)
    }

    onPagePublished(callback) {
        return this.subscribe(PAGE_EDITOR_EVENTS.PAGE_PUBLISHED, callback)
    }

    // Editor events
    onEditorModeChanged(callback) {
        return this.subscribe(PAGE_EDITOR_EVENTS.EDITOR_MODE_CHANGED, callback)
    }

    onPreviewModeToggled(callback) {
        return this.subscribe(PAGE_EDITOR_EVENTS.PREVIEW_MODE_TOGGLED, callback)
    }
}

/**
 * Create PageEditor event system from base event system
 * @param {Object} baseEventSystem - Base widget event system
 * @returns {Object} PageEditor event system
 */
export const createPageEditorEventSystem = (baseEventSystem) => {
    const emitter = new PageEditorEventEmitter(baseEventSystem)
    const listener = new PageEditorEventListener(baseEventSystem)

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
        emitWidgetValidated: emitter.emitWidgetValidated.bind(emitter),
        emitWidgetError: emitter.emitWidgetError.bind(emitter),
        emitLayoutChanged: emitter.emitLayoutChanged.bind(emitter),
        emitLayoutRendered: emitter.emitLayoutRendered.bind(emitter),
        emitSlotUpdated: emitter.emitSlotUpdated.bind(emitter),
        emitVersionCreated: emitter.emitVersionCreated.bind(emitter),
        emitVersionSwitched: emitter.emitVersionSwitched.bind(emitter),
        emitVersionPublished: emitter.emitVersionPublished.bind(emitter),
        emitVersionUnpublished: emitter.emitVersionUnpublished.bind(emitter),
        emitPageSaved: emitter.emitPageSaved.bind(emitter),
        emitPagePublished: emitter.emitPagePublished.bind(emitter),
        emitPageScheduled: emitter.emitPageScheduled.bind(emitter),
        emitEditorModeChanged: emitter.emitEditorModeChanged.bind(emitter),
        emitPreviewModeToggled: emitter.emitPreviewModeToggled.bind(emitter),

        // Listener methods
        onWidgetChanged: listener.onWidgetChanged.bind(listener),
        onWidgetSaved: listener.onWidgetSaved.bind(listener),
        onWidgetAdded: listener.onWidgetAdded.bind(listener),
        onWidgetRemoved: listener.onWidgetRemoved.bind(listener),
        onLayoutChanged: listener.onLayoutChanged.bind(listener),
        onLayoutRendered: listener.onLayoutRendered.bind(listener),
        onSlotUpdated: listener.onSlotUpdated.bind(listener),
        onVersionCreated: listener.onVersionCreated.bind(listener),
        onVersionSwitched: listener.onVersionSwitched.bind(listener),
        onVersionPublished: listener.onVersionPublished.bind(listener),
        onPageSaved: listener.onPageSaved.bind(listener),
        onPagePublished: listener.onPagePublished.bind(listener),
        onEditorModeChanged: listener.onEditorModeChanged.bind(listener),
        onPreviewModeToggled: listener.onPreviewModeToggled.bind(listener)
    }
}
