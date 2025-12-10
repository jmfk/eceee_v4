import React, { useState } from 'react'
import { Edit3, Trash2, AlertCircle, Hash } from 'lucide-react'

const TagList = ({
    tags = [],
    onEdit,
    onDelete,
    onBulkDelete,
    isLoading = false,
    showUsage = false
}) => {
    const [selectedTags, setSelectedTags] = useState(new Set())
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)

    const handleSelectTag = (tagId) => {
        const newSelected = new Set(selectedTags)
        if (newSelected.has(tagId)) {
            newSelected.delete(tagId)
        } else {
            newSelected.add(tagId)
        }
        setSelectedTags(newSelected)
    }

    const handleSelectAll = () => {
        if (selectedTags.size === tags.length) {
            setSelectedTags(new Set())
        } else {
            setSelectedTags(new Set(tags.map(tag => tag.id)))
        }
    }

    const handleDelete = async (tag) => {
        try {
            await onDelete(tag.id)
            setShowDeleteConfirm(null)
        } catch (error) {
            console.error('Failed to delete tag:', error)
        }
    }

    const handleBulkDelete = async () => {
        try {
            await onBulkDelete(Array.from(selectedTags))
            setSelectedTags(new Set())
            setShowBulkDeleteConfirm(false)
        } catch (error) {
            console.error('Failed to bulk delete tags:', error)
        }
    }

    const formatUsageCount = (count) => {
        if (count === 0) return 'Not used'
        if (count === 1) return '1 item'
        return `${count} items`
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading tags...</span>
            </div>
        )
    }

    if (tags.length === 0) {
        return (
            <div className="text-center py-12">
                <Hash className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <div className="text-lg font-medium text-gray-900 mb-2" role="heading" aria-level="3">No tags found</div>
                <div className="text-gray-600">
                    Create your first tag to start organizing your content.
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Bulk Actions */}
            {selectedTags.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <span className="text-sm font-medium text-blue-900">
                                {selectedTags.size} tag{selectedTags.size !== 1 ? 's' : ''} selected
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setShowBulkDeleteConfirm(true)}
                                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors flex items-center"
                            >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete Selected
                            </button>
                            <button
                                onClick={() => setSelectedTags(new Set())}
                                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                            >
                                Clear Selection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tags Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={selectedTags.size === tags.length && tags.length > 0}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tag
                                </th>
                                {showUsage && (
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Usage
                                    </th>
                                )}
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Created
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tags.map((tag) => (
                                <tr
                                    key={tag.id}
                                    className={`hover:bg-gray-50 ${selectedTags.has(tag.id) ? 'bg-blue-50' : ''}`}
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={selectedTags.has(tag.id)}
                                            onChange={() => handleSelectTag(tag.id)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                                {tag.name}
                                            </span>
                                        </div>
                                    </td>
                                    {showUsage && (
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">
                                                {formatUsageCount(tag.usageCount || 0)}
                                            </div>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                            {new Date(tag.createdAt).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end space-x-2">
                                            <button
                                                onClick={() => onEdit(tag)}
                                                className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-100 transition-colors"
                                                title="Edit tag"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(tag)}
                                                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-100 transition-colors"
                                                title="Delete tag"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                                <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">
                                    Delete Tag
                                </div>
                            </div>
                            <div className="text-gray-600 mb-6">
                                Are you sure you want to delete the tag "
                                <span className="font-medium">{showDeleteConfirm.name}</span>"?
                                This action cannot be undone.
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDelete(showDeleteConfirm)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Delete Tag
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Delete Confirmation Modal */}
            {showBulkDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                                <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">
                                    Delete Multiple Tags
                                </div>
                            </div>
                            <div className="text-gray-600 mb-6">
                                Are you sure you want to delete {selectedTags.size} selected tag
                                {selectedTags.size !== 1 ? 's' : ''}? This action cannot be undone.
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => setShowBulkDeleteConfirm(false)}
                                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Delete {selectedTags.size} Tag{selectedTags.size !== 1 ? 's' : ''}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TagList