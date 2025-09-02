/**
 * Configuration Manager - Configuration Abstraction Layer
 * 
 * Manages widget configuration across different contexts, handling
 * schema differences, validation, and configuration transformations.
 */

import { IConfigurationManager } from '../interfaces'
import { validateWidgetConfig } from '../../shared/utils/validation'
import { WIDGET_TYPE_REGISTRY } from '../../shared/utils/widgetFactory'
import { SUPPORTED_CONTEXTS } from '../index'

/**
 * Base Configuration Manager Implementation
 */
export class ConfigurationManager extends IConfigurationManager {
    constructor(options = {}) {
        super()
        this._contextType = options.contextType
        this._validationRules = options.validationRules || {}
        this._transformationRules = options.transformationRules || {}
        this._schemaCache = new Map()
    }

    /**
     * Validate widget configuration for context
     */
    validateConfiguration(config, widget, slot) {
        try {
            // Get base validation from shared utilities
            const baseValidation = validateWidgetConfig(widget, {
                context: this._contextType,
                slotConfig: slot
            })

            const errors = [...baseValidation.errors]
            const warnings = [...baseValidation.warnings]

            // Apply context-specific validation rules
            const contextRules = this._validationRules[this._contextType] || {}
            const widgetRules = contextRules[widget.type] || {}

            // Validate required fields
            if (widgetRules.required) {
                widgetRules.required.forEach(field => {
                    if (config[field] === undefined || config[field] === null) {
                        errors.push(`Required field '${field}' is missing`)
                    }
                })
            }

            // Validate field types
            if (widgetRules.types) {
                Object.entries(widgetRules.types).forEach(([field, expectedType]) => {
                    if (config[field] !== undefined) {
                        const actualType = typeof config[field]
                        if (actualType !== expectedType) {
                            errors.push(`Field '${field}' should be ${expectedType}, got ${actualType}`)
                        }
                    }
                })
            }

            // Validate field constraints
            if (widgetRules.constraints) {
                Object.entries(widgetRules.constraints).forEach(([field, constraint]) => {
                    if (config[field] !== undefined) {
                        const value = config[field]

                        if (constraint.min !== undefined && value < constraint.min) {
                            errors.push(`Field '${field}' must be at least ${constraint.min}`)
                        }

                        if (constraint.max !== undefined && value > constraint.max) {
                            errors.push(`Field '${field}' must be at most ${constraint.max}`)
                        }

                        if (constraint.pattern && !constraint.pattern.test(value)) {
                            errors.push(`Field '${field}' does not match required pattern`)
                        }

                        if (constraint.enum && !constraint.enum.includes(value)) {
                            errors.push(`Field '${field}' must be one of: ${constraint.enum.join(', ')}`)
                        }
                    }
                })
            }

            // Context-specific validation
            if (this._contextType === SUPPORTED_CONTEXTS.OBJECT && slot) {
                // Object context: validate against widget controls
                const control = slot.getControlForWidgetType?.(widget.type)
                if (control && control.configSchema) {
                    const controlValidation = this._validateAgainstSchema(config, control.configSchema)
                    errors.push(...controlValidation.errors)
                    warnings.push(...controlValidation.warnings)
                }
            }

            if (this._contextType === SUPPORTED_CONTEXTS.PAGE) {
                // Page context: validate inheritance compatibility
                if (widget.inherited && config.overrideInheritance) {
                    warnings.push('Overriding inherited configuration may break template consistency')
                }
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                metadata: {
                    contextType: this._contextType,
                    widgetType: widget.type,
                    slotId: slot?.id
                }
            }
        } catch (error) {
            return {
                isValid: false,
                errors: [`Configuration validation error: ${error.message}`],
                warnings: []
            }
        }
    }

