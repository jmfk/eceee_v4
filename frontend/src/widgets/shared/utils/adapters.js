/**
 * Widget Adapters - Handle context-specific differences
 * 
 * Provides adapter patterns to handle differences between page and object
 * widget contexts while maintaining a unified interface.
 */

import { createWidget, getWidgetDisplayName } from './widgetFactory'

/**
 * Context types
 */
export const WIDGET_CONTEXTS = {
    PAGE: 'page',
    OBJECT: 'object'
}

/**
 * Base adapter interface
 */
export class BaseWidgetAdapter {
    constructor(context) {
        this.context = context
    }

    /**
     * Create a widget appropriate for this context
     * @param {string} widgetSlug - Widget type slug
     * @param {Object} options - Creation options
     * @returns {Object} Widget instance
     */
    createWidget(widgetSlug, options = {}) {
        return createWidget(widgetSlug, {
            ...options,
            context: this.context
        })
    }

    /**
     * Adapt widget data for this context
     * @param {Object} widget - Widget to adapt
     * @returns {Object} Adapted widget
     */
    adaptWidget(widget) {
        return {
            ...widget,
            context: this.context
        }
    }

    /**
     * Get slot configuration for this context
     * @param {Object} slotData - Raw slot data
     * @returns {Object} Adapted slot configuration
     */
    adaptSlotConfig(slotData) {
        return slotData
    }

    /**
     * Handle widget operations (add, edit, delete)
     * @param {string} operation - Operation type
     * @param {Object} params - Operation parameters
     * @returns {Object} Operation result
     */
    handleOperation(operation, params) {
        throw new Error('handleOperation must be implemented by subclass')
    }
}

/**
 * Page Widget Adapter - Handles page-specific widget logic
 */
export class PageWidgetAdapter extends BaseWidgetAdapter {
    constructor() {
        super(WIDGET_CONTEXTS.PAGE)
    }

    /**
     * Create a page widget with layout-specific properties
     * @param {string} widgetSlug - Widget type slug
     * @param {Object} options - Creation options
     * @returns {Object} Page widget instance
     */
    createWidget(widgetSlug, options = {}) {
        const widget = super.createWidget(widgetSlug, options)

        // Add page-specific properties
        return {
            ...widget,
            // Page widgets can inherit from layout templates
            canInherit: true,
            // Page widgets support template-based configurations
            templateBased: true,
            // Page widgets can be overridden by child pages
            allowOverride: true
        }
    }

    /**
     * Adapt slot configuration for page context
     * @param {Object} slotData - Layout slot data
     * @returns {Object} Page slot configuration
     */
    adaptSlotConfig(slotData) {
        return {
            ...slotData,
            // Page slots support inheritance
            supportsInheritance: true,
            // Page slots can have template widgets
            hasTemplateWidgets: slotData.templateWidgets?.length > 0,
            // Page slots support all widget types by default
            allowedTypes: slotData.allowedTypes || null,
            // Page slots can be unlimited unless specified
            maxWidgets: slotData.maxWidgets || null
        }
    }

