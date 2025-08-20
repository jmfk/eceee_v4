/**
 * Hybrid Validation System
 * 
 * Combines client-side and server-side validation for comprehensive property validation.
 * Provides real-time feedback using client-side validation and authoritative validation
 * using server-side validation.
 */

import { validateProperty, validateProperties, getValidationSummary } from './propertyValidation.js'
import { pageDataSchemasApi } from '../api/pageDataSchemas.js'

/**
 * Validation modes
 */
export const ValidationMode = {
    CLIENT_ONLY: 'client_only',
    SERVER_ONLY: 'server_only',
    HYBRID: 'hybrid', // Default: client-side first, then server-side
    HYBRID_PARALLEL: 'hybrid_parallel' // Run both simultaneously
}

/**
 * Main hybrid validation class
 */
export class HybridValidator {
    constructor(options = {}) {
        this.mode = options.mode || ValidationMode.HYBRID
        this.schema = options.schema || null
        this.layoutName = options.layoutName || null
        this.debounceMs = options.debounceMs || 300
        this.enableCaching = options.enableCaching !== false

        // Internal state
        this._cache = new Map()
        this._pendingValidations = new Map()
        this._debounceTimers = new Map()

        // Callbacks
        this.onValidationStart = options.onValidationStart || (() => { })
        this.onValidationComplete = options.onValidationComplete || (() => { })
        this.onValidationError = options.onValidationError || (() => { })
    }

    /**
     * Validate a single property
     * @param {string} propertyName - Name of the property
     * @param {any} value - Value to validate
     * @param {object} options - Validation options
     * @returns {Promise<object>} Validation result
     */
    async validateProperty(propertyName, value, options = {}) {
        const cacheKey = this._getCacheKey('property', propertyName, value)

        // Check cache first
        if (this.enableCaching && this._cache.has(cacheKey)) {
            const cached = this._cache.get(cacheKey)
            if (Date.now() - cached.timestamp < (options.cacheMs || 30000)) {
                return { ...cached.result, cached: true }
            }
        }

        // Handle debouncing
        if (options.debounce !== false && this.debounceMs > 0) {
            return this._debounceValidation('property', propertyName, () =>
                this._validatePropertyInternal(propertyName, value, options), cacheKey)
        }

        return this._validatePropertyInternal(propertyName, value, options)
    }

    /**
     * Validate all properties
     * @param {object} data - Data object to validate
     * @param {object} options - Validation options
     * @returns {Promise<object>} Validation results
     */
    async validateAll(data, options = {}) {
        const cacheKey = this._getCacheKey('all', null, data)

        // Check cache first
        if (this.enableCaching && this._cache.has(cacheKey)) {
            const cached = this._cache.get(cacheKey)
            if (Date.now() - cached.timestamp < (options.cacheMs || 30000)) {
                return { ...cached.result, cached: true }
            }
        }

        // Handle debouncing
        if (options.debounce !== false && this.debounceMs > 0) {
            return this._debounceValidation('all', 'all', () =>
                this._validateAllInternal(data, options), cacheKey)
        }

        return this._validateAllInternal(data, options)
    }

    /**
     * Update validator configuration
     * @param {object} config - New configuration
     */
    updateConfig(config) {
        if (config.schema !== undefined) this.schema = config.schema
        if (config.layoutName !== undefined) this.layoutName = config.layoutName
        if (config.mode !== undefined) this.mode = config.mode

        // Clear cache when schema changes
        if (config.schema !== undefined || config.layoutName !== undefined) {
            this._cache.clear()
        }
    }

    /**
     * Clear validation cache
     */
    clearCache() {
        this._cache.clear()
    }

    // Internal methods

    async _validatePropertyInternal(propertyName, value, options) {
        this.onValidationStart({ type: 'property', propertyName, value })

        let result = {
            property: propertyName,
            value,
            clientValidation: null,
            serverValidation: null,
            combinedResult: {
                isValid: true,
                errors: [],
                warnings: [],
                severity: 'none'
            }
        }

        try {
            if (this.mode === ValidationMode.CLIENT_ONLY || this.mode === ValidationMode.HYBRID || this.mode === ValidationMode.HYBRID_PARALLEL) {
                result.clientValidation = await this._clientValidateProperty(propertyName, value)
                result.combinedResult = { ...result.clientValidation }
            }

            if (this.mode === ValidationMode.SERVER_ONLY || this.mode === ValidationMode.HYBRID || this.mode === ValidationMode.HYBRID_PARALLEL) {
                // For hybrid mode, only call server if client validation passes or if forced
                const shouldCallServer = this.mode === ValidationMode.SERVER_ONLY ||
                    this.mode === ValidationMode.HYBRID_PARALLEL ||
                    (this.mode === ValidationMode.HYBRID && (options.forceServer || result.clientValidation?.isValid))

                if (shouldCallServer) {
                    result.serverValidation = await this._serverValidateProperty(propertyName, value, options.pageData || {})

                    // Combine client and server results
                    if (result.clientValidation && result.serverValidation) {
                        result.combinedResult = this._combineValidationResults(result.clientValidation, result.serverValidation)
                    } else if (result.serverValidation) {
                        result.combinedResult = result.serverValidation
                    }
                }
            }

            // Cache result
            if (this.enableCaching) {
                const cacheKey = this._getCacheKey('property', propertyName, value)
                this._cache.set(cacheKey, {
                    result,
                    timestamp: Date.now()
                })
            }

            this.onValidationComplete({ type: 'property', result })
            return result

        } catch (error) {
            const errorResult = {
                ...result,
                combinedResult: {
                    isValid: false,
                    errors: [`Validation error: ${error.message}`],
                    warnings: [],
                    severity: 'error'
                }
            }

            this.onValidationError({ type: 'property', error, propertyName, value })
            return errorResult
        }
    }