    /**
     * Transform configuration between contexts
     */
    transformConfiguration(config, fromContext, toContext) {
        if (fromContext === toContext) {
            return config
        }

        let transformedConfig = { ...config }

        // Apply transformation rules
        const transformKey = `${fromContext}_to_${toContext}`
        const transformRules = this._transformationRules[transformKey] || {}

        // Field mapping
        if (transformRules.fieldMappings) {
            Object.entries(transformRules.fieldMappings).forEach(([fromField, toField]) => {
                if (transformedConfig[fromField] !== undefined) {
                    transformedConfig[toField] = transformedConfig[fromField]
                    delete transformedConfig[fromField]
                }
            })
        }

        // Value transformations
        if (transformRules.valueTransforms) {
            Object.entries(transformRules.valueTransforms).forEach(([field, transformer]) => {
                if (transformedConfig[field] !== undefined) {
                    transformedConfig[field] = transformer(transformedConfig[field])
                }
            })
        }

        // Context-specific transformations
        if (fromContext === SUPPORTED_CONTEXTS.PAGE && toContext === SUPPORTED_CONTEXTS.OBJECT) {
            transformedConfig = this._transformPageToObject(transformedConfig)
        }

        if (fromContext === SUPPORTED_CONTEXTS.OBJECT && toContext === SUPPORTED_CONTEXTS.PAGE) {
            transformedConfig = this._transformObjectToPage(transformedConfig)
        }

        return transformedConfig
    }

    /**
     * Get configuration schema for widget in context
     */
    getConfigurationSchema(widgetType, context) {
        const cacheKey = `${widgetType}_${context}`

        if (this._schemaCache.has(cacheKey)) {
            return this._schemaCache.get(cacheKey)
        }

        const widgetTypeInfo = WIDGET_TYPE_REGISTRY[widgetType]
        if (!widgetTypeInfo) {
            throw new Error(`Unknown widget type: ${widgetType}`)
        }

        let schema = {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: true
        }

        // Base schema from widget type
        if (widgetTypeInfo.configSchema) {
            schema = {
                ...schema,
                ...widgetTypeInfo.configSchema
            }
        }

        // Context-specific schema modifications
        if (context === SUPPORTED_CONTEXTS.OBJECT) {
            // Object context: stricter validation, control-based constraints
            schema.additionalProperties = false

            // Add object-specific properties
            schema.properties.controlId = {
                type: 'string',
                description: 'Widget control identifier'
            }
        }

        if (context === SUPPORTED_CONTEXTS.PAGE) {
            // Page context: inheritance-aware properties
            schema.properties.inherited = {
                type: 'boolean',
                description: 'Whether this widget is inherited from template'
            }

            schema.properties.overrideInheritance = {
                type: 'boolean',
                description: 'Whether to override inherited configuration'
            }
        }

        this._schemaCache.set(cacheKey, schema)
        return schema
    }

    /**
     * Transform page configuration to object configuration
     */
    _transformPageToObject(config) {
        const transformed = { ...config }

        // Remove page-specific properties
        delete transformed.inherited
        delete transformed.overrideInheritance
        delete transformed.templateBased

        // Convert flexible configurations to strict ones
        if (transformed.styles && typeof transformed.styles === 'object') {
            // Flatten complex style objects for object context
            transformed.styles = this._flattenStyleObject(transformed.styles)
        }

        return transformed
    }

    /**
     * Transform object configuration to page configuration
     */
    _transformObjectToPage(config) {
        const transformed = { ...config }

        // Remove object-specific properties
        delete transformed.controlId
        delete transformed.strictTypes

        // Add page-specific defaults
        transformed.inherited = false
        transformed.overrideInheritance = false

        return transformed
    }

    /**
     * Validate configuration against JSON schema
     */
    _validateAgainstSchema(config, schema) {
        const errors = []
        const warnings = []

        try {
            // Basic type validation
            if (schema.type === 'object' && typeof config !== 'object') {
                errors.push('Configuration must be an object')
                return { errors, warnings }
            }

            // Required properties
            if (schema.required) {
                schema.required.forEach(prop => {
                    if (config[prop] === undefined) {
                        errors.push(`Required property '${prop}' is missing`)
                    }
                })
            }

            // Property validation
            if (schema.properties) {
                Object.entries(config).forEach(([key, value]) => {
                    const propSchema = schema.properties[key]
                    if (propSchema) {
                        const propValidation = this._validateProperty(value, propSchema, key)
                        errors.push(...propValidation.errors)
                        warnings.push(...propValidation.warnings)
                    } else if (!schema.additionalProperties) {
                        warnings.push(`Unknown property '${key}' will be ignored`)
                    }
                })
            }

        } catch (error) {
            errors.push(`Schema validation error: ${error.message}`)
        }

        return { errors, warnings }
    }

