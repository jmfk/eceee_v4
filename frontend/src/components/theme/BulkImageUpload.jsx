import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const BulkImageUpload = ({ themeId, onUploadComplete, onCancel }) => {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadResults, setUploadResults] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const validateFile = (file) => {
        const errors = [];
        
        if (!allowedTypes.includes(file.type)) {
            errors.push('Invalid file type');
        }
        
        if (file.size > maxSize) {
            errors.push('File too large (max 10MB)');
        }
        
        return errors;
    };

    const handleFiles = (newFiles) => {
        const validatedFiles = Array.from(newFiles).map(file => ({
            file,
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            size: file.size,
            errors: validateFile(file)
        }));
        
        setFiles(prev => [...prev, ...validatedFiles]);
    };

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
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleFileInput = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
        e.target.value = ''; // Reset input
    };

    const removeFile = (id) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const handleUpload = async () => {
        const validFiles = files.filter(f => f.errors.length === 0);
        
        if (validFiles.length === 0) {
            return;
        }

        setUploading(true);
        
        try {
            const { themesApi } = await import('../../api/themes');
            const result = await themesApi.uploadLibraryImages(
                themeId,
                validFiles.map(f => f.file)
            );
            
            setUploadResults(result);
            
            // Auto-close after successful upload
            setTimeout(() => {
                if (onUploadComplete) {
                    onUploadComplete(result);
                }
            }, 1500);
            
        } catch (error) {
            setUploadResults({
                uploaded: [],
                errors: [{ filename: 'Upload', error: error.message }],
                success: 0,
                failed: files.length
            });
        } finally {
            setUploading(false);
        }
    };

    const validFilesCount = files.filter(f => f.errors.length === 0).length;
    const invalidFilesCount = files.length - validFilesCount;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10010]">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div className="text-lg font-semibold text-gray-900">
                        Upload Images to Library
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 transition"
                        disabled={uploading}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!uploadResults ? (
                        <>
                            {/* Drop Zone */}
                            <div
                                className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
                                    dragActive
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                            >
                                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-700 mb-2">
                                    Drag and drop images here, or click to select
                                </p>
                                <p className="text-sm text-gray-500 mb-4">
                                    JPG, PNG, GIF, WebP, SVG (max 10MB each)
                                </p>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
                                    disabled={uploading}
                                >
                                    Select Files
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept={allowedTypes.join(',')}
                                    onChange={handleFileInput}
                                    className="hidden"
                                    disabled={uploading}
                                />
                            </div>

                            {/* File List */}
                            {files.length > 0 && (
                                <div className="mt-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm font-medium text-gray-700">
                                            Selected Files ({validFilesCount} valid, {invalidFilesCount} invalid)
                                        </div>
                                        <button
                                            onClick={() => setFiles([])}
                                            className="text-sm text-gray-500 hover:text-gray-700"
                                            disabled={uploading}
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {files.map(({ id, name, size, errors }) => (
                                            <div
                                                key={id}
                                                className={`flex items-center justify-between p-3 rounded-lg ${
                                                    errors.length > 0
                                                        ? 'bg-red-50 border border-red-200'
                                                        : 'bg-gray-50 border border-gray-200'
                                                }`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        {errors.length > 0 ? (
                                                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                                        ) : (
                                                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                                        )}
                                                        <span className="text-sm font-medium text-gray-900 truncate">
                                                            {name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-gray-500">
                                                            {(size / 1024).toFixed(1)} KB
                                                        </span>
                                                        {errors.length > 0 && (
                                                            <span className="text-xs text-red-600">
                                                                {errors.join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeFile(id)}
                                                    className="ml-2 text-gray-400 hover:text-red-600 transition"
                                                    disabled={uploading}
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Upload Results */
                        <div className="space-y-4">
                            <div className="text-center">
                                {uploadResults.success > 0 ? (
                                    <>
                                        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                                        <div className="text-lg font-semibold text-gray-900 mb-2">
                                            Upload Complete!
                                        </div>
                                        <p className="text-gray-600">
                                            {uploadResults.success} {uploadResults.success === 1 ? 'image' : 'images'} uploaded successfully
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                                        <div className="text-lg font-semibold text-gray-900 mb-2">
                                            Upload Failed
                                        </div>
                                        <p className="text-gray-600">
                                            All uploads failed
                                        </p>
                                    </>
                                )}
                            </div>

                            {uploadResults.errors && uploadResults.errors.length > 0 && (
                                <div className="mt-4">
                                    <div className="text-sm font-medium text-gray-700 mb-2">Errors:</div>
                                    <div className="space-y-1">
                                        {uploadResults.errors.map((error, idx) => (
                                            <div key={idx} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                                                {error.filename}: {error.error}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                    {!uploadResults ? (
                        <>
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                                disabled={uploading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                disabled={uploading || validFilesCount === 0}
                            >
                                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {uploading ? 'Uploading...' : `Upload ${validFilesCount} ${validFilesCount === 1 ? 'Image' : 'Images'}`}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => onUploadComplete(uploadResults)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
                        >
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkImageUpload;

