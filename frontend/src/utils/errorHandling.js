/**
 * Utility functions for consistent error handling across the application
 */

/**
 * Extract user-friendly error message from various error formats
 * @param {Error|Object|string} error - The error object or string
 * @param {string} defaultMessage - Default message if no user-friendly message is found
 * @returns {string} User-friendly error message
 */
export const extractErrorMessage = (error, defaultMessage = 'An error occurred') => {
    if (!error) {
        return defaultMessage
    }

    if (typeof error === 'string') {
        return error
    }

    if (error && typeof error === 'object') {
        // Prioritize API response detail field (most common for 400 errors)
        if (error.response?.data?.detail) {
            return error.response.data.detail
        }

        // Check for structured errors array (media upload format)
        if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
            const errors = error.response.data.errors
            if (errors.length > 0) {
                const firstError = errors[0]
                let errorMessage = firstError.error || firstError.message || 'Unknown error'

                // Make duplicate file errors more user-friendly
                if (errorMessage.includes('duplicate key value violates unique constraint') &&
                    errorMessage.includes('file_hash')) {
                    errorMessage = 'This file already exists in the system (identical file detected)'
                }

                if (firstError.filename) {
                    return `${firstError.filename}: ${errorMessage}`
                }
                return errorMessage
            }
        }

        // Check for field-specific validation errors (e.g., {"slug": ["error message"]})
        if (error.response?.data && typeof error.response.data === 'object') {
            const data = error.response.data
            // Look for field-specific errors
            for (const [field, messages] of Object.entries(data)) {
                if (Array.isArray(messages) && messages.length > 0) {
                    return `${field}: ${messages[0]}`
                }
            }
        }

        // Check for other common API error field names
        if (error.response?.data?.message) {
            return error.response.data.message
        }

        if (error.response?.data?.error) {
            return error.response.data.error
        }

        // Check for non-nested error fields
        if (error.detail) {
            return error.detail
        }

        if (error.message) {
            return error.message
        }

        if (error.error) {
            return error.error
        }
    }

    return defaultMessage
}

/**
 * Create a standardized error handler for React Query mutations
 * @param {Function} notificationHandler - Notification function (e.g., addNotification from GlobalNotificationContext)
 * @param {string} defaultMessage - Default error message
 * @returns {Function} Error handler function
 */
export const createErrorHandler = (notificationHandler, defaultMessage = 'An error occurred', category = 'error') => {
    return (error) => {
        const message = extractErrorMessage(error, defaultMessage)
        notificationHandler(message, 'error', category)
    }
} 