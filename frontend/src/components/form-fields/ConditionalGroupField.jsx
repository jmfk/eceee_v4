import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { lookupWidget } from '../../utils/widgetUtils'
import { getFieldComponent } from './index'
import SegmentedControlInput from './SegmentedControlInput'
import SelectInput from './SelectInput'

/**
 * ConditionalGroupField Component
 * 
 * A generic form field that displays a button group or selectbox to switch between
 * different configuration forms. Each group can reference a Pydantic model for its schema.
 * 
 * Features:
 * - Dynamic schema fetching from backend
 * - UDC integration for state management
 * - Support for "none" option (no form rendered)
 * - Automatic form clearing when switching groups
 * - Validation support
 * 
 * Usage:
 * <ConditionalGroupField
 *   groups={{
 *     internal: { label: "Internal", icon: "FileText", configModel: "InternalLinkConfig" },
 *     external: { label: "External", icon: "ExternalLink", configModel: "ExternalLinkConfig" },
 *     none: { label: "None" }
 *   }}
 *   variant="buttons"
 *   context={{ widgetId, slotName, contextType }}
 *   fieldName="linkType"
 * />
 */
const ConditionalGroupField = ({
    value, // Current active group (e.g., "internal", "external", "none") - from UDC
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    // ConditionalGroupField-specific props
    groups = {}, // Group configuration from json_schema_extra
    variant = 'buttons', // 'buttons' or 'selectbox'
    formData = {}, // Current form data for active group (camelCase)
    context = {}, // UDC context
    fieldName, // Field name for this conditional group field
    ...props
}) => {
    // Extract UDC context
    const widgetId = context?.widgetId
    const slotName = context?.slotName
    const contextType = context?.contextType
    const widgetPath = context?.widgetPath
    const parentComponentId = context?.parentComponentId

    // UDC Integration
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData()

    // Create hierarchical componentId
    const componentId = useMemo(() => {
        if (parentComponentId) {
            return `${parentComponentId}-conditional-${fieldName || 'group'}`
        }
        return `conditional-group-${widgetId || 'preview'}-${fieldName || 'group'}`
    }, [parentComponentId, widgetId, fieldName])

    // Helper to get initial form data from UDC
    const getFormDataFromUDC = useCallback(() => {
        if (widgetId && slotName && contextType && fieldName && getState) {
            const state = getState()
            const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
            if (widget && widget.config) {
                return widget.config[`${fieldName}Config`] || {}
            }
        }
        return formData || {}
    }, [widgetId, slotName, contextType, fieldName, getState, widgetPath, formData])

    // Local state
    const [activeGroup, setActiveGroup] = useState(value || Object.keys(groups)[0] || 'none')
    const [schemas, setSchemas] = useState({}) // Fetched Pydantic model schemas
    const [schemaLoading, setSchemaLoading] = useState({}) // Loading state per group
    const [schemaErrors, setSchemaErrors] = useState({}) // Error state per group
    const [formKey, setFormKey] = useState(0) // Force remount when switching groups

    // Ref for form data (uncontrolled like ItemForm) - initialize lazily
    const formDataRef = useRef(null)

    // Initialize ref from UDC on first render
    if (formDataRef.current === null) {
        formDataRef.current = getFormDataFromUDC()
    }

    // Update ref when formData prop changes (external changes)
    useEffect(() => {
        if (JSON.stringify(formData) !== JSON.stringify(formDataRef.current)) {
            formDataRef.current = formData || {}
            setFormKey(prev => prev + 1) // Force remount
        }
    }, [formData])

    // Fetch schema for a config model
    const fetchSchema = useCallback(async (modelName, groupKey) => {
        setSchemaLoading(prev => ({ ...prev, [groupKey]: true }))
        setSchemaErrors(prev => ({ ...prev, [groupKey]: null }))

        try {
            const response = await fetch(`/api/v1/webpages/pydantic-models/${modelName}/schema/`)
            if (!response.ok) {
                throw new Error(`Failed to fetch schema for ${modelName}`)
            }
            const data = await response.json()
            setSchemas(prev => ({ ...prev, [groupKey]: data.schema }))
        } catch (error) {
            console.error(`Error fetching schema for ${modelName}:`, error)
            setSchemaErrors(prev => ({ ...prev, [groupKey]: error.message }))
        } finally {
            setSchemaLoading(prev => ({ ...prev, [groupKey]: false }))
        }
    }, [])

    // Fetch schemas for all groups with configModel on mount
    useEffect(() => {
        Object.entries(groups).forEach(([groupKey, groupConfig]) => {
            if (groupConfig.configModel && !schemas[groupKey]) {
                fetchSchema(groupConfig.configModel, groupKey)
            }
        })
    }, [groups, schemas, fetchSchema])

    // Subscribe to UDC for external changes
    useExternalChanges(componentId, (state, metadata) => {
        if (!widgetId || !slotName || !contextType || !fieldName) {
            return
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        if (widget && widget.config) {
            const externalActiveGroup = widget.config[fieldName]
            const externalFormData = widget.config[`${fieldName}Config`] || {}  // Note: camelCase suffix

            // Check if change is from this component (internal change)
            const isInternalChange = metadata?.sourceId === componentId

            // Check if external change differs from our current state
            if (externalActiveGroup !== activeGroup) {
                setActiveGroup(externalActiveGroup)
                formDataRef.current = externalFormData
                setFormKey(prev => prev + 1)
            } else if (JSON.stringify(externalFormData) !== JSON.stringify(formDataRef.current)) {
                if (isInternalChange) {
                    // Internal change (from our own field edits) - just sync ref, no remount
                    formDataRef.current = externalFormData
                } else {
                    // External change - sync ref AND remount to update defaultValues
                    formDataRef.current = externalFormData
                    setFormKey(prev => prev + 1)
                }
            }
        }
    })

    // Handle group change
    const handleGroupChange = useCallback(async (newGroup) => {
        if (disabled) return
        if (newGroup === activeGroup) return

        setActiveGroup(newGroup)

        // Clear form data when switching groups
        formDataRef.current = {}
        setFormKey(prev => prev + 1) // Force form remount

        // Publish to UDC - Get current config and merge
        if (publishUpdate && widgetId && slotName && contextType && fieldName && getState) {
            const state = getState()
            const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
            const currentConfig = widget?.config || {}

            await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                slotName: slotName,
                contextType: contextType,
                config: {
                    ...currentConfig,  // Preserve existing config
                    [fieldName]: newGroup,
                    [`${fieldName}Config`]: {}  // Note: camelCase suffix
                },
                widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
            })
        }
    }, [disabled, activeGroup, publishUpdate, widgetId, slotName, contextType, fieldName, widgetPath, componentId, getState])

    // Handle field changes within active form
    const handleFieldChange = useCallback(async (changedFieldName, fieldValue) => {
        console.log("handleFieldChange", changedFieldName, fieldValue, "fieldName", fieldName)
        // Update ref (no re-render)
        formDataRef.current = {
            ...formDataRef.current,
            [changedFieldName]: fieldValue
        }

        // Publish to UDC - Get current config and merge
        if (publishUpdate && widgetId && slotName && contextType && fieldName && getState) {
            const state = getState()
            const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
            const currentConfig = widget?.config || {}

            await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                slotName: slotName,
                contextType: contextType,
                config: {
                    ...currentConfig,  // Preserve existing config
                    [fieldName]: activeGroup,
                    [`${fieldName}Config`]: formDataRef.current  // Note: camelCase suffix
                },
                widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
            })
        }
    }, [publishUpdate, widgetId, slotName, contextType, fieldName, activeGroup, widgetPath, componentId, getState])

    // Prepare group options for selector
    const groupOptions = useMemo(() => {
        return Object.entries(groups).map(([key, config]) => ({
            value: key,
            label: config.label || key,
            icon: config.icon
        }))
    }, [groups])

    // Get active group config
    const activeGroupConfig = groups[activeGroup] || {}
    const hasConfigModel = !!activeGroupConfig.configModel
    const schema = schemas[activeGroup]
    const isLoading = schemaLoading[activeGroup]
    const error = schemaErrors[activeGroup]

    // Render form fields from schema
    const renderFormFields = () => {
        console.log("renderFormFields")
        if (!hasConfigModel) {
            // "none" option or group without configModel
            return (
                <div className="text-sm text-gray-500 italic py-4">
                    No configuration needed for this option.
                </div>
            )
        }

        if (isLoading) {
            return (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    <span className="ml-2 text-sm text-gray-600">Loading form...</span>
                </div>
            )
        }

        if (error) {
            return (
                <div className="flex items-center text-red-600 py-4">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    <div>
                        <div className="font-medium">Failed to load form</div>
                        <div className="text-sm text-red-500">{error}</div>
                    </div>
                </div>
            )
        }

        if (!schema) {
            return (
                <div className="text-sm text-gray-500 py-4">
                    No schema available for this option.
                </div>
            )
        }

        // Render fields from schema
        const properties = schema.properties || {}
        const requiredFields = schema.required || []

        return (
            <div key={formKey} className="space-y-4 mt-4">
                {Object.entries(properties).map(([propName, propSchema]) => {
                    const fieldValue = formDataRef.current[propName] || ''
                    const isRequired = requiredFields.includes(propName)

                    // Determine component from json_schema_extra or type
                    const componentName = propSchema.component ||
                        propSchema.control_type ||
                        mapSchemaTypeToComponent(propSchema)
                    console.log("fieldValue", fieldValue)
                    const fieldProps = {
                        label: propSchema.title || propName,
                        description: propSchema.description,
                        required: isRequired,
                        disabled: disabled,
                        placeholder: propSchema.placeholder,
                        defaultValue: fieldValue,
                        onChange: (value) => handleFieldChange(propName, value),
                        validation: validation?.[propName],
                        ...propSchema // Pass all schema props (options, min, max, etc.)
                    }
                    console.log("componentName", componentName)
                    console.log(fieldProps)
                    return (
                        <DynamicFieldLoader
                            key={propName}
                            componentName={componentName}
                            fieldProps={fieldProps}
                        />
                    )
                })}
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Description */}
            {description && (
                <p className="text-sm text-gray-500 -mt-1">{description}</p>
            )}

            {/* Group Selector */}
            {variant === 'buttons' ? (
                <SegmentedControlInput
                    value={activeGroup}
                    onChange={handleGroupChange}
                    options={groupOptions}
                    disabled={disabled}
                    fullWidth={false}
                />
            ) : (
                <SelectInput
                    value={activeGroup}
                    onChange={handleGroupChange}
                    options={groupOptions}
                    disabled={disabled}
                />
            )}

            {/* Conditional Form */}
            {renderFormFields()}

            {/* Validation Message */}
            {validation && !validation.isValid && (
                <div className="text-sm text-red-600 mt-1">
                    {validation.errors?.[0] || 'Invalid configuration'}
                </div>
            )}

            {/* Validating Indicator */}
            {isValidating && (
                <div className="text-sm text-blue-600 flex items-center mt-1">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Validating...
                </div>
            )}
        </div>
    )
}

