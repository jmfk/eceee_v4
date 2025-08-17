/**
 * Publishing API Module
 * 
 * Centralized API functions for publishing operations
 */

import { api } from './client.js'
import { endpoints } from './endpoints.js'
import { handleApiError, wrapApiCall, buildQueryParams } from './utils.js'

/**
 * Publishing API operations
 */
export const publishingApi = {
    /**
     * Bulk publish pages
     * @param {Object} publishData - Bulk publish data with pageIds array
     * @returns {Promise<Object>} Bulk publish result
     */
    bulkPublish: wrapApiCall(async (publishData) => {
        return api.post(endpoints.publishing.bulkPublish, publishData)
    }, 'publishing.bulkPublish'),

    /**
     * Bulk schedule pages for publication
     * @param {Object} scheduleData - Bulk schedule data with pageIds, effectiveDate, etc.
     * @returns {Promise<Object>} Bulk schedule result
     */
    bulkSchedule: wrapApiCall(async (scheduleData) => {
        return api.post(endpoints.publishing.bulkSchedule, scheduleData)
    }, 'publishing.bulkSchedule'),

    /**
     * Schedule a single page for publication
     * @param {Object} scheduleData - Schedule data for single page
     * @returns {Promise<Object>} Schedule result
     */
    schedule: wrapApiCall(async (scheduleData) => {
        return api.post(endpoints.publishing.schedule, scheduleData)
    }, 'publishing.schedule'),

    /**
     * Get publication status for pages
     * @param {Object} params - Query parameters for filtering
     * @returns {Promise<Object>} Publication status response
     */
    getPublicationStatus: wrapApiCall(async (params = {}) => {
        const queryString = buildQueryParams(params)
        return api.get(`${endpoints.pages.publicationStatus}${queryString}`)
    }, 'publishing.getPublicationStatus'),

    /**
     * Publish a single page
     * @param {number} pageId - Page ID to publish
     * @returns {Promise<Object>} Publish result
     */
    publishPage: wrapApiCall(async (pageId) => {
        return api.post(endpoints.pages.publish(pageId))
    }, 'publishing.publishPage'),

    /**
     * Unpublish a single page
     * @param {number} pageId - Page ID to unpublish
     * @returns {Promise<Object>} Unpublish result
     */
    unpublishPage: wrapApiCall(async (pageId) => {
        return api.post(endpoints.pages.unpublish(pageId))
    }, 'publishing.unpublishPage')
}

export default publishingApi