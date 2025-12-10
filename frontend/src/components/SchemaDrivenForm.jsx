import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { pageDataSchemasApi } from '../api'
import { createValidator, ValidationMode } from '../utils/hybridValidation.js'
import ValidatedInput from './validation/ValidatedInput.jsx'
import ValidationSummary from './validation/ValidationSummary.jsx'
import MediaField from './form-fields/MediaField.jsx'

// Minimal JSON Schema -> form renderer (text/number/boolean/select) for top-level properties
export default function SchemaDrivenForm({ pageVersionData, onChange, onValidationChange, onValidatedDataSync, namespace }) {
    const [schema, setSchema] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Validation state
    const [validationResults, setValidationResults] = useState({})
    const [validationSummary, setValidationSummary] = useState(null)
    const [validatingProperties, setValidatingProperties] = useState(new Set())
    const [groupValidationResults, setGroupValidationResults] = useState({})
    const [isValidationValid, setIsValidationValid] = useState(true) // Start optimistic for server-only validation
    const validatorRef = useRef(null)

    useEffect(() => {
        let mounted = true
        setLoading(true)
        pageDataSchemasApi.getEffective(pageVersionData?.codeLayout)
            .then((res) => {
                const s = res?.data?.schema || res?.schema || null
                if (mounted) {
                    setSchema(s)

                    // Initialize validator
                    if (s) {
                        validatorRef.current = createValidator({
                            schema: s, // Pass the original schema with groups intact
                            layoutName: pageVersionData?.codeLayout,
                            mode: ValidationMode.SERVER_ONLY,
                            debounceMs: 300,
                            onValidationStart: ({ type, propertyName }) => {
                                if (type === 'property' && propertyName) {
                                    setValidatingProperties(prev => new Set(prev).add(propertyName))
                                }
                            },
                            onValidationComplete: ({ type, result }) => {
                                if (type === 'property' && result.property) {
                                    setValidatingProperties(prev => {
                                        const next = new Set(prev)
                                        next.delete(result.property)
                                        return next
                                    })
                                    setValidationResults(prev => ({
                                        ...prev,
                                        [result.property]: result.combinedResult
                                    }))

                                    // NEW: Sync validated data to canonical state when validation passes
                                    if (result.combinedResult?.isValid && onValidatedDataSync) {
                                        onValidatedDataSync({
                                            [result.property]: result.data?.[result.property] ?? result.value
                                        })
                                    }
                                } else if (type === 'all') {
                                    setValidatingProperties(new Set())
                                    setValidationResults(result.combinedResults)
                                    setValidationSummary(result.summary)

                                    // Handle group validation results from client validation
                                    if (result.combinedResults?._groupResults) {
                                        setGroupValidationResults(result.combinedResults._groupResults)
                                    }

                                    // Handle group validation results from server validation if available
                                    if (result.serverValidation?.group_validation) {
                                        setGroupValidationResults(prev => ({
                                            ...prev,
                                            ...result.serverValidation.group_validation
                                        }))
                                    }

                                    // Calculate overall validation state
                                    const hasErrors = result.summary?.errorCount > 0 ||
                                        (result.combinedResults?._groupResults &&
                                            Object.values(result.combinedResults._groupResults).some(g => !g.isValid))
                                    setIsValidationValid(!hasErrors)
                                }
                            },
                            onValidationError: ({ type, error, propertyName }) => {
                                console.error('Validation error:', error)
                                if (type === 'property' && propertyName) {
                                    setValidatingProperties(prev => {
                                        const next = new Set(prev)
                                        next.delete(propertyName)
                                        return next
                                    })
                                    setValidationResults(prev => ({
                                        ...prev,
                                        [propertyName]: {
                                            isValid: false,
                                            errors: [`Validation error: ${error.message}`],
                                            warnings: [],
                                            severity: 'error'
                                        }
                                    }))
                                }
                            }
                        })

                        // Clear any existing cache when schema changes
                        validatorRef.current.clearCache()

                        // Skip initial validation for server-only mode - validation will happen on save
                    }
                }
            })
            .catch((e) => setError(typeof e?.message === 'string' ? e.message : 'Failed to load schema'))
            .finally(() => setLoading(false))
        return () => {
            mounted = false
            // Clean up validator timers when component unmounts
            if (validatorRef.current) {
                validatorRef.current.clearCache()
            }
        }
    }, [pageVersionData?.codeLayout])

    const properties = useMemo(() => {
        if (!schema) return {}

        // If schema has groups, merge all group properties for rendering compatibility
        if (schema.groups) {
            const merged = {}
            Object.values(schema.groups).forEach(group => {
                Object.assign(merged, group.properties || {})
            })
            return merged
        }

        // If combined via allOf, flatten first object with properties for simple use-cases
        if (schema.allOf && Array.isArray(schema.allOf)) {
            const merged = schema.allOf.reduce((acc, part) => ({
                ...acc,
                ...(part.properties || {}),
            }), {})
            return merged
        }
        return schema.properties || {}
    }, [schema])

    // Get groups structure for organized rendering
    const groups = useMemo(() => {
        if (!schema?.groups) return null
        return schema.groups
    }, [schema])

    // Handle property value changes with validation
    const handlePropertyChange = useCallback(async (propertyName, value) => {
        // Update parent component (for immediate UI feedback)
        onChange?.({ [propertyName]: value })

        // Trigger validation which will sync to canonical state when successful
        if (validatorRef.current) {
            await validatorRef.current.validateProperty(propertyName, value, {
                pageData: { ...pageVersionData?.pageData, [propertyName]: value }
            })
        }
    }, [onChange, pageVersionData?.pageData])

    // Handle validation of all properties
    const validateAllProperties = useCallback(async () => {
        if (validatorRef.current && pageVersionData?.pageData) {
            await validatorRef.current.validateAll(pageVersionData.pageData)
        }
    }, [pageVersionData?.pageData])

    // Handle group-based validation directly via API
    const validateAllGroups = useCallback(async () => {
        if (!pageVersionData?.pageData || !pageVersionData?.codeLayout) return

        try {
            const response = await pageDataSchemasApi.validate({
                page_data: pageVersionData.pageData,
                layout_name: pageVersionData.codeLayout
            })

            if (response?.data?.group_validation) {
                setGroupValidationResults(response.data.group_validation)

                // Calculate overall validation state from groups
                const hasGroupErrors = Object.values(response.data.group_validation).some(g => !g.isValid)
                setIsValidationValid(!hasGroupErrors)
            }

            // Also update overall validation results
            if (response?.data?.errors) {
                setValidationResults(prev => ({
                    ...prev,
                    ...Object.fromEntries(
                        Object.entries(response.data.errors).map(([prop, errors]) => [
                            prop,
                            {
                                isValid: false,
                                errors: errors.map(e => {
                                    const message = e.message || e
                                    // Clean up ugly server error messages
                                    if (message.includes('should be non-empty') || message.includes("'' should be")) {
                                        return 'This field is required'
                                    }
                                    if (message.includes("'' is too short")) {
                                        return 'This field is required'
                                    }
                                    return message
                                }),
                                warnings: [],
                                severity: 'error'
                            }
                        ])
                    )
                }))
            }
        } catch (error) {
            console.error('Group validation failed:', error)
        }
    }, [pageVersionData?.pageData, pageVersionData?.codeLayout])

    // Calculate overall validation state from individual field results
    useEffect(() => {
        const hasFieldErrors = Object.values(validationResults).some(result =>
            result && (!result.isValid || (result.errors && result.errors.length > 0))
        )
        const hasGroupErrors = Object.values(groupValidationResults).some(group =>
            !(group.isValid ?? group.isValid ?? true)
        )
        const overallHasErrors = hasFieldErrors || hasGroupErrors

        // Server-only validation: only update state when server responds with errors

        if (isValidationValid !== !overallHasErrors) {
            setIsValidationValid(!overallHasErrors)
        }
    }, [validationResults, groupValidationResults, isValidationValid])

    // Report validation state changes to parent
    useEffect(() => {
        if (onValidationChange) {
            const validationState = {
                isValid: isValidationValid,
                hasErrors: !isValidationValid,
                groupResults: groupValidationResults,
                fieldResults: validationResults
            }

            // Server-only validation state change

            onValidationChange(validationState)
        }
    }, [isValidationValid, groupValidationResults, validationResults, onValidationChange])

    // Handle property focus for validation summary navigation
    const handlePropertyFocus = useCallback((propertyName) => {
        const element = document.getElementById(`field-${propertyName}`)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            element.focus()
        }
    }, [])

    if (loading) {
        return <div className="p-6 bg-white rounded-lg shadow">Loading schema...</div>
    }

    if (error) {
        return <div className="p-6 bg-red-50 border border-red-200 rounded">{error}</div>
    }

    if (!schema) {
        return <div className="p-6 bg-white rounded-lg shadow">No schema configured.</div>
    }

    const renderField = (key, def, groupRequired = []) => {
        const value = pageVersionData?.pageData?.[key] ?? ''
        const type = Array.isArray(def.type) ? def.type[0] : def.type
        const title = def.title || key
        const description = def.description || ''
        // Check group-level required first, then fall back to merged required from all groups
        let isRequired = groupRequired.includes(key)
        if (!isRequired && schema?.groups) {
            // Check all groups for required fields if no group-specific required provided
            isRequired = Object.values(schema.groups).some(group =>
                group.required && group.required.includes(key)
            )
        }
        if (!isRequired && schema?.required) {
            // Final fallback to root-level required (for non-grouped schemas)
            isRequired = schema.required.includes(key)
        }
        const required = isRequired

        // Get validation state for this property
        const validation = validationResults[key]
        const isValidating = validatingProperties.has(key)

        const handleChange = (e) => {
            const v = type === 'number' || type === 'integer' ?
                Number(e.target.value) :
                type === 'boolean' ?
                    e.target.checked :
                    e.target.value
            handlePropertyChange(key, v)
        }

        const handleBlur = (e) => {
            // Trigger validation on blur to ensure validation runs even when user stops typing
            // Use the current input value to avoid stale data issues
            const currentValue = type === 'number' || type === 'integer' ?
                Number(e.target.value) :
                type === 'boolean' ?
                    e.target.checked :
                    e.target.value

            if (validatorRef.current) {
                validatorRef.current.validateProperty(key, currentValue, {
                    pageData: { ...pageVersionData?.pageData, [key]: currentValue },
                    debounce: false, // Skip debouncing on blur for immediate validation
                    cacheMs: 1000   // Shorter cache timeout for blur validation
                })
            }
        }

        const commonProps = {
            id: `field-${key}`,
            name: key,
            value: value ?? '',
            onChange: handleChange,
            onBlur: handleBlur,
            validation,
            isValidating,
            label: title,
            description,
            required,
            showValidation: true
        }

        if (type === 'boolean') {
            return (
                <ValidatedInput
                    key={key}
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => handlePropertyChange(key, e.target.checked)}
                    {...commonProps}
                />
            )
        }

        if (def.enum) {
            return (
                <ValidatedInput
                    key={key}
                    type="select"
                    {...commonProps}
                >
                    <option value="">-- select --</option>
                    {def.enum.map((opt) => (
                        <option key={String(opt)} value={opt}>{String(opt)}</option>
                    ))}
                </ValidatedInput>
            )
        }

        if (type === 'number' || type === 'integer') {
            return (
                <ValidatedInput
                    key={key}
                    type="number"
                    {...commonProps}
                />
            )
        }
        // Handle media fields
        if (def.format === 'media') {
            return (
                <MediaField
                    key={key}
                    value={value}
                    onChange={(mediaValue) => handlePropertyChange(key, mediaValue)}
                    label={title}
                    description={description}
                    required={required}
                    multiple={def.multiple || type === 'array'}
                    mediaTypes={def.mediaTypes || ['image', 'video', 'audio', 'document']}
                    maxItems={def.maxItems}
                    minItems={def.minItems}
                    validation={validation}
                    isValidating={isValidating}
                    showValidation={true}
                    namespace={namespace}
                />
            )
        }

        // default: string or others as text
        return (
            <ValidatedInput
                key={key}
                type={def.format === 'textarea' ? 'textarea' : 'text'}
                rows={def.format === 'textarea' ? 3 : undefined}
                {...commonProps}
            />
        )
    }

    // Get ordered property keys based on schema's propertyOrder
    const getOrderedPropertyKeys = () => {
        const propertyOrder = schema?.propertyOrder || []
        const allKeys = Object.keys(properties)

        if (propertyOrder.length > 0) {
            // Use propertyOrder, then add any missing keys
            const orderedKeys = [...propertyOrder.filter(key => properties[key])]
            const remainingKeys = allKeys.filter(key => !propertyOrder.includes(key))
            return [...orderedKeys, ...remainingKeys]
        }

        return allKeys
    }

    // Check if schema has groups
    const hasGroups = schema?.groups && Object.keys(schema.groups).length > 0

    // Render grouped fields
    const renderGroupedFields = () => {
        if (!hasGroups) {
            // Fallback to original rendering for non-grouped schemas
            return (
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="2">Page Data</div>
                        <button
                            onClick={validateAllProperties}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                            Validate All
                        </button>
                    </div>
                    <div className="space-y-4">
                        {getOrderedPropertyKeys().map((key) => renderField(key, properties[key], []))}
                    </div>
                </div>
            )
        }

        // Render groups
        return Object.entries(schema.groups).map(([groupKey, group]) => {
            const groupProperties = group.properties || {}
            const groupRequired = group.required || []

            // Get ordered keys for this group
            const getOrderedKeysForGroup = () => {
                const groupPropertyOrder = group.propertyOrder || []
                const allGroupKeys = Object.keys(groupProperties)

                if (groupPropertyOrder.length > 0) {
                    const orderedKeys = [...groupPropertyOrder.filter(key => groupProperties[key])]
                    const remainingKeys = allGroupKeys.filter(key => !groupPropertyOrder.includes(key))
                    return [...orderedKeys, ...remainingKeys]
                }

                return allGroupKeys
            }

            // Get group validation status
            const groupValidation = groupValidationResults[groupKey]
            // Handle both client-side (isValid) and server-side (isValid) formats
            const groupIsValid = groupValidation ? (groupValidation.isValid ?? groupValidation.isValid ?? true) : true
            const groupHasErrors = groupValidation && (
                (groupValidation.errors && Object.keys(groupValidation.errors).length > 0) ||
                (groupValidation.errorCount && groupValidation.errorCount > 0)
            )

            // Determine group status styling
            // Only show colors for problems (errors/warnings), not for valid groups
            const getGroupStatusColor = () => {
                if (!groupValidation) return 'text-gray-500'
                if (groupHasErrors) return 'text-red-600'
                // Don't show green for valid - use neutral gray
                return 'text-gray-500'
            }

            const getGroupBorderColor = () => {
                if (!groupValidation) return 'border-gray-200'
                if (groupHasErrors) return 'border-red-200'
                // Don't show green for valid - use neutral gray
                return 'border-gray-200'
            }

            return (
                <div key={groupKey} className={`bg-white rounded-lg shadow p-6 border-2 ${getGroupBorderColor()}`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">
                                {group.title || `${groupKey.charAt(0).toUpperCase() + groupKey.slice(1)} Fields`}
                            </div>
                            {groupValidation && (
                                <span className={`text-sm font-medium ${getGroupStatusColor()}`}>
                                    {groupIsValid ? '✓ Valid' : '✗ Invalid'}
                                </span>
                            )}
                        </div>
                        <span className="text-sm text-gray-500">
                            {Object.keys(groupProperties).length} field{Object.keys(groupProperties).length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {/* Group-level error summary */}
                    {false && groupHasErrors !== 0 && groupHasErrors && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <div className="text-sm font-medium text-red-800 mb-1" role="heading" aria-level="4">Group Validation Errors:</div>
                            <div className="text-sm text-red-700 space-y-1" role="list">
                                {(() => {
                                    // Handle client-side format (results object with individual property validations)
                                    if (groupValidation.results) {
                                        return Object.entries(groupValidation.results)
                                            .filter(([prop, result]) => result.errors && result.errors.length > 0)
                                            .map(([prop, result]) => (
                                                <div key={prop}>
                                                    <span className="font-bold">{prop}:</span> {result.errors.join(', ')}
                                                </div>
                                            ))
                                    }
                                    // Handle server-side format (direct errors object)
                                    if (groupValidation.errors) {
                                        return Object.entries(groupValidation.errors).map(([prop, errors]) => (
                                            <div key={prop}>
                                                <span className="font-bold">{prop === '_root' ? 'General' : prop}:</span> {errors.map(e => e.message || e).join(', ')}
                                            </div>
                                        ))
                                    }
                                    return []
                                })()}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        {getOrderedKeysForGroup().map((key) => renderField(key, groupProperties[key], groupRequired))}
                    </div>
                </div>
            )
        })
    }

    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header with validation button */}
                <div className="flex items-center justify-between">
                    <div className="text-xl font-semibold text-gray-900" role="heading" aria-level="2">Page Data</div>
                </div>

                {/* Form Fields - either grouped or ungrouped */}
                {renderGroupedFields()}
            </div>
        </div>
    )
}


