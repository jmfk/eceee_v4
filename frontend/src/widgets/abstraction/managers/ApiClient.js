/**
 * API Client - Unified API Abstraction Layer
 * 
 * Provides a unified interface for API operations regardless
 * of whether working with pages or objects, handling response
 * transformation and error normalization.
 */

import { IApiClient } from '../interfaces'
import { SUPPORTED_CONTEXTS } from '../index'

/**
 * Base API Client Implementation
 */
export class ApiClient extends IApiClient {
    constructor(options = {}) {
        super()
        this._contextType = options.contextType
        this._baseUrl = options.baseUrl || '/api'
        this._timeout = options.timeout || 30000
        this._retryAttempts = options.retryAttempts || 3
        this._headers = {
            'Content-Type': 'application/json',
            ...options.headers
        }

        // Context-specific endpoint configurations
        this._endpoints = this._getEndpointConfig()
    }

    /**
     * Save widget changes to server
     */
    async saveWidgets(data) {
        try {
            const endpoint = this._getEndpoint('save')
            const transformedData = this.transformRequest(data)

            const response = await this._makeRequest('POST', endpoint, transformedData)
            const transformedResponse = this.transformResponse(response)

            return {
                success: true,
                data: transformedResponse,
                status: response.status
            }
        } catch (error) {
            return this._handleError(error, 'saveWidgets')
        }
    }

    /**
     * Load widget data from server
     */
    async loadWidgets(entityId) {
        try {
            const endpoint = this._getEndpoint('load', { entityId })

            const response = await this._makeRequest('GET', endpoint)
            const transformedResponse = this.transformResponse(response)

            return {
                success: true,
                data: transformedResponse,
                status: response.status
            }
        } catch (error) {
            return this._handleError(error, 'loadWidgets')
        }
    }

    /**
     * Validate widgets on server
     */
    async validateWidgets(widgets) {
        try {
            const endpoint = this._getEndpoint('validate')
            const transformedData = this.transformRequest({ widgets })

            const response = await this._makeRequest('POST', endpoint, transformedData)
            const transformedResponse = this.transformResponse(response)

            return {
                success: true,
                data: transformedResponse,
                status: response.status
            }
        } catch (error) {
            return this._handleError(error, 'validateWidgets')
        }
    }

    /**
     * Transform API response for context
     */
    transformResponse(response) {
        if (!response.data) return response

        let transformedData = { ...response.data }

        // Context-specific response transformations
        if (this._contextType === SUPPORTED_CONTEXTS.PAGE) {
            transformedData = this._transformPageResponse(transformedData)
        } else if (this._contextType === SUPPORTED_CONTEXTS.OBJECT) {
            transformedData = this._transformObjectResponse(transformedData)
        }

        // Convert snake_case to camelCase (backend uses snake_case)
        transformedData = this._convertToCamelCase(transformedData)

        return transformedData
    }

    /**
     * Transform request data for API
     */
    transformRequest(data) {
        // Convert camelCase to snake_case (backend expects snake_case)
        let transformedData = this._convertToSnakeCase(data)

        // Context-specific request transformations
        if (this._contextType === SUPPORTED_CONTEXTS.PAGE) {
            transformedData = this._transformPageRequest(transformedData)
        } else if (this._contextType === SUPPORTED_CONTEXTS.OBJECT) {
            transformedData = this._transformObjectRequest(transformedData)
        }

        return transformedData
    }

    /**
     * Get endpoint configuration for context
     */
    _getEndpointConfig() {
        const baseEndpoints = {
            [SUPPORTED_CONTEXTS.PAGE]: {
                save: '/webpages/{entityId}/versions/{versionId}/widgets',
                load: '/webpages/{entityId}/versions/{versionId}/widgets',
                validate: '/webpages/widgets/validate',
                bulk: '/webpages/widgets/bulk'
            },
            [SUPPORTED_CONTEXTS.OBJECT]: {
                save: '/objects/{entityId}/widgets',
                load: '/objects/{entityId}/widgets',
                validate: '/objects/widgets/validate',
                bulk: '/objects/widgets/bulk'
            }
        }

        return baseEndpoints[this._contextType] || {}
    }

