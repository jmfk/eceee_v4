/**
 * Pages API Module
 * 
 * Centralized API functions for page operations with hierarchical management
 */

import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { wrapApiCall, buildQueryParams } from './utils.js'

/**
 * Page Tree Management API
 * Provides functions for hierarchical page management with lazy loading
 * 
 * @typedef {import('../types/api').WebPageTreeResponse} WebPageTreeResponse
 * @typedef {import('../types/api').WebPageDetailResponse} WebPageDetailResponse
 * @typedef {import('../types/api').PaginatedResponse} PaginatedResponse
 * @typedef {import('../types/api').CreatePageRequest} CreatePageRequest
 * @typedef {import('../types/api').UpdatePageRequest} UpdatePageRequest
 * @typedef {import('../types/api').PageFilters} PageFilters
 */

/**
 * Pages API operations
 */
export const pagesApi = {
    /**
     * Get root pages (pages without parent)
     * @param {PageFilters} filters - Query filters
     * @returns {Promise<PaginatedResponse<WebPageTreeResponse>>}
     */
    getRootPages: wrapApiCall(async (filters = {}) => {
        const params = {
            parent_isnull: 'true',
            ordering: 'sort_order,title',
            ...filters
        }
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.pages.list}${queryString}`)
    }, 'pages.getRootPages'),

    /**
     * Get children of a specific page
     * @param {number} pageId - Parent page ID
     * @param {PageFilters} filters - Query filters
     * @returns {Promise<PaginatedResponse<WebPageTreeResponse>>}
     */
    getPageChildren: wrapApiCall(async (pageId, filters = {}) => {
        const params = {
            parent: pageId,
            ordering: 'sort_order,title',
            ...filters
        }
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.pages.list}${queryString}`)
    }, 'pages.getPageChildren'),

    /**
     * Get complete page tree (for small hierarchies)
     * @returns {Promise<Array<WebPageTreeResponse>>}
     */
    getPageTree: wrapApiCall(async () => {
        return api.get(`${endpoints.pages.base}/tree/`)
    }, 'pages.getPageTree'),

    /**
     * Get all pages with optional filtering
     * @param {PageFilters} filters - Query filters
     * @returns {Promise<PaginatedResponse<WebPageTreeResponse>>}
     */
    list: wrapApiCall(async (filters = {}) => {
        const queryString = buildQueryParams(filters)
        return api.get(`${endpoints.pages.list}${queryString}`)
    }, 'pages.list'),

    /**
     * Get a specific page
     * @param {number} pageId - Page ID
     * @param {number|null} versionId - Optional version ID
     * @returns {Promise<WebPageDetailResponse>}
     */
    get: wrapApiCall(async (pageId, versionId = null) => {
        const params = versionId ? { version_id: versionId } : {}
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.pages.detail(pageId)}${queryString}`)
    }, 'pages.get'),

    /**
     * Get a page with explicit active version (current published or latest draft)
     * @param {number} pageId - Page ID
     * @returns {Promise<WebPageDetailResponse>}
     */
    getActiveVersion: wrapApiCall(async (pageId) => {
        return api.get(endpoints.pages.detail(pageId))
    }, 'pages.getActiveVersion'),

    /**
     * Get a page with a specific version
     * @param {number} pageId - Page ID
     * @param {number} versionId - Version ID
     * @returns {Promise<WebPageDetailResponse>}
     */
    getVersion: wrapApiCall(async (pageId, versionId) => {
        if (!versionId) {
            throw new Error('versionId is required for getVersion')
        }
        return api.get(endpoints.pages.versionDetail(pageId, versionId))
    }, 'pages.getVersion'),

    /**
     * Create a new page
     * @param {CreatePageRequest} pageData - Page creation data
     * @returns {Promise<WebPageDetailResponse>}
     */
    create: wrapApiCall(async (pageData) => {
        return api.post(endpoints.pages.list, pageData)
    }, 'pages.create'),

    /**
     * Update a page
     * @param {number} pageId - Page ID
     * @param {UpdatePageRequest} pageData - Updated page data
     * @returns {Promise<WebPageDetailResponse>}
     */
    update: wrapApiCall(async (pageId, pageData) => {
        return api.patch(endpoints.pages.detail(pageId), pageData)
    }, 'pages.update'),

    /**
     * Update a specific page version
     * @param {number} pageId - Page ID
     * @param {number} versionId - Version ID
     * @param {UpdatePageRequest} pageData - Updated page data
     * @returns {Promise<WebPageDetailResponse>}
     */
    updateVersion: wrapApiCall(async (pageId, versionId, pageData) => {
        return api.patch(endpoints.pages.versionDetail(pageId, versionId), pageData)
    }, 'pages.updateVersion'),

    /**
     * Delete a page
     * @param {number} pageId - Page ID
     * @returns {Promise<void>}
     */
    delete: wrapApiCall(async (pageId) => {
        return api.delete(endpoints.pages.detail(pageId))
    }, 'pages.delete'),

    /**
     * Unified save function (page data + widgets in one call)
     * @param {number} pageId - Page ID
     * @param {number} versionId - Version ID
     * @param {Object} pageData - Page metadata
     * @param {Array|null} widgets - Widgets data
     * @param {Object} options - Save options
     * @returns {Promise<Object>}
     */
    saveWithWidgets: wrapApiCall(async (pageId, versionId, pageData = {}, widgets = null, options = {}) => {
        const payload = { ...pageData }

        // Add widgets if provided
        if (widgets !== null) {
            payload.widgets = widgets
        }

        // Add version options if widgets are being saved
        if (widgets !== null || options.description || options.autoPublish !== undefined || options.createNewVersion !== undefined) {
            payload.version_options = {
                description: options.description || 'Auto-save',
                auto_publish: options.autoPublish || false,
                create_new_version: options.createNewVersion || false
            }
        }

        return api.patch(endpoints.pages.versionDetail(pageId, versionId), payload)
    }, 'pages.saveWithWidgets'),

    /**
     * Publish a page
     * @param {number} pageId - Page ID
     * @returns {Promise<Object>}
     */
    publish: wrapApiCall(async (pageId) => {
        return api.post(endpoints.pages.publish(pageId))
    }, 'pages.publish'),

    /**
     * Unpublish a page
     * @param {number} pageId - Page ID
     * @returns {Promise<Object>}
     */
    unpublish: wrapApiCall(async (pageId) => {
        return api.post(endpoints.pages.unpublish(pageId))
    }, 'pages.unpublish'),

    /**
     * Link an object to a page
     * @param {number} pageId - Page ID
     * @param {Object} linkData - Link data
     * @returns {Promise<Object>}
     */
    linkObject: wrapApiCall(async (pageId, linkData) => {
        return api.post(endpoints.pages.linkObject(pageId), linkData)
    }, 'pages.linkObject'),

    /**
     * Unlink an object from a page
     * @param {number} pageId - Page ID
     * @param {Object} unlinkData - Unlink data
     * @returns {Promise<Object>}
     */
    unlinkObject: wrapApiCall(async (pageId, unlinkData) => {
        return api.post(endpoints.pages.unlinkObject(pageId), unlinkData)
    }, 'pages.unlinkObject'),

    /**
     * Sync a page with its linked object
     * @param {number} pageId - Page ID
     * @param {Object} syncData - Sync data
     * @returns {Promise<Object>}
     */
    syncObject: wrapApiCall(async (pageId, syncData) => {
        return api.post(endpoints.pages.syncObject(pageId), syncData)
    }, 'pages.syncObject')
}

// Legacy exports for backward compatibility
export const getRootPages = pagesApi.getRootPages
export const getPageChildren = pagesApi.getPageChildren
export const getPageTree = pagesApi.getPageTree
export const getPage = pagesApi.get
export const getPageActiveVersion = pagesApi.getActiveVersion
export const getPageVersion = pagesApi.getVersion
export const createPage = pagesApi.create
export const updatePage = pagesApi.update
export const deletePage = pagesApi.delete
export const savePageWithWidgets = pagesApi.saveWithWidgets

export default pagesApi