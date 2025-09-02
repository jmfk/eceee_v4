/**
 * Widget System Abstraction Layer - Core Interfaces
 * 
 * Defines the core interfaces that allow widgets to work seamlessly
 * in both page and object contexts without requiring knowledge of
 * which editor they're in.
 */

/**
 * Widget Context Interface - Core abstraction for widget environments
 * 
 * This interface defines the contract that all widget contexts must implement,
 * allowing widgets to work identically regardless of whether they're in a
 * page or object editing context.
 */
export class IWidgetContext {
    /**
     * Get the context type
     * @returns {string} Context type ('page' | 'object')
     */
    get type() {
        throw new Error('type getter must be implemented by subclass')
    }

    /**
     * Get all available slots in this context
     * @returns {ISlot[]} Array of slot instances
     */
    getSlots() {
        throw new Error('getSlots must be implemented by subclass')
    }

    /**
     * Get widgets in a specific slot
     * @param {string} slotId - Slot identifier
     * @returns {Widget[]} Array of widget instances
     */
    getWidgets(slotId) {
        throw new Error('getWidgets must be implemented by subclass')
    }

    /**
     * Add a widget to a slot
     * @param {string} slotId - Slot identifier
     * @param {Widget} widget - Widget to add
     * @returns {Promise<OperationResult>} Operation result
     */
    addWidget(slotId, widget) {
        throw new Error('addWidget must be implemented by subclass')
    }

    /**
     * Remove a widget from its slot
     * @param {string} widgetId - Widget identifier
     * @returns {Promise<OperationResult>} Operation result
     */
    removeWidget(widgetId) {
        throw new Error('removeWidget must be implemented by subclass')
    }

    /**
     * Update a widget's configuration
     * @param {string} widgetId - Widget identifier
     * @param {Object} config - New configuration
     * @returns {Promise<OperationResult>} Operation result
     */
    updateWidget(widgetId, config) {
        throw new Error('updateWidget must be implemented by subclass')
    }

    /**
     * Validate a widget against context rules
     * @param {Widget} widget - Widget to validate
     * @returns {ValidationResult} Validation result
     */
    validateWidget(widget) {
        throw new Error('validateWidget must be implemented by subclass')
    }

    /**
     * Check if a widget type can be added to a slot
     * @param {string} slotId - Slot identifier
     * @param {string} widgetType - Widget type to check
     * @returns {boolean} Whether widget can be added
     */
    canAddWidget(slotId, widgetType) {
        throw new Error('canAddWidget must be implemented by subclass')
    }

    /**
     * Get available widget types for a slot
     * @param {string} slotId - Slot identifier
     * @returns {WidgetType[]} Available widget types
     */
    getAvailableWidgetTypes(slotId) {
        throw new Error('getAvailableWidgetTypes must be implemented by subclass')
    }

    /**
     * Save changes to the underlying data store
     * @returns {Promise<SaveResult>} Save result
     */
    save() {
        throw new Error('save must be implemented by subclass')
    }
}

/**
 * Slot Interface - Unified slot representation
 * 
 * Represents a slot that can contain widgets, regardless of whether
 * it comes from a page layout template or object type configuration.
 */
export class ISlot {
    /**
     * Slot identifier
     * @returns {string} Unique slot ID
     */
    get id() {
        throw new Error('id getter must be implemented by subclass')
    }

    /**
     * Human-readable slot label
     * @returns {string} Slot display name
     */
    get label() {
        throw new Error('label getter must be implemented by subclass')
    }

    /**
     * Widget types this slot accepts
     * @returns {string[]|null} Accepted widget types, null = accepts all
     */
    get accepts() {
        throw new Error('accepts getter must be implemented by subclass')
    }

    /**
     * Maximum number of widgets allowed in this slot
     * @returns {number|null} Max widgets, null = unlimited
     */
    get maxWidgets() {
        throw new Error('maxWidgets getter must be implemented by subclass')
    }

    /**
     * Minimum number of widgets required in this slot
     * @returns {number} Minimum widgets (default: 0)
     */
    get minWidgets() {
        return 0
    }

    /**
     * Whether this slot is required (must have at least minWidgets)
     * @returns {boolean} Whether slot is required
     */
    get required() {
        return this.minWidgets > 0
    }

