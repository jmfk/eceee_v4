/**
 * Preview Sizes API
 * 
 * Manages preview size configurations for the page editor.
 */

import { api } from './client.js'
import { endpoints } from './endpoints.js'

/**
 * Preview Sizes API functions
 */
export const previewSizesApi = {
    /**
     * Get all preview sizes
     * @returns {Promise<Array>} List of preview size configurations
     */
    async list() {
        const response = await api.get(endpoints.previewSizes.list)
        return response.data
    },

    /**
     * Get a specific preview size
     * @param {number} id - Preview size ID
     * @returns {Promise<Object>} Preview size configuration
     */
    async get(id) {
        const response = await api.get(endpoints.previewSizes.detail(id))
        return response.data
    },

    /**
     * Create a new preview size
     * @param {Object} data - Preview size configuration
     * @param {string} data.name - Display name
     * @param {number} data.width - Width in pixels
     * @param {number} [data.height] - Height in pixels (optional)
     * @param {number} [data.sort_order] - Display order
     * @param {boolean} [data.is_default] - Is default size
     * @returns {Promise<Object>} Created preview size
     */
    async create(data) {
        const response = await api.post(endpoints.previewSizes.create, data)
        return response.data
    },

    /**
     * Update an existing preview size
     * @param {number} id - Preview size ID
     * @param {Object} data - Updated configuration
     * @returns {Promise<Object>} Updated preview size
     */
    async update(id, data) {
        const response = await api.patch(endpoints.previewSizes.update(id), data)
        return response.data
    },

    /**
     * Delete a preview size
     * @param {number} id - Preview size ID
     * @returns {Promise<void>}
     */
    async delete(id) {
        await api.delete(endpoints.previewSizes.delete(id))
    },

    /**
     * Get preview URL for a specific page version
     * @param {number} pageId - Page ID
     * @param {number} versionId - Version ID
     * @returns {string} Preview URL
     */
    getPreviewUrl(pageId, versionId) {
        return endpoints.previewSizes.preview(pageId, versionId)
    }
}

export default previewSizesApi

