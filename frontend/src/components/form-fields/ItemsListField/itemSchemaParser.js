/**
 * Item Schema Parser
 * 
 * Utilities for parsing Pydantic List[BaseModel] schemas into a format
 * that can be used by the ItemForm component.
 */

import { formatFieldLabel } from '../../../utils/labelFormatting'

/**
 * Parse item schema from various formats
 * 
 * Handles:
 * - JSON Schema object definitions
 * - Pydantic model schemas
 * - Simple field definitions
 * 
 * @param {Object|Array} schema - Schema definition
 * @returns {Object} Parsed schema with fields array and default values
 */
export function parseItemSchema(schema) {
    if (!schema) {
        return { fields: [], defaultValues: {} }
    }

    // If it's already an array of fields, use it directly
    if (Array.isArray(schema)) {
        return {
            fields: schema,
            defaultValues: extractDefaultValues(schema)
        }
    }

    // If it has a fields property, use that
    if (schema.fields && Array.isArray(schema.fields)) {
        return {
            fields: schema.fields,
            defaultValues: schema.defaultValues || extractDefaultValues(schema.fields)
        }
    }

    // Parse JSON Schema format
    if (schema.type === 'array' && schema.items) {
        return parseArraySchema(schema)
    }

    // Parse object schema (single item definition)
    if (schema.type === 'object' || schema.properties) {
        return parseObjectSchema(schema)
    }

    // Fallback
    return { fields: [], defaultValues: {} }
}

/**
 * Parse array schema (List[BaseModel] format)
 */
function parseArraySchema(schema) {
    const itemSchema = schema.items

    if (!itemSchema) {
        return { fields: [], defaultValues: {} }
    }

    // If items is an object schema, parse it
    if (itemSchema.type === 'object' || itemSchema.properties) {
        return parseObjectSchema(itemSchema)
    }

    // If items has a $ref, we might need to resolve it
    // For now, just return empty
    return { fields: [], defaultValues: {} }
}

/**
 * Parse object schema into field definitions
 */
function parseObjectSchema(schema) {
    const properties = schema.properties || {}
    const required = schema.required || []
    const fields = []
    const defaultValues = {}

    // Convert properties to field definitions
    Object.entries(properties).forEach(([name, propSchema]) => {
        const field = parseFieldSchema(name, propSchema, required.includes(name))
        fields.push(field)

        // Extract default value
        if (propSchema.default !== undefined) {
            defaultValues[name] = propSchema.default
        } else if (field.type === 'boolean') {
            defaultValues[name] = false
        } else if (field.type === 'array') {
            defaultValues[name] = []
        } else if (field.type === 'object') {
            defaultValues[name] = {}
        } else if (field.type === 'number' || field.type === 'integer') {
            defaultValues[name] = field.minimum || 0
        } else {
            defaultValues[name] = ''
        }
    })

    // Sort fields by order if specified
    fields.sort((a, b) => {
        const orderA = a.order || 999
        const orderB = b.order || 999
        return orderA - orderB
    })

    return { fields, defaultValues }
}

/**
 * Parse individual field schema
 */
function parseFieldSchema(name, schema, isRequired = false) {
    const field = {
        name,
        type: schema.type || 'string',
        title: schema.title || formatFieldLabel(name),
        description: schema.description,
        required: isRequired,
        format: schema.format,
        enum: schema.enum,
        default: schema.default,
        // Additional properties
        minimum: schema.minimum,
        maximum: schema.maximum,
        minLength: schema.minLength,
        maxLength: schema.maxLength,
        pattern: schema.pattern,
        items: schema.items,
        // UI properties from json_schema_extra
        component: schema.component,
        widget: schema.widget,
        controlType: schema.controlType,
        placeholder: schema.placeholder,
        order: schema.order,
        props: {}
    }

    // Copy any additional UI props
    if (schema.json_schema_extra) {
        Object.assign(field.props, schema.json_schema_extra)
    }

    // For choice fields, prepare options
    if (field.enum) {
        field.props.options = field.enum.map(value => ({
            value,
            label: formatFieldLabel(String(value))
        }))
    }

    // For number/integer fields
    if (field.type === 'number' || field.type === 'integer') {
        if (field.minimum !== undefined) field.props.min = field.minimum
        if (field.maximum !== undefined) field.props.max = field.maximum
    }

    // For string fields
    if (field.type === 'string') {
        if (field.minLength !== undefined) field.props.minLength = field.minLength
        if (field.maxLength !== undefined) field.props.maxLength = field.maxLength
        if (field.pattern !== undefined) field.props.pattern = field.pattern
    }

    return field
}

