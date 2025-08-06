/**
 * Themes API Module
 * 
 * Centralized API functions for theme operations
 */

import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { handleApiError, wrapApiCall, buildQueryParams } from './utils.js'

/**
 * Theme API operations
 */
export const themesApi = {
    /**
     * Get all themes with optional filtering
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Themes list response
     */
    list: wrapApiCall(async (params = {}) => {
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.themes.list}${queryString}`)
    }, 'themes.list'),

    /**
     * Get a specific theme
     * @param {number} themeId - Theme ID
     * @returns {Promise<Object>} Theme data
     */
    get: wrapApiCall(async (themeId) => {
        return api.get(endpoints.themes.detail(themeId))
    }, 'themes.get'),

    /**
     * Create a new theme
     * @param {Object} themeData - Theme creation data
     * @returns {Promise<Object>} Created theme
     */
    create: wrapApiCall(async (themeData) => {
        return api.post(endpoints.themes.list, themeData)
    }, 'themes.create'),

    /**
     * Update an existing theme
     * @param {number} themeId - Theme ID
     * @param {Object} themeData - Updated theme data
     * @returns {Promise<Object>} Updated theme
     */
    update: wrapApiCall(async (themeId, themeData) => {
        return api.put(endpoints.themes.detail(themeId), themeData)
    }, 'themes.update'),

    /**
     * Delete a theme
     * @param {number} themeId - Theme ID
     * @returns {Promise<void>}
     */
    delete: wrapApiCall(async (themeId) => {
        return api.delete(endpoints.themes.detail(themeId))
    }, 'themes.delete')
}

export default themesApi