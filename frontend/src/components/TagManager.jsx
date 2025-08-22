import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Download, Upload, Hash, AlertCircle } from 'lucide-react'
import { tagsApi } from '../api/tags'
import { useGlobalNotifications } from '../contexts/GlobalNotificationContext'
import TagForm from './TagForm'
import TagList from './TagList'

const TagManager = () => {
    const [searchTerm, setSearchTerm] = useState('')
    const [showTagForm, setShowTagForm] = useState(false)
    const [editingTag, setEditingTag] = useState(null)

    const queryClient = useQueryClient()
    const { addNotification } = useGlobalNotifications()

    // Fetch tags with filtering
    const { data: tagsResponse, isLoading, error } = useQuery({
        queryKey: ['tags', searchTerm],
        queryFn: () => {
            const params = {}
            if (searchTerm) params.search = searchTerm
            return tagsApi.list(params)
        }
    })

    const tags = tagsResponse?.data?.results || tagsResponse?.results || []

    // Create tag mutation
    const createTagMutation = useMutation({
        mutationFn: tagsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries(['tags'])
            setShowTagForm(false)
            addNotification('Tag created successfully', 'success')
        },
        onError: (error) => {
            console.error('Failed to create tag:', error)
            addNotification('Failed to create tag', 'error')
            throw error
        }
    })

    // Update tag mutation
    const updateTagMutation = useMutation({
        mutationFn: ({ id, ...data }) => tagsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['tags'])
            setEditingTag(null)
            addNotification('Tag updated successfully', 'success')
        },
        onError: (error) => {
            console.error('Failed to update tag:', error)
            addNotification('Failed to update tag', 'error')
            throw error
        }
    })

    // Delete tag mutation
    const deleteTagMutation = useMutation({
        mutationFn: tagsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries(['tags'])
            addNotification('Tag deleted successfully', 'success')
        },
        onError: (error) => {
            console.error('Failed to delete tag:', error)
            addNotification('Failed to delete tag', 'error')
        }
    })

    // Bulk delete mutation
    const bulkDeleteMutation = useMutation({
        mutationFn: tagsApi.bulkDelete,
        onSuccess: (response) => {
            queryClient.invalidateQueries(['tags'])
            const count = response.data?.deleted_count || 0
            addNotification(`${count} tags deleted successfully`, 'success')
        },
        onError: (error) => {
            console.error('Failed to bulk delete tags:', error)
            addNotification('Failed to delete selected tags', 'error')
        }
    })

    const handleCreateTag = async (tagData) => {
        await createTagMutation.mutateAsync(tagData)
    }

    const handleUpdateTag = async (tagData) => {
        await updateTagMutation.mutateAsync({
            id: editingTag.id,
            ...tagData
        })
    }

    const handleDeleteTag = async (tagId) => {
        await deleteTagMutation.mutateAsync(tagId)
    }

    const handleBulkDelete = async (tagIds) => {
        await bulkDeleteMutation.mutateAsync(tagIds)
    }

    const handleEditTag = (tag) => {
        setEditingTag(tag)
        setShowTagForm(true)
    }

    const handleCloseForm = () => {
        setShowTagForm(false)
        setEditingTag(null)
    }

    const exportTags = () => {
        const dataStr = JSON.stringify(tags, null, 2)
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

        const exportFileDefaultName = `tags-export-${new Date().toISOString().split('T')[0]}.json`

        const linkElement = document.createElement('a')
        linkElement.setAttribute('href', dataUri)
        linkElement.setAttribute('download', exportFileDefaultName)
        linkElement.click()
    }

    const handleImport = (event) => {
        const file = event.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const importedTags = JSON.parse(e.target.result)
                console.log('Imported tags:', importedTags)
                addNotification('Tag import functionality coming soon', 'info')
            } catch (error) {
                addNotification('Invalid JSON file', 'error')
            }
        }
        reader.readAsText(file)
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                        <span className="text-red-800">Failed to load tags: {error.message}</span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Hash className="w-8 h-8 mr-3 text-blue-600" />
                        Tag Manager
                    </h2>
                    <p className="text-gray-600 mt-1">
                        Organize your content with tags. Total: {tags.length} tags
                    </p>
                </div>
                <button
                    onClick={() => setShowTagForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Tag
                </button>
            </div>

            {/* Search and Export/Import */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search tags..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Export/Import */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={exportTags}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Export tags"
                        >
                            <Download className="w-5 h-5" />
                        </button>

                        <label className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer" title="Import tags">
                            <Upload className="w-5 h-5" />
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleImport}
                                className="hidden"
                            />
                        </label>
                    </div>
                </div>
            </div>

            {/* Tags List */}
            <TagList
                tags={tags}
                onEdit={handleEditTag}
                onDelete={handleDeleteTag}
                onBulkDelete={handleBulkDelete}
                isLoading={isLoading}
                showUsage={true}
            />

            {/* Tag Form Modal */}
            {showTagForm && (
                <TagForm
                    tag={editingTag}
                    onSave={editingTag ? handleUpdateTag : handleCreateTag}
                    onCancel={handleCloseForm}
                    isLoading={createTagMutation.isPending || updateTagMutation.isPending}
                />
            )}
        </div>
    )
}

export default TagManager