/**
 * Widget Type Validation Utilities
 * 
 * Utilities for validating widget types against server availability
 * and handling deleted/unavailable widget types gracefully
 */

import { widgetsApi } from '../api'

/**
 * Cache for widget types to avoid repeated API calls
 */
let widgetTypesCache = null
let cacheExpiry = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

/**
 * Get all available widget types from server
 * @returns {Promise<Array>} Array of available widget types
 */
export const getAvailableWidgetTypes = async () => {
    // Return cached data if still valid
    if (widgetTypesCache && cacheExpiry && Date.now() < cacheExpiry) {
        return widgetTypesCache
    }

    try {
        const response = await widgetsApi.getTypes(true) // Include template JSON

        // Handle different response formats
        let widgetData = []
        if (Array.isArray(response)) {
            widgetData = response
        } else if (response?.data && Array.isArray(response.data)) {
            widgetData = response.data
        } else if (response?.results && Array.isArray(response.results)) {
            widgetData = response.results
        }

        // Cache the results
        widgetTypesCache = widgetData
        cacheExpiry = Date.now() + CACHE_DURATION

        return widgetData
    } catch (error) {
        console.error('Failed to fetch widget types:', error)
        // Return cached data if available, otherwise empty array
        return widgetTypesCache || []
    }
}

/**
 * Clear the widget types cache
 */
export const clearWidgetTypesCache = () => {
    widgetTypesCache = null
    cacheExpiry = null
}

/**
 * Check if a widget type is available on the server
 * @param {string} widgetType - Widget type identifier
 * @returns {Promise<boolean>} True if widget type is available
 */
export const isWidgetTypeAvailable = async (widgetType) => {
    if (!widgetType) return false

    try {
        const availableTypes = await getAvailableWidgetTypes()
        return availableTypes.some(type =>
            type.type === widgetType ||
            type.slug === widgetType ||
            type.name === widgetType
        )
    } catch (error) {
        console.error('Error checking widget type availability:', error)
        return false
    }
}

/**
 * Filter widget types to only include available ones
 * @param {Array} widgetTypes - Array of widget type objects
 * @returns {Promise<Array>} Filtered array of available widget types
 */
export const filterAvailableWidgetTypes = async (widgetTypes) => {
    if (!Array.isArray(widgetTypes)) return []

    try {
        const availableTypes = await getAvailableWidgetTypes()
        const availableTypeIds = new Set([
            ...availableTypes.map(t => t.type),
            ...availableTypes.map(t => t.slug),
            ...availableTypes.map(t => t.name)
        ])

        return widgetTypes.filter(widgetType => {
            const typeId = widgetType.type || widgetType.slug || widgetType.name || widgetType.widgetType
            return availableTypeIds.has(typeId)
        })
    } catch (error) {
        console.error('Error filtering widget types:', error)
        return widgetTypes // Return original array on error
    }
}

/**
 * Get widget type details from server
 * @param {string} widgetType - Widget type identifier
 * @returns {Promise<Object|null>} Widget type details or null if not found
 */
export const getWidgetTypeDetails = async (widgetType) => {
    if (!widgetType) return null

    try {
        const availableTypes = await getAvailableWidgetTypes()
        return availableTypes.find(type =>
            type.type === widgetType ||
            type.slug === widgetType ||
            type.name === widgetType
        ) || null
    } catch (error) {
        console.error('Error getting widget type details:', error)
        return null
    }
}

/**
 * Validate a widget against server-available types
 * @param {Object} widget - Widget object to validate
 * @returns {Promise<Object>} Validation result with isValid and details
 */
export const validateWidgetType = async (widget) => {
    if (!widget || !widget.type) {
        return {
            isValid: false,
            error: 'Widget has no type specified',
            canEdit: false,
            shouldHide: false
        }
    }

    try {
        const isAvailable = await isWidgetTypeAvailable(widget.type)
        const typeDetails = await getWidgetTypeDetails(widget.type)

        return {
            isValid: isAvailable,
            error: isAvailable ? null : `Widget type "${widget.type}" is not available on the server`,
            canEdit: isAvailable,
            shouldHide: !isAvailable,
            typeDetails: typeDetails
        }
    } catch (error) {
        console.error('Error validating widget type:', error)
        return {
            isValid: false,
            error: `Failed to validate widget type: ${error.message}`,
            canEdit: false,
            shouldHide: false
        }
    }
}

/**
 * Batch validate multiple widgets
 * @param {Array} widgets - Array of widget objects
 * @returns {Promise<Object>} Map of widget IDs to validation results
 */
export const validateWidgetTypes = async (widgets) => {
    if (!Array.isArray(widgets)) return {}

    const results = {}

    try {
        // Get available types once for all validations
        const availableTypes = await getAvailableWidgetTypes()
        const availableTypeIds = new Set([
            ...availableTypes.map(t => t.type),
            ...availableTypes.map(t => t.slug),
            ...availableTypes.map(t => t.name)
        ])

        widgets.forEach(widget => {
            if (!widget || !widget.type) {
                results[widget?.id || 'unknown'] = {
                    isValid: false,
                    error: 'Widget has no type specified',
                    canEdit: false,
                    shouldHide: false
                }
                return
            }

            const isAvailable = availableTypeIds.has(widget.type)
            const typeDetails = availableTypes.find(t =>
                t.type === widget.type || t.slug === widget.type || t.name === widget.type
            )

            results[widget.id] = {
                isValid: isAvailable,
                error: isAvailable ? null : `Widget type "${widget.type}" is not available on the server`,
                canEdit: isAvailable,
                shouldHide: !isAvailable,
                typeDetails: typeDetails
            }
        })
    } catch (error) {
        console.error('Error batch validating widget types:', error)
        // Return error state for all widgets
        widgets.forEach(widget => {
            results[widget?.id || 'unknown'] = {
                isValid: false,
                error: `Failed to validate widget type: ${error.message}`,
                canEdit: false,
                shouldHide: false
            }
        })
    }

    return results
}

export default {
    getAvailableWidgetTypes,
    clearWidgetTypesCache,
    isWidgetTypeAvailable,
    filterAvailableWidgetTypes,
    getWidgetTypeDetails,
    validateWidgetType,
    validateWidgetTypes
}