    /**
     * Handle page widget operations
     * @param {string} operation - Operation type ('add', 'edit', 'delete', 'clear')
     * @param {Object} params - Operation parameters
     * @returns {Object} Operation result
     */
    handleOperation(operation, params) {
        const { slotName, widgetData, widgets = {}, onUpdate } = params

        let updatedWidgets = { ...widgets }

        switch (operation) {
            case 'add':
                if (!updatedWidgets[slotName]) {
                    updatedWidgets[slotName] = []
                }
                updatedWidgets[slotName] = [...updatedWidgets[slotName], widgetData]
                break

            case 'edit':
                if (updatedWidgets[slotName]) {
                    updatedWidgets[slotName] = updatedWidgets[slotName].map(
                        widget => widget.id === widgetData.id ? widgetData : widget
                    )
                }
                break

            case 'delete':
                if (updatedWidgets[slotName]) {
                    updatedWidgets[slotName] = updatedWidgets[slotName].filter(
                        widget => widget.id !== widgetData
                    )
                }
                break

            case 'clear':
                updatedWidgets[slotName] = []
                break

            case 'reorder':
                if (updatedWidgets[slotName] && params.fromIndex !== undefined && params.toIndex !== undefined) {
                    const widgets = [...updatedWidgets[slotName]]
                    const [movedWidget] = widgets.splice(params.fromIndex, 1)
                    widgets.splice(params.toIndex, 0, movedWidget)
                    updatedWidgets[slotName] = widgets
                }
                break

            default:
                throw new Error(`Unknown operation: ${operation}`)
        }

        return {
            success: true,
            widgets: updatedWidgets,
            operation,
            slotName,
            context: this.context
        }
    }

    /**
     * Get available widget types for page context
     * @param {Object} slotConfig - Slot configuration
     * @returns {Array} Available widget types
     */
    getAvailableWidgetTypes(slotConfig = {}) {
        // Page context supports all widget types unless restricted
        const allTypes = Object.keys(import('../utils/widgetFactory').WIDGET_TYPE_REGISTRY)
        return slotConfig.allowedTypes || allTypes
    }
}

/**
 * Object Widget Adapter - Handles object-specific widget logic
 */
export class ObjectWidgetAdapter extends BaseWidgetAdapter {
    constructor() {
        super(WIDGET_CONTEXTS.OBJECT)
    }

    /**
     * Create an object widget with object-specific properties
     * @param {string} widgetSlug - Widget type slug
     * @param {Object} options - Creation options
     * @returns {Object} Object widget instance
     */
    createWidget(widgetSlug, options = {}) {
        const widget = super.createWidget(widgetSlug, options)

        // Add object-specific properties
        return {
            ...widget,
            // Object widgets are tied to specific controls
            controlId: options.controlId || null,
            // Object widgets don't support inheritance
            canInherit: false,
            // Object widgets are not template-based
            templateBased: false,
            // Object widgets follow strict type definitions
            strictTypes: true
        }
    }

    /**
     * Adapt slot configuration for object context
     * @param {Object} slotData - Object type slot data
     * @returns {Object} Object slot configuration
     */
    adaptSlotConfig(slotData) {
        return {
            ...slotData,
            // Object slots don't support inheritance
            supportsInheritance: false,
            // Object slots are defined by widget controls
            widgetControls: slotData.widgetControls || [],
            // Object slots have strict type restrictions
            allowedTypes: this.getSlotAllowedTypes(slotData),
            // Object slots respect maxWidgets from slot definition
            maxWidgets: slotData.maxWidgets || 1
        }
    }

    /**
     * Handle object widget operations
     * @param {string} operation - Operation type
     * @param {Object} params - Operation parameters
     * @returns {Object} Operation result
     */
    handleOperation(operation, params) {
        const { slotName, widgetData, widgets = {}, onUpdate, slotConfig } = params

        let updatedWidgets = { ...widgets }

        switch (operation) {
            case 'add':
                // Validate against slot constraints
                const currentSlotWidgets = updatedWidgets[slotName] || []
                if (slotConfig?.maxWidgets && currentSlotWidgets.length >= slotConfig.maxWidgets) {
                    return {
                        success: false,
                        error: `Slot can only contain ${slotConfig.maxWidgets} widget(s)`,
                        context: this.context
                    }
                }

                if (!updatedWidgets[slotName]) {
                    updatedWidgets[slotName] = []
                }
                updatedWidgets[slotName] = [...updatedWidgets[slotName], widgetData]
                break

            case 'edit':
                if (updatedWidgets[slotName]) {
                    updatedWidgets[slotName] = updatedWidgets[slotName].map(
                        widget => widget.id === widgetData.id ? widgetData : widget
                    )
                }
                break

            case 'delete':
                if (updatedWidgets[slotName]) {
                    updatedWidgets[slotName] = updatedWidgets[slotName].filter(
                        widget => widget.id !== widgetData
                    )
                }
                break

            case 'clear':
                // Check if slot is required
                if (slotConfig?.required) {
                    return {
                        success: false,
                        error: 'Cannot clear required slot',
                        context: this.context
                    }
                }
                updatedWidgets[slotName] = []
                break

            default:
                throw new Error(`Unknown operation: ${operation}`)
        }

        return {
            success: true,
            widgets: updatedWidgets,
            operation,
            slotName,
            context: this.context
        }
    }

