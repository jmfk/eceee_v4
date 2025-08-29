import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, Plus, FolderOpen, AlertCircle, Edit, Eye, Trash2, ChevronRight, ChevronDown, Settings, X } from 'lucide-react'
import { objectInstancesApi, objectTypesApi } from '../api/objectStorage'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import ObjectInstanceEditor from './ObjectInstanceEditor'
import ConfirmDialog from './ConfirmDialog'

const ObjectBrowser = () => {
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedType, setSelectedType] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [showEditor, setShowEditor] = useState(false)
    const [editingInstance, setEditingInstance] = useState(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
    const [expandedItems, setExpandedItems] = useState(new Set())
    const [viewMode, setViewMode] = useState('list') // 'list' or 'tree'
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false)
    const [advancedFilters, setAdvancedFilters] = useState({
        level: '',
        dateFrom: '',
        dateTo: '',
        publishedOnly: false
    })
    const [selectedItems, setSelectedItems] = useState(new Set())
    const [showBulkActions, setShowBulkActions] = useState(false)

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: objectInstancesApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries(['objectInstances'])
            setShowDeleteConfirm(null)
            addNotification('Object deleted successfully', 'success')
        },
        onError: (error) => {
            console.error('Failed to delete object:', error)
            addNotification('Failed to delete object', 'error')
        }
    })

    // Bulk operations mutation
    const bulkOperationMutation = useMutation({
        mutationFn: ({ operation, objectIds }) => objectInstancesApi.bulkOperation(operation, objectIds),
        onSuccess: (response, variables) => {
            queryClient.invalidateQueries(['objectInstances'])
            setSelectedItems(new Set())
            setShowBulkActions(false)
            addNotification(`Bulk ${variables.operation} completed successfully`, 'success')
        },
        onError: (error) => {
            console.error('Bulk operation failed:', error)
            addNotification('Bulk operation failed', 'error')
        }
    })

    // Fetch object types for filter
    const { data: typesResponse } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getActive()
    })

    const objectTypes = typesResponse?.data?.results || typesResponse?.data || []

    // Fetch object instances
    const { data: instancesResponse, isLoading, error } = useQuery({
        queryKey: ['objectInstances', searchTerm, selectedType, statusFilter, advancedFilters],
        queryFn: () => {
            const params = {}
            if (searchTerm) params.search = searchTerm
            if (selectedType) params.objectType = selectedType
            if (statusFilter) params.status = statusFilter

            // Add advanced filters if any are set
            if (advancedFilters.level) params.level = advancedFilters.level
            if (advancedFilters.dateFrom) params.dateFrom = advancedFilters.dateFrom
            if (advancedFilters.dateTo) params.dateTo = advancedFilters.dateTo
            if (advancedFilters.publishedOnly) params.publishedOnly = 'true'

            // Use search endpoint if we have search term or advanced filters
            if (searchTerm || Object.values(advancedFilters).some(v => v)) {
                return objectInstancesApi.search(searchTerm, params)
            } else {
                return objectInstancesApi.list(params)
            }
        }
    })
    console.log("instancesResponse", instancesResponse, isLoading, error)
    const instances = instancesResponse?.data?.results || instancesResponse?.data || []

    // Selection handlers
    const toggleItemSelection = (itemId) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev)
            if (newSet.has(itemId)) {
                newSet.delete(itemId)
            } else {
                newSet.add(itemId)
            }
            return newSet
        })
    }

    const toggleSelectAll = () => {
        if (selectedItems.size === instances.length && instances.length > 0) {
            setSelectedItems(new Set())
        } else {
            setSelectedItems(new Set(instances.map(item => item.id)))
        }
    }

    const handleBulkOperation = (operation) => {
        if (selectedItems.size === 0) return

        const objectIds = Array.from(selectedItems)
        bulkOperationMutation.mutate({ operation, objectIds })
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                    <span className="text-red-800">
                        Error loading objects: {error.message}
                    </span>
                </div>
            </div>
        )
    }

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
                            Browse and manage object instances across all types
                        </p>
                    </div>
                    <button
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center transition-colors"
                        onClick={() => {
                            setEditingInstance(null)
                            setShowEditor(true)
                        }}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        New Object
                    </button>
                </div>

                {/* Filters and View Controls */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search objects..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Types</option>
                            {objectTypes.map((type) => (
                                <option key={type.name} value={type.name}>
                                    {type.label}
                                </option>
                            ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">All Statuses</option>
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>

                    {/* Advanced Search Toggle */}
                    <button
                        onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                        className={`px-3 py-2 border rounded-md text-sm flex items-center transition-colors ${showAdvancedSearch
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'border-gray-300 text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Advanced
                    </button>

                    {/* View Mode Toggle */}
                    <div className="flex bg-gray-100 rounded-md p-1">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${viewMode === 'list'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            List View
                        </button>
                        <button
                            onClick={() => setViewMode('tree')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${viewMode === 'tree'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Tree View
                        </button>
                    </div>
                </div>

                {/* Advanced Search Panel */}
                {showAdvancedSearch && (
                    <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium text-gray-900">Advanced Search Filters</h3>
                            <button
                                onClick={() => {
                                    setAdvancedFilters({
                                        level: '',
                                        dateFrom: '',
                                        dateTo: '',
                                        publishedOnly: false
                                    })
                                }}
                                className="text-xs text-gray-500 hover:text-gray-700"
                            >
                                Clear All
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Hierarchy Level
                                </label>
                                <select
                                    value={advancedFilters.level}
                                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, level: e.target.value }))}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">Any Level</option>
                                    <option value="0">Root (Level 0)</option>
                                    <option value="1">Level 1</option>
                                    <option value="2">Level 2</option>
                                    <option value="3">Level 3</option>
                                    <option value="4">Level 4+</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Created From
                                </label>
                                <input
                                    type="date"
                                    value={advancedFilters.dateFrom}
                                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Created To
                                </label>
                                <input
                                    type="date"
                                    value={advancedFilters.dateTo}
                                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex items-end">
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={advancedFilters.publishedOnly}
                                        onChange={(e) => setAdvancedFilters(prev => ({ ...prev, publishedOnly: e.target.checked }))}
                                        className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label className="ml-2 text-xs text-gray-700">
                                        Published only
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Search Stats */}
                        {instancesResponse?.count !== undefined && (
                            <div className="text-xs text-gray-600 pt-2 border-t border-gray-200">
                                {instancesResponse.count} result{instancesResponse.count !== 1 ? 's' : ''} found
                                {instancesResponse.query && (
                                    <span> for "{instancesResponse.query}"</span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Bulk Actions Bar */}
                {selectedItems.size > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-900">
                                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                            </span>
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => handleBulkOperation('publish')}
                                    disabled={bulkOperationMutation.isPending}
                                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                                >
                                    Publish
                                </button>
                                <button
                                    onClick={() => handleBulkOperation('unpublish')}
                                    disabled={bulkOperationMutation.isPending}
                                    className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
                                >
                                    Unpublish
                                </button>
                                <button
                                    onClick={() => handleBulkOperation('archive')}
                                    disabled={bulkOperationMutation.isPending}
                                    className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
                                >
                                    Archive
                                </button>
                                <button
                                    onClick={() => handleBulkOperation('delete')}
                                    disabled={bulkOperationMutation.isPending}
                                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => setSelectedItems(new Set())}
                                    className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* Objects List */}
            {!isLoading && (
                <div className="bg-white rounded-lg border border-gray-200">
                    {instances.length === 0 ? (
                        <div className="text-center py-12">
                            <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                {searchTerm || selectedType || statusFilter ? 'No matching objects' : 'No objects yet'}
                            </h3>
                            <p className="text-gray-600 mb-6">
                                {searchTerm || selectedType || statusFilter
                                    ? 'Try adjusting your search or filter criteria'
                                    : 'Create your first object to get started'
                                }
                            </p>
                        </div>
                    ) : (
                        <div>
                            {/* Select All Header */}
                            {instances.length > 0 && (
                                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.size === instances.length && instances.length > 0}
                                        onChange={toggleSelectAll}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <label className="ml-2 text-sm text-gray-700">
                                        Select All ({instances.length} items)
                                    </label>
                                </div>
                            )}

                            <div className="divide-y divide-gray-200">
                                {instances.map((instance) => (
                                    <ObjectRow
                                        key={instance.id}
                                        instance={instance}
                                        isSelected={selectedItems.has(instance.id)}
                                        onSelect={() => toggleItemSelection(instance.id)}
                                        onEdit={(inst) => {
                                            setEditingInstance(inst)
                                            setShowEditor(true)
                                        }}
                                        onDelete={(inst) => setShowDeleteConfirm(inst)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Object Instance Editor */}
            {showEditor && (
                <ObjectInstanceEditor
                    instanceId={editingInstance?.id}
                    objectTypeId={editingInstance?.objectType?.id}
                    isVisible={showEditor}
                    onSave={() => {
                        setShowEditor(false)
                        setEditingInstance(null)
                    }}
                    onCancel={() => {
                        setShowEditor(false)
                        setEditingInstance(null)
                    }}
                />
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <ConfirmDialog
                    title="Delete Object"
                    message={`Are you sure you want to delete "${showDeleteConfirm.title}"? This action cannot be undone.`}
                    onConfirm={() => deleteMutation.mutate(showDeleteConfirm.id)}
                    onCancel={() => setShowDeleteConfirm(null)}
                    confirmText="Delete"
                    confirmButtonClass="bg-red-600 hover:bg-red-700"
                />
            )}
        </div>
    )
}

// Object Row Component
const ObjectRow = ({ instance, isSelected, onSelect, onEdit, onDelete }) => {
    const statusColors = {
        draft: 'bg-gray-100 text-gray-800',
        published: 'bg-green-100 text-green-800',
        archived: 'bg-yellow-100 text-yellow-800'
    }

    const statusColor = statusColors[instance.status] || 'bg-gray-100 text-gray-800'

    return (
        <div className={`p-4 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                    {/* Selection Checkbox */}
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onSelect}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-4"
                    />

                    <div className="flex-1">
                        <div className="flex items-center space-x-3">
                            {/* Hierarchy indentation */}
                            <div style={{ marginLeft: `${instance.level * 20}px` }} className="flex items-center">
                                {instance.level > 0 && (
                                    <div className="w-4 h-4 border-l-2 border-b-2 border-gray-300 mr-2"></div>
                                )}
                                <h3 className="text-lg font-medium text-gray-900">{instance.title}</h3>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                {instance.status}
                            </span>
                            {instance.isPublished && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Live
                                </span>
                            )}
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500" style={{ marginLeft: `${instance.level * 20 + 20}px` }}>
                            <span>{instance.objectTypeLabel}</span>
                            <span>•</span>
                            <span>Level {instance.level}</span>
                            {instance.parentTitle && (
                                <>
                                    <span>•</span>
                                    <span>Parent: {instance.parentTitle}</span>
                                </>
                            )}
                            <span>•</span>
                            <span>v{instance.version}</span>
                            <span>•</span>
                            <span>{instance.createdByName}</span>
                            <span>•</span>
                            <span>{new Date(instance.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => onEdit(instance)}
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                        >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                        </button>
                        <button
                            onClick={() => {
                                // TODO: Implement view object details
                                alert('Object details view will be implemented in the next update')
                            }}
                            className="text-gray-600 hover:text-gray-800 text-sm flex items-center"
                        >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                        </button>
                        <button
                            onClick={() => onDelete(instance)}
                            className="text-red-600 hover:text-red-800 text-sm flex items-center"
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ObjectBrowser
