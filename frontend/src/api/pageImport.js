/**
 * Page Import API Client
 * 
 * Handles importing page trees from external websites
 */

import { api } from './client'
import { endpoints } from './endpoints'

/**
 * Start importing a page tree from external URL
 * @param {string} url - The external URL to import from
 * @param {Object} options - Import options
 * @param {number} options.parentPageId - Optional parent page ID
 * @param {string} options.hostname - Optional hostname for root pages
 * @param {string} options.namespace - Namespace for tags (default: 'default')
 * @param {number} options.maxDepth - Maximum crawl depth (default: 5)
 * @param {number} options.maxPages - Maximum pages to crawl (default: 100)
 * @param {number} options.requestDelay - Delay between requests in seconds (default: 2.0)
 * @returns {Promise<Object>} Task info with taskId and progress
 */
export const importTree = async (url, options = {}) => {
    const response = await api.post(endpoints.pages.importTree, {
        url,
        parentPageId: options.parentPageId,
        hostname: options.hostname,
        namespace: options.namespace || 'default',
        maxDepth: options.maxDepth || 5,
        maxPages: options.maxPages || 100,
        requestDelay: options.requestDelay || 2.0,
    })
    return response.data
}

/**
 * Get import task status
 * @param {string} taskId - The task ID to check
 * @returns {Promise<Object>} Task status and progress
 */
export const getImportStatus = async (taskId) => {
    const response = await api.get(endpoints.pages.importStatus(taskId))
    return response.data
}

/**
 * Import a single page and get discovered links
 * @param {string} url - The URL to import
 * @param {Object} options - Import options
 * @param {number} options.parentPageId - Optional parent page ID
 * @param {string} options.hostname - Optional hostname for root pages
 * @param {string} options.namespace - Namespace for tags
 * @param {string} options.baseUrl - Base URL to filter discovered links
 * @param {number} options.requestDelay - Delay between requests
 * @returns {Promise<Object>} Result with page and discovered URLs
 */
export const importSinglePage = async (url, options = {}) => {
    const response = await api.post(endpoints.pages.importPage, {
        url,
        parentPageId: options.parentPageId,
        hostname: options.hostname,
        namespace: options.namespace || 'default',
        baseUrl: options.baseUrl,
        requestDelay: options.requestDelay || 2.0,
    })
    return response.data
}

export default {
    importTree,
    getImportStatus,
    importSinglePage,
}

