import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Save, AlertCircle } from 'lucide-react'
import { objectInstancesApi, objectTypesApi } from '../../api/objectStorage'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import ObjectSchemaForm from '../ObjectSchemaForm'

const ObjectDataView = ({ objectType, instance, isNewInstance, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        objectTypeId: objectType?.id || '',
        title: instance?.title || '',
        data: instance?.data || {},
        status: instance?.status || 'draft',
        metadata: instance?.metadata || {}
    })
    const [errors, setErrors] = useState({})
    const [isDirty, setIsDirty] = useState(false)

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Fetch available object types for selection (when creating)
    const { data: typesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getActive(),
        enabled: isNewInstance
    })

    const availableTypes = typesResponse?.data || []

    useEffect(() => {
        if (instance) {
            setFormData({
                objectTypeId: instance.objectType?.id || '',
                title: instance.title || '',
                data: instance.data || {},
                status: instance.status || 'draft',
                metadata: instance.metadata || {}
            })
        }
    }, [instance])

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (isNewInstance) {
                return objectInstancesApi.create(data)
            } else {
                return objectInstancesApi.update(instance.id, data)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance', instance?.id])
            setIsDirty(false)
            onSave?.()
        },
        onError: (error) => {
            console.error('Save failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to save object'
            addNotification(errorMessage, 'error')

            // Handle validation errors
            if (error.response?.data?.errors) {
                setErrors(error.response.data.errors)
            }
        }
    })

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setIsDirty(true)

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }))
        }
    }

    const handleDataFieldChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            data: { ...prev.data, [fieldName]: value }
        }))
        setIsDirty(true)

        // Clear error when user starts typing
        const errorKey = `data_${fieldName}`
        if (errors[errorKey]) {
            setErrors(prev => ({ ...prev, [errorKey]: null }))
        }
    }

    const validateForm = () => {
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
        return Object.keys(newErrors).length === 0
    }

    const handleSave = () => {
        if (!validateForm()) {
            addNotification('Please fix the validation errors', 'error')
            return
        }

        saveMutation.mutate(formData)
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Object Data & Schema</h2>

                <div className="space-y-6">
                    {/* Object Type Selection (only for new instances) */}
                    {isNewInstance && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Object Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={formData.objectTypeId}
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

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.title}
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
                    </div>

                    {/* Dynamic Schema Fields */}
                    {objectType && (
                        <div className="border-t pt-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                {objectType.label} Fields
                            </h3>
                            <ObjectSchemaForm
                                objectType={objectType}
                                data={formData.data}
                                onChange={handleDataFieldChange}
                                errors={errors}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saveMutation.isPending || !isDirty}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                >
                    {saveMutation.isPending ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4 mr-2" />
                            {isNewInstance ? 'Create' : 'Save'}
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}

export default ObjectDataView