/**
 * Extract default values from field definitions
 */
function extractDefaultValues(fields) {
    const defaults = {}

    fields.forEach(field => {
        if (field.default !== undefined) {
            defaults[field.name] = field.default
        } else if (field.type === 'boolean') {
            defaults[field.name] = false
        } else if (field.type === 'array') {
            defaults[field.name] = []
        } else if (field.type === 'object') {
            defaults[field.name] = {}
        } else if (field.type === 'number' || field.type === 'integer') {
            defaults[field.name] = 0
        } else {
            defaults[field.name] = ''
        }
    })

    return defaults
}

/**
 * Format field name for display
 * Converts snake_case to Title Case
 * @deprecated Use formatFieldLabel from utils/labelFormatting instead
 */
function formatFieldName(name) {
    return formatFieldLabel(name)
}

/**
 * Format enum value for display
 * @deprecated Use formatFieldLabel from utils/labelFormatting instead
 */
function formatEnumValue(value) {
    return formatFieldLabel(String(value))
}

/**
 * Validate item against schema
 * Returns array of validation errors
 */
export function validateItemAgainstSchema(item, schema) {
    const errors = []

    if (!schema || !schema.fields) {
        return errors
    }

    schema.fields.forEach(field => {
        const value = item[field.name]

        // Check required fields
        if (field.required && (value === undefined || value === null || value === '')) {
            errors.push({
                field: field.name,
                message: `${field.title || field.name} is required`
            })
            return
        }

        // Skip validation if empty and not required
        if (!field.required && (value === undefined || value === null || value === '')) {
            return
        }

        // Type-specific validation
        if (field.type === 'string' && typeof value === 'string') {
            if (field.minLength && value.length < field.minLength) {
                errors.push({
                    field: field.name,
                    message: `${field.title || field.name} must be at least ${field.minLength} characters`
                })
            }
            if (field.maxLength && value.length > field.maxLength) {
                errors.push({
                    field: field.name,
                    message: `${field.title || field.name} must be at most ${field.maxLength} characters`
                })
            }
            if (field.pattern && !new RegExp(field.pattern).test(value)) {
                errors.push({
                    field: field.name,
                    message: `${field.title || field.name} format is invalid`
                })
            }
        }

        if ((field.type === 'number' || field.type === 'integer') && typeof value === 'number') {
            if (field.minimum !== undefined && value < field.minimum) {
                errors.push({
                    field: field.name,
                    message: `${field.title || field.name} must be at least ${field.minimum}`
                })
            }
            if (field.maximum !== undefined && value > field.maximum) {
                errors.push({
                    field: field.name,
                    message: `${field.title || field.name} must be at most ${field.maximum}`
                })
            }
        }

        // URL validation
        if (field.format === 'url' || field.format === 'uri') {
            try {
                new URL(value)
            } catch {
                errors.push({
                    field: field.name,
                    message: `${field.title || field.name} must be a valid URL`
                })
            }
        }

        // Email validation
        if (field.format === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(value)) {
                errors.push({
                    field: field.name,
                    message: `${field.title || field.name} must be a valid email address`
                })
            }
        }
    })

    return errors
}

