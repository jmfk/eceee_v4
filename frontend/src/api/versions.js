/**
 * Versions API Module
 * 
 * Centralized API functions for version management with draft/published workflow
 */

import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { wrapApiCall, buildQueryParams } from './utils.js'

/**
 * Version API operations
 */
export const versionsApi = {
    /**
     * Create a new version
     * @param {number} pageId - Page ID
     * @param {Object} versionData - Version data
     * @returns {Promise<Object>} Created version
     */
    create: wrapApiCall(async (pageId, versionData) => {
        return api.post(endpoints.versions.list, {
            page: pageId,
            ...versionData
        })
    }, 'versions.create'),

    /**
     * Get a specific version
     * @param {number} versionId - Version ID
     * @returns {Promise<Object>} Version data
     */
    get: wrapApiCall(async (versionId) => {
        return api.get(endpoints.versions.detail(versionId))
    }, 'versions.get'),

    /**
     * Update a version (only drafts can be updated)
     * @param {number} versionId - Version ID
     * @param {Object} versionData - Updated version data
     * @returns {Promise<Object>} Updated version
     */
    update: wrapApiCall(async (versionId, versionData) => {
        return api.patch(endpoints.versions.detail(versionId), versionData)
    }, 'versions.update'),

    /**
     * Delete a version (only drafts can be deleted)
     * @param {number} versionId - Version ID
     * @returns {Promise<void>}
     */
    delete: wrapApiCall(async (versionId) => {
        return api.delete(endpoints.versions.detail(versionId))
    }, 'versions.delete'),

    /**
     * Publish a version
     * @param {number} versionId - Version ID
     * @returns {Promise<Object>} Publish result
     */
    publish: wrapApiCall(async (versionId) => {
        return api.post(endpoints.versions.publish(versionId))
    }, 'versions.publish'),

    /**
     * Get complete data for a specific version of a page
     * @param {number} pageId - Page ID
     * @param {number} versionId - Version ID
     * @returns {Promise<Object>} Page version data in flat structure
     */
    getPageVersion: wrapApiCall(async (pageId, versionId) => {
        const response = await api.get(endpoints.pages.versionDetail(pageId, versionId))
        const versionData = response.data || response

        // Transform nested API response to flat pageData structure
        return {
            // Page metadata from nested page_data
            ...versionData.page_data,

            // Add page ID and widgets at root level
            id: versionData.page_id,
            widgets: versionData.widgets,

            // Add version metadata
            version_id: versionData.version_id,
            version_number: versionData.version_number,
            publication_status: versionData.publication_status,
            is_current_published: versionData.is_current_published,
            effective_date: versionData.effective_date,
            expiry_date: versionData.expiry_date,

            // Add version-specific fields
            description: versionData.description,
            created_at: versionData.created_at,
            created_by: versionData.created_by,
            change_summary: versionData.change_summary
        }
    }, 'versions.getPageVersion'),

    /**
     * Get all versions for a page
     * @param {number} pageId - Page ID
     * @returns {Promise<Object>} Page versions list
     */
    getPageVersionsList: wrapApiCall(async (pageId) => {
        return api.get(endpoints.pages.versions(pageId))
    }, 'versions.getPageVersionsList'),

    /**
     * Create a draft from a published version
     * @param {number} versionId - Version ID
     * @param {string} description - Draft description
     * @returns {Promise<Object>} Created draft
     */
    createDraftFromPublished: wrapApiCall(async (versionId, description = '') => {
        return api.post(endpoints.versions.createDraft(versionId), { description })
    }, 'versions.createDraftFromPublished'),

    /**
     * Restore a version as current
     * @param {number} versionId - Version ID
     * @returns {Promise<Object>} Restore result
     */
    restore: wrapApiCall(async (versionId) => {
        return api.post(endpoints.versions.restore(versionId))
    }, 'versions.restore'),

    /**
     * Compare two versions
     * @param {number} version1Id - First version ID
     * @param {number} version2Id - Second version ID
     * @returns {Promise<Object>} Comparison result
     */
    compare: wrapApiCall(async (version1Id, version2Id) => {
        const params = { version1: version1Id, version2: version2Id }
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.versions.compare}${queryString}`)
    }, 'versions.compare'),

    /**
     * Get filtered versions
     * @param {Object} filters - Filter parameters
     * @returns {Promise<Object>} Filtered versions
     */
    getFiltered: wrapApiCall(async (filters = {}) => {
        const queryString = buildQueryParams(filters)
        return api.get(`${endpoints.versions.list}${queryString}`)
    }, 'versions.getFiltered')
}

// Legacy exports for backward compatibility
export const createVersion = versionsApi.create
export const getVersion = versionsApi.get
export const updateVersion = versionsApi.update
export const deleteVersion = versionsApi.delete
export const publishVersion = versionsApi.publish
export const getPageVersion = versionsApi.getPageVersion
export const getPageVersionsList = versionsApi.getPageVersionsList
export const createDraftFromPublished = versionsApi.createDraftFromPublished
export const restoreVersion = versionsApi.restore
export const compareVersions = versionsApi.compare
export const getVersionsFiltered = versionsApi.getFiltered

export default versionsApi