    /**
     * Get specific endpoint with parameter substitution
     */
    _getEndpoint(operation, params = {}) {
        const template = this._endpoints[operation]
        if (!template) {
            throw new Error(`Unknown endpoint operation: ${operation}`)
        }

        let endpoint = template

        // Replace path parameters
        Object.entries(params).forEach(([key, value]) => {
            endpoint = endpoint.replace(`{${key}}`, encodeURIComponent(value))
        })

        return `${this._baseUrl}${endpoint}`
    }

    /**
     * Make HTTP request with retry logic
     */
    async _makeRequest(method, url, data = null, attempt = 1) {
        try {
            const options = {
                method,
                headers: this._headers,
                timeout: this._timeout
            }

            if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                options.body = JSON.stringify(data)
            }

            const response = await fetch(url, options)

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const responseData = await response.json()
            return {
                status: response.status,
                data: responseData,
                headers: response.headers
            }
        } catch (error) {
            // Retry logic
            if (attempt < this._retryAttempts && this._shouldRetry(error)) {
                console.warn(`Request failed, retrying (${attempt}/${this._retryAttempts}):`, error.message)
                await this._delay(Math.pow(2, attempt) * 1000) // Exponential backoff
                return this._makeRequest(method, url, data, attempt + 1)
            }

            throw error
        }
    }

    /**
     * Transform page-specific response data
     */
    _transformPageResponse(data) {
        const transformed = { ...data }

        // Handle page-specific response structure
        if (transformed.page_version_data) {
            transformed.pageVersionData = transformed.page_version_data
            delete transformed.page_version_data
        }

        if (transformed.layout_json) {
            transformed.layoutJson = transformed.layout_json
            delete transformed.layout_json
        }

        // Transform widget inheritance data
        if (transformed.widgets) {
            Object.keys(transformed.widgets).forEach(slotName => {
                transformed.widgets[slotName] = transformed.widgets[slotName].map(widget => ({
                    ...widget,
                    inherited: widget.inherited || false,
                    canInherit: widget.can_inherit !== false,
                    templateBased: widget.template_based !== false
                }))
            })
        }

        return transformed
    }

    /**
     * Transform object-specific response data
     */
    _transformObjectResponse(data) {
        const transformed = { ...data }

        // Handle object-specific response structure
        if (transformed.object_type) {
            transformed.objectType = transformed.object_type
            delete transformed.object_type
        }

        if (transformed.object_instance) {
            transformed.objectInstance = transformed.object_instance
            delete transformed.object_instance
        }

        // Transform widget control data
        if (transformed.widgets) {
            Object.keys(transformed.widgets).forEach(slotName => {
                transformed.widgets[slotName] = transformed.widgets[slotName].map(widget => ({
                    ...widget,
                    controlId: widget.control_id,
                    strictTypes: widget.strict_types !== false,
                    canInherit: false // Objects don't support inheritance
                }))
            })
        }

        return transformed
    }

    /**
     * Transform page-specific request data
     */
    _transformPageRequest(data) {
        const transformed = { ...data }

        // Handle page-specific request structure
        if (transformed.pageVersionData) {
            transformed.page_version_data = transformed.pageVersionData
            delete transformed.pageVersionData
        }

        if (transformed.layoutJson) {
            transformed.layout_json = transformed.layoutJson
            delete transformed.layoutJson
        }

        // Transform widget data for page context
        if (transformed.widgets) {
            Object.keys(transformed.widgets).forEach(slotName => {
                transformed.widgets[slotName] = transformed.widgets[slotName].map(widget => ({
                    ...widget,
                    can_inherit: widget.canInherit,
                    template_based: widget.templateBased,
                    allow_override: widget.allowOverride
                }))
            })
        }

        return transformed
    }

    /**
     * Transform object-specific request data
     */
    _transformObjectRequest(data) {
        const transformed = { ...data }

        // Handle object-specific request structure
        if (transformed.objectType) {
            transformed.object_type = transformed.objectType
            delete transformed.objectType
        }

        if (transformed.objectInstance) {
            transformed.object_instance = transformed.objectInstance
            delete transformed.objectInstance
        }

        // Transform widget data for object context
        if (transformed.widgets) {
            Object.keys(transformed.widgets).forEach(slotName => {
                transformed.widgets[slotName] = transformed.widgets[slotName].map(widget => ({
                    ...widget,
                    control_id: widget.controlId,
                    strict_types: widget.strictTypes,
                    object_type_id: widget.objectTypeId,
                    object_instance_id: widget.objectInstanceId
                }))
            })
        }

        return transformed
    }

    /**
     * Convert object keys to camelCase
     */
    _convertToCamelCase(obj) {
        if (obj === null || typeof obj !== 'object') return obj
        if (Array.isArray(obj)) return obj.map(item => this._convertToCamelCase(item))

        const camelCased = {}
        Object.keys(obj).forEach(key => {
            const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
            camelCased[camelKey] = this._convertToCamelCase(obj[key])
        })

        return camelCased
    }

    /**
     * Convert object keys to snake_case
     */
    _convertToSnakeCase(obj) {
        if (obj === null || typeof obj !== 'object') return obj
        if (Array.isArray(obj)) return obj.map(item => this._convertToSnakeCase(item))

        const snakeCased = {}
        Object.keys(obj).forEach(key => {
            const snakeKey = key.replace(/([A-Z])/g, (match, letter) => `_${letter.toLowerCase()}`)
            snakeCased[snakeKey] = this._convertToSnakeCase(obj[key])
        })

        return snakeCased
    }

    /**
     * Handle API errors with context-specific error normalization
     */
    _handleError(error, operation) {
        let normalizedError = {
            success: false,
            error: error.message,
            operation,
            context: this._contextType,
            timestamp: new Date().toISOString()
        }

        // HTTP status code handling
        if (error.message.includes('HTTP 400')) {
            normalizedError.type = 'validation_error'
            normalizedError.userMessage = 'Please check your input and try again.'
        } else if (error.message.includes('HTTP 401')) {
            normalizedError.type = 'authentication_error'
            normalizedError.userMessage = 'You need to log in to perform this action.'
        } else if (error.message.includes('HTTP 403')) {
            normalizedError.type = 'permission_error'
            normalizedError.userMessage = 'You do not have permission to perform this action.'
        } else if (error.message.includes('HTTP 404')) {
            normalizedError.type = 'not_found_error'
            normalizedError.userMessage = 'The requested resource was not found.'
        } else if (error.message.includes('HTTP 500')) {
            normalizedError.type = 'server_error'
            normalizedError.userMessage = 'A server error occurred. Please try again later.'
        } else if (error.name === 'AbortError' || error.message.includes('timeout')) {
            normalizedError.type = 'timeout_error'
            normalizedError.userMessage = 'The request timed out. Please try again.'
        } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
            normalizedError.type = 'network_error'
            normalizedError.userMessage = 'Network error. Please check your connection and try again.'
        } else {
            normalizedError.type = 'unknown_error'
            normalizedError.userMessage = 'An unexpected error occurred. Please try again.'
        }

        // Context-specific error handling
        if (this._contextType === SUPPORTED_CONTEXTS.PAGE) {
            normalizedError = this._handlePageError(normalizedError)
        } else if (this._contextType === SUPPORTED_CONTEXTS.OBJECT) {
            normalizedError = this._handleObjectError(normalizedError)
        }

        return normalizedError
    }

    /**
     * Handle page-specific errors
     */
    _handlePageError(error) {
        const pageError = { ...error }

        if (error.type === 'validation_error') {
            pageError.userMessage = 'Page widget validation failed. Please check widget configurations.'
        } else if (error.type === 'not_found_error') {
            pageError.userMessage = 'Page or page version not found.'
        }

        return pageError
    }

    /**
     * Handle object-specific errors
     */
    _handleObjectError(error) {
        const objectError = { ...error }

        if (error.type === 'validation_error') {
            objectError.userMessage = 'Object widget validation failed. Please check widget controls.'
        } else if (error.type === 'not_found_error') {
            objectError.userMessage = 'Object or object type not found.'
        }

        return objectError
    }

    /**
     * Determine if request should be retried
     */
    _shouldRetry(error) {
        // Don't retry client errors (4xx) except for 408 (timeout) and 429 (rate limit)
        if (error.message.includes('HTTP 4')) {
            return error.message.includes('HTTP 408') || error.message.includes('HTTP 429')
        }

        // Retry server errors (5xx) and network errors
        return error.message.includes('HTTP 5') ||
            error.message.includes('NetworkError') ||
            error.message.includes('Failed to fetch') ||
            error.name === 'AbortError'
    }

    /**
     * Delay helper for retry logic
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * Batch operations for multiple widgets
     */
    async batchOperation(operation, widgets) {
        try {
            const endpoint = this._getEndpoint('bulk')
            const transformedData = this.transformRequest({
                operation,
                widgets,
                context: this._contextType
            })

            const response = await this._makeRequest('POST', endpoint, transformedData)
            const transformedResponse = this.transformResponse(response)

            return {
                success: true,
                data: transformedResponse,
                status: response.status
            }
        } catch (error) {
            return this._handleError(error, 'batchOperation')
        }
    }

    /**
     * Get API client statistics
     */
    getStats() {
        return {
            contextType: this._contextType,
            baseUrl: this._baseUrl,
            timeout: this._timeout,
            retryAttempts: this._retryAttempts,
            availableEndpoints: Object.keys(this._endpoints)
        }
    }
}