    async _validateAllInternal(data, options) {
        this.onValidationStart({ type: 'all', data })

        let result = {
            data,
            clientValidation: null,
            serverValidation: null,
            combinedResults: {},
            summary: {
                isValid: true,
                hasWarnings: false,
                errorCount: 0,
                warningCount: 0,
                properties: { valid: [], errors: [], warnings: [] }
            }
        }

        try {
            if (this.mode === ValidationMode.CLIENT_ONLY || this.mode === ValidationMode.HYBRID || this.mode === ValidationMode.HYBRID_PARALLEL) {
                result.clientValidation = await this._clientValidateAll(data)
                result.combinedResults = { ...result.clientValidation }
            }

            if (this.mode === ValidationMode.SERVER_ONLY || this.mode === ValidationMode.HYBRID || this.mode === ValidationMode.HYBRID_PARALLEL) {
                const shouldCallServer = this.mode === ValidationMode.SERVER_ONLY ||
                    this.mode === ValidationMode.HYBRID_PARALLEL ||
                    (this.mode === ValidationMode.HYBRID && (options.forceServer || this._isClientValidationClean(result.clientValidation)))

                if (shouldCallServer) {
                    result.serverValidation = await this._serverValidateAll(data)

                    // Combine results
                    if (result.clientValidation && result.serverValidation) {
                        result.combinedResults = this._combineAllValidationResults(result.clientValidation, result.serverValidation)
                    } else if (result.serverValidation) {
                        result.combinedResults = result.serverValidation
                    }
                }
            }

            // Generate summary
            result.summary = getValidationSummary(result.combinedResults)

            // Cache result
            if (this.enableCaching) {
                const cacheKey = this._getCacheKey('all', null, data)
                this._cache.set(cacheKey, {
                    result,
                    timestamp: Date.now()
                })
            }

            this.onValidationComplete({ type: 'all', result })
            return result

        } catch (error) {
            const errorResult = {
                ...result,
                summary: {
                    isValid: false,
                    hasWarnings: false,
                    errorCount: 1,
                    warningCount: 0,
                    properties: { valid: [], errors: ['_system'], warnings: [] }
                },
                combinedResults: {
                    _system: {
                        isValid: false,
                        errors: [`System validation error: ${error.message}`],
                        warnings: [],
                        severity: 'error'
                    }
                }
            }

            this.onValidationError({ type: 'all', error, data })
            return errorResult
        }
    }

    async _clientValidateProperty(propertyName, value) {
        if (!this.schema?.properties?.[propertyName]) {
            return {
                isValid: true,
                errors: [],
                warnings: ['No schema definition found'],
                severity: 'warning'
            }
        }

        return validateProperty(value, this.schema.properties[propertyName], propertyName)
    }

    async _clientValidateAll(data) {
        if (!this.schema) {
            return {}
        }

        return validateProperties(data, this.schema)
    }

    async _serverValidateProperty(propertyName, value, pageData = {}) {
        // Create minimal page data for server validation
        // Ensure we're sending camelCase data to the server
        const validationData = {
            page_data: { ...pageData, [propertyName]: value },
            layout_name: this.layoutName,
        }

        // Debug: console.log('Validating property:', propertyName, 'with data:', validationData)

        try {
            const response = await pageDataSchemasApi.validate(validationData)
            const serverResult = response.data || response

            // Extract result for specific property
            if (serverResult.errors?.[propertyName]) {
                return {
                    isValid: false,
                    errors: serverResult.errors[propertyName].map(e => e.message || e),
                    warnings: serverResult.warnings?.[propertyName] || [],
                    severity: 'error',
                    serverDetails: serverResult.errors[propertyName]
                }
            }

            if (serverResult.warnings?.[propertyName]) {
                return {
                    isValid: true,
                    errors: [],
                    warnings: serverResult.warnings[propertyName],
                    severity: 'warning'
                }
            }

            return {
                isValid: true,
                errors: [],
                warnings: [],
                severity: 'none'
            }

        } catch (error) {
            throw new Error(`Server validation failed: ${error.message}`)
        }
    }

