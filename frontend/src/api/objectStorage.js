/**
 * Object Storage API Client
 * 
 * Provides API methods for managing object types and instances in the object storage system.
 * Handles dynamic content types with configurable schemas and hierarchical relationships.
 */

import { api } from './client.js'

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
        return response
    },

    /**
     * Get object type by ID
     */
    async get(id) {
        const response = await api.get(`${BASE_URL}/object-types/${id}/`)
        return response
    },

    /**
     * Create new object type
     */
    async create(data) {
        const response = await api.post(`${BASE_URL}/object-types/`, data)
        return response
    },

    /**
     * Update object type
     */
    async update(id, data) {
        const response = await api.put(`${BASE_URL}/object-types/${id}/`, data)
        return response
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
        return response
    },

    /**
     * Update basic info for object type
     */
    async updateBasicInfo(id, basicInfo) {
        const response = await api.put(`${BASE_URL}/object-types/${id}/update_basic_info/`, basicInfo)
        return response
    },

    /**
     * Update widget slots for object type
     * Note: slotConfiguration is stored as-is (camelCase) since it's a JSONField
     */
    async updateSlots(id, slotConfiguration) {
        const response = await api.put(`${BASE_URL}/object-types/${id}/update_slots/`, slotConfiguration)
        return response
    },

    /**
     * Update relationships for object type
     */
    async updateRelationships(id, relationshipsData) {
        const response = await api.put(`${BASE_URL}/object-types/${id}/update_relationships/`, relationshipsData)
        return response
    },

    /**
     * Update schema for object type
     */
    async updateSchema(id, schema) {
        const response = await api.put(`${BASE_URL}/object-types/${id}/update_schema/`, schema)
        return response
    },

    /**
     * Get instances of this object type
     */
    async getInstances(id, params = {}) {
        const response = await api.get(`${BASE_URL}/object-types/${id}/instances/`, { params })
        return response
    },

    /**
     * Get only active object types
     */
    async getActive() {
        const response = await api.get(`${BASE_URL}/object-types/active/`)
        return response
    },

    /**
     * Get object types that appear in main browser grid
     */
    async getMainBrowserTypes() {
        const response = await api.get(`${BASE_URL}/object-types/main_browser_types/`)
        return response
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
        return response
    },

    /**
     * Get object instance by ID
     */
    async get(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/`)
        return response
    },

    /**
     * Create new object instance
     */
    async create(data) {
        const response = await api.post(`${BASE_URL}/objects/`, data)
        return response
    },

    /**
     * Update object instance (creates new version)
     */
    async update(id, data) {
        const response = await api.put(`${BASE_URL}/objects/${id}/`, data)
        return response
    },

    /**
     * Update current version (doesn't create new version)
     */
    async updateCurrentVersion(id, data) {
        const response = await api.put(`${BASE_URL}/objects/${id}/update_current_version/`, data)
        return response
    },

    /**
     * Update only widgets (doesn't affect other object data)
     */
    async updateWidgets(id, widgets, changeDescription = 'Widget update') {
        const response = await api.put(`${BASE_URL}/objects/${id}/update_widgets/`, {
            widgets,
            changeDescription
        })
        return response
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
        const response = await api.post(`${BASE_URL}/objects/${id}/publish/`, data)
        return response
    },

    /**
     * Get version history
     */
    async getVersions(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/versions/`)
        return response
    },

    /**
     * Get current published version for an object
     */
    async getCurrentPublishedVersion(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/current_published_version/`)
        return response
    },

    /**
     * Get children objects
     */
    async getChildren(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/children/`)
        return response
    },

    /**
     * Get all descendants
     */
    async getDescendants(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/descendants/`)
        return response
    },

    /**
     * Get ancestors
     */
    async getAncestors(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/ancestors/`)
        return response
    },

    /**
     * Get siblings
     */
    async getSiblings(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/siblings/`)
        return response
    },

    /**
     * Get entire tree
     */
    async getTree(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/tree/`)
        return response
    },

    /**
     * Get path to root
     */
    async getPathToRoot(id) {
        const response = await api.get(`${BASE_URL}/objects/${id}/path_to_root/`)
        return response
    },

    /**
     * Move object to new parent
     */
    async moveTo(id, newParentId, position = 'last-child') {
        const response = await api.post(`${BASE_URL}/objects/${id}/move_to/`, {
            newParentId,
            position
        })
        return response
    },

    /**
     * Get published objects
     */
    async getPublished(params = {}) {
        const response = await api.get(`${BASE_URL}/objects/published/`, { params })
        return response
    },

    /**
     * Get objects by type
     */
    async getByType(typeName, params = {}) {
        const allParams = { ...params, type: typeName }
        const response = await api.get(`${BASE_URL}/objects/by-type/${typeName}/`, { params: allParams })
        return response
    },

    /**
     * Get root objects
     */
    async getRoots(params = {}) {
        const response = await api.get(`${BASE_URL}/objects/roots/`, { params })
        return response
    },

    /**
     * Search objects
     */
    async search(query, params = {}) {
        const allParams = { ...params, q: query }
        const response = await api.get(`${BASE_URL}/objects/search/`, { params: allParams })
        return response
    },

    /**
     * Bulk operations
     */
    async bulkOperation(operation, objectIds) {
        const response = await api.post(`${BASE_URL}/objects/bulk-operations/`, {
            operation,
            objectIds
        })
        return response
    },

    /**
     * Get news list from multiple object types
     * @param {Array<number>} objectTypes - Array of object type IDs
     * @param {Object} params - Query parameters (limit, sort_order)
     */
    async getNewsList(objectTypes, params = {}) {
        const allParams = {
            ...params,
            object_types: objectTypes.join(',')
        }
        const response = await api.get(`${BASE_URL}/objects/news_list/`, { params: allParams })
        return response
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
        return response
    },

    /**
     * Get object version by ID
     */
    async get(id) {
        const response = await api.get(`${BASE_URL}/versions/${id}/`)
        return response
    },

    /**
     * Get versions for a specific object
     */
    async getByObject(objectId) {
        const response = await api.get(`${BASE_URL}/objects/${objectId}/versions/`)
        return response
    },

    /**
     * Update a version (e.g., to change featured status)
     */
    async update(versionId, data) {
        const response = await api.patch(`${BASE_URL}/versions/${versionId}/`, data)
        return response
    },

    /**
     * Publish a version immediately
     */
    async publish(versionId, data = {}) {
        const response = await api.post(`${BASE_URL}/versions/${versionId}/publish/`, data)
        return response
    },

    /**
     * Schedule a version for future publication
     */
    async schedule(versionId, data) {
        const response = await api.post(`${BASE_URL}/versions/${versionId}/schedule/`, data)
        return response
    },

    /**
     * Unpublish a version
     */
    async unpublish(versionId) {
        const response = await api.post(`${BASE_URL}/versions/${versionId}/unpublish/`)
        return response
    }
}

