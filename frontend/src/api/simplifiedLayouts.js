/**
 * Simplified Layouts API Module
 * 
 * API functions for the new simplified layout JSON format that eliminates
 * Django template complexity and is optimized for React consumption.
 */

import { api } from './client.js'
import { wrapApiCall, buildQueryParams } from './utils.js'

/**
 * Simplified Layouts API operations
 */
export const simplifiedLayoutsApi = {
    /**
     * Get all simplified layouts
     * @returns {Promise<Object>} Simplified layouts list
     */
    list: wrapApiCall(async () => {
        return api.get('/api/v1/webpages/layouts/simplified/')
    }, 'simplifiedLayouts.list'),

    /**
     * Get specific simplified layout
     * @param {string} name - Layout name
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Simplified layout data
     */
    get: wrapApiCall(async (name, options = {}) => {
        const params = {
            use_predefined: options.usePredefined !== false, // Default to true
            ...options
        }
        const queryString = buildQueryParams(params)
        return api.get(`/api/v1/webpages/layouts/simplified/${name}/${queryString}`)
    }, 'simplifiedLayouts.get'),

    /**
     * Get layout schema for validation
     * @returns {Promise<Object>} JSON schema
     */
    getSchema: wrapApiCall(async () => {
        return api.get('/api/v1/webpages/layouts/simplified/schema/')
    }, 'simplifiedLayouts.getSchema'),

    /**
     * Validate layout JSON
     * @param {Object} layoutJson - Layout JSON to validate
     * @returns {Promise<Object>} Validation result
     */
    validate: wrapApiCall(async (layoutJson) => {
        return api.post('/api/v1/webpages/layouts/simplified/validate/', {
            layout: layoutJson
        })
    }, 'simplifiedLayouts.validate'),

    /**
     * Get layout with fallback to legacy format
     * @param {string} name - Layout name
     * @param {Object} options - Options
     * @returns {Promise<Object>} Layout data (simplified or legacy)
     */
    getWithFallback: wrapApiCall(async (name, options = {}) => {
        try {
            // Try simplified format first
            const response = await simplifiedLayoutsApi.get(name, options)
            if (response.success && response.layout) {
                return {
                    ...response.layout,
                    _format: 'simplified',
                    _source: response.source || 'predefined'
                }
            }
        } catch (error) {
            console.warn('SimplifiedLayouts: Failed to get simplified layout, falling back to legacy:', error)
        }

        // Fallback to legacy format
        try {
            const legacyResponse = await api.get(`/api/v1/webpages/layouts/${name}/json/`)
            return {
                ...legacyResponse,
                _format: 'legacy',
                _source: 'django_template'
            }
        } catch (legacyError) {
            console.error('SimplifiedLayouts: Both simplified and legacy formats failed:', legacyError)
            throw legacyError
        }
    }, 'simplifiedLayouts.getWithFallback')
}

/**
 * Layout format detection utilities
 */
export const layoutFormatUtils = {
    /**
     * Detect if layout JSON is simplified format
     * @param {Object} layoutJson - Layout JSON to check
     * @returns {boolean} True if simplified format
     */
    isSimplifiedFormat: (layoutJson) => {
        return layoutJson &&
            layoutJson.version === '2.0' &&
            layoutJson.type &&
            layoutJson.structure &&
            Array.isArray(layoutJson.slots)
    },

    /**
     * Detect if layout JSON is legacy format
     * @param {Object} layoutJson - Layout JSON to check  
     * @returns {boolean} True if legacy format
     */
    isLegacyFormat: (layoutJson) => {
        return layoutJson &&
            layoutJson.layout &&
            layoutJson.structure &&
            !layoutJson.version
    },

    /**
     * Get format version from layout JSON
     * @param {Object} layoutJson - Layout JSON
     * @returns {string} Format version ('2.0', 'legacy', 'unknown')
     */
    getFormatVersion: (layoutJson) => {
        if (layoutFormatUtils.isSimplifiedFormat(layoutJson)) {
            return '2.0'
        } else if (layoutFormatUtils.isLegacyFormat(layoutJson)) {
            return 'legacy'
        } else {
            return 'unknown'
        }
    },

    /**
     * Convert legacy layout to simplified format (basic conversion)
     * @param {Object} legacyLayout - Legacy layout JSON
     * @returns {Object} Simplified layout JSON
     */
    convertLegacyToSimplified: (legacyLayout) => {
        // Basic conversion - can be enhanced
        return {
            name: legacyLayout.layout?.name || 'unknown',
            label: legacyLayout.layout?.name?.replace('_', ' ').replace('-', ' ').title() || 'Unknown Layout',
            description: legacyLayout.layout?.description || 'Converted from legacy format',
            version: '2.0',
            type: 'flexbox',
            structure: {
                display: 'flex',
                flexDirection: 'column',
                gap: '2rem',
                maxWidth: '1024px',
                margin: '0 auto',
                padding: '2rem'
            },
            slots: [
                {
                    name: 'main',
                    label: 'Main Content',
                    description: 'Primary content area',
                    required: true,
                    maxWidgets: 10,
                    allowedWidgetTypes: ['*'],
                    className: 'main-slot',
                    style: {}
                }
            ],
            css: {
                framework: 'tailwind',
                customClasses: ['layout-converted']
            },
            metadata: {
                source: 'legacy_conversion',
                originalFormat: 'django_template',
                convertedAt: new Date().toISOString()
            }
        }
    }
}

export default simplifiedLayoutsApi
