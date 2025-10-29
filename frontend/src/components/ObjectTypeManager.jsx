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
    const [forceDeleteConfirmed, setForceDeleteConfirmed] = useState(false)

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
        mutationFn: ({ id, forceDelete }) => objectTypesApi.delete(id, forceDelete),
        onSuccess: (response) => {
            queryClient.invalidateQueries(['objectTypes'])
            setShowDeleteConfirm(null)
            setForceDeleteConfirmed(false)

            const instancesDeleted = response?.data?.instances_deleted || 0
            if (instancesDeleted > 0) {
                addNotification(
                    `Object type and ${instancesDeleted} instance${instancesDeleted === 1 ? '' : 's'} deleted successfully`,
                    'success'
                )
            } else {
                addNotification('Object type deleted successfully', 'success')
            }
        },
        onError: (error) => {
            console.error('Failed to delete object type:', error)

            // Handle specific error cases
            const status = error.response?.status

            if (status === 401) {
                addNotification('Authentication failed. Please log in again.', 'error')
                setShowDeleteConfirm(null)
                setForceDeleteConfirmed(false)
                return
            }

            if (status === 404) {
                addNotification('Object type not found. It may have already been deleted.', 'error')
                setShowDeleteConfirm(null)
                setForceDeleteConfirmed(false)
                // Refresh the list
                queryClient.invalidateQueries(['objectTypes'])
                return
            }

            // Check if it requires force delete
            if (error.response?.data?.force_delete_required) {
                // Keep dialog open and show warning
                addNotification(
                    `Cannot delete: ${error.response.data.instance_count} instance(s) exist. Enable "Delete all instances" to proceed.`,
                    'warning'
                )
            } else {
                const errorMessage = error.response?.data?.error || 'Failed to delete object type'
                addNotification(errorMessage, 'error')
                setShowDeleteConfirm(null)
                setForceDeleteConfirmed(false)
            }
        }
    })



    const handleDeleteType = () => {
        if (showDeleteConfirm) {
            const hasInstances = (showDeleteConfirm.instanceCount || 0) > 0
            deleteTypeMutation.mutate({
                id: showDeleteConfirm.id,
                forceDelete: hasInstances && forceDeleteConfirmed
            })
        }
    }

    const handleCancelDelete = () => {
        setShowDeleteConfirm(null)
        setForceDeleteConfirmed(false)
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
                        <div className="flex items-center">
                            <span className="text-sm text-gray-500">{filteredTypes.length} object types</span>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
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
                <DeleteConfirmDialog
                    objectType={showDeleteConfirm}
                    onConfirm={handleDeleteType}
                    onCancel={handleCancelDelete}
                    isLoading={deleteTypeMutation.isPending}
                    forceDeleteConfirmed={forceDeleteConfirmed}
                    onForceDeleteChange={setForceDeleteConfirmed}
                />
            )}
        </div>
    )
}

// Delete Confirmation Dialog Component
const DeleteConfirmDialog = ({ objectType, onConfirm, onCancel, isLoading, forceDeleteConfirmed, onForceDeleteChange }) => {
    const hasInstances = (objectType.instanceCount || 0) > 0

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Delete Object Type
                    </h2>

                    <p className="text-gray-600 mb-4">
                        Are you sure you want to delete <strong>"{objectType.label}"</strong>?
                    </p>

                    {hasInstances && (
                        <div className="bg-orange-50 border-2 border-orange-400 rounded-md p-4 mb-4">
                            <div className="flex items-start">
                                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 mr-2 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-orange-800 mb-2">
                                        Warning: This object type has {objectType.instanceCount} existing instance{objectType.instanceCount === 1 ? '' : 's'}
                                    </p>
                                    <label className="flex items-start cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={forceDeleteConfirmed}
                                            onChange={(e) => onForceDeleteChange(e.target.checked)}
                                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded mt-0.5 mr-2"
                                        />
                                        <span className="text-sm text-orange-800">
                                            <strong>Delete all {objectType.instanceCount} instance{objectType.instanceCount === 1 ? '' : 's'}</strong> along with the object type. This action cannot be undone.
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <p className="text-sm text-gray-500 mb-6">
                        This action cannot be undone.
                    </p>

                    <div className="flex space-x-3">
                        <button
                            onClick={onCancel}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading || (hasInstances && !forceDeleteConfirmed)}
                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Deleting...
                                </>
                            ) : (
                                'Delete'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Object Type Card Component
const ObjectTypeCard = ({ objectType, onEdit, onDelete }) => {
    const statusColor = objectType.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
    const statusText = objectType.isActive ? 'Active' : 'Inactive'
    const hasInstances = (objectType.instanceCount || 0) > 0

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow flex flex-col h-full">
            {/* Card content - grows to fill space */}
            <div className="flex-grow">
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
            </div>

            {/* Buttons - always at bottom */}
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
                        onDelete(objectType)
                    }}
                    className="px-3 py-2 rounded-md text-sm flex items-center justify-center transition-colors bg-red-100 hover:bg-red-200 text-red-700 cursor-pointer"
                    title={hasInstances ? `Delete object type (${objectType.instanceCount} instance${objectType.instanceCount === 1 ? '' : 's'} exist)` : 'Delete object type'}
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}



export default ObjectTypeManager
