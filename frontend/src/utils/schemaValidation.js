// Shared schema validation utilities for schema management UIs

// Default fields template for empty system schemas only
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
        type: 'object',
        title: 'Featured Image',
        description: 'Main image for this page from media library',
        format: 'media',
        mediaTypes: ['image'],
        multiple: false,
        default: null,
    },
}

export function validateFieldName(name) {
    if (typeof name !== 'string') return false

    // Check if it's a valid camelCase identifier
    // - Starts with lowercase letter
    // - Followed by letters and numbers only (no underscores or hyphens)
    // - No consecutive uppercase letters (to avoid PascalCase)
    const camelCasePattern = /^[a-z][a-zA-Z0-9]*$/

    if (!camelCasePattern.test(name)) {
        return false
    }

    // Additional check: ensure it's not PascalCase (no consecutive uppercase)
    // and follows proper camelCase conventions
    const hasConsecutiveUppercase = /[A-Z]{2,}/.test(name)

    return !hasConsecutiveUppercase
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


