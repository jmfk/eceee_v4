/**
 * Value Lists API Client
 * 
 * API client for managing value lists and their items.
 * Used to populate selection fields with centrally managed options.
 */

import apiClient from './client'

const API_BASE = '/api/v1/utils'

/**
 * Value Lists API
 */
export const valueListsApi = {
    /**
     * Get all value lists
     */
    list: async () => {
        const response = await apiClient.get(`${API_BASE}/value-lists/`)
        return response.data
    },

    /**
     * Get a specific value list by ID
     */
    get: async (id) => {
        const response = await apiClient.get(`${API_BASE}/value-lists/${id}/`)
        return response.data
    },

    /**
     * Create a new value list
     */
    create: async (data) => {
        const response = await apiClient.post(`${API_BASE}/value-lists/`, data)
        return response.data
    },

    /**
     * Update a value list
     */
    update: async (id, data) => {
        const response = await apiClient.patch(`${API_BASE}/value-lists/${id}/`, data)
        return response.data
    },

    /**
     * Delete a value list
     */
    delete: async (id) => {
        const response = await apiClient.delete(`${API_BASE}/value-lists/${id}/`)
        return response.status === 204
    },

    /**
     * Get items for a specific value list
     */
    getItems: async (id) => {
        const response = await apiClient.get(`${API_BASE}/value-lists/${id}/items/`)
        return response.data
    },

    /**
     * Add an item to a value list
     */
    addItem: async (valueListId, itemData) => {
        const response = await apiClient.post(`${API_BASE}/value-lists/${valueListId}/add_item/`, itemData)
        return response.data
    },

    /**
     * Remove an item from a value list
     */
    removeItem: async (valueListId, itemId) => {
        const response = await apiClient.delete(`${API_BASE}/value-lists/${valueListId}/remove_item/`, {
            data: { item_id: itemId }
        })
        return response.status === 204
    },

    /**
     * Reorder items in a value list
     */
    reorderItems: async (valueListId, itemOrders) => {
        const response = await apiClient.post(`${API_BASE}/value-lists/${valueListId}/reorder_items/`, {
            item_orders: itemOrders
        })
        return response.data
    },

    /**
     * Get value lists suitable for form fields
     */
    getForFields: async () => {
        const response = await apiClient.get(`${API_BASE}/value-lists-for-field/`)
        return response.data
    }
}

/**
 * Value List Items API (for direct item management)
 */
export const valueListItemsApi = {
    /**
     * Update a value list item
     */
    update: async (itemId, data) => {
        const response = await apiClient.patch(`${API_BASE}/value-list-items/${itemId}/`, data)
        return response.data
    },

    /**
     * Delete a value list item
     */
    delete: async (itemId) => {
        const response = await apiClient.delete(`${API_BASE}/value-list-items/${itemId}/`)
        return response.status === 204
    }
}

export default valueListsApi
