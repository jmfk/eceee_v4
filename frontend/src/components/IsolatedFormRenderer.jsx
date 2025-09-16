import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getWidgetSchema, validateWidgetConfiguration } from '../api/widgetSchemas.js'
import { WIDGET_CHANGE_TYPES } from '../types/widgetEvents'
import SchemaFieldRenderer from './forms/SchemaFieldRenderer.jsx'
import { useFormDataBuffer } from '../hooks/useFormDataBuffer.js'

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
    onValidationChange,
    namespace = null
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
                namespace={namespace}
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
            namespace={namespace}
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
    emitWidgetValidated,
    namespace = null
}) => {
    const schemaRef = useRef(null)
    // Use refs for form state to prevent rerenders
    const updateTimeoutRef = useRef(null)
    const fieldValidationsRef = useRef({})

    // Use form data buffer to store changes without re-renders
    const formBuffer = useFormDataBuffer(
        initWidgetData,
        onValidatedWidgetSync,
        {
            onDirtyChange: onUnsavedChanges,
            onRealTimeUpdate: (data) => {
                // Trigger real-time updates for preview
                onRealTimeUpdate?.(data)
                emitWidgetChanged?.(data, WIDGET_CHANGE_TYPES.CONFIG_UPDATED)
            }
        }
    )

    // Keep original state for schema and type info (these don't change frequently)
    const [schema] = useState(initschema)
    // Store schema in ref
    useEffect(() => {
        const currentData = formBuffer.getCurrentData()
        if (currentData && !schema) {
            const fetchSchema = async () => {
                try {
                    const schemaData = await getWidgetSchema(currentData.type)
                    schemaRef.current = schemaData
                } catch (error) {
                    console.error('Failed to fetch widget schema:', error)
                }
            }
            fetchSchema()
        } else if (schema) {
            schemaRef.current = schema
        }
    }, [schema, formBuffer])

    // Immediate real-time update function
    const triggerRealTimeUpdate = useCallback((newConfig) => {
        const currentData = formBuffer.getCurrentData()
        if (!currentData) return

        const updatedWidget = { ...currentData, config: newConfig }

        // Emit event for real-time updates
        if (emitWidgetChanged) {
            emitWidgetChanged(
                currentData.id,
                currentData.slotName,
                updatedWidget,
                WIDGET_CHANGE_TYPES.CONFIG
            )
        }

        // Fallback for components not using event system
        if (onRealTimeUpdate && !emitWidgetChanged) {
            onRealTimeUpdate(updatedWidget)
        }
    }, [formBuffer, emitWidgetChanged, onRealTimeUpdate])

    // Handle field changes from isolated fields
    const handleFieldChange = useCallback((fieldName, value, triggerValidation) => {
        // Update field in buffer without re-rendering
        const fieldPath = `config.${fieldName}`
        formBuffer.updateField(fieldPath, value)

        // Get updated config for real-time updates
        const currentData = formBuffer.getCurrentData()
        triggerRealTimeUpdate(currentData.config)
    }, [formBuffer, triggerRealTimeUpdate])

    // Handle validation changes from individual fields
    const handleValidationChange = useCallback((fieldName, validation) => {
        fieldValidationsRef.current[fieldName] = validation

        // Check overall validity and emit events
        const hasErrors = Object.values(fieldValidationsRef.current).some(v => v && !v.isValid)
        const isValid = !hasErrors

        // Emit validation event
        if (emitWidgetValidated) {
            const currentData = formBuffer.getCurrentData()
            emitWidgetValidated(currentData.id, currentData.slotName, {
                isValid,
                errors: fieldValidationsRef.current,
                warnings: {}
            })
        }
    }, [formBuffer, emitWidgetValidated, onValidatedWidgetSync])

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
                        widgetData={formBuffer.getCurrentData()}
                        widgetType={formBuffer.getCurrentData()?.type || ''}
                        isRequired={isRequired}
                        onFieldChange={handleFieldChange}
                        onValidationChange={handleValidationChange}
                        namespace={namespace}
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
