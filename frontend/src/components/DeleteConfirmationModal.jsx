import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

const DeleteConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    itemName,
    isDeleting = false,
    deleteButtonText = "Delete",
    warningText = null
}) => {
    if (!isOpen) return null

    const handleConfirm = () => {
        onConfirm()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose()
        } else if (e.key === 'Enter') {
            handleConfirm()
        }
    }

    return (
        <div className="fixed inset-0 z-[10010] overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black transition-opacity"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="flex justify-center min-h-screen px-4 text-center sm:block sm:p-0" style={{ alignItems: 'flex-start', paddingTop: '20vh' }}>
                {/* Modal */}
                <div
                    className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 z-10"
                    onKeyDown={handleKeyDown}
                    tabIndex={-1}
                >
                    <div>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                                <div className="ml-4">
                                    <div className="text-lg leading-6 font-medium text-gray-900" role="heading" aria-level="3">
                                        {title || 'Confirm Deletion'}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="mt-3">
                            <div className="text-sm text-gray-500">
                                {message || `Are you sure you want to delete "${itemName}"?`}
                            </div>

                            {warningText && (
                                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <div className="flex">
                                        <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                                        <div className="ml-3">
                                            <div className="text-sm text-yellow-800">
                                                {warningText}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 text-sm font-medium text-gray-900">
                                This action cannot be undone.
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isDeleting}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isDeleting}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isDeleting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Deleting...
                                </>
                            ) : (
                                deleteButtonText
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DeleteConfirmationModal
