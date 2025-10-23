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

// Component name to field type key mapping for better error messages
const COMPONENT_NAME_SUGGESTIONS = {
    'TextInput': 'text',
    'TextareaInput': 'textarea',
    'NumberInput': 'number',
    'ImageInput': 'image',
    'FileInput': 'file',
    'ComboboxInput': 'combobox',
    'RichTextInput': 'rich_text',
    'DateInput': 'date',
    'DateTimeInput': 'datetime',
    'SelectInput': 'choice',
    'MultiSelectInput': 'multi_choice',
    'BooleanInput': 'boolean',
    'ColorInput': 'color',
    'URLInput': 'url',
    'EmailInput': 'email',
    'TagInput': 'tag',
    'ObjectReferenceInput': 'object_reference',
    'UserSelectorInput': 'user_reference',
}

/**
 * Validate that a componentType is valid
 * 
 * @param {string} componentType - The componentType to validate
 * @param {Array} availableTypes - Array of available field types from registry
 * @returns {string|null} - Error message or null if valid
 */
export function validateComponentType(componentType, availableTypes = []) {
    if (!componentType) {
        return 'Component type is required'
    }

    // If no available types provided, can't validate (registry might not be loaded)
    if (!availableTypes || availableTypes.length === 0) {
        return null
    }

    // Check if componentType exists in available types
    const isValid = availableTypes.some(ft => ft.key === componentType)

    if (!isValid) {
        // Check if this might be a component name instead of a field type key
        const suggestedKey = COMPONENT_NAME_SUGGESTIONS[componentType]
        if (suggestedKey) {
            return `Invalid component type "${componentType}". Did you mean "${suggestedKey}"? (Use the Fix Schema button above to convert automatically)`
        }

        const typeList = availableTypes.slice(0, 5).map(ft => ft.key).join(', ')
        return `Invalid component type "${componentType}". Must be one of: ${typeList}...`
    }

    return null
}

/**
 * Validate a property object in a schema
 * 
 * @param {object} property - The property object to validate
 * @param {Array} availableTypes - Array of available field types
 * @returns {object} - Object with validation errors (empty if valid)
 */
export function validateProperty(property, availableTypes = []) {
    const errors = {}

    // Validate key format
    if (!property.key) {
        errors.key = 'Property key is required'
    } else if (!validateFieldName(property.key)) {
        errors.key = 'Invalid key format. Use camelCase (e.g., firstName)'
    }

    // Validate display label
    if (!property.title) {
        errors.title = 'Display label is required'
    }

    // Validate component type
    if (!property.componentType && !property.component) {
        errors.componentType = 'Component type is required'
    } else {
        const componentTypeError = validateComponentType(
            property.componentType || property.component,
            availableTypes
        )
        if (componentTypeError) {
            errors.componentType = componentTypeError
        }
    }

    return errors
}


