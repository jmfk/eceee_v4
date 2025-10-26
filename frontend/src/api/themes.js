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
     * Create a new theme with image upload
     * @param {FormData} formData - Theme creation data with image
     * @returns {Promise<Object>} Created theme
     */
    createWithImage: wrapApiCall(async (formData) => {
        return api.post(endpoints.themes.list, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
    }, 'themes.createWithImage'),

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
     * Update an existing theme with image upload
     * @param {number} themeId - Theme ID
     * @param {FormData} formData - Updated theme data with image
     * @returns {Promise<Object>} Updated theme
     */
    updateWithImage: wrapApiCall(async (themeId, formData) => {
        return api.put(endpoints.themes.detail(themeId), formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
    }, 'themes.updateWithImage'),

    /**
     * Update only the image field of a theme
     * @param {number} themeId - Theme ID
     * @param {File} imageFile - Image file to upload
     * @returns {Promise<Object>} Updated theme
     */
    updateImage: wrapApiCall(async (themeId, imageFile) => {
        const formData = new FormData()
        formData.append('image', imageFile)

        return api.patch(endpoints.themes.detail(themeId), formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        })
    }, 'themes.updateImage'),

    /**
     * Delete a theme
     * @param {number} themeId - Theme ID
     * @returns {Promise<void>}
     */
    delete: wrapApiCall(async (themeId) => {
        return api.delete(endpoints.themes.detail(themeId))
    }, 'themes.delete'),

    /**
     * Get theme CSS for a specific theme
     * @param {number} themeId - Theme ID
     * @param {string} scope - CSS scope selector (optional)
     * @returns {Promise<string>} Generated CSS
     */
    getCss: wrapApiCall(async (themeId, scope = '.theme-content') => {
        const queryString = buildQueryParams({ scope })
        return api.get(`${endpoints.themes.detail(themeId)}/css/${queryString}`)
    }, 'themes.getCss'),

    /**
     * Get theme preview data
     * @param {number} themeId - Theme ID
     * @returns {Promise<Object>} Preview data with theme, CSS, and sample HTML
     */
    getPreview: wrapApiCall(async (themeId) => {
        return api.get(`${endpoints.themes.detail(themeId)}/preview/`)
    }, 'themes.getPreview'),

    /**
     * Get HTML elements schema
     * @returns {Promise<Object>} Schema for supported HTML elements and properties
     */
    getHtmlElementsSchema: wrapApiCall(async () => {
        return api.get(`${endpoints.themes.list}html_elements_schema/`)
    }, 'themes.getHtmlElementsSchema'),

    /**
     * Create default themes
     * @returns {Promise<Object>} Created default themes
     */
    createDefaults: wrapApiCall(async () => {
        return api.post(`${endpoints.themes.list}create_defaults/`)
    }, 'themes.createDefaults'),

    /**
     * Get the current default theme for object content editors
     * @returns {Promise<Object>} Default theme data
     */
    getDefault: wrapApiCall(async () => {
        return api.get(`${endpoints.themes.list}default/`)
    }, 'themes.getDefault'),

    /**
     * Set a theme as the default theme for object content editors
     * @param {number} themeId - Theme ID to set as default
     * @returns {Promise<Object>} Updated theme data
     */
    setDefault: wrapApiCall(async (themeId) => {
        return api.post(`${endpoints.themes.detail(themeId)}/set_default/`)
    }, 'themes.setDefault'),

    /**
     * Clear the default theme setting
     * @returns {Promise<Object>} Success response
     */
    clearDefault: wrapApiCall(async () => {
        return api.post(`${endpoints.themes.list}clear_default/`)
    }, 'themes.clearDefault'),

    /**
     * Ensure a default theme exists, create one if necessary
     * @returns {Promise<Object>} Default theme data
     */
    ensureDefault: wrapApiCall(async () => {
        return api.post(`${endpoints.themes.list}ensure_default/`)
    }, 'themes.ensureDefault'),

    /**
     * Clone a theme with all its configuration
     * @param {number} themeId - Theme ID to clone
     * @param {Object} data - Optional data (e.g., new name)
     * @returns {Promise<Object>} Cloned theme data
     */
    clone: wrapApiCall(async (themeId, data = {}) => {
        return api.post(`${endpoints.themes.detail(themeId)}/clone/`, data)
    }, 'themes.clone')
}

export default themesApi