import React, { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, AlertCircle } from 'lucide-react'
import { objectInstancesApi, objectTypesApi } from '../../api/objectStorage'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import ObjectContentEditor from '../ObjectContentEditor'
import ObjectSchemaForm from '../ObjectSchemaForm'

const ObjectContentView = ({ objectType, instance, isNewInstance, onSave, onCancel }) => {
    const navigate = useNavigate()
    const { instanceId, objectTypeId, tab } = useParams()

    // Helper function to convert object type schema to ObjectSchemaForm format
    const getSchemaFromObjectType = (objectType) => {
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
                return {
                    name: propName,
                    required: required.includes(propName),
                    ...properties[propName]
                }
            }
            return null
        }).filter(Boolean)

        return { fields }
    }
    const [formData, setFormData] = useState({
        objectTypeId: objectType?.id || '',
        title: instance?.title || '',
        data: instance?.data || {},
        status: instance?.status || 'draft',
        widgets: instance?.widgets || {},
        metadata: instance?.metadata || {}
    })
    const [errors, setErrors] = useState({})
    const [isDirty, setIsDirty] = useState(false)
    const [saveMode, setSaveMode] = useState('update_current') // 'update_current' or 'create_new'

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
                widgets: instance.widgets || {},
                metadata: instance.metadata || {}
            })
        }
    }, [instance])

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: ({ data, mode }) => {
            if (isNewInstance) {
                return objectInstancesApi.create(data)
            } else if (mode === 'update_current') {
                return objectInstancesApi.updateCurrentVersion(instance.id, data)
            } else {
                return objectInstancesApi.update(instance.id, data)
            }
        },
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance', instance?.id])
            setIsDirty(false)

            // Show success message based on save mode
            let successMessage
            if (isNewInstance) {
                successMessage = 'Object created successfully'
            } else if (variables.mode === 'update_current') {
                successMessage = `Current version (v${instance?.version || 1}) updated successfully`
            } else {
                successMessage = `New version (v${(instance?.version || 1) + 1}) created successfully`
            }

            addNotification(successMessage, 'success')

            // For new instances, update URL to edit mode but stay on content tab
            if (isNewInstance && response?.data?.object?.id) {
                navigate(`/objects/${response.data.object.id}/edit/content`, { replace: true })
            }
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

    const handleSave = (mode = saveMode) => {
        if (!validateForm()) {
            addNotification('Please fix the validation errors', 'error')
            return
        }

        saveMutation.mutate({ data: formData, mode })
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Object Content & Data</h2>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column - Widget Slots */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                Widget Slots
                            </h3>
                            <ObjectContentEditor
                                objectType={objectType}
                                instance={instance}
                                onSave={() => { }} // Handle within this component
                                onCancel={onCancel}
                            />
                        </div>
                    </div>

                    {/* Right Column - Object Data */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                Object Data
                            </h3>
                        </div>

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

                        {/* Title - Model Field */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Object Title <span className="text-red-500">*</span>
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
                                    data={formData.data}
                                    onChange={handleDataFieldChange}
                                    errors={errors}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Save Options (only for existing instances) */}
            {!isNewInstance && (
                <div className="bg-gray-50 rounded-lg border p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Save Options</h3>
                    <div className="space-y-2">
                        <label className="flex items-center">
                            <input
                                type="radio"
                                name="saveMode"
                                value="update_current"
                                checked={saveMode === 'update_current'}
                                onChange={(e) => setSaveMode(e.target.value)}
                                className="mr-2"
                            />
                            <div>
                                <span className="text-sm font-medium text-gray-900">Update Current Version</span>
                                <p className="text-xs text-gray-600">
                                    Save changes to the existing version (v{instance?.version || 1})
                                </p>
                            </div>
                        </label>
                        <label className="flex items-center">
                            <input
                                type="radio"
                                name="saveMode"
                                value="create_new"
                                checked={saveMode === 'create_new'}
                                onChange={(e) => setSaveMode(e.target.value)}
                                className="mr-2"
                            />
                            <div>
                                <span className="text-sm font-medium text-gray-900">Create New Version</span>
                                <p className="text-xs text-gray-600">
                                    Save changes as a new version (v{(instance?.version || 1) + 1})
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                    Cancel
                </button>

                <div className="flex space-x-3">
                    {!isNewInstance && (
                        <>
                            <button
                                onClick={() => handleSave('update_current')}
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
                                        Update Current (v{instance?.version || 1})
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => handleSave('create_new')}
                                disabled={saveMutation.isPending || !isDirty}
                                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                            >
                                {saveMutation.isPending ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-2" />
                                        New Version (v{(instance?.version || 1) + 1})
                                    </>
                                )}
                            </button>
                        </>
                    )}

                    {isNewInstance && (
                        <button
                            onClick={() => handleSave('create_new')}
                            disabled={saveMutation.isPending || !isDirty}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center transition-colors"
                        >
                            {saveMutation.isPending ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Create
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ObjectContentView
