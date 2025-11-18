import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../contexts/unified-data/types/operations'
import { lookupWidget } from '../../utils/widgetUtils'
import { getFieldComponent } from './index'
import SegmentedControlInput from './SegmentedControlInput'
import SelectInput from './SelectInput'
import { api } from '../../api/client.js'

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
    value = {}, // Complex value: {activeGroup: "pageSections", formData: {pageSections: {...}, ...}}
    onChange, // Called with full value object when changed
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    // ConditionalGroupField-specific props
    groups = {}, // Group configuration from json_schema_extra
    variant = 'buttons', // 'buttons' or 'selectbox'
    context = {}, // UDC context
    fieldName, // Field name (for UDC publishing)
    ...props
}) => {
    // Destructure the complex value
    const { activeGroup: initialActiveGroup, formData: initialFormData } = value

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

    // Local state
    const [activeGroup, setActiveGroup] = useState(initialActiveGroup || Object.keys(groups)[0] || 'none')
    const [schemas, setSchemas] = useState({}) // Fetched Pydantic model schemas
    const [schemaLoading, setSchemaLoading] = useState({}) // Loading state per group
    const [schemaErrors, setSchemaErrors] = useState({}) // Error state per group
    const [formKey, setFormKey] = useState(0) // Force remount when switching groups

    // Ref for ALL groups' form data (uncontrolled like ItemForm)
    // Structure: {pageSections: {...}, pageSubmenu: {...}, none: {}}
    const formDataRef = useRef(initialFormData || {})

    // Update ref when value prop changes (external changes)
    useEffect(() => {
        const externalActiveGroup = value?.activeGroup
        const externalFormData = value?.formData || {}

        if (externalActiveGroup && externalActiveGroup !== activeGroup) {
            setActiveGroup(externalActiveGroup)
            formDataRef.current = externalFormData
            setFormKey(prev => prev + 1)
        } else if (JSON.stringify(externalFormData) !== JSON.stringify(formDataRef.current)) {
            formDataRef.current = externalFormData
            setFormKey(prev => prev + 1)
        }
    }, [value, activeGroup])

    // Fetch schema for a config model
    const fetchSchema = useCallback(async (modelName, groupKey) => {
        setSchemaLoading(prev => ({ ...prev, [groupKey]: true }))
        setSchemaErrors(prev => ({ ...prev, [groupKey]: null }))

        try {
            const response = await api.get(`/api/v1/webpages/pydantic-models/${modelName}/schema/`)
            setSchemas(prev => ({ ...prev, [groupKey]: response.data.schema }))
        } catch (error) {
            console.error(`Error fetching schema for ${modelName}:`, error)
            const errorMessage = error.response?.data?.error || error.message || `Failed to fetch schema for ${modelName}`
            setSchemaErrors(prev => ({ ...prev, [groupKey]: errorMessage }))
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
        if (widget && widget.config && widget.config[fieldName]) {
            const externalValue = widget.config[fieldName]  // Full complex value
            const externalActiveGroup = externalValue.activeGroup
            const externalFormData = externalValue.formData || {}

            // Check if change is from this component (internal change)
            const isInternalChange = metadata?.sourceId === componentId

            // Handle active group change
            if (externalActiveGroup !== activeGroup) {
                setActiveGroup(externalActiveGroup)
                formDataRef.current = externalFormData
                setFormKey(prev => prev + 1)  // Remount to show new group's data
                return
            }

            // Handle form data changes (compare full dict)
            if (JSON.stringify(externalFormData) !== JSON.stringify(formDataRef.current)) {
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

        // DON'T clear form data - all groups' data is preserved in formDataRef
        // Just switch which group we're viewing
        setFormKey(prev => prev + 1) // Force form remount to show new group's data

        // Create new value object
        const newValue = {
            activeGroup: newGroup,
            formData: formDataRef.current  // ALL groups' data preserved
        }

        // Call onChange if provided
        onChange?.(newValue)

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
                    ...currentConfig,  // Preserve existing config (menuItems, etc.)
                    [fieldName]: newValue  // Single complex value
                },
                widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
            })
        }
    }, [disabled, activeGroup, onChange, publishUpdate, widgetId, slotName, contextType, fieldName, widgetPath, componentId, getState])

    // Handle field changes within active form
    const handleFieldChange = useCallback(async (changedFieldName, fieldValue) => {
        // Get current group's data
        const currentGroupData = formDataRef.current[activeGroup] || {}

        // Update only the active group's data
        const updatedGroupData = {
            ...currentGroupData,
            [changedFieldName]: fieldValue
        }

        // Update ref with new group data (no re-render)
        formDataRef.current = {
            ...formDataRef.current,
            [activeGroup]: updatedGroupData
        }

        // Create new value object
        const newValue = {
            activeGroup: activeGroup,
            formData: formDataRef.current  // ALL groups' data
        }

        // Call onChange if provided
        onChange?.(newValue)

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
                    ...currentConfig,  // Preserve existing config (menuItems, etc.)
                    [fieldName]: newValue  // Single complex value
                },
                widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
            })
        }
    }, [publishUpdate, widgetId, slotName, contextType, fieldName, activeGroup, widgetPath, componentId, getState, onChange])

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

        // Get current group's data from the full dict
        const currentGroupData = formDataRef.current[activeGroup] || {}

        return (
            <div key={formKey} className="space-y-4 mt-4">
                {Object.entries(properties).map(([propName, propSchema]) => {
                    const fieldValue = currentGroupData[propName] || ''  // Read from active group's data
                    const isRequired = requiredFields.includes(propName)

                    // Determine component from json_schema_extra or type
                    const componentName = propSchema.component ||
                        propSchema.control_type ||
                        mapSchemaTypeToComponent(propSchema)
                    // Extract schema props, filtering out internal JSON schema metadata
                    const {
                        component: _component,
                        control_type: _controlType,
                        hidden: _hidden,
                        order: _order,
                        group: _group,
                        conditionalOn: _conditionalOn,
                        fieldName: _fieldName,
                        ...schemaProps
                    } = propSchema

                    const fieldProps = {
                        label: propSchema.title || propName,
                        description: propSchema.description,
                        required: isRequired,
                        disabled: disabled,
                        placeholder: propSchema.placeholder,
                        defaultValue: fieldValue,
                        onChange: (value) => handleFieldChange(propName, value),
                        validation: validation?.[propName],
                        context: context,  // Pass context through to child fields
                        formData: currentGroupData,  // Pass current group's form data to child fields
                        ...schemaProps // Pass filtered schema props (options, min, max, etc.)
                    }

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

