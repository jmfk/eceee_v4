import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Database, Edit, Trash2, Hash, AlertCircle, ArrowLeft } from 'lucide-react'
import { objectTypesApi } from '../api/objectStorage'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'

import ConfirmDialog from './ConfirmDialog'

const ObjectTypeManager = () => {
    const [searchTerm, setSearchTerm] = useState('')
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

    const navigate = useNavigate()
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
            const errorMessage = error?.response?.status === 400
                ? 'Cannot delete object type: it has existing instances'
                : 'Failed to delete object type'
            addNotification(errorMessage, 'error')
        }
    })



    const handleDeleteType = () => {
        if (showDeleteConfirm) {
            deleteTypeMutation.mutate(showDeleteConfirm.id)
        }
    }

    const handleEditType = (objectType) => {
        navigate(`/settings/object-types/${objectType.id}/basic`)
    }

    const handleCreateNew = () => {
        navigate('/settings/object-types/new/basic')
    }



    const filteredTypes = objectTypes.filter(type =>
        type.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )





    // Main List View Component
    const ListView = () => {
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
                            onClick={handleCreateNew}
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
                                onClick={handleCreateNew}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center mx-auto transition-colors"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Create Object Type
                            </button>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div>
            <ListView />

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <ConfirmDialog
                    title="Delete Object Type"
                    message={`Are you sure you want to delete "${showDeleteConfirm.label}"? This action cannot be undone.`}
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
const ObjectTypeCard = ({ objectType, onEdit, onDelete }) => {
    const statusColor = objectType.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
    const statusText = objectType.isActive ? 'Active' : 'Inactive'
    const hasInstances = (objectType.instanceCount || 0) > 0
    const canDelete = !hasInstances

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

            <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-gray-500">{objectType.schemaFieldsCount || 0} fields</span>
                <span className="text-gray-500">{objectType.slotsCount || 0} slots</span>
                <span className={hasInstances ? 'text-orange-600 font-medium' : 'text-gray-500'}>
                    {objectType.instanceCount || 0} instances
                </span>
            </div>

            <div className="flex space-x-2">
                <button
                    onClick={() => onEdit(objectType)}
                    className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-2 rounded-md text-sm flex items-center justify-center transition-colors"
                >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        if (canDelete) {
                            onDelete(objectType)
                        }
                    }}
                    disabled={!canDelete}
                    className={`px-3 py-2 rounded-md text-sm flex items-center justify-center transition-colors ${canDelete
                        ? 'bg-red-100 hover:bg-red-200 text-red-700 cursor-pointer'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    title={hasInstances ? `Cannot delete: ${objectType.instanceCount} instance${objectType.instanceCount === 1 ? '' : 's'} exist` : 'Delete object type'}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}



export default ObjectTypeManager
