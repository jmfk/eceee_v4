/**
 * Tags API Module
 * 
 * Centralized API functions for tag operations
 */

import { api } from './client.js'
import { wrapApiCall, buildQueryParams } from './utils.js'

/**
 * Tags API operations
 */
export const tagsApi = {
    /**
     * Get all tags with optional filtering
     * @param {Object} params - Query parameters (search, is_system, etc.)
     * @returns {Promise<Object>} Tags response
     */
    list: wrapApiCall(async (params = {}) => {
        const queryString = buildQueryParams(params)
        return api.get(`/api/v1/tags/${queryString}`)
    }, 'tags.list'),

    /**
     * Get a specific tag by ID
     * @param {number} id - Tag ID
     * @returns {Promise<Object>} Tag data
     */
    get: wrapApiCall(async (id) => {
        return api.get(`/api/v1/tags/${id}/`)
    }, 'tags.get'),

    /**
     * Create a new tag
     * @param {Object} tagData - Tag data (name, color, description, isSystem)
     * @returns {Promise<Object>} Created tag data
     */
    create: wrapApiCall(async (tagData) => {
        return api.post('/api/v1/tags/', tagData)
    }, 'tags.create'),

    /**
     * Update an existing tag
     * @param {number} id - Tag ID
     * @param {Object} tagData - Updated tag data
     * @returns {Promise<Object>} Updated tag data
     */
    update: wrapApiCall(async (id, tagData) => {
        return api.patch(`/api/v1/tags/${id}/`, tagData)
    }, 'tags.update'),

    /**
     * Delete a tag
     * @param {number} id - Tag ID
     * @returns {Promise<void>}
     */
    delete: wrapApiCall(async (id) => {
        return api.delete(`/api/v1/tags/${id}/`)
    }, 'tags.delete'),

    /**
     * Search tags by name
     * @param {string} query - Search query
     * @returns {Promise<Object>} Search results
     */
    search: wrapApiCall(async (query) => {
        const params = { search: query }
        const queryString = buildQueryParams(params)
        return api.get(`/api/v1/tags/${queryString}`)
    }, 'tags.search'),

    /**
     * Get tag usage statistics
     * @param {number} id - Tag ID
     * @returns {Promise<Object>} Usage statistics
     */
    getUsage: wrapApiCall(async (id) => {
        return api.get(`/api/v1/tags/${id}/usage/`)
    }, 'tags.getUsage'),

    /**
     * Bulk delete tags (not implemented in backend yet)
     * @param {number[]} ids - Array of tag IDs
     * @returns {Promise<Object>} Bulk delete response
     */
    bulkDelete: wrapApiCall(async (ids) => {
        // For now, delete each tag individually
        const results = await Promise.all(ids.map(id => api.delete(`/api/v1/tags/${id}/`)))
        return { data: { deleted_count: results.length } }
    }, 'tags.bulkDelete')
}

export default tagsApi