    /**
     * Validate individual property against schema
     */
    _validateProperty(value, schema, propertyName) {
        const errors = []
        const warnings = []

        // Type validation
        if (schema.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value
            if (actualType !== schema.type) {
                errors.push(`Property '${propertyName}' should be ${schema.type}, got ${actualType}`)
            }
        }

        // String constraints
        if (schema.type === 'string') {
            if (schema.minLength && value.length < schema.minLength) {
                errors.push(`Property '${propertyName}' must be at least ${schema.minLength} characters`)
            }
            if (schema.maxLength && value.length > schema.maxLength) {
                errors.push(`Property '${propertyName}' must be at most ${schema.maxLength} characters`)
            }
            if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
                errors.push(`Property '${propertyName}' does not match required pattern`)
            }
        }

        // Number constraints
        if (schema.type === 'number') {
            if (schema.minimum !== undefined && value < schema.minimum) {
                errors.push(`Property '${propertyName}' must be at least ${schema.minimum}`)
            }
            if (schema.maximum !== undefined && value > schema.maximum) {
                errors.push(`Property '${propertyName}' must be at most ${schema.maximum}`)
            }
        }

        // Enum validation
        if (schema.enum && !schema.enum.includes(value)) {
            errors.push(`Property '${propertyName}' must be one of: ${schema.enum.join(', ')}`)
        }

        return { errors, warnings }
    }

    /**
     * Flatten nested style object for object context
     */
    _flattenStyleObject(styles) {
        const flattened = {}

        const flatten = (obj, prefix = '') => {
            Object.entries(obj).forEach(([key, value]) => {
                const newKey = prefix ? `${prefix}_${key}` : key

                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flatten(value, newKey)
                } else {
                    flattened[newKey] = value
                }
            })
        }

        flatten(styles)
        return flattened
    }

    /**
     * Add validation rule for context and widget type
     */
    addValidationRule(contextType, widgetType, rule) {
        if (!this._validationRules[contextType]) {
            this._validationRules[contextType] = {}
        }
        this._validationRules[contextType][widgetType] = rule
    }

    /**
     * Add transformation rule between contexts
     */
    addTransformationRule(fromContext, toContext, rule) {
        const key = `${fromContext}_to_${toContext}`
        this._transformationRules[key] = rule
    }

    /**
     * Clear schema cache
     */
    clearSchemaCache() {
        this._schemaCache.clear()
    }

    /**
     * Get validation statistics
     */
    getValidationStats() {
        return {
            contextType: this._contextType,
            rulesCount: Object.keys(this._validationRules).length,
            transformationsCount: Object.keys(this._transformationRules).length,
            cachedSchemas: this._schemaCache.size
        }
    }
}

/**
 * Create configuration manager for specific context
 */
export function createConfigurationManager(contextType, options = {}) {
    return new ConfigurationManager({
        contextType,
        ...options
    })
}

/**
 * Default validation rules for different contexts
 */
export const DEFAULT_VALIDATION_RULES = {
    [SUPPORTED_CONTEXTS.PAGE]: {
        'text-block': {
            required: ['content'],
            types: {
                content: 'string',
                fontSize: 'number',
                color: 'string'
            },
            constraints: {
                fontSize: { min: 8, max: 72 }
            }
        },
        'image': {
            required: ['src'],
            types: {
                src: 'string',
                alt: 'string',
                width: 'number',
                height: 'number'
            },
            constraints: {
                width: { min: 1, max: 2000 },
                height: { min: 1, max: 2000 }
            }
        }
    },
    [SUPPORTED_CONTEXTS.OBJECT]: {
        'text-block': {
            required: ['content', 'controlId'],
            types: {
                content: 'string',
                controlId: 'string',
                fontSize: 'number'
            },
            constraints: {
                fontSize: { min: 8, max: 48 } // More restrictive for objects
            }
        },
        'image': {
            required: ['src', 'controlId'],
            types: {
                src: 'string',
                controlId: 'string',
                alt: 'string'
            }
        }
    }
}

/**
 * Default transformation rules between contexts
 */
export const DEFAULT_TRANSFORMATION_RULES = {
    'page_to_object': {
        fieldMappings: {
            'templateConfig': 'staticConfig'
        },
        valueTransforms: {
            fontSize: (value) => Math.min(value, 48) // Cap font size for objects
        }
    },
    'object_to_page': {
        fieldMappings: {
            'staticConfig': 'templateConfig'
        },
        valueTransforms: {
            // No specific transforms needed for object to page
        }
    }
}

export default ConfigurationManager
