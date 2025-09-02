/**
 * Context Factory Utilities
 * 
 * Utilities for creating and managing widget contexts,
 * detecting context from props, and handling context transitions.
 */

import { PageWidgetContext } from '../contexts/PageWidgetContext'
import { ObjectWidgetContext } from '../contexts/ObjectWidgetContext'
import { SUPPORTED_CONTEXTS } from '../index'

/**
 * Create a widget context based on type and options
 * 
 * @param {string} type - Context type ('page' | 'object')
 * @param {Object} options - Context configuration options
 * @returns {IWidgetContext} Context instance
 */
export function createWidgetContext(type, options = {}) {
    switch (type) {
        case SUPPORTED_CONTEXTS.PAGE:
            return new PageWidgetContext(options)
        case SUPPORTED_CONTEXTS.OBJECT:
            return new ObjectWidgetContext(options)
        default:
            throw new Error(`Unknown context type: ${type}`)
    }
}

/**
 * Detect context type from component props
 * 
 * @param {Object} props - Component props
 * @returns {string} Detected context type
 */
export function detectContextFromProps(props) {
    // Check for explicit context
    if (props.context && SUPPORTED_CONTEXTS[props.context.toUpperCase()]) {
        return props.context
    }

    // Check for object-specific props
    if (props.objectType || props.objectInstance || props.objectWidgets) {
        return SUPPORTED_CONTEXTS.OBJECT
    }

    // Check for page-specific props
    if (props.layoutJson || props.pageVersionData || props.webpageData) {
        return SUPPORTED_CONTEXTS.PAGE
    }

    // Check for mode indicator
    if (props.mode === 'object') {
        return SUPPORTED_CONTEXTS.OBJECT
    }
    if (props.mode === 'page') {
        return SUPPORTED_CONTEXTS.PAGE
    }

    // Default to page context
    return SUPPORTED_CONTEXTS.PAGE
}

/**
 * Create a context factory with default configuration
 * 
 * @param {Object} defaultConfig - Default configuration for all contexts
 * @returns {Function} Context factory function
 */
export function createContextFactory(defaultConfig = {}) {
    return function contextFactory(type, options = {}) {
        const mergedOptions = {
            ...defaultConfig,
            ...options
        }
        return createWidgetContext(type, mergedOptions)
    }
}

/**
 * Validate context transition
 * 
 * Checks if transitioning from one context to another is valid
 * and provides migration guidance.
 * 
 * @param {string} fromContext - Source context type
 * @param {string} toContext - Target context type
 * @param {Object} data - Data being transitioned
 * @returns {Object} Validation result with migration info
 */
export function validateContextTransition(fromContext, toContext, data = {}) {
    const result = {
        valid: false,
        canAutoMigrate: false,
        warnings: [],
        errors: [],
        migrationSteps: []
    }

    // Same context - no transition needed
    if (fromContext === toContext) {
        result.valid = true
        result.canAutoMigrate = true
        return result
    }

    // Validate context types
    if (!SUPPORTED_CONTEXTS[fromContext?.toUpperCase()]) {
        result.errors.push(`Invalid source context: ${fromContext}`)
    }
    if (!SUPPORTED_CONTEXTS[toContext?.toUpperCase()]) {
        result.errors.push(`Invalid target context: ${toContext}`)
    }

    if (result.errors.length > 0) {
        return result
    }

    // Page to Object transition
    if (fromContext === SUPPORTED_CONTEXTS.PAGE && toContext === SUPPORTED_CONTEXTS.OBJECT) {
        result.warnings.push('Transitioning from page to object context will lose inheritance capabilities')
        result.warnings.push('Template-based configurations will be converted to static configurations')
        result.migrationSteps.push('Convert inherited widgets to static widgets')
        result.migrationSteps.push('Map page slots to object widget controls')
        result.migrationSteps.push('Validate widget types against object type constraints')
        result.canAutoMigrate = false // Requires manual mapping
    }

    // Object to Page transition
    if (fromContext === SUPPORTED_CONTEXTS.OBJECT && toContext === SUPPORTED_CONTEXTS.PAGE) {
        result.warnings.push('Transitioning from object to page context will lose widget control associations')
        result.warnings.push('Strict type constraints will be relaxed')
        result.migrationSteps.push('Map object widget controls to page slot configurations')
        result.migrationSteps.push('Convert static widgets to support inheritance')
        result.migrationSteps.push('Update widget configurations for page context')
        result.canAutoMigrate = true // Can be automated
    }

    result.valid = true
    return result
}

