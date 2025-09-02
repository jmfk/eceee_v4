/**
 * Widget Validation Utilities
 * 
 * Provides comprehensive validation for widget configurations,
 * slot constraints, and editor-specific requirements.
 */

import { WIDGET_TYPE_REGISTRY } from './widgetFactory'

/**
 * Validation error types
 */
export const VALIDATION_ERROR_TYPES = {
    REQUIRED_FIELD: 'required_field',
    INVALID_TYPE: 'invalid_type',
    INVALID_FORMAT: 'invalid_format',
    OUT_OF_RANGE: 'out_of_range',
    SLOT_CONSTRAINT: 'slot_constraint',
    CONTEXT_MISMATCH: 'context_mismatch'
}

/**
 * Validation severity levels
 */
export const VALIDATION_SEVERITY = {
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
}

/**
 * Create a validation result object
 * @param {string} field - Field name
 * @param {string} message - Error message
 * @param {string} type - Error type from VALIDATION_ERROR_TYPES
 * @param {string} severity - Severity level
 * @returns {Object} Validation result
 */
export function createValidationResult(field, message, type, severity = VALIDATION_SEVERITY.ERROR) {
    return {
        field,
        message,
        type,
        severity,
        timestamp: new Date().toISOString()
    }
}

/**
 * Validate a single widget configuration
 * @param {Object} widget - Widget to validate
 * @param {Object} options - Validation options
 * @param {string} options.context - 'page' or 'object' context
 * @param {Object} options.slotConfig - Slot configuration constraints
 * @param {Array} options.existingWidgets - Other widgets in the same slot
 * @returns {Object} Validation results
 */
export function validateWidgetConfig(widget, options = {}) {
    const {
        context = 'page',
        slotConfig = null,
        existingWidgets = []
    } = options

    const results = []
    const widgetType = WIDGET_TYPE_REGISTRY[widget.slug]

    if (!widgetType) {
        results.push(createValidationResult(
            'type',
            `Unknown widget type: ${widget.slug}`,
            VALIDATION_ERROR_TYPES.INVALID_TYPE
        ))
        return { isValid: false, results }
    }

    // Validate required fields
    const requiredFields = getRequiredFields(widget.slug)
    requiredFields.forEach(field => {
        const value = widget.config?.[field]
        if (value === undefined || value === null || value === '') {
            results.push(createValidationResult(
                field,
                `${field} is required for ${widgetType.name}`,
                VALIDATION_ERROR_TYPES.REQUIRED_FIELD
            ))
        }
    })

    // Validate field types and formats
    const fieldValidations = getFieldValidations(widget.slug)
    Object.entries(fieldValidations).forEach(([field, validation]) => {
        const value = widget.config?.[field]
        if (value !== undefined && value !== null && value !== '') {
            const fieldResult = validateField(field, value, validation)
            if (fieldResult) {
                results.push(fieldResult)
            }
        }
    })

    // Validate slot constraints
    if (slotConfig) {
        const slotResults = validateSlotConstraints(widget, slotConfig, existingWidgets)
        results.push(...slotResults)
    }

    // Context-specific validation
    const contextResults = validateContext(widget, context)
    results.push(...contextResults)

    const errors = results.filter(r => r.severity === VALIDATION_SEVERITY.ERROR)
    const warnings = results.filter(r => r.severity === VALIDATION_SEVERITY.WARNING)

    return {
        isValid: errors.length === 0,
        results,
        errors,
        warnings,
        hasWarnings: warnings.length > 0
    }
}

/**
 * Get required fields for a widget type
 * @param {string} widgetSlug - Widget slug
 * @returns {Array} Array of required field names
 */
function getRequiredFields(widgetSlug) {
    const requiredFieldsMap = {
        'image': ['src', 'alt'],
        'button': ['text'],
        'html-block': ['html'],
        'object-list': ['objectType'],
        'forms': ['title']
    }

    return requiredFieldsMap[widgetSlug] || []
}

/**
 * Get field validation rules for a widget type
 * @param {string} widgetSlug - Widget slug
 * @returns {Object} Field validation rules
 */
