/**
 * Layouts API Module
 * 
 * Centralized API functions for layout operations
 */

import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { wrapApiCall, buildQueryParams } from './utils.js'

/**
 * Layout API operations
 */
export const layoutsApi = {
    // Code-based layouts
    codeLayouts: {
        /**
         * Get all code layouts
         * @param {boolean} activeOnly - Filter to active layouts only
         * @returns {Promise<Object>} Layouts list
         */
        list: wrapApiCall(async (activeOnly = true) => {
            const params = { active_only: activeOnly }
            const queryString = buildQueryParams(params)
            return api.get(`${endpoints.layouts.list}${queryString}`)
        }, 'layouts.codeLayouts.list'),

        /**
         * Get specific code layout
         * @param {string} name - Layout name
         * @returns {Promise<Object>} Layout data
         */
        get: wrapApiCall(async (name) => {
            return api.get(endpoints.layouts.detail(name))
        }, 'layouts.codeLayouts.get'),

        /**
         * Get layout choices for forms
         * @param {boolean} activeOnly - Filter to active layouts only
         * @returns {Promise<Object>} Layout choices
         */
        choices: wrapApiCall(async (activeOnly = true) => {
            const params = { active_only: activeOnly }
            const queryString = buildQueryParams(params)
            return api.get(`${endpoints.layouts.choices}${queryString}`)
        }, 'layouts.codeLayouts.choices'),

        /**
         * Reload layouts (admin)
         * @returns {Promise<Object>} Reload result
         */
        reload: wrapApiCall(async () => {
            return api.post(endpoints.layouts.reload)
        }, 'layouts.codeLayouts.reload'),

        /**
         * Validate layouts (admin)
         * @returns {Promise<Object>} Validation result
         */
        validate: wrapApiCall(async () => {
            return api.get(endpoints.layouts.validate)
        }, 'layouts.codeLayouts.validate'),

        /**
         * Get layout JSON configuration
         * @param {string} name - Layout name
         * @returns {Promise<Object>} Layout JSON
         */
        getJson: wrapApiCall(async (name) => {
            return api.get(endpoints.layouts.json(name))
        }, 'layouts.codeLayouts.getJson'),

        /**
         * Get all unique slot names from all registered layouts
         * @param {boolean} activeOnly - Filter to active layouts only
         * @returns {Promise<Object>} All slots with metadata
         */
        allSlots: wrapApiCall(async (activeOnly = true) => {
            const params = { active_only: activeOnly }
            const queryString = buildQueryParams(params)
            return api.get(`${endpoints.layouts.allSlots}${queryString}`)
        }, 'layouts.codeLayouts.allSlots')
    },

    /**
     * Get combined layout data
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Combined layout data
     */
    getCombined: wrapApiCall(async (params = {}) => {
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.layouts.combined}${queryString}`)
    }, 'layouts.getCombined'),

    /**
     * Get all layouts (convenience method)
     * @param {boolean} activeOnly - Filter to active layouts only
     * @returns {Promise<Object>} All layouts
     */
    list: wrapApiCall(async (activeOnly = true) => {
        const params = { active_only: activeOnly }
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.layouts.list}${queryString}`)
    }, 'layouts.list'),

    /**
     * Get specific layout
     * @param {string} name - Layout name
     * @returns {Promise<Object>} Layout data
     */
    get: wrapApiCall(async (name) => {
        return api.get(endpoints.layouts.detail(name))
    }, 'layouts.get'),

    /**
     * Get layout JSON configuration
     * @param {string} name - Layout name
     * @returns {Promise<Object>} Layout JSON
     */
    getJson: wrapApiCall(async (name) => {
        return api.get(endpoints.layouts.json(name))
    }, 'layouts.getJson'),

    /**
     * Get all unique slot names from all registered layouts
     * @param {boolean} activeOnly - Filter to active layouts only
     * @returns {Promise<Object>} All slots with metadata
     */
    allSlots: wrapApiCall(async (activeOnly = true) => {
        const params = { active_only: activeOnly }
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.layouts.allSlots}${queryString}`)
    }, 'layouts.allSlots')
}

export default layoutsApi