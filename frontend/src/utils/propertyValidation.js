/**
 * Property Validation System for Schema-Driven Forms
 * 
 * Provides comprehensive validation for form properties based on JSON Schema definitions
 * with real-time feedback and user-friendly error messages.
 */

/**
 * Validates a single property value against its JSON Schema definition
 * @param {any} value - The value to validate
 * @param {object} propertySchema - JSON Schema definition for the property
 * @param {string} propertyName - Name of the property being validated
 * @returns {object} Validation result with errors and warnings
 */
export function validateProperty(value, propertySchema, propertyName) {
    const result = {
        isValid: true,
        errors: [],
        warnings: [],
        severity: 'none' // 'none', 'warning', 'error'
    }

    if (!propertySchema) {
        result.warnings.push('No schema definition found for this property')
        result.severity = 'warning'
        return result
    }

    // Handle null/undefined values
    if (value === null || value === undefined || value === '') {
        if (propertySchema.required || (Array.isArray(propertySchema.type) ? propertySchema.type.includes('null') === false : propertySchema.type !== 'null')) {
            if (propertySchema.default === undefined) {
                result.errors.push(`${propertyName} is required`)
                result.isValid = false
                result.severity = 'error'
            }
        }
        return result
    }

    // Type validation
    const expectedTypes = Array.isArray(propertySchema.type) ? propertySchema.type : [propertySchema.type]
    const actualType = getValueType(value)

    if (!expectedTypes.includes(actualType) && !expectedTypes.includes('null')) {
        result.errors.push(`Expected ${expectedTypes.join(' or ')}, but got ${actualType}`)
        result.isValid = false
        result.severity = 'error'
    }

    // String validations
    if (actualType === 'string' && expectedTypes.includes('string')) {
        validateString(value, propertySchema, propertyName, result)
    }

    // Number validations
    if ((actualType === 'number' || actualType === 'integer') && (expectedTypes.includes('number') || expectedTypes.includes('integer'))) {
        validateNumber(value, propertySchema, propertyName, result)
    }

    // Array validations
    if (actualType === 'array' && expectedTypes.includes('array')) {
        validateArray(value, propertySchema, propertyName, result)
    }

    // Object validations
    if (actualType === 'object' && expectedTypes.includes('object')) {
        validateObject(value, propertySchema, propertyName, result)
    }

    // Enum validation
    if (propertySchema.enum && !propertySchema.enum.includes(value)) {
        result.errors.push(`Value must be one of: ${propertySchema.enum.join(', ')}`)
        result.isValid = false
        result.severity = 'error'
    }

    // Format validation
    if (propertySchema.format) {
        validateFormat(value, propertySchema.format, propertyName, result)
    }

    // Pattern validation
    if (propertySchema.pattern) {
        try {
            const regex = new RegExp(propertySchema.pattern)
            if (!regex.test(String(value))) {
                result.errors.push(`Value does not match required pattern`)
                result.isValid = false
                result.severity = 'error'
            }
        } catch (e) {
            result.warnings.push('Invalid pattern in schema definition')
            if (result.severity === 'none') result.severity = 'warning'
        }
    }

    return result
}

/**
 * Validates multiple properties at once
 * @param {object} data - Object containing property values
 * @param {object} schema - Complete JSON Schema with properties
 * @returns {object} Validation results for all properties
 */
export function validateProperties(data, schema) {
    const results = {}
    const properties = schema?.properties || {}
    const required = schema?.required || []

    // Validate each property in the schema
    Object.entries(properties).forEach(([propertyName, propertySchema]) => {
        const value = data?.[propertyName]
        const isRequired = required.includes(propertyName)

        // Add required flag to property schema for validation
        const schemaWithRequired = { ...propertySchema, required: isRequired }

        results[propertyName] = validateProperty(value, schemaWithRequired, propertyName)
    })

    // Check for extra properties not in schema
    if (data && typeof data === 'object') {
        Object.keys(data).forEach(key => {
            if (!properties[key]) {
                results[key] = {
                    isValid: true,
                    errors: [],
                    warnings: [`Property '${key}' is not defined in the schema`],
                    severity: 'warning'
                }
            }
        })
    }

    return results
}

