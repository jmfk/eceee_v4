import { api } from './client.js'
import { wrapApiCall, buildQueryParams } from './utils.js'

/**
 * Namespace API client
 * Provides methods for managing content namespaces
 */

export const namespacesApi = {
    /**
     * Get all namespaces with optional filtering
     */
    list: wrapApiCall(async (params = {}) => {
        const queryString = buildQueryParams(params)
        return api.get(`/api/v1/namespaces/${queryString}`)
    }, 'namespaces.list'),

    /**
     * Get a single namespace by ID
     */
    get: wrapApiCall(async (id) => {
        return api.get(`/api/v1/namespaces/${id}/`)
    }, 'namespaces.get'),

    /**
     * Create a new namespace
     */
    create: wrapApiCall(async (namespaceData) => {
        return api.post('/api/v1/namespaces/', namespaceData)
    }, 'namespaces.create'),

    /**
     * Update an existing namespace
     */
    update: wrapApiCall(async (id, namespaceData) => {
        return api.patch(`/api/v1/namespaces/${id}/`, namespaceData)
    }, 'namespaces.update'),

    /**
     * Delete a namespace
     */
    delete: wrapApiCall(async (id) => {
        return api.delete(`/api/v1/namespaces/${id}/`)
    }, 'namespaces.delete'),

    /**
     * Set a namespace as default
     */
    setAsDefault: wrapApiCall(async (id) => {
        return api.post(`/api/v1/namespaces/${id}/set_as_default/`)
    }, 'namespaces.setAsDefault'),

    /**
     * Get content summary for a namespace
     */
    getContentSummary: wrapApiCall(async (id) => {
        return api.post(`/api/v1/namespaces/${id}/get_content_summary/`)
    }, 'namespaces.getContentSummary'),

    /**
     * Get the default namespace
     */
    getDefault: wrapApiCall(async () => {
        const params = { is_default: true }
        const queryString = buildQueryParams(params)
        const response = await api.get(`/api/v1/namespaces/${queryString}`)
        const data = response.data || response
        return data.results?.[0] || null
    }, 'namespaces.getDefault'),

    /**
     * Get active namespaces only
     */
    getActive: wrapApiCall(async () => {
        const params = { is_active: true }
        const queryString = buildQueryParams(params)
        return api.get(`/api/v1/namespaces/${queryString}`)
    }, 'namespaces.getActive')
}

export default namespacesApi 