function getFieldValidations(widgetSlug) {
    const validationMap = {
        'image': {
            src: { type: 'url', required: true },
            alt: { type: 'string', maxLength: 255 },
            caption: { type: 'string', maxLength: 500 },
            link: { type: 'url' }
        },
        'button': {
            text: { type: 'string', required: true, maxLength: 100 },
            url: { type: 'url' },
            style: { type: 'enum', values: ['primary', 'secondary', 'outline', 'ghost'] },
            size: { type: 'enum', values: ['small', 'medium', 'large'] }
        },
        'text-block': {
            title: { type: 'string', maxLength: 200 },
            content: { type: 'string', maxLength: 10000 },
            alignment: { type: 'enum', values: ['left', 'center', 'right', 'justify'] }
        },
        'spacer': {
            height: { type: 'number', min: 0, max: 500 },
            unit: { type: 'enum', values: ['px', 'rem', 'em', '%'] }
        },
        'gallery': {
            columns: { type: 'number', min: 1, max: 6 },
            spacing: { type: 'number', min: 0, max: 50 }
        },
        'object-list': {
            count: { type: 'number', min: 1, max: 100 },
            layout: { type: 'enum', values: ['list', 'grid', 'card'] }
        }
    }

    return validationMap[widgetSlug] || {}
}

/**
 * Validate a single field value
 * @param {string} field - Field name
 * @param {any} value - Field value
 * @param {Object} validation - Validation rules
 * @returns {Object|null} Validation result or null if valid
 */
function validateField(field, value, validation) {
    const { type, required, min, max, minLength, maxLength, values, pattern } = validation

    // Type validation
    switch (type) {
        case 'string':
            if (typeof value !== 'string') {
                return createValidationResult(
                    field,
                    `${field} must be a string`,
                    VALIDATION_ERROR_TYPES.INVALID_TYPE
                )
            }
            if (minLength && value.length < minLength) {
                return createValidationResult(
                    field,
                    `${field} must be at least ${minLength} characters`,
                    VALIDATION_ERROR_TYPES.OUT_OF_RANGE
                )
            }
            if (maxLength && value.length > maxLength) {
                return createValidationResult(
                    field,
                    `${field} must be no more than ${maxLength} characters`,
                    VALIDATION_ERROR_TYPES.OUT_OF_RANGE
                )
            }
            break

        case 'number':
            const numValue = Number(value)
            if (isNaN(numValue)) {
                return createValidationResult(
                    field,
                    `${field} must be a number`,
                    VALIDATION_ERROR_TYPES.INVALID_TYPE
                )
            }
            if (min !== undefined && numValue < min) {
                return createValidationResult(
                    field,
                    `${field} must be at least ${min}`,
                    VALIDATION_ERROR_TYPES.OUT_OF_RANGE
                )
            }
            if (max !== undefined && numValue > max) {
                return createValidationResult(
                    field,
                    `${field} must be no more than ${max}`,
                    VALIDATION_ERROR_TYPES.OUT_OF_RANGE
                )
            }
            break

        case 'url':
            try {
                new URL(value)
            } catch {
                return createValidationResult(
                    field,
                    `${field} must be a valid URL`,
                    VALIDATION_ERROR_TYPES.INVALID_FORMAT
                )
            }
            break

        case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(value)) {
                return createValidationResult(
                    field,
                    `${field} must be a valid email address`,
                    VALIDATION_ERROR_TYPES.INVALID_FORMAT
                )
            }
            break

        case 'enum':
            if (values && !values.includes(value)) {
                return createValidationResult(
                    field,
                    `${field} must be one of: ${values.join(', ')}`,
                    VALIDATION_ERROR_TYPES.INVALID_TYPE
                )
            }
            break
    }

    // Pattern validation
    if (pattern) {
        const regex = new RegExp(pattern)
        if (!regex.test(value)) {
            return createValidationResult(
                field,
                `${field} format is invalid`,
                VALIDATION_ERROR_TYPES.INVALID_FORMAT
            )
        }
    }

    return null
}

