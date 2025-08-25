/**
 * MediaUploader Component
 * 
 * Two-step file upload process:
 * 1. File selection and upload with progress tracking
 * 2. Metadata entry with AI suggestions
 * 
 * Features:
 * - Drag-and-drop file upload
 * - Progress tracking with visual feedback
 * - File validation and error handling
 * - AI-powered suggestions for titles and tags
 * - Batch metadata editing
 */

import React, { useState, useCallback, useRef } from 'react';
import {
    Upload,
    X,
    Loader2,
    CheckCircle,
    FolderOpen,
    FileText,
    Lightbulb,
    RefreshCw,
    Save,
    Plus,
    Sparkles
} from 'lucide-react';
import { mediaApi } from '../../api';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import MediaMetadataForm from './MediaMetadataForm';

const MediaUploader = ({
    namespace,
    onUploadComplete,
    onClose,
    folderPath = '',
    maxFiles = 10
}) => {
    const [uploadState, setUploadState] = useState('idle'); // idle, uploading, metadata, complete
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [uploadResults, setUploadResults] = useState([]);
    const [errors, setErrors] = useState([]);
    const [isDragOver, setIsDragOver] = useState(false);


    const fileInputRef = useRef(null);
    const { addNotification } = useGlobalNotifications();

    // File selection handlers
    const handleFileSelect = useCallback((files) => {
        const validation = mediaApi.upload.validateFiles(files);

        if (!validation.valid) {
            setErrors(validation.errors);
            addNotification('Some files failed validation', 'error');
            return;
        }

        if (validation.validFiles.length > maxFiles) {
            addNotification(`Maximum ${maxFiles} files allowed`, 'error');
            return;
        }

        setSelectedFiles(validation.validFiles);
        setErrors([]);
        addNotification(`${validation.validFiles.length} files selected`, 'success');
    }, [maxFiles, addNotification]);

    const handleFileInputChange = (event) => {
        const files = Array.from(event.target.files);
        handleFileSelect(files);
    };

    const handleDrop = useCallback((event) => {
        event.preventDefault();
        setIsDragOver(false);

        const files = Array.from(event.dataTransfer.files);
        handleFileSelect(files);
    }, [handleFileSelect]);

    const handleDragOver = useCallback((event) => {
        event.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((event) => {
        event.preventDefault();
        setIsDragOver(false);
    }, []);

    // Upload process
    const startUpload = async () => {
        if (!selectedFiles.length || !namespace) {
            addNotification('Please select files and namespace', 'error');
            return;
        }

        setUploadState('uploading');
        setUploadProgress({});
        setErrors([]);

        try {
            const uploadData = {
                files: selectedFiles,
                namespace: namespace,
                folderPath: folderPath
            };

            const onProgress = (percentCompleted, progressEvent) => {
                setUploadProgress(prev => ({
                    ...prev,
                    overall: percentCompleted
                }));
            };

            const result = await mediaApi.upload.upload(uploadData, onProgress);

            // Handle direct API response
            setUploadResults(result.uploadedFiles || result.uploaded_files || []);
            setUploadState('metadata');

            if (result.errors && result.errors.length > 0) {
                setErrors(result.errors);
                addNotification(
                    `${result.successCount || result.success_count || 0} files uploaded, ${result.errorCount || result.error_count || 0} failed`,
                    'warning'
                );
            } else {
                addNotification(`${result.successCount || result.success_count || result.uploadedFiles?.length || 0} files uploaded successfully`, 'success');
            }
        } catch (error) {
            console.error('Upload error:', error);
            setErrors([{ file: 'Upload', error: error.message }]);
            setUploadState('idle');
            addNotification('Upload failed', 'error');
        }
    };

    // Metadata editing
    const handleMetadataComplete = () => {
        setUploadState('complete');
        if (onUploadComplete) {
            onUploadComplete(uploadResults);
        }
    };

    // Reset uploader
    const resetUploader = () => {
        setUploadState('idle');
        setSelectedFiles([]);
        setUploadProgress({});
        setUploadResults([]);
        setErrors([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
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



    // Render upload state
    if (uploadState === 'uploading') {
        return (
            <div className="p-8">
                <div className="text-center">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Uploading Files...</h3>
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                        <div
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress.overall || 0}%` }}
                        />
                    </div>
                    <p className="text-gray-600 mb-8">{uploadProgress.overall || 0}% complete</p>

                    <div className="space-y-3">
                        {selectedFiles.map((file, index) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium text-gray-900 truncate">{file.name}</span>
                                <span className="text-sm text-gray-500">{formatFileSize(file.size)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Render metadata editing state
    if (uploadState === 'metadata') {
        return (
            <MediaMetadataForm
                uploadResults={uploadResults}
                namespace={namespace}
                onComplete={handleMetadataComplete}
                onCancel={resetUploader}
            />
        );
    }

    // Render file selection state
    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Upload Media Files</h3>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                )}
            </div>

            <div
                className={`
                    border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all duration-200
                    ${isDragOver
                        ? 'border-blue-500 bg-blue-50 scale-105'
                        : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                    }
                `}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="pointer-events-none">
                    <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg text-gray-700 mb-2">Drag and drop files here, or click to browse</p>
                    <p className="text-sm text-gray-500">
                        Supported: Images, Documents, Videos, Audio (max {maxFiles} files, 100MB each)
                    </p>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,video/*,audio/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                />
            </div>

            {selectedFiles.length > 0 && (
                <div className="mt-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Selected Files ({selectedFiles.length})</h4>
                    <div className="space-y-3 mb-6">
                        {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 truncate">{file.name}</p>
                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                        <span>{file.type}</span>
                                        <span>{formatFileSize(file.size)}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedFiles(files => files.filter((_, i) => i !== index));
                                    }}
                                    className="ml-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={startUpload}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            disabled={!namespace}
                        >
                            <Upload className="w-4 h-4" />
                            Upload Files
                        </button>
                        <button
                            onClick={() => setSelectedFiles([])}
                            className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                        >
                            <X className="w-4 h-4" />
                            Clear All
                        </button>
                    </div>
                </div>
            )}

            {errors.length > 0 && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="text-lg font-medium text-red-800 mb-3">Validation Errors:</h4>
                    <div className="space-y-2">
                        {errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700">
                                <span className="font-medium">{error.file}:</span> {error.error}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!namespace && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 flex items-center gap-2">
                        <span className="text-xl">⚠️</span>
                        Please select a namespace before uploading files.
                    </p>
                </div>
            )}
        </div>
    );
};



export default MediaUploader;
