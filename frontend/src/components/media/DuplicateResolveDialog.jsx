import React from 'react'
import { X, AlertTriangle, Copy, Calendar, FileText } from 'lucide-react'

/**
 * DuplicateResolveDialog
 * 
 * Shows duplicate files and allows user to upload them with new names (Keep Both)
 * 
 * Props:
 * - duplicates: Array of duplicate file objects with { filename, error, status, reason, existing_file }
 * - onResolve: Callback with decisions object { filename: { action: 'keep', existing_file_id, pending_file_id } }
 * - onCancel: Callback when user cancels
 */
const DuplicateResolveDialog = ({ duplicates, onResolve, onCancel }) => {
    // All files will be set to 'keep' action (upload with new name)
    // No need for user decisions since replace is disabled

    const handleResolve = () => {
        // Build the resolve object with 'keep' action for all files
        const resolveData = {}
        duplicates.forEach(dup => {
            resolveData[dup.filename] = {
                action: 'keep', // Always keep both files
                existing_file_id: dup.existing_file?.id,
                pending_file_id: dup.pending_file?.id
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <div className="flex items-start">
                            <Copy className="w-5 h-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-blue-900 mb-1">
                                    Files will be uploaded with new names
                                </p>
                                <p className="text-sm text-blue-700">
                                    The following files already exist. They will be uploaded as new files with unique names, preserving the existing files.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Duplicate Files List */}
                    <div className="space-y-4">
                        {duplicates.map((duplicate, index) => {
                            const existingFile = duplicate.existing_file || {}

                            return (
                                <div
                                    key={index}
                                    className="border border-gray-200 rounded-lg p-4 bg-white"
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
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                    <div className="text-sm text-gray-600">
                        <span className="flex items-center">
                            <Copy className="w-4 h-4 mr-2 text-blue-600" />
                            {duplicates.length} file{duplicates.length > 1 ? 's' : ''} will be uploaded with unique names
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                            Cancel Upload
                        </button>
                        <button
                            onClick={handleResolve}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                        >
                            Upload as New Files
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DuplicateResolveDialog

