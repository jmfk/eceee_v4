import React, { forwardRef, useState, useEffect, Suspense } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { fieldTypeRegistry } from '../utils/fieldTypeRegistry'
import { getFieldComponent } from './form-fields'
import LocalStateFieldWrapper from './forms/LocalStateFieldWrapper'

const ObjectSchemaForm = React.memo(forwardRef(({ schema, data = {}, onChange, namespace }, ref) => {
    const [fieldComponents, setFieldComponents] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Load field types and components on mount
    useEffect(() => {
        const loadComponents = async () => {
            try {
                setLoading(true)

                if (!schema?.fields || !Array.isArray(schema.fields)) {
                    setLoading(false)
                    return
                }

                // Ensure field types are loaded from backend
                await fieldTypeRegistry.ensureLoaded()

                // Get all components that are used in the schema
                const usedComponents = new Set()
                schema.fields.forEach(field => {
                    if (field.component) {
                        usedComponents.add(field.component)
                    }
                })

                // Load components
                const componentPromises = {}
                for (const componentName of usedComponents) {
                    componentPromises[componentName] = getFieldComponent(componentName)
                }

                const resolvedComponents = {}
                for (const [componentName, promise] of Object.entries(componentPromises)) {
                    try {
                        resolvedComponents[componentName] = await promise
                    } catch (err) {
                        console.error(`Failed to load component ${componentName}:`, err)
                        // Fallback to TextInput
                        resolvedComponents[componentName] = await getFieldComponent('TextInput')
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

    const handleFieldChange = (fieldName, value) => {
        onChange?.(fieldName, value)
    }

    if (!schema?.fields || !Array.isArray(schema.fields)) {
        return (
            <div className="text-center py-8 text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p>No schema fields defined</p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Loading form components...</span>
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

    const renderField = (field) => {
        const fieldValue = data[field.name]
        const componentName = field.component


        // Get the dynamically loaded component
        const FieldComponent = fieldComponents[componentName]

        if (!FieldComponent) {
            return (
                <div key={field.name} className="p-3 border border-yellow-200 rounded bg-yellow-50">
                    <p className="text-sm text-yellow-700">
                        Loading component: {componentName || 'Unknown'}
                    </p>
                </div>
            )
        }

        // Get field type definition for additional props
        const fieldType = field.fieldType || field.type
        const fieldTypeDef = fieldTypeRegistry.getFieldType(fieldType)
        const uiProps = fieldTypeDef?.uiProps || {}
        // Get field config values from field definition
        const configValues = field.config || {}
        // Props for the field component (without value and onChange)
        // LocalStateFieldWrapper will handle validation internally
        const fieldProps = {
            label: field.label || field.name,
            description: field.help || field.description,
            required: field.required,
            placeholder: field.placeholder || `Enter ${field.label || field.name}...`,
            // Pass namespace for media operations
            namespace: namespace,
            // Pass fieldName for UDC integration
            fieldName: field.name,
            // Pass through field type specific UI props
            ...uiProps,
            // Pass through field definition props (like min, max, options, etc.)
            ...field
        }

        return (
            <div key={field.name} className="space-y-1">
                <Suspense fallback={
                    <div className="flex items-center space-x-2 p-3 border border-gray-200 rounded">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-gray-500">Loading field...</span>
                    </div>
                }>
                    <LocalStateFieldWrapper
                        fieldName={field.name}
                        initialValue={fieldValue}
                        FieldComponent={FieldComponent}
                        fieldProps={fieldProps}
                        onFieldChange={handleFieldChange}
                        debounceMs={300}
                        validateOnChange={true}
                    />
                </Suspense>
            </div>
        )
    }

    return (
        <div ref={ref} className="space-y-6">
            {schema.fields.map(renderField)}
        </div>
    )
}), (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Return true = "props are equal" = SKIP re-render
    // Return false = "props changed" = DO re-render

    // ONLY re-render if the actual field structure changes
    const prevFields = prevProps.schema?.fields || []
    const nextFields = nextProps.schema?.fields || []

    // Compare field structure (names and components)
    if (prevFields.length !== nextFields.length) {
        return false // Different number of fields
    }

    for (let i = 0; i < prevFields.length; i++) {
        const prevField = prevFields[i]
        const nextField = nextFields[i]

        // Only care about structural changes that affect rendering
        if (prevField?.name !== nextField?.name ||
            prevField?.component !== nextField?.component) {
            return false // Field structure changed
        }
    }

    // Check if namespace changed (important for media fields)
    if (prevProps.namespace !== nextProps.namespace) {
        return false // Namespace changed, need to re-render
    }

    // IGNORE OTHER CHANGES:
    // - data prop changes (LocalStateFieldWrapper manages initial values)
    // - onChange prop changes (LocalStateFieldWrapper manages callbacks)
    // Note: errors prop removed - LocalStateFieldWrapper handles validation internally

    return true // Props are "equal" - skip re-render
})

ObjectSchemaForm.displayName = 'ObjectSchemaForm'

export default ObjectSchemaForm
