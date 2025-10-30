/**
 * Label Formatting Utilities
 * 
 * Provides utilities for converting variable names (camelCase or snake_case)
 * to human-readable labels with proper spacing and capitalization.
 */

/**
 * Convert a field name to a human-readable label
 * Handles both camelCase and snake_case field names
 * 
 * @param {string} fieldName - Field name in camelCase or snake_case
 * @returns {string} Human-readable label in Title Case
 * 
 * @example
 * formatFieldLabel('backgroundImage') // "Background Image"
 * formatFieldLabel('background_image') // "Background Image"
 * formatFieldLabel('maxWidth') // "Max Width"
 * formatFieldLabel('seoTitle') // "Seo Title"
 * formatFieldLabel('URLPath') // "URL Path"
 */
export function formatFieldLabel(fieldName) {
    if (!fieldName || typeof fieldName !== 'string') {
        return ''
    }

    // First, handle snake_case by replacing underscores with spaces
    let label = fieldName.replace(/_/g, ' ')

    // Then, handle camelCase by inserting spaces before capital letters
    // This regex finds capital letters that are either:
    // 1. Preceded by a lowercase letter or number (e.g., "backgroundImage" -> "background Image")
    // 2. Followed by a lowercase letter and preceded by another capital (e.g., "URLPath" -> "URL Path")
    label = label.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    label = label.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')

    // Trim any extra whitespace
    label = label.trim()

    // Capitalize the first letter of each word (Title Case)
    label = label.replace(/\b\w/g, char => char.toUpperCase())

    return label
}

/**
 * Convert an enum value to a human-readable label
 * Similar to formatFieldLabel but specifically for enum values
 * 
 * @param {string|number} value - Enum value
 * @returns {string} Human-readable label
 * 
 * @example
 * formatEnumLabel('primary_button') // "Primary Button"
 * formatEnumLabel('leftAlign') // "Left Align"
 */
export function formatEnumLabel(value) {
    if (value === null || value === undefined) {
        return ''
    }

    // Convert to string if it's not already
    const strValue = String(value)

    // Use the same formatting logic as field labels
    return formatFieldLabel(strValue)
}

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use formatFieldLabel instead
 */
export function formatFieldName(name) {
    return formatFieldLabel(name)
}

