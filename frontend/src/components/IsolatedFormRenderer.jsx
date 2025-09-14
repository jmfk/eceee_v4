import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getWidgetSchema, validateWidgetConfiguration } from '../api/widgetSchemas.js'
import { WIDGET_CHANGE_TYPES } from '../types/widgetEvents'
import SchemaFieldRenderer from './forms/SchemaFieldRenderer.jsx'
import ValidatedInput from './validation/ValidatedInput.jsx'

/**
 * IsolatedFieldWrapper - Wraps each field to prevent cross-field rerenders
 * Each field manages its own state and validation independently
 */
const IsolatedFieldWrapper = React.memo(({
    fieldName,
    fieldSchema,
    widgetData,
    widgetType,
    isRequired,
    onFieldChange,
    onValidationChange
}) => {
    // Local state for this field only
    const [fieldValue, setFieldValue] = useState('')
    const [validation, setValidation] = useState(null)
    const [isValidating, setIsValidating] = useState(false)

    // Refs to prevent rerenders
    const validationTimeoutRef = useRef(null)
    const initializedRef = useRef(false)

    // Initialize field value when widget data changes
    useEffect(() => {
        if (widgetData?.config && !initializedRef.current) {
            const initialValue = widgetData.config[fieldName] ?? ''
            setFieldValue(initialValue)
            initializedRef.current = true
        }
    }, [widgetData, fieldName])

    // Reset when widget changes
    useEffect(() => {
        if (widgetData?.config) {
            const newValue = widgetData.config[fieldName] ?? ''
            setFieldValue(newValue)
            setValidation(null)
            initializedRef.current = true
        }
    }, [widgetData?.id, fieldName])

    // Debounced validation for this field only
    const validateField = useCallback(async (value, fullConfig) => {
        if (!widgetData?.type) return

        if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current)
        }

        validationTimeoutRef.current = setTimeout(async () => {
            setIsValidating(true)
            try {
                const result = await validateWidgetConfiguration(widgetData.type, fullConfig)

                const fieldValidation = result.errors?.[fieldName] ? {
                    isValid: false,
                    errors: Array.isArray(result.errors[fieldName]) ? result.errors[fieldName] : [result.errors[fieldName]],
                    warnings: result.warnings?.[fieldName] || []
                } : null

                setValidation(fieldValidation)
                setIsValidating(false)

                // Notify parent about this field's validation state
                if (onValidationChange) {
                    onValidationChange(fieldName, fieldValidation)
                }
            } catch (error) {
                console.error(`Field validation failed for ${fieldName}:`, error)
                setIsValidating(false)
            }
        }, 300)
    }, [fieldName, widgetData, onValidationChange])

    // Handle field change
    const handleChange = useCallback((newValue) => {
        setFieldValue(newValue)

        // Notify parent of the change
        if (onFieldChange) {
            onFieldChange(fieldName, newValue, (fullConfig) => {
                // Trigger validation with full config
                validateField(newValue, fullConfig)
            })
        }
    }, [fieldName, onFieldChange, validateField])

    // Cleanup timeout
    useEffect(() => {
        return () => {
            if (validationTimeoutRef.current) {
                clearTimeout(validationTimeoutRef.current)
            }
        }
    }, [])

    // Hide fields that are managed by special editors
    const hiddenFields = {
        'core_widgets.ImageWidget': ['collectionId', 'collectionConfig', 'mediaItems']
    }

    if (hiddenFields[widgetType]?.includes(fieldName)) {
        return null
    }

    // Use SchemaFieldRenderer for custom components
    if (fieldSchema.component) {
        return (
            <SchemaFieldRenderer
                fieldName={fieldName}
                fieldSchema={fieldSchema}
                value={fieldValue}
                onChange={handleChange}
                validation={validation}
                isValidating={isValidating}
                required={isRequired}
                disabled={false}
            />
        )
    }

    // Enhanced form fields for common types
    const fieldType = fieldSchema.type || 'string'
    const fieldTitle = fieldSchema.title || fieldName
    const fieldDescription = fieldSchema.description

    // Handle different field types with enhanced UI
    if (fieldType === 'boolean') {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div>
                        <label className="text-sm font-medium text-gray-700">
                            {fieldTitle}
                        </label>
                        {fieldDescription && (
                            <p className="text-xs text-gray-500 mt-1">{fieldDescription}</p>
                        )}
                    </div>
                    <div className="relative">
                        <input
                            type="checkbox"
                            checked={Boolean(fieldValue)}
                            onChange={(e) => handleChange(e.target.checked)}
                            className="sr-only"
                            id={`toggle-${fieldName}`}
                        />
                        <label
                            htmlFor={`toggle-${fieldName}`}
                            className={`block w-12 h-6 rounded-full cursor-pointer transition-colors ${Boolean(fieldValue) ? 'bg-blue-600' : 'bg-gray-300'
                                }`}
                        >
                            <div
                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${Boolean(fieldValue) ? 'translate-x-6' : 'translate-x-0'
                                    }`}
                            />
                        </label>
                    </div>
                </div>
            </div>
        )
    }

    // Handle enum fields with choice chips
    if (fieldSchema.enum) {
        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {fieldTitle}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                {fieldDescription && (
                    <p className="text-xs text-gray-500">{fieldDescription}</p>
                )}
                <div className="flex flex-wrap gap-2">
                    {fieldSchema.enum.map(option => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => handleChange(option)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${fieldValue === option
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {option.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
                {validation && !validation.isValid && (
                    <div className="text-red-600 text-xs mt-1">
                        {validation.errors?.join(', ')}
                    </div>
                )}
            </div>
        )
    }

    // Use ValidatedInput for other field types
    return (
        <ValidatedInput
            type={fieldType === 'number' ? 'number' : 'text'}
            value={fieldValue}
            onChange={(e) => handleChange(e.target.value)}
            label={fieldTitle}
            description={fieldDescription}
            placeholder={fieldSchema.placeholder || ''}
            required={isRequired}
            validation={validation}
            isValidating={isValidating}
            min={fieldSchema.minimum}
            max={fieldSchema.maximum}
        />
    )
})

/**
 * IsolatedFormRenderer - Form container that coordinates isolated fields
 * Each field is completely independent and only re-renders when its own data changes
 */
const IsolatedFormRenderer = React.memo(({
    widgetData,
    schema,
    onRealTimeUpdate,
    onUnsavedChanges,
    onValidatedWidgetSync,
    emitWidgetChanged,
    emitWidgetValidated
}) => {
    // Use refs for form state to prevent rerenders
    const originalConfigRef = useRef({})
    const currentConfigRef = useRef({})
    const schemaRef = useRef(null)
    const updateTimeoutRef = useRef(null)
    const fieldValidationsRef = useRef({})

    // Initialize form data when widget changes
    useEffect(() => {
        if (widgetData?.config) {
            originalConfigRef.current = { ...widgetData.config }
            currentConfigRef.current = { ...widgetData.config }
        }
    }, [widgetData])

    // Store schema in ref
    useEffect(() => {
        if (widgetData && !schema) {
            const fetchSchema = async () => {
                try {
                    const schemaData = await getWidgetSchema(widgetData.type)
                    schemaRef.current = schemaData
                } catch (error) {
                    console.error('Failed to fetch widget schema:', error)
                }
            }
            fetchSchema()
        } else if (schema) {
            schemaRef.current = schema
        }
    }, [widgetData, schema])

    // Debounced real-time update function
    const triggerRealTimeUpdate = useCallback((newConfig) => {
        if (!widgetData) return

        if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current)
        }

        updateTimeoutRef.current = setTimeout(() => {
            const updatedWidget = { ...widgetData, config: newConfig }

            // Emit event for real-time updates
            if (emitWidgetChanged) {
                emitWidgetChanged(
                    widgetData.id,
                    widgetData.slotName,
                    updatedWidget,
                    WIDGET_CHANGE_TYPES.CONFIG
                )
            }

            // Fallback for components not using event system
            if (onRealTimeUpdate && !emitWidgetChanged) {
                onRealTimeUpdate(updatedWidget)
            }
        }, 200)
    }, [widgetData, emitWidgetChanged, onRealTimeUpdate])

    // Handle field changes from isolated fields
    const handleFieldChange = useCallback((fieldName, value, triggerValidation) => {
        // Update config in ref (no rerenders)
        currentConfigRef.current = {
            ...currentConfigRef.current,
            [fieldName]: value
        }

        // Check if we have changes
        const hasActualChanges = JSON.stringify(currentConfigRef.current) !== JSON.stringify(originalConfigRef.current)

        if (onUnsavedChanges) {
            onUnsavedChanges(hasActualChanges)
        }

        // Trigger validation for this field with full config
        if (triggerValidation) {
            triggerValidation(currentConfigRef.current)
        }

        // Trigger real-time updates
        triggerRealTimeUpdate(currentConfigRef.current)
    }, [triggerRealTimeUpdate, onUnsavedChanges])

    // Handle validation changes from individual fields
    const handleValidationChange = useCallback((fieldName, validation) => {
        fieldValidationsRef.current[fieldName] = validation

        // Check overall validity and emit events
        const hasErrors = Object.values(fieldValidationsRef.current).some(v => v && !v.isValid)
        const isValid = !hasErrors

        // Emit validation event
        if (emitWidgetValidated) {
            emitWidgetValidated(widgetData.id, widgetData.slotName, {
                isValid,
                errors: fieldValidationsRef.current,
                warnings: {}
            })
        }

        // Keep backward compatibility
        if (isValid && onValidatedWidgetSync) {
            onValidatedWidgetSync({
                ...widgetData,
                config: currentConfigRef.current
            })
        }
    }, [widgetData, emitWidgetValidated, onValidatedWidgetSync])

    // Cleanup timeouts
    useEffect(() => {
        return () => {
            if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current)
            }
        }
    }, [])

    const activeSchema = schemaRef.current || schema

    if (!activeSchema?.properties) {
        return (
            <div className="text-center text-gray-500 py-8 p-4">
                <p>No configuration options available for this widget.</p>
            </div>
        )
    }

    // Render isolated fields - each field manages its own state and rerenders
    return (
        <div className="space-y-4 p-4">
            {Object.entries(activeSchema.properties).map(([fieldName, fieldSchema]) => {
                const isRequired = activeSchema?.required?.includes(fieldName) || false

                return (
                    <IsolatedFieldWrapper
                        key={fieldName}
                        fieldName={fieldName}
                        fieldSchema={fieldSchema}
                        widgetData={widgetData}
                        widgetType={widgetData?.type || ''}
                        isRequired={isRequired}
                        onFieldChange={handleFieldChange}
                        onValidationChange={handleValidationChange}
                    />
                )
            })}
        </div>
    )
})

export default IsolatedFormRenderer