/**
 * DynamicFieldLoader - loads field components without lazy loading
 */
const DynamicFieldLoader = ({ componentName, fieldProps }) => {
    const [FieldComponent, setFieldComponent] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let mounted = true

        const loadComponent = async () => {
            try {
                const component = await getFieldComponent(componentName)
                if (mounted) {
                    setFieldComponent(() => component)
                    setIsLoading(false)
                }
            } catch (error) {
                console.error(`Failed to load component ${componentName}:`, error)
                if (mounted) {
                    setIsLoading(false)
                }
            }
        }

        loadComponent()

        return () => {
            mounted = false
        }
    }, [componentName])

    if (isLoading || !FieldComponent) {
        return (
            <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                    {fieldProps.label}
                </label>
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    <span className="text-sm text-gray-500">Loading...</span>
                </div>
            </div>
        )
    }
    console.log(FieldComponent)
    return <FieldComponent {...fieldProps} />
}

/**
 * Map JSON schema type to component name
 */
function mapSchemaTypeToComponent(propSchema) {
    const { type, format, enum: enumValues } = propSchema

    // Handle enums
    if (enumValues && Array.isArray(enumValues)) {
        return 'SelectInput'
    }

    // Handle based on type and format
    switch (type) {
        case 'string':
            if (format === 'textarea') return 'TextareaInput'
            if (format === 'email') return 'EmailInput'
            if (format === 'url' || format === 'uri') return 'URLInput'
            if (format === 'password') return 'PasswordInput'
            if (format === 'date') return 'DateInput'
            if (format === 'datetime' || format === 'date-time') return 'DateTimeInput'
            if (format === 'time') return 'TimeInput'
            if (format === 'color') return 'ColorInput'
            return 'TextInput'

        case 'number':
        case 'integer':
            return 'NumberInput'

        case 'boolean':
            return 'BooleanInput'

        case 'array':
            if (propSchema.items?.type === 'string') {
                return 'TagInput'
            }
            if (propSchema.items?.enum) {
                return 'MultiSelectInput'
            }
            return 'ItemsListField'

        default:
            return 'TextInput'
    }
}

ConditionalGroupField.displayName = 'ConditionalGroupField'

// Memoize to prevent unnecessary re-renders
export default React.memo(ConditionalGroupField, (prevProps, nextProps) => {
    return (
        prevProps.value === nextProps.value &&
        prevProps.disabled === nextProps.disabled &&
        JSON.stringify(prevProps.groups) === JSON.stringify(nextProps.groups) &&
        JSON.stringify(prevProps.formData) === JSON.stringify(nextProps.formData) &&
        JSON.stringify(prevProps.validation) === JSON.stringify(nextProps.validation) &&
        JSON.stringify(prevProps.context) === JSON.stringify(nextProps.context)
    )
})

