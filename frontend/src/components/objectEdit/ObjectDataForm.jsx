import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { namespacesApi } from '../../api'
import { objectTypesApi } from '../../api/objectStorage'
import ObjectSchemaForm from '../ObjectSchemaForm'

/**
 * Self-contained form component for object data management
 * Handles form state, validation, and change tracking internally
 */
const ObjectDataForm = forwardRef(({
    objectType,
    instance,
    isNewInstance,
    onSave,
    onValidationChange,
    onFormChange,
    context
}, ref) => {
    const [namespace, setNamespace] = useState(null)

    // Form state management
    const [formData, setFormData] = useState({
        objectTypeId: objectType?.id || '',
        title: instance?.title || '',
        data: instance?.data || {},
        status: instance?.status || 'draft',
        widgets: instance?.widgets || {},
        metadata: instance?.metadata || {}
    })

    const [errors, setErrors] = useState({})

    // Fetch available object types for selection (when creating)
    const { data: typesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getActive(),
        enabled: Boolean(isNewInstance)
    })

    const availableTypes = typesResponse?.data || []

    // Load namespace for media operations (object type's namespace or default)
    useEffect(() => {
        const loadNamespace = async () => {
            try {
                if (objectType?.namespace?.slug) {
                    // Use the object type's specific namespace
                    setNamespace(objectType.namespace.slug)
                } else {
                    // Fall back to default namespace
                    const defaultNamespace = await namespacesApi.getDefault()
                    setNamespace(defaultNamespace?.slug || null)
                }
            } catch (error) {
                console.error('Failed to load namespace:', error)
                setNamespace(null)
            }
        }

        loadNamespace()
    }, [objectType?.namespace])

    // Update form data when instance changes
    useEffect(() => {
        if (instance) {
            const newFormData = {
                objectTypeId: instance.objectType?.id || '',
                title: instance.title || '',
                data: instance.data || {},
                status: instance.status || 'draft',
                widgets: instance.widgets || {},
                metadata: instance.metadata || {}
            }

            setFormData(newFormData)
            setErrors({}) // Clear errors when instance changes
        }
    }, [instance])

    // Helper function to convert object type schema to ObjectSchemaForm format
    const getSchemaFromObjectType = useCallback((objectType) => {
        if (!objectType?.schema?.properties) {
            return { fields: [] }
        }

        const properties = objectType.schema.properties
        const required = objectType.schema.required || []
        const propertyOrder = objectType.schema.propertyOrder || []

        // Use propertyOrder if available, otherwise use object keys
        const keysToProcess = propertyOrder.length > 0 ? propertyOrder : Object.keys(properties)

        const fields = keysToProcess.map(propName => {
            // Skip 'title' field as it's handled by the model, not schema data
            if (propName === 'title') {
                return null
            }

            if (properties[propName]) {
                const property = properties[propName]
                return {
                    name: propName,
                    required: required.includes(propName),
                    ...property,
                    // Map title to label for ObjectSchemaForm compatibility
                    label: property.title || property.label || propName
                }
            }
            return null
        }).filter(Boolean)

        return { fields }
    }, [])

    // Form validation
    const validateForm = useCallback(() => {
        const newErrors = {}

        if (!formData.objectTypeId) {
            newErrors.objectTypeId = 'Object type is required'
        }

        if (!formData.title?.trim()) {
            newErrors.title = 'Title is required'
        }

        // Validate required schema fields
        if (objectType?.schema?.properties) {
            const required = objectType.schema.required || []
            required.forEach(fieldName => {
                if (!formData.data[fieldName] || formData.data[fieldName] === '') {
                    newErrors[`data_${fieldName}`] = `${fieldName} is required`
                }
            })
        }

        setErrors(newErrors)
        const isValid = Object.keys(newErrors).length === 0

        // Notify parent about validation state
        onValidationChange?.(isValid, newErrors)

        return isValid
    }, [formData, objectType, onValidationChange])

    // Update form field and mark as dirty
    const handleInputChange = useCallback((field, value) => {
        setFormData(prev => {
            const newData = { ...prev, [field]: value }
            onFormChange?.(newData)
            return newData
        })

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }))
        }
    }, [errors, onFormChange])

    // Update nested data field
    const handleDataFieldChange = useCallback((fieldName, value) => {
        setFormData(prev => {
            const newData = {
                ...prev,
                data: { ...prev.data, [fieldName]: value }
            }
            onFormChange?.(newData)
            return newData
        })

        // Clear error when user starts typing
        const errorKey = `data_${fieldName}`
        if (errors[errorKey]) {
            setErrors(prev => ({ ...prev, [errorKey]: null }))
        }
    }, [errors, onFormChange])

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
        validate: validateForm,
        getFormData: () => formData,
        hasErrors: () => Object.keys(errors).length > 0,
        getErrors: () => errors
    }), [validateForm, formData, errors])

    console.log("ObjectDataForm")

    return (
        <>
            {/* Object Type Selection (only for new instances) */}
            {isNewInstance && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Object Type <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={formData.objectTypeId || ''}
                        onChange={(e) => handleInputChange('objectTypeId', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.objectTypeId ? 'border-red-300' : 'border-gray-300'
                            }`}
                    >
                        <option value="">Select object type...</option>
                        {availableTypes.map((type) => (
                            <option key={type.id} value={type.id}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                    {errors.objectTypeId && (
                        <p className="text-red-600 text-sm mt-1 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            {errors.objectTypeId}
                        </p>
                    )}
                </div>
            )}

            {/* Title - Model Field */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Object Title <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.title ? 'border-red-300' : 'border-gray-300'
                        }`}
                    placeholder="Enter object title..."
                />
                {errors.title && (
                    <p className="text-red-600 text-sm mt-1 flex items-center">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        {errors.title}
                    </p>
                )}
                <p className="text-gray-500 text-sm mt-1">
                    This is the object's display title (stored on the object, not in schema data)
                </p>
            </div>

            {/* Dynamic Schema Fields */}
            {objectType && (
                <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-4">
                        {objectType.label} Fields
                    </h4>
                    <ObjectSchemaForm
                        schema={getSchemaFromObjectType(objectType)}
                        data={formData.data || {}}
                        onChange={handleDataFieldChange}
                        namespace={namespace}
                    />
                </div>
            )}
        </>
    )
})

ObjectDataForm.displayName = 'ObjectDataForm'
export default ObjectDataForm
