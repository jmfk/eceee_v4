import React, { useState, useEffect, Suspense } from 'react'
import { fieldTypeRegistry } from '../../utils/fieldTypeRegistry'
import { getFieldComponent } from '../form-fields'
import { Loader2 } from 'lucide-react'
import useLocalFormState from '../../hooks/useLocalFormState'
import LocalStateFieldWrapper from './LocalStateFieldWrapper'
import { formatFieldLabel } from '../../utils/labelFormatting'

/**
 * DynamicFormRenderer Component
 * 
 * Renders forms dynamically based on field type definitions from the backend.
 * Uses the field type registry to determine which components to render for each field.
 * 
 * Refactored to use local state management and prevent unnecessary re-renders.
 */
const DynamicFormRenderer = React.memo(({
    schema,
    data = {},
    onChange,
    validation = {},
    isValidating = {},
    onSubmit,
    submitLabel = 'Submit',
    disabled = false,
    className = '',
    namespace = null,
}) => {
    const [fieldComponents, setFieldComponents] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Use local form state management
    const {
        handleFieldChange,
        handleSubmit,
        updateFormData,
        getFormData
    } = useLocalFormState(data, {
        onChange,
        onSubmit,
        validateOnSubmit: true
    })

    // Initialize form data when data prop changes
    useEffect(() => {
        updateFormData(data)
    }, [data, updateFormData])

    // Load field types and components on mount
    useEffect(() => {
        const loadComponents = async () => {
            try {
                setLoading(true)

                // Ensure field types are loaded from backend
                await fieldTypeRegistry.ensureLoaded()

                // Get all field types that are used in the schema
                const usedFieldTypes = new Set()
                if (schema?.properties) {
                    Object.values(schema.properties).forEach(fieldDef => {
                        if (fieldDef.fieldType) {
                            usedFieldTypes.add(fieldDef.fieldType)
                        }
                    })
                }

                // Load components for used field types
                const componentPromises = {}
                for (const fieldType of usedFieldTypes) {
                    const fieldTypeDef = fieldTypeRegistry.getFieldType(fieldType)
                    if (fieldTypeDef?.component) {
                        componentPromises[fieldType] = getFieldComponent(fieldTypeDef.component)
                    }
                }

                const resolvedComponents = {}
                for (const [fieldType, promise] of Object.entries(componentPromises)) {
                    try {
                        resolvedComponents[fieldType] = await promise
                    } catch (err) {
                        console.error(`Failed to load component for field type ${fieldType}:`, err)
                        // Fallback will be handled by getFieldComponent
                        resolvedComponents[fieldType] = await getFieldComponent('TextInput')
                    }
                }

                setFieldComponents(resolvedComponents)
                setError(null)
            } catch (err) {
                console.error('Failed to load form components:', err)
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        loadComponents()
    }, [schema])

    const renderField = (fieldName, fieldDef) => {
        const fieldType = fieldDef.fieldType
        const FieldComponent = fieldComponents[fieldType]

        if (!FieldComponent) {
            return (
                <div key={fieldName} className="p-3 border border-yellow-200 rounded bg-yellow-50">
                    <p className="text-sm text-yellow-700">
                        Loading component for field type: {fieldType}
                    </p>
                </div>
            )
        }

        const fieldValue = data[fieldName]
        const fieldValidation = validation[fieldName]
        const fieldIsValidating = isValidating[fieldName]

        // Get field type definition for additional props
        const fieldTypeDef = fieldTypeRegistry.getFieldType(fieldType)
        const uiProps = fieldTypeDef?.uiProps || {}

        const fieldProps = {
            label: fieldDef.title || formatFieldLabel(fieldName),
            description: fieldDef.description,
            required: schema?.required?.includes(fieldName),
            disabled,
            validation: fieldValidation,
            isValidating: fieldIsValidating,
            namespace: namespace,
            fieldName: fieldName, // Pass fieldName for UDC integration
            // Pass through field type specific UI props
            ...uiProps,
            // Pass through field definition props
            ...fieldDef
        }
        return (
            <div key={fieldName} className="space-y-1">
                <Suspense fallback={
                    <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-gray-500">Loading field...</span>
                    </div>
                }>
                    <LocalStateFieldWrapper
                        fieldName={fieldName}
                        initialValue={fieldValue}
                        FieldComponent={FieldComponent}
                        fieldProps={fieldProps}
                        onFieldChange={handleFieldChange}
                        debounceMs={200}
                        validateOnChange={true}
                    />
                </Suspense>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Loading form...</span>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 border border-red-200 rounded bg-red-50">
                <p className="text-red-700">Failed to load form: {error}</p>
            </div>
        )
    }

    if (!schema?.properties) {
        return (
            <div className="p-4 border border-gray-200 rounded bg-gray-50">
                <p className="text-gray-600">No form schema provided</p>
            </div>
        )
    }

    // Get ordered property keys
    const propertyOrder = schema.propertyOrder || Object.keys(schema.properties)
    const orderedFields = propertyOrder.filter(key => schema.properties[key])

    return (
        <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
            {orderedFields.map(fieldName => {
                const fieldDef = schema.properties[fieldName]
                return renderField(fieldName, fieldDef)
            })}

            {onSubmit && (
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={disabled}
                        className={`
                            px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-colors duration-200
                        `}
                    >
                        {submitLabel}
                    </button>
                </div>
            )}
        </form>
    )
})

DynamicFormRenderer.displayName = 'DynamicFormRenderer'

export default DynamicFormRenderer
