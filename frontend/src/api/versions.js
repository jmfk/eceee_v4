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

    // Granular Update Methods

    /**
     * Update only widget data - no page_data validation
     * @param {number} versionId - Version ID
     * @param {Object} widgetData - Widget data only
     * @returns {Promise<Object>} Updated version
     */
    updateWidgets: wrapApiCall(async (versionId, widgetData) => {
        return api.patch(`${endpoints.versions.detail(versionId)}/widgets/`, widgetData)
    }, 'versions.updateWidgets'),

    /**
     * Update only page_data with schema validation
     * @param {number} versionId - Version ID  
     * @param {Object} pageData - Page data only
     * @returns {Promise<Object>} Updated version
     */
    updatePageData: wrapApiCall(async (versionId, pageData) => {
        return api.patch(`${endpoints.versions.detail(versionId)}/page-data/`, pageData)
    }, 'versions.updatePageData'),

    /**
     * Update version metadata (title, layout, theme, etc.)
     * @param {number} versionId - Version ID
     * @param {Object} metadata - Metadata only
     * @returns {Promise<Object>} Updated version
     */
    updateMetadata: wrapApiCall(async (versionId, metadata) => {
        return api.patch(`${endpoints.versions.detail(versionId)}/metadata/`, metadata)
    }, 'versions.updateMetadata'),

    /**
     * Update publishing dates and settings
     * @param {number} versionId - Version ID
     * @param {Object} publishingData - Publishing data only
     * @returns {Promise<Object>} Updated version
     */
    updatePublishing: wrapApiCall(async (versionId, publishingData) => {
        return api.patch(`${endpoints.versions.detail(versionId)}/publishing/`, publishingData)
    }, 'versions.updatePublishing'),

    /**
     * Smart save - automatically detects what changed and uses appropriate endpoints
     * @param {number} versionId - Version ID
     * @param {Object} changes - Object containing the changes to save
     * @param {Object} originalVersion - Original version data for comparison
     * @returns {Promise<Object>} Updated version (from the last successful update)
     */
    smartSave: wrapApiCall(async (versionId, changes, originalVersion = null) => {
        const updatePromises = []
        let lastResult = null

        // Detect what components are being updated
        const hasWidgetChanges = 'widgets' in changes
        const hasPageDataChanges = 'page_data' in changes
        const hasMetadataChanges = ['version_title', 'code_layout', 'theme', 'meta_title', 'meta_description', 'page_css_variables', 'page_custom_css', 'enable_css_injection'].some(field => field in changes)
        const hasPublishingChanges = ['effective_date', 'expiry_date'].some(field => field in changes)

        // Use granular endpoints for single-component updates
        if (hasWidgetChanges && !hasPageDataChanges && !hasMetadataChanges && !hasPublishingChanges) {
            // Widget-only update
            return versionsApi.updateWidgets(versionId, { widgets: changes.widgets })
        }

        if (hasPageDataChanges && !hasWidgetChanges && !hasMetadataChanges && !hasPublishingChanges) {
            // Page data-only update
            return versionsApi.updatePageData(versionId, { page_data: changes.page_data })
        }

        if (hasMetadataChanges && !hasWidgetChanges && !hasPageDataChanges && !hasPublishingChanges) {
            // Metadata-only update
            const metadataFields = ['version_title', 'code_layout', 'theme', 'meta_title', 'meta_description', 'page_css_variables', 'page_custom_css', 'enable_css_injection']
            const metadata = {}
            metadataFields.forEach(field => {
                if (field in changes) {
                    metadata[field] = changes[field]
                }
            })
            return versionsApi.updateMetadata(versionId, metadata)
        }

        if (hasPublishingChanges && !hasWidgetChanges && !hasPageDataChanges && !hasMetadataChanges) {
            // Publishing-only update
            const publishingFields = ['effective_date', 'expiry_date']
            const publishing = {}
            publishingFields.forEach(field => {
                if (field in changes) {
                    publishing[field] = changes[field]
                }
            })
            return versionsApi.updatePublishing(versionId, publishing)
        }

        // Multi-component updates - execute in parallel for better performance
        if (hasWidgetChanges) {
            updatePromises.push(
                versionsApi.updateWidgets(versionId, { widgets: changes.widgets })
                    .then(result => { lastResult = result; return result })
            )
        }

        if (hasPageDataChanges) {
            updatePromises.push(
                versionsApi.updatePageData(versionId, { page_data: changes.page_data })
                    .then(result => { lastResult = result; return result })
            )
        }

        if (hasMetadataChanges) {
            const metadataFields = ['version_title', 'code_layout', 'theme', 'meta_title', 'meta_description', 'page_css_variables', 'page_custom_css', 'enable_css_injection']
            const metadata = {}
            metadataFields.forEach(field => {
                if (field in changes) {
                    metadata[field] = changes[field]
                }
            })
            updatePromises.push(
                versionsApi.updateMetadata(versionId, metadata)
                    .then(result => { lastResult = result; return result })
            )
        }

        if (hasPublishingChanges) {
            const publishingFields = ['effective_date', 'expiry_date']
            const publishing = {}
            publishingFields.forEach(field => {
                if (field in changes) {
                    publishing[field] = changes[field]
                }
            })
            updatePromises.push(
                versionsApi.updatePublishing(versionId, publishing)
                    .then(result => { lastResult = result; return result })
            )
        }

        // Execute all updates in parallel
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises)
            return lastResult
        }

        // Fallback to full update if no specific changes detected
        return versionsApi.update(versionId, changes)
    }, 'versions.smartSave'),

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
            // Page metadata from nested pageData
            ...versionData.pageData,

            // Add page ID and widgets at root level
            id: versionData.pageId,
            widgets: versionData.widgets,

            // Add version metadata
            versionId: versionData.versionId,
            versionNumber: versionData.versionNumber,
            publicationStatus: versionData.publicationStatus,
            isCurrentPublished: versionData.isCurrentPublished,
            effectiveDate: versionData.effectiveDate,
            expiryDate: versionData.expiryDate,

            // Add version-specific fields
            metaDescription: versionData.metaDescription,
            createdAt: versionData.createdAt,
            createdBy: versionData.createdBy,
            changeSummary: versionData.changeSummary
        }
    }, 'versions.getPageVersion'),

    /**
     * Get all versions for a page
     * @param {number} pageId - Page ID
     * @returns {Promise<Object>} Page versions list
     */
    getPageVersionsList: wrapApiCall(async (pageId) => {
        const response = await api.get(endpoints.versions.byPage(pageId))
        return response
    }, 'versions.getPageVersionsList'),

    /**
     * Get versions for a page using consistent path-based API  
     * @param {number} pageId - Page ID
     * @returns {Promise<Array>} Array of versions
     */
    getVersionsForPage: wrapApiCall(async (pageId) => {
        const response = await api.get(endpoints.versions.byPage(pageId))
        return response
    }, 'versions.getVersionsForPage'),

    /**
     * Get current published version for a page
     * @param {number} pageId - Page ID
     * @returns {Promise<Object>} Current version or null
     */
    getCurrentVersionForPage: wrapApiCall(async (pageId) => {
        const response = await api.get(endpoints.versions.currentForPage(pageId))
        return response
    }, 'versions.getCurrentVersionForPage'),

    /**
     * Get latest version for a page
     * @param {number} pageId - Page ID
     * @returns {Promise<Object>} Latest version or null
     */
    getLatestVersionForPage: wrapApiCall(async (pageId) => {
        const response = await api.get(endpoints.versions.latestForPage(pageId))
        return response
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
    return version && version.publicationStatus === 'published'
}

/**
 * Check if a version can be edited
 * @param {Object} version - Version object
 * @returns {boolean} Whether the version can be edited
 */
export const canEditVersion = (version) => {
    return version && version.publicationStatus === 'draft'
}

/**
 * Check if a version can be published
 * @param {Object} version - Version object
 * @returns {boolean} Whether the version can be published
 */
export const canPublishVersion = (version) => {
    return version && version.publicationStatus === 'draft'
}

/**
 * Check if a version can be deleted
 * @param {Object} version - Version object
 * @returns {boolean} Whether the version can be deleted
 */
export const canDeleteVersion = (version) => {
    return version && version.publicationStatus === 'draft'
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
        drafts: versions.filter(v => v.publicationStatus === 'draft').length,
        published: versions.filter(v => v.publicationStatus === 'published').length,
        current: versions.filter(v => v.isCurrentPublished).length
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
        displayName: `v${version.versionNumber}${version.isCurrentPublished ? ' (Current)' : ''}`,
        statusDisplay: version.publicationStatus === 'published' ? 'Published' : 'Draft',
        dateDisplay: version.effectiveDate ? new Date(version.effectiveDate).toLocaleDateString() : 'Not published',
        createdDisplay: new Date(version.createdAt).toLocaleDateString()
    }
}

/**
 * Schedule a version for publishing
 * @param {number} versionId - Version ID  
 * @param {Object} scheduleData - Schedule data with effectiveDate and expiryDate
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
        effectiveDate: new Date().toISOString(),
        expiryDate: null
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