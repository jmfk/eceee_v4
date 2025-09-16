import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getWidgetSchema, validateWidgetConfiguration } from '../api/widgetSchemas.js'
import { WIDGET_CHANGE_TYPES } from '../types/widgetEvents'
import SchemaFieldRenderer from './forms/SchemaFieldRenderer.jsx'
import ValidatedInput from './validation/ValidatedInput.jsx'
import useLocalFormState from '../hooks/useLocalFormState'
import LocalStateFieldWrapper from './forms/LocalStateFieldWrapper.jsx'

/**
 * IsolatedFieldWrapper - Simplified wrapper that uses LocalStateFieldWrapper
 * Removes double state management and relies on LocalStateFieldWrapper for all state logic
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
    // Get initial value from widget data
    const initialValue = widgetData?.config?.[fieldName] ?? ''

    // Hide fields that are managed by special editors
    const hiddenFields = {
        'core_widgets.ImageWidget': ['collectionId', 'collectionConfig', 'mediaItems']
    }

    if (hiddenFields[widgetType]?.includes(fieldName)) {
        return null
    }

    // Custom validation function for this field
    const handleFieldValidation = useCallback(async (fieldName, value) => {
        if (!widgetData?.type) return null

        try {
            // Get current config and update with new value
            const fullConfig = {
                ...widgetData.config,
                [fieldName]: value
            }

            const result = await validateWidgetConfiguration(widgetData.type, fullConfig)

            const fieldValidation = result.errors?.[fieldName] ? {
                isValid: false,
                errors: Array.isArray(result.errors[fieldName]) ? result.errors[fieldName] : [result.errors[fieldName]],
                warnings: result.warnings?.[fieldName] || []
            } : {
                isValid: true,
                errors: [],
                warnings: result.warnings?.[fieldName] || []
            }

            // Notify parent about this field's validation state
            if (onValidationChange) {
                onValidationChange(fieldName, fieldValidation)
            }

            return fieldValidation
        } catch (error) {
            console.error(`Field validation failed for ${fieldName}:`, error)
            const errorValidation = {
                isValid: false,
                errors: ['Validation failed'],
                warnings: []
            }
            if (onValidationChange) {
                onValidationChange(fieldName, errorValidation)
            }
            return errorValidation
        }
    }, [fieldName, widgetData, onValidationChange])

    // Handle field changes
    const handleFieldChange = useCallback((fieldName, value) => {
        if (onFieldChange) {
            onFieldChange(fieldName, value, (fullConfig) => {
                // Validation is now handled by LocalStateFieldWrapper
                // This callback is kept for backward compatibility
            })
        }
    }, [fieldName, onFieldChange])

    // Use SchemaFieldRenderer for custom components or fallback to basic rendering
    if (fieldSchema.component) {
        return (
            <SchemaFieldRenderer
                fieldName={fieldName}
                fieldSchema={fieldSchema}
                value={initialValue}
                onChange={handleFieldChange}
                onValidation={handleFieldValidation}
                required={isRequired}
                disabled={false}
            />
        )
    }

    // For non-component fields, use SchemaFieldRenderer which handles LocalStateFieldWrapper internally
    return (
        <SchemaFieldRenderer
            fieldName={fieldName}
            fieldSchema={fieldSchema}
            value={initialValue}
            onChange={handleFieldChange}
            onValidation={handleFieldValidation}
            required={isRequired}
            disabled={false}
        />
    )
})

/**
 * IsolatedFormRenderer - Form container that coordinates isolated fields
 * Each field is completely independent and only re-renders when its own data changes
 */
const IsolatedFormRenderer = React.memo(({
    initWidgetData,
    initschema,
    onRealTimeUpdate,
    onUnsavedChanges,
    onValidatedWidgetSync,
    emitWidgetChanged,
    emitWidgetValidated
}) => {
    const schemaRef = useRef(null)
    // Use refs for form state to prevent rerenders
    const updateTimeoutRef = useRef(null)
    const fieldValidationsRef = useRef({})

    // Initialize widget data only once - don't update when initWidgetData changes
    const [widgetData] = useState(initWidgetData)
    const [schema] = useState(initschema)
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

    // Immediate real-time update function
    const triggerRealTimeUpdate = useCallback((newConfig) => {
        if (!widgetData) return

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
    }, [widgetData, emitWidgetChanged, onRealTimeUpdate])

    // Handle field changes from isolated fields
    const handleFieldChange = useCallback((fieldName, value, triggerValidation) => {
        // Just mark the page/object as dirty - field components manage their own data
        if (onUnsavedChanges) {
            onUnsavedChanges(true)
        }

        // Trigger real-time updates - build config from current widget data + this change
        const updatedConfig = {
            ...widgetData.config,
            [fieldName]: value
        }
        triggerRealTimeUpdate(updatedConfig)
    }, [widgetData.config, triggerRealTimeUpdate, onUnsavedChanges])

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
}, (prevProps, nextProps) => {
    // Custom comparison: only re-render if widget data or schema changes
    // Ignore callback prop changes to prevent unnecessary re-renders
    return (
        prevProps.initWidgetData === nextProps.initWidgetData &&
        prevProps.initschema === nextProps.initschema
    )
})

export default IsolatedFormRenderer
