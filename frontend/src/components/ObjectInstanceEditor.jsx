import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, X, Eye, Calendar, User, Hash, Type, ToggleLeft, Image, FileText } from 'lucide-react'
import { objectInstancesApi, objectTypesApi } from '../api/objectStorage'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import Modal from './Modal'

const ObjectInstanceEditor = ({ instanceId, objectTypeId, onSave, onCancel, isVisible }) => {
    const [formData, setFormData] = useState({
        objectTypeId: objectTypeId || '',
        title: '',
        data: {},
        status: 'draft',
        parent: null,
        widgets: {},
        publishDate: '',
        unpublishDate: '',
        metadata: {}
    })

    const [errors, setErrors] = useState({})
    const [activeTab, setActiveTab] = useState('content')

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Fetch object instance if editing
    const { data: instanceResponse, isLoading: instanceLoading } = useQuery({
        queryKey: ['objectInstance', instanceId],
        queryFn: () => objectInstancesApi.get(instanceId),
        enabled: !!instanceId
    })

    // Fetch object type details
    const { data: objectTypeResponse, isLoading: typeLoading } = useQuery({
        queryKey: ['objectType', formData.objectTypeId],
        queryFn: () => objectTypesApi.get(formData.objectTypeId),
        enabled: !!formData.objectTypeId
    })

    // Fetch available object types for selection
    const { data: typesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getActive()
    })

    // Fetch potential parent objects
    const { data: potentialParentsResponse } = useQuery({
        queryKey: ['objectInstances', 'forParent', formData.objectTypeId],
        queryFn: () => objectInstancesApi.list({ objectType: formData.objectTypeId }),
        enabled: !!formData.objectTypeId
    })

    const objectType = objectTypeResponse?.data
    const availableTypes = typesResponse?.data?.results || typesResponse?.data || []
    const potentialParents = potentialParentsResponse?.data?.results || potentialParentsResponse?.data || []

    useEffect(() => {
        if (instanceResponse?.data) {
            const instance = instanceResponse.data
            setFormData({
                objectTypeId: instance.objectType.id,
                title: instance.title,
                data: instance.data || {},
                status: instance.status,
                parent: instance.parent,
                widgets: instance.widgets || {},
                publishDate: instance.publishDate ? instance.publishDate.slice(0, 16) : '',
                unpublishDate: instance.unpublishDate ? instance.unpublishDate.slice(0, 16) : '',
                metadata: instance.metadata || {}
            })
        }
    }, [instanceResponse])

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (instanceId) {
                return objectInstancesApi.update(instanceId, data)
            } else {
                return objectInstancesApi.create(data)
            }
        },
        onSuccess: (response) => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance'])
            addNotification(
                instanceId ? 'Object updated successfully' : 'Object created successfully',
                'success'
            )
            onSave?.(response.data)
        },
        onError: (error) => {
            console.error('Failed to save object:', error)
            addNotification('Failed to save object', 'error')
        }
    })

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))

        // Clear field error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }))
        }
    }

    const handleDataFieldChange = (fieldName, value) => {
        setFormData(prev => ({
            ...prev,
            data: { ...prev.data, [fieldName]: value }
        }))
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
        if (objectType?.schema?.fields) {
            objectType.schema.fields.forEach(field => {
                if (field.required) {
                    const value = formData.data[field.name]
                    if (!value && value !== 0 && value !== false) {
                        newErrors[`data_${field.name}`] = `${field.label || field.name} is required`
                    }
                }
            })
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = (e) => {
        e.preventDefault()

        if (validateForm()) {
            const submitData = {
                ...formData,
                publishDate: formData.publishDate || null,
                unpublishDate: formData.unpublishDate || null
            }
            saveMutation.mutate(submitData)
        }
    }

    const isLoading = instanceLoading || typeLoading

    if (!isVisible) return null

    return (
        <Modal
            title={instanceId ? 'Edit Object' : 'Create Object'}
            onClose={onCancel}
            size="large"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Tab Navigation */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        {[
                            { id: 'content', label: 'Content' },
                            { id: 'publishing', label: 'Publishing' },
                            { id: 'hierarchy', label: 'Hierarchy' },
                            { id: 'widgets', label: 'Widgets' }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <>
                        {/* Content Tab */}
                        {activeTab === 'content' && (
                            <div className="space-y-4">
                                {/* Object Type Selection */}
                                {!instanceId && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
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
                                            <p className="text-red-600 text-sm mt-1">{errors.objectTypeId}</p>
                                        )}
                                    </div>
                                )}

                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                                        <p className="text-red-600 text-sm mt-1">{errors.title}</p>
                                    )}
                                </div>

                                {/* Dynamic Schema Fields */}
                                {objectType?.schema?.fields && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-medium text-gray-900 border-t pt-4">
                                            {objectType.label} Fields
                                        </h3>
                                        {objectType.schema.fields.map((field) => (
                                            <SchemaFieldInput
                                                key={field.name}
                                                field={field}
                                                value={formData.data[field.name]}
                                                onChange={(value) => handleDataFieldChange(field.name, value)}
                                                error={errors[`data_${field.name}`]}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Publishing Tab */}
                        {activeTab === 'publishing' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Status
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => handleInputChange('status', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Publish Date
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={formData.publishDate}
                                            onChange={(e) => handleInputChange('publishDate', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Unpublish Date
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={formData.unpublishDate}
                                            onChange={(e) => handleInputChange('unpublishDate', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Hierarchy Tab */}
                        {activeTab === 'hierarchy' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Parent Object
                                    </label>
                                    <select
                                        value={formData.parent || ''}
                                        onChange={(e) => handleInputChange('parent', e.target.value || null)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value="">No parent (root level)</option>
                                        {potentialParents
                                            .filter(p => p.id !== instanceId) // Don't allow self as parent
                                            .map((parent) => (
                                                <option key={parent.id} value={parent.id}>
                                                    {'  '.repeat(parent.level)}{parent.title}
                                                </option>
                                            ))}
                                    </select>
                                    <p className="text-gray-500 text-xs mt-1">
                                        Select a parent object to create hierarchical relationships
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Widgets Tab */}
                        {activeTab === 'widgets' && (
                            <div className="space-y-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                                    <h3 className="text-lg font-medium text-blue-900 mb-2">Widget Configuration</h3>
                                    <p className="text-blue-800">
                                        Widget slot configuration will be implemented in Phase 5.
                                        This will allow adding widgets to the slots defined by the object type.
                                    </p>
                                </div>

                                {/* Show available slots */}
                                {objectType?.slotConfiguration?.slots && (
                                    <div>
                                        <h4 className="font-medium text-gray-900 mb-2">Available Slots:</h4>
                                        <div className="space-y-2">
                                            {objectType.slotConfiguration.slots.map((slot) => (
                                                <div key={slot.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                                    <div>
                                                        <span className="font-medium text-gray-900">{slot.label}</span>
                                                        <span className="ml-2 text-sm text-gray-500">({slot.name})</span>
                                                        {slot.required && (
                                                            <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Required</span>
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-gray-500">
                                                        {slot.maxWidgets ? `Max: ${slot.maxWidgets}` : 'Unlimited'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saveMutation.isPending || isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                        {saveMutation.isPending ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                {instanceId ? 'Update' : 'Create'}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

// Schema Field Input Component
const SchemaFieldInput = ({ field, value, onChange, error }) => {
    const getFieldIcon = (type) => {
        switch (type) {
            case 'text':
            case 'rich_text':
                return Type
            case 'number':
                return Hash
            case 'date':
            case 'datetime':
                return Calendar
            case 'boolean':
                return ToggleLeft
            case 'image':
                return Image
            case 'user_reference':
                return User
            default:
                return FileText
        }
    }

    const Icon = getFieldIcon(field.type)

    const renderInput = () => {
        switch (field.type) {
            case 'text':
                return (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                        maxLength={field.maxLength}
                    />
                )

            case 'rich_text':
                return (
                    <textarea
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        rows={4}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                    />
                )

            case 'number':
                return (
                    <input
                        type="number"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                    />
                )

            case 'date':
                return (
                    <input
                        type="date"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                    />
                )

            case 'datetime':
                return (
                    <input
                        type="datetime-local"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                    />
                )

            case 'boolean':
                return (
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            checked={value || false}
                            onChange={(e) => onChange(e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 text-sm text-gray-700">
                            {field.label || field.name}
                        </label>
                    </div>
                )

            case 'choice':
                return (
                    <select
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                    >
                        <option value="">Select option...</option>
                        {field.choices?.map((choice) => (
                            <option key={choice.value || choice} value={choice.value || choice}>
                                {choice.label || choice}
                            </option>
                        ))}
                    </select>
                )

            case 'email':
                return (
                    <input
                        type="email"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                    />
                )

            case 'url':
                return (
                    <input
                        type="url"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                    />
                )

            default:
                return (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                    />
                )
        }
    }

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <Icon className="h-4 w-4 mr-2" />
                {field.label || field.name}
                {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderInput()}
            {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
            {field.help && <p className="text-gray-500 text-xs mt-1">{field.help}</p>}
        </div>
    )
}

export default ObjectInstanceEditor
