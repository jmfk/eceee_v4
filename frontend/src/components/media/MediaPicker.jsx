/**
 * MediaPicker Component
 * 
 * Reusable component for selecting media files in:
 * - Widget editors (ImageEditor, GalleryEditor)
 * - PageData forms
 * - Content creation
 * 
 * Features:
 * - Modal or inline picker modes
 * - Search and filter capabilities
 * - Preview and selection
 * - Recent files shortcuts
 * - Multiple selection support
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Search,
    Filter,
    Grid3X3,
    List,
    X,
    Check,
    Upload,
    Image as ImageIcon,
    FileText,
    Video,
    Music,
    Archive,
    File,
    Eye,
    Download,
    Clock,
    Tag,
    Folder,
    ChevronDown,
    Loader2
} from 'lucide-react';
import { mediaApi, mediaTagsApi, mediaCollectionsApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';

const MediaPicker = ({
    mode = 'modal', // 'modal' | 'inline'
    multiple = false,
    fileTypes = [], // Filter by file types: ['image', 'document', 'video', 'audio']
    namespace,
    selectedFiles = [],
    onSelect,
    onClose,
    onUpload,
    className = '',
    maxSelection = 10
}) => {
    const [isOpen, setIsOpen] = useState(mode === 'inline');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
    const [searchQuery, setSearchQuery] = useState('');
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedFileIds, setSelectedFileIds] = useState(new Set(selectedFiles.map(f => f.id)));
    const [filters, setFilters] = useState({
        fileType: '',
        tags: [],
        collections: [],
        accessLevel: '',
        dateRange: ''
    });
    const [showFilters, setShowFilters] = useState(false);
    const [availableTags, setAvailableTags] = useState([]);
    const [availableCollections, setAvailableCollections] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 20,
        total: 0,
        hasNext: false
    });

    const { addNotification } = useGlobalNotifications();

    // Load files
    const loadFiles = useCallback(async (page = 1, append = false) => {
        if (!namespace) return;

        setLoading(true);
        try {
            const params = {
                page,
                pageSize: pagination.pageSize,
                namespace,
                search: searchQuery || undefined,
                fileType: filters.fileType || undefined,
                accessLevel: filters.accessLevel || undefined,
                ordering: '-created_at'
            };

            // Add file type filters
            if (fileTypes.length > 0) {
                params.fileType = fileTypes.join(',');
            }

            // Add tag filters
            if (filters.tags.length > 0) {
                params.tags = filters.tags.join(',');
            }

            // Add collection filters
            if (filters.collections.length > 0) {
                params.collections = filters.collections.join(',');
            }

            const result = await mediaApi.files.list(params);
            const newFiles = result.results || result || [];

            setFiles(prev => append ? [...prev, ...newFiles] : newFiles);
            setPagination({
                page,
                pageSize: pagination.pageSize,
                total: result.count || newFiles.length,
                hasNext: result.next != null
            });
        } catch (error) {
            console.error('Failed to load files:', error);
            addNotification('Failed to load media files', 'error');
        } finally {
            setLoading(false);
        }
    }, [namespace, searchQuery, filters, fileTypes, pagination.pageSize, addNotification]);

    // Load filters data
    useEffect(() => {
        const loadFiltersData = async () => {
            if (!namespace) return;

            try {
                const [tagsResult, collectionsResult] = await Promise.all([
                    mediaTagsApi.list({ namespace }),
                    mediaCollectionsApi.list({ namespace })
                ]);

                setAvailableTags(tagsResult.results || tagsResult || []);
                setAvailableCollections(collectionsResult.results || collectionsResult || []);
            } catch (error) {
                console.error('Failed to load filter data:', error);
            }
        };

        loadFiltersData();
    }, [namespace]);

    // Load files when dependencies change
    useEffect(() => {
        loadFiles(1, false);
    }, [loadFiles]);

    // Handle file selection
    const handleFileSelect = (file) => {
        if (multiple) {
            const newSelected = new Set(selectedFileIds);
            if (newSelected.has(file.id)) {
                newSelected.delete(file.id);
            } else {
                if (newSelected.size >= maxSelection) {
                    addNotification(`Maximum ${maxSelection} files allowed`, 'warning');
                    return;
                }
                newSelected.add(file.id);
            }
            setSelectedFileIds(newSelected);
        } else {
            setSelectedFileIds(new Set([file.id]));
            // Auto-close for single selection
            if (mode === 'modal') {
                const selectedFile = files.find(f => f.id === file.id);
                onSelect([selectedFile]);
                setIsOpen(false);
            }
        }
    };

    // Handle selection confirmation (for multiple selection)
    const handleConfirmSelection = () => {
        const selectedFiles = files.filter(f => selectedFileIds.has(f.id));
        onSelect(selectedFiles);
        if (mode === 'modal') {
            setIsOpen(false);
        }
    };

    // Handle search
    const handleSearch = (query) => {
        setSearchQuery(query);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Handle filter changes
    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value
        }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Load more files (infinite scroll)
    const loadMore = () => {
        if (pagination.hasNext && !loading) {
            loadFiles(pagination.page + 1, true);
        }
    };

    // File type icons
    const getFileIcon = (fileType) => {
        switch (fileType) {
            case 'image':
                return <ImageIcon className="w-5 h-5" />;
            case 'document':
                return <FileText className="w-5 h-5" />;
            case 'video':
                return <Video className="w-5 h-5" />;
            case 'audio':
                return <Music className="w-5 h-5" />;
            case 'archive':
                return <Archive className="w-5 h-5" />;
            default:
                return <File className="w-5 h-5" />;
        }
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString();
    };

    // Render file grid item
    const renderGridItem = (file) => {
        const isSelected = selectedFileIds.has(file.id);

        return (
            <div
                key={file.id}
                className={`relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all duration-200 ${isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                onClick={() => handleFileSelect(file)}
            >
                {/* Selection indicator */}
                {isSelected && (
                    <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                    </div>
                )}

                {/* File preview */}
                <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {file.file_type === 'image' && file.thumbnail_url ? (
                        <img
                            src={file.thumbnail_url}
                            alt={file.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="text-gray-400">
                            {getFileIcon(file.file_type)}
                        </div>
                    )}
                </div>

                {/* File info */}
                <div className="p-3">
                    <h4 className="font-medium text-sm text-gray-900 truncate" title={file.title}>
                        {file.title}
                    </h4>
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                        <span className="capitalize">{file.file_type}</span>
                        <span>{formatFileSize(file.file_size)}</span>
                    </div>
                    {file.dimensions && (
                        <div className="text-xs text-gray-400 mt-1">
                            {file.dimensions}
                        </div>
                    )}
                </div>

                {/* Hover actions */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                    <button
                        className="p-2 bg-white rounded-full text-gray-700 hover:text-blue-600 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            // Preview functionality
                        }}
                        title="Preview"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <button
                        className="p-2 bg-white rounded-full text-gray-700 hover:text-green-600 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(file.file_url, '_blank');
                        }}
                        title="Download"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    // Render file list item
    const renderListItem = (file) => {
        const isSelected = selectedFileIds.has(file.id);

        return (
            <div
                key={file.id}
                className={`flex items-center gap-4 p-4 cursor-pointer border rounded-lg transition-all duration-200 ${isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                onClick={() => handleFileSelect(file)}
            >
                {/* Selection checkbox */}
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>

                {/* File icon/thumbnail */}
                <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                    {file.file_type === 'image' && file.thumbnail_url ? (
                        <img
                            src={file.thumbnail_url}
                            alt={file.title}
                            className="w-full h-full object-cover rounded"
                        />
                    ) : (
                        <div className="text-gray-400">
                            {getFileIcon(file.file_type)}
                        </div>
                    )}
                </div>

                {/* File details */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{file.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="capitalize">{file.file_type}</span>
                        <span>{formatFileSize(file.file_size)}</span>
                        {file.dimensions && <span>{file.dimensions}</span>}
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(file.created_at)}
                        </span>
                    </div>
                    {file.tags && file.tags.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                            <Tag className="w-3 h-3 text-gray-400" />
                            <div className="flex gap-1">
                                {file.tags.slice(0, 3).map(tag => (
                                    <span
                                        key={tag.id}
                                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
                                    >
                                        {tag.name}
                                    </span>
                                ))}
                                {file.tags.length > 3 && (
                                    <span className="text-xs text-gray-400">
                                        +{file.tags.length - 3} more
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            // Preview functionality
                        }}
                        title="Preview"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <button
                        className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.open(file.file_url, '_blank');
                        }}
                        title="Download"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    // Main picker content
    const pickerContent = (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Select Media {multiple && `(${selectedFileIds.size}/${maxSelection})`}
                    </h3>
                    {onUpload && (
                        <button
                            onClick={onUpload}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                        >
                            <Upload className="w-4 h-4" />
                            Upload New
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex border border-gray-300 rounded-md">
                        <button
                            className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                            onClick={() => setViewMode('grid')}
                            title="Grid view"
                        >
                            <Grid3X3 className="w-4 h-4" />
                        </button>
                        <button
                            className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                            onClick={() => setViewMode('list')}
                            title="List view"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    {mode === 'modal' && onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Search and filters */}
            <div className="p-4 border-b border-gray-200 space-y-4">
                {/* Search bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search media files..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                        <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Quick filters */}
                    {!fileTypes.length && (
                        <select
                            value={filters.fileType}
                            onChange={(e) => handleFilterChange('fileType', e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">All Types</option>
                            <option value="image">Images</option>
                            <option value="document">Documents</option>
                            <option value="video">Videos</option>
                            <option value="audio">Audio</option>
                            <option value="archive">Archives</option>
                        </select>
                    )}
                </div>

                {/* Extended filters */}
                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                        {/* Tags filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                            <select
                                multiple
                                value={filters.tags}
                                onChange={(e) => handleFilterChange('tags', Array.from(e.target.selectedOptions, option => option.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                size={3}
                            >
                                {availableTags.map(tag => (
                                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Collections filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Collections</label>
                            <select
                                multiple
                                value={filters.collections}
                                onChange={(e) => handleFilterChange('collections', Array.from(e.target.selectedOptions, option => option.value))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                size={3}
                            >
                                {availableCollections.map(collection => (
                                    <option key={collection.id} value={collection.id}>{collection.title}</option>
                                ))}
                            </select>
                        </div>

                        {/* Access level filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Access Level</label>
                            <select
                                value={filters.accessLevel}
                                onChange={(e) => handleFilterChange('accessLevel', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Levels</option>
                                <option value="public">Public</option>
                                <option value="members">Members Only</option>
                                <option value="staff">Staff Only</option>
                                <option value="private">Private</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading && files.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <Folder className="w-16 h-16 mb-4" />
                        <p className="text-lg font-medium">No media files found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                ) : (
                    <>
                        <div className={
                            viewMode === 'grid'
                                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4'
                                : 'space-y-2'
                        }>
                            {files.map(file =>
                                viewMode === 'grid' ? renderGridItem(file) : renderListItem(file)
                            )}
                        </div>

                        {/* Load more */}
                        {pagination.hasNext && (
                            <div className="flex justify-center mt-6">
                                <button
                                    onClick={loadMore}
                                    disabled={loading}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading...
                                        </>
                                    ) : (
                                        'Load More'
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer (for multiple selection) */}
            {multiple && selectedFileIds.size > 0 && (
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                            {selectedFileIds.size} file{selectedFileIds.size !== 1 ? 's' : ''} selected
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedFileIds(new Set())}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleConfirmSelection}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                Select {selectedFileIds.size} File{selectedFileIds.size !== 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // Modal wrapper
    if (mode === 'modal') {
        return (
            <>
                {isOpen && (
                    <div className="fixed inset-0 z-50 overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

                            <div className="inline-block w-full max-w-6xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
                                <div className="h-[80vh]">
                                    {pickerContent}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // Inline mode
    return (
        <div className={`bg-white border border-gray-200 rounded-lg ${className}`}>
            <div className="h-96">
                {pickerContent}
            </div>
        </div>
    );
};

export default MediaPicker;
