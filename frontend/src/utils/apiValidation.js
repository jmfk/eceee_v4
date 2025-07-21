/**
 * API Response Validation Utilities
 * Ensures API responses match our expected structure
 */

/**
 * Validates that a page object has all required fields
 * @param {any} page - Page object to validate
 * @returns {boolean} True if valid
 */
export function isValidPageResponse(page) {
    if (!page || typeof page !== 'object') {
        return false;
    }

    const requiredFields = ['id', 'title', 'slug', 'sort_order', 'publication_status'];

    for (const field of requiredFields) {
        if (!(field in page)) {
            console.warn(`Missing required field: ${field}`, page);
            return false;
        }
    }

    // Validate types
    if (typeof page.id !== 'number') {
        console.warn('Invalid id type:', typeof page.id, page);
        return false;
    }

    if (typeof page.title !== 'string') {
        console.warn('Invalid title type:', typeof page.title, page);
        return false;
    }

    if (typeof page.slug !== 'string') {
        console.warn('Invalid slug type:', typeof page.slug, page);
        return false;
    }

    // Ensure hostnames is an array
    if ('hostnames' in page && !Array.isArray(page.hostnames)) {
        console.warn('Invalid hostnames type (should be array):', typeof page.hostnames, page);
        return false;
    }

    return true;
}

/**
 * Validates a paginated API response
 * @param {any} response - Response to validate
 * @returns {boolean} True if valid
 */
export function isValidPaginatedResponse(response) {
    if (!response || typeof response !== 'object') {
        return false;
    }

    if (!('results' in response) || !Array.isArray(response.results)) {
        console.warn('Invalid paginated response - missing or invalid results array', response);
        return false;
    }

    if (!('count' in response) || typeof response.count !== 'number') {
        console.warn('Invalid paginated response - missing or invalid count', response);
        return false;
    }

    return true;
}

/**
 * Sanitizes page data to ensure consistent structure
 * @param {any} page - Raw page data
 * @returns {object} Sanitized page data
 */
export function sanitizePageData(page) {
    if (!page) return null;

    return {
        ...page,
        // Ensure hostnames is always an array
        hostnames: Array.isArray(page.hostnames) ? page.hostnames : [],
        // Ensure children_count is a number
        children_count: typeof page.children_count === 'number' ? page.children_count : 0,
        // Ensure sort_order is a number
        sort_order: typeof page.sort_order === 'number' ? page.sort_order : 0,
        // Ensure parent is properly handled
        parent: page.parent || null,
        parent_id: page.parent_id || null,
    };
}

/**
 * Validates and sanitizes a list of pages
 * @param {any[]} pages - Array of page objects
 * @returns {object[]} Array of sanitized pages
 */
export function sanitizePageList(pages) {
    if (!Array.isArray(pages)) {
        console.warn('Expected array of pages, got:', typeof pages);
        return [];
    }

    return pages
        .filter(page => {
            const isValid = isValidPageResponse(page);
            if (!isValid) {
                console.warn('Filtering out invalid page:', page);
            }
            return isValid;
        })
        .map(sanitizePageData);
}

/**
 * Type guard to check if object has hostnames array
 * @param {any} obj - Object to check
 * @returns {boolean} True if object has hostnames array
 */
export function hasHostnamesArray(obj) {
    return obj && typeof obj === 'object' && Array.isArray(obj.hostnames);
}

/**
 * Gets the first hostname from a page, or null if none
 * @param {object} page - Page object
 * @returns {string|null} First hostname or null
 */
export function getFirstHostname(page) {
    if (!hasHostnamesArray(page) || page.hostnames.length === 0) {
        return null;
    }
    return page.hostnames[0];
}

/**
 * Checks if a page is a root page (no parent)
 * @param {object} page - Page object
 * @returns {boolean} True if root page
 */
export function isRootPage(page) {
    return !page.parent && !page.parent_id;
}

/**
 * Formats hostname display text for UI
 * @param {object} page - Page object
 * @returns {string} Display text for hostname/slug
 */
export function getPageDisplayUrl(page) {
    if (isRootPage(page)) {
        const firstHostname = getFirstHostname(page);
        return firstHostname || '(hostname missing)';
    }
    return `/${page.slug}`;
} 