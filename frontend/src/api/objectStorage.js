/**
 * Object Storage API Client
 * 
 * Provides API methods for managing object types and instances in the object storage system.
 * Handles dynamic content types with configurable schemas and hierarchical relationships.
 */

import { api } from './client.js'
import { convertKeysToCamel, convertKeysToSnake } from '../utils/caseConversion.js'

const BASE_URL = '/api/v1/objects/api'

/**
 * Object Type Definition API
 */
export const objectTypesApi = {
    /**
     * List all object types
     */
    async list(params = {}) {
        const response = await api.get(`${BASE_URL}/object-types/`, { params })
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get object type by ID
     */
    async get(id) {
        const response = await api.get(`${BASE_URL}/object-types/${id}/`)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Create new object type
     */
    async create(data) {
        // Always handle as JSON data - image uploads are handled separately
        const snakeCaseData = convertKeysToSnake(data)

        // Handle allowed_child_types special case for backend compatibility
        if (snakeCaseData.allowed_child_types) {
            snakeCaseData.allowed_child_types_input = snakeCaseData.allowed_child_types
            delete snakeCaseData.allowed_child_types
        }

        const response = await api.post(`${BASE_URL}/object-types/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Update object type
     */
    async update(id, data) {
        // Always handle as JSON data - image uploads are handled separately
        const snakeCaseData = convertKeysToSnake(data)

        // Handle allowed_child_types special case for backend compatibility
        if (snakeCaseData.allowed_child_types) {
            snakeCaseData.allowed_child_types_input = snakeCaseData.allowed_child_types
            delete snakeCaseData.allowed_child_types
        }

        const response = await api.put(`${BASE_URL}/object-types/${id}/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Delete object type
     */
    async delete(id) {
        return await api.delete(`${BASE_URL}/object-types/${id}/`)
    },

    /**
     * Get schema for object type
     */
    async getSchema(id) {
        const response = await api.get(`${BASE_URL}/object-types/${id}/schema/`)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Update basic info for object type
     */
    async updateBasicInfo(id, basicInfo) {
        const snakeCaseData = convertKeysToSnake(basicInfo)
        const response = await api.put(`${BASE_URL}/object-types/${id}/update_basic_info/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Update widget slots for object type
     */
    async updateSlots(id, slotConfiguration) {
        const snakeCaseData = convertKeysToSnake(slotConfiguration)
        const response = await api.put(`${BASE_URL}/object-types/${id}/update_slots/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Update relationships for object type
     */
    async updateRelationships(id, relationshipsData) {
        const snakeCaseData = convertKeysToSnake(relationshipsData)
        const response = await api.put(`${BASE_URL}/object-types/${id}/update_relationships/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Update schema for object type
     */
    async updateSchema(id, schema) {
        const snakeCaseSchema = convertKeysToSnake(schema)
        const response = await api.put(`${BASE_URL}/object-types/${id}/update_schema/`, snakeCaseSchema)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Get instances of this object type
     */
    async getInstances(id, params = {}) {
        const response = await api.get(`${BASE_URL}/object-types/${id}/instances/`, { params })
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get only active object types
     */
    async getActive() {
        const response = await api.get(`${BASE_URL}/object-types/active/`)
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get object types that appear in main browser grid
     */
    async getMainBrowserTypes() {
        const response = await api.get(`${BASE_URL}/object-types/main_browser_types/`)
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    }
}

/**
 * Object Instance API
 */
export const objectInstancesApi = {
    /**
     * List all object instances
     */
    async list(params = {}) {
        const response = await api.get(`${BASE_URL}/objects/`, { params })
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get object instance by ID
     */
    async get(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/`)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Create new object instance
     */
    async create(data) {
        const snakeCaseData = convertKeysToSnake(data)
        const response = await api.post(`${BASE_URL}/objects/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Update object instance (creates new version)
     */
    async update(id, data) {
        const snakeCaseData = convertKeysToSnake(data)
        const response = await api.put(`${BASE_URL}/objects/${id}/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Update current version (doesn't create new version)
     */
    async updateCurrentVersion(id, data) {
        const snakeCaseData = convertKeysToSnake(data)
        const response = await api.put(`${BASE_URL}/objects/${id}/update_current_version/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Update only widgets (doesn't affect other object data)
     */
    async updateWidgets(id, widgets, changeDescription = 'Widget update') {
        const response = await api.put(`${BASE_URL}/objects/${id}/update_widgets/`, {
            widgets,
            change_description: changeDescription
        })
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Delete object instance
     */
    async delete(id) {
        return await api.delete(`${BASE_URL}/objects/${id}/`)
    },

    /**
     * Publish object instance
     */
    async publish(id, data = {}) {
        const snakeCaseData = convertKeysToSnake(data)
        const response = await api.post(`${BASE_URL}/objects/${id}/publish/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Get version history
     */
    async getVersions(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/versions/`)
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get children objects
     */
    async getChildren(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/children/`)
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get all descendants
     */
    async getDescendants(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/descendants/`)
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get ancestors
     */
    async getAncestors(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/ancestors/`)
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get siblings
     */
    async getSiblings(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/siblings/`)
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get entire tree
     */
    async getTree(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/tree/`)
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get path to root
     */
    async getPathToRoot(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/path_to_root/`)
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Move object to new parent
     */
    async moveTo(id, newParentId, position = 'last-child') {
        const data = {
            newParentId,
            position
        }
        const snakeCaseData = convertKeysToSnake(data)
        const response = await api.post(`${BASE_URL}/objects/${id}/move_to/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    },

    /**
     * Get published objects
     */
    async getPublished(params = {}) {
        const response = await api.get(`${BASE_URL}/objects/published/`, { params })
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get objects by type
     */
    async getByType(typeName, params = {}) {
        const allParams = { ...params, type: typeName }
        const response = await api.get(`${BASE_URL}/objects/by-type/${typeName}/`, { params: allParams })
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get root objects
     */
    async getRoots(params = {}) {
        const response = await api.get(`${BASE_URL}/objects/roots/`, { params })
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Search objects
     */
    async search(query, params = {}) {
        const allParams = { ...params, q: query }
        const response = await api.get(`${BASE_URL}/objects/search/`, { params: allParams })
        return {
            ...response,
            data: response.data.results ? {
                ...convertKeysToCamel(response.data),
                results: response.data.results.map(convertKeysToCamel)
            } : (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Bulk operations
     */
    async bulkOperation(operation, objectIds) {
        const data = {
            operation,
            objectIds
        }
        const snakeCaseData = convertKeysToSnake(data)
        const response = await api.post(`${BASE_URL}/objects/bulk-operations/`, snakeCaseData)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    }
}

/**
 * Object Version API
 */
export const objectVersionsApi = {
    /**
     * List all object versions
     */
    async list(params = {}) {
        const response = await api.get(`${BASE_URL}/versions/`, { params })
        return {
            ...response,
            data: (response.data.results || response.data).map(convertKeysToCamel)
        }
    },

    /**
     * Get object version by ID
     */
    async get(id) {
        const response = await api.get(`${BASE_URL}/versions/${id}/`)
        return {
            ...response,
            data: convertKeysToCamel(response.data)
        }
    }
}

// Export all APIs
export default {
    objectTypes: objectTypesApi,
    objectInstances: objectInstancesApi,
    objectVersions: objectVersionsApi
}
