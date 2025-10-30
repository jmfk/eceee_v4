import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { Search, ArrowLeft, Plus, Grid, List, AlertCircle, Image, FolderOpen, Trash2 } from 'lucide-react'
import { objectTypesApi, objectInstancesApi } from '../api/objectStorage'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import DeleteConfirmationModal from './DeleteConfirmationModal'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const ObjectBrowser = () => {
    // Set document title
    useDocumentTitle('Objects')

    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { typeName } = useParams()
    const [currentView, setCurrentView] = useState('grid') // 'grid', 'list'
    const [selectedObjectType, setSelectedObjectType] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, instance: null })

    const { addNotification } = useGlobalNotifications()
    const queryClient = useQueryClient()

    // Handle URL parameters for type filtering (both route params and search params)
    useEffect(() => {
        const typeParam = typeName || searchParams.get('type')
        if (typeParam) {
            // Find the object type by name or ID and switch to list view
            const fetchObjectType = async () => {
                try {
                    let objectType = null

                    if (typeName) {
                        // If we have a type name, we need to find the object type by name
                        // Since there's no direct getByName API, we'll list all and find by name
                        const allTypesResponse = await objectTypesApi.list()
                        const allTypes = allTypesResponse.data.results || allTypesResponse.data
                        objectType = allTypes.find(type => type.name === typeName)
                    } else {
                        // If we have an ID from search params, get by ID
                        const response = await objectTypesApi.get(typeParam)
                        objectType = response.data
                    }

                    if (objectType) {
                        setSelectedObjectType(objectType)
                        setCurrentView('list')
                        setSearchTerm('')
                        setStatusFilter('')
                    }
                } catch (error) {
                    console.error('Failed to load object type from URL:', error)
                    // If type not found, stay on grid view
                }
            }
            fetchObjectType()
        } else {
            // No type parameter, ensure we're in grid view
            setCurrentView('grid')
            setSelectedObjectType(null)
        }
    }, [typeName, searchParams])

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (instanceId) => objectInstancesApi.delete(instanceId),
        onSuccess: () => {
            queryClient.invalidateQueries(['objectInstances'])
            queryClient.invalidateQueries(['objectInstance'])
            addNotification('Object deleted successfully', 'success')
            setDeleteModal({ isOpen: false, instance: null })
        },
        onError: (error) => {
            console.error('Delete failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to delete object'
            addNotification(errorMessage, 'error')
            setDeleteModal({ isOpen: false, instance: null })
        }
    })

    // Fetch object types for grid view
    const { data: objectTypesResponse, isLoading: typesLoading, error: typesError } = useQuery({
        queryKey: ['objectTypes', 'mainBrowser'],
        queryFn: () => objectTypesApi.getMainBrowserTypes(),
        enabled: currentView === 'grid'
    })

    // Fetch filtered instances for list view
    const { data: instancesResponse, isLoading: instancesLoading, error: instancesError } = useQuery({
        queryKey: ['objectInstances', 'filtered', selectedObjectType?.id, searchTerm, statusFilter],
        queryFn: () => {
            const params = {}
            if (selectedObjectType) params.type = selectedObjectType.name
            if (searchTerm) params.search = searchTerm
            if (statusFilter && statusFilter !== '') params.status = statusFilter

            if (searchTerm) {
                // For search, use the regular search endpoint but filter results to top-level only
                return objectInstancesApi.search(searchTerm, params).then(response => ({
                    ...response,
                    data: {
                        ...response.data,
                        results: (response.data.results || response.data).filter(item => !item.parent)
                    }
                }))
            } else {
                // Use dedicated roots endpoint for top-level objects
                return objectInstancesApi.getRoots(params)
            }
        },
        enabled: currentView === 'list' && !!selectedObjectType
    })

    const objectTypes = objectTypesResponse?.data || []
    const instances = instancesResponse?.data?.results || instancesResponse?.data || []

    const handleObjectTypeSelect = (objectType) => {
        setSelectedObjectType(objectType)
        setCurrentView('list')
        setSearchTerm('')
        setStatusFilter('')
        // Update URL to reflect the selected type using the clean path
        navigate(`/objects/${objectType.name}`)
    }

    const handleBackToGrid = () => {
        setCurrentView('grid')
        setSelectedObjectType(null)
        setSearchTerm('')
        setStatusFilter('')
        // Clear URL parameters
        navigate('/objects')
    }

    const handleCreateNew = () => {
        if (selectedObjectType) {
            navigate(`/objects/new/${selectedObjectType.id}/content`)
        } else {
            addNotification('Please select an object type first', 'warning')
        }
    }

    const handleEditInstance = (instance) => {
        navigate(`/objects/${instance.id}/edit/content`)
    }

    const handleDeleteInstance = (instance) => {
        setDeleteModal({ isOpen: true, instance })
    }

    const handleConfirmDelete = () => {
        if (deleteModal.instance) {
            deleteMutation.mutate(deleteModal.instance.id)
        }
    }

    const handleCloseDeleteModal = () => {
        setDeleteModal({ isOpen: false, instance: null })
    }



    // Error handling
    if (typesError && currentView === 'grid') {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                    <span className="text-red-800">
                        Error loading object types: {typesError.message}
                    </span>
                </div>
            </div>
        )
    }

    if (instancesError && currentView === 'list') {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                    <span className="text-red-800">
                        Error loading objects: {instancesError.message}
                    </span>
                </div>
            </div>
        )
    }


    // Render the modal at component level
    const renderModal = () => {
        return (
            <DeleteConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={handleCloseDeleteModal}
                onConfirm={handleConfirmDelete}
                title="Delete Object"
                itemName={deleteModal.instance?.title}
                message={`Are you sure you want to delete "${deleteModal.instance?.title}"?`}
                warningText={deleteModal.instance?.children?.length > 0 ? "This object has sub-objects that will also be deleted." : null}
                isDeleting={deleteMutation.isPending}
                deleteButtonText="Delete Object"
            />
        )
    }

    // Grid View - Object Type Selection
    if (currentView === 'grid') {
        return (
            <>
                <div className="min-h-full bg-gray-50">
                    <div className="max-w-7xl mx-auto px-6 py-6">
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                        <FolderOpen className="h-6 w-6 mr-3" />
                                        Objects Publisher
                                    </h1>
                                </div>
                            </div>
                        </div>

                        {typesLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {objectTypes.map((objectType) => (
                                    <div
                                        key={objectType.id}
                                        onClick={() => handleObjectTypeSelect(objectType)}
                                        className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                                    >
                                        <div className="flex flex-col items-center text-center">
                                            {objectType.iconImage ? (
                                                <img
                                                    src={objectType.iconImage}
                                                    alt={objectType.label}
                                                    className="w-16 h-16 object-cover rounded-lg mb-3"
                                                />
                                            ) : (
                                                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                                                    <Image className="h-8 w-8 text-gray-400" />
                                                </div>
                                            )}
                                            <h3 className="text-lg font-medium text-gray-900 mb-1">
                                                {objectType.label}
                                            </h3>
                                            <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                                                {objectType.description || `Manage ${objectType.pluralLabel?.toLowerCase()}`}
                                            </p>
                                            <div className="text-xs text-gray-400">
                                                {objectType.instanceCount || 0} items
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!typesLoading && objectTypes.length === 0 && (
                            <div className="text-center py-12">
                                <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No Object Types Available</h3>
                                <p className="text-gray-500">
                                    Create object types in the admin interface to start managing content.
                                </p>
                            </div>
                        )}


                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                {renderModal()}

            </>
        )
    }

    // List View - Objects of Selected Type
    if (currentView === 'list') {
        return (
            <>
                <div className="min-h-full bg-gray-50">
                    <div className="max-w-7xl mx-auto px-6 py-6">
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                    <div>
                                        <div className="flex items-center mb-2">
                                            <button
                                                onClick={handleBackToGrid}
                                                className="mr-3 p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                                title="Back to content types"
                                            >
                                                <ArrowLeft className="h-4 w-4" />
                                            </button>
                                            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                                {selectedObjectType.iconImage ? (
                                                    <img
                                                        src={selectedObjectType.iconImage}
                                                        alt={selectedObjectType.label}
                                                        className="w-8 h-8 object-cover rounded mr-3"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center mr-3">
                                                        <Image className="h-5 w-5 text-gray-400" />
                                                    </div>
                                                )}
                                                {selectedObjectType.pluralLabel}
                                            </h1>
                                        </div>
                                        <p className="text-gray-600 ml-9">
                                            {selectedObjectType.description || `Browse and manage ${selectedObjectType.pluralLabel?.toLowerCase()}`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center transition-colors"
                                    onClick={handleCreateNew}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    New {selectedObjectType.label}
                                </button>
                            </div>

                            {/* Search and Filters */}
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder={`Search ${selectedObjectType.pluralLabel?.toLowerCase()}...`}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">All Status</option>
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>

                        {instancesLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                {instances.length > 0 ? (
                                    <div className="divide-y divide-gray-200">
                                        {instances.map((instance) => (
                                            <ObjectListItem
                                                key={instance.id}
                                                instance={instance}
                                                onEdit={() => handleEditInstance(instance)}
                                                onDelete={() => handleDeleteInstance(instance)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                                            No {selectedObjectType.pluralLabel} Found
                                        </h3>
                                        <p className="text-gray-500 mb-4">
                                            {searchTerm || statusFilter
                                                ? 'Try adjusting your search or filters.'
                                                : `Create your first ${selectedObjectType.label?.toLowerCase()} to get started.`
                                            }
                                        </p>
                                        {!searchTerm && !statusFilter && (
                                            <button
                                                onClick={handleCreateNew}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                                            >
                                                Create {selectedObjectType.label}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                {renderModal()}

            </>
        )
    }


    // Main component render with modal
    return (
        <>
            {/* Grid View - Object Type Selection */}
            {currentView === 'grid' && (
                <div className="min-h-full bg-gray-50">
                    <div className="max-w-7xl mx-auto px-6 py-6">
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">Objects</h1>
                                    <p className="text-gray-600 mt-1">Select an object type to view and manage objects</p>
                                </div>
                            </div>
                        </div>

                        {typesLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {objectTypes.map((objectType) => (
                                    <div
                                        key={objectType.id}
                                        onClick={() => handleObjectTypeSelect(objectType)}
                                        className="bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                                    >
                                        <div className="flex flex-col items-center text-center">
                                            {objectType.iconImage ? (
                                                <img
                                                    src={objectType.iconImage}
                                                    alt={objectType.label}
                                                    className="w-16 h-16 object-cover rounded-lg mb-3"
                                                />
                                            ) : (
                                                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                                                    <Image className="h-8 w-8 text-gray-400" />
                                                </div>
                                            )}
                                            <h3 className="text-lg font-medium text-gray-900 mb-1">
                                                {objectType.label}
                                            </h3>
                                            <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                                                {objectType.description || `Manage ${objectType.pluralLabel?.toLowerCase()}`}
                                            </p>
                                            <div className="text-xs text-gray-400">
                                                Click to view objects
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* List View - Objects of Selected Type */}
            {currentView === 'list' && (
                <div className="min-h-full bg-gray-50">
                    <div className="max-w-7xl mx-auto px-6 py-6">
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                    <button
                                        onClick={handleBackToGrid}
                                        className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                    </button>
                                    <div>
                                        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                            {selectedObjectType?.iconImage ? (
                                                <img
                                                    src={selectedObjectType.iconImage}
                                                    alt={selectedObjectType.label}
                                                    className="w-8 h-8 object-cover rounded mr-3"
                                                />
                                            ) : (
                                                <FolderOpen className="h-8 w-8 mr-3 text-gray-400" />
                                            )}
                                            {selectedObjectType?.pluralLabel}
                                        </h1>
                                        <p className="text-gray-600 mt-1">
                                            {selectedObjectType?.description || `Manage ${selectedObjectType?.pluralLabel?.toLowerCase()}`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCreateNew}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create {selectedObjectType?.label}
                                </button>
                            </div>
                        </div>

                        {instancesLoading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                {instances.length > 0 ? (
                                    <div className="divide-y divide-gray-200">
                                        {instances.map((instance) => (
                                            <ObjectListItem
                                                key={instance.id}
                                                instance={instance}
                                                onEdit={() => handleEditInstance(instance)}
                                                onDelete={() => handleDeleteInstance(instance)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                                            No {selectedObjectType?.pluralLabel?.toLowerCase()} found
                                        </h3>
                                        <p className="text-gray-600 mb-6">
                                            Get started by creating your first {selectedObjectType?.label?.toLowerCase()}.
                                        </p>
                                        {selectedObjectType && (
                                            <button
                                                onClick={handleCreateNew}
                                                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                Create {selectedObjectType.label}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {renderModal()}
        </>
    )
}

// Object List Item Component
const ObjectListItem = ({ instance, onEdit, onDelete }) => {
    const getStatusColor = (status) => {
        switch (status) {
            case 'published':
                return 'bg-green-100 text-green-800'
            case 'draft':
                return 'bg-yellow-100 text-yellow-800'
            case 'archived':
                return 'bg-gray-100 text-gray-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const handleRowClick = (e) => {
        // Don't trigger row click if delete button was clicked
        if (e.target.closest('.delete-button')) {
            return
        }
        onEdit(instance)
    }

    const handleDeleteClick = (e) => {
        e.stopPropagation()
        onDelete(instance)
    }

    return (
        <div
            className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={handleRowClick}
        >
            <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                            {instance.title}
                        </h3>
                        <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(instance.status)}`}>
                            {instance.status}
                        </span>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                        <span>Created {new Date(instance.createdAt).toLocaleDateString()}</span>
                        {instance.publishDate && (
                            <>
                                <span className="mx-2">•</span>
                                <span>Publish {new Date(instance.publishDate).toLocaleDateString()}</span>
                            </>
                        )}
                        {instance.parent && (
                            <>
                                <span className="mx-2">•</span>
                                <span>Child of {instance.parent.title}</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center ml-4">
                    <button
                        onClick={handleDeleteClick}
                        className="delete-button p-3 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors border border-transparent hover:border-red-200"
                        title="Delete object"
                    >
                        <Trash2 className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ObjectBrowser