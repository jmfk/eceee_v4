/**
 * Content API Module
 * 
 * Centralized API functions for content object operations
 */

import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { handleApiError, wrapApiCall, buildQueryParams } from './utils.js'

/**
 * Content API operations
 */
export const contentApi = {
    /**
     * Get all content objects across all types
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} All content response
     */
    getAll: wrapApiCall(async (params = {}) => {
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.content.all}${queryString}`)
    }, 'content.getAll'),

    /**
     * Get content objects by type
     * @param {string} objectType - Type of content (events, library_items, etc.)
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Content by type response
     */
    getByType: wrapApiCall(async (objectType, params = {}) => {
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.content.byType(objectType)}${queryString}`)
    }, 'content.getByType'),

    /**
     * Get a specific content object
     * @param {string} objectType - Type of content
     * @param {number} objectId - Object ID
     * @returns {Promise<Object>} Content object data
     */
    get: wrapApiCall(async (objectType, objectId) => {
        return api.get(endpoints.content.detail(objectType, objectId))
    }, 'content.get'),

    /**
     * Search content objects
     * @param {Object} searchParams - Search parameters
     * @returns {Promise<Object>} Search results
     */
    search: wrapApiCall(async (searchParams = {}) => {
        const queryString = buildQueryParams(searchParams)
        return api.get(`${endpoints.content.base}/search/${queryString}`)
    }, 'content.search')
}

export default contentApi