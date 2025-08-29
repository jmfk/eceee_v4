import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft, Save, Eye, Settings, Calendar, FileText, Layout, X,
    AlertCircle, CheckCircle, Users, History
} from 'lucide-react'
import { objectInstancesApi, objectTypesApi } from '../api/objectStorage'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import ObjectContentEditor from './ObjectContentEditor'
import ObjectSchemaForm from './ObjectSchemaForm'

const ObjectEditor = ({ objectType, instance, onSave, onCancel }) => {
    const [activeTab, setActiveTab] = useState('content')
    const [formData, setFormData] = useState({
        objectTypeId: objectType?.id || '',
        title: '',
        slug: '',
        data: {},
        status: 'draft',
        parent: null,
        widgets: {},
        publishDate: '',
        unpublishDate: '',
        metadata: {}
    })
    const [isDirty, setIsDirty] = useState(false)
    const [errors, setErrors] = useState({})
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)

    const contentEditorRef = useRef(null)
    const schemaFormRef = useRef(null)

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()
    const isNewInstance = !instance

    // Fetch object type details
    const actualObjectTypeId = instance?.objectType?.id || objectType?.id
    const { data: objectTypeResponse, isLoading: typeLoading } = useQuery({
        queryKey: ['objectType', actualObjectTypeId],
        queryFn: () => objectTypesApi.get(actualObjectTypeId),
        enabled: !!actualObjectTypeId
    })

    // Fetch potential parent objects
    const { data: potentialParentsResponse } = useQuery({
        queryKey: ['objectInstances', 'forParent', actualObjectTypeId],
        queryFn: () => objectInstancesApi.list({ objectType: actualObjectTypeId }),
        enabled: !!actualObjectTypeId
    })

    // Fetch child types for sub-object tab
    const { data: childTypesResponse } = useQuery({
        queryKey: ['objectTypes', 'childTypes', actualObjectTypeId],
        queryFn: () => objectTypesApi.list({
            show_in_main_browser: false,
            // Filter for types that can be children of current type
        }),
        enabled: !!actualObjectTypeId && activeTab === 'subobjects'
    })

    // Fetch existing child objects
    const { data: childObjectsResponse } = useQuery({
        queryKey: ['objectInstances', 'children', instance?.id],
        queryFn: () => objectInstancesApi.getChildren(instance.id),
        enabled: !!instance?.id && activeTab === 'subobjects'
    })

    const objectTypeDetails = objectTypeResponse?.data || objectType
    const potentialParents = potentialParentsResponse?.data?.results || potentialParentsResponse?.data || []
    const childTypes = childTypesResponse?.data?.results || childTypesResponse?.data || []
    const childObjects = childObjectsResponse?.data?.results || childObjectsResponse?.data || []

    // Initialize form data
    useEffect(() => {
        if (instance) {
            setFormData({
                objectTypeId: instance.objectType?.id || objectType?.id,
                title: instance.title || '',
                slug: instance.slug || '',
                data: instance.data || {},
                status: instance.status || 'draft',
                parent: instance.parent?.id || null,
                widgets: instance.widgets || {},
                publishDate: instance.publishDate ? instance.publishDate.slice(0, 16) : '',
                unpublishDate: instance.unpublishDate ? instance.unpublishDate.slice(0, 16) : '',
                metadata: instance.metadata || {}
            })
        } else {
            setFormData(prev => ({
                ...prev,
                objectTypeId: actualObjectTypeId || ''
            }))
        }
    }, [instance, objectType, actualObjectTypeId])

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: (data) => {
            if (instance?.id) {
                return objectInstancesApi.update(instance.id, data)
            } else {
                return objectInstancesApi.create(data)
            }
        },
        onSuccess: (response) => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance'])
            setIsDirty(false)
            onSave?.(response.data)
        },
        onError: (error) => {
            console.error('Failed to save object:', error)
            addNotification('Failed to save object', 'error')

            // Handle validation errors
            if (error.response?.data) {
                setErrors(error.response.data)
            }
        }
    })

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        setIsDirty(true)

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
        setIsDirty(true)
    }

    const handleWidgetChange = (widgets) => {
        setFormData(prev => ({ ...prev, widgets }))
        setIsDirty(true)
    }

    const validateForm = () => {
        const newErrors = {}

        if (!formData.title?.trim()) {
            newErrors.title = 'Title is required'
        }

        // Validate required schema fields
        if (objectTypeDetails?.schema?.fields) {
            objectTypeDetails.schema.fields.forEach(field => {
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

    const handleSave = useCallback(() => {
        if (validateForm()) {
            const submitData = {
                ...formData,
                publishDate: formData.publishDate || null,
                unpublishDate: formData.unpublishDate || null
            }
            saveMutation.mutate(submitData)
        }
    }, [formData, saveMutation])

    const handleCancel = () => {
        if (isDirty) {
            setShowUnsavedWarning(true)
        } else {
            onCancel?.()
        }
    }

    const confirmCancel = () => {
        setShowUnsavedWarning(false)
        onCancel?.()
    }

    const handleCreateSubObject = (childType) => {
        // Create a new sub-object of the specified type with current object as parent
        const newSubObjectData = {
            objectTypeId: childType.id,
            title: `New ${childType.label}`,
            data: {},
            status: 'draft',
            parent: instance?.id, // Set current object as parent
            widgets: {},
            metadata: {}
        }

        // Use the create mutation to save the sub-object
        const createSubObjectMutation = objectInstancesApi.create(newSubObjectData)
        createSubObjectMutation.then((response) => {
            addNotification(`${childType.label} created successfully`, 'success')
            // Refresh the current object data to show the new child
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance'])
        }).catch((error) => {
            console.error('Failed to create sub-object:', error)
            addNotification(`Failed to create ${childType.label}`, 'error')
        })
    }

    // Tab definitions
    const tabs = [
        { id: 'content', label: 'Content', icon: Layout },
        { id: 'data', label: 'Data', icon: FileText },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'publishing', label: 'Publishing', icon: Calendar },
        { id: 'subobjects', label: 'Sub-objects', icon: Users },
        ...(instance?.id ? [{ id: 'versions', label: 'Versions', icon: History }] : [])
    ]

    if (typeLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <button
                                onClick={handleCancel}
                                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                    {objectTypeDetails?.iconImage ? (
                                        <img
                                            src={objectTypeDetails.iconImage}
                                            alt={objectTypeDetails.label}
                                            className="w-6 h-6 object-cover rounded mr-3"
                                        />
                                    ) : (
                                        <Layout className="h-6 w-6 mr-3" />
                                    )}
                                    {isNewInstance ? `New ${objectTypeDetails?.label}` : formData.title || 'Untitled'}
                                </h1>
                                <p className="text-gray-600 mt-1">
                                    {isNewInstance
                                        ? `Create a new ${objectTypeDetails?.label?.toLowerCase()}`
                                        : `Edit ${objectTypeDetails?.label?.toLowerCase()}`
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            {isDirty && (
                                <span className="text-sm text-amber-600 flex items-center">
                                    <AlertCircle className="h-4 w-4 mr-1" />
                                    Unsaved changes
                                </span>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saveMutation.isPending}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center transition-colors disabled:opacity-50"
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

                    {/* Tab Navigation */}
                    <div className="mt-6">
                        <div className="flex items-center space-x-1">
                            {tabs.map((tab) => {
                                const Icon = tab.icon
                                const isActive = activeTab === tab.id

                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${isActive
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4 mr-2" />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                {/* Content Tab - Combined Widgets + Schema */}
                {activeTab === 'content' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Side - Widget Slots */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Widget Slots</h3>
                            <ObjectContentEditor
                                ref={contentEditorRef}
                                objectType={objectTypeDetails}
                                widgets={formData.widgets}
                                onWidgetChange={handleWidgetChange}
                                mode="object"
                            />
                        </div>

                        {/* Right Side - Schema Form */}
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Object Data</h3>

                            {/* Title Field */}
                            <div className="mb-4">
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

                            {/* Schema Fields */}
                            <ObjectSchemaForm
                                ref={schemaFormRef}
                                schema={objectTypeDetails?.schema}
                                data={formData.data}
                                onChange={handleDataFieldChange}
                                errors={errors}
                            />
                        </div>
                    </div>
                )}

                {/* Data Tab - Schema Only */}
                {activeTab === 'data' && (
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-6">Object Data</h3>

                        {/* Title Field */}
                        <div className="mb-6">
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

                        {/* Schema Fields */}
                        <ObjectSchemaForm
                            schema={objectTypeDetails?.schema}
                            data={formData.data}
                            onChange={handleDataFieldChange}
                            errors={errors}
                        />
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-6">Object Settings</h3>

                        <div className="space-y-6">
                            {/* Slug Field */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Slug
                                </label>
                                <input
                                    type="text"
                                    value={formData.slug}
                                    onChange={(e) => handleInputChange('slug', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="auto-generated-from-title"
                                />
                                <p className="text-gray-500 text-sm mt-1">
                                    URL-friendly identifier. Leave empty to auto-generate from title.
                                </p>
                            </div>

                            {/* Parent Selection */}
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
                                        .filter(p => p.id !== instance?.id) // Don't allow self as parent
                                        .map((parent) => (
                                            <option key={parent.id} value={parent.id}>
                                                {'  '.repeat(parent.level || 0)}{parent.title}
                                            </option>
                                        ))}
                                </select>
                                <p className="text-gray-500 text-sm mt-1">
                                    Select a parent object to create hierarchical relationships
                                </p>
                            </div>

                            {/* Metadata */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Metadata (JSON)
                                </label>
                                <textarea
                                    value={JSON.stringify(formData.metadata, null, 2)}
                                    onChange={(e) => {
                                        try {
                                            const metadata = JSON.parse(e.target.value)
                                            handleInputChange('metadata', metadata)
                                        } catch (err) {
                                            // Invalid JSON, don't update
                                        }
                                    }}
                                    rows={6}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                                    placeholder="{}"
                                />
                                <p className="text-gray-500 text-sm mt-1">
                                    Additional properties in JSON format
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Publishing Tab */}
                {activeTab === 'publishing' && (
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-6">Publishing Settings</h3>

                        <div className="space-y-6">
                            {/* Status */}
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

                            {/* Publishing Dates */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    <p className="text-gray-500 text-sm mt-1">
                                        When this object should be published
                                    </p>
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
                                    <p className="text-gray-500 text-sm mt-1">
                                        When this object should be unpublished
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sub-objects Tab */}
                {activeTab === 'subobjects' && (
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-6">Sub-objects</h3>

                        {instance?.id ? (
                            <div>
                                <p className="text-gray-600 mb-6">
                                    Manage objects that are children of this {objectTypeDetails?.label?.toLowerCase()}.
                                </p>

                                {/* Existing Child Objects */}
                                {childObjects.length > 0 && (
                                    <div className="space-y-4 mb-8">
                                        <h4 className="text-md font-medium text-gray-900">Existing Sub-objects</h4>
                                        <div className="space-y-2">
                                            {childObjects.map((child) => (
                                                <div
                                                    key={child.id}
                                                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                                >
                                                    <div className="flex items-center">
                                                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center mr-3">
                                                            <Users className="h-4 w-4 text-gray-400" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-gray-900">{child.title}</div>
                                                            <div className="text-sm text-gray-500">
                                                                {child.objectType?.label} • {child.status}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => {
                                                                // TODO: Navigate to edit child object
                                                                console.log('Edit child:', child)
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                // TODO: Delete child object
                                                                console.log('Delete child:', child)
                                                            }}
                                                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Child types that can be created */}
                                {objectTypeDetails?.allowedChildTypes?.length > 0 ? (
                                    <div className="space-y-4">
                                        <h4 className="text-md font-medium text-gray-900">Create New Sub-object</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {objectTypeDetails.allowedChildTypes.map((childType) => (
                                                <button
                                                    key={childType.id}
                                                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all text-left"
                                                    onClick={() => {
                                                        handleCreateSubObject(childType)
                                                    }}
                                                >
                                                    <div className="flex items-center">
                                                        {childType.iconImage ? (
                                                            <img
                                                                src={childType.iconImage}
                                                                alt={childType.label}
                                                                className="w-8 h-8 object-cover rounded mr-3"
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center mr-3">
                                                                <Users className="h-4 w-4 text-gray-400" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-medium text-gray-900">{childType.label}</div>
                                                            <div className="text-sm text-gray-500">Create new</div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        <Users className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                                        <p>No child object types configured for this object type</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                                <h4 className="text-lg font-medium text-gray-900 mb-2">Save First</h4>
                                <p>Save this object before you can manage sub-objects.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Versions Tab */}
                {activeTab === 'versions' && instance?.id && (
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-6">Version History</h3>

                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                            <h4 className="text-sm font-medium text-blue-900 mb-2">Version Control</h4>
                            <p className="text-blue-800 text-sm">
                                This object has version control enabled. All changes are automatically tracked
                                and you can view the complete version history, compare changes between versions,
                                and restore previous versions if needed.
                            </p>
                        </div>

                        <div className="mt-6 bg-gray-50 rounded-md p-4">
                            <h4 className="text-sm font-medium text-gray-900 mb-2">Current Version Info</h4>
                            <div className="text-sm text-gray-700 space-y-1">
                                <p><strong>Version:</strong> {instance.version || 'New'}</p>
                                <p><strong>Last Modified:</strong> {instance.updatedAt ? new Date(instance.updatedAt).toLocaleString() : 'Not saved yet'}</p>
                                <p><strong>Created By:</strong> {instance.createdBy || 'Current user'}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Unsaved Changes Warning Modal */}
            {showUnsavedWarning && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md mx-4">
                        <div className="flex items-center mb-4">
                            <AlertCircle className="h-6 w-6 text-amber-500 mr-3" />
                            <h3 className="text-lg font-medium text-gray-900">Unsaved Changes</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            You have unsaved changes. Are you sure you want to leave without saving?
                        </p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowUnsavedWarning(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmCancel}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                            >
                                Leave Without Saving
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ObjectEditor
