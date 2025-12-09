/**
 * MediaInsertModal Component
 * Unified modal for ALL media operations - supports WYSIWYG insert/edit and form field modes
 * 
 * Modes (auto-detected):
 * - Insert mode: onInsert prop exists → Two-step process (select → configure) for new content
 * - Edit mode: onSave prop exists → Edit existing media with Save/Delete buttons
 * - Field mode: onSelect prop exists → Single-step selection for form fields
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, Settings, FolderOpen, Loader2, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import MediaBrowser from './MediaBrowser';
import { useTheme } from '../../hooks/useTheme';
import OverrideSettingsModal from './OverrideSettingsModal';
import CollectionThumbnailGrid from './CollectionThumbnailGrid';
import SimplifiedApprovalForm from './SimplifiedApprovalForm';
import { mediaCollectionsApi, mediaApi } from '../../api';

const MediaInsertModal = ({
    // Common props
    isOpen,
    onClose,
    namespace,
    pageId,

    // Insert mode props
    onInsert,

    // Edit mode props
    onSave,
    onDelete,
    initialConfig,
    initialMediaData,
    mediaLoadError,

    // Field mode props  
    mode = 'editor', // 'editor' | 'field' (for backward compat, but auto-detected now)
    onSelect, // Callback for field mode (simpler than onInsert)
    multiple = false, // Allow multiple selection in field mode
    allowCollections = true, // Whether to show collections tab
    selectedFiles = [], // Currently selected files (for field mode)
}) => {
    // Auto-detect mode based on callbacks
    const isEditMode = !!onSave;
    const isInsertMode = !!onInsert;
    const isFieldMode = !!onSelect;

    // For theme loading, use editor mode if not field mode
    const { currentTheme } = useTheme({ pageId, enabled: !isFieldMode });
    const [step, setStep] = useState('select'); // 'select' or 'configure'
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [selectedMediaItems, setSelectedMediaItems] = useState(selectedFiles || []); // For multiple selection in field mode
    const [mediaType, setMediaType] = useState('image'); // 'image' or 'collection'
    const [showOverrideSettings, setShowOverrideSettings] = useState(false);
    const [mediaSelectionType, setMediaSelectionType] = useState('image');
    const [collections, setCollections] = useState([]);
    const [loadingCollections, setLoadingCollections] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);
    const [loadingPendingFiles, setLoadingPendingFiles] = useState(false);

    // Edit mode specific state
    const [isChangingMedia, setIsChangingMedia] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    // Pending approval state
    const [hasPendingApprovals, setHasPendingApprovals] = useState(false);
    const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

    // Track if we've initialized to prevent infinite loops
    const initializedRef = useRef(false);
    const prevOpenRef = useRef(isOpen);

    const [config, setConfig] = useState({
        width: 'full',
        align: 'center',
        caption: '',
        altText: '',
        galleryStyle: null,
        enableLightbox: false,
        lightboxStyle: 'default',
        lightboxGroup: '',
        // Override settings
        showCaptions: undefined,
        randomize: undefined,
        autoPlay: undefined,
        autoPlayInterval: undefined
    });

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

    // Initialize/reset state when modal opens
    useEffect(() => {
        // Only run when modal transitions from closed to open
        if (isOpen && !prevOpenRef.current) {
            initializedRef.current = false;
        }

        if (isOpen && !initializedRef.current) {
            initializedRef.current = true;

            if (isEditMode && initialConfig) {
                // Edit mode: initialize from existing config
                setConfig({
                    width: initialConfig.width || 'full',
                    align: initialConfig.align || 'center',
                    caption: initialConfig.caption || '',
                    altText: initialConfig.altText || initialMediaData?.title || '',
                    galleryStyle: initialConfig.galleryStyle || null,
                    enableLightbox: initialConfig.enableLightbox !== undefined ? initialConfig.enableLightbox : false,
                    lightboxStyle: initialConfig.lightboxStyle || 'default',
                    lightboxGroup: initialConfig.lightboxGroup || '',
                    // Override settings (preserve undefined if not set)
                    showCaptions: initialConfig.showCaptions,
                    randomize: initialConfig.randomize,
                    autoPlay: initialConfig.autoPlay,
                    autoPlayInterval: initialConfig.autoPlayInterval
                });
                setSelectedMedia(initialMediaData);
                setMediaType(initialConfig.mediaType || (initialMediaData?.files ? 'collection' : 'image'));

                // If there was an error loading media or no media data, show media selector
                if (mediaLoadError || !initialMediaData) {
                    setStep('select');
                    setIsChangingMedia(true);
                    setErrorMessage(mediaLoadError ? 'The original image could not be found. Please select a new image.' : null);
                } else {
                    // Go directly to configure step in edit mode
                    setStep('configure');
                    setIsChangingMedia(false);
                    setErrorMessage(null);
                }
            } else {
                // Insert or field mode: reset to defaults
                setStep('select');
                setSelectedMedia(null);
                setSelectedMediaItems(selectedFiles || []);
                setMediaType('image');
                setMediaSelectionType('image');
                setIsChangingMedia(false);
                setErrorMessage(null);

                // Only reset config in insert mode
                if (isInsertMode) {
                    setConfig({
                        width: 'full',
                        align: 'center',
                        caption: '',
                        altText: '',
                        galleryStyle: null,
                        enableLightbox: false,
                        lightboxStyle: 'default',
                        lightboxGroup: '',
                        // Override settings
                        showCaptions: undefined,
                        randomize: undefined,
                        autoPlay: undefined,
                        autoPlayInterval: undefined
                    });
                }
            }
        }

        prevOpenRef.current = isOpen;
    }, [isOpen, isEditMode, isInsertMode]);

    // Load collections when step is select and collection tab is selected
    useEffect(() => {
        if (isOpen && step === 'select' && mediaSelectionType === 'collection' && namespace) {
            loadCollections();
        }
    }, [isOpen, step, mediaSelectionType, namespace]);

    // Load pending files when step is select and pending tab is selected
    useEffect(() => {
        if (isOpen && step === 'select' && mediaSelectionType === 'pending' && namespace) {
            loadPendingFiles();
        }
    }, [isOpen, step, mediaSelectionType, namespace]);

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

    const loadPendingFiles = async () => {
        setLoadingPendingFiles(true);
        try {
            const result = await mediaApi.pendingFiles.list({
                namespace,
                page_size: 100,
                ordering: '-created_at'
            });
            setPendingFiles(result.results || result || []);
        } catch (error) {
            console.error('Failed to load pending files:', error);
            setPendingFiles([]);
        } finally {
            setLoadingPendingFiles(false);
        }
    };

    // When media is selected from browser
    const handleMediaSelect = (media) => {
        if (isFieldMode) {
            // Field mode: handle selection differently based on multiple setting
            if (multiple) {
                // Toggle selection for multiple mode
                const isSelected = selectedMediaItems.some(item => item.id === media.id);
                if (isSelected) {
                    setSelectedMediaItems(prev => prev.filter(item => item.id !== media.id));
                } else {
                    setSelectedMediaItems(prev => [...prev, media]);
                }
            } else {
                // Single selection: select and call onSelect immediately
                if (onSelect) {
                    onSelect(media);
                }
                onClose();
            }
        } else {
            // Insert or Edit mode: proceed to configuration step
            setSelectedMedia(media);

            // Determine media type based on selection
            const type = media.files ? 'collection' : 'image';
            setMediaType(type);

            // Set default caption and altText to media title (only in insert mode or if empty)
            if (isInsertMode || !config.caption) {
                setConfig(prev => ({
                    ...prev,
                    caption: media.title || '',
                    altText: media.title || ''
                }));
            }

            // Move to configure step and clear changing state
            setStep('configure');
            setIsChangingMedia(false);
            setErrorMessage(null);
        }
    };

    const handleConfigChange = (field, value) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleInsert = () => {
        if (isFieldMode) {
            // Field mode with multiple selection
            if (multiple && onSelect) {
                onSelect(selectedMediaItems);
            }
        } else {
            // Insert mode
            if (!selectedMedia) return;

            if (onInsert) {
                onInsert({
                    mediaData: selectedMedia,
                    mediaType: mediaType,
                    mediaId: selectedMedia.id,
                    ...config
                });
            }
        }

        onClose();
    };

    const handleSave = () => {
        if (!selectedMedia) return;

        if (onSave) {
            onSave({
                mediaData: selectedMedia,
                mediaType: mediaType,
                mediaId: selectedMedia.id,
                ...config
            });
        }

        onClose();
    };

    const handleDelete = () => {
        if (onDelete) {
            onDelete();
        }
        onClose();
    };

    const handlePendingApprovalChange = (hasPending, files) => {
        // Update pending files state
        if (files && files.length > 0) {
            setPendingFiles(files);
            // Switch to pending tab when files need approval
            setMediaSelectionType('pending');
        }
        // Don't set hasPendingApprovals - we handle pending files via the tab now
        // The inline warning/approval form in MediaBrowser is disabled in favor of the pending tab
    };

    const handlePendingFilesCreated = async (files) => {
        // When files are uploaded, immediately switch to pending tab and load them
        if (files && files.length > 0) {
            setPendingFiles(files);
            setMediaSelectionType('pending');
            // Also reload the full pending files list to ensure we have everything
            await loadPendingFiles();
        }
    };

    const handleApprovalComplete = async (approvedFiles) => {
        // Reload pending files list
        await loadPendingFiles();

        // Switch back to image tab
        setMediaSelectionType('image');

        // Clear pending approvals state
        setHasPendingApprovals(false);
        setPendingApprovalCount(0);
    };

    const handleApprovalCancel = () => {
        // Just clear the pending files in the tab
        // Files remain in pending state on the backend
        setPendingFiles([]);
        setMediaSelectionType('image');
    };

    const handleBack = () => {
        setStep('select');
        if (!isEditMode) {
            setSelectedMedia(null);
        }
        setIsChangingMedia(false);
        setErrorMessage(null);
    };

    const handleChangeMedia = () => {
        setStep('select');
        setIsChangingMedia(true);
    };

    if (!isOpen) return null;

    // Determine modal size based on mode
    const modalSizeClass = isFieldMode
        ? 'w-[90vw] h-[90vh]'
        : 'w-full max-w-6xl max-h-[90vh]';

    const modalContent = (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/50">
            <div className={`bg-white rounded-lg shadow-xl flex flex-col ${modalSizeClass}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <ImageIcon className="w-6 h-6 text-blue-600" />
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {step === 'select'
                                    ? (isChangingMedia ? 'Change Media' : 'Select Media')
                                    : (isEditMode ? 'Edit Media' : 'Configure Media Insert')
                                }
                            </h2>
                            {step === 'configure' && selectedMedia && (
                                <p className="text-sm text-gray-600 mt-1">
                                    Selected: {selectedMedia.title || selectedMedia.original_filename}
                                </p>
                            )}
                            {errorMessage && (
                                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-4 h-4" />
                                    {errorMessage}
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
                            {isInsertMode && !isChangingMedia && (
                                <p className="text-sm text-gray-600 mb-4">
                                    Select an image or collection from the media library to insert into your content.
                                </p>
                            )}
                            {isEditMode && isChangingMedia && (
                                <p className="text-sm text-gray-600 mb-4">
                                    Select a new image or collection to replace the current media.
                                </p>
                            )}
                            {isFieldMode && multiple && selectedMediaItems.length > 0 && (
                                <p className="text-sm text-blue-600 mb-4 font-medium">
                                    {selectedMediaItems.length} item{selectedMediaItems.length !== 1 ? 's' : ''} selected
                                </p>
                            )}

                            {/* Tab Toggle - always show Browse and Pending, add Collections if allowed */}
                            <div className="flex gap-2 mb-4 border-b border-gray-200">
                                <button
                                    onClick={() => setMediaSelectionType('image')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mediaSelectionType === 'image'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    {multiple ? 'Select Images' : 'Select Image'}
                                </button>
                                {allowCollections && (
                                    <button
                                        onClick={() => setMediaSelectionType('collection')}
                                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mediaSelectionType === 'collection'
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-600 hover:text-gray-900'
                                            }`}
                                    >
                                        Select Collection
                                    </button>
                                )}
                                <button
                                    onClick={() => setMediaSelectionType('pending')}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mediaSelectionType === 'pending'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Pending Files
                                    {pendingFiles.length > 0 && (
                                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                                            {pendingFiles.length}
                                        </span>
                                    )}
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
                            ) : mediaSelectionType === 'pending' ? (
                                loadingPendingFiles ? (
                                    <div className="flex items-center justify-center h-64">
                                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                    </div>
                                ) : pendingFiles.length === 0 ? (
                                    <div className="flex items-center justify-center h-64">
                                        <div className="text-center">
                                            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                            <p className="text-gray-600">No pending files</p>
                                            <p className="text-sm text-gray-500 mt-2">Upload files from the Image tab to approve them here</p>
                                        </div>
                                    </div>
                                ) : (
                                    <SimplifiedApprovalForm
                                        pendingFiles={pendingFiles}
                                        namespace={namespace}
                                        onComplete={handleApprovalComplete}
                                        onCancel={handleApprovalCancel}
                                    />
                                )
                            ) : (
                                <MediaBrowser
                                    onFileSelect={handleMediaSelect}
                                    selectionMode={isFieldMode && multiple ? 'multiple' : 'single'}
                                    fileTypes={['image']}
                                    namespace={namespace}
                                    showUploader={true}
                                    hideShowDeleted={true}
                                    hideTypeFilter={true}
                                    hideInlineApprovalForm={true}
                                    onPendingApprovalChange={handlePendingApprovalChange}
                                    onPendingFilesCreated={handlePendingFilesCreated}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="p-6">
                            {/* Preview with Change Media button for edit mode */}
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-medium text-gray-900">Preview</h3>
                                    {isEditMode && (
                                        <button
                                            onClick={handleChangeMedia}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                                            title="Select different media"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Change Media
                                        </button>
                                    )}
                                </div>
                                <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                                    {selectedMedia && (
                                        mediaType === 'collection' ? (
                                            <div>
                                                <CollectionThumbnailGrid
                                                    collection={selectedMedia}
                                                    className="h-32"
                                                />
                                                <div className="p-4">
                                                    <p className="font-medium text-gray-900">{selectedMedia.title || selectedMedia.original_filename}</p>
                                                    <p className="text-sm text-gray-600">Collection ({selectedMedia.files?.length || 0} files)</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-4 p-4">
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
                                                    <p className="font-medium text-gray-900">{selectedMedia.title || selectedMedia.original_filename}</p>
                                                    <p className="text-sm text-gray-600">Single Image</p>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

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
                        {step === 'configure' && (isInsertMode || isEditMode) && (
                            <button
                                onClick={handleBack}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                            >
                                ← Back to Selection
                            </button>
                        )}
                        {step === 'configure' && isEditMode && (
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors ml-2"
                                title="Delete this media insert"
                            >
                                <Trash2 className="w-4 h-4 inline mr-1" />
                                Delete
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
                        {isFieldMode && multiple ? (
                            <button
                                onClick={handleInsert}
                                disabled={selectedMediaItems.length === 0}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
                            >
                                Select {selectedMediaItems.length > 0 ? `(${selectedMediaItems.length})` : ''}
                            </button>
                        ) : step === 'configure' && isInsertMode ? (
                            <button
                                onClick={handleInsert}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                            >
                                Insert Media
                            </button>
                        ) : step === 'configure' && isEditMode ? (
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                            >
                                Save Changes
                            </button>
                        ) : null}
                    </div>
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

    // Use portal for field mode to escape parent containers
    return isFieldMode ? createPortal(modalContent, document.body) : modalContent;
};

export default MediaInsertModal;

