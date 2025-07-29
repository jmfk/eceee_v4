import { api } from './client.js'

const API_BASE = '/api/v1/webpages'

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

// Get root pages (pages without parent)
/**
 * @param {PageFilters} filters - Query filters
 * @returns {Promise<PaginatedResponse<WebPageTreeResponse>>}
 */
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

// Update page widgets (creates new version) - DEPRECATED: Use savePageWithWidgets instead
export const updatePageWidgets = async (pageId, widgets, options = {}) => {
    console.warn('updatePageWidgets is deprecated, use savePageWithWidgets for better performance and consistency');
    const response = await api.post(`${API_BASE}/pages/${pageId}/update_widgets/`, {
        widgets,
        description: options.description || 'Widget update',
        auto_publish: options.autoPublish || false
    })
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

// NEW: Unified save function (page data + widgets in one call)
export const savePageWithWidgets = async (pageId, pageData = {}, widgets = null, options = {}) => {
    const payload = {
        ...pageData,  // page metadata (title, slug, description, etc.)
    };

    // Add widgets if provided
    if (widgets !== null) {
        payload.widgets = widgets;
    }

    // Add version options if widgets are being saved
    if (widgets !== null || options.description || options.autoPublish !== undefined) {
        payload.version_options = {
            description: options.description || 'Unified save from frontend',
            auto_publish: options.autoPublish || false
        };
    }

    console.log('🔄 API: Unified save payload:', payload);
    const response = await api.patch(`${API_BASE}/pages/${pageId}/`, payload);
    console.log('✅ API: Unified save response:', response.data);
    return response.data;
};

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

// Comprehensive search across all pages with hierarchy context
export const searchAllPages = async (query, filters = {}) => {
    const params = new URLSearchParams({
        search: query,
        include_hierarchy: 'true', // Request hierarchy information
        ...filters
    })
    const response = await api.get(`${API_BASE}/pages/search_all/?${params}`)
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
        // Simple hint: use target's sort_order - 1
        // Backend will normalize to proper spacing
        return targetPage.sort_order - 1
    },

    // Calculate sort order for pasting below a specific page
    calculateSortOrderBelow: (siblings, targetPage) => {
        // Simple hint: use target's sort_order + 1
        // Backend will normalize to proper spacing
        return targetPage.sort_order + 1
    },

    // Format page for tree display
    /**
     * @param {WebPageTreeResponse} page - Raw page data from API
     * @returns {WebPageTreeResponse} Formatted page for tree display
     */
    formatPageForTree: (page) => ({
        ...page,
        // Ensure hostnames is always an array
        hostnames: Array.isArray(page.hostnames) ? page.hostnames : [],
        isExpanded: false,
        isLoading: false,
        children: [],
        childrenLoaded: false
    })
} 