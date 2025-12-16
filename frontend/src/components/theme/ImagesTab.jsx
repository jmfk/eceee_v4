import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Image as ImageIcon, Loader2, AlertCircle, RefreshCw, X, Check, Grid3x3, List, AlignJustify } from 'lucide-react';
import { themesApi } from '../../api/themes';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import { useNotificationContext } from '../NotificationManager';
import BulkImageUpload from './BulkImageUpload';

// Empty state drop zone component
const EmptyStateDropZone = ({ onUpload, onFilesDropped }) => {
    const [dragActive, setDragActive] = useState(false);

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

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            onFilesDropped(files);
        }
    };

    return (
        <div
            className={`text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${dragActive
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-300 hover:border-gray-400'
                }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={onUpload}
        >
            <div className="flex items-center justify-center gap-6">
                <ImageIcon className={`h-10 w-10 flex-shrink-0 transition-colors ${dragActive ? 'text-purple-500' : 'text-gray-400'
                    }`} />
                <div className="text-left">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                        {dragActive ? 'Drop images here to upload' : 'No images in library'}
                    </div>
                    <p className="text-xs text-gray-600">
                        Drag and drop images here or click to select • JPG, PNG, GIF, WebP, SVG (max 10MB)
                    </p>
                </div>
                {!dragActive && (
                    <button className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition">
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                    </button>
                )}
            </div>
        </div>
    );
};

const ImagesTab = ({ themeId, theme, onThemeUpdate }) => {
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedImages, setSelectedImages] = useState([]);
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(null);
    const [editingFilename, setEditingFilename] = useState(null);
    const [newFilename, setNewFilename] = useState('');
    const [viewMode, setViewMode] = useState('list'); // 'list', 'grid', or 'compact'
    const replaceInputRefs = useState({})[0];
    const { addNotification } = useGlobalNotifications();
    const { showConfirm } = useNotificationContext();

    useEffect(() => {
        if (themeId) {
            loadImages();
        }
    }, [themeId]);

    const loadImages = async () => {
        setLoading(true);
        try {
            const result = await themesApi.listLibraryImages(themeId);
            // Add a page load timestamp to force cache busting on browser refresh
            const pageLoadTime = Date.now();
            setImages((result.images || []).map(img => ({
                ...img,
                pageLoadTime
            })));
        } catch (error) {
            addNotification({
                type: 'error',
                message: error.message || 'Failed to load library images'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleUploadComplete = (result) => {
        setShowBulkUpload(false);
        loadImages(); // Reload images

        if (result.success > 0) {
            addNotification({
                type: 'success',
                message: `${result.success} ${result.success === 1 ? 'image' : 'images'} uploaded successfully`
            });
        }
    };

    const handleDirectUpload = async (files) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        setUploadProgress({ total: files.length, completed: 0, errors: [] });

        try {
            const result = await themesApi.uploadLibraryImages(themeId, files);

            setUploadProgress({
                total: files.length,
                completed: result.success,
                errors: result.errors
            });

            if (result.success > 0) {
                addNotification({
                    type: 'success',
                    message: `${result.success} ${result.success === 1 ? 'image' : 'images'} uploaded successfully`
                });
            }

            if (result.errors && result.errors.length > 0) {
                addNotification({
                    type: 'error',
                    message: `${result.errors.length} ${result.errors.length === 1 ? 'upload' : 'uploads'} failed`
                });
            }

            // Reload images after a short delay
            setTimeout(() => {
                loadImages();
                setUploading(false);
                setUploadProgress(null);
            }, 1000);

        } catch (error) {
            addNotification({
                type: 'error',
                message: error.message || 'Failed to upload images'
            });
            setUploading(false);
            setUploadProgress(null);
        }
    };

    const handleDeleteImage = async (image) => {
        // Check if image is in use
        if (image.usedIn && image.usedIn.length > 0) {
            showConfirm(
                'Delete Image',
                `This image is used in: ${image.usedIn.join(', ')}. Are you sure you want to delete it?`,
                async () => {
                    await deleteImage(image, true);
                }
            );
        } else {
            showConfirm(
                'Delete Image',
                `Are you sure you want to delete "${image.filename}"?`,
                async () => {
                    await deleteImage(image, false);
                }
            );
        }
    };

    const deleteImage = async (image, force) => {
        try {
            await themesApi.deleteLibraryImage(themeId, image.filename, force);
            addNotification({
                type: 'success',
                message: `Image "${image.filename}" deleted successfully`
            });
            loadImages(); // Reload images

            // If theme was updated, notify parent
            if (force && onThemeUpdate) {
                onThemeUpdate();
            }
        } catch (error) {
            addNotification({
                type: 'error',
                message: error.message || 'Failed to delete image'
            });
        }
    };

    const handleBulkDelete = () => {
        if (selectedImages.length === 0) return;

        // Check if any selected images are in use
        const inUseImages = selectedImages.filter(filename => {
            const img = images.find(i => i.filename === filename);
            return img?.usedIn && img.usedIn.length > 0;
        });

        const message = inUseImages.length > 0
            ? `${inUseImages.length} of ${selectedImages.length} selected images are in use. Delete anyway?`
            : `Delete ${selectedImages.length} selected ${selectedImages.length === 1 ? 'image' : 'images'}?`;

        showConfirm(
            'Delete Images',
            message,
            async () => {
                await bulkDeleteImages();
            }
        );
    };

    const bulkDeleteImages = async () => {
        try {
            const result = await themesApi.bulkDeleteLibraryImages(themeId, selectedImages, true);

            if (result.success > 0) {
                addNotification({
                    type: 'success',
                    message: `${result.success} ${result.success === 1 ? 'image' : 'images'} deleted successfully`
                });
            }

            if (result.failed > 0) {
                addNotification({
                    type: 'error',
                    message: `${result.failed} ${result.failed === 1 ? 'image' : 'images'} failed to delete`
                });
            }

            setSelectedImages([]);
            loadImages(); // Reload images

            // If theme was updated, notify parent
            if (result.success > 0 && onThemeUpdate) {
                onThemeUpdate();
            }
        } catch (error) {
            addNotification({
                type: 'error',
                message: error.message || 'Failed to delete images'
            });
        }
    };

    const toggleImageSelection = (filename) => {
        setSelectedImages(prev =>
            prev.includes(filename)
                ? prev.filter(f => f !== filename)
                : [...prev, filename]
        );
    };

    const toggleSelectAll = () => {
        if (selectedImages.length === images.length) {
            setSelectedImages([]);
        } else {
            setSelectedImages(images.map(img => img.filename));
        }
    };

    const startEditingFilename = (image) => {
        setEditingFilename(image.filename);
        setNewFilename(image.filename);
    };

    const cancelEditingFilename = () => {
        setEditingFilename(null);
        setNewFilename('');
    };

    const saveFilename = async (oldFilename) => {
        if (!newFilename || newFilename === oldFilename) {
            cancelEditingFilename();
            return;
        }

        try {
            await themesApi.renameLibraryImage(themeId, oldFilename, newFilename);

            addNotification({
                type: 'success',
                message: 'Image renamed successfully'
            });

            cancelEditingFilename();
            loadImages();

            if (onThemeUpdate) {
                onThemeUpdate();
            }
        } catch (error) {
            addNotification({
                type: 'error',
                message: error.message || 'Failed to rename image'
            });
        }
    };

    const handleReplaceImage = (filename) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const result = await themesApi.replaceLibraryImage(themeId, filename, file);

                addNotification({
                    type: 'success',
                    message: 'Image replaced successfully'
                });

                // Wait a moment for S3 to fully process the upload
                await new Promise(resolve => setTimeout(resolve, 500));

                // Reload images to get updated uploadedAt timestamp
                await loadImages();
            } catch (error) {
                addNotification({
                    type: 'error',
                    message: error.message || 'Failed to replace image'
                });
            }
        };
        input.click();
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="text-lg font-semibold text-gray-900">Theme Image Library</div>
                        <div className="text-sm text-gray-600 mt-1">
                            Manage images for this theme. Images are stored in the theme's library and can be used in design groups.
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View mode toggle */}
                        <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 transition ${viewMode === 'list'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                                    }`}
                                title="List view with images"
                            >
                                <List className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('compact')}
                                className={`p-2 transition ${viewMode === 'compact'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                                    }`}
                                title="Compact list (text only)"
                            >
                                <AlignJustify className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 transition ${viewMode === 'grid'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-100'
                                    }`}
                                title="Grid view"
                            >
                                <Grid3x3 className="h-4 w-4" />
                            </button>
                        </div>

                        <button
                            onClick={loadImages}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition"
                            title="Refresh"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setShowBulkUpload(true)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition flex items-center gap-2"
                        >
                            <Upload className="h-4 w-4" />
                            Upload Images
                        </button>
                    </div>
                </div>

                {/* Bulk Actions */}
                {images.length > 0 && (
                    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={selectedImages.length === images.length && images.length > 0}
                                onChange={toggleSelectAll}
                                className="h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                            />
                            <span className="text-sm text-gray-700">
                                {selectedImages.length > 0
                                    ? `${selectedImages.length} selected`
                                    : `${images.length} ${images.length === 1 ? 'image' : 'images'}`
                                }
                            </span>
                        </div>
                        {selectedImages.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition flex items-center gap-1"
                            >
                                <Trash2 className="h-3 w-3" />
                                Delete Selected
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
                </div>
            ) : uploading ? (
                <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 text-purple-600 animate-spin mx-auto mb-4" />
                    <div className="text-lg font-medium text-gray-900 mb-2">Uploading Images</div>
                    {uploadProgress && (
                        <div className="text-gray-600">
                            {uploadProgress.completed} of {uploadProgress.total} images uploaded
                        </div>
                    )}
                </div>
            ) : images.length === 0 ? (
                <EmptyStateDropZone
                    onUpload={() => setShowBulkUpload(true)}
                    onFilesDropped={handleDirectUpload}
                />
            ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-3 gap-4' : viewMode === 'compact' ? 'space-y-0' : 'space-y-4'}>
                    {images.map((image) => {
                        const isSelected = selectedImages.includes(image.filename);

                        return (
                            <div
                                key={image.filename}
                                className={`relative overflow-hidden transition bg-white ${viewMode === 'compact'
                                    ? `border-b ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:bg-gray-50'}`
                                    : `border-2 shadow-sm ${isSelected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200 hover:border-gray-300'}`
                                    }`}
                            >
                                {/* Image - Full Width (not shown in compact view) */}
                                {viewMode !== 'compact' && (
                                    <div className={`w-full bg-gray-100 flex items-center justify-center overflow-hidden ${viewMode === 'grid' ? 'aspect-video' : 'max-h-96'
                                        }`}>
                                        <img
                                            key={`${image.filename}-${image.uploadedAt || 'initial'}-${image.pageLoadTime}`}
                                            src={`${image.publicUrl || image.url}?v=${image.uploadedAt ? new Date(image.uploadedAt).getTime() : image.pageLoadTime}`}
                                            alt={image.filename}
                                            className={viewMode === 'grid' ? 'w-full h-full object-contain' : 'w-full h-auto max-h-96 object-contain'}
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.parentElement.innerHTML = '<div class="text-gray-400 py-12"><svg class="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>';
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Info Below Image */}
                                <div className={viewMode === 'compact' ? 'p-2 bg-white' : 'p-3 bg-white'}>
                                    {viewMode === 'list' || viewMode === 'compact' ? (
                                        <div className="flex items-start justify-between gap-3">
                                            {/* Left side: Checkbox and name */}
                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleImageSelection(image.filename)}
                                                    className={`${viewMode === 'compact' ? 'mt-0.5' : 'mt-1'} h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500`}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    {editingFilename === image.filename ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={newFilename}
                                                                onChange={(e) => setNewFilename(e.target.value)}
                                                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') saveFilename(image.filename);
                                                                    if (e.key === 'Escape') cancelEditingFilename();
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => saveFilename(image.filename)}
                                                                className="p-1 text-green-600 hover:text-green-700"
                                                                title="Save"
                                                            >
                                                                <Check className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={cancelEditingFilename}
                                                                className="p-1 text-gray-600 hover:text-gray-700"
                                                                title="Cancel"
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 group/name">
                                                            <div className={`${viewMode === 'compact' ? 'text-xs' : 'text-sm'} font-medium text-gray-900 truncate`} title={image.filename}>
                                                                {image.filename}
                                                            </div>
                                                            <button
                                                                onClick={() => startEditingFilename(image)}
                                                                className="opacity-0 group-hover/name:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition"
                                                                title="Edit filename"
                                                            >
                                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className={`flex items-center gap-3 ${viewMode === 'compact' ? 'mt-0.5' : 'mt-1'} text-xs text-gray-600`}>
                                                        <span>{(image.size / 1024).toFixed(1)} KB</span>
                                                        {image.uploadedAt && (
                                                            <span>{new Date(image.uploadedAt).toLocaleDateString()}</span>
                                                        )}
                                                        {image.usedIn && image.usedIn.length > 0 && (
                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full inline-flex items-center gap-1" title={image.usedIn.join(', ')}>
                                                                <AlertCircle className="h-3 w-3" />
                                                                Used: {image.usedIn.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Right side: Action buttons */}
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleReplaceImage(image.filename)}
                                                    className={`${viewMode === 'compact' ? 'p-1' : 'p-1.5'} text-blue-600 hover:bg-blue-50 transition`}
                                                    title="Replace image"
                                                >
                                                    <RefreshCw className={viewMode === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteImage(image)}
                                                    className={`${viewMode === 'compact' ? 'p-1' : 'p-1.5'} text-red-600 hover:bg-red-50 transition`}
                                                    title="Delete image"
                                                >
                                                    <Trash2 className={viewMode === 'compact' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Grid view - more compact */
                                        <div className="space-y-2">
                                            <div className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleImageSelection(image.filename)}
                                                    className="mt-0.5 h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 flex-shrink-0"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    {editingFilename === image.filename ? (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="text"
                                                                value={newFilename}
                                                                onChange={(e) => setNewFilename(e.target.value)}
                                                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') saveFilename(image.filename);
                                                                    if (e.key === 'Escape') cancelEditingFilename();
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => saveFilename(image.filename)}
                                                                className="p-1 text-green-600 hover:text-green-700"
                                                                title="Save"
                                                            >
                                                                <Check className="h-3 w-3" />
                                                            </button>
                                                            <button
                                                                onClick={cancelEditingFilename}
                                                                className="p-1 text-gray-600 hover:text-gray-700"
                                                                title="Cancel"
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="group/name">
                                                            <div className="text-xs font-medium text-gray-900 truncate mb-1" title={image.filename}>
                                                                {image.filename}
                                                            </div>
                                                            <button
                                                                onClick={() => startEditingFilename(image)}
                                                                className="opacity-0 group-hover/name:opacity-100 absolute top-2 right-2 p-1 bg-white rounded shadow text-gray-400 hover:text-gray-600 transition"
                                                                title="Edit filename"
                                                            >
                                                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-gray-600 mb-1">
                                                        {(image.size / 1024).toFixed(1)} KB
                                                    </div>
                                                    {image.usedIn && image.usedIn.length > 0 && (
                                                        <div className="flex items-center gap-1 flex-wrap mb-2">
                                                            <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full inline-flex items-center gap-1" title={image.usedIn.join(', ')}>
                                                                <AlertCircle className="h-3 w-3" />
                                                                {image.usedIn.length}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action buttons - horizontal row */}
                                            <div className="flex items-center gap-1 pt-2 border-t border-gray-100 justify-end">
                                                <button
                                                    onClick={() => handleReplaceImage(image.filename)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 transition"
                                                    title="Replace image"
                                                >
                                                    <RefreshCw className="h-3 w-3" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteImage(image)}
                                                    className="p-1.5 text-red-600 hover:bg-red-50 transition"
                                                    title="Delete image"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Bulk Upload Modal */}
            {showBulkUpload && (
                <BulkImageUpload
                    themeId={themeId}
                    onUploadComplete={handleUploadComplete}
                    onCancel={() => setShowBulkUpload(false)}
                />
            )}
        </div>
    );
};

export default ImagesTab;

