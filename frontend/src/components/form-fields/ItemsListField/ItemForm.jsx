import React, { useState, useRef, useCallback, useMemo, Suspense } from 'react'
import { FIELD_COMPONENTS } from '../../form-fields'
import { Loader2 } from 'lucide-react'
import { useUnifiedData } from '../../../contexts/unified-data/context/UnifiedDataContext'
import { OperationTypes } from '../../../contexts/unified-data/types/operations'
import { lookupWidget } from '../../../utils/widgetUtils'

/**
 * ItemForm Component
 * 
 * Renders a dynamic form for an item based on its schema.
 * UDC-integrated - gets item from UDC, publishes changes to UDC.
 * Uses UNCONTROLLED inputs for performance - DOM holds the truth.
 * Only re-renders on external UDC changes via key remount.
 */
const ItemForm = ({ initialItem, schema, disabled, errors = [], context = {}, itemIndex }) => {
    // Extract UDC context
    const widgetId = context?.widgetId
    const slotName = context?.slotName
    const contextType = context?.contextType
    const widgetPath = context?.widgetPath
    const fieldName = context?.fieldName

    // UDC Integration
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData()
    const componentId = useMemo(() =>
        `item-form-${widgetId || 'preview'}-${fieldName || 'items'}-${itemIndex}`,
        [widgetId, fieldName, itemIndex]
    )
    console.log("ItemForm::componentId", componentId)
    // Helper to get item from UDC
    const getItemFromUDC = useCallback(() => {
        if (widgetId && slotName && contextType && fieldName && getState) {
            const state = getState()
            const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
            if (widget && widget.config && widget.config[fieldName]) {
                const items = widget.config[fieldName]
                if (Array.isArray(items) && items[itemIndex] !== undefined) {
                    return items[itemIndex]
                }
            }
        }
        return initialItem || {}
    }, [widgetId, slotName, contextType, fieldName, getState, widgetPath, itemIndex, initialItem])

    // Ref holds current item values (source of truth between renders)
    const itemRef = useRef(getItemFromUDC())

    // Key to force remount when external changes occur
    const [formKey, setFormKey] = useState(0)

    // Subscribe to UDC for external changes ONLY
    useExternalChanges(componentId, (state) => {
        if (!widgetId || !slotName || !contextType || !fieldName) {
            return
        }

        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        if (widget && widget.config && widget.config[fieldName]) {
            const items = widget.config[fieldName]
            if (Array.isArray(items) && items[itemIndex] !== undefined) {
                const externalItem = items[itemIndex]
                // Only remount if external change differs from our ref
                if (JSON.stringify(externalItem) !== JSON.stringify(itemRef.current)) {
                    console.log("ItemForm: External change detected, remounting", externalItem)
                    itemRef.current = externalItem
                    setFormKey(prev => prev + 1) // Force remount with new defaultValues
                }
            }
        }
    })

    if (!schema || !schema.fields || schema.fields.length === 0) {
        return (
            <div className="text-sm text-gray-500 p-4 text-center">
                No fields defined for this item
            </div>
        )
    }

    // Handle field changes - update ref and publish to UDC (NO re-render)
    const handleFieldChange = useCallback(async (changedFieldName, value) => {

        console.log("handleFieldChange", changedFieldName, value)
        // Update our internal ref (no state change = no re-render)
        const updatedItem = {
            ...itemRef.current,
            [changedFieldName]: value
        }
        itemRef.current = updatedItem

        // Publish to UDC
        if (!publishUpdate || !widgetId || !slotName || !contextType || !fieldName) {
            return
        }

        // Get current items array from UDC
        const state = getState()
        const widget = lookupWidget(state, widgetId, slotName, contextType, widgetPath)
        console.log(widget, widget.config, widget.config[fieldName])
        if (widget && widget.config && widget.config[fieldName]) {
            const currentItems = widget.config[fieldName] || []
            const newItems = [...currentItems]
            newItems[itemIndex] = updatedItem
            console.log("Publish changes")
            // Publish full array to UDC (batched automatically by UDC)
            await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                id: widgetId,
                slotName: slotName,
                contextType: contextType,
                config: { [fieldName]: newItems },
                widgetPath: widgetPath && widgetPath.length > 0 ? widgetPath : undefined
            })
        }
    }, [publishUpdate, widgetId, slotName, contextType, fieldName, itemIndex, widgetPath, componentId, getState])

    const getFieldError = (fieldName) => {
        if (!errors || errors.length === 0) return null

        const fieldErrors = errors.filter(err =>
            err.field === fieldName || err.path?.includes(fieldName)
        )

        if (fieldErrors.length === 0) return null

        return {
            isValid: false,
            errors: fieldErrors.map(err => err.message || err.error)
        }
    }
    console.log("render::ItemForm")
    return (
        <div key={formKey} className="space-y-4">
            {schema.fields.map((field, idx) => {
                const fieldValue = itemRef.current[field.name]
                const fieldValidation = getFieldError(field.name)

                // Determine which component to use
                const componentName = field.component || mapFieldTypeToComponent(field)

                // Dynamically load the field component
                const FieldComponent = React.lazy(() => {
                    if (FIELD_COMPONENTS[componentName]) {
                        return FIELD_COMPONENTS[componentName]()
                    }
                    console.warn(`Field component '${componentName}' not found, falling back to TextInput`)
                    return FIELD_COMPONENTS.TextInput()
                })

                const fieldProps = {
                    label: field.title || field.label || field.name,
                    description: field.description,
                    required: field.required || false,
                    disabled: disabled || field.disabled || false,
                    placeholder: field.placeholder,
                    defaultValue: fieldValue, // UNCONTROLLED - only sets initial value
                    onChange: (value) => handleFieldChange(field.name, value),
                    validation: fieldValidation,
                    // Field-specific props
                    ...field.props
                }

                return (
                    <Suspense
                        key={field.name || idx}
                        fallback={
                            <div className="space-y-1">
                                <label className="block text-sm font-medium text-gray-700">
                                    {fieldProps.label}
                                </label>
                                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center space-x-2">
                                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                                    <span className="text-sm text-gray-500">Loading...</span>
                                </div>
                            </div>
                        }
                    >
                        <FieldComponent {...fieldProps} />
                    </Suspense>
                )
            })}
        </div>
    )
}

/**
 * Map field type to component name
 * Helper function to determine which component to use based on field type
 */
function mapFieldTypeToComponent(field) {
    const { type, format, widget, enum: enumValues } = field

    // Check for explicit widget/control type
    if (widget) return widget

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
            // For simple arrays, use TagInput
            if (field.items?.type === 'string') {
                return 'TagInput'
            }
            // For arrays of enums, use MultiSelectInput
            if (field.items?.enum) {
                return 'MultiSelectInput'
            }
            // Default to text for now
            return 'TextInput'

        default:
            return 'TextInput'
    }
}

ItemForm.displayName = 'ItemForm'

// Memoize to prevent re-renders when parent re-renders
// Item data comes from UDC, not props
export default React.memo(ItemForm, (prevProps, nextProps) => {
    // Only re-render if UI control props change
    return (
        prevProps.itemIndex === nextProps.itemIndex &&
        prevProps.schema === nextProps.schema &&
        prevProps.disabled === nextProps.disabled &&
        JSON.stringify(prevProps.errors) === JSON.stringify(nextProps.errors) &&
        JSON.stringify(prevProps.context) === JSON.stringify(nextProps.context)
    )
})