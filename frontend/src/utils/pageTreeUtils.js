/**
 * Page Tree Utilities
 * 
 * Utility functions for managing page tree operations, formatting, and calculations
 */

/**
 * Format a page object for tree display
 * @param {Object} page - Raw page object from API
 * @returns {Object} Formatted page object for tree display
 */
export const formatPageForTree = (page) => {
    if (!page) return null

    // Check children count from API (supports both camelCase and snake_case)
    const childrenCount = page.childrenCount || page.children_count || 0
    const hasChildrenFromCount = childrenCount > 0
    const hasChildrenFromArray = Boolean(page.children && page.children.length > 0)

    return {
        id: page.id,
        title: page.title,
        slug: page.slug,
        parent: page.parent,
        sort_order: page.sort_order,
        children: page.children || [],
        hasChildren: hasChildrenFromCount || hasChildrenFromArray,
        childrenCount: childrenCount,
        childrenLoaded: hasChildrenFromArray, // True if children array is populated
        isExpanded: false,
        isLoading: false,
        // Preserve all original page data
        ...page
    }
}

/**
 * Check if a page has children
 * @param {Object} page - Page object
 * @returns {boolean} Whether the page has children
 */
export const hasChildren = (page) => {
    // Check children_count from API first (before children are loaded)
    const childrenCount = page?.childrenCount || page?.children_count || 0
    if (childrenCount > 0) {
        return true
    }
    
    // Fallback to checking loaded children array
    return Boolean(page?.children && page.children.length > 0)
}

/**
 * Calculate sort order for placing a page above another page
 * @param {Array} siblings - Array of sibling pages
 * @param {Object} targetPage - Page to place above
 * @returns {number} Calculated sort order
 */
export const calculateSortOrderAbove = (siblings = [], targetPage) => {
    if (!targetPage || !siblings.length) {
        return 0
    }

    const targetSortOrder = targetPage.sort_order || 0
    const abovePage = siblings.find(sibling =>
        (sibling.sort_order || 0) < targetSortOrder
    )

    if (abovePage) {
        // Place between the above page and target page
        return Math.floor(((abovePage.sort_order || 0) + targetSortOrder) / 2)
    } else {
        // Place before the target page
        return Math.max(0, targetSortOrder - 10)
    }
}

/**
 * Calculate sort order for placing a page below another page
 * @param {Array} siblings - Array of sibling pages
 * @param {Object} targetPage - Page to place below
 * @returns {number} Calculated sort order
 */
export const calculateSortOrderBelow = (siblings = [], targetPage) => {
    if (!targetPage) {
        return siblings.length > 0 ? Math.max(...siblings.map(s => s.sort_order || 0)) + 10 : 10
    }

    const targetSortOrder = targetPage.sort_order || 0
    const belowPage = siblings.find(sibling =>
        (sibling.sort_order || 0) > targetSortOrder
    )

    if (belowPage) {
        // Place between target page and below page
        return Math.floor((targetSortOrder + (belowPage.sort_order || 0)) / 2)
    } else {
        // Place after the target page
        return targetSortOrder + 10
    }
}

/**
 * Find a page in the tree by ID
 * @param {Array} pages - Array of pages
 * @param {number} pageId - Page ID to find
 * @returns {Object|null} Found page or null
 */
export const findPageInTree = (pages, pageId) => {
    for (const page of pages) {
        if (page.id === pageId) {
            return page
        }
        if (page.children && page.children.length > 0) {
            const found = findPageInTree(page.children, pageId)
            if (found) return found
        }
    }
    return null
}

/**
 * Update a page in the tree
 * @param {Array} pages - Array of pages
 * @param {number} pageId - Page ID to update
 * @param {Object} updates - Updates to apply
 * @returns {Array} Updated pages array
 */
export const updatePageInTree = (pages, pageId, updates) => {
    return pages.map(page => {
        if (page.id === pageId) {
            return { ...page, ...updates }
        }
        if (page.children && page.children.length > 0) {
            return {
                ...page,
                children: updatePageInTree(page.children, pageId, updates)
            }
        }
        return page
    })
}

/**
 * Default export with all utilities
 */
const pageTreeUtils = {
    formatPageForTree,
    hasChildren,
    calculateSortOrderAbove,
    calculateSortOrderBelow,
    findPageInTree,
    updatePageInTree
}

export default pageTreeUtils
