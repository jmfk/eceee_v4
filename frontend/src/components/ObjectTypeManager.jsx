import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Settings, Database, Eye, Edit, Trash2, Hash, AlertCircle } from 'lucide-react'
import { objectTypesApi } from '../api/objectStorage'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import ObjectTypeForm from './ObjectTypeForm'
import Modal from './Modal'
import ConfirmDialog from './ConfirmDialog'

const ObjectTypeManager = () => {
    const [searchTerm, setSearchTerm] = useState('')
    const [showTypeForm, setShowTypeForm] = useState(false)
    const [editingType, setEditingType] = useState(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
    const [selectedType, setSelectedType] = useState(null)

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Fetch object types with filtering
    const { data: typesResponse, isLoading, error } = useQuery({
        queryKey: ['objectTypes', searchTerm],
        queryFn: () => {
            const params = {}
            if (searchTerm) params.search = searchTerm
            return objectTypesApi.list(params)
        }
    })

    const objectTypes = typesResponse?.data?.results || typesResponse?.data || []

    // Create object type mutation
    const createTypeMutation = useMutation({
        mutationFn: objectTypesApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries(['objectTypes'])
            setShowTypeForm(false)
            addNotification('Object type created successfully', 'success')
        },
        onError: (error) => {
            console.error('Failed to create object type:', error)
            addNotification('Failed to create object type', 'error')
            throw error
        }
    })

    // Update object type mutation
    const updateTypeMutation = useMutation({
        mutationFn: ({ id, ...data }) => objectTypesApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['objectTypes'])
            setEditingType(null)
            addNotification('Object type updated successfully', 'success')
        },
        onError: (error) => {
            console.error('Failed to update object type:', error)
            addNotification('Failed to update object type', 'error')
            throw error
        }
    })

    // Delete object type mutation
    const deleteTypeMutation = useMutation({
        mutationFn: objectTypesApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries(['objectTypes'])
            setShowDeleteConfirm(null)
            addNotification('Object type deleted successfully', 'success')
        },
        onError: (error) => {
            console.error('Failed to delete object type:', error)
            addNotification('Failed to delete object type', 'error')
        }
    })

    const handleCreateType = (data) => {
        createTypeMutation.mutate(data)
    }

    const handleUpdateType = (data) => {
        updateTypeMutation.mutate({ id: editingType.id, ...data })
    }

    const handleDeleteType = () => {
        if (showDeleteConfirm) {
            deleteTypeMutation.mutate(showDeleteConfirm.id)
        }
    }

    const handleEditType = (objectType) => {
        setEditingType(objectType)
        setShowTypeForm(true)
    }

    const handleViewType = (objectType) => {
        setSelectedType(objectType)
    }

    const filteredTypes = objectTypes.filter(type =>
        type.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                    <span className="text-red-800">
                        Error loading object types: {error.message}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                            <Database className="h-6 w-6 mr-2" />
                            Object Types
                        </h1>
                        <p className="text-gray-600 mt-1">
                            Manage dynamic content types with configurable schemas
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingType(null)
                            setShowTypeForm(true)
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center transition-colors"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Object Type
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search object types..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full max-w-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* Object Types Grid */}
            {!isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTypes.map((objectType) => (
                        <ObjectTypeCard
                            key={objectType.id}
                            objectType={objectType}
                            onEdit={handleEditType}
                            onDelete={(type) => setShowDeleteConfirm(type)}
                            onView={handleViewType}
                        />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && filteredTypes.length === 0 && (
                <div className="text-center py-12">
                    <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {searchTerm ? 'No matching object types' : 'No object types yet'}
                    </h3>
                    <p className="text-gray-600 mb-6">
                        {searchTerm
                            ? 'Try adjusting your search terms'
                            : 'Create your first object type to get started'
                        }
                    </p>
                    {!searchTerm && (
                        <button
                            onClick={() => {
                                setEditingType(null)
                                setShowTypeForm(true)
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center mx-auto transition-colors"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Object Type
                        </button>
                    )}
                </div>
            )}

            {/* Object Type Form Modal */}
            {showTypeForm && (
                <Modal
                    title={editingType ? 'Edit Object Type' : 'Create Object Type'}
                    onClose={() => {
                        setShowTypeForm(false)
                        setEditingType(null)
                    }}
                    size="large"
                >
                    <ObjectTypeForm
                        objectType={editingType}
                        onSubmit={editingType ? handleUpdateType : handleCreateType}
                        onCancel={() => {
                            setShowTypeForm(false)
                            setEditingType(null)
                        }}
                        isSubmitting={createTypeMutation.isPending || updateTypeMutation.isPending}
                    />
                </Modal>
            )}

            {/* Object Type Details Modal */}
            {selectedType && (
                <Modal
                    title={selectedType.label}
                    onClose={() => setSelectedType(null)}
                    size="large"
                >
                    <ObjectTypeDetails
                        objectType={selectedType}
                        onEdit={() => {
                            setEditingType(selectedType)
                            setSelectedType(null)
                            setShowTypeForm(true)
                        }}
                    />
                </Modal>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <ConfirmDialog
                    title="Delete Object Type"
                    message={`Are you sure you want to delete "${showDeleteConfirm.label}"? This action cannot be undone and will affect all instances of this type.`}
                    onConfirm={handleDeleteType}
                    onCancel={() => setShowDeleteConfirm(null)}
                    isLoading={deleteTypeMutation.isPending}
                    confirmText="Delete"
                    confirmButtonClass="bg-red-600 hover:bg-red-700"
                />
            )}
        </div>
    )
}

// Object Type Card Component
const ObjectTypeCard = ({ objectType, onEdit, onDelete, onView }) => {
    const statusColor = objectType.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
    const statusText = objectType.isActive ? 'Active' : 'Inactive'

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                    {objectType.iconImage ? (
                        <img
                            src={objectType.iconImage}
                            alt={objectType.label}
                            className="h-8 w-8 rounded mr-3"
                        />
                    ) : (
                        <div className="h-8 w-8 bg-blue-100 rounded flex items-center justify-center mr-3">
                            <Hash className="h-4 w-4 text-blue-600" />
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">{objectType.label}</h3>
                        <p className="text-sm text-gray-500">{objectType.name}</p>
                    </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                    {statusText}
                </span>
            </div>

            {objectType.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {objectType.description}
                </p>
            )}

            <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <span>{objectType.schemaFieldsCount || 0} fields</span>
                <span>{objectType.slotsCount || 0} slots</span>
                <span>{objectType.instanceCount || 0} instances</span>
            </div>

            <div className="flex space-x-2">
                <button
                    onClick={() => onView(objectType)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm flex items-center justify-center transition-colors"
                >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                </button>
                <button
                    onClick={() => onEdit(objectType)}
                    className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-md text-sm flex items-center justify-center transition-colors"
                >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                </button>
                <button
                    onClick={() => onDelete(objectType)}
                    className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-md text-sm flex items-center justify-center transition-colors"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}

// Object Type Details Component
const ObjectTypeDetails = ({ objectType, onEdit }) => {
    return (
        <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <p className="text-sm text-gray-900">{objectType.name}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${objectType.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {objectType.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                    <p className="text-sm text-gray-900">{objectType.label}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plural Label</label>
                    <p className="text-sm text-gray-900">{objectType.pluralLabel}</p>
                </div>
            </div>

            {objectType.description && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <p className="text-sm text-gray-900">{objectType.description}</p>
                </div>
            )}

            {/* Schema Fields */}
            {objectType.schema?.fields && objectType.schema.fields.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Schema Fields</label>
                    <div className="space-y-2">
                        {objectType.schema.fields.map((field, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                <div>
                                    <span className="font-medium text-gray-900">{field.name}</span>
                                    <span className="ml-2 text-sm text-gray-500">({field.type})</span>
                                    {field.required && (
                                        <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Required</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Widget Slots */}
            {objectType.slotConfiguration?.slots && objectType.slotConfiguration.slots.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Widget Slots</label>
                    <div className="space-y-2">
                        {objectType.slotConfiguration.slots.map((slot, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                <div>
                                    <span className="font-medium text-gray-900">{slot.label}</span>
                                    <span className="ml-2 text-sm text-gray-500">({slot.name})</span>
                                    {slot.required && (
                                        <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Required</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                    onClick={onEdit}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center transition-colors"
                >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Object Type
                </button>
            </div>
        </div>
    )
}

export default ObjectTypeManager