/**
 * Extract context-specific data from props
 * 
 * @param {Object} props - Component props
 * @param {string} contextType - Target context type
 * @returns {Object} Context-specific data
 */
export function extractContextData(props, contextType) {
    const data = {}

    if (contextType === SUPPORTED_CONTEXTS.PAGE) {
        data.layoutJson = props.layoutJson
        data.pageVersionData = props.pageVersionData
        data.webpageData = props.webpageData
        data.onUpdate = props.onUpdate
    }

    if (contextType === SUPPORTED_CONTEXTS.OBJECT) {
        data.objectType = props.objectType
        data.objectInstance = props.objectInstance
        data.objectWidgets = props.objectWidgets
        data.onWidgetChange = props.onWidgetChange
    }

    // Common data
    data.editable = props.editable
    data.onError = props.onError
    data.renderingMode = props.renderingMode

    return data
}

/**
 * Merge context configurations
 * 
 * @param {Object} baseConfig - Base configuration
 * @param {Object} overrideConfig - Configuration overrides
 * @returns {Object} Merged configuration
 */
export function mergeContextConfig(baseConfig, overrideConfig) {
    return {
        ...baseConfig,
        ...overrideConfig,
        // Special handling for nested objects
        ...(baseConfig.slotConfiguration && overrideConfig.slotConfiguration ? {
            slotConfiguration: {
                ...baseConfig.slotConfiguration,
                ...overrideConfig.slotConfiguration,
                slots: [
                    ...(baseConfig.slotConfiguration.slots || []),
                    ...(overrideConfig.slotConfiguration.slots || [])
                ]
            }
        } : {})
    }
}

/**
 * Context validation utilities
 */
export const ContextValidation = {
    /**
     * Validate page context data
     */
    validatePageContext: (data) => {
        const errors = []

        if (!data.layoutJson) {
            errors.push('Page context requires layoutJson')
        }

        if (!data.webpageData && !data.pageVersionData) {
            errors.push('Page context requires either webpageData or pageVersionData')
        }

        return {
            valid: errors.length === 0,
            errors
        }
    },

    /**
     * Validate object context data
     */
    validateObjectContext: (data) => {
        const errors = []

        if (!data.objectType) {
            errors.push('Object context requires objectType')
        }

        if (data.objectType && !data.objectType.slotConfiguration) {
            errors.push('Object type must have slotConfiguration')
        }

        return {
            valid: errors.length === 0,
            errors
        }
    },

    /**
     * Validate context data for any type
     */
    validateContext: (contextType, data) => {
        switch (contextType) {
            case SUPPORTED_CONTEXTS.PAGE:
                return ContextValidation.validatePageContext(data)
            case SUPPORTED_CONTEXTS.OBJECT:
                return ContextValidation.validateObjectContext(data)
            default:
                return {
                    valid: false,
                    errors: [`Unknown context type: ${contextType}`]
                }
        }
    }
}

/**
 * Context comparison utilities
 */
export const ContextComparison = {
    /**
     * Compare two contexts for differences
     */
    compareContexts: (context1, context2) => {
        return {
            typeChanged: context1.type !== context2.type,
            dataChanged: JSON.stringify(context1.getMetadata()) !== JSON.stringify(context2.getMetadata()),
            slotsChanged: context1.getSlots().length !== context2.getSlots().length,
            widgetsChanged: context1.getSlots().some(slot => {
                const slot2 = context2.getSlots().find(s => s.id === slot.id)
                return !slot2 || slot.getWidgets().length !== slot2.getWidgets().length
            })
        }
    },

    /**
     * Check if contexts are equivalent
     */
    areContextsEquivalent: (context1, context2) => {
        const comparison = ContextComparison.compareContexts(context1, context2)
        return !comparison.typeChanged && !comparison.dataChanged &&
            !comparison.slotsChanged && !comparison.widgetsChanged
    }
}

export default {
    createWidgetContext,
    detectContextFromProps,
    createContextFactory,
    validateContextTransition,
    extractContextData,
    mergeContextConfig,
    ContextValidation,
    ContextComparison
}
