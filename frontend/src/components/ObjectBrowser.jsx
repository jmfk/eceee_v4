import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ArrowLeft, Plus, Grid, List, AlertCircle, Image, FolderOpen } from 'lucide-react'
import { objectTypesApi, objectInstancesApi } from '../api/objectStorage'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import ObjectInstanceEditor from './ObjectInstanceEditor'
import ObjectEditor from './ObjectEditor'

const ObjectBrowser = () => {
    const [currentView, setCurrentView] = useState('grid') // 'grid', 'list', 'edit'
    const [selectedObjectType, setSelectedObjectType] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [editingInstance, setEditingInstance] = useState(null)
    const [showLegacyEditor, setShowLegacyEditor] = useState(false)

    const { addNotification } = useGlobalNotifications()

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
            if (selectedObjectType) params.objectType = selectedObjectType.id
            if (searchTerm) params.search = searchTerm
            if (statusFilter) params.status = statusFilter

            if (searchTerm) {
                return objectInstancesApi.search(searchTerm, params)
            } else {
                return objectInstancesApi.list(params)
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
    }

    const handleBackToGrid = () => {
        setCurrentView('grid')
        setSelectedObjectType(null)
        setSearchTerm('')
        setStatusFilter('')
    }

    const handleCreateNew = () => {
        if (selectedObjectType) {
            setEditingInstance(null)
            setCurrentView('edit')
        } else {
            // Show legacy editor for backward compatibility
            setEditingInstance(null)
            setShowLegacyEditor(true)
        }
    }

    const handleEditInstance = (instance) => {
        setEditingInstance(instance)
        setCurrentView('edit')
    }

    const handleEditCancel = () => {
        setEditingInstance(null)
        setCurrentView(selectedObjectType ? 'list' : 'grid')
    }

    const handleEditSave = (savedInstance) => {
        setEditingInstance(null)
        setCurrentView('list')
        addNotification(
            `Object ${editingInstance ? 'updated' : 'created'} successfully`,
            'success'
        )
    }

    const handleLegacyEditSave = (savedInstance) => {
        setShowLegacyEditor(false)
        addNotification(
            `Object ${editingInstance ? 'updated' : 'created'} successfully`,
            'success'
        )
    }

    const handleLegacyEditCancel = () => {
        setShowLegacyEditor(false)
        setEditingInstance(null)
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

    // Grid View - Object Type Selection
    if (currentView === 'grid') {
        return (
            <div className="p-6">
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                <FolderOpen className="h-5 w-5 mr-2" />
                                Object Browser
                            </h2>
                            <p className="text-gray-600 mt-1">
                                Select an object type to browse and manage
                            </p>
                        </div>
                        <button
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center transition-colors"
                            onClick={handleCreateNew}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New Object
                        </button>
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

                {/* Legacy Editor Modal */}
                <ObjectInstanceEditor
                    instanceId={editingInstance?.id}
                    objectTypeId={editingInstance?.objectType?.id}
                    onSave={handleLegacyEditSave}
                    onCancel={handleLegacyEditCancel}
                    isVisible={showLegacyEditor}
                />
            </div>
        )
    }

    // List View - Objects of Selected Type
    if (currentView === 'list') {
        return (
            <div className="p-6">
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
                                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                    {selectedObjectType.iconImage ? (
                                        <img
                                            src={selectedObjectType.iconImage}
                                            alt={selectedObjectType.label}
                                            className="w-6 h-6 object-cover rounded mr-2"
                                        />
                                    ) : (
                                        <Image className="h-5 w-5 mr-2" />
                                    )}
                                    {selectedObjectType.pluralLabel}
                                </h2>
                                <p className="text-gray-600 mt-1">
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
                                        onDelete={(instance) => {
                                            // TODO: Implement delete functionality
                                            console.log('Delete:', instance)
                                        }}
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
        )
    }

    // Edit View - New Object Editor
    if (currentView === 'edit') {
        return (
            <ObjectEditor
                objectType={selectedObjectType}
                instance={editingInstance}
                onSave={handleEditSave}
                onCancel={handleEditCancel}
            />
        )
    }

    return null
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

    return (
        <div className="p-4 hover:bg-gray-50 transition-colors">
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
                <div className="flex items-center space-x-2 ml-4">
                    <button
                        onClick={() => onEdit(instance)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => onDelete(instance)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ObjectBrowser