/**
 * Object Relationships API
 */
export const objectRelationshipsApi = {
    /**
     * Search for objects to reference (for object_reference fields)
     */
    async searchForReferences(params = {}) {
        const response = await api.get(`${BASE_URL}/objects/search_for_references/`, { params })
        return response
    },

    /**
     * Get object details by IDs (minimal info for chips/display)
     */
    async getObjectDetails(objectIds) {
        if (!objectIds || objectIds.length === 0) {
            return { data: [] }
        }
        // Query multiple objects by ID
        const ids = Array.isArray(objectIds) ? objectIds.join(',') : objectIds
        const response = await api.get(`${BASE_URL}/objects/`, {
            params: { id__in: ids }
        })
        return response
    },

    /**
     * Add a relationship
     */
    async addRelationship(objectId, relationshipType, relatedObjectId) {
        const response = await api.post(
            `${BASE_URL}/objects/${objectId}/add_relationship/`,
            {
                relationship_type: relationshipType,
                object_id: relatedObjectId
            }
        )
        return response
    },

    /**
     * Remove a relationship
     */
    async removeRelationship(objectId, relationshipType, relatedObjectId) {
        const response = await api.post(
            `${BASE_URL}/objects/${objectId}/remove_relationship/`,
            {
                relationship_type: relationshipType,
                object_id: relatedObjectId
            }
        )
        return response
    },

    /**
     * Set all relationships of a type
     */
    async setRelationships(objectId, relationshipType, objectIds) {
        const response = await api.put(
            `${BASE_URL}/objects/${objectId}/set_relationships/`,
            {
                relationship_type: relationshipType,
                object_ids: objectIds
            }
        )
        return response
    },

    /**
     * Get related objects
     */
    async getRelatedObjects(objectId, relationshipType = null) {
        const params = relationshipType ? { relationship_type: relationshipType } : {}
        const response = await api.get(
            `${BASE_URL}/objects/${objectId}/related_objects/`,
            { params }
        )
        return response
    },

    /**
     * Get reverse relationships (related_from)
     */
    async getRelatedFromObjects(objectId, relationshipType = null) {
        const params = relationshipType ? { relationship_type: relationshipType } : {}
        const response = await api.get(
            `${BASE_URL}/objects/${objectId}/related_from_objects/`,
            { params }
        )
        return response
    }
}

// Export all APIs
export default {
    objectTypes: objectTypesApi,
    objectInstances: objectInstancesApi,
    objectVersions: objectVersionsApi,
    objectRelationships: objectRelationshipsApi
}