    /**
     * Get widgets currently in this slot
     * @returns {Widget[]} Array of widgets
     */
    getWidgets() {
        throw new Error('getWidgets must be implemented by subclass')
    }

    /**
     * Check if a widget type is allowed in this slot
     * @param {string} widgetType - Widget type to check
     * @returns {boolean} Whether widget type is allowed
     */
    allowsWidgetType(widgetType) {
        if (!this.accepts) return true
        return this.accepts.includes(widgetType)
    }

    /**
     * Check if slot has space for more widgets
     * @returns {boolean} Whether slot can accept more widgets
     */
    hasSpace() {
        if (!this.maxWidgets) return true
        return this.getWidgets().length < this.maxWidgets
    }

    /**
     * Validate slot contents
     * @returns {ValidationResult} Validation result
     */
    validate() {
        const widgets = this.getWidgets()
        const errors = []
        const warnings = []

        // Check minimum widgets
        if (widgets.length < this.minWidgets) {
            errors.push(`Slot requires at least ${this.minWidgets} widget(s), has ${widgets.length}`)
        }

        // Check maximum widgets
        if (this.maxWidgets && widgets.length > this.maxWidgets) {
            errors.push(`Slot allows maximum ${this.maxWidgets} widget(s), has ${widgets.length}`)
        }

        // Check widget type restrictions
        widgets.forEach(widget => {
            if (!this.allowsWidgetType(widget.type)) {
                errors.push(`Widget type '${widget.type}' not allowed in this slot`)
            }
        })

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            slotId: this.id
        }
    }
}

/**
 * Widget Host Interface - Rendering strategy abstraction
 * 
 * Defines how widgets are rendered in different contexts.
 */
export class IWidgetHost {
    /**
     * Render a widget in this context
     * @param {Widget} widget - Widget to render
     * @param {ISlot} slot - Slot containing the widget
     * @param {Object} options - Rendering options
     * @returns {React.Element} Rendered widget
     */
    renderWidget(widget, slot, options = {}) {
        throw new Error('renderWidget must be implemented by subclass')
    }

    /**
     * Render a slot container
     * @param {ISlot} slot - Slot to render
     * @param {Object} options - Rendering options
     * @returns {React.Element} Rendered slot
     */
    renderSlot(slot, options = {}) {
        throw new Error('renderSlot must be implemented by subclass')
    }

    /**
     * Get rendering mode for this host
     * @returns {string} Rendering mode ('edit' | 'preview' | 'live')
     */
    getRenderingMode() {
        throw new Error('getRenderingMode must be implemented by subclass')
    }
}

/**
 * Configuration Manager Interface - Handle configuration differences
 * 
 * Manages widget configuration across different contexts, handling
 * schema differences and providing validation.
 */
export class IConfigurationManager {
    /**
     * Validate widget configuration for context
     * @param {Object} config - Configuration to validate
     * @param {Widget} widget - Widget being configured
     * @param {ISlot} slot - Slot context
     * @returns {ValidationResult} Validation result
     */
    validateConfiguration(config, widget, slot) {
        throw new Error('validateConfiguration must be implemented by subclass')
    }

    /**
     * Transform configuration between contexts
     * @param {Object} config - Source configuration
     * @param {string} fromContext - Source context
     * @param {string} toContext - Target context
     * @returns {Object} Transformed configuration
     */
    transformConfiguration(config, fromContext, toContext) {
        throw new Error('transformConfiguration must be implemented by subclass')
    }

    /**
     * Get configuration schema for widget in context
     * @param {string} widgetType - Widget type
     * @param {string} context - Context type
     * @returns {Object} Configuration schema
     */
    getConfigurationSchema(widgetType, context) {
        throw new Error('getConfigurationSchema must be implemented by subclass')
    }
}

/**
 * Data Flow Manager Interface - Handle data storage and flow
 * 
 * Manages how widget data is stored, retrieved, and synchronized
 * across different contexts.
 */
export class IDataFlowManager {
    /**
     * Store widget data
     * @param {Widget} widget - Widget to store
     * @returns {Promise<StoreResult>} Storage result
     */
    storeWidget(widget) {
        throw new Error('storeWidget must be implemented by subclass')
    }

