import React, { useState, useCallback } from 'react'
import { Tag, Plus, X, Loader2 } from 'lucide-react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import MediaTagWidget from './MediaTagWidget'

/**
 * MediaItemTagEditor Component
 * 
 * Inline tag editor for individual media items.
 * Allows adding and removing tags from a media file.
 * Tags are saved globally to the MediaFile and persist across all usages.
 */
const MediaItemTagEditor = ({
    mediaFile,
    namespace,
    onTagsChanged = null,
    compact = false,
    className = ''
}) => {
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [localTags, setLocalTags] = useState(mediaFile?.tags || [])
    const { addNotification } = useGlobalNotifications()

    // Handle tag changes (from MediaTagWidget)
    const handleTagsChange = useCallback((newTags) => {
        setLocalTags(newTags)
    }, [])

    // Save tags to backend
    const handleSave = useCallback(async () => {
        if (!mediaFile?.id || !namespace) return

        setIsSaving(true)
        try {
            // Determine which tags to add and which to remove
            const existingTagIds = new Set((mediaFile.tags || []).map(tag => tag.id))
            const newTagIds = new Set(localTags.map(tag => tag.id))

            // Tags to add (in newTags but not in existing)
            const tagsToAdd = localTags.filter(tag => !existingTagIds.has(tag.id))
            
            // Tags to remove (in existing but not in newTags)
            const tagsToRemove = (mediaFile.tags || []).filter(tag => !newTagIds.has(tag.id))

            // Add new tags
            if (tagsToAdd.length > 0) {
                const tagNames = tagsToAdd.map(tag => tag.name)
                await mediaApi.files.addTags(mediaFile.id, tagNames)()
            }

            // Remove tags
            if (tagsToRemove.length > 0) {
                const tagIds = tagsToRemove.map(tag => tag.id)
                await mediaApi.files.removeTags(mediaFile.id, tagIds)()
            }

            // Fetch updated media file to get the latest data
            const updatedFile = await mediaApi.files.get(mediaFile.id)()

            // Notify parent component
            if (onTagsChanged) {
                onTagsChanged(updatedFile)
            }

            addNotification('Tags updated successfully', 'success')
            setIsEditing(false)

        } catch (error) {
            console.error('Failed to save tags:', error)
            addNotification(`Failed to save tags: ${error.message}`, 'error')
            // Revert to original tags on error
            setLocalTags(mediaFile?.tags || [])
        } finally {
            setIsSaving(false)
        }
    }, [mediaFile, namespace, localTags, onTagsChanged, addNotification])

    // Cancel editing
    const handleCancel = useCallback(() => {
        setLocalTags(mediaFile?.tags || [])
        setIsEditing(false)
    }, [mediaFile])

    // Start editing
    const handleStartEdit = useCallback(() => {
        setIsEditing(true)
    }, [])

    if (!mediaFile) {
        return null
    }

    // Compact mode: just show tag count with edit button
    if (compact && !isEditing) {
        const tagCount = (mediaFile.tags || []).length
        return (
            <button
                onClick={handleStartEdit}
                className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                    tagCount > 0
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } ${className}`}
                title={`${tagCount} tag${tagCount !== 1 ? 's' : ''}`}
            >
                <Tag className="w-3 h-3 mr-1" />
                {tagCount}
            </button>
        )
    }

    // Display mode: show tags with edit button
    if (!isEditing) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className="flex flex-wrap gap-1">
                    {(mediaFile.tags || []).length === 0 ? (
                        <span className="text-xs text-gray-500 italic">No tags</span>
                    ) : (
                        (mediaFile.tags || []).map(tag => (
                            <span
                                key={tag.id}
                                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-700"
                                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                            >
                                <Tag className="w-3 h-3 mr-1" />
                                {tag.name}
                            </span>
                        ))
                    )}
                </div>
                <button
                    onClick={handleStartEdit}
                    className="flex-shrink-0 p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit tags"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        )
    }

    // Edit mode: show MediaTagWidget with save/cancel buttons
    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-start justify-between">
                <label className="block text-sm font-medium text-gray-700">
                    <Tag className="w-4 h-4 inline mr-1" />
                    Tags
                </label>
                <button
                    onClick={handleCancel}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Cancel"
                    disabled={isSaving}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            <MediaTagWidget
                tags={localTags}
                onChange={handleTagsChange}
                namespace={namespace}
                disabled={isSaving}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
                <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        'Save Tags'
                    )}
                </button>
            </div>
        </div>
    )
}

export default MediaItemTagEditor
























