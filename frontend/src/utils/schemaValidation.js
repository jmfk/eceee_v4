// Shared schema validation and defaults utilities for schema management UIs

// Default fields that are always present in all schemas
export const DEFAULT_SCHEMA_FIELDS = {
    metaTitle: {
        type: 'string',
        title: 'Meta Title',
        description: 'The main title of this page',
        default: '',
        maxLength: 200,
    },
    metaDescription: {
        type: 'string',
        title: 'Page Description',
        description: 'A brief description of this page for SEO and previews',
        format: 'textarea',
        default: '',
        maxLength: 500,
    },
    featuredImage: {
        type: 'string',
        title: 'Featured Image URL',
        description: 'URL of the main image for this page',
        format: 'url',
        default: '',
    },
}

export function isDefaultField(fieldName) {
    return Object.prototype.hasOwnProperty.call(DEFAULT_SCHEMA_FIELDS, fieldName)
}

export function validateFieldName(name) {
    if (typeof name !== 'string') return false
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

// Basic structural validation for schemas edited in the UI
export function validateSchemaShape(schema) {
    if (!schema || typeof schema !== 'object') return { valid: false, reason: 'Schema must be an object' }
    if (schema.type && schema.type !== 'object') return { valid: false, reason: "Schema 'type' must be 'object'" }
    if (schema.properties && typeof schema.properties !== 'object') {
        return { valid: false, reason: "Schema 'properties' must be an object" }
    }
    if (schema.required && !Array.isArray(schema.required)) {
        return { valid: false, reason: "Schema 'required' must be an array of strings" }
    }

    // Check for suspicious keys to prevent proto pollution injection
    if (schema.properties) {
        for (const key of Object.keys(schema.properties)) {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                return { valid: false, reason: 'Disallowed property key detected' }
            }
        }
    }

    // Validate required entries are strings
    if (Array.isArray(schema.required)) {
        for (const item of schema.required) {
            if (typeof item !== 'string') {
                return { valid: false, reason: "Entries in 'required' must be strings" }
            }
        }
    }

    return { valid: true }
}

export function mergeWithDefaults(schema) {
    const mergedProperties = { ...DEFAULT_SCHEMA_FIELDS }
    const inputProps = schema?.properties || {}
    Object.entries(inputProps).forEach(([key, value]) => {
        if (!isDefaultField(key)) {
            mergedProperties[key] = value
        }
    })
    const inputRequired = Array.isArray(schema?.required) ? schema.required : []
    // Remove default fields from required and avoid duplicating 'title'
    const filteredRequired = inputRequired.filter(
        (field) => !isDefaultField(field) && field !== 'title'
    )
    // Ensure 'required' contains unique values with 'title' enforced exactly once
    const uniqueRequired = Array.from(new Set(['title', ...filteredRequired]))
    return {
        type: 'object',
        properties: mergedProperties,
        required: uniqueRequired,
    }
}

export function getSchemaWithoutDefaults(schema) {
    if (!schema?.properties) return { type: 'object', properties: {} }
    const userProperties = {}
    Object.entries(schema.properties).forEach(([key, value]) => {
        if (!isDefaultField(key)) {
            userProperties[key] = value
        }
    })
    const rawRequired = Array.isArray(schema.required) ? schema.required : []
    const cleanedRequired = rawRequired.filter((field) => !isDefaultField(field))
    // Deduplicate any existing duplicates to keep schema valid if it already had them
    const uniqueCleanedRequired = Array.from(new Set(cleanedRequired))
    return {
        type: 'object',
        properties: userProperties,
        required: uniqueCleanedRequired,
    }
}


