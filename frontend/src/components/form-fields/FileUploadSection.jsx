import React, { useState, useCallback } from 'react'
import { Tag, Check, Loader2, X, AlertCircle, FolderOpen } from 'lucide-react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import MediaTagWidget from '../media/MediaTagWidget'

/**
 * FileUploadSection Component
 * 
 * Handles file upload functionality including:
 * - Upload dropzone
 * - File validation and preview
 * - Tag management
 * - Upload progress and error handling
 * - Force upload capabilities
 */
const FileUploadSection = ({
    uploadFiles,
    setUploadFiles,
    uploading,
    setUploading,
    uploadTags,
    setUploadTags,
    uploadErrors,
    setUploadErrors,
    showForceUpload,
    setShowForceUpload,
    dragOver,
    namespace,
    fileTypeLabel,
    allowedFileTypes,
    defaultCollection,
    onRemoveDefaultCollection,
    originalAutoTags,
    onRestoreAutoTags,
    maxFiles,
    value,
    multiple,
    onChange,
    onUploadComplete,
    // Validation and utility functions passed from parent
    validateFile,
    parseAutoTags,
    autoTags,
    formatFileSize,
    getFileTypeInfo,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInputChange,
    getAcceptAttribute
}) => {
    const { addNotification } = useGlobalNotifications()

    // Remove upload file
    const removeUploadFile = useCallback((index) => {
        const removedFile = uploadFiles[index]
        setUploadFiles(prev => prev.filter((_, i) => i !== index))

        // Show confirmation
        addNotification(`Removed ${removedFile?.name || 'file'} from upload queue`, 'info')

        // Clear upload tags if no files remaining
        if (uploadFiles.length === 1) {
            setUploadTags([])
        }
    }, [uploadFiles, addNotification, setUploadFiles, setUploadTags])

    // Remove all upload files
    const removeAllUploadFiles = useCallback(() => {
        const fileCount = uploadFiles.length
        setUploadFiles([])
        setUploadTags([])
        addNotification(`Removed ${fileCount} files from upload queue`, 'info')
    }, [uploadFiles, addNotification, setUploadFiles, setUploadTags])

    // Upload and approve files
    const handleUploadAndApprove = useCallback(async () => {
        if (!uploadFiles.length || !namespace) {
            return
        }

        setUploading(true)
        try {
            // Upload files
            const uploadData = {
                files: uploadFiles,
                namespace: namespace
            }

            const onProgress = (percentCompleted, progressEvent) => {
                // Progress tracking could be added here if needed
            }

            const uploadResult = await mediaApi.upload.upload(uploadData, onProgress)

            // Check if the result contains validation errors
            if (uploadResult.hasErrors && uploadResult.errors?.length > 0) {
                // Store errors for detailed display
                setUploadErrors(uploadResult.errors)
                setShowForceUpload(true)
                setUploading(false)
                return
            }

            // Handle both uploaded files and rejected files (duplicates)
            const uploadedFiles = uploadResult.uploadedFiles || uploadResult.uploaded_files || []
            const rejectedFiles = uploadResult.rejectedFiles || uploadResult.rejected_files || []

            // Combine files to approve - use existing file ID for duplicates
            const filesToApprove = [
                ...uploadedFiles,
                ...rejectedFiles.filter(file => file.reason === 'duplicate_pending').map(file => ({
                    id: file.existingFileId || file.existingFile?.id,
                    originalFilename: file.existingFile?.originalFilename || file.filename,
                    filename: file.existingFile?.originalFilename || file.filename
                }))
            ]

            // Auto-approve with tags
            const approvalPromises = filesToApprove.map(async (file) => {
                try {
                    // Use the file's original filename or fallback
                    const filename = file.originalFilename || file.original_filename || file.filename || 'untitled'

                    // Generate a proper slug
                    const slug = filename
                        .toLowerCase()
                        .replace(/\.[^/.]+$/, '') // Remove file extension
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '')
                        .substring(0, 50) // Limit length

                    // Ensure we have at least one tag
                    if (uploadTags.length === 0) {
                        console.error('No tags provided for approval')
                        return null
                    }

                    const approvalData = {
                        title: filename.replace(/\.[^/.]+$/, ''), // Remove extension from title
                        description: '',
                        slug: slug || 'untitled',
                        tag_ids: uploadTags.map(tag => String(tag.id)), // Ensure string format
                        access_level: 'public'
                    }

                    return await mediaApi.pendingFiles.approve(file.id, approvalData)()
                } catch (error) {
                    console.error('Failed to approve file:', error)
                    return null
                }
            })

            const approvedFiles = (await Promise.all(approvalPromises)).filter(Boolean)

            if (approvedFiles.length > 0) {
                // Add to default collection if configured
                if (defaultCollection) {
                    try {
                        const fileIds = approvedFiles.map(response => {
                            const file = response.mediaFile || response
                            return file.id
                        }).filter(Boolean)

                        if (fileIds.length > 0) {
                            await mediaApi.collections.addFiles(defaultCollection.id, fileIds)()
                        }
                    } catch (error) {
                        console.warn(`Failed to add files to collection ${defaultCollection.title}:`, error)
                    }
                }

                if (multiple) {
                    // For multiple files, respect maxFiles limit
                    const currentFiles = Array.isArray(value) ? value : []
                    const newFiles = approvedFiles.map(response => response.mediaFile || response)

                    if (maxFiles) {
                        const availableSlots = Math.max(0, maxFiles - currentFiles.length)
                        const filesToAdd = newFiles.slice(0, availableSlots)
                        const filesNotAdded = newFiles.slice(availableSlots)

                        onChange([...currentFiles, ...filesToAdd])

                        if (filesNotAdded.length > 0) {
                            addNotification(
                                `${filesToAdd.length} files added to field, ${filesNotAdded.length} uploaded to media library only (field limit: ${maxFiles})`,
                                'info'
                            )
                        }
                    } else {
                        // No limit, add all files
                        onChange([...currentFiles, ...newFiles])
                    }
                } else {
                    // For single file, use the first approved file
                    const approvalResponse = approvedFiles[0]
                    const selectedFile = approvalResponse.mediaFile || approvalResponse
                    onChange(selectedFile)
                }

                addNotification(`${fileTypeLabel}${approvedFiles.length > 1 ? 's' : ''} uploaded and added successfully`, 'success')
                onUploadComplete?.()
            } else {
                addNotification('No files were successfully approved', 'warning')
            }

            // Clear upload state
            setUploadFiles([])
            setUploadTags([])

        } catch (error) {
            console.error('Unexpected error in upload process:', error)
            addNotification(`Unexpected error during upload: ${error.message}`, 'error')
        } finally {
            setUploading(false)
        }
    }, [uploadFiles, namespace, uploadTags, onChange, addNotification, multiple, value, fileTypeLabel, defaultCollection, maxFiles, onUploadComplete, setUploadFiles, setUploadTags, setUploading, setUploadErrors, setShowForceUpload])

    // Force upload bypassing security validation
    const handleForceUpload = useCallback(async () => {
        if (!uploadFiles.length || !namespace) {
            return
        }

        setUploading(true)
        setShowForceUpload(false)
        setUploadErrors([])

        try {
            // Upload files with force flag
            const uploadData = {
                files: uploadFiles,
                namespace: namespace,
                forceUpload: true // Add flag to bypass security validation
            }

            const uploadResult = await mediaApi.upload.upload(uploadData)

            // Continue with same approval process as regular upload
            // ... (same logic as handleUploadAndApprove)

        } catch (error) {
            console.error('Force upload failed:', error)
            addNotification(`Force upload failed: ${error.message}`, 'error')
        } finally {
            setUploading(false)
        }
    }, [uploadFiles, namespace, uploadTags, onChange, addNotification, multiple, value, fileTypeLabel, defaultCollection, maxFiles, setUploading, setShowForceUpload, setUploadErrors, setUploadFiles, setUploadTags])

    if (uploadFiles.length === 0) {
        return (
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`relative border border-dashed rounded-md p-3 text-center transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
            >
                <input
                    type="file"
                    accept={getAcceptAttribute()}
                    onChange={handleFileInputChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                    multiple={multiple}
                />
                <div className="text-sm text-gray-600">
                    {dragOver ? `Drop ${fileTypeLabel.toLowerCase()}s here` : `Drag & drop or click to select ${fileTypeLabel.toLowerCase()}s`}
                </div>
            </div>
        )
    }

    // Calculate which files will be added vs just uploaded
    const currentFiles = Array.isArray(value) ? value : []
    const currentCount = currentFiles.length
    const availableSlots = maxFiles ? Math.max(0, maxFiles - currentCount) : uploadFiles.length

    return (
        <div className="mt-4 space-y-3">
            {/* Upload Files Header */}
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700" role="heading" aria-level="5">Files to Upload ({uploadFiles.length}):</div>
                <div className="flex items-center gap-2">
                    {maxFiles && uploadFiles.length > availableSlots && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                            {availableSlots} of {uploadFiles.length} will be added to field (limit: {maxFiles})
                        </span>
                    )}
                    <button
                        onClick={removeAllUploadFiles}
                        className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                        disabled={uploading}
                    >
                        Remove All
                    </button>
                </div>
            </div>

            {/* Upload Files Preview */}
            {uploadFiles.map((file, index) => {
                const fileTypeInfo = getFileTypeInfo(file.type)
                const IconComponent = fileTypeInfo.icon
                const willBeAdded = index < availableSlots

                return (
                    <div key={index} className={`flex items-center gap-3 p-3 border rounded-lg ${willBeAdded ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                        }`}>
                        <div className={`w-12 h-12 rounded overflow-hidden ${fileTypeInfo.bgColor} flex items-center justify-center`}>
                            {file.type.startsWith('image/') ? (
                                <img
                                    src={URL.createObjectURL(file)}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <IconComponent className={`w-6 h-6 ${fileTypeInfo.color}`} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                                {willBeAdded ? (
                                    <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                        Will be added
                                    </span>
                                ) : (
                                    <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                                        Upload only
                                    </span>
                                )}
                            </div>
                            <div className="text-xs text-gray-500">{formatFileSize(file.size)}</div>
                        </div>
                        <button
                            onClick={() => removeUploadFile(index)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            disabled={uploading}
                            title={`Remove ${file.name} from upload queue`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )
            })}

            {/* Limit Warning */}
            {maxFiles && uploadFiles.length > availableSlots && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm text-blue-800">
                        <span className="font-bold">Note:</span> All {uploadFiles.length} files will be uploaded to your media library,
                        but only the first {availableSlots} will be added to this field due to the maximum limit of {maxFiles}.
                        The remaining {uploadFiles.length - availableSlots} files will be available in your media library for use elsewhere.
                    </div>
                </div>
            )}

            {/* Tag Field */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                        <Tag className="inline w-4 h-4 mr-1" />
                        Tags (required for approval) {uploadTags.length > 0 && `(${uploadTags.length} selected)`}
                    </label>
                    {originalAutoTags.length > 0 && uploadTags.length === 0 && (
                        <button
                            onClick={onRestoreAutoTags}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                            Restore default tags
                        </button>
                    )}
                </div>
                <MediaTagWidget
                    tags={uploadTags}
                    onChange={setUploadTags}
                    namespace={namespace}
                    disabled={uploading}
                />
                {originalAutoTags.length > 0 && uploadTags.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                        <button
                            onClick={onRestoreAutoTags}
                            className="text-blue-600 hover:text-blue-800 underline"
                        >
                            Reset to default tags ({originalAutoTags.map(tag => tag.name).join(', ')})
                        </button>
                    </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                    Add tags to help organize and find these files later
                </div>
            </div>

            {/* Default Collection Display */}
            {defaultCollection && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <FolderOpen className="w-4 h-4 text-blue-600 mr-2" />
                            <div>
                                <div className="text-sm font-medium text-blue-900">
                                    Will be added to: {defaultCollection.title}
                                </div>
                                {defaultCollection.description && (
                                    <div className="text-xs text-blue-700">
                                        {defaultCollection.description}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                // Clear the default collection - we need to pass this up to parent
                                if (onRemoveDefaultCollection) {
                                    onRemoveDefaultCollection()
                                }
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                            title="Don't add to collection"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Upload Errors Display */}
            {uploadErrors.length > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <div className="text-sm font-medium text-red-800 mb-3 flex items-center" role="heading" aria-level="5">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Upload Validation Errors
                    </div>
                    <div className="space-y-2">
                        {uploadErrors.map((fileError, index) => (
                            <div key={index} className="text-sm">
                                <div className="font-medium text-red-900">
                                    {fileError.filename}
                                </div>
                                <div className="text-red-700 ml-4">
                                    {fileError.error}
                                </div>
                            </div>
                        ))}
                    </div>

                    {showForceUpload && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                            <div className="text-sm text-yellow-800 mb-3">
                                <span className="font-bold">Security Warning:</span> These files were blocked due to security validation.
                                You can force upload to bypass these checks, but only do this if you trust the source.
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleForceUpload}
                                    disabled={uploading}
                                    className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Force Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            Force Upload Anyway
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        setUploadErrors([])
                                        setShowForceUpload(false)
                                        setUploadFiles([])
                                        setUploadTags([])
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                    disabled={uploading}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Upload Button */}
            <div className="flex justify-end gap-2">
                <button
                    onClick={() => {
                        setUploadFiles([])
                        setUploadTags([])
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    disabled={uploading}
                >
                    Cancel
                </button>
                <button
                    onClick={handleUploadAndApprove}
                    disabled={uploading || uploadTags.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {uploading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Check className="w-4 h-4" />
                            Upload & Use {fileTypeLabel}{uploadFiles.length > 1 ? 's' : ''}
                        </>
                    )}
                </button>
            </div>
        </div>
    )
}

export default FileUploadSection
