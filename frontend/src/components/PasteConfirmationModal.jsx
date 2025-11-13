/**
 * PasteConfirmationModal - Modal for confirming paste actions
 * 
 * Shows Add/Replace options when pasting widgets into slots
 */
import React from 'react';
import { ClipboardPaste, X } from 'lucide-react';

const PasteConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    widgetCount = 1,
    mode = 'slot' // 'slot' or 'widget'
}) => {
    if (!isOpen) return null;

    const handleAdd = () => {
        onConfirm('add');
        onClose();
    };

    const handleReplace = () => {
        onConfirm('replace');
        onClose();
    };

    const widgetText = widgetCount === 1 ? 'widget' : `${widgetCount} widgets`;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-[10010] flex items-center justify-center"
                onClick={onClose}
            >
                {/* Modal */}
                <div
                    className="bg-white shadow-xl max-w-md w-full mx-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center space-x-3">
                            <ClipboardPaste className="h-6 w-6 text-blue-600" />
                            <h3 className="text-lg font-semibold text-gray-900">Paste {widgetText}</h3>
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
                    <div className="px-6 py-4">
                        <p className="text-gray-700 mb-4">
                            How would you like to paste {widgetText}?
                        </p>
                        <div className="space-y-3">
                            <div className="p-3 border border-gray-200 rounded hover:bg-gray-50">
                                <button
                                    onClick={handleAdd}
                                    className="w-full text-left"
                                >
                                    <div className="font-medium text-gray-900">Add to existing</div>
                                    <div className="text-sm text-gray-600">
                                        Append {widgetText} to the current slot
                                    </div>
                                </button>
                            </div>
                            <div className="p-3 border border-gray-200 rounded hover:bg-gray-50">
                                <button
                                    onClick={handleReplace}
                                    className="w-full text-left"
                                >
                                    <div className="font-medium text-gray-900">Replace all</div>
                                    <div className="text-sm text-gray-600">
                                        Remove existing widgets and paste {widgetText}
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PasteConfirmationModal;

