import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Plus,
    Edit3,
    Trash2,
    Star,
    StarOff,
    Eye,
    EyeOff,
    Search,
    Filter,
    ChevronDown,
    Save,
    X,
    Users,
    FileText,
    Calendar,
    Database,
    Tag,
    FolderOpen,
    AlertTriangle
} from 'lucide-react'
import { namespacesApi } from '../api/namespaces.js'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import { useNotificationContext } from './NotificationManager'
import { extractErrorMessage } from '../utils/errorHandling.js'

const NamespaceManager = () => {
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [showFilters, setShowFilters] = useState(false)
    const [isCreating, setIsCreating] = useState(false)
    const [editingNamespace, setEditingNamespace] = useState(null)
    const [showContentSummary, setShowContentSummary] = useState(null)
    const { addNotification } = useGlobalNotifications()
    const queryClient = useQueryClient()
    const { showConfirm } = useNotificationContext()

    // Fetch namespaces
    const { data: namespacesResponse, isLoading } = useQuery({
        queryKey: ['namespaces', { search: searchTerm, status: statusFilter }],
        queryFn: async () => {
            const params = {}
            if (searchTerm) params.search = searchTerm
            if (statusFilter !== 'all') {
                if (statusFilter === 'active') params.is_active = true
                if (statusFilter === 'inactive') params.is_active = false
                if (statusFilter === 'default') params.is_default = true
            }
            return namespacesApi.list(params)
        }
    })

    // Mutations
    const createNamespaceMutation = useMutation({
        mutationFn: namespacesApi.create,
        onSuccess: () => {
            addNotification('Namespace created successfully', 'success', 'namespace-create')
            setIsCreating(false)
            queryClient.invalidateQueries(['namespaces'])
        },
        onError: (error) => {
            addNotification('Failed to create namespace', 'error', 'namespace-create')
        }
    })

    const updateNamespaceMutation = useMutation({
        mutationFn: ({ id, ...data }) => namespacesApi.update(id, data),
        onSuccess: () => {
            addNotification('Namespace updated successfully', 'success', 'namespace-update')
            setEditingNamespace(null)
            queryClient.invalidateQueries(['namespaces'])
        },
        onError: (error) => {
            addNotification('Failed to update namespace', 'error', 'namespace-update')
        }
    })

    const deleteNamespaceMutation = useMutation({
        mutationFn: namespacesApi.delete,
        onSuccess: () => {
            addNotification('Namespace deleted successfully', 'success', 'namespace-delete')
            queryClient.invalidateQueries(['namespaces'])
        },
        onError: (error) => {
            addNotification('Failed to delete namespace', 'error', 'namespace-delete')
        }
    })

    const setDefaultMutation = useMutation({
        mutationFn: namespacesApi.setAsDefault,
        onSuccess: (data) => {
            addNotification(data.message, 'success', 'namespace-default')
            queryClient.invalidateQueries(['namespaces'])
        },
        onError: (error) => {
            addNotification('Failed to set default namespace', 'error', 'namespace-default')
        }
    })

    const getContentSummaryMutation = useMutation({
        mutationFn: namespacesApi.getContentSummary,
        onSuccess: (data) => {
            setShowContentSummary(data)
        },
        onError: (error) => {
            addNotification('Failed to get content summary', 'error', 'namespace-summary')
        }
    })

    const namespaces = namespacesResponse?.results || []

    const handleDelete = async (namespace) => {
        if (namespace.is_default) {
            addNotification('Cannot delete the default namespace', 'error', 'namespace-validation')
            return
        }

        if (namespace.content_count > 0) {
            addNotification('Cannot delete namespace with existing content', 'error', 'namespace-validation')
            return
        }

        const confirmed = await showConfirm({
            title: 'Delete Namespace',
            message: `Are you sure you want to delete "${namespace.name}"? This action cannot be undone.`,
            confirmText: 'Delete',
            confirmButtonStyle: 'danger'
        })

        if (confirmed) {
            deleteNamespaceMutation.mutate(namespace.id)
        }
    }

    const handleSetDefault = (namespace) => {
        if (namespace.is_default) {
            addNotification('This namespace is already the default', 'info', 'namespace-info')
            return
        }
        setDefaultMutation.mutate(namespace.id)
    }

    const handleViewContent = (namespace) => {
        getContentSummaryMutation.mutate(namespace.id)
    }

    const getStatusBadge = (namespace) => {
        if (namespace.is_default) {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    <Star className="w-3 h-3 mr-1" />
                    Default
                </span>
            )
        }
        if (namespace.is_active) {
            return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Eye className="w-3 h-3 mr-1" />
                    Active
                </span>
            )
        }
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                <EyeOff className="w-3 h-3 mr-1" />
                Inactive
            </span>
        )
    }

    const getContentIcon = (type) => {
        switch (type) {
            case 'news': return <FileText className="w-4 h-4" />
            case 'events': return <Calendar className="w-4 h-4" />
            case 'library_items': return <Database className="w-4 h-4" />
            case 'members': return <Users className="w-4 h-4" />
            case 'categories': return <FolderOpen className="w-4 h-4" />
            case 'tags': return <Tag className="w-4 h-4" />
            default: return <Database className="w-4 h-4" />
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Namespace Management</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Organize content into separate namespaces to prevent slug conflicts
                    </p>
                </div>
                <button
                    onClick={() => setIsCreating(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Namespace
                </button>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center space-x-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search namespaces..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Filters
                        <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center space-x-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">All Status</option>
                                    <option value="active">Active Only</option>
                                    <option value="inactive">Inactive Only</option>
                                    <option value="default">Default Only</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Namespaces List */}
            <div className="bg-white rounded-lg shadow">
                {isLoading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-2 text-gray-600">Loading namespaces...</p>
                    </div>
                ) : namespaces.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No namespaces found</h3>
                        <p>Create your first namespace to get started</p>
                    </div>
                ) : (
                    <div className="overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Namespace
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Content
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {namespaces.map((namespace) => (
                                    <tr key={namespace.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">
                                                    {namespace.name}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {namespace.slug}
                                                </div>
                                                {namespace.description && (
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        {namespace.description}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(namespace)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm text-gray-900">
                                                    {namespace.content_count} items
                                                </span>
                                                {namespace.content_count > 0 && (
                                                    <button
                                                        onClick={() => handleViewContent(namespace)}
                                                        className="text-blue-600 hover:text-blue-800 text-xs"
                                                    >
                                                        View
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(namespace.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                {!namespace.is_default && (
                                                    <button
                                                        onClick={() => handleSetDefault(namespace)}
                                                        className="text-yellow-600 hover:text-yellow-800"
                                                        title="Set as default"
                                                    >
                                                        <StarOff className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setEditingNamespace(namespace)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="Edit namespace"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                {!namespace.is_default && namespace.content_count === 0 && (
                                                    <button
                                                        onClick={() => handleDelete(namespace)}
                                                        className="text-red-600 hover:text-red-800"
                                                        title="Delete namespace"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {(isCreating || editingNamespace) && (
                <NamespaceForm
                    namespace={editingNamespace}
                    onSave={(data) => {
                        if (editingNamespace) {
                            updateNamespaceMutation.mutate({ id: editingNamespace.id, ...data })
                        } else {
                            createNamespaceMutation.mutate(data)
                        }
                    }}
                    onCancel={() => {
                        setIsCreating(false)
                        setEditingNamespace(null)
                    }}
                    isLoading={createNamespaceMutation.isPending || updateNamespaceMutation.isPending}
                />
            )}

            {/* Content Summary Modal */}
            {showContentSummary && (
                <ContentSummaryModal
                    data={showContentSummary}
                    onClose={() => setShowContentSummary(null)}
                />
            )}
        </div>
    )
}

const NamespaceForm = ({ namespace = null, onSave, onCancel, isLoading = false }) => {
    const [formData, setFormData] = useState({
        name: namespace?.name || '',
        slug: namespace?.slug || '',
        description: namespace?.description || '',
        is_active: namespace?.is_active ?? true,
        is_default: namespace?.is_default ?? false
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.name.trim()) {
            addNotification('Namespace name is required', 'error', 'form-validation')
            return
        }
        if (!formData.slug.trim()) {
            addNotification('Namespace slug is required', 'error', 'form-validation')
            return
        }
        onSave(formData)
    }

    const generateSlug = (name) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
    }

    const handleNameChange = (e) => {
        const name = e.target.value
        setFormData(prev => ({
            ...prev,
            name,
            // Auto-generate slug if it's empty or matches the previous auto-generated slug
            slug: !namespace && (!prev.slug || prev.slug === generateSlug(prev.name))
                ? generateSlug(name)
                : prev.slug
        }))
    }

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-10 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                        {namespace ? 'Edit Namespace' : 'Create Namespace'}
                    </h3>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Name *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={handleNameChange}
                            placeholder="Enter namespace name"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Slug *
                        </label>
                        <input
                            type="text"
                            value={formData.slug}
                            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                            placeholder="namespace-slug"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Enter namespace description"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Active</span>
                        </label>

                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.is_default}
                                onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">Default</span>
                        </label>
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isLoading ? 'Saving...' : (namespace ? 'Update' : 'Create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

const ContentSummaryModal = ({ data, onClose }) => {
    const { namespace, content_summary } = data

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-10 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                        Content Summary: {namespace.name}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(content_summary).map(([type, count]) => {
                            if (type === 'total') return null
                            return (
                                <div key={type} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                                    {getContentIcon(type)}
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">
                                            {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </div>
                                        <div className="text-sm text-gray-500">{count} items</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="border-t pt-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">Total Content</span>
                            <span className="text-lg font-bold text-blue-600">
                                {content_summary.total} items
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NamespaceManager 