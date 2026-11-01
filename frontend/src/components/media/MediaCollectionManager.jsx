import ClassificationPicker from '../classification/ClassificationPicker'
/**
 * MediaCollectionManager Component
 * 
 * Comprehensive interface for managing media collections with:
 * - List view with search and filtering
 * - Create, edit, delete collections
 * - View collection contents
 * - Add/remove files from collections
 * - Bulk operations
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import {
    Search,
    Plus,
    Edit2,
    Edit3,
    Trash2,
    Eye,
    Folder,
    FolderOpen,
    Users,
    Lock,
    Globe,
    Shield,
    Calendar,
    User,
    Tag,
    FileText,
    Image,
    Video,
    Music,
    Archive,
    File,
    ChevronDown,
    ChevronUp,
    MoreVertical,
    X,
    Check,
    AlertCircle,
    Loader2,
    Grid3X3,
    List as ListIcon,
    Filter,
    SortAsc,
    SortDesc,
    Upload,
    Save,
    Download
} from 'lucide-react';
import { mediaCollectionsApi, mediaTagsApi, mediaApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import MediaSearchWidget from './MediaSearchWidget';
import MediaBrowser from './MediaBrowser';
import MediaEditForm from './MediaEditForm';
import OptimizedImage from './OptimizedImage';
import ImageVersionContextMenu from './ImageVersionContextMenu';
import ImageVersionUploadDialog from './ImageVersionUploadDialog';
import { extractErrorMessage } from '../../utils/errorHandling';
import { fetchPaginatedResults } from '../../utils/fetchPaginatedResults';

// Compact Tag Input Component for inline forms
// Unified Collection Editor View Component (metadata + upload + files)
const CollectionEditorView = ({ collection, namespace, onBack, onSave }) => {
    // Form data for metadata
    const [formData, setFormData] = useState({
        title: collection.title,
        description: collection.description || '',
        accessLevel: 'public',
        classificationIds: collection.classificationIds || [],
        tagIds: collection.tags?.map(tag => tag.id) || []
    });
    const [availableTags, setAvailableTags] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [metadataExpanded, setMetadataExpanded] = useState(true);

    // Collection Files View State (from old CollectionFilesView)
    const [existingFiles, setExistingFiles] = useState([]);
    const [existingLoading, setExistingLoading] = useState(true);
    const [existingError, setExistingError] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [pickerTarget, setPickerTarget] = useState(null);
    const [editingFile, setEditingFile] = useState(null);
    const [versionMenu, setVersionMenu] = useState(null);
    const [versionUploadFile, setVersionUploadFile] = useState(null);
    const [editLoadingId, setEditLoadingId] = useState(null);
    const addingFilesRef = useRef(false);

    const { addNotification } = useGlobalNotifications();

    // Load available tags
    useEffect(() => {
        const loadTags = async () => {
            if (!namespace) return;
            try {
                const result = await mediaTagsApi.list({ namespace })();
                const tagsData = result.results || result || [];
                setAvailableTags(Array.isArray(tagsData) ? tagsData : []);
            } catch (error) {
                console.error('Failed to load tags:', error);
                setAvailableTags([]);
            }
        };
        loadTags();
    }, [namespace]);

    // Load existing files in collection
    const loadExistingFiles = useCallback(async () => {
        if (!collection || !namespace) return;

        try {
            setExistingLoading(true);
            setExistingError(null);

            // Pass the namespace slug so the backend's collection viewset
            // (which scopes to the default namespace by default) can locate
            // collections living in non-default namespaces.
            const params = { page_size: 100, namespace };
            const result = await mediaCollectionsApi.getFiles(collection.id, params)();
            const existingFilesData = result.results || result || [];
            setExistingFiles(Array.isArray(existingFilesData) ? existingFilesData : []);
        } catch (error) {
            console.error('Failed to load existing files:', error);
            setExistingError(extractErrorMessage(error));
            setExistingFiles([]);
            addNotification('Failed to load existing files', 'error');
        } finally {
            setExistingLoading(false);
        }
    }, [collection, namespace, addNotification]);

    useEffect(() => {
        loadExistingFiles();
    }, [loadExistingFiles]);

    // Handle metadata form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            addNotification('Collection title is required', 'error');
            return;
        }

        try {
            setIsSubmitting(true);
            const updateData = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                classification_ids: formData.classificationIds || [],
            };

            await await await await await await await await await await await mediaCollectionsApi.update(collection.id, updateData)();
            addNotification('Collection updated successfully', 'success');
            if (onSave) onSave();
        } catch (error) {
            console.error('Failed to update collection:', error);
            addNotification(extractErrorMessage(error), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle removing a file from collection
    const handleRemoveFile = async (fileId) => {
        try {
            await await await await await await await await await await await mediaCollectionsApi.removeFiles(collection.id, [fileId])();
            addNotification('File removed from collection', 'success');
            await loadExistingFiles();
        } catch (error) {
            console.error('Failed to remove file from collection:', error);
            addNotification('Failed to remove file from collection', 'error');
        }
    };

    const handleAddFiles = async (fileIds) => {
        const existingIds = new Set(existingFiles.map(file => String(file.id)));
        const newIds = [...new Set(fileIds.filter(Boolean).map(String))].filter(id => !existingIds.has(id));
        if (addingFilesRef.current || newIds.length === 0) return;
        addingFilesRef.current = true;
        try {
            await mediaCollectionsApi.addFiles(collection.id, newIds)();
            await loadExistingFiles();
            addNotification(`${newIds.length} image${newIds.length === 1 ? '' : 's'} added to collection`, 'success');
            setPickerTarget(null);
        } catch (error) {
            console.error('Failed to add file to collection:', error);
            addNotification(extractErrorMessage(error), 'error');
        } finally {
            addingFilesRef.current = false;
        }
    };

    const handleSelectedFile = (file) => handleAddFiles([file.id]);

    const handleApprovedFiles = (results) => {
        const ids = (results || []).filter(result => result.status !== 'error')
            .map(result => result.mediaFileId || result.media_file_id || result.mediaFile?.id || result.media_file?.id);
        return handleAddFiles(ids);
    };

    const handleImageContextMenu = (file, event) => {
        event.preventDefault();
        event.stopPropagation();
        setVersionMenu({ file, x: event.clientX, y: event.clientY });
    };

    const handleEditFile = async (file) => {
        setEditLoadingId(file.id);
        try {
            const details = await mediaApi.files.get(file.id)();
            setEditingFile(details);
        } catch (error) {
            addNotification(extractErrorMessage(error), 'error');
        } finally {
            setEditLoadingId(null);
        }
    };

    // File type icon helper
    const getFileTypeIcon = (fileType) => {
        switch (fileType) {
            case 'image': return Image;
            case 'video': return Video;
            case 'audio': return Music;
            case 'document': return FileText;
            case 'archive': return Archive;
            default: return File;
        }
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };

    // Render file card
    const renderFileCard = (file) => {
        const FileIcon = getFileTypeIcon(file.fileType);
        const imageSource = file.imgproxyBaseUrl || file.fileUrl;
        
        return (
            <div key={file.id} className="relative bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow group">
                {file.fileType === 'image' && imageSource ? (
                    <div className="aspect-square bg-gray-100 overflow-hidden" onContextMenu={event => handleImageContextMenu(file, event)}>
                        <OptimizedImage
                            src={imageSource}
                            alt={file.title}
                            width={540}
                            height={540}
                            actualWidth={file.width}
                            actualHeight={file.height}
                            resizeType="fit"
                            className="flex h-full w-full items-center justify-center object-contain"
                            fallback={<div className="flex h-full items-center justify-center"><FileIcon className="h-12 w-12 text-gray-400" /></div>}
                        />
                    </div>
                ) : (
                    <div className="aspect-square bg-gray-50 flex items-center justify-center">
                        <FileIcon className="w-12 h-12 text-gray-400" />
                    </div>
                )}
                <div className="p-3">
                    <div className="text-sm font-medium text-gray-900 truncate" title={file.title}>
                        {file.title}
                    </div>
                    {file.annotation && (
                        <div className="text-xs text-gray-600 mt-1 truncate" title={file.annotation}>
                            {file.annotation}
                        </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                        {formatFileSize(file.fileSize)}
                    </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-2 border-t border-gray-100 px-3 py-2 text-xs">
                    <button type="button" onClick={() => handleEditFile(file)} disabled={editLoadingId === file.id}
                        className="font-medium text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
                        aria-label={`Edit ${file.title}`}>
                        {editLoadingId === file.id ? 'Loading…' : 'Edit'}
                    </button>
                    <button type="button" onClick={() => handleRemoveFile(file.id)}
                        className="font-medium text-red-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
                        aria-label={`Remove ${file.title} from collection`}>
                        Remove
                    </button>
                </div>
            </div>
        );
    };

    const renderFileListItem = (file) => {
        const FileIcon = getFileTypeIcon(file.fileType);
        const imageSource = file.imgproxyBaseUrl || file.fileUrl;

        return <div key={file.id} className="grid min-w-[700px] grid-cols-12 items-center gap-4 border-b border-gray-100 px-4 py-1 hover:bg-gray-50">
            <div className="col-span-2">
                <button type="button" onClick={() => handleEditFile(file)} disabled={editLoadingId === file.id}
                    onContextMenu={file.fileType === 'image' ? event => handleImageContextMenu(file, event) : undefined}
                    aria-label={`Edit ${file.title}`} className="flex h-20 w-24 items-center justify-center overflow-hidden bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50">
                    {file.fileType === 'image' && imageSource ? <OptimizedImage
                        src={imageSource} alt={file.title} width={192} height={160}
                        actualWidth={file.width} actualHeight={file.height} resizeType="fit"
                        className="flex h-full w-full items-center justify-center object-contain"
                        fallback={<FileIcon className="h-8 w-8 text-gray-400" />}
                    /> : <FileIcon className="h-8 w-8 text-gray-400" />}
                </button>
            </div>
            <div className="col-span-4 min-w-0">
                <div className="truncate text-sm font-medium text-gray-900" title={file.title}>{file.title}</div>
                {file.annotation && <div className="truncate text-xs text-gray-500" title={file.annotation}>{file.annotation}</div>}
            </div>
            <div className="col-span-2 text-sm capitalize text-gray-600">{file.fileType}</div>
            <div className="col-span-2 text-sm text-gray-600">{formatFileSize(file.fileSize)}</div>
            <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <button type="button" onClick={() => handleEditFile(file)} disabled={editLoadingId === file.id}
                    className="font-medium text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
                    aria-label={`Edit ${file.title} details`}>{editLoadingId === file.id ? 'Loading…' : 'Edit'}</button>
                <button type="button" onClick={() => handleRemoveFile(file.id)}
                    className="font-medium text-red-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"
                    aria-label={`Remove ${file.title} from collection`}>Remove</button>
            </div>
        </div>;
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                        <div>
                            <div className="text-xl font-semibold text-gray-900" role="heading" aria-level="2">Edit Collection</div>
                            <div className="text-sm text-gray-600 mt-0.5">{collection.title}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-6">
                    {/* Metadata Section (Collapsible) */}
                    <div className="bg-white rounded-lg border border-gray-200">
                        <button
                            onClick={() => setMetadataExpanded(!metadataExpanded)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                        >
                            <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Collection Details</div>
                            {metadataExpanded ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                        </button>
                        
                        {metadataExpanded && (
                            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
                                {/* Title Field */}
                                <div>
                                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        id="title"
                                        value={formData.title}
                                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Enter collection title"
                                        required
                                    />
                                </div>

                                {/* Description Field */}
                                <div>
                                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Enter collection description"
                                        rows={3}
                                    />
                                </div>

                                <ClassificationPicker value={formData.classificationIds || []}
                                    onChange={(ids) => setFormData(prev => ({ ...prev, classificationIds: ids }))}
                                    namespace={namespace} use="media_collections" />
                                {/* Form Actions */}
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Collection Files Section */}
                    <div className="bg-white rounded-lg border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Files in Collection</div>
                                <div className="text-sm text-gray-600 mt-0.5">{existingFiles.length} files</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPickerTarget({ file: null })}
                                    className="flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add images
                                </button>
                                <button
                                    type="button"
                                    aria-label="Grid"
                                    aria-pressed={viewMode === 'grid'}
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
                                >
                                    <Grid3X3 className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    aria-label="List"
                                    aria-pressed={viewMode === 'list'}
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
                                >
                                    <ListIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {existingLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                </div>
                            ) : existingError ? (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-red-800">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span className="font-medium text-sm">Error loading files</span>
                                    </div>
                                    <div className="text-red-700 text-sm mt-1">{existingError}</div>
                                </div>
                            ) : existingFiles.length === 0 ? (
                                <div className="text-center py-12">
                                    <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <div className="text-sm font-medium text-gray-900 mb-1" role="heading" aria-level="4">No files in collection</div>
                                    <div className="text-sm text-gray-600">
                                        Add images to get started.
                                    </div>
                                </div>
                            ) : (
                                viewMode === 'grid'
                                    ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{existingFiles.map(renderFileCard)}</div>
                                    : <div className="overflow-x-auto">
                                        <div className="grid min-w-[700px] grid-cols-12 gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
                                            <div className="col-span-2">Preview</div>
                                            <div className="col-span-4">Title</div>
                                            <div className="col-span-2">Type</div>
                                            <div className="col-span-2">Size</div>
                                            <div className="col-span-2">Actions</div>
                                        </div>
                                        {existingFiles.map(renderFileListItem)}
                                    </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <Dialog open={Boolean(pickerTarget)} onClose={() => setPickerTarget(null)} className="relative z-50">
                <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
                    <DialogPanel className="flex h-[min(90dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded border border-gray-200 bg-white shadow-xl">
                        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
                            <div>
                            <DialogTitle className="text-lg font-semibold text-gray-900">Add images</DialogTitle>
                            <p className="mt-1 text-sm text-gray-600">Select an existing image or upload and tag a new one. Pending uploads can be approved here.</p>
                            </div>
                            <button type="button" onClick={() => setPickerTarget(null)} aria-label="Close image picker dialog"
                                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {pickerTarget && <MediaBrowser
                                namespace={namespace}
                                fileTypes={['image']}
                                selectionMode="single"
                                onFileSelect={handleSelectedFile}
                                onApprovedFiles={handleApprovedFiles}
                                showUploader
                                hideShowDeleted
                                hideTypeFilter
                                compact
                            />}
                        </div>
                    </DialogPanel>
                </div>
            </Dialog>
            <Dialog open={Boolean(editingFile)} onClose={() => setEditingFile(null)} className="relative z-50">
                <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <DialogPanel className="flex h-[min(85dvh,800px)] w-full max-w-3xl flex-col overflow-hidden rounded border border-gray-200 bg-white p-5 shadow-xl">
                        <DialogTitle className="mb-3 shrink-0 text-lg font-semibold text-gray-900">Edit {editingFile?.title}</DialogTitle>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {editingFile && <MediaEditForm file={editingFile} namespace={namespace} mode="edit" showHeader={false}
                                onCancel={() => setEditingFile(null)}
                                onMediaUpdated={loadExistingFiles}
                                onSave={() => { setEditingFile(null); loadExistingFiles(); }} />}
                        </div>
                    </DialogPanel>
                </div>
            </Dialog>
            <ImageVersionContextMenu position={versionMenu} onClose={() => setVersionMenu(null)}
                onUpload={() => { setVersionUploadFile(versionMenu.file); setVersionMenu(null) }} />
            {versionUploadFile && <ImageVersionUploadDialog file={versionUploadFile} namespace={namespace}
                onClose={() => setVersionUploadFile(null)} onUploaded={loadExistingFiles} />}
        </div>
    );
};

// Old Collection Files View Component (to be removed after migration)
const CollectionFilesView_OLD = ({ collection, namespace, onBack }) => {
    // Available files (right column - files that can be added)
    const [availableFiles, setAvailableFiles] = useState([]);
    const [availableLoading, setAvailableLoading] = useState(true);
    const [availableError, setAvailableError] = useState(null);

    // Existing files (left column - files already in collection)
    const [existingFiles, setExistingFiles] = useState([]);
    const [existingLoading, setExistingLoading] = useState(true);
    const [existingError, setExistingError] = useState(null);

    // UI state
    const [viewMode, setViewMode] = useState('grid');
    const [searchTerms, setSearchTerms] = useState([]);
    const [selectedFileType, setSelectedFileType] = useState('');
    const { addNotification } = useGlobalNotifications();

    // Load available files (files that can be added to collection)
    useEffect(() => {
        const loadAvailableFiles = async () => {
            if (!collection || !namespace) return;

            try {
                setAvailableLoading(true);
                setAvailableError(null);

                // Convert search terms to structured search parameters
                const textTerms = searchTerms.filter(term => term.type === 'text');
                const tagTerms = searchTerms.filter(term => term.type === 'tag');

                // Build search parameters - exclude files already in collection
                const params = {
                    namespace: namespace,
                    collection: collection.id, // This excludes files already in collection
                    page_size: 100
                };

                // Add text search if provided
                if (textTerms.length > 0) {
                    params.text_search = textTerms[0].value;
                }

                // Add tag searches (multiple allowed, work as AND)
                if (tagTerms.length > 0) {
                    params.tag_names = tagTerms.map(term => term.value);
                }

                // Add file type filter if selected
                if (selectedFileType) {
                    params.file_type = selectedFileType;
                }

                // Use the media files API to get available files
                const result = await mediaApi.files.list(params)();
                const filesData = result.results || result || [];
                setAvailableFiles(Array.isArray(filesData) ? filesData : []);
            } catch (error) {
                console.error('Failed to load available files:', error);
                setAvailableError(extractErrorMessage(error));
                setAvailableFiles([]);
                addNotification('Failed to load available files', 'error');
            } finally {
                setAvailableLoading(false);
            }
        };

        loadAvailableFiles();
    }, [collection, namespace, searchTerms, selectedFileType, addNotification]);

    // Load existing files (files already in collection)
    useEffect(() => {
        const loadExistingFiles = async () => {
            if (!collection || !namespace) return;

            try {
                setExistingLoading(true);
                setExistingError(null);

                // Use the dedicated endpoint to get files in this collection.
                // Include the namespace slug so the backend resolves
                // collections from non-default namespaces.
                const params = {
                    page_size: 100,
                    namespace,
                };

                const result = await mediaCollectionsApi.getFiles(collection.id, params)();
                const existingFilesData = result.results || result || [];
                setExistingFiles(Array.isArray(existingFilesData) ? existingFilesData : []);
            } catch (error) {
                console.error('Failed to load existing files:', error);
                setExistingError(extractErrorMessage(error));
                setExistingFiles([]);
                addNotification('Failed to load existing files', 'error');
            } finally {
                setExistingLoading(false);
            }
        };

        loadExistingFiles();
    }, [collection, namespace, addNotification]);



    // Get file type icon
    const getFileTypeIcon = (fileType) => {
        switch (fileType) {
            case 'image':
                return Image;
            case 'video':
                return Video;
            case 'audio':
                return Music;
            case 'document':
                return FileText;
            case 'archive':
                return Archive;
            default:
                return File;
        }
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };

    // Handle removing a single file from collection
    const handleRemoveFile = async (fileId) => {
        try {
            // Remove file from collection using the collection API
            await await await await await await await await await await await mediaCollectionsApi.removeFiles(collection.id, [fileId])();
            addNotification('File removed from collection', 'success');

            // Reload both columns to show updated results
            await reloadBothColumns();
        } catch (error) {
            console.error('Failed to remove file from collection:', error);
            addNotification('Failed to remove file from collection', 'error');
        }
    };

    // Handle adding a single file to collection
    const handleAddFile = async (fileId) => {
        try {
            // Add file to collection using the collection API
            await await await await await await await await await await await mediaCollectionsApi.addFiles(collection.id, [fileId])();
            addNotification('File added to collection', 'success');

            // Reload both columns to show updated results
            await reloadBothColumns();
        } catch (error) {
            console.error('Failed to add file to collection:', error);
            addNotification('Failed to add file to collection', 'error');
        }
    };

    // Helper function to reload both columns
    const reloadBothColumns = async () => {
        try {
            // Reload available files
            const textTerms = searchTerms.filter(term => term.type === 'text');
            const tagTerms = searchTerms.filter(term => term.type === 'tag');
            const availableParams = {
                namespace: namespace,
                collection: collection.id, // Excludes files in collection
                page_size: 100
            };
            if (textTerms.length > 0) {
                availableParams.text_search = textTerms[0].value;
            }
            if (tagTerms.length > 0) {
                availableParams.tag_names = tagTerms.map(term => term.value);
            }
            if (selectedFileType) {
                availableParams.file_type = selectedFileType;
            }
            const availableResult = await mediaApi.files.list(availableParams)();
            const availableFilesData = availableResult.results || availableResult || [];
            setAvailableFiles(Array.isArray(availableFilesData) ? availableFilesData : []);

            // Reload existing files using the dedicated endpoint.
            // Pass namespace so the backend resolves collections in
            // non-default namespaces.
            const existingParams = {
                page_size: 100,
                namespace,
            };
            const existingResult = await mediaCollectionsApi.getFiles(collection.id, existingParams)();
            const existingFilesData = existingResult.results || existingResult || [];
            setExistingFiles(Array.isArray(existingFilesData) ? existingFilesData : []);
        } catch (error) {
            console.error('Failed to reload files:', error);
        }
    };

    // Render existing file card (left column - with remove button)
    const renderExistingFileCard = (file) => {
        const FileIcon = getFileTypeIcon(file.fileType);

        return (
            <div
                key={file.id}
                className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden relative group"
            >
                {/* Remove Button */}
                <button
                    onClick={() => handleRemoveFile(file.id)}
                    className="absolute top-1 right-1 z-10 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center transition-opacity hover:bg-red-700"
                    title="Remove from collection"
                >
                    <X className="w-3 h-3" />
                </button>

                {/* File Preview */}
                <div className="aspect-square bg-gray-50 flex items-center justify-center relative">
                    {file.fileType === 'image' && (file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl) ? (
                        <img
                            src={file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl}
                            alt={file.originalFilename}
                            className="max-w-full max-h-full object-cover"
                            onError={(e) => {
                                // Fallback to icon if image fails to load
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                            }}
                        />
                    ) : null}
                    <FileIcon
                        className="w-8 h-8 text-gray-400"
                        style={{ display: file.fileType === 'image' && (file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl) ? 'none' : 'block' }}
                    />
                </div>

                {/* File Info */}
                <div className="p-2">
                    <div className="text-xs font-medium text-gray-900 truncate mb-1" role="heading" aria-level="4">
                        {file.title || file.originalFilename}
                    </div>
                    {file.annotation && (
                        <div className="text-xs text-gray-600 mb-1 truncate" title={file.annotation}>
                            {file.annotation}
                        </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="truncate">{file.title || file.originalFilename}</span>
                        <span className="capitalize ml-2 flex-shrink-0">{file.fileType}</span>
                    </div>
                </div>
            </div>
        );
    };

    // Render existing file list item (left column - with remove button)
    const renderExistingFileListItem = (file) => {
        const FileIcon = getFileTypeIcon(file.fileType);

        return (
            <div
                key={file.id}
                className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group"
            >
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                    {file.fileType === 'image' && (file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl) ? (
                        <img
                            src={file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl}
                            alt={file.originalFilename}
                            className="max-w-full max-h-full object-cover"
                            onError={(e) => {
                                // Fallback to icon if image fails to load
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                            }}
                        />
                    ) : null}
                    <FileIcon
                        className="w-4 h-4 text-gray-400"
                        style={{
                            display: file.fileType === 'image' && file.imgproxyBaseUrl ? 'none' : 'block',
                            position: file.fileType === 'image' && file.imgproxyBaseUrl ? 'absolute' : 'static'
                        }}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate" role="heading" aria-level="4">
                        {file.title || file.originalFilename}
                    </div>
                    {file.annotation && (
                        <div className="text-xs text-gray-600 mt-0.5 truncate" title={file.annotation}>
                            {file.annotation}
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="truncate">{file.title || file.originalFilename}</span>
                        <span className="capitalize ml-2 flex-shrink-0">{file.fileType}</span>
                    </div>
                </div>
                {/* Remove Button */}
                <button
                    onClick={() => handleRemoveFile(file.id)}
                    className="w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center transition-opacity hover:bg-red-700 flex-shrink-0"
                    title="Remove from collection"
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        );
    };

    // Render file card (right column - with selection)
    const renderFileCard = (file) => {
        const FileIcon = getFileTypeIcon(file.fileType);

        return (
            <div
                key={file.id}
                className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden relative group"
            >
                {/* Add Button */}
                <button
                    onClick={() => handleAddFile(file.id)}
                    className="absolute top-1 right-1 z-10 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center transition-opacity hover:bg-green-700"
                    title="Add to collection"
                >
                    <Plus className="w-3 h-3" />
                </button>

                {/* File Preview */}
                <div className="aspect-square bg-gray-50 flex items-center justify-center relative">
                    {file.fileType === 'image' && (file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl) ? (
                        <img
                            src={file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl}
                            alt={file.originalFilename}
                            className="max-w-full max-h-full object-cover"
                            onError={(e) => {
                                // Fallback to icon if image fails to load
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                            }}
                        />
                    ) : null}
                    <FileIcon
                        className="w-8 h-8 text-gray-400"
                        style={{ display: file.fileType === 'image' && (file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl) ? 'none' : 'block' }}
                    />
                </div>

                {/* File Info */}
                <div className="p-2">
                    <div className="text-xs font-medium text-gray-900 truncate mb-1" role="heading" aria-level="4">
                        {file.title || file.originalFilename}
                    </div>
                    {file.annotation && (
                        <div className="text-xs text-gray-600 mb-1 truncate" title={file.annotation}>
                            {file.annotation}
                        </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="truncate">{file.title || file.originalFilename}</span>
                        <span className="capitalize ml-2 flex-shrink-0">{file.fileType}</span>
                    </div>
                </div>
            </div>
        );
    };

    // Render file list item (right column - with add button)
    const renderFileListItem = (file) => {
        const FileIcon = getFileTypeIcon(file.fileType);

        return (
            <div
                key={file.id}
                className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group"
            >
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                    {file.fileType === 'image' && (file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl) ? (
                        <img
                            src={file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl}
                            alt={file.originalFilename}
                            className="max-w-full max-h-full object-cover"
                            onError={(e) => {
                                // Fallback to icon if image fails to load
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                            }}
                        />
                    ) : null}
                    <FileIcon
                        className="w-4 h-4 text-gray-400"
                        style={{
                            display: file.fileType === 'image' && file.imgproxyBaseUrl ? 'none' : 'block',
                            position: file.fileType === 'image' && file.imgproxyBaseUrl ? 'absolute' : 'static'
                        }}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate" role="heading" aria-level="4">
                        {file.title || file.originalFilename}
                    </div>
                    {file.annotation && (
                        <div className="text-xs text-gray-600 mt-0.5 truncate" title={file.annotation}>
                            {file.annotation}
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="truncate">{file.title || file.originalFilename}</span>
                        <span className="capitalize ml-2 flex-shrink-0">{file.fileType}</span>
                    </div>
                </div>
                {/* Add Button */}
                <button
                    onClick={() => handleAddFile(file.id)}
                    className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center transition-opacity hover:bg-green-700 flex-shrink-0"
                    title="Add to collection"
                >
                    <Plus className="w-3 h-3" />
                </button>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Back to collections"
                        >
                            <ChevronUp className="w-5 h-5 -rotate-90" />
                        </button>
                        <Folder className="w-6 h-6 text-blue-600" />
                        <div>
                            <div className="text-2xl font-bold text-gray-900" role="heading" aria-level="2">{collection.title}</div>
                            <div className="text-gray-600 mt-1">
                                {existingFiles.length} files in collection • {availableFiles.length} available to add
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* View Mode Toggle - applies to both columns */}
                        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                title="Grid view"
                            >
                                <Grid3X3 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                title="List view"
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>



            {/* Available Files Section - Full Width */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
                <div className="mb-3">
                    <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Available Files</div>
                    <div className="text-sm text-gray-600 mt-1">
                        {availableFiles.length} files available to add • Click + to add
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col gap-3">
                    {/* Search Widget and File Type Filter */}
                    <div className="flex items-stretch gap-3">
                        <div className="flex-1">
                            <MediaSearchWidget
                                searchTerms={searchTerms}
                                onChange={setSearchTerms}
                                namespace={namespace}
                                placeholder="Search available files and tags..."
                            />
                        </div>
                        <select
                            value={selectedFileType}
                            onChange={(e) => setSelectedFileType(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm min-w-[120px] h-[42px]"
                        >
                            <option value="">All Types</option>
                            <option value="image">Images</option>
                            <option value="video">Videos</option>
                            <option value="audio">Audio</option>
                            <option value="document">Documents</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    {/* Clear Filters */}
                    {(searchTerms.length > 0 || selectedFileType) && (
                        <div className="flex justify-start">
                            <button
                                onClick={() => {
                                    setSearchTerms([]);
                                    setSelectedFileType('');
                                }}
                                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Clear Filters
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area - Two Column Layout */}
            <div className="flex-1 overflow-hidden">
                <div className="p-6 h-full">
                    <div className="grid grid-cols-2 gap-6 h-full">
                        {/* Left Column - Existing Files in Collection */}
                        <div className="bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                                <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Files in Collection</div>
                                <div className="text-sm text-gray-600 mt-1">{existingFiles.length} files</div>
                            </div>
                            <div className="p-4 flex-1 overflow-auto">
                                {existingLoading && (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="text-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                                            <div className="text-sm text-gray-600">Loading existing files...</div>
                                        </div>
                                    </div>
                                )}

                                {existingError && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                        <div className="flex items-center gap-2 text-red-800 mb-2">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            <span className="font-medium text-sm">Error loading existing files</span>
                                        </div>
                                        <div className="text-red-700 text-sm">{existingError}</div>
                                    </div>
                                )}

                                {!existingLoading && !existingError && (
                                    <>
                                        {existingFiles.length === 0 ? (
                                            <div className="text-center py-8">
                                                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                                <div className="text-sm font-medium text-gray-900 mb-1" role="heading" aria-level="4">No files in collection</div>
                                                <div className="text-sm text-gray-600">Add files from the right panel to get started.</div>
                                            </div>
                                        ) : (
                                            <div className={
                                                viewMode === 'grid'
                                                    ? 'grid grid-cols-2 lg:grid-cols-3 gap-3'
                                                    : 'space-y-2'
                                            }>
                                                {existingFiles.map(file =>
                                                    viewMode === 'grid' ? renderExistingFileCard(file) : renderExistingFileListItem(file)
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Available Files Grid */}
                        <div className="bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                                <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Available Files</div>
                                <div className="text-sm text-gray-600 mt-1">Click + to add files or × to remove</div>
                            </div>
                            <div className="p-4 flex-1 overflow-auto">
                                {availableLoading && (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="text-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                                            <div className="text-sm text-gray-600">Loading available files...</div>
                                        </div>
                                    </div>
                                )}

                                {availableError && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                        <div className="flex items-center gap-2 text-red-800 mb-2">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            <span className="font-medium text-sm">Error loading available files</span>
                                        </div>
                                        <div className="text-red-700 text-sm">{availableError}</div>
                                    </div>
                                )}

                                {!availableLoading && !availableError && (
                                    <>
                                        {availableFiles.length === 0 ? (
                                            <div className="text-center py-8">
                                                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                                <div className="text-sm font-medium text-gray-900 mb-1" role="heading" aria-level="4">
                                                    {searchTerms.length > 0 || selectedFileType
                                                        ? 'No files match your filters'
                                                        : 'No files available to add'
                                                    }
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    {searchTerms.length > 0 || selectedFileType
                                                        ? 'Try adjusting your search criteria or clearing the filters.'
                                                        : 'All files are already in this collection.'
                                                    }
                                                </div>
                                                {(searchTerms.length > 0 || selectedFileType) && (
                                                    <button
                                                        onClick={() => {
                                                            setSearchTerms([]);
                                                            setSelectedFileType('');
                                                        }}
                                                        className="mt-3 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                                                    >
                                                        Clear Filters
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className={
                                                viewMode === 'grid'
                                                    ? 'grid grid-cols-2 lg:grid-cols-3 gap-3'
                                                    : 'space-y-2'
                                            }>
                                                {availableFiles.map(file =>
                                                    viewMode === 'grid' ? renderFileCard(file) : renderFileListItem(file)
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Edit Collection View Component (inline, not modal)
const EditCollectionView = ({ collection, namespace, onBack, onSave }) => {
    const [formData, setFormData] = useState({
        title: collection.title,
        description: collection.description || '',
        accessLevel: 'public',
        classificationIds: collection.classificationIds || [],
        tagIds: collection.tags?.map(tag => tag.id) || []
    });
    const [availableTags, setAvailableTags] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addNotification } = useGlobalNotifications();

    // Load available tags
    useEffect(() => {
        const loadTags = async () => {
            if (!namespace) return;
            try {
                const result = await mediaTagsApi.list({ namespace })();
                const tagsData = result.results || result || [];
                setAvailableTags(Array.isArray(tagsData) ? tagsData : []);
            } catch (error) {
                console.error('Failed to load tags:', error);
                setAvailableTags([]);
            }
        };
        loadTags();
    }, [namespace]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            addNotification('Collection title is required', 'error');
            return;
        }

        try {
            setIsSubmitting(true);
            const updateData = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                classification_ids: formData.classificationIds || [],
            };

            await await await await await await await await await await await mediaCollectionsApi.update(collection.id, updateData)();
            addNotification('Collection updated successfully', 'success');
            onSave();
        } catch (error) {
            console.error('Failed to update collection:', error);
            addNotification(extractErrorMessage(error), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Back to collections"
                        >
                            <ChevronUp className="w-5 h-5 -rotate-90" />
                        </button>
                        <Edit3 className="w-6 h-6 text-blue-600" />
                        <div>
                            <div className="text-2xl font-bold text-gray-900" role="heading" aria-level="2">Edit Collection</div>
                            <div className="text-gray-600 mt-1">Update collection details</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-auto">
                <div className="p-6">
                    <div className="max-w-2xl mx-auto">
                        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
                            {/* Title Field */}
                            <div className="mb-6">
                                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                                    Collection Title *
                                </label>
                                <input
                                    type="text"
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter collection title"
                                    required
                                />
                            </div>

                            {/* Description Field */}
                            <div className="mb-6">
                                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Enter collection description"
                                    rows={3}
                                />
                            </div>

                            {/* Tags Field */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tags
                                </label>
                                <ClassificationPicker value={formData.classificationIds || []}
                                    onChange={(ids) => setFormData(prev => ({ ...prev, classificationIds: ids }))}
                                    namespace={namespace} use="media_collections" />
                            </div>

                            {/* Form Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={onBack}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            Updating...
                                        </>
                                    ) : (
                                        'Update Collection'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MediaCollectionManager = ({ namespace, onCollectionSelect, collectionId, onCollectionClose }) => {
    const [collections, setCollections] = useState([]);
    const [versionMenu, setVersionMenu] = useState(null);
    const [versionUploadFile, setVersionUploadFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('updated_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [showEmptyCollections, setShowEmptyCollections] = useState(false);
    const [showTrash, setShowTrash] = useState(false);
    const [selectedCollectionIds, setSelectedCollectionIds] = useState([]);
    const [deleteFiles, setDeleteFiles] = useState(false);
    const [deleteTargets, setDeleteTargets] = useState([]);
    const [bulkBusy, setBulkBusy] = useState(false);

    // Filters
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        accessLevel: '',
        createdBy: '',
        tags: []
    });

    // Modal states
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedCollection, setSelectedCollection] = useState(null);

    // View states
    const [currentView, setCurrentView] = useState('collections'); // 'collections' | 'files' | 'edit'
    const [viewingCollection, setViewingCollection] = useState(null);
    const [editingCollection, setEditingCollection] = useState(null);

    // Inline form states
    const [showInlineForm, setShowInlineForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        accessLevel: 'public',
        classificationIds: [],
        tagIds: []
    });

    // Available tags for form
    const [availableTags, setAvailableTags] = useState([]);

    const { addNotification } = useGlobalNotifications();

    // Load collections
    const loadCollections = useCallback(async () => {
        if (!namespace) return;

        try {
            setLoading(true);
            setError(null);

            const params = {
                namespace: namespace,
                search: searchQuery || undefined,
                ordering: `${sortOrder === 'desc' ? '-' : ''}${sortBy}`,
                ...filters
            };

            // Remove empty filters
            Object.keys(params).forEach(key => {
                if (params[key] === '' || (Array.isArray(params[key]) && params[key].length === 0)) {
                    delete params[key];
                }
            });

            const collectionsData = await fetchPaginatedResults(page =>
                (showTrash ? mediaCollectionsApi.trash : mediaCollectionsApi.list)({ ...params, page })()
            );
            setCollections(collectionsData);
            setSelectedCollectionIds([]);
        } catch (error) {
            console.error('Failed to load collections:', error);
            setError(extractErrorMessage(error));
            setCollections([]); // Ensure collections is always an array
            addNotification('Failed to load collections', 'error');
        } finally {
            setLoading(false);
        }
    }, [namespace, searchQuery, sortBy, sortOrder, filters, showTrash, addNotification]);

    // Load available tags
    const loadAvailableTags = useCallback(async () => {
        if (!namespace) return;

        try {
            const result = await mediaTagsApi.list({ namespace })();
            setAvailableTags(result.results || result);
        } catch (error) {
            console.error('Failed to load tags:', error);
        }
    }, [namespace]);

    // Handle tag creation - add new tag to available tags list
    const handleTagCreated = useCallback((newTag) => {
        setAvailableTags(prev => {
            // Check if tag already exists to avoid duplicates
            const exists = prev.some(tag => tag.id === newTag.id);
            if (exists) {
                return prev;
            }
            return [...prev, newTag];
        });
    }, []);

    // Load data on mount and when dependencies change
    useEffect(() => {
        if (namespace) {
            loadCollections();
            loadAvailableTags();
        }
    }, [loadCollections, loadAvailableTags, namespace]);

    // Handle search
    const handleSearch = useCallback((query) => {
        setSearchQuery(query);
    }, []);

    const handleViewTabKeyDown = (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextTrash = event.key === 'End' ? true : event.key === 'Home' ? false : !showTrash;
        setShowTrash(nextTrash);
        event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[nextTrash ? 1 : 0].focus();
    };

    // Handle sort change
    const handleSortChange = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    // Handle filter change
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            accessLevel: 'public',
            classificationIds: [],
        tagIds: []
        });
    };

    // Handle create collection
    const handleCreate = () => {
        resetForm();
        setShowInlineForm(true);
    };

    // Handle edit collection
    const handleEdit = useCallback((collection) => {
        setEditingCollection(collection);
        setFormData({
            title: collection.title,
            description: collection.description || '',
            accessLevel: 'public', // Keep default for backend compatibility
            classificationIds: collection.classificationIds || [],
        tagIds: collection.tags?.map(tag => tag.id) || []
        });
        setCurrentView('edit');
    }, []);

    useEffect(() => {
        if (!collectionId || !namespace) return;
        let active = true;
        const openCollection = async () => {
            try {
                const collection = await mediaCollectionsApi.get(collectionId, { namespace })();
                if (active) handleEdit(collection);
            } catch (error) {
                if (active) addNotification(`Could not open collection: ${extractErrorMessage(error)}`, 'error');
            }
        };
        openCollection();
        return () => { active = false; };
    }, [collectionId, namespace, handleEdit, addNotification]);

    // Handle delete collection
    const handleDelete = (collection) => {
        setSelectedCollection(collection);
        setDeleteTargets([collection]);
        setDeleteFiles(false);
        setShowDeleteModal(true);
    };

    const toggleCollectionSelection = (id) => {
        setSelectedCollectionIds(previous => {
            if (previous.includes(id)) return previous.filter(selectedId => selectedId !== id);
            if (previous.length >= 100) return previous;
            return [...previous, id];
        });
    };

    const restoreCollections = async (collectionsToRestore) => {
        setBulkBusy(true);
        try {
            await mediaCollectionsApi.bulkRestore(collectionsToRestore.map(collection => collection.id))();
            addNotification(`Restored ${collectionsToRestore.length} collection(s)`, 'success');
            await loadCollections();
        } catch (error) {
            addNotification(extractErrorMessage(error), 'error');
            await loadCollections();
        } finally {
            setBulkBusy(false);
        }
    };
    
    // Handle download collection as ZIP
    const handleDownloadZip = async (collection) => {
        try {
            const blob = await await await await await await await await await await await mediaCollectionsApi.downloadZip(collection.id)();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${collection.slug || collection.title}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            addNotification(`Downloading ${collection.title} as ZIP...`, 'success');
        } catch (error) {
            console.error('Failed to download collection:', error);
            addNotification('Failed to download collection', 'error');
        }
    };

    // Handle view collection files
    const handleViewFiles = (collection) => {
        setViewingCollection(collection);
        setCurrentView('files');
    };

    // Handle back to collections
    const handleBackToCollections = () => {
        setCurrentView('collections');
        setViewingCollection(null);
        setEditingCollection(null);
        onCollectionClose?.();
    };

    // Submit create/edit form
    const handleSubmit = async (isEdit = false) => {
        // Validate required fields
        if (!formData.title.trim()) {
            addNotification('Collection title is required', 'error');
            return;
        }

        if (!formData.classificationIds || formData.classificationIds.length === 0) {
            addNotification('At least one tag is required to create a collection', 'error');
            return;
        }

        try {
            setIsSubmitting(true);

            let collectionData;
            if (isEdit) {
                // For editing, send all form data
                collectionData = {
                    ...formData,
                    namespace: namespace,
                    classificationIds: formData.classificationIds || [],
                };
            } else {
                // For creating, only send essential fields (let backend generate slug)
                collectionData = {
                    title: formData.title,
                    namespace: namespace,
                    classificationIds: formData.classificationIds || [],
                };
            }

            let result;
            if (isEdit) {
                result = await await await await await await await await await await await mediaCollectionsApi.update(selectedCollection.id, collectionData)();
                addNotification('Collection updated successfully', 'success');
            } else {
                result = await await await await await await await await await await await mediaCollectionsApi.create(collectionData)();
                addNotification('Collection created successfully', 'success');
            }

            // Refresh collections
            await loadCollections();

            // Close forms
            setShowInlineForm(false);
            setShowEditModal(false);
            resetForm();
            if (!isEdit && result?.id) handleEdit(result);
        } catch (error) {
            console.error('Failed to save collection:', error);
            addNotification(extractErrorMessage(error), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Cancel inline form
    const handleCancelInlineForm = () => {
        setShowInlineForm(false);
        resetForm();
    };

    // Confirm delete
    const confirmDelete = async () => {
        try {
            setBulkBusy(true);
            const result = await mediaCollectionsApi.bulkDelete(deleteTargets.map(collection => collection.id), deleteFiles, namespace)();
            addNotification(`Moved ${result.deletedCount ?? deleteTargets.length} collection(s) to Trash`, 'success');

            // Refresh collections
            await loadCollections();

            setShowDeleteModal(false);
            setSelectedCollection(null);
            setDeleteTargets([]);
        } catch (error) {
            console.error('Failed to delete collection:', error);
            addNotification(extractErrorMessage(error), 'error');
        } finally {
            setBulkBusy(false);
        }
    };

    // Get access level icon and color
    const getAccessLevelInfo = (accessLevel) => {
        switch (accessLevel) {
            case 'public':
                return { icon: Globe, color: 'text-green-600', label: 'Public' };
            case 'members':
                return { icon: Users, color: 'text-blue-600', label: 'Members' };
            case 'staff':
                return { icon: Shield, color: 'text-purple-600', label: 'Staff' };
            case 'private':
                return { icon: Lock, color: 'text-red-600', label: 'Private' };
            default:
                return { icon: Globe, color: 'text-gray-600', label: 'Unknown' };
        }
    };

    // Format date with error handling
    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Render inline form for creating new collection
    const renderInlineForm = () => {
        return (
            <div className="bg-white rounded-lg border-2 border-blue-300 border-dashed shadow-sm">
                <form onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit(false);
                }} className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                            <Plus className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <div className="text-lg font-semibold text-gray-900 mb-1" role="heading" aria-level="3">
                                New Collection
                            </div>
                            <div className="text-sm text-gray-600">
                                Enter a title and optionally add tags
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Title *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                placeholder="Enter collection title..."
                                autoFocus
                            />
                        </div>

                        <ClassificationPicker value={formData.classificationIds || []}
                            onChange={(ids) => setFormData(prev => ({ ...prev, classificationIds: ids }))}
                            namespace={namespace} use="media_collections" />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={handleCancelInlineForm}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !formData.title.trim()}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Create
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        );
    };

    // Helper function to determine grid layout based on file count
    const getGridLayout = (fileCount) => {
        if (fileCount === 1) return { cols: 1, rows: 1, maxImages: 1 };
        if (fileCount <= 6) return { cols: 3, rows: 2, maxImages: 6 };
        if (fileCount <= 12) return { cols: 4, rows: 3, maxImages: 12 };
        return { cols: 6, rows: 4, maxImages: 24 };
    };

    // Helper function to get image files from collection
    const getImageFiles = (collection) => {
        if (!collection.sampleImages || !Array.isArray(collection.sampleImages)) return [];
        const layout = getGridLayout(collection.fileCount || 0);
        return collection.sampleImages.slice(0, layout.maxImages);
    };

    // Render thumbnail grid as top section
    const renderThumbnailGrid = (collection) => {
        const imageFiles = getImageFiles(collection);
        const layout = getGridLayout(collection.fileCount || 0);

        if (imageFiles.length === 0) {
            return (
                <div className="h-32 bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center rounded-t-lg">
                    <div className="text-center">
                        <Folder className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <div className="text-sm text-gray-500">No images</div>
                    </div>
                </div>
            );
        }

        // Fill empty slots with repeated images if we have fewer images than grid slots
        const filledImages = [];
        for (let i = 0; i < layout.maxImages; i++) {
            if (imageFiles[i]) {
                filledImages.push(imageFiles[i]);
            } else if (imageFiles.length > 0) {
                filledImages.push(imageFiles[i % imageFiles.length]);
            }
        }

        return (
            <div className="h-32 overflow-hidden rounded-t-lg bg-gray-100">
                <div
                    className="h-full w-full"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                        gap: '1px'
                    }}
                >
                    {filledImages.map((file, index) => (
                        <div key={`${file.id}-${index}`} className="relative overflow-hidden bg-gray-200"
                            onContextMenu={event => {
                                if (showTrash) return;
                                event.preventDefault();
                                event.stopPropagation();
                                setVersionMenu({ file, x: event.clientX, y: event.clientY });
                            }}>
                            <OptimizedImage
                                src={file.imgproxyBaseUrl || file.imgproxy_base_url || file.thumbnailUrl || file.thumbnail_url}
                                alt=""
                                width={136}
                                height={84}
                                resizeType="fit"
                                fillContainer
                                focalPoint={file.focalPoint || file.focal_point || { x: 0.5, y: 0.5 }}
                                className="h-full w-full object-cover"
                                fallback={<div className="h-full w-full bg-gray-200" />}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Render collection list item (no image grid)
    const renderCollectionListItem = (collection) => {
        const accessInfo = getAccessLevelInfo(collection.accessLevel);
        const AccessIcon = accessInfo.icon;

        return (
            <div
                key={collection.id} 
                className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 p-4 cursor-pointer"
                onClick={() => { if (!showTrash) handleEdit(collection); }}
            >
                <div className="flex items-start justify-between">
                    <input
                        type="checkbox"
                        aria-label={`Select ${collection.title}`}
                        checked={selectedCollectionIds.includes(collection.id)}
                        disabled={selectedCollectionIds.length >= 100 && !selectedCollectionIds.includes(collection.id)}
                        onChange={() => toggleCollectionSelection(collection.id)}
                        onClick={event => event.stopPropagation()}
                        className="mr-3 mt-1 h-4 w-4 accent-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Folder className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-lg font-semibold text-gray-900 truncate" role="heading" aria-level="3">
                                    {collection.title}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <FileText className="w-3.5 h-3.5" />
                                        {collection.fileCount || 0} files
                                    </span>
                                    <span className={`flex items-center gap-1 ${accessInfo.color}`}>
                                        <AccessIcon className="w-3.5 h-3.5" />
                                        {accessInfo.label}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        Created {formatDate(collection.createdAt)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        {collection.description && (
                            <div className="text-sm text-gray-600 line-clamp-2 ml-13">
                                {collection.description}
                            </div>
                        )}

                        {/* Tags */}
                        {collection.tags && collection.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 ml-13">
                                {collection.tags.slice(0, 3).map((tag) => (
                                    <span
                                        key={tag.id}
                                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                    >
                                        {tag.name}
                                    </span>
                                ))}
                                {collection.tags.length > 3 && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                        +{collection.tags.length - 3} more
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 ml-4">
                        {showTrash ? (
                            <button
                                type="button"
                                disabled={bulkBusy}
                                onClick={event => { event.stopPropagation(); restoreCollections([collection]); }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                                aria-label={`Restore ${collection.title}`}
                                title={`Restore ${collection.title}`}
                            >Restore</button>
                        ) : <>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadZip(collection);
                            }}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Download as ZIP"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(collection);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="Edit Collection"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(collection);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete Collection"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        </>}
                    </div>
                </div>
            </div>
        );
    };

    // Render collection card (with image grid for grid view)
    const renderCollectionCard = (collection) => {
        const accessInfo = getAccessLevelInfo(collection.accessLevel);
        const AccessIcon = accessInfo.icon;

        return (
            <div
                key={collection.id} 
                className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer"
                onClick={() => { if (!showTrash) handleEdit(collection); }}
            >
                {/* Thumbnail Grid - Top Section */}
                {renderThumbnailGrid(collection)}

                {/* Content - Bottom Section */}
                <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                        <input
                            type="checkbox"
                            aria-label={`Select ${collection.title}`}
                            checked={selectedCollectionIds.includes(collection.id)}
                            disabled={selectedCollectionIds.length >= 100 && !selectedCollectionIds.includes(collection.id)}
                            onChange={() => toggleCollectionSelection(collection.id)}
                            onClick={event => event.stopPropagation()}
                            className="mr-3 mt-1 h-4 w-4 accent-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-lg font-semibold text-gray-900 truncate mb-1" role="heading" aria-level="3">
                                {collection.title}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                    <FileText className="w-3.5 h-3.5" />
                                    {collection.fileCount || 0} files
                                </span>
                                <span className={`flex items-center gap-1 ${accessInfo.color}`}>
                                    <AccessIcon className="w-3.5 h-3.5" />
                                    {accessInfo.label}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                            {showTrash ? (
                                <button
                                    type="button"
                                    disabled={bulkBusy}
                                    onClick={event => { event.stopPropagation(); restoreCollections([collection]); }}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                                    aria-label={`Restore ${collection.title}`}
                                    title={`Restore ${collection.title}`}
                                >Restore</button>
                            ) : <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadZip(collection);
                                }}
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Download as ZIP"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(collection);
                                }}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="Edit Collection"
                            >
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(collection);
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete Collection"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            </>}
                        </div>
                    </div>

                    {/* Description */}
                    {collection.description && (
                        <div className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {collection.description}
                        </div>
                    )}

                    {/* Tags */}
                    {collection.tags && collection.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                            {collection.tags.slice(0, 3).map((tag) => (
                                <span
                                    key={tag.id}
                                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                >
                                    {tag.name}
                                </span>
                            ))}
                            {collection.tags.length > 3 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                    +{collection.tags.length - 3} more
                                </span>
                            )}
                        </div>
                    )}

                    {/* Metadata */}
                    <div className="pt-3 border-t border-gray-100">
                        <div className="text-xs text-gray-500 text-center">
                            Created {formatDate(collection.createdAt)}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!namespace) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <div className="text-gray-600">Please select a namespace to manage collections</div>
                </div>
            </div>
        );
    }

    const emptyCollectionCount = collections.filter(collection =>
        (collection.fileCount ?? collection.file_count ?? 0) === 0
    ).length;
    const visibleCollections = showTrash || showEmptyCollections
        ? collections
        : collections.filter(collection => (collection.fileCount ?? collection.file_count ?? 0) > 0);

    // Conditional rendering based on current view
    // Both 'files' and 'edit' views now use the unified CollectionEditorView
    if ((currentView === 'files' && viewingCollection) || (currentView === 'edit' && editingCollection)) {
        const collection = viewingCollection || editingCollection;
        return (
            <CollectionEditorView
                collection={collection}
                namespace={namespace}
                onBack={handleBackToCollections}
                onSave={() => {
                    handleBackToCollections();
                    loadCollections(); // Refresh the collections list
                }}
            />
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-2xl font-bold text-gray-900" role="heading" aria-level="2">Media Collections</div>
                        <div className="text-gray-600 mt-1">Organize your media files into collections</div>
                    </div>

                    {!showInlineForm && !showTrash && (
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            New Collection
                        </button>
                    )}
                </div>
            </div>

            {/* Search and Controls */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex gap-4 border-b border-gray-200 mb-4" role="tablist" aria-label="Collection view">
                    <button id="collections-tab" aria-controls="collection-results" type="button" role="tab" aria-selected={!showTrash} tabIndex={showTrash ? -1 : 0} onKeyDown={handleViewTabKeyDown} onClick={() => setShowTrash(false)} className={`pb-2 text-sm ${!showTrash ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}>Collections</button>
                    <button id="collections-trash-tab" aria-controls="collection-results" type="button" role="tab" aria-selected={showTrash} tabIndex={showTrash ? 0 : -1} onKeyDown={handleViewTabKeyDown} onClick={() => setShowTrash(true)} className={`pb-2 text-sm ${showTrash ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}>Trash</button>
                </div>
                {showTrash && <p className="mb-3 text-xs text-gray-600">Restoring a collection keeps its original memberships. Restore deleted files separately from Media Library → Trash.</p>}
                <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search collections..."
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {!showTrash && <label className="inline-flex items-center gap-2 text-xs text-gray-700 whitespace-nowrap cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showEmptyCollections}
                                onChange={event => setShowEmptyCollections(event.target.checked)}
                                className="h-4 w-4 accent-blue-600"
                            />
                            Show empty collections{emptyCollectionCount > 0 ? ` (${emptyCollectionCount})` : ''}
                        </label>}
                        {/* View Mode Toggle */}
                        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2.5 transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                title="Grid view"
                            >
                                <Grid3X3 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2.5 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                                title="List view"
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Sort */}
                        <div className="relative">
                            <select
                                value={`${sortBy}-${sortOrder}`}
                                onChange={(e) => {
                                    const [field, order] = e.target.value.split('-');
                                    setSortBy(field);
                                    setSortOrder(order);
                                }}
                                className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2.5 pr-8 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[160px]"
                            >
                                <option value="updated_at-desc">Recently Updated</option>
                                <option value="created_at-desc">Recently Created</option>
                                <option value="title-asc">Title A-Z</option>
                                <option value="title-desc">Title Z-A</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                    </div>
                </div>
                {visibleCollections.length > 0 && <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                    <button type="button" onClick={() => setSelectedCollectionIds(visibleCollections.slice(0, 100).map(collection => collection.id))} className="text-blue-600 underline">{visibleCollections.length > 100 ? 'Select first 100' : 'Select all visible'}</button>
                    {selectedCollectionIds.length > 0 && <>
                        <span>{selectedCollectionIds.length} selected</span>
                        {visibleCollections.length > 100 && <span className="text-gray-500">100 per batch</span>}
                        <button type="button" onClick={() => setSelectedCollectionIds([])} className="text-gray-600 underline">Clear selection</button>
                        {showTrash ? (
                            <button type="button" disabled={bulkBusy} onClick={() => restoreCollections(collections.filter(collection => selectedCollectionIds.includes(collection.id)))} className="px-3 py-1.5 rounded bg-blue-600 text-white disabled:opacity-50">Restore selected</button>
                        ) : (
                            <button type="button" disabled={bulkBusy} onClick={() => { setDeleteTargets(collections.filter(collection => selectedCollectionIds.includes(collection.id))); setDeleteFiles(false); setShowDeleteModal(true); }} className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50">Delete selected</button>
                        )}
                    </>}
                </div>}
            </div>

            {/* Main Content Area */}
            <div id="collection-results" role="tabpanel" aria-labelledby={showTrash ? 'collections-trash-tab' : 'collections-tab'} className="flex-1 overflow-auto">
                <div className="p-6">
                    {/* Loading State */}
                    {loading && (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                                <div className="text-gray-600">Loading collections...</div>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                            <div className="flex items-center gap-3 text-red-800 mb-3">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span className="font-medium">Error loading collections</span>
                            </div>
                            <div className="text-red-700 mb-4">{error}</div>
                            <button
                                onClick={loadCollections}
                                className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors font-medium"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* Collections Grid/List */}
                    {!loading && !error && (
                        <>
                            {visibleCollections.length === 0 && !showInlineForm ? (
                                <div className="text-center py-16">
                                    <div className="bg-white rounded-lg p-8 max-w-md mx-auto">
                                        <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <div className="text-lg font-medium text-gray-900 mb-2" role="heading" aria-level="3">
                                            {showTrash ? 'Trash is empty' : collections.length > 0 && !showEmptyCollections ? 'No visible collections' : 'No collections found'}
                                        </div>
                                        <div className="text-gray-600 mb-6">
                                            {showTrash ? 'Deleted collections will appear here.' : collections.length > 0 && !showEmptyCollections
                                                ? 'Empty collections are hidden. Select Show empty collections to see them.'
                                                : searchQuery ? 'No collections match your search criteria.' : 'Get started by creating your first collection.'}
                                        </div>
                                        {!showTrash && !searchQuery && collections.length === 0 && (
                                            <button
                                                onClick={handleCreate}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Create Collection
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className={
                                    viewMode === 'grid'
                                        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                                        : 'space-y-4'
                                }>
                                    {/* Inline form for new collection */}
                                    {showInlineForm && renderInlineForm()}

                                    {/* Existing collections */}
                                    {visibleCollections.map(collection =>
                                        viewMode === 'grid'
                                            ? renderCollectionCard(collection)
                                            : renderCollectionListItem(collection)
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="flex h-[min(85dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div className="text-xl font-semibold text-gray-900" role="heading" aria-level="3">
                                    Edit Collection
                                </div>
                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        resetForm();
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="min-h-0 flex-1 overflow-y-auto p-6">
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                handleSubmit(true);
                            }} className="space-y-6">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Title *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                        placeholder="Enter collection title..."
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        rows={4}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                                        placeholder="Optional description..."
                                    />
                                </div>

                                {/* Tags */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Tags
                                    </label>
                                    <div className="border border-gray-300 rounded-lg p-3">
                                        <ClassificationPicker value={formData.classificationIds || []}
                                    onChange={(ids) => setFormData(prev => ({ ...prev, classificationIds: ids }))}
                                    namespace={namespace} use="media_collections" />
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowEditModal(false);
                                    resetForm();
                                }}
                                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSubmit(true)}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && deleteTargets.length > 0 && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
                        <div className="p-6">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <AlertCircle className="w-6 h-6 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-lg font-semibold text-gray-900 mb-1" role="heading" aria-level="3">Delete Collection</div>
                                    <div className="text-sm text-gray-600">You can restore these items from Trash.</div>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                <div className="text-gray-700 leading-relaxed">
                                    Move {deleteTargets.length === 1 ? <span className="font-medium">"{deleteTargets[0].title}"</span> : <span className="font-medium">{deleteTargets.length} collections</span>} to Trash?
                                </div>
                                <div className="text-sm text-gray-600 mt-2">
                                    Collection memberships are kept for restoration.
                                </div>
                            </div>

                            <label className="flex items-start gap-2 text-sm text-gray-700 mb-6">
                                <input type="checkbox" checked={deleteFiles} onChange={event => setDeleteFiles(event.target.checked)} className="mt-0.5 h-4 w-4 accent-red-600" />
                                <span>Also move their media files to Trash. Files shared with other collections or used elsewhere cannot be deleted this way.</span>
                            </label>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setSelectedCollection(null);
                                        setDeleteTargets([]);
                                    }}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={bulkBusy}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm disabled:opacity-50"
                                >
                                    Move to Trash
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ImageVersionContextMenu position={versionMenu} onClose={() => setVersionMenu(null)}
                onUpload={() => { setVersionUploadFile(versionMenu.file); setVersionMenu(null) }} />
            {versionUploadFile && <ImageVersionUploadDialog file={versionUploadFile} namespace={namespace}
                onClose={() => setVersionUploadFile(null)} onUploaded={loadCollections} />}


        </div>
    );
};

export default MediaCollectionManager;
