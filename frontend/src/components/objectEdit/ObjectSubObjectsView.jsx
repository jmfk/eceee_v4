import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, ChevronRight, Edit, Filter, SortAsc, SortDesc, X, Grid3X3, List, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { objectInstancesApi } from '../../api/objectStorage'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import ObjectTypeSelector from '../ObjectTypeSelector'
import DeleteConfirmationModal from '../DeleteConfirmationModal'

const ObjectSubObjectsView = ({ objectType, instance, isNewInstance, onSave, onCancel, context }) => {

    const navigate = useNavigate()
    const { addNotification } = useGlobalNotifications()
    const queryClient = useQueryClient()

    // View and filter state
    const [viewMode, setViewMode] = useState('list') // 'list' or 'grid'
    const [groupByType, setGroupByType] = useState(false)
    const [filterType, setFilterType] = useState('all')
    const [filterStatus, setFilterStatus] = useState('all')
    const [sortBy, setSortBy] = useState('title') // 'title', 'created', 'status'
    const [sortOrder, setSortOrder] = useState('asc') // 'asc' or 'desc'
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, child: null })

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (instanceId) => objectInstancesApi.delete(instanceId),
        onSuccess: () => {
            queryClient.invalidateQueries(['objectInstance', instance?.id, 'children'])
            queryClient.invalidateQueries(['objectInstances'])
            addNotification('Sub-object deleted successfully', 'success')
            setDeleteModal({ isOpen: false, child: null })
        },
        onError: (error) => {
            console.error('Delete failed:', error)
            const errorMessage = error.response?.data?.error || 'Failed to delete sub-object'
            addNotification(errorMessage, 'error')
            setDeleteModal({ isOpen: false, child: null })
        }
    })

    // Fetch child objects if editing an existing instance
    const { data: childrenResponse, isLoading: childrenLoading, error: childrenError } = useQuery({
        queryKey: ['objectInstance', instance?.id, 'children'],
        queryFn: () => objectInstancesApi.getChildren(instance.id),
        enabled: !!instance?.id
    })

    // Fetch allowed child types
    const allowedChildTypes = objectType?.allowedChildTypes || []
    const children = childrenResponse?.data || []


    // Get unique object types from children for filter options
    const childObjectTypes = useMemo(() => {
        const types = new Set()
        children.forEach(child => {
            if (child.objectTypeLabel) {
                types.add(JSON.stringify({ id: child.objectTypeName, label: child.objectTypeLabel }))
            }
        })
        return Array.from(types).map(typeStr => JSON.parse(typeStr))
    }, [children])

    // Filter and sort children
    const filteredAndSortedChildren = useMemo(() => {
        let filtered = children

        // Filter by object type
        if (filterType !== 'all') {
            filtered = filtered.filter(child => child.objectType?.id === parseInt(filterType))
        }

        // Filter by status
        if (filterStatus !== 'all') {
            filtered = filtered.filter(child => child.status === filterStatus)
        }

        // Sort
        filtered.sort((a, b) => {
            let comparison = 0

            switch (sortBy) {
                case 'title':
                    comparison = a.title.localeCompare(b.title)
                    break
                case 'created':
                    comparison = new Date(a.createdAt) - new Date(b.createdAt)
                    break
                case 'status':
                    comparison = a.status.localeCompare(b.status)
                    break
                default:
                    comparison = a.title.localeCompare(b.title)
            }

            return sortOrder === 'desc' ? -comparison : comparison
        })

        return filtered
    }, [children, filterType, filterStatus, sortBy, sortOrder])

    // Group children by object type
    const groupedChildren = useMemo(() => {
        if (!groupByType) return null

        const groups = {}
        filteredAndSortedChildren.forEach(child => {
            const typeKey = child.objectTypeName
            const typeLabel = child.objectTypeLabel

            if (!groups[typeKey]) {
                groups[typeKey] = {
                    type: typeKey,
                    label: typeLabel,
                    children: []
                }
            }
            groups[typeKey].children.push(child)
        })
        return Object.values(groups).sort((a, b) => a.label.localeCompare(b.label))
    }, [filteredAndSortedChildren, groupByType])

    const handleCreateSubObject = (childType, parentId) => {
        // Navigate to create new object with parent parameter
        navigate(`/objects/new/${childType.id}/content?parent=${parentId || instance.id}`)
    }

    const handleDeleteSubObject = (child) => {
        setDeleteModal({ isOpen: true, child })
    }

    const handleConfirmDelete = () => {
        if (deleteModal.child) {
            deleteMutation.mutate(deleteModal.child.id)
        }
    }

    const handleCloseDeleteModal = () => {
        setDeleteModal({ isOpen: false, child: null })
    }

    const toggleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortOrder('asc')
        }
    }

    // Component to render individual sub-object
    const SubObjectItem = ({ child, viewMode }) => (
        <div key={child.id} className={`${viewMode === 'grid' ? 'border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow' : ''} ${viewMode === 'list' ? 'border border-gray-200 rounded-lg' : ''} hover:border-blue-300 transition-all group`}>
            <Link
                to={`/objects/${child.id}/edit/content`}
                className="block"
            >
                <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-all cursor-pointer">
                    <div className="flex items-center flex-1">
                        {child.objectTypeIconImage ? (
                            <img
                                src={child.objectTypeIconImage}
                                alt={child.objectTypeLabel}
                                className="w-8 h-8 object-cover rounded mr-3"
                            />
                        ) : (
                            <div className="w-8 h-8 bg-gray-200 rounded mr-3 flex items-center justify-center">
                                <span className="text-xs text-gray-500 font-medium">
                                    {child.objectTypeLabel?.charAt(0)}
                                </span>
                            </div>
                        )}
                        <div className="flex-1">
                            <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors" role="heading" aria-level="4">{child.title}</div>
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <span className="font-medium text-blue-600">{child.objectTypeLabel}</span>
                                <span>•</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${child.status === 'published'
                                    ? 'text-green-700 bg-green-100'
                                    : child.status === 'draft'
                                        ? 'text-yellow-700 bg-yellow-100'
                                        : 'text-gray-700 bg-gray-100'
                                    }`}>
                                    {child.status}
                                </span>
                                {child.level > 0 && (
                                    <>
                                        <span>•</span>
                                        <span>Level {child.level}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleDeleteSubObject(child)
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete sub-object"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                </div>
            </Link>
        </div>
    )


    return (
        <>
            <div className="h-full flex flex-col relative">
                {/* Scrollable Content Area */}
                <div className="flex-1 min-h-0 overflow-y-auto bg-white">
                    <div className="p-6">
                        <div className="space-y-6">

                            <div className="space-y-6">

                                {isNewInstance ? (
                                    /* New Instance - Can't have children yet */
                                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <div className="text-lg font-medium text-gray-900 mb-2" role="heading" aria-level="3">No Sub-objects Yet</div>
                                        <div className="text-gray-600 mb-4">
                                            Sub-objects can be created after saving this {objectType?.label?.toLowerCase()}.
                                        </div>
                                        <button
                                            onClick={onSave}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                                        >
                                            Save to Enable Sub-objects
                                        </button>
                                    </div>
                                ) : (
                                    /* Existing Instance - Show children and creation options */
                                    <div className="space-y-6">
                                        {/* Controls Section */}
                                        <div className="flex items-center justify-between mb-6">
                                            {/* View and Filter Controls */}
                                            <div className="flex items-center space-x-4">
                                                {/* View Mode Toggle */}
                                                <div className="flex bg-gray-100 rounded-lg p-1">
                                                    <button
                                                        onClick={() => setViewMode('list')}
                                                        className={`p-2 rounded-md transition-colors ${viewMode === 'list'
                                                            ? 'bg-white text-gray-900 shadow-sm'
                                                            : 'text-gray-500 hover:text-gray-700'
                                                            }`}
                                                        title="List view"
                                                    >
                                                        <List className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setViewMode('grid')}
                                                        className={`p-2 rounded-md transition-colors ${viewMode === 'grid'
                                                            ? 'bg-white text-gray-900 shadow-sm'
                                                            : 'text-gray-500 hover:text-gray-700'
                                                            }`}
                                                        title="Grid view"
                                                    >
                                                        <Grid3X3 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                {/* Filters and Options */}
                                                {children.length > 0 && (
                                                    <div className="flex items-center space-x-3">
                                                        {/* Group by Type Toggle */}
                                                        {childObjectTypes.length > 1 && (
                                                            <label className="flex items-center space-x-2 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={groupByType}
                                                                    onChange={(e) => setGroupByType(e.target.checked)}
                                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                />
                                                                <span className="text-gray-700">Group by type</span>
                                                            </label>
                                                        )}

                                                        {/* Object Type Filter */}
                                                        {childObjectTypes.length > 1 && !groupByType && (
                                                            <select
                                                                value={filterType}
                                                                onChange={(e) => setFilterType(e.target.value)}
                                                                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            >
                                                                <option value="all">All types</option>
                                                                {childObjectTypes.map(type => (
                                                                    <option key={type.id} value={type.id}>{type.label}</option>
                                                                ))}
                                                            </select>
                                                        )}

                                                        {/* Status Filter */}
                                                        <select
                                                            value={filterStatus}
                                                            onChange={(e) => setFilterStatus(e.target.value)}
                                                            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        >
                                                            <option value="all">All status</option>
                                                            <option value="draft">Draft</option>
                                                            <option value="published">Published</option>
                                                        </select>

                                                        {/* Sort Options */}
                                                        <div className="flex items-center space-x-1">
                                                            <select
                                                                value={sortBy}
                                                                onChange={(e) => setSortBy(e.target.value)}
                                                                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            >
                                                                <option value="title">Sort by Title</option>
                                                                <option value="created">Sort by Created</option>
                                                                <option value="status">Sort by Status</option>
                                                            </select>
                                                            <button
                                                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                                                className="p-1.5 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                                                title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                                                            >
                                                                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Add Sub-object Button */}
                                            <ObjectTypeSelector
                                                allowedChildTypes={allowedChildTypes}
                                                onSelect={handleCreateSubObject}
                                                parentId={instance.id}
                                                placeholder="Add sub-object"
                                            />
                                        </div>

                                        {/* Existing Children */}
                                        <div>

                                            {childrenLoading ? (
                                                <div className="flex justify-center py-8">
                                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                                </div>
                                            ) : filteredAndSortedChildren.length > 0 ? (
                                                groupByType && groupedChildren ? (
                                                    /* Grouped View */
                                                    <div className="space-y-6">
                                                        {groupedChildren.map((group) => (
                                                            <div key={group.type} className="space-y-3">
                                                                {/* Group Header */}
                                                                <div className="flex items-center space-x-3 pb-2 border-b border-gray-200">
                                                                    {group.type?.iconImage ? (
                                                                        <img
                                                                            src={group.type.iconImage}
                                                                            alt={group.label}
                                                                            className="w-6 h-6 object-cover rounded"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                                                                            <span className="text-blue-600 font-medium text-xs">
                                                                                {group.label.charAt(0)}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    <div className="font-medium text-gray-900" role="heading" aria-level="3">{group.label}</div>
                                                                    <span className="text-sm text-gray-500">({group.children.length})</span>
                                                                </div>
                                                                {/* Group Items */}
                                                                <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
                                                                    {group.children.map((child) => (
                                                                        <SubObjectItem key={child.id} child={child} viewMode={viewMode} />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    /* Regular View */
                                                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-2'}>
                                                        {filteredAndSortedChildren.map((child) => (
                                                            <SubObjectItem key={child.id} child={child} viewMode={viewMode} />
                                                        ))}
                                                    </div>
                                                )
                                            ) : children.length > 0 ? (
                                                <div className="text-center py-8 bg-gray-50 rounded-lg">
                                                    <Filter className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                                    <div className="text-gray-600">
                                                        No sub-objects match the current filters.
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setFilterType('all')
                                                            setFilterStatus('all')
                                                        }}
                                                        className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                                                    >
                                                        Clear filters
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 bg-gray-50 rounded-lg">
                                                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                                    <div className="text-gray-600">
                                                        No sub-objects created yet.
                                                        {allowedChildTypes.length > 0
                                                            ? ' Use the "Add sub-object" button above to create new sub-objects.'
                                                            : ' This object type does not allow child objects.'
                                                        }
                                                    </div>
                                                </div>
                                            )}
                                        </div>


                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Save buttons are now in the main footer */}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <DeleteConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={handleCloseDeleteModal}
                onConfirm={handleConfirmDelete}
                title="Delete Sub-object"
                itemName={deleteModal.child?.title}
                message={`Are you sure you want to delete "${deleteModal.child?.title}"?`}
                warningText="This action will also delete any sub-objects it contains."
                isDeleting={deleteMutation.isPending}
                deleteButtonText="Delete Sub-object"
            />
        </>
    )
}


export default ObjectSubObjectsView
