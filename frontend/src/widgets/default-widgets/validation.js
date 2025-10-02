/**
 * Shared Widget Validation Utilities
 * 
 * These validation functions are shared across all editors to ensure
 * consistent widget validation behavior.
 */

import { getWidgetDefaultConfig, isWidgetTypeSupported } from '../index'

/**
 * Validate widget configuration against its schema
 * @param {Object} widget - Widget instance to validate
 * @returns {Object} Validation result with isValid, errors, and warnings
 */
export const validateWidgetConfig = (widget) => {
    const result = {
        isValid: true,
        errors: {},
        warnings: {},
        fieldResults: {}
    }

    if (!widget) {
        result.isValid = false
        result.errors.widget = ['Widget is required']
        return result
    }

    // Validate widget type
    if (!widget.type) {
        result.isValid = false
        result.errors.type = ['Widget type is required']
    } else if (!isWidgetTypeSupported(widget.type)) {
        result.isValid = false
        result.errors.type = [`Unsupported widget type: ${widget.type}`]
    }

    // Validate widget ID
    if (!widget.id) {
        result.isValid = false
        result.errors.id = ['Widget ID is required']
    }

    // Validate configuration
    if (!widget.config || typeof widget.config !== 'object') {
        result.warnings.config = ['Widget config is missing or invalid, using defaults']
        widget.config = getWidgetDefaultConfig(widget.type)
    }

    // Widget-specific validation
    if (widget.type && isWidgetTypeSupported(widget.type)) {
        const specificValidation = validateSpecificWidget(widget)
        result.isValid = result.isValid && specificValidation.isValid
        result.errors = { ...result.errors, ...specificValidation.errors }
        result.warnings = { ...result.warnings, ...specificValidation.warnings }
        result.fieldResults = { ...result.fieldResults, ...specificValidation.fieldResults }
    }

    return result
}

/**
 * Validate specific widget types with their own rules
 * @param {Object} widget - Widget instance
 * @returns {Object} Validation result
 */
const validateSpecificWidget = (widget) => {
    const result = {
        isValid: true,
        errors: {},
        warnings: {},
        fieldResults: {}
    }

    switch (widget.type) {
        case 'default_widgets.ContentWidget':
            return validateContentWidget(widget)
        case 'default_widgets.ImageWidget':
            return validateImageWidget(widget)
        case 'default_widgets.TableWidget':
            return validateTableWidget(widget)
        case 'default_widgets.HeaderWidget':
            return validateHeaderWidget(widget)
        case 'default_widgets.FooterWidget':
            return validateFooterWidget(widget)
        case 'default_widgets.NavigationWidget':
            return validateNavigationWidget(widget)
        case 'default_widgets.SidebarWidget':
            return validateSidebarWidget(widget)
        case 'default_widgets.FormsWidget':
            return validateFormsWidget(widget)
        default:
            return result
    }
}

/**
 * Validate ContentWidget configuration
 */
