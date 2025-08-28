/**
 * MediaBrowser Component
 * 
 * Comprehensive media file browser with:
 * - Grid and list view modes
 * - Advanced search and filtering
 * - File selection and management
 * - Thumbnail previews
 * - Pagination
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Search,
    Grid3X3,
    List,
    FileImage,
    FileVideo,
    FileAudio,
    FileText,
    File,
    FolderOpen,
    Loader2,
    CheckCircle,
    X,
    ChevronLeft,
    ChevronRight,
    Edit3,
    ArrowLeft
} from 'lucide-react';
import { mediaApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import BulkOperations from './BulkOperations';
import OptimizedImage from './OptimizedImage';
import MediaEditForm from './MediaEditForm';
import MediaSearchWidget from './MediaSearchWidget';
import { generateThumbnailUrl, generateImgproxyUrl } from '../../utils/imgproxy';
import { extractErrorMessage } from '../../utils/errorHandling';

const MediaBrowser = ({
    onFileSelect,
    onFilesLoaded,
    selectionMode = 'single', // 'single', 'multiple', 'none'
    fileTypes = [], // Filter by file types
    namespace,
    showUploader = true
}) => {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list'
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [searchTerms, setSearchTerms] = useState([]);
    const [filters, setFilters] = useState({
        fileType: '',
        tags: [],
        collections: []
    });
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 20,
        totalPages: 1,
        count: 0
    });
    const [isDragOver, setIsDragOver] = useState(false);
    const [uploadState, setUploadState] = useState('idle'); // idle, uploading, complete
    const [showBulkOperations, setShowBulkOperations] = useState(false);
    const [editingFile, setEditingFile] = useState(null);
    const [currentView, setCurrentView] = useState('library'); // 'library' | 'edit'

    const { addNotification } = useGlobalNotifications();

    // Use refs to avoid dependency issues
    const paginationRef = useRef(pagination);
    paginationRef.current = pagination;

    // Memoize filters and fileTypes to prevent unnecessary re-renders
    const memoizedFilters = useMemo(() => filters, [filters.fileType, filters.tags, filters.collections]);
    const memoizedFileTypes = useMemo(() => fileTypes, [fileTypes]);

    // Load files
    const loadFiles = useCallback(async (resetPage = false, customPage = null, customPageSize = null) => {

        setLoading(true);

        try {
            const currentPagination = paginationRef.current;
            const currentPage = resetPage ? 1 : (customPage || currentPagination.page);
            const currentPageSize = customPageSize || currentPagination.pageSize;
            // Convert search terms to structured search parameters
            const textTerms = searchTerms.filter(term => term.type === 'text');
            const tagTerms = searchTerms.filter(term => term.type === 'tag');

            const params = {
                page: currentPage,
                pageSize: currentPageSize,
                namespace: namespace,
                ...memoizedFilters
            };

            // Add text search (only one allowed)
            if (textTerms.length > 0) {
                params.text_search = textTerms[0].value;
            }

            // Add tag searches (multiple allowed, work as AND)
            if (tagTerms.length > 0) {
                params.tag_names = tagTerms.map(term => term.value);
            }

            // Apply file type filter if specified
            if (memoizedFileTypes.length > 0) {
                params.fileType = memoizedFileTypes[0]; // Simple implementation
            }

            const result = await mediaApi.search.search(params);

            // Handle direct API response
            setFiles(result.results || []);
            setPagination({
                page: result.page || currentPage,
                pageSize: result.pageSize || result.page_size || currentPageSize,
                totalPages: result.totalPages || result.total_pages || 1,
                count: result.count || 0
            });
        } catch (error) {
            console.error('Error loading files:', error);
            addNotification('Failed to load media files', 'error');
            setFiles([]);
        } finally {
            setLoading(false);
            if (onFilesLoaded) onFilesLoaded();
        }
    }, [searchTerms, memoizedFilters, namespace, memoizedFileTypes, addNotification]);

    // Load files on mount and when dependencies change
    useEffect(() => {

        if (namespace) {
            loadFiles(true);
        }
    }, [namespace, searchTerms]);

    // File selection handlers
    const handleFileClick = (file) => {
        if (selectionMode === 'none') return;

        if (selectionMode === 'single') {
            setSelectedFiles([file]);
            if (onFileSelect) {
                onFileSelect(file);
            }
        } else if (selectionMode === 'multiple') {
            setSelectedFiles(prev => {
                const isSelected = prev.some(f => f.id === file.id);
                const newSelection = isSelected
                    ? prev.filter(f => f.id !== file.id)
                    : [...prev, file];

                if (onFileSelect) {
                    onFileSelect(newSelection);
                }
                return newSelection;
            });
        }
    };

    // Handle edit button click
    const handleEditClick = (file, event) => {
        event.stopPropagation(); // Prevent file selection
        setEditingFile(file);
        setCurrentView('edit');
    };

    // Handle edit form save
    const handleEditSave = (updatedFile) => {
        setEditingFile(null);
        setCurrentView('library');
        // Refresh the file list to show updated data
        loadFiles(true);
    };

    // Handle edit form cancel
    const handleEditCancel = () => {
        setEditingFile(null);
        setCurrentView('library');
    };

    // Handle back to library
    const handleBackToLibrary = () => {
        setEditingFile(null);
        setCurrentView('library');
    };

    const isFileSelected = (file) => {
        return selectedFiles.some(f => f.id === file.id);
    };

    // Search and filter handlers
    const handleSearchChange = (newSearchTerms) => {
        setSearchTerms(newSearchTerms);
    };

    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value
        }));
    };

    // Pagination handlers
    const handlePageChange = (newPage) => {
        loadFiles(false, newPage);
    };

    // Bulk operations handlers
    const handleBulkOperationComplete = (result) => {
        // Refresh file list after bulk operation
        loadFiles(true);
        setSelectedFiles([]);
        setShowBulkOperations(false);
    };

    // Upload handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleUpload(files);
        }
    };

    const handleFileInputChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            handleUpload(files);
        }
    };

    const handleUpload = async (files) => {
        if (!namespace) {
            addNotification('Please select a namespace before uploading', 'error');
            return;
        }

        setUploadState('uploading');

        try {
            const uploadData = {
                files: files,
                namespace: namespace
            };

            const result = await mediaApi.upload.upload(uploadData);

            // Handle direct API response
            const uploadedCount = result.uploadedFiles?.length || result.successCount || 0;
            const rejectedCount = result.rejectedFiles?.length || result.rejectedCount || 0;
            const errorCount = result.errors?.length || result.errorCount || 0;

            if (uploadedCount > 0) {
                addNotification(`${uploadedCount} files uploaded successfully`, 'success');
                loadFiles(true); // Refresh file list
            }

            if (rejectedCount > 0) {
                addNotification(`${rejectedCount} file${rejectedCount > 1 ? 's' : ''} rejected: identical files already exist`, 'warning');
            }

            if (errorCount > 0) {
                addNotification(`${errorCount} files failed to upload`, 'error');
            }

            setUploadState('complete');
            setTimeout(() => {
                setUploadState('idle');
            }, 2000);

        } catch (error) {
            console.error('Upload error:', error);

            const errorMessage = extractErrorMessage(error, 'Upload failed');
            addNotification(errorMessage, 'error');
            setUploadState('idle');
        }
    };

    // File size formatter
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

    // Render file thumbnail with imgproxy optimization
    const renderThumbnail = (file, size = 150) => {
        const fileType = file.fileType;
        const originalUrl = file.imgproxyBaseUrl || file.fileUrl;

        if (fileType === 'image' && originalUrl) {
            // Use OptimizedImage component for better loading and error handling
            return (
                <OptimizedImage
                    src={originalUrl}
                    alt={file.title || file.original_filename || 'Media file'}
                    width={size}
                    height={size}
                    preset="thumbnail"
                    className="w-full h-full object-cover rounded"
                    placeholder={true}
                    placeholderSize={32}
                    loading="lazy"
                    fallback={
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded">
                            <FileImage className="w-8 h-8 text-blue-500" />
                        </div>
                    }
                />
            );
        }

        // File type icons for non-images
        const getFileIcon = (fileType) => {
            switch (fileType) {
                case 'image':
                    return <FileImage className="w-8 h-8 text-blue-500" />;
                case 'video':
                    return <FileVideo className="w-8 h-8 text-purple-500" />;
                case 'audio':
                    return <FileAudio className="w-8 h-8 text-green-500" />;
                case 'document':
                    return <FileText className="w-8 h-8 text-red-500" />;
                default:
                    return <File className="w-8 h-8 text-gray-500" />;
            }
        };

        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded">
                {getFileIcon(fileType)}
            </div>
        );
    };

    // Render grid view
    const renderGridView = () => (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
            {files.map((file) => (
                <div
                    key={file.id}
                    className={`
                        group cursor-pointer rounded-lg border-2 transition-all duration-200 hover:shadow-md relative
                        ${isFileSelected(file)
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:border-gray-300'
                        }
                    `}
                    onClick={() => handleFileClick(file)}
                >
                    {/* Edit Button */}
                    <button
                        onClick={(e) => handleEditClick(file, e)}
                        className="absolute top-2 right-2 z-10 p-1.5 bg-white rounded-full shadow-md transition-opacity duration-200 hover:bg-gray-50"
                        title="Edit file"
                    >
                        <Edit3 className="w-3.5 h-3.5 text-gray-600" />
                    </button>

                    <div className="aspect-square p-2">
                        {renderThumbnail(file, 200)}
                    </div>
                    <div className="p-3 border-t border-gray-100">
                        <h4
                            className="text-sm font-medium text-gray-900 truncate mb-1"
                            title={file.title}
                        >
                            {file.title}
                        </h4>
                        <p className="text-xs text-gray-500 mb-1">
                            {file.fileType || file.file_type} • {formatFileSize(file.fileSize || file.file_size)}
                        </p>
                        {file.dimensions && (
                            <p className="text-xs text-gray-400">{file.dimensions}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );

    // Render list view
    const renderListView = () => (
        <div className="overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
                <div className="col-span-1">Preview</div>
                <div className="col-span-3">Title</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Size</div>
                <div className="col-span-3">Created</div>
                <div className="col-span-1">Actions</div>
            </div>
            {files.map((file) => (
                <div
                    key={file.id}
                    className={`
                        group grid grid-cols-12 gap-4 p-4 border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50 items-center
                        ${isFileSelected(file) ? 'bg-blue-50 border-blue-200' : ''}
                    `}
                    onClick={() => handleFileClick(file)}
                >
                    <div className="col-span-1">
                        <div className="w-12 h-12">
                            {renderThumbnail(file, 48)}
                        </div>
                    </div>
                    <div className="col-span-3">
                        <div className="flex flex-col justify-center">
                            <span className="font-medium text-gray-900 truncate">{file.title}</span>
                            <span className="text-sm text-gray-500 truncate">{file.originalFilename || file.original_filename}</span>
                        </div>
                    </div>
                    <div className="col-span-2 text-sm text-gray-600 capitalize flex items-center">{file.fileType || file.file_type}</div>
                    <div className="col-span-2 text-sm text-gray-600 flex items-center">{formatFileSize(file.fileSize || file.file_size)}</div>
                    <div className="col-span-3 text-sm text-gray-600 flex items-center">{formatDate(file.createdAt || file.created_at)}</div>
                    <div className="col-span-1 flex justify-center items-center">
                        <button
                            onClick={(e) => handleEditClick(file, e)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="Edit file"
                        >
                            <Edit3 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );

    // Edit File View Component
    const EditFileView = ({ file, namespace, onBack, onSave }) => {
        return (
            <div className="h-full flex flex-col bg-gray-50">
                {/* Header */}
                <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Library
                        </button>
                        <div className="flex-1">
                            <h2 className="text-xl font-semibold text-gray-900">Edit File</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Editing: {file.title || file.originalFilename}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="max-w-4xl mx-auto">
                        <MediaEditForm
                            file={file}
                            namespace={namespace}
                            onSave={onSave}
                            onCancel={onBack}
                            mode="edit"
                            showHeader={false}
                        />
                    </div>
                </div>
            </div>
        );
    };

    // Conditional rendering based on current view
    if (currentView === 'edit' && editingFile) {
        return (
            <EditFileView
                file={editingFile}
                namespace={namespace}
                onBack={handleBackToLibrary}
                onSave={handleEditSave}
            />
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Fixed Top Section - Header, Upload Area, Selection Info */}
            <div className="flex-shrink-0">
                {/* Header */}
                <div className="flex flex-col sm:flex-row gap-4 p-4 bg-white border-b border-gray-200">
                    <div className="flex-1">
                        <MediaSearchWidget
                            searchTerms={searchTerms}
                            onChange={handleSearchChange}
                            namespace={namespace}
                            placeholder="Search media files..."
                        />
                    </div>

                    <div className="flex items-start gap-2 flex-shrink-0">
                        <select
                            value={filters.fileType}
                            onChange={(e) => handleFilterChange('fileType', e.target.value)}
                            className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-[38px]"
                        >
                            <option value="">All Types</option>
                            <option value="image">Images</option>
                            <option value="video">Videos</option>
                            <option value="audio">Audio</option>
                            <option value="document">Documents</option>
                            <option value="other">Other</option>
                        </select>

                        <div className="flex rounded-md border border-gray-300 overflow-hidden">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`
                                        flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap
                                        ${viewMode === 'grid'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }
                                    `}
                            >
                                <Grid3X3 className="w-4 h-4" />
                                Grid
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`
                                        flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 whitespace-nowrap
                                        ${viewMode === 'list'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-gray-700 hover:bg-gray-50'
                                    }
                                    `}
                            >
                                <List className="w-4 h-4" />
                                List
                            </button>
                        </div>
                    </div>
                </div>

                {/* Upload Area */}
                {showUploader && (
                    <div
                        className={`
                                m-4 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all duration-200
                                ${isDragOver
                                ? 'border-blue-500 bg-blue-50 scale-105'
                                : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                            }
                                ${uploadState === 'uploading'
                                ? 'border-green-500 bg-green-50 pointer-events-none opacity-70'
                                : ''
                            }
                            `}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('file-input').click()}
                    >
                        <div className="pointer-events-none">
                            {uploadState === 'uploading' ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                                    <p className="text-sm text-gray-700">Uploading files...</p>
                                </div>
                            ) : uploadState === 'complete' ? (
                                <div className="flex flex-col items-center gap-2">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                    <p className="text-sm text-green-700 font-medium">Upload complete!</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <FolderOpen className="w-8 h-8 text-gray-400" />
                                    <div>
                                        <p className="text-sm text-gray-700 mb-1">
                                            <span className="font-semibold">Drag files here</span> or <span className="text-blue-600 underline">click to browse</span>
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Supports images, documents, videos, and audio files
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <input
                            id="file-input"
                            type="file"
                            multiple
                            accept="image/*,application/pdf,.doc,.docx,video/*,audio/*"
                            onChange={handleFileInputChange}
                            className="hidden"
                        />
                    </div>
                )}

                {/* Selection info */}
                {selectedFiles.length > 0 && (
                    <div className="flex justify-between items-center px-4 py-3 bg-blue-50 border-b border-blue-200">
                        <p className="text-sm text-blue-700 font-medium">
                            {selectedFiles.length} file(s) selected
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowBulkOperations(true)}
                                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                Bulk Actions
                            </button>
                            <button
                                onClick={() => setSelectedFiles([])}
                                className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                            >
                                <X className="w-3 h-3" />
                                Clear Selection
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Scrollable Content Section */}
            <div className="flex-1 flex flex-col min-h-0 h-0">
                <div className="flex-1 overflow-y-auto h-full">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                                <p className="text-gray-600">Loading media files...</p>
                            </div>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="text-center">
                                <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600">No files found</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {viewMode === 'grid' ? renderGridView() : renderListView()}
                        </>
                    )}
                </div>

                {/* Fixed Pagination at bottom of scrollable area */}
                {pagination.totalPages > 1 && (
                    <div className="flex-shrink-0 flex justify-between items-center px-4 py-3 bg-gray-50 border-t border-gray-200">
                        <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                        </button>

                        <span className="text-sm text-gray-600">
                            Page {pagination.page} of {pagination.totalPages} • {pagination.count} total files
                        </span>

                        <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Bulk Operations Modal */}
            {showBulkOperations && selectedFiles.length > 0 && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        <div
                            className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                            onClick={() => setShowBulkOperations(false)}
                        />

                        <div className="inline-block w-full max-w-2xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
                            <BulkOperations
                                selectedFiles={selectedFiles}
                                namespace={namespace}
                                onOperationComplete={handleBulkOperationComplete}
                                onClose={() => setShowBulkOperations(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};



export default MediaBrowser;
