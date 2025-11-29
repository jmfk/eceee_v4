import React, { Suspense } from 'react'
import { FIELD_COMPONENTS } from '../../form-fields'
import { Loader2 } from 'lucide-react'

/**
 * ItemForm Component
 * 
 * Pure presentational component - renders form fields based on schema.
 * Uses UNCONTROLLED inputs (defaultValue) for performance - DOM holds the truth.
 * Receives current item data from ItemCard's itemRef (synced via UDC).
 * Calls onFieldChange handler (provided by ItemCard) when fields change.
 * ItemCard handles all state management and UDC integration.
 */
const ItemForm = ({ item, schema, disabled, errors = [], onFieldChange }) => {
    // Use item prop directly - it comes from ItemCard's itemRef.current

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

    // Early return AFTER all hooks
    if (!schema || !schema.fields || schema.fields.length === 0) {
        return (
            <div className="text-sm text-gray-500 p-4 text-center">
                No fields defined for this item
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {schema.fields.map((field, idx) => {
                // Use item prop directly - component is uncontrolled, DOM maintains state
                const fieldValue = item[field.name]
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
                    label: field.label,
                    description: field.description,
                    required: field.required || false,
                    disabled: disabled || field.disabled || false,
                    placeholder: field.placeholder,
                    defaultValue: fieldValue, // UNCONTROLLED - only sets initial value
                    onChange: (value) => onFieldChange(field.name, value),
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
// Like a native input element - NEVER re-renders based on item data changes
export default React.memo(ItemForm, (prevProps, nextProps) => {
    // Only re-render if UI control props change, NOT item data
    return (
        prevProps.schema === nextProps.schema &&
        prevProps.disabled === nextProps.disabled &&
        JSON.stringify(prevProps.errors) === JSON.stringify(nextProps.errors) &&
        prevProps.onFieldChange === nextProps.onFieldChange
        // Deliberately NOT comparing item - we're uncontrolled
    )
})