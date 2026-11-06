/**
 * ConfirmationModal - Reusable confirmation dialog
 * 
 * Simple modal for confirming destructive actions
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'danger' // 'danger' or 'warning'
}) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    const variantStyles = {
        danger: {
            button: 'bg-red-600 hover:bg-red-700 text-white',
            icon: 'text-red-600'
        },
        warning: {
            button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
            icon: 'text-yellow-600'
        }
    };

    const styles = variantStyles[variant] || variantStyles.danger;

    return createPortal(
            <div
                className="eceee-editor-ui fixed inset-0 bg-black/50 z-[10060] flex items-center justify-center"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={onClose}
            >
                {/* Modal */}
                <div
                    className="flex h-[min(70dvh,400px)] w-full max-w-md flex-col overflow-hidden bg-white shadow-xl mx-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                            <AlertTriangle className={`h-6 w-6 ${styles.icon}`} />
                            <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">{title}</div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                        <div className="text-gray-700">{message}</div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={handleConfirm}
                            className={`px-4 py-2 text-sm font-medium ${styles.button} transition-colors`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>,
        document.body
    );
};

export default ConfirmationModal;

