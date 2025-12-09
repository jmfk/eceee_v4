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
import MediaTagWidget from './MediaTagWidget';
import MediaSearchWidget from './MediaSearchWidget';
import { extractErrorMessage } from '../../utils/errorHandling';

// Compact Tag Input Component for inline forms
const CompactTagInput = ({ namespace, selectedTagIds = [], onTagsChange, availableTags = [] }) => {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Get selected tag objects from IDs
    const selectedTags = selectedTagIds.map(id =>
        availableTags.find(tag => tag.id === id)
    ).filter(Boolean);

    // Filter available tags for suggestions
    const suggestions = availableTags.filter(tag =>
        !selectedTagIds.includes(tag.id) &&
        tag.name.toLowerCase().includes(inputValue.toLowerCase())
    ).slice(0, 5); // Limit to 5 suggestions

    const addTag = (tag) => {
        if (!selectedTagIds.includes(tag.id)) {
            onTagsChange([...selectedTagIds, tag.id]);
        }
        setInputValue('');
        setShowSuggestions(false);
    };

    const removeTag = (tagId) => {
        onTagsChange(selectedTagIds.filter(id => id !== tagId));
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);
        setShowSuggestions(value.trim().length > 0);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            setInputValue('');
        } else if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            if (suggestions.length > 0) {
                addTag(suggestions[0]); // Add first suggestion on Enter
            } else {
                // Create new tag if no suggestions exist
                const newTag = { id: `new-${Date.now()}`, name: inputValue.trim() };
                addTag(newTag);
            }
        }
    };

    // Handle click outside to close suggestions
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target) &&
                inputRef.current &&
                !inputRef.current.contains(event.target)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-2">
            {/* Selected Tags */}
            {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {selectedTags.map((tag) => (
                        <span
                            key={tag.id}
                            className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                        >
                            {tag.name}
                            <button
                                type="button"
                                onClick={() => removeTag(tag.id)}
                                className="ml-1 text-blue-600 hover:text-blue-800"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Tag Input */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => inputValue.trim() && setShowSuggestions(true)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Type to search existing tags..."
                />

                {/* Suggestions Dropdown */}
                {showSuggestions && inputValue.trim() && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-32 overflow-y-auto"
                    >
                        {suggestions.length > 0 ? (
                            suggestions.map((tag) => (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => addTag(tag)}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
                                >
                                    <Tag className="w-3 h-3 mr-2 text-gray-400" />
                                    <span>{tag.name}</span>
                                    {tag.usageCount > 0 && (
                                        <span className="ml-auto text-xs text-gray-500">
                                            {tag.usageCount}
                                        </span>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                No existing tags found. Press Enter to create "{inputValue}"
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};



// Unified Collection Editor View Component (metadata + upload + files)
const CollectionEditorView = ({ collection, namespace, onBack, onSave }) => {
    // Form data for metadata
    const [formData, setFormData] = useState({
        title: collection.title,
        description: collection.description || '',
        accessLevel: 'public',
        tagIds: collection.tags?.map(tag => tag.id) || []
    });
    const [availableTags, setAvailableTags] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [metadataExpanded, setMetadataExpanded] = useState(true);

    // Upload state
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);

    // Collection Files View State (from old CollectionFilesView)
    const [existingFiles, setExistingFiles] = useState([]);
    const [existingLoading, setExistingLoading] = useState(true);
    const [existingError, setExistingError] = useState(null);
    const [viewMode, setViewMode] = useState('grid');

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

            const params = { page_size: 100 };
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
                tag_ids: formData.tagIds
            };

            await mediaCollectionsApi.update(collection.id, updateData)();
            addNotification('Collection updated successfully', 'success');
            if (onSave) onSave();
        } catch (error) {
            console.error('Failed to update collection:', error);
            addNotification(extractErrorMessage(error), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // File upload handlers
    const handleFileSelect = useCallback((files) => {
        const fileArray = Array.from(files);
        setSelectedFiles(fileArray);
    }, []);

    const handleFileInputChange = (event) => {
        handleFileSelect(event.target.files);
    };

    const handleDrop = useCallback((event) => {
        event.preventDefault();
        setIsDragOver(false);
        handleFileSelect(event.dataTransfer.files);
    }, [handleFileSelect]);

    const handleDragOver = useCallback((event) => {
        event.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((event) => {
        event.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleRemoveSelectedFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) return;

        try {
            setUploading(true);
            setUploadProgress(0);

            const result = await mediaCollectionsApi.uploadFiles(
                collection.id,
                selectedFiles,
                (progress) => setUploadProgress(progress)
            )();

            addNotification(
                `Successfully uploaded ${result.uploadedCount || 0} file(s)`,
                'success'
            );

            // Clear selected files and reload collection files
            setSelectedFiles([]);
            setUploadProgress(0);
            await loadExistingFiles();
        } catch (error) {
            console.error('Upload error:', error);
            addNotification(extractErrorMessage(error), 'error');
        } finally {
            setUploading(false);
        }
    };

    // Handle removing a file from collection
    const handleRemoveFile = async (fileId) => {
        try {
            await mediaCollectionsApi.removeFiles(collection.id, [fileId])();
            addNotification('File removed from collection', 'success');
            await loadExistingFiles();
        } catch (error) {
            console.error('Failed to remove file from collection:', error);
            addNotification('Failed to remove file from collection', 'error');
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
        
        return (
            <div key={file.id} className="relative bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow group">
                {file.fileType === 'image' && file.thumbnailUrl ? (
                    <div className="aspect-square bg-gray-100 overflow-hidden">
                        <img 
                            src={file.thumbnailUrl} 
                            alt={file.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <div className="aspect-square bg-gray-50 flex items-center justify-center">
                        <FileIcon className="w-12 h-12 text-gray-400" />
                    </div>
                )}
                <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 truncate" title={file.title}>
                        {file.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {formatFileSize(file.fileSize)}
                    </p>
                </div>
                <button
                    onClick={() => handleRemoveFile(file.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                    title="Remove from collection"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    };

    const canUpload = formData.tagIds.length > 0;

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
                            <h2 className="text-xl font-semibold text-gray-900">Edit Collection</h2>
                            <p className="text-sm text-gray-600 mt-0.5">{collection.title}</p>
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
                            <h3 className="text-lg font-semibold text-gray-900">Collection Details</h3>
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

                                {/* Tags Field */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Tags * <span className="text-xs text-gray-500">(Required for uploads)</span>
                                    </label>
                                    <MediaTagWidget
                                        tags={formData.tagIds
                                            .map(id => availableTags.find(tag => tag.id === id))
                                            .filter(Boolean)
                                        }
                                        onChange={(tagObjects) => {
                                            const tagIds = tagObjects.map(tag => tag.id);
                                            setFormData(prev => ({ ...prev, tagIds }));
                                        }}
                                        namespace={namespace}
                                    />
                                </div>

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

                    {/* Upload Section */}
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Files</h3>
                        
                        {!canUpload ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-900">Upload Disabled</p>
                                        <p className="text-sm text-amber-700 mt-1">
                                            Please add at least one tag to this collection before uploading files.
                                            Files uploaded to a collection automatically inherit all collection tags.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div
                                    className={`
                                        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
                                        ${isDragOver
                                            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                                            : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                                        }
                                        ${uploading ? 'pointer-events-none opacity-50' : ''}
                                    `}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                    <p className="text-sm text-gray-700 mb-1">
                                        Drag and drop files here, or click to browse
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Files will be auto-approved with collection tags
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/*,application/pdf,.doc,.docx,video/*,audio/*"
                                        onChange={handleFileInputChange}
                                        className="hidden"
                                        disabled={uploading}
                                    />
                                </div>

                                {selectedFiles.length > 0 && (
                                    <div className="mt-4 space-y-2">
                                        <p className="text-sm font-medium text-gray-700">
                                            Selected Files ({selectedFiles.length})
                                        </p>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {selectedFiles.map((file, index) => (
                                                <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                                                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                                    <button
                                                        onClick={() => handleRemoveSelectedFile(index)}
                                                        className="text-red-600 hover:text-red-700"
                                                        disabled={uploading}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {uploading ? (
                                            <div className="mt-4">
                                                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                                                    <span>Uploading...</span>
                                                    <span>{uploadProgress}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div 
                                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={handleUpload}
                                                className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Upload className="w-4 h-4" />
                                                Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Collection Files Section */}
                    <div className="bg-white rounded-lg border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Files in Collection</h3>
                                <p className="text-sm text-gray-600 mt-0.5">{existingFiles.length} files</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
                                >
                                    <Grid3X3 className="w-4 h-4" />
                                </button>
                                <button
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
                                    <p className="text-red-700 text-sm mt-1">{existingError}</p>
                                </div>
                            ) : existingFiles.length === 0 ? (
                                <div className="text-center py-12">
                                    <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <h4 className="text-sm font-medium text-gray-900 mb-1">No files in collection</h4>
                                    <p className="text-sm text-gray-600">
                                        {canUpload ? 'Upload files using the form above.' : 'Add tags to enable uploads.'}
                                    </p>
                                </div>
                            ) : (
                                <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-2'}>
                                    {existingFiles.map(file => renderFileCard(file))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
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

                // Use the dedicated endpoint to get files in this collection
                const params = {
                    page_size: 100
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
            await mediaCollectionsApi.removeFiles(collection.id, [fileId])();
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
            await mediaCollectionsApi.addFiles(collection.id, [fileId])();
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

            // Reload existing files using the dedicated endpoint
            const existingParams = {
                page_size: 100
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
                            className="w-full h-full object-cover"
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
                    <h4 className="text-xs font-medium text-gray-900 truncate mb-1">
                        {file.title || file.originalFilename}
                    </h4>
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
                            className="w-full h-full object-cover"
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
                    <h4 className="text-xs font-medium text-gray-900 truncate">
                        {file.title || file.originalFilename}
                    </h4>
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
                            className="w-full h-full object-cover"
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
                    <h4 className="text-xs font-medium text-gray-900 truncate mb-1">
                        {file.title || file.originalFilename}
                    </h4>
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
                            className="w-full h-full object-cover"
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
                    <h4 className="text-xs font-medium text-gray-900 truncate">
                        {file.title || file.originalFilename}
                    </h4>
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
                            <h2 className="text-2xl font-bold text-gray-900">{collection.title}</h2>
                            <p className="text-gray-600 mt-1">
                                {existingFiles.length} files in collection • {availableFiles.length} available to add
                            </p>
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
                    <h3 className="text-lg font-semibold text-gray-900">Available Files</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        {availableFiles.length} files available to add • Click + to add
                    </p>
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
                                <h3 className="text-lg font-semibold text-gray-900">Files in Collection</h3>
                                <p className="text-sm text-gray-600 mt-1">{existingFiles.length} files</p>
                            </div>
                            <div className="p-4 flex-1 overflow-auto">
                                {existingLoading && (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="text-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600">Loading existing files...</p>
                                        </div>
                                    </div>
                                )}

                                {existingError && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                        <div className="flex items-center gap-2 text-red-800 mb-2">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            <span className="font-medium text-sm">Error loading existing files</span>
                                        </div>
                                        <p className="text-red-700 text-sm">{existingError}</p>
                                    </div>
                                )}

                                {!existingLoading && !existingError && (
                                    <>
                                        {existingFiles.length === 0 ? (
                                            <div className="text-center py-8">
                                                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                                <h4 className="text-sm font-medium text-gray-900 mb-1">No files in collection</h4>
                                                <p className="text-sm text-gray-600">Add files from the right panel to get started.</p>
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
                                <h3 className="text-lg font-semibold text-gray-900">Available Files</h3>
                                <p className="text-sm text-gray-600 mt-1">Click + to add files or × to remove</p>
                            </div>
                            <div className="p-4 flex-1 overflow-auto">
                                {availableLoading && (
                                    <div className="flex items-center justify-center h-32">
                                        <div className="text-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600">Loading available files...</p>
                                        </div>
                                    </div>
                                )}

                                {availableError && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                        <div className="flex items-center gap-2 text-red-800 mb-2">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            <span className="font-medium text-sm">Error loading available files</span>
                                        </div>
                                        <p className="text-red-700 text-sm">{availableError}</p>
                                    </div>
                                )}

                                {!availableLoading && !availableError && (
                                    <>
                                        {availableFiles.length === 0 ? (
                                            <div className="text-center py-8">
                                                <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                                <h4 className="text-sm font-medium text-gray-900 mb-1">
                                                    {searchTerms.length > 0 || selectedFileType
                                                        ? 'No files match your filters'
                                                        : 'No files available to add'
                                                    }
                                                </h4>
                                                <p className="text-sm text-gray-600">
                                                    {searchTerms.length > 0 || selectedFileType
                                                        ? 'Try adjusting your search criteria or clearing the filters.'
                                                        : 'All files are already in this collection.'
                                                    }
                                                </p>
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
                tag_ids: formData.tagIds
            };

            await mediaCollectionsApi.update(collection.id, updateData)();
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
                            <h2 className="text-2xl font-bold text-gray-900">Edit Collection</h2>
                            <p className="text-gray-600 mt-1">Update collection details</p>
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
                                <MediaTagWidget
                                    selectedTagIds={formData.tagIds}
                                    onChange={(tagIds) => setFormData(prev => ({ ...prev, tagIds }))}
                                    availableTags={availableTags}
                                    namespace={namespace}
                                />
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

const MediaCollectionManager = ({ namespace, onCollectionSelect }) => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('updated_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

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

            const result = await mediaCollectionsApi.list(params)();
            const collectionsData = result.results || result || [];
            setCollections(Array.isArray(collectionsData) ? collectionsData : []);
        } catch (error) {
            console.error('Failed to load collections:', error);
            setError(extractErrorMessage(error));
            setCollections([]); // Ensure collections is always an array
            addNotification('Failed to load collections', 'error');
        } finally {
            setLoading(false);
        }
    }, [namespace, searchQuery, sortBy, sortOrder, filters, addNotification]);

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
            tagIds: []
        });
    };

    // Handle create collection
    const handleCreate = () => {
        resetForm();
        setShowInlineForm(true);
    };

    // Handle edit collection
    const handleEdit = (collection) => {
        setEditingCollection(collection);
        setFormData({
            title: collection.title,
            description: collection.description || '',
            accessLevel: 'public', // Keep default for backend compatibility
            tagIds: collection.tags?.map(tag => tag.id) || []
        });
        setCurrentView('edit');
    };

    // Handle delete collection
    const handleDelete = (collection) => {
        setSelectedCollection(collection);
        setShowDeleteModal(true);
    };
    
    // Handle download collection as ZIP
    const handleDownloadZip = async (collection) => {
        try {
            const blob = await mediaCollectionsApi.downloadZip(collection.id)();
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
    };

    // Submit create/edit form
    const handleSubmit = async (isEdit = false) => {
        // Validate required fields
        if (!formData.title.trim()) {
            addNotification('Collection title is required', 'error');
            return;
        }

        if (!formData.tagIds || formData.tagIds.length === 0) {
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
                    tag_ids: formData.tagIds
                };
            } else {
                // For creating, only send essential fields (let backend generate slug)
                collectionData = {
                    title: formData.title,
                    namespace: namespace,
                    tag_ids: formData.tagIds
                };
            }

            let result;
            if (isEdit) {
                result = await mediaCollectionsApi.update(selectedCollection.id, collectionData)();
                addNotification('Collection updated successfully', 'success');
            } else {
                result = await mediaCollectionsApi.create(collectionData)();
                addNotification('Collection created successfully', 'success');
            }

            // Refresh collections
            await loadCollections();

            // Close forms
            setShowInlineForm(false);
            setShowEditModal(false);
            resetForm();
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
            await mediaCollectionsApi.delete(selectedCollection.id)();
            addNotification('Collection deleted successfully', 'success');

            // Refresh collections
            await loadCollections();

            setShowDeleteModal(false);
            setSelectedCollection(null);
        } catch (error) {
            console.error('Failed to delete collection:', error);
            addNotification(extractErrorMessage(error), 'error');
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
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                New Collection
                            </h3>
                            <p className="text-sm text-gray-600">
                                Enter a title and optionally add tags
                            </p>
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

                        {/* Tags */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tags * <span className="text-xs text-gray-500">(Required)</span>
                            </label>
                            <CompactTagInput
                                namespace={namespace}
                                selectedTagIds={formData.tagIds}
                                onTagsChange={(tagIds) => setFormData(prev => ({ ...prev, tagIds }))}
                                availableTags={availableTags}
                            />
                            {formData.tagIds.length === 0 && (
                                <p className="text-xs text-amber-600 mt-1">
                                    At least one tag is required to enable file uploads
                                </p>
                            )}
                        </div>
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
                        <p className="text-sm text-gray-500">No images</p>
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
                        <div key={`${file.id}-${index}`} className="relative overflow-hidden bg-gray-200">
                            <img
                                src={file.thumbnailUrl || file.thumbnail_url || file.imgproxyBaseUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                style={{ display: 'block' }}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
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
            <div key={collection.id} className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 p-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Folder className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-gray-900 truncate">
                                    {collection.title}
                                </h3>
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
                            <p className="text-sm text-gray-600 line-clamp-2 ml-13">
                                {collection.description}
                            </p>
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
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleViewFiles(collection);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View Files"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
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
            <div key={collection.id} className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-200 overflow-hidden">
                {/* Thumbnail Grid - Top Section */}
                {renderThumbnailGrid(collection)}

                {/* Content - Bottom Section */}
                <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 truncate mb-1">
                                {collection.title}
                            </h3>
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
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewFiles(collection);
                                }}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="View Files"
                            >
                                <Eye className="w-4 h-4" />
                            </button>
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
                        </div>
                    </div>

                    {/* Description */}
                    {collection.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                            {collection.description}
                        </p>
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
                    <p className="text-gray-600">Please select a namespace to manage collections</p>
                </div>
            </div>
        );
    }

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
                        <h2 className="text-2xl font-bold text-gray-900">Media Collections</h2>
                        <p className="text-gray-600 mt-1">Organize your media files into collections</p>
                    </div>

                    {!showInlineForm && (
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

                    <div className="flex items-center gap-3">
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
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-auto">
                <div className="p-6">
                    {/* Loading State */}
                    {loading && (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                                <p className="text-gray-600">Loading collections...</p>
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
                            <p className="text-red-700 mb-4">{error}</p>
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
                            {collections.length === 0 && !showInlineForm ? (
                                <div className="text-center py-16">
                                    <div className="bg-white rounded-lg p-8 max-w-md mx-auto">
                                        <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No collections found</h3>
                                        <p className="text-gray-600 mb-6">
                                            {searchQuery ? 'No collections match your search criteria.' : 'Get started by creating your first collection.'}
                                        </p>
                                        {!searchQuery && (
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
                                    {Array.isArray(collections) && collections.map(collection =>
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
                    <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-semibold text-gray-900">
                                    Edit Collection
                                </h3>
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
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
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
                                        <MediaTagWidget
                                            namespace={namespace}
                                            selectedTags={formData.tagIds}
                                            onTagsChange={(tagIds) => setFormData(prev => ({ ...prev, tagIds }))}
                                            availableTags={availableTags}
                                            onTagsUpdate={loadAvailableTags}
                                        />
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
            {showDeleteModal && selectedCollection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
                        <div className="p-6">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <AlertCircle className="w-6 h-6 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete Collection</h3>
                                    <p className="text-sm text-gray-600">This action cannot be undone</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                <p className="text-gray-700 leading-relaxed">
                                    Are you sure you want to delete the collection <span className="font-medium">"{selectedCollection.title}"</span>?
                                </p>
                                <p className="text-sm text-gray-600 mt-2">
                                    This will remove the collection but not the files in it.
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setSelectedCollection(null);
                                    }}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm"
                                >
                                    Delete Collection
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
};

export default MediaCollectionManager;