/**
 * Validate slot constraints
 * @param {Object} widget - Widget to validate
 * @param {Object} slotConfig - Slot configuration
 * @param {Array} existingWidgets - Existing widgets in slot
 * @returns {Array} Validation results
 */
function validateSlotConstraints(widget, slotConfig, existingWidgets) {
    const results = []

    // Check maximum widgets constraint
    if (slotConfig.maxWidgets && existingWidgets.length >= slotConfig.maxWidgets) {
        results.push(createValidationResult(
            'slot',
            `This slot can only contain ${slotConfig.maxWidgets} widget(s)`,
            VALIDATION_ERROR_TYPES.SLOT_CONSTRAINT
        ))
    }

    // Check allowed widget types
    if (slotConfig.allowedTypes && !slotConfig.allowedTypes.includes(widget.slug)) {
        results.push(createValidationResult(
            'slot',
            `Widget type ${widget.slug} is not allowed in this slot`,
            VALIDATION_ERROR_TYPES.SLOT_CONSTRAINT
        ))
    }

    // Check widget controls (for object context)
    if (slotConfig.widgetControls && widget.controlId) {
        const allowedControlIds = slotConfig.widgetControls.map(c => c.id)
        if (!allowedControlIds.includes(widget.controlId)) {
            results.push(createValidationResult(
                'slot',
                'Widget control is not valid for this slot',
                VALIDATION_ERROR_TYPES.SLOT_CONSTRAINT
            ))
        }
    }

    return results
}

/**
 * Validate context-specific requirements
 * @param {Object} widget - Widget to validate
 * @param {string} context - Context ('page' or 'object')
 * @returns {Array} Validation results
 */
function validateContext(widget, context) {
    const results = []

    // Object context requires controlId for some widgets
    if (context === 'object' && !widget.controlId) {
        results.push(createValidationResult(
            'context',
            'Object widgets should have a control ID',
            VALIDATION_ERROR_TYPES.CONTEXT_MISMATCH,
            VALIDATION_SEVERITY.WARNING
        ))
    }

    // Page context shouldn't have controlId
    if (context === 'page' && widget.controlId) {
        results.push(createValidationResult(
            'context',
            'Page widgets should not have a control ID',
            VALIDATION_ERROR_TYPES.CONTEXT_MISMATCH,
            VALIDATION_SEVERITY.WARNING
        ))
    }

    return results
}

/**
 * Validate multiple widgets in a slot
 * @param {Array} widgets - Widgets to validate
 * @param {Object} slotConfig - Slot configuration
 * @param {string} context - Context ('page' or 'object')
 * @returns {Object} Validation results for all widgets
 */
export function validateWidgetsInSlot(widgets, slotConfig, context = 'page') {
    const allResults = []
    const widgetResults = {}

    widgets.forEach((widget, index) => {
        const otherWidgets = widgets.filter((_, i) => i !== index)
        const validation = validateWidgetConfig(widget, {
            context,
            slotConfig,
            existingWidgets: otherWidgets
        })

        widgetResults[widget.id] = validation
        allResults.push(...validation.results)
    })

    const errors = allResults.filter(r => r.severity === VALIDATION_SEVERITY.ERROR)
    const warnings = allResults.filter(r => r.severity === VALIDATION_SEVERITY.WARNING)

    return {
        isValid: errors.length === 0,
        results: allResults,
        errors,
        warnings,
        widgetResults,
        hasWarnings: warnings.length > 0
    }
}

/**
 * Get validation summary for display
 * @param {Object} validationResult - Result from validation functions
 * @returns {Object} Summary for UI display
 */
export function getValidationSummary(validationResult) {
    const { errors = [], warnings = [], results = [] } = validationResult

    return {
        errorCount: errors.length,
        warningCount: warnings.length,
        totalIssues: results.length,
        isValid: errors.length === 0,
        hasWarnings: warnings.length > 0,
        summary: errors.length === 0
            ? (warnings.length > 0 ? 'Valid with warnings' : 'Valid')
            : `${errors.length} error(s) found`
    }
}
