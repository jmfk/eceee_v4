/**
 * MediaEditModal Component
 * Modal for editing existing media inserts in WYSIWYG editor
 */

import React, { useState, useEffect } from 'react';
import { X, Trash2, Image as ImageIcon } from 'lucide-react';

const MediaEditModal = ({ isOpen, onClose, onSave, onDelete, initialConfig, mediaData }) => {
    const [config, setConfig] = useState({
        width: 'full',
        align: 'center',
        caption: ''
    });

    // Initialize config when modal opens
    useEffect(() => {
        if (isOpen && initialConfig) {
            setConfig({
                width: initialConfig.width || 'full',
                align: initialConfig.align || 'center',
                caption: initialConfig.caption || ''
            });
        }
    }, [isOpen, initialConfig]);

    const handleConfigChange = (field, value) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = () => {
        onSave(config);
        onClose();
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this media insert?')) {
            onDelete();
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <ImageIcon className="w-6 h-6 text-blue-600" />
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Edit Media Insert
                            </h2>
                            {mediaData && (
                                <p className="text-sm text-gray-600 mt-1">
                                    {mediaData.title || 'Media item'}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Preview */}
                    {mediaData && (
                        <div className="mb-6">
                            <h3 className="text-sm font-medium text-gray-900 mb-3">Preview</h3>
                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="flex items-center gap-4">
                                    {mediaData.imgproxyBaseUrl || mediaData.fileUrl ? (
                                        <img
                                            src={mediaData.imgproxyBaseUrl || mediaData.fileUrl}
                                            alt={mediaData.title}
                                            className="w-24 h-24 object-cover rounded"
                                        />
                                    ) : (
                                        <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center">
                                            <ImageIcon className="w-8 h-8 text-gray-400" />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {mediaData.title || mediaData.original_filename}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            {initialConfig?.mediaType === 'collection'
                                                ? `Collection (${mediaData.files?.length || 0} files)`
                                                : 'Single Image'
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Configuration Form */}
                    <div className="space-y-6">
                        {/* Width */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-3">
                                Width
                            </label>
                            <div className="flex gap-4">
                                {[
                                    { value: 'full', label: 'Full Width' },
                                    { value: 'half', label: 'Half Width' },
                                    { value: 'third', label: 'Third Width' }
                                ].map(option => (
                                    <label
                                        key={option.value}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        <input
                                            type="radio"
                                            name="width"
                                            value={option.value}
                                            checked={config.width === option.value}
                                            onChange={(e) => handleConfigChange('width', e.target.value)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Alignment */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-3">
                                Alignment
                            </label>
                            <div className="flex gap-4">
                                {[
                                    { value: 'left', label: 'Left' },
                                    { value: 'center', label: 'Center' },
                                    { value: 'right', label: 'Right' }
                                ].map(option => (
                                    <label
                                        key={option.value}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        <input
                                            type="radio"
                                            name="align"
                                            value={option.value}
                                            checked={config.align === option.value}
                                            onChange={(e) => handleConfigChange('align', e.target.value)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Caption */}
                        <div>
                            <label className="block text-sm font-medium text-gray-900 mb-2">
                                Caption
                            </label>
                            <input
                                type="text"
                                value={config.caption}
                                onChange={(e) => handleConfigChange('caption', e.target.value)}
                                placeholder="Enter image caption (optional)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MediaEditModal;

