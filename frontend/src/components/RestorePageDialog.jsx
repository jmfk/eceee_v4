import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { pagesApi } from '@/api/pages'

/**
 * RestorePageDialog Component
 * 
 * Shows restoration details and allows selecting which subpages to restore
 */
export default function RestorePageDialog({ page, onConfirm, onCancel }) {
    const [restoreMode, setRestoreMode] = useState('none') // 'none', 'all', 'selected'
    const [selectedChildren, setSelectedChildren] = useState(new Set())

    // Fetch deleted children
    const { data: childrenData, isLoading: childrenLoading } = useQuery({
        queryKey: ['deleted-page-children', page.id],
        queryFn: async () => {
            const result = await pagesApi.getPageChildren(page.id, { isDeleted: true })
            return result.results || []
        },
        enabled: page.childrenCount > 0
    })

    const deletedChildren = childrenData || []

    // Initialize selected children when loading completes
    useEffect(() => {
        if (deletedChildren.length > 0 && restoreMode === 'all') {
            setSelectedChildren(new Set(deletedChildren.map(c => c.id)))
        }
    }, [deletedChildren, restoreMode])

    // Handle restore mode change
    const handleRestoreModeChange = (mode) => {
        setRestoreMode(mode)
        if (mode === 'all') {
            setSelectedChildren(new Set(deletedChildren.map(c => c.id)))
        } else if (mode === 'none') {
            setSelectedChildren(new Set())
        }
    }

    // Handle child toggle
    const handleToggleChild = (childId) => {
        setSelectedChildren(prev => {
            const next = new Set(prev)
            if (next.has(childId)) {
                next.delete(childId)
            } else {
                next.add(childId)
            }
            return next
        })

        // Update mode if needed
        if (selectedChildren.has(childId) && selectedChildren.size === 1) {
            setRestoreMode('none')
        } else {
            setRestoreMode('selected')
        }
    }

    // Handle select all children
    const handleSelectAllChildren = () => {
        if (selectedChildren.size === deletedChildren.length) {
            setSelectedChildren(new Set())
            setRestoreMode('none')
        } else {
            setSelectedChildren(new Set(deletedChildren.map(c => c.id)))
            setRestoreMode('all')
        }
    }

    // Handle confirm
    const handleConfirm = () => {
        const options = {}

        if (restoreMode === 'all') {
            options.recursive = true
        } else if (restoreMode === 'selected' && selectedChildren.size > 0) {
            options.childIds = Array.from(selectedChildren)
        }

        onConfirm(page.id, options)
    }

    const hasWarnings = page.restorationWarnings && page.restorationWarnings.length > 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Restore Page</h2>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Page Info */}
                    <div className="mb-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            {page.title || page.slug || `Page ${page.id}`}
                        </h3>
                        <div className="text-sm text-gray-600 space-y-1">
                            <p>
                                <span className="font-medium">Slug:</span>{' '}
                                <span className="font-mono">{page.slug || 'None'}</span>
                            </p>
                            <p>
                                <span className="font-medium">Original Location:</span>{' '}
                                {page.parentPath}
                            </p>
                            <p>
                                <span className="font-medium">Deleted:</span>{' '}
                                {new Date(page.deletedAt).toLocaleString()} by {page.deletedByUsername}
                            </p>
                        </div>
                    </div>

                    {/* Warnings */}
                    {hasWarnings && (
                        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-yellow-900 mb-2">
                                        Restoration Warnings
                                    </h4>
                                    <ul className="text-sm text-yellow-800 space-y-1">
                                        {page.restorationWarnings.map((warning, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-yellow-600">•</span>
                                                <span>{warning}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Info box */}
                    {page.canRestore && !hasWarnings && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-blue-800">
                                    This page will be restored to its original location.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Children Section */}
                    {page.childrenCount > 0 && (
                        <div className="mb-6">
                            <h4 className="text-base font-medium text-gray-900 mb-3">
                                Subpages ({page.childrenCount})
                            </h4>

                            {childrenLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                                    <span className="ml-2 text-gray-600">Loading subpages...</span>
                                </div>
                            ) : deletedChildren.length > 0 ? (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* Select all header */}
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedChildren.size === deletedChildren.length}
                                                onChange={handleSelectAllChildren}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm font-medium text-gray-700">
                                                {selectedChildren.size === deletedChildren.length
                                                    ? 'Deselect all'
                                                    : 'Select all subpages'}
                                            </span>
                                        </label>
                                    </div>

                                    {/* Children list */}
                                    <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                                        {deletedChildren.map((child) => (
                                            <label
                                                key={child.id}
                                                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedChildren.has(child.id)}
                                                    onChange={() => handleToggleChild(child.id)}
                                                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {child.title || child.slug || `Page ${child.id}`}
                                                    </p>
                                                    <p className="text-xs text-gray-500 font-mono">
                                                        {child.slug}
                                                    </p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    {/* Selected count */}
                                    {selectedChildren.size > 0 && (
                                        <div className="bg-blue-50 px-4 py-2 border-t border-blue-200">
                                            <p className="text-sm text-blue-800">
                                                {selectedChildren.size} subpage{selectedChildren.size !== 1 ? 's' : ''} selected for restoration
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-600 italic">
                                    No deleted subpages found.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Restoration Summary */}
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">
                            What will be restored?
                        </h4>
                        <ul className="text-sm text-gray-700 space-y-1">
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                <span>The page: <strong>{page.title || page.slug}</strong></span>
                            </li>
                            {selectedChildren.size > 0 && (
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>
                                        {selectedChildren.size} selected subpage{selectedChildren.size !== 1 ? 's' : ''}
                                    </span>
                                </li>
                            )}
                            {selectedChildren.size === 0 && page.childrenCount > 0 && (
                                <li className="flex items-start gap-2">
                                    <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                    <span className="text-gray-600">Subpages will remain deleted</span>
                                </li>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Restore Page
                    </button>
                </div>
            </div>
        </div>
    )
}

