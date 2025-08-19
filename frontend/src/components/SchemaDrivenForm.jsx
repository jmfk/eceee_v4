import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { pageDataSchemasApi } from '../api'
import { createValidator, ValidationMode } from '../utils/hybridValidation.js'
import ValidatedInput from './validation/ValidatedInput.jsx'
import ValidationSummary from './validation/ValidationSummary.jsx'

// Minimal JSON Schema -> form renderer (text/number/boolean/select) for top-level properties
export default function SchemaDrivenForm({ pageVersionData, onChange }) {
    const [schema, setSchema] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Validation state
    const [validationResults, setValidationResults] = useState({})
    const [validationSummary, setValidationSummary] = useState(null)
    const [validatingProperties, setValidatingProperties] = useState(new Set())
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
                            schema: s,
                            layoutName: pageVersionData?.codeLayout,
                            mode: ValidationMode.HYBRID,
                            debounceMs: 300,
                            onValidationStart: ({ type, propertyName }) => {
                                if (type === 'property' && propertyName) {
                                    setValidatingProperties(prev => new Set(prev).add(propertyName))
                                }
                            },
                            onValidationComplete: ({ type, result }) => {
                                // Debug: console.log('Validation completed:', type, result)
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
                                } else if (type === 'all') {
                                    setValidatingProperties(new Set())
                                    setValidationResults(result.combinedResults)
                                    setValidationSummary(result.summary)
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

                        // Validate initial data (even if empty to catch required field errors)
                        const initialData = pageVersionData?.pageData || {}
                        validatorRef.current.validateAll(initialData)
                    }
                }
            })
            .catch((e) => setError(typeof e?.message === 'string' ? e.message : 'Failed to load schema'))
            .finally(() => setLoading(false))
        return () => { mounted = false }
    }, [pageVersionData?.codeLayout])

    const properties = useMemo(() => {
        if (!schema) return {}
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

    // Handle property value changes with validation
    const handlePropertyChange = useCallback(async (propertyName, value) => {
        // Update parent component
        onChange?.({ [propertyName]: value })

        // Trigger validation
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

    const renderField = (key, def) => {
        const value = pageVersionData?.pageData?.[key] ?? ''
        const type = Array.isArray(def.type) ? def.type[0] : def.type
        const title = def.title || key
        const description = def.description || ''
        const required = schema?.required?.includes(key) || false

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

        const commonProps = {
            id: `field-${key}`,
            name: key,
            value: value ?? '',
            onChange: handleChange,
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

    return (
        <div className="h-full p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Form Fields */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Page Data</h2>
                        <button
                            onClick={validateAllProperties}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                        >
                            Validate All
                        </button>
                    </div>
                    <div className="space-y-4">
                        {getOrderedPropertyKeys().map((key) => renderField(key, properties[key]))}
                    </div>
                </div>
            </div>
        </div>
    )
}


