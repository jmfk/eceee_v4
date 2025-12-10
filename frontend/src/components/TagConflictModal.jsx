import React, { useState, useEffect } from 'react'
import { X, AlertTriangle, Hash } from 'lucide-react'

const TagConflictModal = ({ 
    isOpen, 
    onClose, 
    conflictedTag, 
    onResolve, 
    existingTag = null,
    conflictType = 'duplicate' // 'duplicate' or 'invalid'
}) => {
    const [newTagName, setNewTagName] = useState('')
    const [isValidating, setIsValidating] = useState(false)

    useEffect(() => {
        if (isOpen && conflictedTag) {
            setNewTagName(conflictedTag)
        }
    }, [isOpen, conflictedTag])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!newTagName.trim()) return

        setIsValidating(true)
        try {
            await onResolve(newTagName.trim())
            onClose()
        } catch (error) {
            // Error handling is done in parent component
        } finally {
            setIsValidating(false)
        }
    }

    const handleCancel = () => {
        setNewTagName('')
        onClose()
    }

    if (!isOpen) return null

    const getConflictMessage = () => {
        switch (conflictType) {
            case 'duplicate':
                return existingTag 
                    ? `A tag named "${conflictedTag}" already exists in this namespace.`
                    : `A tag named "${conflictedTag}" already exists.`
            case 'invalid':
                return `The tag name "${conflictedTag}" contains invalid characters or is too long.`
            default:
                return `There was an issue with the tag "${conflictedTag}".`
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center">
                        <AlertTriangle className="w-6 h-6 text-amber-500 mr-3" />
                        <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">
                            Tag Conflict
                        </div>
                    </div>
                    <button
                        onClick={handleCancel}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-4">
                        <div className="text-gray-700 mb-4">
                            {getConflictMessage()}
                        </div>
                        
                        {existingTag && (
                            <div className="bg-gray-50 rounded-lg p-3 mb-4">
                                <div className="flex items-center text-sm text-gray-600">
                                    <Hash className="w-4 h-4 mr-2" />
                                    <span className="font-medium">{existingTag.name}</span>
                                    <span className="ml-auto">
                                        {existingTag.usage_count || 0} uses
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="text-gray-600 text-sm">
                            Please choose a different name for your tag:
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                New Tag Name
                            </label>
                            <input
                                type="text"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter a new tag name..."
                                maxLength={50}
                                disabled={isValidating}
                                autoFocus
                            />
                            <div className="text-xs text-gray-500 mt-1">
                                Tag names should be unique and contain only letters, numbers, spaces, and hyphens.
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end space-x-3">
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                disabled={isValidating}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!newTagName.trim() || isValidating}
                            >
                                {isValidating ? 'Validating...' : 'Use This Name'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default TagConflictModal