/**
 * Create API client for specific context
 */
export function createApiClient(contextType, options = {}) {
    return new ApiClient({
        contextType,
        ...options
    })
}

/**
 * Page-specific API client
 */
export class PageApiClient extends ApiClient {
    constructor(options = {}) {
        super({
            contextType: SUPPORTED_CONTEXTS.PAGE,
            ...options
        })
    }

    /**
     * Save page version with widgets
     */
    async savePageVersion(pageId, versionId, data) {
        const endpoint = this._getEndpoint('save', { entityId: pageId, versionId })
        const transformedData = this.transformRequest(data)

        const response = await this._makeRequest('PUT', endpoint, transformedData)
        return this.transformResponse(response)
    }

    /**
     * Load page version with widgets
     */
    async loadPageVersion(pageId, versionId) {
        const endpoint = this._getEndpoint('load', { entityId: pageId, versionId })

        const response = await this._makeRequest('GET', endpoint)
        return this.transformResponse(response)
    }
}

/**
 * Object-specific API client
 */
export class ObjectApiClient extends ApiClient {
    constructor(options = {}) {
        super({
            contextType: SUPPORTED_CONTEXTS.OBJECT,
            ...options
        })
    }

    /**
     * Save object instance with widgets
     */
    async saveObjectInstance(objectId, data) {
        const endpoint = this._getEndpoint('save', { entityId: objectId })
        const transformedData = this.transformRequest(data)

        const response = await this._makeRequest('PUT', endpoint, transformedData)
        return this.transformResponse(response)
    }

    /**
     * Load object instance with widgets
     */
    async loadObjectInstance(objectId) {
        const endpoint = this._getEndpoint('load', { entityId: objectId })

        const response = await this._makeRequest('GET', endpoint)
        return this.transformResponse(response)
    }
}

export default ApiClient
