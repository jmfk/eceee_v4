import React, { useState, useMemo } from 'react'
import { X, AlertTriangle, RefreshCw, Copy, Calendar, FileText } from 'lucide-react'

/**
 * DuplicateResolveDialog
 * 
 * Shows duplicate files and allows user to choose: Replace or Keep Both
 * 
 * Props:
 * - duplicates: Array of duplicate file objects with { filename, error, status, reason, existing_file }
 * - onResolve: Callback with decisions object { filename: { action: 'replace'|'keep', existing_file_id, pending_file_id } }
 * - onCancel: Callback when user cancels
 */
const DuplicateResolveDialog = ({ duplicates, onResolve, onCancel }) => {
    // Track individual decisions for each file
    const [decisions, setDecisions] = useState(() => {
        const initial = {}
        duplicates.forEach(dup => {
            // Default to 'replace' for deleted files, otherwise null (undecided)
            initial[dup.filename] = dup.reason === 'duplicate_deleted' ? 'replace' : null
        })
        return initial
    })

    // Check if all files have decisions
    const allDecided = useMemo(() => {
        return duplicates.every(dup => decisions[dup.filename] !== null)
    }, [duplicates, decisions])

    const setDecision = (filename, action) => {
        setDecisions(prev => ({ ...prev, [filename]: action }))
    }

    const setAllDecisions = (action) => {
        const newDecisions = {}
        duplicates.forEach(dup => {
            newDecisions[dup.filename] = action
        })
        setDecisions(newDecisions)
    }

    const handleResolve = () => {
        // Build the resolve object with file actions
        const resolveData = {}
        duplicates.forEach(dup => {
            const action = decisions[dup.filename]
            if (action) {
                resolveData[dup.filename] = {
                    action,
                    existing_file_id: dup.existing_file?.id,
                    pending_file_id: dup.pending_file?.id
                }
            }
        })
        onResolve(resolveData)
    }

    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown'
        try {
            return new Date(dateString).toLocaleString()
        } catch {
            return dateString
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center">
                        <AlertTriangle className="w-6 h-6 text-orange-500 mr-3" />
                        <h2 className="text-xl font-semibold text-gray-900">
                            Duplicate Files Detected
                        </h2>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <p className="text-sm text-gray-600 mb-6">
                        The following files already exist in the system. Choose whether to replace the existing files or keep both.
                    </p>

                    {/* Bulk Actions */}
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setAllDecisions('replace')}
                            className="px-3 py-1.5 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 inline mr-1" />
                            Replace All
                        </button>
                        <button
                            onClick={() => setAllDecisions('keep')}
                            className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                        >
                            <Copy className="w-4 h-4 inline mr-1" />
                            Keep All (Upload as New)
                        </button>
                    </div>

                    {/* Duplicate Files List */}
                    <div className="space-y-4">
                        {duplicates.map((duplicate, index) => {
                            const existingFile = duplicate.existing_file || {}
                            const decision = decisions[duplicate.filename]

                            return (
                                <div
                                    key={index}
                                    className={`border rounded-lg p-4 ${decision === 'replace' ? 'border-orange-300 bg-orange-50' :
                                            decision === 'keep' ? 'border-blue-300 bg-blue-50' :
                                                'border-gray-200 bg-white'
                                        }`}
                                >
                                    {/* File Info */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center mb-1">
                                                <FileText className="w-4 h-4 text-gray-400 mr-2" />
                                                <span className="font-medium text-gray-900">
                                                    {duplicate.filename}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 ml-6">
                                                {duplicate.error}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Existing File Details */}
                                    {existingFile.id && (
                                        <div className="bg-gray-50 rounded p-3 mb-3 ml-6">
                                            <div className="text-xs text-gray-500 uppercase font-semibold mb-2">
                                                Existing File:
                                            </div>
                                            <div className="space-y-1 text-sm">
                                                {existingFile.title && (
                                                    <div>
                                                        <span className="text-gray-600">Title:</span>{' '}
                                                        <span className="text-gray-900">{existingFile.title}</span>
                                                    </div>
                                                )}
                                                {existingFile.original_filename && (
                                                    <div>
                                                        <span className="text-gray-600">Filename:</span>{' '}
                                                        <span className="text-gray-900">{existingFile.original_filename}</span>
                                                    </div>
                                                )}
                                                {existingFile.created_at && (
                                                    <div className="flex items-center text-gray-600">
                                                        <Calendar className="w-3 h-3 mr-1" />
                                                        {formatDate(existingFile.created_at)}
                                                    </div>
                                                )}
                                                {existingFile.is_deleted && (
                                                    <div className="text-red-600 font-medium">
                                                        (Previously Deleted)
                                                    </div>
                                                )}
                                                {existingFile.is_pending && (
                                                    <div className="text-yellow-600 font-medium">
                                                        (Pending Approval)
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Decision Buttons */}
                                    <div className="flex gap-2 ml-6">
                                        <button
                                            onClick={() => setDecision(duplicate.filename, 'replace')}
                                            className={`flex-1 px-4 py-2 text-sm font-medium rounded transition-colors ${decision === 'replace'
                                                    ? 'bg-orange-600 text-white'
                                                    : 'bg-white text-orange-700 border border-orange-300 hover:bg-orange-50'
                                                }`}
                                        >
                                            <RefreshCw className="w-4 h-4 inline mr-1" />
                                            Replace
                                        </button>
                                        <button
                                            onClick={() => setDecision(duplicate.filename, 'keep')}
                                            className={`flex-1 px-4 py-2 text-sm font-medium rounded transition-colors ${decision === 'keep'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-50'
                                                }`}
                                        >
                                            <Copy className="w-4 h-4 inline mr-1" />
                                            Keep Both
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                    <div className="text-sm text-gray-600">
                        {allDecided ? (
                            <span className="text-green-600 font-medium">✓ All files have decisions</span>
                        ) : (
                            <span>Choose an action for each file to continue</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleResolve}
                            disabled={!allDecided}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue Upload
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DuplicateResolveDialog

