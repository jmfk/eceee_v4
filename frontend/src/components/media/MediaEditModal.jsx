/**
 * MediaEditModal Component
 * Modal for editing existing media inserts in WYSIWYG editor
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Trash2, Image as ImageIcon, RefreshCw, Settings, FolderOpen, Loader2 } from 'lucide-react';
import MediaBrowser from './MediaBrowser';
import { useTheme } from '../../hooks/useTheme';
import OverrideSettingsModal from './OverrideSettingsModal';
import CollectionThumbnailGrid from './CollectionThumbnailGrid';
import { mediaCollectionsApi } from '../../api';

const MediaEditModal = ({ isOpen, onClose, onSave, onDelete, initialConfig, mediaData: initialMediaData, mediaLoadError, namespace, pageId }) => {
    const { currentTheme } = useTheme({ pageId, enabled: true }); // Enable to get theme data including imageStyles
    const [config, setConfig] = useState({
        width: 'full',
        align: 'center',
        caption: '',
        altText: '',
        galleryStyle: null,
        // Override settings
        showCaptions: undefined,
        lightboxGroup: undefined,
        randomize: undefined,
        autoPlay: undefined,
        autoPlayInterval: undefined
    });
    const [mediaData, setMediaData] = useState(initialMediaData);
    const [isChangingMedia, setIsChangingMedia] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [showOverrideSettings, setShowOverrideSettings] = useState(false);
    const [mediaSelectionType, setMediaSelectionType] = useState('image');
    const [collections, setCollections] = useState([]);
    const [loadingCollections, setLoadingCollections] = useState(false);

    // Get available image styles from theme (unified gallery and carousel styles)
    // Filter to only show inline-compatible styles (usageType 'inline' or 'both')
    const availableImageStyles = useMemo(() => {
        if (!currentTheme || !currentTheme.imageStyles) {
            return [];
        }

        const imageStyles = currentTheme.imageStyles;
        const entries = Object.entries(imageStyles);
        
        return entries
            .filter(([key, style]) => {
                const usage = style.usageType || 'both'; // Default to 'both' for backward compatibility
                return usage === 'both' || usage === 'inline';
            })
            .map(([key, style]) => ({
                value: key,
                label: style.name || key,
                description: style.description,
                styleType: style.styleType || 'gallery',
                usageType: style.usageType || 'both'
            }));
    }, [currentTheme]);

    // Get selected style info
    const selectedStyle = useMemo(() => {
        if (!config.galleryStyle || !currentTheme?.imageStyles) {
            return null;
        }
        return currentTheme.imageStyles[config.galleryStyle];
    }, [config.galleryStyle, currentTheme]);

    const isCarouselStyle = selectedStyle?.styleType === 'carousel';

    // Initialize config when modal opens
    useEffect(() => {
        if (isOpen && initialConfig) {
            setConfig({
                width: initialConfig.width || 'full',
                align: initialConfig.align || 'center',
                caption: initialConfig.caption || '',
                altText: initialConfig.altText || initialMediaData?.title || '',
                galleryStyle: initialConfig.galleryStyle || null,
                // Override settings (preserve undefined if not set)
                showCaptions: initialConfig.showCaptions,
                lightboxGroup: initialConfig.lightboxGroup,
                randomize: initialConfig.randomize,
                autoPlay: initialConfig.autoPlay,
                autoPlayInterval: initialConfig.autoPlayInterval
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

    // Load collections when modal opens and collection tab is selected
    useEffect(() => {
        if (isOpen && isChangingMedia && mediaSelectionType === 'collection' && namespace) {
            loadCollections();
        }
    }, [isOpen, isChangingMedia, mediaSelectionType, namespace]);

    const loadCollections = async () => {
        setLoadingCollections(true);
        try {
            const result = await mediaCollectionsApi.list({ 
                namespace, 
                page_size: 100,
                ordering: '-created_at'
            })();
            setCollections(result.results || result || []);
        } catch (error) {
            console.error('Failed to load collections:', error);
            setCollections([]);
        } finally {
            setLoadingCollections(false);
        }
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
                        /* Media Selection with Image/Collection Toggle */
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

                            {/* Tab Toggle */}
                            <div className="flex gap-2 mb-4 border-b border-gray-200">
                                <button
                                    onClick={() => setMediaSelectionType('image')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                        mediaSelectionType === 'image'
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Select Image
                                </button>
                                <button
                                    onClick={() => setMediaSelectionType('collection')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                        mediaSelectionType === 'collection'
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Select Collection
                                </button>
                            </div>

                            {/* Content based on selection type */}
                            {mediaSelectionType === 'collection' ? (
                                loadingCollections ? (
                                    <div className="flex items-center justify-center h-64">
                                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                    </div>
                                ) : collections.length === 0 ? (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="text-center">
                                            <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                            <p className="text-gray-600">No collections found</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {collections.map(collection => (
                                            <div
                                                key={collection.id}
                                                onClick={() => handleMediaSelect(collection)}
                                                className="cursor-pointer border border-gray-200 rounded-lg overflow-hidden hover:border-blue-500 hover:shadow-md transition-all"
                                            >
                                                <CollectionThumbnailGrid 
                                                    collection={collection} 
                                                    className="aspect-square"
                                                />
                                                <div className="p-3">
                                                    <h4 className="font-medium text-sm text-gray-900 truncate">{collection.title}</h4>
                                                    <p className="text-xs text-gray-600">{collection.fileCount || collection.file_count || 0} images</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : (
                                <MediaBrowser
                                    onFileSelect={handleMediaSelect}
                                    selectionMode="single"
                                    fileTypes={['image']}
                                    namespace={namespace}
                                    showUploader={false}
                                    hideShowDeleted={true}
                                    hideTypeFilter={true}
                                />
                            )}
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
                                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                                        {mediaData.files ? (
                                            <div>
                                                <CollectionThumbnailGrid 
                                                    collection={mediaData} 
                                                    className="h-32"
                                                />
                                                <div className="p-4">
                                                    <p className="font-medium text-gray-900">{mediaData.title || mediaData.original_filename}</p>
                                                    <p className="text-sm text-gray-600">Collection ({mediaData.files?.length || 0} files)</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4 p-4">
                                                {mediaData.imgproxyBaseUrl || mediaData.fileUrl ? (
                                                    <img src={mediaData.imgproxyBaseUrl || mediaData.fileUrl} alt={mediaData.title} className="w-24 h-24 object-cover rounded" />
                                                ) : (
                                                    <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center">
                                                        <ImageIcon className="w-8 h-8 text-gray-400" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-gray-900">{mediaData.title || mediaData.original_filename}</p>
                                                    <p className="text-sm text-gray-600">Single Image</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Configuration Form */}
                            <div className="space-y-6">
                                {/* Image Style (Gallery/Carousel) */}
                                {availableImageStyles.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-medium text-gray-900">
                                                Image Style
                                            </label>
                                            {config.galleryStyle && selectedStyle && (
                                                <button
                                                    onClick={() => setShowOverrideSettings(true)}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors"
                                                    title="Configure override settings"
                                                >
                                                    <Settings className="w-3.5 h-3.5" />
                                                    Override Settings
                                                </button>
                                            )}
                                        </div>
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

            {/* Override Settings Modal */}
            <OverrideSettingsModal
                isOpen={showOverrideSettings}
                onClose={() => setShowOverrideSettings(false)}
                config={config}
                onConfigChange={handleConfigChange}
                selectedStyle={selectedStyle}
            />
        </div>
    );
};

export default MediaEditModal;

