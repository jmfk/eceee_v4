/**
 * MediaSelectModal Component
 * Simple modal for selecting media in widget fields (quick-edit icons)
 * 
 * Features:
 * - Single-step selection (no configuration)
 * - Shows currently selected file with preview
 * - Full media browser features (browse, upload, pending approval)
 * - Supports single/multiple selection
 * - Optional collection selection
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Image as ImageIcon, FolderOpen, Loader2, AlertCircle, Check, Trash2 } from 'lucide-react';
import MediaBrowser from './MediaBrowser';
import CollectionThumbnailGrid from './CollectionThumbnailGrid';
import SimplifiedApprovalForm from './SimplifiedApprovalForm';
import OptimizedImage from './OptimizedImage';
import { mediaCollectionsApi } from '../../api';

const MediaSelectModal = ({
    // Core props
    isOpen,
    onClose,
    onSelect, // Callback when media is selected: (selectedItems) => void
    namespace,
    pageId,

    // Selection options
    mediaTypes = ['image'], // Array of allowed types: 'image', 'video', etc.
    allowCollections = true, // Whether to show collections tab
    multiple = false, // Allow multiple selection

    // Current selection (for showing "currently selected")
    currentSelection = null, // Current image/collection object

    // UI customization
    customTitle = null, // e.g., "Select Hero Background Image"
}) => {
    const [mediaSelectionType, setMediaSelectionType] = useState('image');
    const [collections, setCollections] = useState([]);
    const [loadingCollections, setLoadingCollections] = useState(false);
    const [pendingFiles, setPendingFiles] = useState([]);

    // Ensure collections is always an array - memoized to prevent recalculation
    const safeCollections = useMemo(() => {
        if (Array.isArray(collections)) {
            return collections;
        }
        if (collections && typeof collections === 'object') {
            // Handle case where API returns {results: [...]} directly
            return collections.results || [];
        }
        return [];
    }, [collections]);
    const [loadingPendingFiles, setLoadingPendingFiles] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);

    // Pending approval state
    const [hasPendingApprovals, setHasPendingApprovals] = useState(false);
    const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

    // Track if we've initialized to prevent infinite loops
    const initializedRef = useRef(false);
    const prevOpenRef = useRef(isOpen);

    // Initialize/reset state when modal opens
    useEffect(() => {
        // Only run when modal transitions from closed to open
        if (isOpen && !prevOpenRef.current) {
            initializedRef.current = false;
        }

        if (isOpen && !initializedRef.current) {
            initializedRef.current = true;
            setMediaSelectionType('image');
            setSelectedItems([]);
        }

        prevOpenRef.current = isOpen;
    }, [isOpen]);

    // Load collections
    useEffect(() => {
        if (!isOpen || !allowCollections) {
            return;
        }

        const loadCollections = async () => {
            setLoadingCollections(true);
            try {
                const response = await mediaCollectionsApi.list({ namespace })();
                const collectionsData = response.results || response || [];
                setCollections(Array.isArray(collectionsData) ? collectionsData : []);
            } catch (error) {
                console.error('Error loading collections:', error);
                setCollections([]);
            } finally {
                setLoadingCollections(false);
            }
        };

        loadCollections();
    }, [isOpen, namespace, allowCollections]);

    // Handle media selection from browser
    const handleMediaSelect = (item) => {
        if (multiple) {
            setSelectedItems(prev => {
                const exists = prev.find(i => i.id === item.id);
                if (exists) {
                    return prev.filter(i => i.id !== item.id);
                }
                return [...prev, item];
            });
        } else {
            setSelectedItems([item]);
        }
    };

    // Handle collection selection
    const handleCollectionSelect = (collection) => {
        setSelectedItems([collection]);
    };

    // Handle pending approval changes
    const handlePendingApprovalChange = (hasPending, files) => {
        setHasPendingApprovals(hasPending);
        setPendingApprovalCount(files?.length || 0);
    };

    // Handle pending files created
    const handlePendingFilesCreated = (files) => {
        setPendingFiles(files);
    };

    // Handle approval complete
    const handleApprovalComplete = () => {
        setMediaSelectionType('image');
        setPendingFiles([]);
    };

    // Handle approval cancel
    const handleApprovalCancel = () => {
        setMediaSelectionType('image');
    };

    // Handle select button click
    const handleSelectClick = () => {
        if (selectedItems.length > 0) {
            onSelect(selectedItems);
            handleClose();
        }
    };

    // Handle remove button click
    const handleRemoveClick = () => {
        onSelect(null);
        handleClose();
    };

    // Handle close
    const handleClose = () => {
        setSelectedItems([]);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10020]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div>
                        <div className="text-xl font-semibold text-gray-900" role="heading" aria-level="2">
                            {customTitle || 'Select Media'}
                        </div>
                        {selectedItems.length > 0 && (
                            <div className="text-sm text-gray-600 mt-1">
                                {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    <div className="p-6">
                        {/* Currently Selected Section */}
                        {currentSelection && (
                            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg relative">
                                <div className="flex items-start gap-4">
                                    <div className="flex-shrink-0">
                                        {currentSelection.files ? (
                                            // Collection
                                            <div className="w-24 h-24">
                                                <CollectionThumbnailGrid
                                                    collection={currentSelection}
                                                    className="w-full h-full"
                                                />
                                            </div>
                                        ) : (
                                            // Single image
                                            <OptimizedImage
                                                src={currentSelection.imgproxyBaseUrl || currentSelection.fileUrl || currentSelection.url}
                                                alt={currentSelection.title || currentSelection.altText || ''}
                                                width={96}
                                                height={96}
                                                resizeType="fill"
                                                className="rounded object-cover"
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Check className="w-4 h-4 text-blue-600" />
                                            <div className="font-medium text-gray-900" role="heading" aria-level="3">Currently Selected</div>
                                        </div>
                                        <div className="text-sm text-gray-700 truncate">
                                            {currentSelection.title || currentSelection.original_filename || 'Untitled'}
                                        </div>
                                        {currentSelection.files && (
                                            <div className="text-xs text-gray-600 mt-1">
                                                Collection ({currentSelection.files.length} images)
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleRemoveClick}
                                        className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                                        title="Remove image"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Tab Toggle */}
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
                            ) : safeCollections.length === 0 ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="text-center">
                                        <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                        <div className="text-gray-600">No collections found</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {safeCollections.map(collection => {
                                        const isSelected = selectedItems.some(item => item.id === collection.id);
                                        return (
                                            <div
                                                key={collection.id}
                                                onClick={() => handleCollectionSelect(collection)}
                                                className={`cursor-pointer border rounded-lg overflow-hidden transition-all ${isSelected
                                                        ? 'border-blue-500 ring-2 ring-blue-500 shadow-lg'
                                                        : 'border-gray-200 hover:border-blue-500 hover:shadow-md'
                                                    }`}
                                            >
                                                <CollectionThumbnailGrid
                                                    collection={collection}
                                                    className="aspect-square"
                                                />
                                                <div className="p-3">
                                                    <div className="font-medium text-sm text-gray-900 truncate" role="heading" aria-level="4">{collection.title}</div>
                                                    <div className="text-xs text-gray-600">{collection.fileCount || collection.file_count || 0} images</div>
                                                </div>
                                            </div>
                                        );
                                    })}
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
                                        <div className="text-gray-600">No pending files</div>
                                        <div className="text-sm text-gray-500 mt-2">Upload files from the Image tab to approve them here</div>
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
                                selectionMode={multiple ? 'multiple' : 'single'}
                                fileTypes={mediaTypes}
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
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSelectClick}
                        disabled={selectedItems.length === 0}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${selectedItems.length === 0
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        Select {selectedItems.length > 0 && `(${selectedItems.length})`}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default MediaSelectModal;

