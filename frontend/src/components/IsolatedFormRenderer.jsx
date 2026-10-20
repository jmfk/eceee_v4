import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { ChevronRight } from 'lucide-react'
import { getWidgetSchema, validateWidgetConfiguration } from '../api/widgetSchemas.js'
import SchemaFieldRenderer from './forms/SchemaFieldRenderer.jsx'
import { useFormDataBuffer } from '../hooks/useFormDataBuffer.js'
import { useUnifiedData } from '../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../contexts/unified-data/types/operations'
import { lookupWidget, calculateActiveVariants } from '../utils/widgetUtils'
import { buildWidgetPropUpdate, createActiveWidgetPropContext } from '../utils/pageEditorPropAdapter'

const PRIMARY_FIELD_GROUPS = new Set(['content', 'media', 'layout'])
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const isPrimaryWidgetField = (fieldName, fieldSchema, requiredFields) =>
    requiredFields.includes(fieldName) || fieldSchema.editorPrimary === true || PRIMARY_FIELD_GROUPS.has(fieldSchema.group?.toLowerCase())

const IsolatedFieldWrapper = React.memo(function IsolatedFieldWrapper({
    fieldName, fieldSchema, initialValue, getCurrentWidgetData, isRequired, onFieldChange,
    namespace, context, fullSchema
}) {
    const handleFieldValidation = useCallback(async (name, value) => {
        const current = getCurrentWidgetData()
        if (!current?.type) return null
        const result = await validateWidgetConfiguration(current.type, { ...current.config, [name]: value })
        const errors = result.errors?.[name]
        return {
            isValid: !errors,
            errors: errors ? (Array.isArray(errors) ? errors : [errors]) : [],
            warnings: result.warnings?.[name] || []
        }
    }, [getCurrentWidgetData])
    return <SchemaFieldRenderer fieldName={fieldName} fieldSchema={fieldSchema} value={initialValue}
        onChange={onFieldChange} onValidation={handleFieldValidation} required={isRequired}
        namespace={namespace} context={context} schema={fullSchema} />
}, (previous, next) => Object.keys(next).every(key => key === 'initialValue'
    ? equal(previous[key], next[key]) : previous[key] === next[key]))

