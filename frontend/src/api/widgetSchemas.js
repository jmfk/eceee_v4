/**
 * Widget Schema API Client
 * 
 * Provides functions to fetch widget configuration schemas from the backend.
 */

import { api } from './client.js'

/**
 * Get JSON schema for a specific widget type
 * @param {string} widgetType - The widget type name
 * @returns {Promise<Object>} The JSON schema for the widget configuration
 */
export const getWidgetSchema = async (widgetType) => {
    try {
        // Properly encode the widget type to handle dots and spaces
        const encodedWidgetType = encodeURIComponent(widgetType)
        const response = await api.get(`/api/v1/webpages/widget-types/${encodedWidgetType}/schema/`)
        return response.data
    } catch (error) {
        console.error(`Failed to fetch schema for widget type "${widgetType}":`, error)
        throw error
    }
}

/**
 * Get widget type details including schema, defaults, and metadata
 * @param {string} widgetType - The widget type name
 * @returns {Promise<Object>} Complete widget type information
 */
export const getWidgetTypeDetails = async (widgetType) => {
    try {
        // Properly encode the widget type to handle dots and spaces
        const encodedWidgetType = encodeURIComponent(widgetType)
        const response = await api.get(`/api/v1/webpages/widget-types/${encodedWidgetType}/`)
        return response.data
    } catch (error) {
        console.error(`Failed to fetch details for widget type "${widgetType}":`, error)
        throw error
    }
}

/**
 * Get configuration defaults and schema for a widget type
 * @param {string} widgetType - The widget type name
 * @returns {Promise<Object>} Object with defaults and schema properties
 */
export const getWidgetConfigurationDefaults = async (widgetType) => {
    try {
        // Properly encode the widget type to handle dots and spaces
        const encodedWidgetType = encodeURIComponent(widgetType)
        const response = await api.get(`/api/v1/webpages/widget-types/${encodedWidgetType}/configuration-defaults/`)
        return response.data
    } catch (error) {
        console.error(`Failed to fetch configuration defaults for widget type "${widgetType}":`, error)
        throw error
    }
}

/**
 * Validate widget data using dedicated Pydantic validation API
 * @param {string} widgetType - The widget type name
 * @param {Object} widgetData - The widget data to validate
 * @returns {Promise<Object>} Validation result with isValid, errors, and warnings properties
 */
export const validateWidgetConfiguration = async (widgetType, widgetData) => {
    try {
        // Properly encode the widget type to handle dots and spaces
        const encodedWidgetType = encodeURIComponent(widgetType)
        const response = await api.post(`/api/v1/webpages/widget-types/${encodedWidgetType}/validate/`, {
            widgetData: widgetData
        })
        return response.data
    } catch (error) {
        console.error(`Failed to validate configuration for widget type "${widgetType}":`, error)

        // Return error in consistent format
        return {
            isValid: false,
            errors: {
                _general: [error.response?.data?.error || error.message || 'Validation service unavailable']
            },
            warnings: {}
        }
    }
}

/**
 * List all available widget types
 * @param {Object} options - Query options
 * @param {boolean} options.activeOnly - Only return active widget types (default: true)
 * @param {boolean} options.includeTemplateJson - Include template JSON data (default: false)
 * @param {string} options.search - Search term to filter widget types
 * @returns {Promise<Array>} Array of widget type objects
 */
export const listWidgetTypes = async (options = {}) => {
    const {
        activeOnly = true,
        includeTemplateJson = false,
        search = null
    } = options

    try {
        const params = new URLSearchParams({
            active: activeOnly.toString(),
            include_template_json: includeTemplateJson.toString()
        })

        if (search) {
            params.append('search', search)
        }

        const response = await api.get(`/api/v1/webpages/widget-types/?${params}`)
        return response.data
    } catch (error) {
        console.error('Failed to fetch widget types:', error)
        throw error
    }
}

export default {
    getWidgetSchema,
    getWidgetTypeDetails,
    getWidgetConfigurationDefaults,
    validateWidgetConfiguration,
    listWidgetTypes
}