    async _serverValidateAll(data) {
        const validationData = {
            page_data: data,
            layout_name: this.layoutName,
        }

        // Debug: console.log('Validating all properties with data:', validationData)

        try {
            const response = await pageDataSchemasApi.validate(validationData)
            const serverResult = response.data || response

            // Convert server format to client format
            const results = {}

            // Process errors
            if (serverResult.errors) {
                Object.entries(serverResult.errors).forEach(([prop, errors]) => {
                    results[prop] = {
                        isValid: false,
                        errors: errors.map(e => e.message || e),
                        warnings: serverResult.warnings?.[prop] || [],
                        severity: 'error',
                        serverDetails: errors
                    }
                })
            }

            // Process warnings for properties without errors
            if (serverResult.warnings) {
                Object.entries(serverResult.warnings).forEach(([prop, warnings]) => {
                    if (!results[prop]) {
                        results[prop] = {
                            isValid: true,
                            errors: [],
                            warnings: warnings,
                            severity: 'warning'
                        }
                    }
                })
            }

            // Add valid properties from schema
            if (this.schema?.properties) {
                Object.keys(this.schema.properties).forEach(prop => {
                    if (!results[prop]) {
                        results[prop] = {
                            isValid: true,
                            errors: [],
                            warnings: [],
                            severity: 'none'
                        }
                    }
                })
            }

            return results

        } catch (error) {
            throw new Error(`Server validation failed: ${error.message}`)
        }
    }

    _combineValidationResults(clientResult, serverResult) {
        // Server validation takes precedence for errors
        // Client validation can add additional warnings
        return {
            isValid: serverResult.isValid && clientResult.isValid,
            errors: [
                ...serverResult.errors,
                ...clientResult.errors.filter(e => !serverResult.errors.includes(e))
            ],
            warnings: [
                ...serverResult.warnings,
                ...clientResult.warnings.filter(w => !serverResult.warnings.includes(w))
            ],
            severity: serverResult.isValid ? clientResult.severity : 'error',
            clientDetails: clientResult,
            serverDetails: serverResult
        }
    }

    _combineAllValidationResults(clientResults, serverResults) {
        const combined = {}
        const allProps = new Set([...Object.keys(clientResults), ...Object.keys(serverResults)])

        allProps.forEach(prop => {
            const client = clientResults[prop]
            const server = serverResults[prop]

            if (client && server) {
                combined[prop] = this._combineValidationResults(client, server)
            } else if (server) {
                combined[prop] = server
            } else if (client) {
                combined[prop] = client
            }
        })

        return combined
    }

    _isClientValidationClean(clientValidation) {
        if (!clientValidation) return true

        return Object.values(clientValidation).every(result =>
            result.isValid && result.errors.length === 0
        )
    }

    _getCacheKey(type, property, value) {
        const valueHash = typeof value === 'object' ? JSON.stringify(value) : String(value)
        const schemaHash = this.schema ? JSON.stringify(this.schema).slice(0, 100) : 'no-schema'
        return `${type}-${property || 'all'}-${valueHash.slice(0, 50)}-${schemaHash}`
    }

    _debounceValidation(type, key, validationFn, cacheKey) {
        return new Promise((resolve, reject) => {
            // Clear existing timer
            const timerId = this._debounceTimers.get(key)
            if (timerId) {
                clearTimeout(timerId)
            }

            // Set new timer
            const newTimerId = setTimeout(async () => {
                try {
                    const result = await validationFn()
                    this._debounceTimers.delete(key)
                    resolve(result)
                } catch (error) {
                    this._debounceTimers.delete(key)
                    reject(error)
                }
            }, this.debounceMs)

            this._debounceTimers.set(key, newTimerId)
        })
    }
}

/**
 * Create a new hybrid validator instance
 * @param {object} options - Configuration options
 * @returns {HybridValidator} Validator instance
 */
export function createValidator(options = {}) {
    return new HybridValidator(options)
}

/**
 * Utility function for quick validation
 * @param {object} data - Data to validate
 * @param {object} schema - JSON Schema
 * @param {object} options - Validation options
 * @returns {Promise<object>} Validation result
 */
export async function quickValidate(data, schema, options = {}) {
    const validator = new HybridValidator({
        schema,
        layoutName: options.layoutName,
        mode: options.mode || ValidationMode.HYBRID
    })

    return validator.validateAll(data, options)
}

export default HybridValidator
