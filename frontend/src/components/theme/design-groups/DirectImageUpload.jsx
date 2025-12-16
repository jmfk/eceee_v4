/**
 * DirectImageUpload Component
 * 
 * Direct upload for design group images to object storage.
 * Bypasses Media Manager for simpler, direct uploads.
 */

import React, { useState, useRef } from 'react';
import { Upload, X, ImageIcon, Loader2, FolderOpen } from 'lucide-react';
import { themesApi } from '../../../api/themes';
import { useGlobalNotifications } from '../../../contexts/GlobalNotificationContext';
import ImageLibraryPicker from '../ImageLibraryPicker';

const DirectImageUpload = ({ themeId, value, onChange, label, disabled = false }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [showLibraryPicker, setShowLibraryPicker] = useState(false);
    const fileInputRef = useRef(null);
    const { addNotification } = useGlobalNotifications();

    const handleFileSelect = async (file) => {
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            addNotification({
                type: 'error',
                message: `Invalid file type. Allowed: JPG, PNG, GIF, WebP, SVG`,
            });
            return;
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            addNotification({
                type: 'error',
                message: 'File too large. Maximum size is 10MB',
            });
            return;
        }

        setIsUploading(true);
        try {
            const result = await themesApi.uploadDesignGroupImage(themeId, file);

            // Call onChange with the simple URL object
            onChange({
                url: result.url,
                filename: result.filename,
                size: result.size,
            });

            addNotification({
                type: 'success',
                message: 'Image uploaded successfully',
            });
        } catch (error) {
            console.error('Failed to upload image:', error);
            addNotification({
                type: 'error',
                message: error.message || 'Failed to upload image',
            });
        } finally {
            setIsUploading(false);
        }
    };

    const handleInputChange = (event) => {
        const file = event.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
        // Reset input so same file can be selected again
        event.target.value = '';
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleRemove = () => {
        onChange(null);
    };

    const handleClick = () => {
        if (!disabled && !isUploading) {
            fileInputRef.current?.click();
        }
    };

    const handleLibrarySelect = (image) => {
        onChange({
            url: image.url,
            filename: image.filename,
            size: image.size,
        });
        setShowLibraryPicker(false);
    };

    // Extract image info for display
    const imageUrl = value?.url;
    const imageFilename = value?.filename || 'Image';

    return (
        <div className="space-y-2">
            {label && (
                <label className="block text-xs font-medium text-gray-700">
                    {label}
                </label>
            )}

            {imageUrl ? (
                // Display current image
                <div className="border border-gray-300 rounded-lg p-3 bg-white">
                    {/* Full-width image preview */}
                    <div className="w-full mb-3">
                        <img
                            src={imageUrl}
                            alt={imageFilename}
                            className="w-full h-auto max-h-48 object-contain rounded border border-gray-200 bg-gray-50"
                        />
                    </div>

                    {/* Info and remove button */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                                {imageFilename}
                            </div>
                            {value?.size && (
                                <div className="text-xs text-gray-500 mt-1">
                                    {(value.size / 1024).toFixed(1)} KB
                                </div>
                            )}
                        </div>

                        {/* Remove button */}
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={disabled || isUploading}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition disabled:opacity-50"
                            title="Remove image"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Change buttons */}
                    <div className="pt-3 border-t border-gray-200 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowLibraryPicker(true)}
                            disabled={disabled || isUploading}
                            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                            <FolderOpen className="h-3 w-3" />
                            From Library
                        </button>
                        <button
                            type="button"
                            onClick={handleClick}
                            disabled={disabled || isUploading}
                            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                            {isUploading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Uploading...
                                </span>
                            ) : (
                                <>
                                    <Upload className="h-3 w-3" />
                                    Upload New
                                </>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                // Upload dropzone
                <div
                    className={`
                        border-2 border-dashed rounded-lg p-6 transition
                        ${dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 bg-gray-50'}
                        ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}
                    `}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <div className="flex flex-col items-center justify-center text-center">
                        {isUploading ? (
                            <>
                                <Loader2 className="h-8 w-8 text-purple-500 animate-spin mb-2" />
                                <div className="text-sm text-gray-600">
                                    Uploading...
                                </div>
                            </>
                        ) : (
                            <>
                                <ImageIcon className="h-10 w-10 text-gray-400 mb-2" />
                                <div className="text-sm text-gray-600 mb-3">
                                    Drop an image here or choose from library
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowLibraryPicker(true);
                                        }}
                                        disabled={disabled}
                                        className="px-3 py-2 text-sm border border-purple-600 text-purple-600 rounded-md hover:bg-purple-50 transition disabled:opacity-50 flex items-center gap-1"
                                    >
                                        <FolderOpen className="h-4 w-4" />
                                        Choose from Library
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleClick();
                                        }}
                                        disabled={disabled}
                                        className="px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-1"
                                    >
                                        <Upload className="h-4 w-4" />
                                        Upload New
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                onChange={handleInputChange}
                disabled={disabled || isUploading}
                className="hidden"
            />

            {/* Library Picker Modal */}
            {showLibraryPicker && (
                <ImageLibraryPicker
                    themeId={themeId}
                    currentSelection={value}
                    onSelect={handleLibrarySelect}
                    onCancel={() => setShowLibraryPicker(false)}
                />
            )}
        </div>
    );
};

DirectImageUpload.displayName = 'DirectImageUpload';

export default DirectImageUpload;

