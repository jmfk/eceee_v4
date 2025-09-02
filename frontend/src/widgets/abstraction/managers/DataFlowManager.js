/**
 * Data Flow Manager - Data Storage and Flow Abstraction
 * 
 * Manages how widget data is stored, retrieved, and synchronized
 * across different contexts, handling inheritance vs restrictions.
 */

import { IDataFlowManager } from '../interfaces'
import { SUPPORTED_CONTEXTS } from '../index'

/**
 * Base Data Flow Manager Implementation
 */
export class DataFlowManager extends IDataFlowManager {
    constructor(options = {}) {
        super()
        this._contextType = options.contextType
        this._storage = options.storage || new Map()
        this._syncQueue = []
        this._syncInProgress = false
        this._changeListeners = new Set()
        this._inheritanceCache = new Map()
    }

    /**
     * Store widget data
     */
    async storeWidget(widget) {
        try {
            // Process widget data based on context
            const processedWidget = this.processWidgetData(widget, {
                contextType: this._contextType,
                operation: 'store'
            })

            // Generate storage key
            const storageKey = this._generateStorageKey(processedWidget)

            // Store in local storage
            this._storage.set(storageKey, {
                ...processedWidget,
                storedAt: new Date().toISOString(),
                version: this._generateVersion()
            })

            // Add to sync queue
            this._addToSyncQueue({
                operation: 'store',
                widget: processedWidget,
                timestamp: Date.now()
            })

            // Notify change listeners
            this._notifyChangeListeners('store', processedWidget)

            return {
                success: true,
                id: processedWidget.id,
                storageKey,
                version: processedWidget.version
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * Retrieve widget data
     */
    async retrieveWidget(widgetId) {
        try {
            // Find widget in storage
            const storageKey = this._findStorageKey(widgetId)
            if (!storageKey) {
                throw new Error(`Widget ${widgetId} not found in storage`)
            }

            const storedData = this._storage.get(storageKey)

            // Process retrieved data for context
            const processedWidget = this.processWidgetData(storedData, {
                contextType: this._contextType,
                operation: 'retrieve'
            })

            return processedWidget
        } catch (error) {
            throw new Error(`Failed to retrieve widget: ${error.message}`)
        }
    }

    /**
     * Synchronize widget changes
     */
    async syncWidgets(widgets) {
        if (this._syncInProgress) {
            return {
                success: false,
                error: 'Sync already in progress'
            }
        }

        this._syncInProgress = true

        try {
            const results = []
            const conflicts = []

            for (const widget of widgets) {
                try {
                    // Check for conflicts
                    const conflict = await this._checkForConflicts(widget)
                    if (conflict) {
                        conflicts.push(conflict)
                        continue
                    }

                    // Store widget
                    const storeResult = await this.storeWidget(widget)
                    results.push(storeResult)

                    // Handle context-specific sync logic
                    if (this._contextType === SUPPORTED_CONTEXTS.PAGE) {
                        await this._syncPageInheritance(widget)
                    } else if (this._contextType === SUPPORTED_CONTEXTS.OBJECT) {
                        await this._syncObjectConstraints(widget)
                    }

                } catch (error) {
                    results.push({
                        success: false,
                        widgetId: widget.id,
                        error: error.message
                    })
                }
            }

            // Process sync queue
            await this._processSyncQueue()

            return {
                success: conflicts.length === 0,
                results,
                conflicts,
                syncedAt: new Date().toISOString()
            }
        } finally {
            this._syncInProgress = false
        }
    }

    /**
     * Handle data inheritance (pages) or restrictions (objects)
     */
    processWidgetData(widget, context) {
        const { contextType, operation = 'process' } = context

        let processedWidget = { ...widget }

        if (contextType === SUPPORTED_CONTEXTS.PAGE) {
            processedWidget = this._processPageWidget(processedWidget, operation)
        } else if (contextType === SUPPORTED_CONTEXTS.OBJECT) {
            processedWidget = this._processObjectWidget(processedWidget, operation)
        }

        return processedWidget
    }

    /**
     * Process widget for page context (handle inheritance)
     */
    _processPageWidget(widget, operation) {
        const processed = { ...widget }

        if (operation === 'store') {
            // Handle inheritance when storing
            if (processed.inherited) {
                // Store inheritance metadata
                processed.inheritanceInfo = {
                    templateId: processed.templateId,
                    inheritanceLevel: processed.inheritanceLevel || 0,
                    canOverride: processed.canOverride !== false,
                    originalConfig: processed.originalConfig || processed.config
                }

                // Cache inheritance chain
                this._cacheInheritanceChain(processed)
            }

            // Add page-specific metadata
            processed.pageMetadata = {
                pageId: processed.pageId,
                versionId: processed.versionId,
                layoutId: processed.layoutId,
                slotName: processed.slotName
            }
        }

        if (operation === 'retrieve') {
            // Handle inheritance when retrieving
            if (processed.inherited && processed.inheritanceInfo) {
                // Resolve inheritance chain
                processed = this._resolveInheritanceChain(processed)
            }
        }

        return processed
    }

    /**
     * Process widget for object context (apply restrictions)
     */
    _processObjectWidget(widget, operation) {
        const processed = { ...widget }

        if (operation === 'store') {
            // Apply object restrictions
            processed.objectMetadata = {
                objectTypeId: processed.objectTypeId,
                objectInstanceId: processed.objectInstanceId,
                controlId: processed.controlId,
                restrictionLevel: processed.restrictionLevel || 'strict'
            }

            // Validate against object type constraints
            processed = this._applyObjectConstraints(processed)
        }

        if (operation === 'retrieve') {
            // Apply current restrictions
            if (processed.objectMetadata) {
                processed = this._applyObjectConstraints(processed)
            }
        }

        return processed
    }

    /**
     * Cache inheritance chain for performance
     */
    _cacheInheritanceChain(widget) {
        if (!widget.inheritanceInfo) return

        const cacheKey = `${widget.templateId}_${widget.inheritanceLevel}`
        this._inheritanceCache.set(cacheKey, {
            widgetId: widget.id,
            config: widget.config,
            metadata: widget.inheritanceInfo,
            cachedAt: Date.now()
        })
    }

    /**
     * Resolve inheritance chain
     */
    _resolveInheritanceChain(widget) {
        if (!widget.inheritanceInfo) return widget

        const resolved = { ...widget }
        const { templateId, inheritanceLevel, originalConfig } = widget.inheritanceInfo

        // Start with original template configuration
        let resolvedConfig = { ...originalConfig }

        // Apply inheritance chain
        for (let level = 0; level <= inheritanceLevel; level++) {
            const cacheKey = `${templateId}_${level}`
            const cachedData = this._inheritanceCache.get(cacheKey)

            if (cachedData) {
                resolvedConfig = {
                    ...resolvedConfig,
                    ...cachedData.config
                }
            }
        }

        // Apply current widget overrides if allowed
        if (widget.inheritanceInfo.canOverride) {
            resolvedConfig = {
                ...resolvedConfig,
                ...widget.config
            }
        }

        resolved.config = resolvedConfig
        return resolved
    }

    /**
     * Apply object type constraints
     */
    _applyObjectConstraints(widget) {
        const constrained = { ...widget }

        if (!constrained.objectMetadata) return constrained

        const { restrictionLevel } = constrained.objectMetadata

        if (restrictionLevel === 'strict') {
            // Remove any properties not explicitly allowed
            constrained.config = this._filterAllowedProperties(constrained.config, constrained.type)
        }

        // Apply value constraints
        constrained.config = this._applyValueConstraints(constrained.config, constrained.type)

        return constrained
    }

    /**
     * Filter configuration properties based on widget type constraints
     */
    _filterAllowedProperties(config, widgetType) {
        // This would typically come from widget type definition
        const allowedProperties = this._getAllowedProperties(widgetType)

        if (!allowedProperties) return config

        const filtered = {}
        allowedProperties.forEach(prop => {
            if (config[prop] !== undefined) {
                filtered[prop] = config[prop]
            }
        })

        return filtered
    }

    /**
     * Apply value constraints to configuration
     */
    _applyValueConstraints(config, widgetType) {
        const constraints = this._getValueConstraints(widgetType)

        if (!constraints) return config

        const constrained = { ...config }

        Object.entries(constraints).forEach(([property, constraint]) => {
            if (constrained[property] !== undefined) {
                const value = constrained[property]

                if (constraint.min !== undefined) {
                    constrained[property] = Math.max(value, constraint.min)
                }
                if (constraint.max !== undefined) {
                    constrained[property] = Math.min(value, constraint.max)
                }
                if (constraint.enum && !constraint.enum.includes(value)) {
                    constrained[property] = constraint.enum[0] // Default to first allowed value
                }
            }
        })

        return constrained
    }

    /**
     * Check for synchronization conflicts
     */
    async _checkForConflicts(widget) {
        const stored = await this.retrieveWidget(widget.id).catch(() => null)

        if (!stored) return null

        // Check version conflict
        if (stored.version && widget.version && stored.version !== widget.version) {
            return {
                type: 'version',
                widgetId: widget.id,
                storedVersion: stored.version,
                incomingVersion: widget.version,
                message: 'Widget has been modified by another process'
            }
        }

        // Check timestamp conflict
        if (stored.updatedAt && widget.updatedAt) {
            const storedTime = new Date(stored.updatedAt).getTime()
            const incomingTime = new Date(widget.updatedAt).getTime()

            if (storedTime > incomingTime) {
                return {
                    type: 'timestamp',
                    widgetId: widget.id,
                    storedTime: stored.updatedAt,
                    incomingTime: widget.updatedAt,
                    message: 'Stored widget is newer than incoming widget'
                }
            }
        }

        return null
    }

    /**
     * Sync page inheritance relationships
     */
    async _syncPageInheritance(widget) {
        if (!widget.inherited) return

        // Update inheritance cache
        this._cacheInheritanceChain(widget)

        // Notify dependent widgets
        const dependents = this._findInheritanceDependents(widget)
        for (const dependent of dependents) {
            this._notifyChangeListeners('inheritance_update', dependent)
        }
    }

    /**
     * Sync object constraint compliance
     */
    async _syncObjectConstraints(widget) {
        // Validate constraint compliance
        const compliance = this._checkConstraintCompliance(widget)

        if (!compliance.compliant) {
            // Log compliance issues
            console.warn('Widget constraint compliance issues:', compliance.issues)
        }

        return compliance
    }

    /**
     * Process synchronization queue
     */
    async _processSyncQueue() {
        if (this._syncQueue.length === 0) return

        const batch = [...this._syncQueue]
        this._syncQueue = []

        // Group operations by type
        const operations = {
            store: [],
            update: [],
            delete: []
        }

        batch.forEach(item => {
            operations[item.operation].push(item)
        })

        // Process each operation type
        for (const [operation, items] of Object.entries(operations)) {
            if (items.length > 0) {
                await this._processBatchOperation(operation, items)
            }
        }
    }

    /**
     * Add item to sync queue
     */
    _addToSyncQueue(item) {
        this._syncQueue.push(item)

        // Auto-process if queue gets too large
        if (this._syncQueue.length > 50) {
            this._processSyncQueue()
        }
    }

    /**
     * Generate storage key for widget
     */
    _generateStorageKey(widget) {
        return `widget_${this._contextType}_${widget.id}`
    }

    /**
     * Find storage key for widget ID
     */
    _findStorageKey(widgetId) {
        const expectedKey = `widget_${this._contextType}_${widgetId}`
        return this._storage.has(expectedKey) ? expectedKey : null
    }

    /**
     * Generate version identifier
     */
    _generateVersion() {
        return `v${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * Add change listener
     */
    addChangeListener(listener) {
        this._changeListeners.add(listener)
    }

    /**
     * Remove change listener
     */
    removeChangeListener(listener) {
        this._changeListeners.delete(listener)
    }

    /**
     * Notify change listeners
     */
    _notifyChangeListeners(eventType, data) {
        this._changeListeners.forEach(listener => {
            try {
                listener(eventType, data)
            } catch (error) {
                console.error('Change listener error:', error)
            }
        })
    }

    /**
     * Get allowed properties for widget type (placeholder)
     */
    _getAllowedProperties(widgetType) {
        // This would typically come from widget type registry
        const defaults = {
            'text-block': ['content', 'fontSize', 'color', 'fontFamily'],
            'image': ['src', 'alt', 'width', 'height'],
            'button': ['text', 'action', 'style', 'disabled']
        }
        return defaults[widgetType] || null
    }

    /**
     * Get value constraints for widget type (placeholder)
     */
    _getValueConstraints(widgetType) {
        // This would typically come from widget type registry
        const defaults = {
            'text-block': {
                fontSize: { min: 8, max: 72 }
            },
            'image': {
                width: { min: 1, max: 2000 },
                height: { min: 1, max: 2000 }
            }
        }
        return defaults[widgetType] || null
    }

    /**
     * Find widgets that depend on inheritance from this widget
     */
    _findInheritanceDependents(widget) {
        const dependents = []

        this._storage.forEach(storedWidget => {
            if (storedWidget.inheritanceInfo?.templateId === widget.templateId &&
                storedWidget.inheritanceInfo?.inheritanceLevel > widget.inheritanceInfo?.inheritanceLevel) {
                dependents.push(storedWidget)
            }
        })

        return dependents
    }

    /**
     * Check constraint compliance for object widget
     */
    _checkConstraintCompliance(widget) {
        const issues = []

        // This would implement actual constraint checking
        // For now, return compliant
        return {
            compliant: true,
            issues
        }
    }

    /**
     * Process batch operation
     */
    async _processBatchOperation(operation, items) {
        // Placeholder for batch processing logic
        // Implementation would handle batch operations for performance
        return Promise.resolve()
    }

    /**
     * Get data flow statistics
     */
    getStats() {
        return {
            contextType: this._contextType,
            storedWidgets: this._storage.size,
            queuedOperations: this._syncQueue.length,
            changeListeners: this._changeListeners.size,
            cachedInheritance: this._inheritanceCache.size,
            syncInProgress: this._syncInProgress
        }
    }

    /**
     * Clear all data
     */
    clear() {
        this._storage.clear()
        this._syncQueue = []
        this._inheritanceCache.clear()
        this._changeListeners.clear()
    }
}

/**
 * Create data flow manager for specific context
 */
export function createDataFlowManager(contextType, options = {}) {
    return new DataFlowManager({
        contextType,
        ...options
    })
}

export default DataFlowManager
