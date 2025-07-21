import { api } from './client.js'

const API_BASE = '/api/v1/webpages'

/**
 * Page Tree Management API
 * Provides functions for hierarchical page management with lazy loading
 */

// Get root pages (pages without parent)
export const getRootPages = async (filters = {}) => {
    const params = new URLSearchParams({
        parent_isnull: 'true',
        ordering: 'sort_order,title',
        ...filters
    })
    const response = await api.get(`${API_BASE}/pages/?${params}`)
    return response.data
}

// Get children of a specific page
export const getPageChildren = async (pageId, filters = {}) => {
    const params = new URLSearchParams({
        parent: pageId,
        ordering: 'sort_order,title',
        ...filters
    })
    const response = await api.get(`${API_BASE}/pages/?${params}`)
    return response.data
}

// Get complete page tree (for small hierarchies)
export const getPageTree = async () => {
    const response = await api.get(`${API_BASE}/pages/tree/`)
    return response.data
}

// Get a specific page
export const getPage = async (pageId) => {
    const response = await api.get(`${API_BASE}/pages/${pageId}/`)
    return response.data
}

// Create a new page
export const createPage = async (pageData) => {
    const response = await api.post(`${API_BASE}/pages/`, pageData)
    return response.data
}

// Update a page
export const updatePage = async (pageId, pageData) => {
    const response = await api.patch(`${API_BASE}/pages/${pageId}/`, pageData)
    return response.data
}

// Delete a page
export const deletePage = async (pageId) => {
    const response = await api.delete(`${API_BASE}/pages/${pageId}/`)
    return response.data
}

// Move a page to a different parent and/or sort order
export const movePage = async (pageId, parentId = null, sortOrder = 0) => {
    const response = await api.post(`${API_BASE}/pages/${pageId}/move/`, {
        parent_id: parentId,
        sort_order: sortOrder
    })
    return response.data
}

// Get page with children count for tree display
export const getPageWithChildrenCount = async (pageId) => {
    const response = await api.get(`${API_BASE}/pages/${pageId}/`)
    return response.data
}

// Bulk operations
export const bulkUpdatePages = async (updates) => {
    const promises = updates.map(update =>
        updatePage(update.id, update.data)
    )
    return Promise.all(promises)
}

// Search pages
export const searchPages = async (query, filters = {}) => {
    const params = new URLSearchParams({
        search: query,
        ...filters
    })
    const response = await api.get(`${API_BASE}/pages/?${params}`)
    return response.data
}

// Get page hierarchy path (breadcrumbs)
export const getPagePath = async (pageId) => {
    // This would need to be implemented on the backend
    // For now, we'll build it client-side by walking up the parent chain
    const page = await getPage(pageId)
    const path = [page]

    let current = page
    while (current.parent) {
        current = await getPage(current.parent.id)
        path.unshift(current)
    }

    return path
}

// Utility functions for tree management
export const pageTreeUtils = {
    // Check if a page has children (based on children_count)
    hasChildren: (page) => {
        return page.children_count > 0
    },

    // Check if a page can be moved to another parent (prevent circular references)
    canMoveTo: (pageId, targetParentId) => {
        // This is a simplified check - full validation should be done on backend
        return pageId !== targetParentId
    },

    // Calculate new sort order for inserting between items
    calculateSortOrder: (items, insertIndex) => {
        if (insertIndex === 0) {
            return items.length > 0 ? items[0].sort_order - 1 : 0
        }
        if (insertIndex >= items.length) {
            return items.length > 0 ? items[items.length - 1].sort_order + 1 : 0
        }

        const before = items[insertIndex - 1]
        const after = items[insertIndex]
        return Math.floor((before.sort_order + after.sort_order) / 2)
    },

    // Calculate sort order for pasting above a specific page
    calculateSortOrderAbove: (siblings, targetPage) => {
        const targetIndex = siblings.findIndex(page => page.id === targetPage.id)
        if (targetIndex === 0) {
            // Insert at the beginning
            return targetPage.sort_order - 1
        } else {
            // Insert between previous page and target
            const previousPage = siblings[targetIndex - 1]
            return Math.floor((previousPage.sort_order + targetPage.sort_order) / 2)
        }
    },

    // Calculate sort order for pasting below a specific page
    calculateSortOrderBelow: (siblings, targetPage) => {
        const targetIndex = siblings.findIndex(page => page.id === targetPage.id)
        if (targetIndex === siblings.length - 1) {
            // Insert at the end
            return targetPage.sort_order + 1
        } else {
            // Insert between target and next page
            const nextPage = siblings[targetIndex + 1]
            return Math.floor((targetPage.sort_order + nextPage.sort_order) / 2)
        }
    },

    // Format page for tree display
    formatPageForTree: (page) => ({
        ...page,
        isExpanded: false,
        isLoading: false,
        children: [],
        childrenLoaded: false
    })
} 