const validateContentWidget = (widget) => {
    const result = {
        isValid: true,
        errors: {},
        warnings: {},
        fieldResults: {}
    }

    const { config } = widget

    // Validate title tag
    if (config.titleTag && !['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(config.titleTag)) {
        result.warnings.titleTag = ['Invalid title tag, using h3 as default']
    }

    // Validate alignment
    if (config.alignment && !['left', 'center', 'right', 'justify'].includes(config.alignment)) {
        result.warnings.alignment = ['Invalid alignment, using left as default']
    }

    // Validate style
    if (config.style && !['normal', 'card', 'highlight'].includes(config.style)) {
        result.warnings.style = ['Invalid style, using normal as default']
    }

    // Check for empty content in required contexts
    if (!config.content && !config.title) {
        result.warnings.content = ['Widget has no title or content']
    }

    return result
}

/**
 * Validate ImageWidget configuration
 */
const validateImageWidget = (widget) => {
    const result = {
        isValid: true,
        errors: {},
        warnings: {},
        fieldResults: {}
    }

    const { config } = widget

    // Validate image source
    if (!config.src && !config.imageUrl) {
        result.errors.src = ['Image source is required']
        result.isValid = false
    }

    // Validate alt text for accessibility
    if (!config.alt && !config.altText) {
        result.warnings.alt = ['Alt text is recommended for accessibility']
    }

    // Validate alignment
    if (config.alignment && !['left', 'center', 'right'].includes(config.alignment)) {
        result.warnings.alignment = ['Invalid alignment, using center as default']
    }

    return result
}

/**
 * Validate TableWidget configuration
 */
const validateTableWidget = (widget) => {
    const result = {
        isValid: true,
        errors: {},
        warnings: {},
        fieldResults: {}
    }

    const { config } = widget

    // Validate table data
    if (!config.data || !Array.isArray(config.data)) {
        result.errors.data = ['Table data must be an array']
        result.isValid = false
    } else if (config.data.length === 0) {
        result.warnings.data = ['Table has no data']
    }

    // Validate headers
    if (config.showHeaders && (!config.headers || !Array.isArray(config.headers))) {
        result.warnings.headers = ['Headers enabled but no header data provided']
    }

    return result
}

/**
 * Validate HeaderWidget configuration
 */
const validateHeaderWidget = (widget) => {
    const result = {
        isValid: true,
        errors: {},
        warnings: {},
        fieldResults: {}
    }

    const { config } = widget

    // Validate title
    if (!config.title) {
        result.warnings.title = ['Header should have a title']
    }

    // Validate level
    if (config.level && (config.level < 1 || config.level > 6)) {
        result.warnings.level = ['Header level should be between 1 and 6']
    }

    return result
}

/**
 * Validate FooterWidget configuration
 */
const validateFooterWidget = (widget) => {
    const result = {
        isValid: true,
        errors: {},
        warnings: {},
        fieldResults: {}
    }

    const { config } = widget

    // Validate copyright text
    if (!config.copyright && !config.text) {
        result.warnings.content = ['Footer should have copyright or text content']
    }

    return result
}

/**
 * Validate NavigationWidget configuration
 */
const validateNavigationWidget = (widget) => {
    const result = {
        isValid: true,
        errors: {},
        warnings: {},
        fieldResults: {}
    }

    const { config } = widget

    // Validate navigation items
    if (!config.items || !Array.isArray(config.items)) {
        result.errors.items = ['Navigation items must be an array']
        result.isValid = false
    } else if (config.items.length === 0) {
        result.warnings.items = ['Navigation has no items']
    } else {
        // Validate each navigation item
        config.items.forEach((item, index) => {
            if (!item.label) {
                result.warnings[`items.${index}.label`] = [`Navigation item ${index + 1} missing label`]
            }
            if (!item.url && !item.href) {
                result.warnings[`items.${index}.url`] = [`Navigation item ${index + 1} missing URL`]
            }
        })
    }

    return result
}

/**
 * Validate SidebarWidget configuration
 */
const validateSidebarWidget = (widget) => {
    const result = {
        isValid: true,
        errors: {},
        warnings: {},
        fieldResults: {}
    }

    const { config } = widget

    // Validate position
    if (config.position && !['left', 'right'].includes(config.position)) {
        result.warnings.position = ['Invalid sidebar position, using left as default']
    }

    return result
}

/**
 * Validate FormsWidget configuration
 */
const validateFormsWidget = (widget) => {
    const result = {
        isValid: true,
        errors: {},
        warnings: {},
        fieldResults: {}
    }

    const { config } = widget

    // Validate form fields
    if (!config.fields || !Array.isArray(config.fields)) {
        result.errors.fields = ['Form fields must be an array']
        result.isValid = false
    } else if (config.fields.length === 0) {
        result.warnings.fields = ['Form has no fields']
    } else {
        // Validate each form field
        config.fields.forEach((field, index) => {
            if (!field.name) {
                result.errors[`fields.${index}.name`] = [`Form field ${index + 1} missing name`]
                result.isValid = false
            }
            if (!field.type) {
                result.errors[`fields.${index}.type`] = [`Form field ${index + 1} missing type`]
                result.isValid = false
            }
        })
    }

    return result
}

/**
 * Validate multiple widgets at once
 * @param {Array} widgets - Array of widget instances
 * @returns {Object} Combined validation result
 */
export const validateWidgets = (widgets) => {
    const result = {
        isValid: true,
        errors: {},
        warnings: {},
        widgetResults: {}
    }

    if (!Array.isArray(widgets)) {
        result.isValid = false
        result.errors.widgets = ['Widgets must be an array']
        return result
    }

    widgets.forEach((widget, index) => {
        const widgetResult = validateWidgetConfig(widget)
        result.widgetResults[index] = widgetResult

        if (!widgetResult.isValid) {
            result.isValid = false
        }

        // Merge errors and warnings with widget index
        Object.entries(widgetResult.errors).forEach(([key, value]) => {
            result.errors[`widget.${index}.${key}`] = value
        })

        Object.entries(widgetResult.warnings).forEach(([key, value]) => {
            result.warnings[`widget.${index}.${key}`] = value
        })
    })

    return result
}

/**
 * Create a default widget configuration
 * @param {string} widgetType - Widget type identifier
 * @param {Object} overrides - Configuration overrides
 * @returns {Object} Widget configuration
 */
export const createDefaultWidgetConfig = (widgetType, overrides = {}) => {
    const defaultConfig = getWidgetDefaultConfig(widgetType)
    return {
        ...defaultConfig,
        ...overrides
    }
}

/**
 * Generate a unique widget ID
 * @returns {string} Unique widget ID
 */
export const generateWidgetId = () => {
    // Use a counter to ensure uniqueness even within the same millisecond
    if (!generateWidgetId._counter) {
        generateWidgetId._counter = 0;
    }
    generateWidgetId._counter++;

    return `widget-${Date.now()}-${generateWidgetId._counter}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Sanitize widget configuration to remove invalid properties
 * @param {Object} widget - Widget instance
 * @returns {Object} Sanitized widget
 */
export const sanitizeWidget = (widget) => {
    if (!widget || typeof widget !== 'object') {
        return null
    }

    const sanitized = {
        id: widget.id || generateWidgetId(),
        type: widget.type || 'default_widgets.ContentWidget',
        config: widget.config || {},
        name: widget.name || '',
        slotName: widget.slotName || 'main'
    }

    // Ensure config is an object
    if (typeof sanitized.config !== 'object') {
        sanitized.config = {}
    }

    // Apply default configuration for missing properties
    const defaultConfig = getCoreWidgetDefaultConfig(sanitized.type)
    sanitized.config = {
        ...defaultConfig,
        ...sanitized.config
    }

    return sanitized
}
