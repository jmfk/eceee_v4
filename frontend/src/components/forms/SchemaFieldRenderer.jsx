import React, { Suspense } from 'react'
import { fieldTypeRegistry } from '../../utils/fieldTypeRegistry'
import { getFieldComponent } from '../form-fields'
import { Loader2 } from 'lucide-react'

/**
 * SchemaFieldRenderer Component
 * 
 * Bridges between JSON Schema field definitions and our new field type system.
 * Maps schema properties to appropriate field components based on type and format.
 */
const SchemaFieldRenderer = ({
    fieldName,
    fieldSchema,
    value,
    onChange,
    validation,
    isValidating,
    required = false,
    disabled = false,
    ...props
}) => {
    // Map JSON Schema type/format to our field type system
    const mapSchemaToFieldType = (schema) => {
        const { type, format, enum: enumValues } = schema

        // Handle enum fields
        if (enumValues && Array.isArray(enumValues)) {
            return 'choice'
        }

        // Handle based on type and format
        switch (type) {
            case 'string':
                switch (format) {
                    case 'textarea':
                        return 'textarea'
                    case 'email':
                        return 'email'
                    case 'uri':
                    case 'url':
                        return 'url'
                    case 'password':
                        return 'password'
                    case 'date':
                        return 'date'
                    case 'date-time':
                        return 'datetime'
                    case 'time':
                        return 'time'
                    default:
                        return 'text'
                }
            case 'number':
            case 'integer':
                return 'number'
            case 'boolean':
                return 'boolean'
            case 'array':
                // Check if it's a multi-choice field
                if (schema.items?.enum) {
                    return 'multi_choice'
                }
                return 'text' // Fallback
            default:
                return 'text'
        }
    }

    // Get the appropriate field type
    const fieldType = mapSchemaToFieldType(fieldSchema)

    // Get field type definition from registry
    const fieldTypeDef = fieldTypeRegistry.getFieldType(fieldType)

    if (!fieldTypeDef) {
        // Fallback to basic input if field type not found
        return (
            <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                    {fieldSchema.title || fieldName}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={fieldSchema.placeholder}
                />
                {fieldSchema.description && (
                    <p className="text-sm text-gray-500">{fieldSchema.description}</p>
                )}
            </div>
        )
    }

    // Dynamically load the field component
    const FieldComponent = React.lazy(() => getFieldComponent(fieldTypeDef.component))

    // Prepare props for the field component
    const fieldProps = {
        value,
        onChange,
        validation,
        isValidating,
        label: fieldSchema.title || fieldName,
        description: fieldSchema.description,
        required,
        disabled,
        placeholder: fieldSchema.placeholder,
        // Map schema properties to field-specific props
        ...(fieldType === 'textarea' && {
            rows: fieldSchema.rows || 3,
            maxLength: fieldSchema.maxLength || fieldSchema.max_length,
            showCharacterCount: true,
        }),
        ...(fieldType === 'number' && {
            min: fieldSchema.minimum,
            max: fieldSchema.maximum,
            step: fieldSchema.multipleOf || 'any',
        }),
        ...(fieldType === 'password' && {
            minLength: fieldSchema.minLength || fieldSchema.min_length || 8,
            showStrengthIndicator: true,
        }),
        ...(fieldType === 'choice' && {
            options: fieldSchema.enum || [],
        }),
        ...(fieldType === 'multi_choice' && {
            options: fieldSchema.items?.enum || [],
        }),
        ...(fieldType === 'date' && {
            min: fieldSchema.minimum,
            max: fieldSchema.maximum,
        }),
        ...(fieldType === 'datetime' && {
            min: fieldSchema.minimum,
            max: fieldSchema.maximum,
        }),
        ...(fieldType === 'time' && {
            min: fieldSchema.minimum,
            max: fieldSchema.maximum,
            step: fieldSchema.step || 60,
        }),
        // Pass through any additional UI props from field type definition
        ...(fieldTypeDef.uiProps || {}),
        // Allow override with explicit props
        ...props,
    }

    return (
        <Suspense fallback={
            <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm text-gray-500">Loading field...</span>
            </div>
        }>
            <FieldComponent {...fieldProps} />
        </Suspense>
    )
}

SchemaFieldRenderer.displayName = 'SchemaFieldRenderer'

export default SchemaFieldRenderer
