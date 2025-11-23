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
    // Extract UDC context
    const widgetId = context?.widgetId || widgetData?.id
    const slotName = context?.slotName || widgetData?.slotName || widgetData?.slot
    const contextType = context?.contextType
    const widgetPath = context?.widgetPath

    // UDC Integration for field-level updates
    const { useExternalChanges, getState } = useUnifiedData()
    const fieldComponentId = useMemo(() =>
        `field-${widgetId || 'preview'}-${fieldName}`,
        [widgetId, fieldName]
    )

    // All fields subscribe to field-level paths - BannerWidget now only publishes to field-level
    // This avoids the self-update filter issue and prevents form rerenders
    const subscriptionComponentId = useMemo(() => {
        // All fields (including content) subscribe to field-level paths
        // BannerWidget publishes to field-* paths, so this will receive updates
        return fieldComponentId
    }, [fieldComponentId])

    // Local state for this field to receive external updates
    const [fieldValue, setFieldValue] = useState(widgetData?.config?.[fieldName] ?? '')
    const fieldValueRef = useRef(fieldValue)

    // Subscribe to UDC updates for this specific field
    useExternalChanges(subscriptionComponentId, (state, metadata) => {
        if (!widgetId || !slotName || !contextType) {
            return
        }
        // All fields subscribe to field-level paths, so sourceId should be field-*
        // No special filtering needed - UDC will handle self-update filtering
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        const newFieldValue = widget?.config?.[fieldName]

        if (newFieldValue !== undefined && newFieldValue !== fieldValueRef.current) {
            const sourceId = metadata?.sourceId || ''

            // Check if update came from this form field itself (self-update)
            // Form publishes with isolated-form-* componentId prefix, so sourceId starts with isolated-form-*
            const isSelfUpdate = sourceId.startsWith('isolated-form-')

            if (!isSelfUpdate) {
                // External update (from WYSIWYG editor with bannerwidget-* sourceId) - update field value
                fieldValueRef.current = newFieldValue
                setFieldValue(newFieldValue)
            } else {
                // Self update from form field - just sync ref, no rerender
                fieldValueRef.current = newFieldValue
            }
        }
    })

    // Sync fieldValue when widgetData prop changes (initial load)
    useEffect(() => {
        const propValue = widgetData?.config?.[fieldName] ?? ''
        if (propValue !== fieldValueRef.current) {
            fieldValueRef.current = propValue
            setFieldValue(propValue)
        }
    }, [widgetData?.config?.[fieldName], fieldName])

    // Use fieldValue state instead of widgetData for initial value
    const initialValue = fieldValue

    // Hide fields that are managed by special editors
    const hiddenFields = {
        'easy_widgets.ImageWidget': ['collectionId', 'collectionConfig', 'mediaItems']
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
    context = {},
    onDirtyChange = null
}) => {
    const schemaRef = useRef(null)
    // Use refs for form state to prevent rerenders
    const fieldValidationsRef = useRef({})

    // ODC Integration
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData()
    const componentId = useMemo(() => `isolated-form-${widgetId || 'preview'}`, [widgetId])

    // Ref to track current config for ODC synchronization
    const configRef = useRef(initWidgetData?.config || {})
    // Ref to track last UDC update timestamp to prevent prop sync from overwriting UDC updates
    const lastUdcUpdateRef = useRef(0)

    // Callback for dirty state changes
    const handleDirtyChange = useCallback((isDirty) => {
        // Notify parent component of dirty state changes
        if (onDirtyChange) {
            onDirtyChange(isDirty)
        }
    }, [onDirtyChange])

    // Use form data buffer to store changes without re-renders
    const formBuffer = useFormDataBuffer(initWidgetData, null, {
        onDirtyChange: handleDirtyChange
    })

    // Memoize current widget data to prevent rerenders from new object references
    // formBuffer.getCurrentData() returns a new object each time, so we need to memoize
    const currentWidgetDataRef = useRef(initWidgetData)
    const getCurrentWidgetData = useCallback(() => {
        const currentData = formBuffer.getCurrentData() || initWidgetData
        // Only update ref if data actually changed (by ID comparison)
        if (currentData?.id !== currentWidgetDataRef.current?.id ||
            JSON.stringify(currentData?.config) !== JSON.stringify(currentWidgetDataRef.current?.config)) {
            currentWidgetDataRef.current = currentData
        }
        return currentWidgetDataRef.current
    }, [formBuffer, initWidgetData])

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

    // Sync initWidgetData prop changes to state and formBuffer
    // BUT: Don't overwrite if we just received a UDC update (to prevent prop updates from overriding UDC)
    useEffect(() => {
        if (initWidgetData) {
            // Check if this prop update is newer than our last UDC update
            // If UDC updated recently (within last 100ms), skip prop sync to prevent overwriting
            const timeSinceLastUdcUpdate = Date.now() - lastUdcUpdateRef.current
            if (timeSinceLastUdcUpdate < 100) {
                // UDC update just happened, don't overwrite with stale prop data
                return
            }

            // Check if the prop config is actually different from current UDC state
            const currentUdcConfig = configRef.current
            const propConfig = initWidgetData?.config || {}

            // If prop config matches UDC config, it's safe to sync (no conflict)
            // If prop config is different, it might be stale, so check if UDC is newer
            if (JSON.stringify(propConfig) !== JSON.stringify(currentUdcConfig)) {
                // Configs differ - UDC is source of truth, don't overwrite
                return
            }

            // Safe to sync - configs match or UDC hasn't updated recently
            formBuffer.resetTo(initWidgetData)
            configRef.current = initWidgetData?.config || {}
        }
    }, [initWidgetData, formBuffer])

    // ODC External Changes Subscription - Listen for updates from other components
    useExternalChanges(componentId, (state, metadata) => {
        if (!widgetId || !slotName || !contextType) return

        const sourceId = metadata?.sourceId || ''

        // Skip updates from field-level sources - those are handled by individual fields
        // This prevents form rerenders when fields update via field-level subscriptions
        if (sourceId.startsWith('field-') || sourceId.includes('-field-')) {
            // Field-level updates are handled by IsolatedFieldWrapper subscriptions
            // Don't update widgetData here to prevent form rerenders
            // Only sync the config ref silently
            const widgetPath = context?.widgetPath
            const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
            if (widget && widget.config) {
                configRef.current = widget.config
            }
            return
        }

        // Skip widget-level updates from widgets when they're publishing field-level changes
        // Widgets publish with bannerwidget-*-field-* pattern, which we already skip above
        // But also check for direct widget-level updates that are single-field changes
        const isWidgetSource = sourceId.startsWith('bannerwidget-') ||
            sourceId.startsWith('two-columns-widget-') ||
            sourceId.startsWith('three-columns-widget-') ||
            sourceId.startsWith('section-widget-') ||
            sourceId.startsWith('contentcardwidget-') ||
            sourceId.startsWith('widget-') ||
            /^[a-z-]+widget-\d+/.test(sourceId)

        if (isWidgetSource && !sourceId.includes('-field-')) {
            // Widget-level update from a widget - check if it's a single field update
            const widgetPath = context?.widgetPath
            const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
            if (widget && widget.config) {
                // Check if this is a single field update by comparing with current config
                const currentConfig = configRef.current
                const newConfig = widget.config

                // Count how many fields changed
                const allKeys = new Set([...Object.keys(newConfig), ...Object.keys(currentConfig)])
                const changedFields = Array.from(allKeys).filter(key => {
                    const newVal = newConfig[key]
                    const currentVal = currentConfig[key]
                    return JSON.stringify(newVal) !== JSON.stringify(currentVal)
                })

                // If only one field changed, it's a field-level update - skip it
                if (changedFields.length === 1) {
                    // Only sync the config ref silently
                    configRef.current = widget.config
                    return
                }
            }
        }

        // Also skip save operations - they don't need to trigger form rerenders
        // Fields will sync from UDC state when needed
        if (sourceId === 'udc-save-current-version') {
            // Save operation completed - just sync config ref, no rerender
            const widgetPath = context?.widgetPath
            const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
            if (widget && widget.config) {
                configRef.current = widget.config
            }
            return
        }

        const widgetPath = context?.widgetPath
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        if (widget && widget.config && hasWidgetContentChanged(configRef.current, widget.config)) {
            // Mark this as a UDC update to prevent prop sync from overwriting it
            lastUdcUpdateRef.current = Date.now()

            configRef.current = widget.config
            const updatedData = { ...initWidgetData, config: widget.config }
            // Update form buffer with new config from UDC
            formBuffer.resetTo(updatedData)
            // NO setWidgetData() - fields sync via their own subscriptions, no form rerender needed
        }
    })

    // Handle field changes from isolated fields
    const handleFieldChange = useCallback(async (fieldName, value, triggerValidation) => {
        // Update field in buffer without re-rendering
        const fieldPath = `config.${fieldName}`
        formBuffer.updateField(fieldPath, value)

        // Get updated config for real-time updates
        const currentData = formBuffer.getCurrentData()

        // Don't update widgetData state here - fields manage their own state
        // and only need widgetData for initial values. Updating state here causes
        // unnecessary rerenders of all fields. State is only updated when external
        // changes come in (see useExternalChanges above).

        // Extract widgetPath from context for nested widget support
        const widgetPath = context?.widgetPath

        // Publish with isolated-form componentId prefix for field updates
        // Use sourceId: isolated-form-${widgetId}-field-${fieldName}
        // Fields subscribe to field-${widgetId}-${fieldName}, so sourceId !== componentId
        const fieldSourceId = `${componentId}-field-${fieldName}` // isolated-form-${widgetId}-field-content
        await publishUpdate(fieldSourceId, OperationTypes.UPDATE_WIDGET_CONFIG, {
            id: widgetId,
            slotName: slotName,
            contextType: contextType,
            config: { [fieldName]: value }, // Only publish the changed field
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

    const renderedFields = Object.entries(schemaProperties)
        .filter(([fieldName, fieldSchema]) => {
            // Filter out hidden fields
            return !fieldSchema.hidden
        })

    return (
        <div className="space-y-4 p-4 min-w-0">
            {renderedFields.map(([fieldName, fieldSchema]) => {
                const isRequired = requiredFields.includes(fieldName) || false
                return (
                    <IsolatedFieldWrapper
                        key={fieldName}
                        fieldName={fieldName}
                        fieldSchema={fieldSchema}
                        widgetData={getCurrentWidgetData()}
                        widgetType={getCurrentWidgetData()?.type || ''}
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
    // Custom comparison: only rerender if props actually changed
    // Return true if props are equal (prevent rerender), false if different (allow rerender)

    // Compare primitive props
    if (prevProps.widgetId !== nextProps.widgetId) return false
    if (prevProps.slotName !== nextProps.slotName) return false
    if (prevProps.contextType !== nextProps.contextType) return false
    if (prevProps.namespace !== nextProps.namespace) return false

    // Compare schema reference (should be stable)
    if (prevProps.initschema !== nextProps.initschema) return false

    // Compare widget data by ID
    const prevId = prevProps.initWidgetData?.id
    const nextId = nextProps.initWidgetData?.id
    if (prevId !== nextId) return false

    // Compare widget type
    const prevType = prevProps.initWidgetData?.type
    const nextType = nextProps.initWidgetData?.type
    if (prevType !== nextType) return false

    // Deep compare config objects - only rerender if config actually changed
    const prevConfig = prevProps.initWidgetData?.config
    const nextConfig = nextProps.initWidgetData?.config

    // If both are undefined/null, they're equal
    if (!prevConfig && !nextConfig) {
        // Continue to context comparison
    } else if (!prevConfig || !nextConfig) {
        return false // One is null, other isn't
    } else {
        // Both exist, do deep comparison
        try {
            if (JSON.stringify(prevConfig) !== JSON.stringify(nextConfig)) {
                return false
            }
        } catch (e) {
            // If JSON.stringify fails, assume they're different to be safe
            return false
        }
    }

    // Deep compare context object
    const prevContext = prevProps.context
    const nextContext = nextProps.context

    // If both are empty objects or undefined, they're equal
    if ((!prevContext || Object.keys(prevContext).length === 0) &&
        (!nextContext || Object.keys(nextContext).length === 0)) {
        return true
    }

    // Compare context deeply
    try {
        if (JSON.stringify(prevContext) !== JSON.stringify(nextContext)) {
            return false
        }
    } catch (e) {
        // If JSON.stringify fails, assume they're different to be safe
        return false
    }

    // All props are equal, prevent rerender
    return true
})

export default IsolatedFormRenderer
