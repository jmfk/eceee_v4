/**
 * API Utilities
 * 
 * Common utility functions for API operations:
 * - Error handling standardization
 * - Response processing
 * - Parameter building
 */

import { extractErrorMessage } from '../utils/errorHandling.js'

/**
 * Standard API error handler
 * @param {Error} error - The error object
 * @param {string} defaultMessage - Default message if error extraction fails
 * @param {Object} context - Additional context for error reporting
 * @returns {Error} Processed error with consistent message
 */
export const handleApiError = (error, defaultMessage = 'API request failed', context = {}) => {
    const message = extractErrorMessage(error, defaultMessage)

    // Log error with context for debugging
    console.error('API Error:', {
        message,
        originalError: error,
        context,
        timestamp: new Date().toISOString()
    })

    // Return a new error with consistent structure
    const processedError = new Error(message)
    processedError.originalError = error
    processedError.context = context

    return processedError
}

/**
 * Build query parameters string from object
 * @param {Object} params - Parameters object
 * @returns {string} URL query string
 */
export const buildQueryParams = (params = {}) => {
    const searchParams = new URLSearchParams()

    Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            // Handle arrays by adding multiple entries
            if (Array.isArray(value)) {
                value.forEach(item => searchParams.append(key, item))
            } else {
                searchParams.append(key, value)
            }
        }
    })

    const queryString = searchParams.toString()
    return queryString ? `?${queryString}` : ''
}

/**
 * Process API response data consistently
 * @param {Object} response - Axios response object
 * @returns {Object} Processed response data
 */
export const processResponse = (response) => {
    // Handle different response structures
    if (response.data) {
        return response.data
    }

    // Fallback for direct data
    return response
}

/**
 * Build endpoint URL with dynamic segments
 * @param {string} template - URL template with :param placeholders
 * @param {Object} params - Parameters to substitute
 * @returns {string} Built URL
 */
export const buildEndpoint = (template, params = {}) => {
    let url = template

    // Replace :param style placeholders
    Object.entries(params).forEach(([key, value]) => {
        url = url.replace(`:${key}`, encodeURIComponent(value))
        url = url.replace(`{${key}}`, encodeURIComponent(value))
    })

    return url
}

/**
 * Validate required parameters for API calls
 * @param {Object} params - Parameters to validate
 * @param {Array<string>} requiredFields - List of required parameter names
 * @throws {Error} If required parameters are missing
 */
export const validateRequiredParams = (params, requiredFields) => {
    const missing = requiredFields.filter(field =>
        params[field] === null || params[field] === undefined || params[field] === ''
    )

    if (missing.length > 0) {
        throw new Error(`Missing required parameters: ${missing.join(', ')}`)
    }
}

/**
 * Create a standardized API function wrapper
 * @param {Function} apiCall - The actual API call function
 * @param {string} operationName - Name of the operation for error context
 * @returns {Function} Wrapped API function with consistent error handling
 */
export const wrapApiCall = (apiCall, operationName) => {
    return async (...args) => {
        try {
            const response = await apiCall(...args);
            const processedResponse = processResponse(response);
            return processedResponse;
        } catch (error) {
            throw handleApiError(error, `${operationName} failed`, {
                operation: operationName,
                arguments: args
            });
        }
    }
}

/**
 * Common pagination parameters
 */
export const paginationDefaults = {
    page: 1,
    pageSize: 20,
    ordering: 'created_at'
}

/**
 * Build pagination parameters
 * @param {Object} options - Pagination options
 * @returns {Object} Formatted pagination parameters
 */
export const buildPaginationParams = (options = {}) => {
    return {
        page: options.page || paginationDefaults.page,
        page_size: options.pageSize || paginationDefaults.pageSize,
        ordering: options.ordering || paginationDefaults.ordering,
        ...options
    }
}