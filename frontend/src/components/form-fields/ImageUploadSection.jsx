import React, { useRef, useCallback } from 'react'
import { X, AlertCircle, Tag, FolderOpen } from 'lucide-react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import MediaTagWidget from '../media/MediaTagWidget'
import { validateImageFile, formatFileSize, getImageTypeInfo, getImageAcceptAttribute } from './ImageValidationUtils'

const ImageUploadSection = ({
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
    constraints,
    defaultCollection,
    onRemoveDefaultCollection,
    maxFiles,
    value,
    multiple,
    onChange,
    onUploadComplete,
    parseAutoTags,
    autoTags,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    handleFileInputChange
}) => {
    const fileInputRef = useRef(null)
    const { addNotification } = useGlobalNotifications()

    // Remove a file from upload queue
    const removeUploadFile = useCallback((index) => {
        const newFiles = uploadFiles.filter((_, i) => i !== index)
        setUploadFiles(newFiles)

        // Clear tags if no files remain
        if (newFiles.length === 0) {
            setUploadTags([])
            setUploadErrors([])
            setShowForceUpload(false)
        }

        addNotification('Image removed from upload queue', 'info')
    }, [uploadFiles, setUploadFiles, setUploadTags, setUploadErrors, setShowForceUpload, addNotification])

    // Remove all files from upload queue
    const removeAllUploadFiles = useCallback(() => {
        setUploadFiles([])
        setUploadTags([])
        setUploadErrors([])
        setShowForceUpload(false)
        addNotification('All images removed from upload queue', 'info')
    }, [setUploadFiles, setUploadTags, setUploadErrors, setShowForceUpload, addNotification])

    // Handle upload and approve
    const handleUploadAndApprove = useCallback(async () => {
        if (uploadFiles.length === 0 || !namespace) return

        setUploading(true)
        setUploadErrors([])
        setShowForceUpload(false)

        try {
            // Upload images
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
                    console.error('Failed to approve image:', error)
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
                            console.log(`Added ${fileIds.length} image(s) to collection: ${defaultCollection.title}`)
                        }
                    } catch (error) {
                        console.warn(`Failed to add images to collection ${defaultCollection.title}:`, error)
                    }
                }

                if (multiple) {
                    // For multiple images, respect maxFiles limit
                    const currentImages = Array.isArray(value) ? value : []
                    const newImages = approvedFiles.map(response => response.mediaFile || response)

                    if (maxFiles) {
                        const availableSlots = Math.max(0, maxFiles - currentImages.length)
                        const imagesToAdd = newImages.slice(0, availableSlots)
                        const imagesUploadedOnly = newImages.slice(availableSlots)

                        onChange([...currentImages, ...imagesToAdd])

                        // Show notifications
                        if (imagesToAdd.length > 0) {
                            addNotification(
                                `${imagesToAdd.length} image${imagesToAdd.length !== 1 ? 's' : ''} uploaded and added to field`,
                                'success'
                            )
                        }

                        if (imagesUploadedOnly.length > 0) {
                            addNotification(
                                `${imagesUploadedOnly.length} additional image${imagesUploadedOnly.length !== 1 ? 's' : ''} uploaded to media library only (field limit reached)`,
                                'info'
                            )
                        }
                    } else {
                        onChange([...currentImages, ...newImages])
                        addNotification(
                            `${newImages.length} image${newImages.length !== 1 ? 's' : ''} uploaded and added to field`,
                            'success'
                        )
                    }
                } else {
                    // For single image, use the first approved image
                    const newImage = approvedFiles[0]?.mediaFile || approvedFiles[0]
                    if (newImage) {
                        onChange(newImage)
                        addNotification('Image uploaded and added to field', 'success')

                        // Notify about additional images if any
                        if (approvedFiles.length > 1) {
                            addNotification(
                                `${approvedFiles.length - 1} additional image${approvedFiles.length - 1 !== 1 ? 's' : ''} uploaded to media library only`,
                                'info'
                            )
                        }
                    }
                }
            }

            // Clear upload state
            setUploadFiles([])
            setUploadTags([])
            setUploadErrors([])
            setShowForceUpload(false)

            onUploadComplete()

        } catch (error) {
            console.error('Upload failed:', error)
            addNotification(`Upload failed: ${error.message}`, 'error')
        } finally {
            setUploading(false)
        }
    }, [uploadFiles, namespace, setUploading, setUploadErrors, setShowForceUpload, multiple, value, maxFiles, uploadTags, defaultCollection, setUploadFiles, setUploadTags, onChange, onUploadComplete, addNotification])

    // Handle force upload (bypass validation)
    const handleForceUpload = useCallback(async () => {
        if (uploadFiles.length === 0 || !namespace) return

        setUploading(true)

        try {
            // Force upload images
            const uploadData = {
                files: uploadFiles,
                namespace: namespace,
                force_upload: true
            }

            const uploadResult = await mediaApi.upload.upload(uploadData)()
            const uploadedFiles = uploadResult.uploadedFiles || uploadResult.uploaded_files || []

            // Auto-approve with tags (same as regular upload)
            const approvalPromises = uploadedFiles.map(async (file) => {
                try {
                    const filename = file.originalFilename || file.original_filename || file.filename || 'untitled'
                    const slug = filename
                        .toLowerCase()
                        .replace(/\.[^/.]+$/, '')
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '')
                        .substring(0, 50)

                    if (uploadTags.length === 0) {
                        console.error('No tags provided for approval')
                        return null
                    }

                    const approvalData = {
                        title: filename.replace(/\.[^/.]+$/, ''),
                        description: '',
                        slug: slug || 'untitled',
                        tag_ids: uploadTags.map(tag => String(tag.id)),
                        access_level: 'public'
                    }

                    return await mediaApi.pendingFiles.approve(file.id, approvalData)()
                } catch (error) {
                    console.error('Failed to approve force uploaded image:', error)
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
                            console.log(`Added ${fileIds.length} force uploaded image(s) to collection: ${defaultCollection.title}`)
                        }
                    } catch (error) {
                        console.warn(`Failed to add force uploaded images to collection ${defaultCollection.title}:`, error)
                    }
                }

                if (multiple) {
                    const currentImages = Array.isArray(value) ? value : []
                    const newImages = approvedFiles.map(response => response.mediaFile || response)

                    if (maxFiles) {
                        const availableSlots = Math.max(0, maxFiles - currentImages.length)
                        const imagesToAdd = newImages.slice(0, availableSlots)
                        const imagesUploadedOnly = newImages.slice(availableSlots)

                        onChange([...currentImages, ...imagesToAdd])

                        if (imagesToAdd.length > 0) {
                            addNotification(
                                `${imagesToAdd.length} image${imagesToAdd.length !== 1 ? 's' : ''} force uploaded and added to field`,
                                'success'
                            )
                        }

                        if (imagesUploadedOnly.length > 0) {
                            addNotification(
                                `${imagesUploadedOnly.length} additional image${imagesUploadedOnly.length !== 1 ? 's' : ''} uploaded to media library only (field limit reached)`,
                                'info'
                            )
                        }
                    } else {
                        onChange([...currentImages, ...newImages])
                        addNotification(
                            `${newImages.length} image${newImages.length !== 1 ? 's' : ''} force uploaded and added to field`,
                            'success'
                        )
                    }
                } else {
                    const newImage = approvedFiles[0]?.mediaFile || approvedFiles[0]
                    if (newImage) {
                        onChange(newImage)
                        addNotification('Image force uploaded and added to field', 'success')

                        if (approvedFiles.length > 1) {
                            addNotification(
                                `${approvedFiles.length - 1} additional image${approvedFiles.length - 1 !== 1 ? 's' : ''} uploaded to media library only`,
                                'info'
                            )
                        }
                    }
                }
            }

            // Clear upload state
            setUploadFiles([])
            setUploadTags([])
            setUploadErrors([])
            setShowForceUpload(false)

            onUploadComplete()

        } catch (error) {
            console.error('Force upload failed:', error)
            addNotification(`Force upload failed: ${error.message}`, 'error')
        } finally {
            setUploading(false)
        }
    }, [uploadFiles, namespace, setUploading, multiple, value, maxFiles, uploadTags, defaultCollection, setUploadFiles, setUploadTags, setUploadErrors, setShowForceUpload, onChange, onUploadComplete, addNotification])

    // Memoize file input click handler
    const handleFileInputClick = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    if (uploadFiles.length === 0) {
        return (
            <div
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${dragOver
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                    }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleFileInputClick}
            >
                <p className={`text-sm ${dragOver ? 'text-blue-700' : 'text-gray-600'}`}>
                    {dragOver ? 'Drop images here' : 'Drag and drop images here, or click to select files'}
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={getImageAcceptAttribute(constraints)}
                    onChange={handleFileInputChange}
                    className="hidden"
                />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Upload Queue Header */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">
                    Upload Queue ({uploadFiles.length} image{uploadFiles.length !== 1 ? 's' : ''})
                </h4>
                <button
                    onClick={removeAllUploadFiles}
                    className="text-sm text-red-600 hover:text-red-800"
                >
                    Remove All
                </button>
            </div>

            {/* Upload Preview */}
            <div className="grid grid-cols-4 gap-3">
                {uploadFiles.map((file, index) => {
                    const imageUrl = URL.createObjectURL(file)
                    return (
                        <div key={index} className="relative group">
                            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                                <img
                                    src={imageUrl}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <button
                                onClick={() => removeUploadFile(index)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove image"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <div className="mt-1 text-xs text-gray-500 truncate">
                                {file.name} ({formatFileSize(file.size)})
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Upload Errors */}
            {uploadErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
                        <div className="flex-1">
                            <h4 className="text-sm font-medium text-red-800 mb-2">
                                Upload validation failed
                            </h4>
                            <div className="space-y-1">
                                {uploadErrors.map((error, index) => (
                                    <div key={index} className="text-sm text-red-700">
                                        <strong>{error.filename}:</strong> {error.error}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Tags */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag className="w-4 h-4 inline mr-1" />
                    Tags (required for approval) {uploadTags.length > 0 && `(${uploadTags.length} selected)`}
                </label>
                <MediaTagWidget
                    tags={uploadTags}
                    onChange={setUploadTags}
                    namespace={namespace}
                />
            </div>

            {/* Upload Actions */}
            <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-gray-500">
                    {maxFiles && (
                        <>
                            {multiple ? (
                                `Will add up to ${Math.max(0, maxFiles - (Array.isArray(value) ? value.length : 0))} to field`
                            ) : (
                                'Will replace current selection'
                            )}
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {showForceUpload && (
                        <button
                            onClick={handleForceUpload}
                            disabled={uploading}
                            className="px-3 py-2 text-sm font-medium text-orange-700 bg-orange-100 border border-orange-300 rounded-md hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                        >
                            Force Upload Anyway
                        </button>
                    )}

                    <button
                        onClick={handleUploadAndApprove}
                        disabled={uploading || uploadTags.length === 0}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        {uploading ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Uploading...
                            </>
                        ) : (
                            'Upload & Approve'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default React.memo(ImageUploadSection)