    /**
     * Retrieve widget data
     * @param {string} widgetId - Widget identifier
     * @returns {Promise<Widget>} Widget data
     */
    retrieveWidget(widgetId) {
        throw new Error('retrieveWidget must be implemented by subclass')
    }

    /**
     * Synchronize widget changes
     * @param {Widget[]} widgets - Widgets to synchronize
     * @returns {Promise<SyncResult>} Synchronization result
     */
    syncWidgets(widgets) {
        throw new Error('syncWidgets must be implemented by subclass')
    }

    /**
     * Handle data inheritance (pages) or restrictions (objects)
     * @param {Widget} widget - Widget to process
     * @param {Object} context - Context information
     * @returns {Widget} Processed widget
     */
    processWidgetData(widget, context) {
        throw new Error('processWidgetData must be implemented by subclass')
    }
}

/**
 * API Client Interface - Unified API abstraction
 * 
 * Provides a unified interface for API operations regardless
 * of whether working with pages or objects.
 */
export class IApiClient {
    /**
     * Save widget changes to server
     * @param {Object} data - Data to save
     * @returns {Promise<ApiResult>} API response
     */
    saveWidgets(data) {
        throw new Error('saveWidgets must be implemented by subclass')
    }

    /**
     * Load widget data from server
     * @param {string} entityId - Entity identifier (page or object)
     * @returns {Promise<ApiResult>} API response
     */
    loadWidgets(entityId) {
        throw new Error('loadWidgets must be implemented by subclass')
    }

    /**
     * Validate widgets on server
     * @param {Widget[]} widgets - Widgets to validate
     * @returns {Promise<ValidationResult>} Validation result
     */
    validateWidgets(widgets) {
        throw new Error('validateWidgets must be implemented by subclass')
    }

    /**
     * Transform API response for context
     * @param {Object} response - Raw API response
     * @returns {Object} Transformed response
     */
    transformResponse(response) {
        throw new Error('transformResponse must be implemented by subclass')
    }

    /**
     * Transform request data for API
     * @param {Object} data - Data to transform
     * @returns {Object} Transformed request data
     */
    transformRequest(data) {
        throw new Error('transformRequest must be implemented by subclass')
    }
}

/**
 * Type definitions for better IDE support and documentation
 */

/**
 * @typedef {Object} Widget
 * @property {string} id - Unique widget identifier
 * @property {string} type - Widget type
 * @property {string} slug - Widget type slug
 * @property {Object} config - Widget configuration
 * @property {string} context - Widget context ('page' | 'object')
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} WidgetType
 * @property {string} slug - Widget type slug
 * @property {string} name - Human-readable name
 * @property {string} description - Widget description
 * @property {Object} defaultConfig - Default configuration
 * @property {string[]} categories - Widget categories
 */

/**
 * @typedef {Object} OperationResult
 * @property {boolean} success - Whether operation succeeded
 * @property {string} [error] - Error message if failed
 * @property {Object} [data] - Result data if succeeded
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {string[]} errors - Validation errors
 * @property {string[]} warnings - Validation warnings
 * @property {Object} [metadata] - Additional validation metadata
 */

/**
 * @typedef {Object} SaveResult
 * @property {boolean} success - Whether save succeeded
 * @property {string} [error] - Error message if failed
 * @property {Object} [data] - Saved data
 */

/**
 * @typedef {Object} StoreResult
 * @property {boolean} success - Whether storage succeeded
 * @property {string} [error] - Error message if failed
 * @property {string} [id] - Stored item ID
 */

/**
 * @typedef {Object} SyncResult
 * @property {boolean} success - Whether sync succeeded
 * @property {string} [error] - Error message if failed
 * @property {Object[]} [conflicts] - Sync conflicts if any
 */

/**
 * @typedef {Object} ApiResult
 * @property {boolean} success - Whether API call succeeded
 * @property {Object} [data] - Response data
 * @property {string} [error] - Error message if failed
 * @property {number} [status] - HTTP status code
 */

export {
    // Re-export for convenience
    IWidgetContext,
    ISlot,
    IWidgetHost,
    IConfigurationManager,
    IDataFlowManager,
    IApiClient
}
