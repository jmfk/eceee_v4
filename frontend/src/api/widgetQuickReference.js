/**
 * Widget Quick Reference API Client
 * 
 * Provides functions to fetch comprehensive widget documentation including:
 * - Configuration schemas
 * - Template parameters
 * - Code examples
 * - CSS variables
 * - Special features
 */

import { api } from './client.js'

// Cache for widget reference data
const cache = {
    all: null,
    byType: new Map(),
    timestamp: null
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000

/**
 * Check if cache is valid
 */
function isCacheValid() {
    if (!cache.timestamp) return false
    return (Date.now() - cache.timestamp) < CACHE_DURATION
}

/**
 * Get quick reference for all widgets
 * @returns {Promise<Array>} Array of widget documentation objects
 */
export async function getAllWidgetReferences() {
    // Return cached data if valid
    if (isCacheValid() && cache.all) {
        return cache.all
    }

    try {
        const response = await api.get('/webpages/widget-quick-reference/')
        const widgets = response.data.widgets || []

        // Update cache
        cache.all = widgets
        cache.timestamp = Date.now()

        // Also cache individual widgets
        widgets.forEach(widget => {
            cache.byType.set(widget.type, widget)
        })

        return widgets
    } catch (error) {
        console.error('Error fetching widget quick reference:', error)
        throw error
    }
}

/**
 * Get quick reference for a specific widget type
 * @param {string} widgetType - Widget type identifier (e.g., "easy_widgets.ContentWidget")
 * @returns {Promise<Object>} Widget documentation object
 */
export async function getWidgetQuickReference(widgetType) {
    // Return cached data if valid
    if (isCacheValid() && cache.byType.has(widgetType)) {
        return cache.byType.get(widgetType)
    }

    try {
        const response = await api.get(`/webpages/widget-quick-reference/${widgetType}/`)
        const widget = response.data

        // Update cache
        cache.byType.set(widgetType, widget)

        return widget
    } catch (error) {
        console.error(`Error fetching widget quick reference for ${widgetType}:`, error)
        throw error
    }
}

/**
 * Search widgets by name or description
 * @param {string} query - Search query
 * @returns {Promise<Array>} Filtered array of widget documentation objects
 */
export async function searchWidgets(query) {
    const allWidgets = await getAllWidgetReferences()

    if (!query || query.trim() === '') {
        return allWidgets
    }

    const lowerQuery = query.toLowerCase()

    return allWidgets.filter(widget => {
        return (
            widget.name.toLowerCase().includes(lowerQuery) ||
            widget.description.toLowerCase().includes(lowerQuery) ||
            widget.type.toLowerCase().includes(lowerQuery) ||
            (widget.category && widget.category.toLowerCase().includes(lowerQuery))
        )
    })
}

/**
 * Get widgets by category
 * @param {string} category - Category name
 * @returns {Promise<Array>} Array of widget documentation objects in the category
 */
export async function getWidgetsByCategory(category) {
    const allWidgets = await getAllWidgetReferences()

    if (!category) {
        return allWidgets
    }

    return allWidgets.filter(widget => widget.category === category)
}

/**
 * Get all unique categories from widgets
 * @returns {Promise<Array>} Array of category names
 */
export async function getWidgetCategories() {
    const allWidgets = await getAllWidgetReferences()
    const categories = new Set()

    allWidgets.forEach(widget => {
        if (widget.category) {
            categories.add(widget.category)
        }
    })

    return Array.from(categories).sort()
}

/**
 * Clear the cache
 */
export function clearCache() {
    cache.all = null
    cache.byType.clear()
    cache.timestamp = null
}

/**
 * Get template parameters for a widget type
 * @param {string} widgetType - Widget type identifier
 * @returns {Promise<Object>} Template parameters dictionary
 */
export async function getWidgetTemplateParameters(widgetType) {
    const widget = await getWidgetQuickReference(widgetType)
    return widget.templateParameters || {}
}

/**
 * Get configuration schema for a widget type
 * @param {string} widgetType - Widget type identifier
 * @returns {Promise<Object>} Configuration schema
 */
export async function getWidgetConfigSchema(widgetType) {
    const widget = await getWidgetQuickReference(widgetType)
    return widget.configSchema || {}
}

/**
 * Get examples for a widget type
 * @param {string} widgetType - Widget type identifier
 * @returns {Promise<Object>} Examples object with "basic" and "advanced" properties
 */
export async function getWidgetExamples(widgetType) {
    const widget = await getWidgetQuickReference(widgetType)
    return widget.examples || {}
}

/**
 * Get CSS variables for a widget type
 * @param {string} widgetType - Widget type identifier
 * @returns {Promise<Object>} CSS variables dictionary
 */
export async function getWidgetCSSVariables(widgetType) {
    const widget = await getWidgetQuickReference(widgetType)
    return widget.cssVariables || {}
}

/**
 * Get special features for a widget type
 * @param {string} widgetType - Widget type identifier
 * @returns {Promise<Object>} Special features object
 */
export async function getWidgetSpecialFeatures(widgetType) {
    const widget = await getWidgetQuickReference(widgetType)
    return widget.specialFeatures || {}
}

