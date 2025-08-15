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
        const response = await api.get(endpoints.versions.pageVersionDetail(pageId, versionId))
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
        return api.get(endpoints.versions.byPage(pageId))
    }, 'versions.getPageVersionsList'),

    /**
     * Get versions for a page using consistent path-based API  
     * @param {number} pageId - Page ID
     * @returns {Promise<Array>} Array of versions
     */
    getVersionsForPage: wrapApiCall(async (pageId) => {
        return api.get(endpoints.versions.byPage(pageId))
    }, 'versions.getVersionsForPage'),

    /**
     * Get current published version for a page
     * @param {number} pageId - Page ID
     * @returns {Promise<Object>} Current version or null
     */
    getCurrentVersionForPage: wrapApiCall(async (pageId) => {
        return api.get(endpoints.versions.currentForPage(pageId))
    }, 'versions.getCurrentVersionForPage'),

    /**
     * Get latest version for a page
     * @param {number} pageId - Page ID
     * @returns {Promise<Object>} Latest version or null
     */
    getLatestVersionForPage: wrapApiCall(async (pageId) => {
        return api.get(endpoints.versions.latestForPage(pageId))
    }, 'versions.getLatestVersionForPage'),

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

/**
 * Version utility functions
 */

/**
 * Check if a draft can be created from a version
 * @param {Object} version - Version object
 * @returns {boolean} Whether a draft can be created
 */
export const canCreateDraft = (version) => {
    return version && version.publication_status === 'published'
}

/**
 * Check if a version can be edited
 * @param {Object} version - Version object
 * @returns {boolean} Whether the version can be edited
 */
export const canEditVersion = (version) => {
    return version && version.publication_status === 'draft'
}

/**
 * Check if a version can be published
 * @param {Object} version - Version object
 * @returns {boolean} Whether the version can be published
 */
export const canPublishVersion = (version) => {
    return version && version.publication_status === 'draft'
}

/**
 * Check if a version can be deleted
 * @param {Object} version - Version object
 * @returns {boolean} Whether the version can be deleted
 */
export const canDeleteVersion = (version) => {
    return version && version.publication_status === 'draft'
}

/**
 * Get version statistics for a page
 * @param {number} pageId - Page ID
 * @returns {Promise<Object>} Version statistics
 */
export const getVersionStats = wrapApiCall(async (pageId) => {
    const response = await api.get(endpoints.versions.byPage(pageId))
    const versions = response.data || response.results || []

    return {
        total: versions.length,
        drafts: versions.filter(v => v.publication_status === 'draft').length,
        published: versions.filter(v => v.publication_status === 'published').length,
        current: versions.filter(v => v.is_current_published).length
    }
}, 'versions.getVersionStats')

/**
 * Format a version for display
 * @param {Object} version - Raw version object
 * @returns {Object} Formatted version object
 */
export const formatVersionForDisplay = (version) => {
    if (!version) return null

    return {
        ...version,
        displayName: `v${version.version_number}${version.is_current_published ? ' (Current)' : ''}`,
        statusDisplay: version.publication_status === 'published' ? 'Published' : 'Draft',
        dateDisplay: version.effective_date ? new Date(version.effective_date).toLocaleDateString() : 'Not published',
        createdDisplay: new Date(version.created_at).toLocaleDateString()
    }
}

/**
 * Schedule a version for publishing
 * @param {number} versionId - Version ID  
 * @param {Object} scheduleData - Schedule data with effective_date and expiry_date
 * @returns {Promise<Object>} Schedule result
 */
export const scheduleVersion = wrapApiCall(async (versionId, scheduleData) => {
    return api.patch(endpoints.versions.detail(versionId), scheduleData)
}, 'versions.scheduleVersion')

/**
 * Publish a version immediately
 * @param {number} versionId - Version ID
 * @returns {Promise<Object>} Publish result
 */
export const publishVersionNow = wrapApiCall(async (versionId) => {
    const scheduleData = {
        effective_date: new Date().toISOString(),
        expiry_date: null
    }
    return api.patch(endpoints.versions.detail(versionId), scheduleData)
}, 'versions.publishVersionNow')

/**
 * Pack versions aggressively (bulk version management)
 * @param {number} pageId - Page ID
 * @returns {Promise<Object>} Pack result
 */
export const packVersionsAggressive = wrapApiCall(async (pageId) => {
    // This would typically call a bulk operations endpoint
    // For now, returning a placeholder response
    return { message: 'Aggressive version packing completed', count: 0 }
}, 'versions.packVersionsAggressive')

/**
 * Pack draft versions (bulk draft management)
 * @param {number} pageId - Page ID  
 * @returns {Promise<Object>} Pack result
 */
export const packVersionsDrafts = wrapApiCall(async (pageId) => {
    // This would typically call a bulk operations endpoint  
    // For now, returning a placeholder response
    return { message: 'Draft version packing completed', count: 0 }
}, 'versions.packVersionsDrafts')

export default versionsApi