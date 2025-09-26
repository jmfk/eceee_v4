import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { getWidgetSchema, validateWidgetConfiguration } from '../api/widgetSchemas.js'
import { WIDGET_CHANGE_TYPES } from '../types/widgetEvents'
import SchemaFieldRenderer from './forms/SchemaFieldRenderer.jsx'
import { useFormDataBuffer } from '../hooks/useFormDataBuffer.js'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../contexts/unified-data/types/operations'
import { getWidgetConfig, hasWidgetContentChanged } from '../utils/widgetUtils'

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
        // console.log("getWidgetSchema")
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

        const { widget } = getWidgetConfig(state, widgetId, slotName, contextType)
        if (widget && widget.config && hasWidgetContentChanged(configRef.current, widget.config)) {
            console.log("IsolatedFormRenderer: Received external ODC update", {
                widgetId,
                slotName,
                contextType,
                oldDisplayType: configRef.current?.displayType,
                newDisplayType: widget.config?.displayType,
                oldCollectionConfig: configRef.current?.collectionConfig,
                newCollectionConfig: widget.config?.collectionConfig
            })

            configRef.current = widget.config
            // Update form buffer with new config from ODC
            formBuffer.resetTo({ ...initWidgetData, config: widget.config })
        }
    })

    // Handle field changes from isolated fields
    const handleFieldChange = useCallback(async (fieldName, value, triggerValidation) => {
        console.log("handleFieldChange", fieldName, value)
        //console.log("formBuffer", formBuffer)
        // Update field in buffer without re-rendering
        const fieldPath = `config.${fieldName}`
        formBuffer.updateField(fieldPath, value)

        // Get updated config for real-time updates
        const currentData = formBuffer.getCurrentData()
        //console.log("widgetId", widgetId)
        //console.log("slotName", slotName)
        //console.log("contextType", contextType)
        console.log("SEND currentData.config", currentData.config)
        await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetId,
            slotName: slotName,
            contextType: contextType,
            config: currentData.config
        })
    }, [formBuffer])

    const activeSchema = schemaRef.current || schema

    if (!activeSchema?.properties) {
        return (
            <div className="text-center text-gray-500 py-8 p-4">
                <p>No configuration options available for this widget.</p>
            </div>
        )
    }

    //console.log("IsolatedFormRenderer::render")
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
                        namespace={namespace}
                        context={context}
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