/**
 * Get overall validation status for all properties
 * @param {object} validationResults - Results from validateProperties
 * @returns {object} Overall validation summary
 */
export function getValidationSummary(validationResults) {
    const summary = {
        isValid: true,
        hasWarnings: false,
        errorCount: 0,
        warningCount: 0,
        properties: {
            valid: [],
            errors: [],
            warnings: []
        }
    }

    Object.entries(validationResults).forEach(([propertyName, result]) => {
        if (result.errors.length > 0) {
            summary.isValid = false
            summary.errorCount += result.errors.length
            summary.properties.errors.push(propertyName)
        } else if (result.warnings.length > 0) {
            summary.hasWarnings = true
            summary.warningCount += result.warnings.length
            summary.properties.warnings.push(propertyName)
        } else {
            summary.properties.valid.push(propertyName)
        }
    })

    return summary
}

// Helper functions

function getValueType(value) {
    if (value === null) return 'null'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'integer' : 'number'
    }
    return typeof value
}

function validateString(value, schema, propertyName, result) {
    const str = String(value)

    // Length validations
    if (schema.minLength !== undefined && str.length < schema.minLength) {
        result.errors.push(`Minimum length is ${schema.minLength} characters (current: ${str.length})`)
        result.isValid = false
        result.severity = 'error'
    }

    if (schema.maxLength !== undefined && str.length > schema.maxLength) {
        result.errors.push(`Maximum length is ${schema.maxLength} characters (current: ${str.length})`)
        result.isValid = false
        result.severity = 'error'
    }

    // Warn when approaching maxLength
    if (schema.maxLength !== undefined && str.length > schema.maxLength * 0.9) {
        result.warnings.push(`Approaching maximum length (${str.length}/${schema.maxLength})`)
        if (result.severity === 'none') result.severity = 'warning'
    }
}

function validateNumber(value, schema, propertyName, result) {
    const num = Number(value)

    if (isNaN(num)) {
        result.errors.push('Value must be a valid number')
        result.isValid = false
        result.severity = 'error'
        return
    }

    // Range validations
    if (schema.minimum !== undefined && num < schema.minimum) {
        result.errors.push(`Minimum value is ${schema.minimum}`)
        result.isValid = false
        result.severity = 'error'
    }

    if (schema.maximum !== undefined && num > schema.maximum) {
        result.errors.push(`Maximum value is ${schema.maximum}`)
        result.isValid = false
        result.severity = 'error'
    }

    if (schema.exclusiveMinimum !== undefined && num <= schema.exclusiveMinimum) {
        result.errors.push(`Value must be greater than ${schema.exclusiveMinimum}`)
        result.isValid = false
        result.severity = 'error'
    }

    if (schema.exclusiveMaximum !== undefined && num >= schema.exclusiveMaximum) {
        result.errors.push(`Value must be less than ${schema.exclusiveMaximum}`)
        result.isValid = false
        result.severity = 'error'
    }

    // Multiple of validation
    if (schema.multipleOf !== undefined && num % schema.multipleOf !== 0) {
        result.errors.push(`Value must be a multiple of ${schema.multipleOf}`)
        result.isValid = false
        result.severity = 'error'
    }

    // Integer validation
    if (schema.type === 'integer' && !Number.isInteger(num)) {
        result.errors.push('Value must be an integer')
        result.isValid = false
        result.severity = 'error'
    }
}

function validateArray(value, schema, propertyName, result) {
    if (!Array.isArray(value)) return

    // Length validations
    if (schema.minItems !== undefined && value.length < schema.minItems) {
        result.errors.push(`Minimum ${schema.minItems} items required (current: ${value.length})`)
        result.isValid = false
        result.severity = 'error'
    }

    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        result.errors.push(`Maximum ${schema.maxItems} items allowed (current: ${value.length})`)
        result.isValid = false
        result.severity = 'error'
    }

    // Unique items validation
    if (schema.uniqueItems && value.length !== new Set(value.map(JSON.stringify)).size) {
        result.errors.push('Array items must be unique')
        result.isValid = false
        result.severity = 'error'
    }
}

