/**
 * Case Conversion Utilities
 * 
 * Provides utilities for converting between snake_case (backend) and camelCase (frontend)
 * to maintain clean separation of concerns and consistent coding conventions
 */

/**
 * Convert snake_case string to camelCase
 * @param {string} str - Snake case string
 * @returns {string} CamelCase string
 */
export const snakeToCamel = (str) => {
    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
}

/**
 * Convert camelCase string to snake_case
 * @param {string} str - CamelCase string
 * @returns {string} Snake case string
 */
export const camelToSnake = (str) => {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/**
 * Convert object keys from snake_case to camelCase recursively
 * @param {any} obj - Object to convert
 * @returns {any} Object with camelCase keys
 */
export const convertKeysToCamel = (obj) => {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
        return obj
    }

    if (Array.isArray(obj)) {
        return obj.map(convertKeysToCamel)
    }

    if (obj instanceof Date) {
        return obj
    }

    const converted = {}
    for (const [key, value] of Object.entries(obj)) {
        const camelKey = snakeToCamel(key)
        converted[camelKey] = convertKeysToCamel(value)
    }

    return converted
}

/**
 * Convert object keys from camelCase to snake_case recursively
 * @param {any} obj - Object to convert
 * @returns {any} Object with snake_case keys
 */
export const convertKeysToSnake = (obj) => {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
        return obj
    }

    if (Array.isArray(obj)) {
        return obj.map(convertKeysToSnake)
    }

    if (obj instanceof Date) {
        return obj
    }

    const converted = {}
    for (const [key, value] of Object.entries(obj)) {
        const snakeKey = camelToSnake(key)
        converted[snakeKey] = convertKeysToSnake(value)
    }

    return converted
}

/**
 * Fields that should NOT be converted (already in correct format or special cases)
 */
const CONVERSION_EXCLUSIONS = new Set([
    'id',
    'url',
    'slug',
    'title',
    'description',
    'name',
    'type',
    'config',
    'data',
    'html',
    'css',
    'js',
    'json'
])

/**
 * Check if a key should be excluded from conversion
 * @param {string} key - Key to check
 * @returns {boolean} Whether the key should be excluded
 */
export const shouldExcludeFromConversion = (key) => {
    return CONVERSION_EXCLUSIONS.has(key.toLowerCase())
}

/**
 * Convert object keys with exclusions support
 * @param {any} obj - Object to convert
 * @param {Function} converter - Conversion function (convertKeysToCamel or convertKeysToSnake)
 * @returns {any} Converted object
 */
export const convertKeysWithExclusions = (obj, converter) => {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
        return obj
    }

    if (Array.isArray(obj)) {
        return obj.map(item => convertKeysWithExclusions(item, converter))
    }

    if (obj instanceof Date) {
        return obj
    }

    const converted = {}
    for (const [key, value] of Object.entries(obj)) {
        const convertedKey = shouldExcludeFromConversion(key) ? key :
            (converter === convertKeysToCamel ? snakeToCamel(key) : camelToSnake(key))
        converted[convertedKey] = convertKeysWithExclusions(value, converter)
    }

    return converted
}
