/**
 * MediaEditModal Component
 * Modal for editing existing media inserts in WYSIWYG editor
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Image as ImageIcon, RefreshCw } from 'lucide-react';
import MediaBrowser from './MediaBrowser';
import { useTheme } from '../../hooks/useTheme';

const MediaEditModal = ({ isOpen, onClose, onSave, onDelete, initialConfig, mediaData: initialMediaData, mediaLoadError, namespace, pageId }) => {
    const { currentTheme } = useTheme({ pageId, enabled: true }); // Enable to get theme data including imageStyles
    const [config, setConfig] = useState({
        width: 'full',
        align: 'center',
        caption: '',
        altText: '',
        galleryStyle: null
    });
    const [mediaData, setMediaData] = useState(initialMediaData);
    const [isChangingMedia, setIsChangingMedia] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    // Get available image styles from theme (unified gallery and carousel styles)
    const availableImageStyles = useMemo(() => {
        if (!currentTheme || !currentTheme.imageStyles) {
            return [];
        }

        const imageStyles = currentTheme.imageStyles;
        const entries = Object.entries(imageStyles);
        
        return entries.map(([key, style]) => ({
            value: key,
            label: style.name || key,
            description: style.description,
            styleType: style.styleType || 'gallery'
        }));
    }, [currentTheme]);

    // Initialize config when modal opens
    useEffect(() => {
        if (isOpen && initialConfig) {
            setConfig({
                width: initialConfig.width || 'full',
                align: initialConfig.align || 'center',
                caption: initialConfig.caption || '',
                altText: initialConfig.altText || initialMediaData?.title || '',
                galleryStyle: initialConfig.galleryStyle || null
            });
            setMediaData(initialMediaData);
            
            // If there was an error loading the media, open the image selector immediately
            if (mediaLoadError && !initialMediaData) {
                setIsChangingMedia(true);
                setErrorMessage('The original image could not be found. Please select a new image.');
            } else {
                setIsChangingMedia(false);
                setErrorMessage(null);
            }
        }
    }, [isOpen, initialConfig, initialMediaData, mediaLoadError]);

    const handleConfigChange = (field, value) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = () => {
        onSave({
            ...config,
            mediaData: mediaData,
            mediaId: mediaData.id,
            mediaType: mediaData.files ? 'collection' : 'image'
        });
        onClose();
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this media insert?')) {
            onDelete();
            onClose();
        }
    };

    const handleChangeMedia = () => {
        setIsChangingMedia(true);
    };

    const handleMediaSelect = (newMedia) => {
        setMediaData(newMedia);
        // Update caption and altText to new media title if current values match old media title
        const updates = {};
        if (config.caption === initialMediaData?.title) {
            updates.caption = newMedia.title || '';
        }
        if (config.altText === initialMediaData?.title || !config.altText) {
            updates.altText = newMedia.title || '';
        }
        if (Object.keys(updates).length > 0) {
            setConfig(prev => ({
                ...prev,
                ...updates
            }));
        }
        setIsChangingMedia(false);
        setErrorMessage(null); // Clear error message after selection
    };

    const handleCancelChange = () => {
        // Don't allow canceling if there's no media data (must select an image)
        if (!mediaData && errorMessage) {
            return;
        }
        setIsChangingMedia(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/50">
            <div className={`bg-white rounded-lg shadow-xl w-full max-h-[90vh] flex flex-col ${isChangingMedia ? 'max-w-6xl' : 'max-w-2xl'}`}>
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
                    {isChangingMedia ? (
                        /* Media Browser for changing image */
                        <div>
                            <div className="mb-4">
                                <h3 className="text-lg font-medium text-gray-900">Select New Image or Collection</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    {errorMessage || 'Choose a different image or collection to replace the current one.'}
                                </p>
                                {errorMessage && (
                                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                        <p className="text-sm text-yellow-800">
                                            {errorMessage}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <MediaBrowser
                                onFileSelect={handleMediaSelect}
                                selectionMode="single"
                                fileTypes={[]}
                                namespace={namespace}
                                showUploader={false}
                            />
                        </div>
                    ) : (
                        <>
                            {/* Preview */}
                            {mediaData && (
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-medium text-gray-900">Current Media</h3>
                                        <button
                                            onClick={handleChangeMedia}
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Change Image
                                        </button>
                                    </div>
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
                                                    {mediaData.files ? `Collection (${mediaData.files?.length || 0} files)` : 'Single Image'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Configuration Form */}
                            <div className="space-y-6">
                                {/* Image Style (Gallery/Carousel) */}
                                {availableImageStyles.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-900 mb-2">
                                            Image Style
                                        </label>
                                        <select
                                            value={config.galleryStyle || ''}
                                            onChange={(e) => handleConfigChange('galleryStyle', e.target.value || null)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="">Default</option>
                                            {availableImageStyles.map(style => (
                                                <option key={style.value} value={style.value}>
                                                    {style.label}
                                                    {style.styleType && ` (${style.styleType})`}
                                                    {style.description ? ` - ${style.description}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="mt-1 text-xs text-gray-500">
                                            Choose a custom image style from the theme (includes gallery and carousel styles)
                                        </p>
                                    </div>
                                )}

                                {/* Alt Text */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-2">
                                        Alt Text
                                    </label>
                                    <input
                                        type="text"
                                        value={config.altText}
                                        onChange={(e) => handleConfigChange('altText', e.target.value)}
                                        placeholder="Describe image for screen readers"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Describe the image for visually impaired users (required for accessibility)
                                    </p>
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
                                    <p className="mt-1 text-xs text-gray-500">
                                        Optional caption displayed below the image
                                    </p>
                                </div>

                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    {isChangingMedia ? (
                        <>
                            <div></div>
                            {mediaData || !errorMessage ? (
                                <button
                                    onClick={handleCancelChange}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                            ) : (
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                    Close
                                </button>
                            )}
                        </>
                    ) : (
                        <>
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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MediaEditModal;