    /**
     * Get available widget types for object context
     * @param {Object} slotConfig - Slot configuration
     * @returns {Array} Available widget types
     */
    getAvailableWidgetTypes(slotConfig = {}) {
        // Object context is restricted by widget controls
        if (slotConfig.widgetControls && slotConfig.widgetControls.length > 0) {
            return slotConfig.widgetControls.map(control => ({
                slug: control.widgetType,
                name: control.label || getWidgetDisplayName(control.widgetType),
                controlId: control.id,
                defaultConfig: control.defaultConfig || {}
            }))
        }

        // Fallback to basic widget types if no controls defined
        return ['text-block', 'image', 'button', 'html-block', 'spacer']
    }

    /**
     * Get allowed widget types from slot widget controls
     * @param {Object} slotData - Slot configuration
     * @returns {Array} Array of allowed widget type slugs
     */
    getSlotAllowedTypes(slotData) {
        if (slotData.widgetControls && slotData.widgetControls.length > 0) {
            return slotData.widgetControls.map(control => control.widgetType)
        }
        return null // No restrictions if no controls defined
    }
}

/**
 * Adapter factory - Creates the appropriate adapter for a context
 * @param {string} context - Widget context ('page' or 'object')
 * @returns {BaseWidgetAdapter} Adapter instance
 */
export function createWidgetAdapter(context) {
    switch (context) {
        case WIDGET_CONTEXTS.PAGE:
            return new PageWidgetAdapter()
        case WIDGET_CONTEXTS.OBJECT:
            return new ObjectWidgetAdapter()
        default:
            throw new Error(`Unknown widget context: ${context}`)
    }
}

/**
 * Utility function to determine context from props/data
 * @param {Object} props - Component props
 * @returns {string} Detected context
 */
export function detectWidgetContext(props) {
    // Check for object-specific properties
    if (props.objectType || props.mode === 'object') {
        return WIDGET_CONTEXTS.OBJECT
    }

    // Check for page-specific properties
    if (props.layoutJson || props.pageVersionData || props.mode === 'page') {
        return WIDGET_CONTEXTS.PAGE
    }

    // Default to page context
    return WIDGET_CONTEXTS.PAGE
}

/**
 * Convert widget data between contexts
 * @param {Object} widget - Widget to convert
 * @param {string} fromContext - Source context
 * @param {string} toContext - Target context
 * @returns {Object} Converted widget
 */
export function convertWidgetContext(widget, fromContext, toContext) {
    if (fromContext === toContext) {
        return widget
    }

    const convertedWidget = { ...widget, context: toContext }

    // Remove context-specific properties
    if (fromContext === WIDGET_CONTEXTS.OBJECT && toContext === WIDGET_CONTEXTS.PAGE) {
        delete convertedWidget.controlId
        delete convertedWidget.strictTypes
        convertedWidget.canInherit = true
        convertedWidget.templateBased = true
    }

    if (fromContext === WIDGET_CONTEXTS.PAGE && toContext === WIDGET_CONTEXTS.OBJECT) {
        delete convertedWidget.canInherit
        delete convertedWidget.templateBased
        delete convertedWidget.allowOverride
        convertedWidget.strictTypes = true
    }

    return convertedWidget
}