function validateObject(value, schema, propertyName, result) {
    if (typeof value !== 'object' || value === null) return

    // Additional properties validation
    if (schema.additionalProperties === false && schema.properties) {
        const allowedKeys = Object.keys(schema.properties)
        const extraKeys = Object.keys(value).filter(key => !allowedKeys.includes(key))
        if (extraKeys.length > 0) {
            result.warnings.push(`Additional properties not allowed: ${extraKeys.join(', ')}`)
            if (result.severity === 'none') result.severity = 'warning'
        }
    }
}

function validateFormat(value, format, propertyName, result) {
    const str = String(value)

    switch (format) {
        case 'email':
            if (!isValidEmail(str)) {
                result.errors.push('Invalid email address format')
                result.isValid = false
                result.severity = 'error'
            }
            break

        case 'url':
        case 'uri':
            if (!isValidUrl(str)) {
                result.errors.push('Invalid URL format')
                result.isValid = false
                result.severity = 'error'
            }
            break

        case 'date':
            if (!isValidDate(str)) {
                result.errors.push('Invalid date format (expected YYYY-MM-DD)')
                result.isValid = false
                result.severity = 'error'
            }
            break

        case 'date-time':
            if (!isValidDateTime(str)) {
                result.errors.push('Invalid date-time format (expected ISO 8601)')
                result.isValid = false
                result.severity = 'error'
            }
            break

        case 'time':
            if (!isValidTime(str)) {
                result.errors.push('Invalid time format (expected HH:MM:SS)')
                result.isValid = false
                result.severity = 'error'
            }
            break

        case 'hostname':
            if (!isValidHostname(str)) {
                result.errors.push('Invalid hostname format')
                result.isValid = false
                result.severity = 'error'
            }
            break

        case 'ipv4':
            if (!isValidIPv4(str)) {
                result.errors.push('Invalid IPv4 address format')
                result.isValid = false
                result.severity = 'error'
            }
            break

        case 'textarea':
            // Textarea is just a multiline string, no special validation needed
            // This is a UI hint format, not a data format
            break

        case 'password':
            // Password is just a string with special UI treatment
            // This is a UI hint format, not a data format
            break

        case 'color':
            // Basic hex color validation
            if (!isValidHexColor(str)) {
                result.errors.push('Invalid color format (expected #RRGGBB or #RGB)')
                result.isValid = false
                result.severity = 'error'
            }
            break

        default:
            // Unknown format, just warn
            result.warnings.push(`Unknown format '${format}' - validation skipped`)
            if (result.severity === 'none') result.severity = 'warning'
    }
}

// Format validation helpers
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

function isValidUrl(url) {
    try {
        new URL(url)
        return true
    } catch {
        return false
    }
}

function isValidDate(date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) return false
    const d = new Date(date)
    return d instanceof Date && !isNaN(d) && d.toISOString().startsWith(date)
}

function isValidDateTime(dateTime) {
    try {
        const d = new Date(dateTime)
        return d instanceof Date && !isNaN(d) && d.toISOString() === dateTime
    } catch {
        return false
    }
}

function isValidTime(time) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/
    return timeRegex.test(time)
}

function isValidHostname(hostname) {
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    return hostnameRegex.test(hostname) && hostname.length <= 253
}

function isValidIPv4(ip) {
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    const match = ip.match(ipRegex)
    if (!match) return false
    return match.slice(1).every(octet => parseInt(octet, 10) >= 0 && parseInt(octet, 10) <= 255)
}

function isValidHexColor(color) {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    return hexColorRegex.test(color)
}

/**
 * Get user-friendly validation message for display
 * @param {object} validationResult - Result from validateProperty
 * @param {string} propertyName - Name of the property
 * @returns {string} User-friendly message
 */
export function getValidationMessage(validationResult, propertyName) {
    if (validationResult.errors.length > 0) {
        return validationResult.errors[0] // Show first error
    }
    if (validationResult.warnings.length > 0) {
        return validationResult.warnings[0] // Show first warning
    }
    return ''
}

/**
 * Get validation status for UI styling
 * @param {object} validationResult - Result from validateProperty
 * @returns {string} Status for UI ('valid', 'warning', 'error')
 */
export function getValidationStatus(validationResult) {
    if (validationResult.errors.length > 0) return 'error'
    if (validationResult.warnings.length > 0) return 'warning'
    return 'valid'
}
