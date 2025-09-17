import React, { Suspense } from 'react'
import { fieldTypeRegistry } from '../../utils/fieldTypeRegistry'
import { getFieldComponent, FIELD_COMPONENTS } from '../form-fields'
import { Loader2 } from 'lucide-react'
import LocalStateFieldWrapper from './LocalStateFieldWrapper'

/**
 * FieldPlaceholder - Shows a visual representation of the field while loading
 * Looks as close as possible to the final component to avoid layout shifts
 */
const FieldPlaceholder = ({ componentName, label, value, ...props }) => {
    const baseClasses = "w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"

    const renderPlaceholder = () => {
        switch (componentName) {
            case 'SegmentedControlInput':
                return (
                    <div className="flex rounded-md overflow-hidden border border-gray-300 bg-gray-50">
                        {(props.options || []).map((option, index) => (
                            <div
                                key={index}
                                className="flex-1 px-3 py-2 text-center text-sm text-gray-500 border-r border-gray-300 last:border-r-0"
                            >
                                {option.label || option.value || `Option ${index + 1}`}
                            </div>
                        ))}
                        {(!props.options || props.options.length === 0) && (
                            <>
                                <div className="flex-1 px-3 py-2 text-center text-sm text-gray-500 border-r border-gray-300">Option 1</div>
                                <div className="flex-1 px-3 py-2 text-center text-sm text-gray-500">Option 2</div>
                            </>
                        )}
                    </div>
                )

            case 'SliderInput':
                return (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>{props.min || 0}</span>
                            <span className="font-medium">{value || props.min || 0}</span>
                            <span>{props.max || 100}</span>
                        </div>
                        <div className="relative">
                            <div className="w-full h-2 bg-gray-200 rounded-full">
                                <div
                                    className="h-2 bg-gray-400 rounded-full"
                                    style={{ width: '50%' }}
                                />
                            </div>
                        </div>
                    </div>
                )

            case 'BooleanInput':
                return (
                    <div className="flex items-center">
                        <div className="w-12 h-6 bg-gray-300 rounded-full relative">
                            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                        </div>
                    </div>
                )

            case 'SelectInput':
                return (
                    <div className={`${baseClasses} flex justify-between items-center`}>
                        <span>{props.placeholder || 'Select an option...'}</span>
                        <span className="text-gray-400">▼</span>
                    </div>
                )

            case 'TextareaInput':
                return (
                    <textarea
                        className={`${baseClasses} resize-none`}
                        rows={props.rows || 3}
                        placeholder={props.placeholder || 'Enter text...'}
                        value=""
                        readOnly
                    />
                )

            default:
                return (
                    <input
                        type="text"
                        className={baseClasses}
                        placeholder={props.placeholder || 'Loading...'}
                        value=""
                        readOnly
                    />
                )
        }
    }

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}
            {renderPlaceholder()}
            {props.description && (
                <p className="text-sm text-gray-500">{props.description}</p>
            )}
        </div>
    )
}

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
    namespace = null,
    ...props
}) => {
    // Map JSON Schema type/format to our field type system
    const mapSchemaToFieldType = (schema) => {
        const { type, format, enum: enumValues, controlType } = schema

        // First check for explicit controlType from json_schema_extra
        if (controlType) {
            return controlType
        }

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

    // Check if schema specifies a direct component (from Pydantic json_schema_extra)
    const componentName = fieldSchema.component

    if (componentName) {
        // Filter out JSON Schema metadata and only pass component-relevant props
        const {
            // JSON Schema properties to exclude
            type, format, title, description: schemaDescription,
            component, category, order, enum: enumValues,
            anyOf, oneOf, allOf, $ref, $defs, properties, items,
            minimum, maximum, minLength, maxLength, pattern,
            const: constValue, default: defaultValue,
            // Include only component-relevant properties
            ...componentProps
        } = fieldSchema

        // Load component asynchronously
        const FieldComponent = React.lazy(() => {
            if (FIELD_COMPONENTS[componentName]) {
                return FIELD_COMPONENTS[componentName]()
            }
            console.warn(`Field component '${componentName}' not found, falling back to TextInput`)
            return FIELD_COMPONENTS.TextInput()
        })

        const fieldProps = {
            label: fieldSchema.title || fieldName,
            description: fieldSchema.description,
            required,
            disabled,
            placeholder: fieldSchema.placeholder,
            namespace: namespace,
            ...componentProps
        }
        return (
            <Suspense fallback={
                <FieldPlaceholder
                    componentName={componentName}
                    label={fieldProps.label}
                    value={value}
                    {...componentProps}
                />
            }>
                <LocalStateFieldWrapper
                    key={fieldName}
                    fieldName={fieldName}
                    initialValue={value}
                    FieldComponent={FieldComponent}
                    fieldProps={fieldProps}
                    onFieldChange={onChange}
                    onFieldValidation={props.onValidation}
                    debounceMs={200}
                    validateOnChange={true}
                />
            </Suspense>
        )
    }

    // Fallback: Use field type registry for non-Pydantic fields
    const fieldType = mapSchemaToFieldType(fieldSchema)
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

    // Dynamically load the field component from registry
    const FieldComponent = React.lazy(() => {
        if (FIELD_COMPONENTS[fieldTypeDef.component]) {
            return FIELD_COMPONENTS[fieldTypeDef.component]()
        }
        // Fallback to TextInput if component not found
        console.warn(`Field component '${fieldTypeDef.component}' not found, falling back to TextInput`)
        return FIELD_COMPONENTS.TextInput()
    })

    // Prepare props for the field component
    const fieldProps = {
        label: fieldSchema.title || fieldName,
        description: fieldSchema.description,
        required,
        disabled,
        placeholder: fieldSchema.placeholder,
        namespace: namespace,
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
        // Handle image field types
        ...(fieldType === 'image' && {
            constraints: {
                allowedTypes: fieldSchema.allowedTypes,
                minWidth: fieldSchema.minWidth,
                maxWidth: fieldSchema.maxWidth,
                minHeight: fieldSchema.minHeight,
                maxHeight: fieldSchema.maxHeight,
                minSize: fieldSchema.minSize,
                maxSize: fieldSchema.maxSize,
                aspectRatio: fieldSchema.aspectRatio,
                exactDimensions: fieldSchema.exactDimensions,
            },
            autoTags: fieldSchema.autoTags,
            defaultCollection: fieldSchema.defaultCollection,
            maxFiles: fieldSchema.maxFiles,
            multiple: fieldSchema.multiple,
            maxItems: fieldSchema.maxItems,
            minItems: fieldSchema.minItems,
        }),
        // Handle file field types
        ...(fieldType === 'file' && {
            allowedFileTypes: fieldSchema.allowedFileTypes,
            allowedMimeTypes: fieldSchema.allowedMimeTypes,
            allowedExtensions: fieldSchema.allowedExtensions,
            fileTypeLabel: fieldSchema.fileTypeLabel,
            maxFileSize: fieldSchema.maxFileSize,
            minFileSize: fieldSchema.minFileSize,
            autoTags: fieldSchema.autoTags,
            defaultCollection: fieldSchema.defaultCollection,
            maxFiles: fieldSchema.maxFiles,
            multiple: fieldSchema.multiple,
            maxItems: fieldSchema.maxItems,
            minItems: fieldSchema.minItems,
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
            <LocalStateFieldWrapper
                key={fieldName}
                fieldName={fieldName}
                initialValue={value}
                FieldComponent={FieldComponent}
                fieldProps={fieldProps}
                onFieldChange={onChange}
                onFieldValidation={props.onValidation}
                debounceMs={200}
                validateOnChange={true}
            />
        </Suspense>
    )
}

SchemaFieldRenderer.displayName = 'SchemaFieldRenderer'

export default SchemaFieldRenderer
