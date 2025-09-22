/**
 * Widget Schema API Client
 * 
 * Provides functions to fetch widget configuration schemas from the backend.
 */

import { api } from './client.js'

// Request throttling to prevent race conditions
class ValidationRequestManager {
    constructor() {
        this.activeRequests = new Map()
        this.requestQueue = []
        this.maxConcurrent = 3
        this.currentActive = 0
    }

    async validateWidget(widgetType, widgetData) {
        // Create a unique key for this validation request
        const requestKey = `${widgetType}-${JSON.stringify(widgetData)}`

        // If we already have this exact request in progress, return the existing promise
        if (this.activeRequests.has(requestKey)) {
            return await this.activeRequests.get(requestKey)
        }

        // Create the validation promise
        const validationPromise = this._executeValidation(widgetType, widgetData, requestKey)

        // Store the promise so duplicate requests can reuse it
        this.activeRequests.set(requestKey, validationPromise)

        // Clean up after completion
        validationPromise.finally(() => {
            this.activeRequests.delete(requestKey)
            this.currentActive--
            this._processQueue()
        })

        return await validationPromise
    }

    async _executeValidation(widgetType, widgetData, requestKey) {
        // Wait for available slot if at max capacity
        if (this.currentActive >= this.maxConcurrent) {
            await this._waitForSlot()
        }

        this.currentActive++

        try {
            const encodedWidgetType = encodeURIComponent(widgetType)
            const response = await api.post(`/api/v1/webpages/widget-types/${encodedWidgetType}/validate/`, {
                widgetData: widgetData
            })
            return response.data
        } catch (error) {
            console.error(`Failed to validate configuration for widget type "${widgetType}":`, error)
            return {
                isValid: false,
                errors: {
                    _general: [error.response?.data?.error || error.message || 'Validation service unavailable']
                },
                warnings: {}
            }
        }
    }

    _waitForSlot() {
        return new Promise((resolve) => {
            this.requestQueue.push(resolve)
        })
    }

    _processQueue() {
        if (this.requestQueue.length > 0 && this.currentActive < this.maxConcurrent) {
            const resolve = this.requestQueue.shift()
            resolve()
        }
    }
}

const validationManager = new ValidationRequestManager()

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
    return await validationManager.validateWidget(widgetType, widgetData)
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

