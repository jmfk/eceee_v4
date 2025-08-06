/**
 * Widgets API Module
 * 
 * Centralized API functions for widget operations
 */

import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { handleApiError, wrapApiCall, buildQueryParams } from './utils.js'

/**
 * Widget API operations
 */
export const widgetsApi = {
    /**
     * Get all widgets with optional filtering
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Widgets list response
     */
    list: wrapApiCall(async (params = {}) => {
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.widgets.list}${queryString}`)
    }, 'widgets.list'),

    /**
     * Get widgets for a specific page
     * @param {number} pageId - Page ID
     * @returns {Promise<Object>} Page widgets response
     */
    getByPage: wrapApiCall(async (pageId) => {
        return api.get(endpoints.widgets.byPage(pageId))
    }, 'widgets.getByPage'),

    /**
     * Get a specific widget
     * @param {number} widgetId - Widget ID
     * @returns {Promise<Object>} Widget data
     */
    get: wrapApiCall(async (widgetId) => {
        return api.get(endpoints.widgets.detail(widgetId))
    }, 'widgets.get'),

    /**
     * Create a new widget
     * @param {Object} widgetData - Widget creation data
     * @returns {Promise<Object>} Created widget
     */
    create: wrapApiCall(async (widgetData) => {
        return api.post(endpoints.widgets.list, widgetData)
    }, 'widgets.create'),

    /**
     * Update an existing widget
     * @param {number} widgetId - Widget ID
     * @param {Object} widgetData - Updated widget data
     * @returns {Promise<Object>} Updated widget
     */
    update: wrapApiCall(async (widgetId, widgetData) => {
        return api.patch(endpoints.widgets.detail(widgetId), widgetData)
    }, 'widgets.update'),

    /**
     * Delete a widget
     * @param {number} widgetId - Widget ID
     * @returns {Promise<void>}
     */
    delete: wrapApiCall(async (widgetId) => {
        return api.delete(endpoints.widgets.detail(widgetId))
    }, 'widgets.delete'),

    /**
     * Reorder widgets
     * @param {number} widgetId - Widget ID to reorder
     * @param {Object} orderData - Reorder parameters
     * @returns {Promise<Object>} Reorder result
     */
    reorder: wrapApiCall(async (widgetId, orderData) => {
        return api.post(endpoints.widgets.reorder(widgetId), orderData)
    }, 'widgets.reorder'),

    /**
     * Get widget types
     * @param {boolean} includeTemplateJson - Whether to include template JSON
     * @returns {Promise<Object>} Widget types response
     */
    getTypes: wrapApiCall(async (includeTemplateJson = false) => {
        const endpoint = includeTemplateJson
            ? endpoints.widgets.typesWithJson
            : endpoints.widgets.types
        return api.get(endpoint)
    }, 'widgets.getTypes')
}

export default widgetsApi