// The key below is the only reset boundary. Content edits never recreate a session.
const IsolatedFormSession = forwardRef(function IsolatedFormSession({
    initWidgetData, initschema, namespace, contextType, widgetId, slotName, context,
    onDirtyChange, onWidgetChange, publishChanges
}, ref) {
    const callbacksRef = useRef({ onDirtyChange, onWidgetChange, context, publishChanges })
    callbacksRef.current = { onDirtyChange, onWidgetChange, context, publishChanges }
    const handleDirtyChange = useCallback(dirty => callbacksRef.current.onDirtyChange?.(dirty), [])
    const formBuffer = useFormDataBuffer(initWidgetData, null, { onDirtyChange: handleDirtyChange })
    const { getCurrentData: getCurrentWidgetData, updateField, hydrate } = formBuffer
    const [, renderForm] = useState(0)
    const { useExternalChanges, publishUpdate } = useUnifiedData()
    const componentId = `isolated-form-${widgetId || 'preview'}`
    const [loadedSchema, setLoadedSchema] = useState(null)
    const activeSchema = initschema || loadedSchema
    const schemaProperties = activeSchema?.schema?.properties || activeSchema?.properties

    useImperativeHandle(ref, () => ({ getCurrentWidgetData }), [getCurrentWidgetData])
    useEffect(() => { handleDirtyChange(false) }, [handleDirtyChange])
    useEffect(() => {
        if (initschema || !initWidgetData?.type) return
        let active = true
        getWidgetSchema(initWidgetData.type).then(value => { if (active) setLoadedSchema(value) })
            .catch(error => { if (active) console.error('Failed to fetch widget schema:', error) })
        return () => { active = false }
    }, [initschema, initWidgetData?.type])

    const hydrateWidget = useCallback(incoming => {
        const current = getCurrentWidgetData()
        if (incoming?.config && !equal(current?.config, incoming.config)) {
            hydrate({ ...current, ...incoming })
            renderForm(value => value + 1)
        }
    }, [getCurrentWidgetData, hydrate])

    // Prop owners supply the canonical draft. A matching local echo does nothing.
    useLayoutEffect(() => { hydrateWidget(initWidgetData) }, [initWidgetData, hydrateWidget])
    useExternalChanges(componentId, (state, metadata) => {
        if (!widgetId || !slotName || !contextType) return
        if (metadata?.sourceId?.startsWith(`${componentId}-field-`)) return
        const widget = lookupWidget(state, widgetId, slotName, contextType, context?.widgetPath)
        if (widget) hydrateWidget({ ...getCurrentWidgetData(), config: widget.config })
    })

    const handleFieldChange = useCallback((fieldName, value) => {
        updateField(`config.${fieldName}`, value)
        if (Object.values(schemaProperties || {}).some(field => Array.isArray(field.conditionalOn?.[fieldName]))) {
            renderForm(value => value + 1)
        }
        const current = getCurrentWidgetData()
        const options = callbacksRef.current
        const propUpdate = buildWidgetPropUpdate({
            currentWidgetData: current,
            propContext: createActiveWidgetPropContext({ widgetData: current, context: options.context,
                widgetId, slotName, contextType, componentId }),
            fieldName, value, activeVariants: calculateActiveVariants(current, activeSchema)
        })
        if (options.publishChanges) {
            publishUpdate(propUpdate.fieldSourceId, OperationTypes.UPDATE_WIDGET_CONFIG, propUpdate.udcPayload)
        } else {
            options.onWidgetChange?.(propUpdate.updatedWidget, {
                sourceId: propUpdate.fieldSourceId, configPatch: propUpdate.configPatch
            })
        }
    }, [updateField, getCurrentWidgetData, widgetId, slotName, contextType, componentId, activeSchema, schemaProperties, publishUpdate])

    const widgetPathKey = JSON.stringify(context?.widgetPath || [])
    // Ordinary fields need identity/theme/link context, not a new entire page snapshot on each keystroke.
    const fieldContext = useMemo(() => ({
        widgetId, slotName, contextType, mode: 'edit', managedByForm: true,
        pageId: context?.pageId, versionId: context?.versionId, instanceId: context?.instanceId,
        siteId: context?.siteId, siteRootId: context?.siteRootId,
        webpageData: context?.webpageData, theme: context?.theme || context?.pageVersionData?.effectiveTheme,
        widgetPath: JSON.parse(widgetPathKey)
    }), [widgetId, slotName, contextType, context?.pageId, context?.versionId, context?.instanceId,
        context?.siteId, context?.siteRootId, context?.webpageData, context?.theme,
        context?.pageVersionData?.effectiveTheme, widgetPathKey])
    // Check if form fields should be hidden (widget uses special editor exclusively)
    // The schema might be the full response object from config-ui-schema endpoint
    if (activeSchema?.hideFormFields) {
        return null // Special editor handles all configuration
    }

    if (!schemaProperties) {
        return (
            <div className="text-center text-gray-500 py-8 p-4">
                <div>No configuration options available for this widget.</div>
            </div>
        )
    }
    // Render isolated fields - each field manages its own state and rerenders
    // Get the required fields array from the correct location
    const requiredFields = activeSchema?.schema?.required || activeSchema?.required || []

    const renderedFields = Object.entries(schemaProperties)
        .filter(([, fieldSchema]) => {
            return !fieldSchema.hidden && Object.entries(fieldSchema.conditionalOn || {}).every(
                // Preserve existing behavior for legacy, non-array conditional metadata.
                ([fieldName, allowedValues]) => !Array.isArray(allowedValues) || allowedValues.includes(
                    getCurrentWidgetData()?.config?.[fieldName] ?? schemaProperties[fieldName]?.default
                )
            )
        })

    let primaryFields = renderedFields.filter(([fieldName, fieldSchema]) =>
        isPrimaryWidgetField(fieldName, fieldSchema, requiredFields)
    )

    if (primaryFields.length === 0 && renderedFields.length > 0) {
        primaryFields = [renderedFields[0]]
    }

    const primaryFieldNames = new Set(primaryFields.map(([fieldName]) => fieldName))
    const secondaryFieldGroups = renderedFields.reduce((groups, field) => {
        const [fieldName, fieldSchema] = field
        if (primaryFieldNames.has(fieldName)) return groups

        const groupName = fieldSchema.group || 'More settings'
        const existingFields = groups.get(groupName) || []
        groups.set(groupName, [...existingFields, field])
        return groups
    }, new Map())

    const renderField = ([fieldName, fieldSchema]) => {
        const isRequired = requiredFields.includes(fieldName) || false
        return (
            <IsolatedFieldWrapper
                key={fieldName}
                fieldName={fieldName}
                fieldSchema={fieldSchema}
                initialValue={getCurrentWidgetData()?.config?.[fieldName] ?? ''}
                getCurrentWidgetData={getCurrentWidgetData}
                isRequired={isRequired}
                onFieldChange={handleFieldChange}
                namespace={namespace}
                context={fieldSchema.component === 'PageSectionsDisplayField' ? context : fieldContext}
                fullSchema={activeSchema?.schema || activeSchema}
            />
        )
    }

    return (
        <div className="space-y-4 p-4 min-w-0">
            {primaryFields.map(renderField)}
            {[...secondaryFieldGroups.entries()].map(([groupName, fields]) => (
                <details key={groupName} className="group border-t border-gray-200 pt-2">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform group-open:rotate-90" aria-hidden="true" />
                        <span>{groupName}</span>
                    </summary>
                    <div className="space-y-4 pt-3">
                        {fields.map(renderField)}
                    </div>
                </details>
            ))}
        </div>
    )
})

const IsolatedFormRenderer = forwardRef(function IsolatedFormRenderer(props, ref) {
    const context = props.context || {}
    const widgetId = props.widgetId || props.initWidgetData?.id
    const slotName = props.slotName || props.initWidgetData?.slotName || props.initWidgetData?.slot
    const contextType = props.contextType || context.contextType
    const sessionKey = JSON.stringify([contextType, context.pageId, context.instanceId, context.versionId,
        widgetId, props.initWidgetData?.type, slotName, context.widgetPath || []])
    return <IsolatedFormSession {...props} key={sessionKey} ref={ref} context={context}
        widgetId={widgetId} slotName={slotName} contextType={contextType}
        publishChanges={props.publishChanges ?? true} />
})

export default IsolatedFormRenderer
