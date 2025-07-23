import { api } from './client.js'

/**
 * Namespace API client
 * Provides methods for managing content namespaces
 */

export const namespacesApi = {
    /**
     * Get all namespaces with optional filtering
     */
    list: async (params = {}) => {
        const response = await api.get('/api/v1/namespaces/', { params })
        return response.data
    },

    /**
     * Get a single namespace by ID
     */
    get: async (id) => {
        const response = await api.get(`/api/v1/namespaces/${id}/`)
        return response.data
    },

    /**
     * Create a new namespace
     */
    create: async (namespaceData) => {
        const response = await api.post('/api/v1/namespaces/', namespaceData)
        return response.data
    },

    /**
     * Update an existing namespace
     */
    update: async (id, namespaceData) => {
        const response = await api.patch(`/api/v1/namespaces/${id}/`, namespaceData)
        return response.data
    },

    /**
     * Delete a namespace
     */
    delete: async (id) => {
        const response = await api.delete(`/api/v1/namespaces/${id}/`)
        return response.data
    },

    /**
     * Set a namespace as default
     */
    setAsDefault: async (id) => {
        const response = await api.post(`/api/v1/namespaces/${id}/set_as_default/`)
        return response.data
    },

    /**
     * Get content summary for a namespace
     */
    getContentSummary: async (id) => {
        const response = await api.post(`/api/v1/namespaces/${id}/get_content_summary/`)
        return response.data
    },

    /**
     * Get the default namespace
     */
    getDefault: async () => {
        const response = await api.get('/api/v1/namespaces/', {
            params: { is_default: true }
        })
        return response.data.results?.[0] || null
    },

    /**
     * Get active namespaces only
     */
    getActive: async () => {
        const response = await api.get('/api/v1/namespaces/', {
            params: { is_active: true }
        })
        return response.data
    }
}

export default namespacesApi 