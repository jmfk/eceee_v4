import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { getWidgetSchema, validateWidgetConfiguration } from '../api/widgetSchemas.js'
import { WIDGET_CHANGE_TYPES } from '../types/widgetEvents'
import SchemaFieldRenderer from './forms/SchemaFieldRenderer.jsx'
import { useFormDataBuffer } from '../hooks/useFormDataBuffer.js'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../contexts/unified-data/types/operations'
import { lookupWidget, hasWidgetContentChanged } from '../utils/widgetUtils'

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
    namespace = null,
    context = {},
    fullSchema = null, // Full schema with $defs for resolving $ref
}) => {
    // Get initial value from widget data
    const initialValue = widgetData?.config?.[fieldName] ?? ''

    // Hide fields that are managed by special editors
    const hiddenFields = {
        'eceee_widgets.ImageWidget': ['collectionId', 'collectionConfig', 'mediaItems']
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

            return fieldValidation
        } catch (error) {
            console.error(`Field validation failed for ${fieldName}:`, error)
            const errorValidation = {
                isValid: false,
                errors: ['Validation failed'],
                warnings: []
            }
            return errorValidation
        }
    }, [fieldName, widgetData])

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
                context={context}
                schema={fullSchema}
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
            context={context}
            schema={fullSchema}
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
    namespace = null,
    contextType = null,
    widgetId = null,
    slotName = null,
    context = {}
}) => {
    const schemaRef = useRef(null)
    // Use refs for form state to prevent rerenders
    const fieldValidationsRef = useRef({})

    // ODC Integration
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData()
    const componentId = useMemo(() => `isolated-form-${widgetId || 'preview'}`, [widgetId])

    // Ref to track current config for ODC synchronization
    const configRef = useRef(initWidgetData?.config || {})

    // Use form data buffer to store changes without re-renders
    const formBuffer = useFormDataBuffer(initWidgetData)

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

    // ODC External Changes Subscription - Listen for updates from other components
    useExternalChanges(componentId, (state) => {
        if (!widgetId || !slotName || !contextType) return

        const widgetPath = context?.widgetPath
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        if (widget && widget.config && hasWidgetContentChanged(configRef.current, widget.config)) {

            configRef.current = widget.config
            // Update form buffer with new config from ODC
            formBuffer.resetTo({ ...initWidgetData, config: widget.config })
        }
    })

    // Handle field changes from isolated fields
    const handleFieldChange = useCallback(async (fieldName, value, triggerValidation) => {
        // Update field in buffer without re-rendering
        const fieldPath = `config.${fieldName}`
        formBuffer.updateField(fieldPath, value)

        // Get updated config for real-time updates
        const currentData = formBuffer.getCurrentData()

        // Extract widgetPath from context for nested widget support
        const widgetPath = context?.widgetPath

        await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetId,
            slotName: slotName,
            contextType: contextType,
            config: currentData.config,
            // NEW: Path-based approach (supports infinite nesting)
            widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
        })
    }, [formBuffer, context, componentId, widgetId, slotName, contextType, publishUpdate])

    const activeSchema = schemaRef.current || schema

    // Check if form fields should be hidden (widget uses special editor exclusively)
    // The schema might be the full response object from config-ui-schema endpoint
    if (activeSchema?.hideFormFields) {
        return null // Special editor handles all configuration
    }

    // Extract the actual schema if we received the full config-ui-schema response
    const schemaProperties = activeSchema?.schema?.properties || activeSchema?.properties

    if (!schemaProperties) {
        return (
            <div className="text-center text-gray-500 py-8 p-4">
                <p>No configuration options available for this widget.</p>
            </div>
        )
    }
    // Render isolated fields - each field manages its own state and rerenders
    // Get the required fields array from the correct location
    const requiredFields = activeSchema?.schema?.required || activeSchema?.required || []

    return (
        <div className="space-y-4 p-4">
            {Object.entries(schemaProperties)
                .filter(([fieldName, fieldSchema]) => {
                    // Filter out hidden fields
                    return !fieldSchema.hidden
                })
                .map(([fieldName, fieldSchema]) => {
                    const isRequired = requiredFields.includes(fieldName) || false

                    return (
                        <IsolatedFieldWrapper
                            key={fieldName}
                            fieldName={fieldName}
                            fieldSchema={fieldSchema}
                            widgetData={formBuffer.getCurrentData()}
                            widgetType={formBuffer.getCurrentData()?.type || ''}
                            isRequired={isRequired}
                            onFieldChange={handleFieldChange}
                            namespace={namespace}
                            context={context}
                            fullSchema={activeSchema?.schema || activeSchema}
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
