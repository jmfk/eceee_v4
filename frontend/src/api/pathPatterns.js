/**
 * Path Patterns API
 * 
 * API client for accessing the path pattern registry.
 * Path patterns are predefined regex patterns for dynamic URL matching.
 */

import apiClient from './client';

/**
 * Fetch all registered path patterns
 * @param {number|string} pageId - Optional page ID to contextualize example URLs
 * @returns {Promise<Array>} Array of path pattern objects
 */
export const fetchPathPatterns = async (pageId = null) => {
    const params = pageId ? { page_id: pageId } : {};
    const response = await apiClient.get('/api/v1/webpages/path-patterns/', { params });
    return response.data.patterns || [];
};

/**
 * Fetch a specific path pattern by key
 * @param {string} patternKey - The pattern key
 * @returns {Promise<Object>} Path pattern object
 */
export const fetchPathPattern = async (patternKey) => {
    const response = await apiClient.get(`/api/v1/webpages/path-patterns/${patternKey}/`);
    return response.data;
};

/**
 * Validate a path against a specific pattern
 * @param {string} patternKey - The pattern key
 * @param {string} path - The URL path to validate
 * @returns {Promise<Object>} Validation result with extracted variables
 */
export const validatePath = async (patternKey, path) => {
    const response = await apiClient.post(
        `/api/v1/webpages/path-patterns/${patternKey}/validate/`,
        { path }
    );
    return response.data;
};

