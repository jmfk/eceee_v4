/**
 * MediaInsertModal Component
 * Modal for inserting media (images or collections) into WYSIWYG editor
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Image as ImageIcon, ChevronDown } from 'lucide-react';
import MediaBrowser from './MediaBrowser';
import { useTheme } from '../../hooks/useTheme';

const MediaInsertModal = ({ isOpen, onClose, onInsert, namespace, pageId }) => {
    const { currentTheme } = useTheme({ pageId, enabled: true }); // Enable to get theme data including imageStyles
    const [step, setStep] = useState('select'); // 'select' or 'configure'
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [mediaType, setMediaType] = useState('image'); // 'image' or 'collection'
    const [config, setConfig] = useState({
        width: 'full',
        align: 'center',
        caption: '',
        altText: '',
        galleryStyle: null,
        enableLightbox: false,
        lightboxStyle: 'default',
        lightboxGroup: ''
    });

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

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('select');
            setSelectedMedia(null);
            setMediaType('image');
            setConfig({
                width: 'full',
                align: 'center',
                caption: '',
                altText: '',
                galleryStyle: null,
                enableLightbox: false,
                lightboxStyle: 'default',
                lightboxGroup: ''
            });
        }
    }, [isOpen]);

    // When media is selected from browser
    const handleMediaSelect = (media) => {
        setSelectedMedia(media);

        // Determine media type based on selection
        // If it has 'files' property, it's a collection
        const type = media.files ? 'collection' : 'image';
        setMediaType(type);

        // Set default caption and altText to media title
        setConfig(prev => ({
            ...prev,
            caption: media.title || '',
            altText: media.title || ''
        }));

        // Move to configure step
        setStep('configure');
    };

    const handleConfigChange = (field, value) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleInsert = () => {
        if (!selectedMedia) return;

        onInsert({
            mediaData: selectedMedia,
            mediaType: mediaType,
            mediaId: selectedMedia.id,
            ...config
        });

        onClose();
    };

    const handleBack = () => {
        setStep('select');
        setSelectedMedia(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <ImageIcon className="w-6 h-6 text-blue-600" />
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {step === 'select' ? 'Select Media' : 'Configure Media Insert'}
                            </h2>
                            {step === 'configure' && selectedMedia && (
                                <p className="text-sm text-gray-600 mt-1">
                                    Selected: {selectedMedia.title || selectedMedia.original_filename}
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
                <div className="flex-1 overflow-auto">
                    {step === 'select' ? (
                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">
                                Select an image or collection from the media library to insert into your content.
                            </p>
                            <MediaBrowser
                                onFileSelect={handleMediaSelect}
                                selectionMode="single"
                                fileTypes={[]}
                                namespace={namespace}
                                showUploader={true}
                            />
                        </div>
                    ) : (
                        <div className="p-6">
                            {/* Preview */}
                            <div className="mb-6">
                                <h3 className="text-sm font-medium text-gray-900 mb-3">Preview</h3>
                                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    {selectedMedia && (
                                        <div className="flex items-center gap-4">
                                            {selectedMedia.imgproxyBaseUrl || selectedMedia.fileUrl ? (
                                                <img
                                                    src={selectedMedia.imgproxyBaseUrl || selectedMedia.fileUrl}
                                                    alt={selectedMedia.title}
                                                    className="w-24 h-24 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center">
                                                    <ImageIcon className="w-8 h-8 text-gray-400" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {selectedMedia.title || selectedMedia.original_filename}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    {mediaType === 'collection'
                                                        ? `Collection (${selectedMedia.files?.length || 0} files)`
                                                        : 'Single Image'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

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

                                {/* Lightbox */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                                            <input
                                                type="checkbox"
                                                checked={config.enableLightbox}
                                                onChange={(e) => handleConfigChange('enableLightbox', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                            />
                                            Open in lightbox
                                        </label>
                                        <p className="mt-1 text-xs text-gray-500">Wraps image with a lightbox trigger.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-900 mb-2">Lightbox Style</label>
                                        <input
                                            type="text"
                                            value={config.lightboxStyle}
                                            onChange={(e) => handleConfigChange('lightboxStyle', e.target.value)}
                                            placeholder="default"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-900 mb-2">Lightbox Group</label>
                                        <input
                                            type="text"
                                            value={config.lightboxGroup}
                                            onChange={(e) => handleConfigChange('lightboxGroup', e.target.value)}
                                            placeholder="optional group key"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">Images sharing a group key can be navigated in the lightbox.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <div>
                        {step === 'configure' && (
                            <button
                                onClick={handleBack}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                ← Back to Selection
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        {step === 'configure' && (
                            <button
                                onClick={handleInsert}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                            >
                                Insert Media
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MediaInsertModal;

