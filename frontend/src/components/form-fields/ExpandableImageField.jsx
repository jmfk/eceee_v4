import React, { useState, useEffect, useCallback } from 'react'
import { Image, FolderOpen, X, Eye, Search, Grid3X3, List, Loader2, ChevronDown, ChevronUp, Upload, Tag, Check } from 'lucide-react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import { generateThumbnailUrl } from '../../utils/imgproxy'
import MediaSearchWidget from '../media/MediaSearchWidget'
import MediaTagWidget from '../media/MediaTagWidget'

/**
 * ExpandableImageField - Form field component for image selection with inline expansion
 * 
 * Features:
 * - Expandable interface with search form and thumbnail grid
 * - 9x9 thumbnail grid layout for image results
 * - Inline search and filtering
 * - Single or multiple image selection
 * - Preview of selected images
 */
const ExpandableImageField = ({
    value,
    onChange,
    label,
    description,
    required,
    multiple = false,
    maxItems = null,
    minItems = null,
    validation,
    isValidating,
    showValidation = true,
    namespace
}) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [searchTerms, setSearchTerms] = useState([])
    const [images, setImages] = useState([])
    const [loading, setLoading] = useState(false)
    const [selectedImageIds, setSelectedImageIds] = useState(new Set())
    const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 12, // 4x3 grid = 12 images per page
        total: 0,
        hasNext: false,
        hasPrev: false
    })

    // Upload state
    const [uploadFiles, setUploadFiles] = useState([])
    const [uploading, setUploading] = useState(false)
    const [uploadTags, setUploadTags] = useState([])
    const [dragOver, setDragOver] = useState(false)

    const { addNotification } = useGlobalNotifications()

    // Format file size
    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    // Generate image URL for display
    const getImageUrl = (image, size = null) => {
        // For full-size images, prefer imgproxy base URL or file URL
        if (!size) {
            return image.imgproxyBaseUrl || image.fileUrl || image.file_url || image.url
        }

        // For thumbnails, use thumbnail_url if available and matches size
        if (image.thumbnail_url && size <= 150) {
            return image.thumbnail_url
        }

        // Generate thumbnail using imgproxy
        const sourceUrl = image.imgproxyBaseUrl || image.fileUrl || image.file_url || image.url
        return sourceUrl ? generateThumbnailUrl(sourceUrl, size, size) : null
    }

    // Generate full-size image URL for viewing
    const getFullImageUrl = (image) => {
        // Use the best available full-size URL
        return image.imgproxyBaseUrl || image.fileUrl || image.file_url || image.url
    }

    // Load images
    const loadImages = useCallback(async (page = 1, append = false) => {
        if (!namespace || !isExpanded) {
            return
        }

        setLoading(true)
        try {
            const params = {
                page,
                pageSize: pagination.pageSize, // Use pageSize like other components
                namespace,
                fileType: 'image', // Use fileType like other components
                ordering: '-created_at',
                // Convert search terms to structured search parameters
                ...((() => {
                    const textTerms = searchTerms.filter(term => term.type === 'text')
                    const tagTerms = searchTerms.filter(term => term.type === 'tag')
                    const searchParams = {}

                    if (textTerms.length > 0) {
                        searchParams.text_search = textTerms[0].value
                    }

                    if (tagTerms.length > 0) {
                        searchParams.tag_names = tagTerms.map(term => term.value)
                    }

                    return searchParams
                })())
            }

            // Use search API if there are search terms, otherwise use files list
            let result
            if (searchTerms.length > 0) {
                result = await mediaApi.search.search(params)()
            } else {
                result = await mediaApi.files.list(params)()
            }
            const newImages = result.results || result || []
            setImages(newImages) // Always replace, no more appending
            setPagination({
                page,
                pageSize: pagination.pageSize,
                total: result.count || newImages.length,
                hasNext: result.next != null,
                hasPrev: page > 1
            })
        } catch (error) {
            console.error('Failed to load images:', error)
            addNotification('Failed to load images', 'error')
        } finally {
            setLoading(false)
        }
    }, [namespace, searchTerms, pagination.pageSize, addNotification, isExpanded])

    // Load images when expanded or dependencies change
    useEffect(() => {
        if (isExpanded) {
            loadImages(1, false)
        }
    }, [loadImages, isExpanded])

    // Handle image selection
    const handleImageSelect = (image) => {
        if (multiple) {
            const currentImages = Array.isArray(value) ? value : []
            const isAlreadySelected = currentImages.some(img => img.id === image.id)

            if (isAlreadySelected) {
                // Remove from selection
                onChange(currentImages.filter(img => img.id !== image.id))
            } else {
                // Add to selection
                if (maxItems && currentImages.length >= maxItems) {
                    addNotification(`Maximum ${maxItems} images allowed`, 'warning')
                    return
                }
                onChange([...currentImages, image])
            }
        } else {
            // Single selection
            onChange(image)
            setIsExpanded(false) // Collapse after selection
        }
    }

    // Remove an image
    const handleRemoveImage = (imageId) => {
        if (multiple) {
            const currentImages = Array.isArray(value) ? value : []
            onChange(currentImages.filter(img => img.id !== imageId))
        } else {
            onChange(null)
        }
    }

    // Handle search
    const handleSearchChange = (newSearchTerms) => {
        setSearchTerms(newSearchTerms)
        setPagination(prev => ({ ...prev, page: 1 }))
    }

    // Pagination handlers
    const goToNextPage = () => {
        if (pagination.hasNext && !loading) {
            loadImages(pagination.page + 1, false)
        }
    }

    const goToPrevPage = () => {
        if (pagination.hasPrev && !loading) {
            loadImages(pagination.page - 1, false)
        }
    }

    const goToPage = (page) => {
        if (page !== pagination.page && !loading) {
            loadImages(page, false)
        }
    }

    // Handle file drop
    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)

        const files = Array.from(e.dataTransfer.files).filter(file =>
            file.type.startsWith('image/')
        )

        if (files.length > 0) {
            setUploadFiles(files)
        }
    }, [])

    // Handle drag events
    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        setDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)
    }, [])

    // Handle file input change
    const handleFileSelect = useCallback((e) => {
        const files = Array.from(e.target.files).filter(file =>
            file.type.startsWith('image/')
        )

        if (files.length > 0) {
            setUploadFiles(files)
        }

        // Reset input
        e.target.value = ''
    }, [])

    // Upload and approve images
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

            // Auto-approve with tags for single image widget
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
                    console.error('Approval error response:', error.response?.data)
                    console.error('Approval error status:', error.response?.status)
                    return null
                }
            })

            const approvedFiles = (await Promise.all(approvalPromises)).filter(Boolean)

            if (approvedFiles.length > 0) {
                const approvalResponse = approvedFiles[0]

                // Extract the actual media file from the response
                const selectedImage = approvalResponse.mediaFile || approvalResponse

                // Ensure the image object has all required fields for display
                const formattedImage = {
                    id: selectedImage.id,
                    title: selectedImage.title,
                    file_type: selectedImage.fileType || 'image',
                    fileSize: selectedImage.fileSize,
                    file_size: selectedImage.fileSize,
                    dimensions: selectedImage.dimensions,
                    description: selectedImage.description,
                    thumbnail_url: selectedImage.thumbnail_url,
                    imgproxyBaseUrl: selectedImage.imgproxyBaseUrl,
                    fileUrl: selectedImage.fileUrl,
                    file_url: selectedImage.fileUrl,
                    url: selectedImage.url || selectedImage.fileUrl
                }

                // For single image widget, replace the current image
                onChange(formattedImage)

                // Refresh the image list to show the newly approved image
                if (isExpanded) {
                    loadImages(1, false)
                }

                setIsExpanded(false)
                addNotification('Image uploaded and added successfully', 'success')
            } else {
                addNotification('No files were successfully approved', 'warning')
            }

            // Clear upload state
            setUploadFiles([])
            setUploadTags([])

        } catch (error) {
            console.error('Upload failed:', error)
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                stack: error.stack
            })

            // Show more specific error message
            const errorMessage = error.response?.data?.detail ||
                error.response?.data?.error ||
                error.message ||
                'Upload failed'
            addNotification(`Failed to upload image: ${errorMessage}`, 'error')
        } finally {
            setUploading(false)
        }
    }, [uploadFiles, namespace, uploadTags, onChange, addNotification])

    // Remove upload file
    const removeUploadFile = useCallback((index) => {
        setUploadFiles(prev => prev.filter((_, i) => i !== index))
    }, [])

    // Get display value for rendering
    const getDisplayValue = () => {
        if (multiple) {
            return Array.isArray(value) ? value : []
        }
        const result = value ? [value] : []
        return result
    }

    const displayImages = getDisplayValue()
    const hasImages = displayImages.length > 0
    const canAddMore = multiple ? (!maxItems || displayImages.length < maxItems) : !hasImages
    const canReplace = !multiple && hasImages // Allow replacement for single image fields

    // Validation state
    const hasError = showValidation && validation && !validation.isValid
    const errorMessage = hasError ? validation.message : null

    // Check if image is selected
    const isImageSelected = (image) => {
        if (multiple) {
            const currentImages = Array.isArray(value) ? value : []
            return currentImages.some(img => img.id === image.id)
        }
        return value && value.id === image.id
    }

    // Render grid item
    const renderGridItem = (image) => {
        const isSelected = isImageSelected(image)

        return (
            <div
                key={image.id}
                className={`relative aspect-square cursor-pointer border-2 rounded-lg overflow-hidden transition-all duration-200 ${isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                onClick={() => handleImageSelect(image)}
                title={image.title}
            >
                {/* Selection indicator */}
                {isSelected && (
                    <div className="absolute top-1 right-1 z-10 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                )}

                {/* Image */}
                <img
                    src={getImageUrl(image, 200) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-size="12">IMG</text></svg>'}
                    alt={image.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-size="12">IMG</text></svg>'
                    }}
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                    <Eye className="w-4 h-4 text-white" />
                </div>
            </div>
        )
    }

    // Render list item
    const renderListItem = (image) => {
        const isSelected = isImageSelected(image)

        return (
            <div
                key={image.id}
                className={`flex items-center gap-4 p-3 cursor-pointer border rounded-lg transition-all duration-200 ${isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                onClick={() => handleImageSelect(image)}
            >
                {/* Selection checkbox */}
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>

                {/* Image thumbnail */}
                <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                    <img
                        src={getImageUrl(image, 48) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-size="12">IMG</text></svg>'}
                        alt={image.title}
                        className="w-full h-full object-cover rounded"
                        onError={(e) => {
                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-size="12">IMG</text></svg>'
                        }}
                    />
                </div>

                {/* Image details */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{image.title}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="capitalize">{image.file_type}</span>
                        <span>{formatFileSize(image.fileSize || image.file_size)}</span>
                        {image.dimensions && <span>{image.dimensions}</span>}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {getFullImageUrl(image) && (
                        <button
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation()
                                window.open(getFullImageUrl(image), '_blank')
                            }}
                            title="View full-size image"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* Label and Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {description && (
                    <p className="text-sm text-gray-500 mt-1">{description}</p>
                )}
            </div>

            {/* Unified Container with Border */}
            <div className={`border-2 rounded-lg transition-all duration-300 ${hasError
                ? 'border-red-300'
                : isExpanded
                    ? 'border-blue-300 shadow-md'
                    : 'border-gray-300'
                }`}>
                {/* Unified Image Selection/Display */}
                {hasImages ? (
                    /* Selected Image Display with Replace Button */
                    <div className={`transition-colors ${isExpanded
                        ? 'border-b border-gray-200 bg-gray-50 rounded-t-md'
                        : 'rounded-md'
                        }`}>
                        {displayImages.map((image) => (
                            <div key={image.id} className="flex items-center space-x-3 p-4">
                                {/* Image Preview */}
                                <div className="flex-shrink-0">
                                    <img
                                        src={getImageUrl(image, 48) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-size="12">IMG</text></svg>'}
                                        alt={image.title}
                                        className="w-12 h-12 object-cover rounded"
                                        onError={(e) => {
                                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-size="12">IMG</text></svg>'
                                        }}
                                    />
                                </div>

                                {/* Image Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-900 truncate">
                                        {image.title}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                        {image.file_type} • {formatFileSize(image.fileSize)}
                                    </div>
                                    {image.dimensions && (
                                        <div className="text-xs text-gray-400 truncate mt-1">
                                            {image.dimensions}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center space-x-1">
                                    {getFullImageUrl(image) && (
                                        <a
                                            href={getFullImageUrl(image)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 text-gray-400 hover:text-blue-600"
                                            title="View full-size image"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setIsExpanded(!isExpanded)}
                                        className="p-1 text-gray-400 hover:text-blue-600"
                                        title={isExpanded ? "Collapse" : "Replace image"}
                                    >
                                        {isExpanded ? (
                                            <ChevronUp className="w-4 h-4" />
                                        ) : (
                                            <FolderOpen className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveImage(image.id)}
                                        className="p-1 text-gray-400 hover:text-red-600"
                                        title="Remove image"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Empty State Selection Button */
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`w-full flex items-center justify-center gap-2 p-6 transition-colors ${isExpanded
                            ? 'border-b border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-t-md'
                            : hasError
                                ? 'border-dashed hover:bg-red-50 rounded-md'
                                : 'border-dashed hover:bg-blue-50 rounded-md'
                            }`}
                    >
                        <FolderOpen className="w-6 h-6 text-gray-400" />
                        <span className="text-gray-600">
                            Select Image from Media Library
                        </span>
                        {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                    </button>
                )}

                {/* Expandable Media Picker */}
                {isExpanded && (
                    <div className="bg-white rounded-b-md">
                        {/* Upload Dropzone */}
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            {/* Dropzone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={`relative border border-dashed rounded-md p-3 text-center transition-colors ${dragOver
                                    ? 'border-blue-400 bg-blue-50'
                                    : 'border-gray-300 hover:border-gray-400'
                                    }`}
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileSelect}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    disabled={uploading}
                                />
                                <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                <p className="text-xs text-gray-600">
                                    {dragOver ? 'Drop image here' : 'Drag & drop or click to select'}
                                </p>
                            </div>

                            {/* Upload Files Preview */}
                            {uploadFiles.length > 0 && (
                                <div className="mt-4 space-y-3">
                                    <h5 className="text-sm font-medium text-gray-700">Files to Upload:</h5>
                                    {uploadFiles.map((file, index) => (
                                        <div key={index} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                                            <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden">
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt={file.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                                <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                                            </div>
                                            <button
                                                onClick={() => removeUploadFile(index)}
                                                className="p-1 text-gray-400 hover:text-red-600"
                                                disabled={uploading}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Tag Field */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            <Tag className="inline w-4 h-4 mr-1" />
                                            Tags (required for approval)
                                        </label>
                                        <MediaTagWidget
                                            tags={uploadTags}
                                            onChange={setUploadTags}
                                            namespace={namespace}
                                            disabled={uploading}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Add tags to help organize and find this image later
                                        </p>
                                    </div>

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
                                                    Upload & Use Image
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Search Section */}
                        <div className="p-4 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Select Images {multiple && displayImages.length > 0 && `(${displayImages.length}${maxItems ? `/${maxItems}` : ''})`}
                                </h3>
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
                                    <button
                                        onClick={() => setIsExpanded(false)}
                                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <MediaSearchWidget
                                searchTerms={searchTerms}
                                onChange={handleSearchChange}
                                namespace={namespace}
                                placeholder="Search images..."
                            />
                        </div>

                        {/* Image Grid */}
                        <div className="p-4">
                            {loading && images.length === 0 ? (
                                <div className="flex items-center justify-center h-64">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            ) : images.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                    <Image className="w-16 h-16 mb-4" />
                                    <p className="text-lg font-medium">No images found</p>
                                    <p className="text-sm">Try adjusting your search terms</p>
                                </div>
                            ) : (
                                <>
                                    {/* Pagination Controls - Above Images */}
                                    {(pagination.hasNext || pagination.hasPrev || pagination.total > 12) && (
                                        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-200">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={goToPrevPage}
                                                    disabled={!pagination.hasPrev || loading}
                                                    className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    <ChevronDown className="w-4 h-4 rotate-90" />
                                                    Previous
                                                </button>
                                                <button
                                                    onClick={goToNextPage}
                                                    disabled={!pagination.hasNext || loading}
                                                    className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Next
                                                    <ChevronDown className="w-4 h-4 -rotate-90" />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <span>Page {pagination.page}</span>
                                                {pagination.total > 0 && (
                                                    <span>• Showing {Math.min(12, images.length)} of {pagination.total} images</span>
                                                )}
                                                {loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                                            </div>
                                        </div>
                                    )}

                                    {/* Image Display */}
                                    <div className={
                                        viewMode === 'grid'
                                            ? 'grid grid-cols-4 gap-3'
                                            : 'space-y-2'
                                    }>
                                        {images.slice(0, 12).map((image) =>
                                            viewMode === 'grid' ? renderGridItem(image) : renderListItem(image)
                                        )}
                                    </div>

                                    {/* Image Count Info */}
                                    {images.length > 0 && (
                                        <div className="text-center py-3 text-sm text-gray-500">
                                            Showing {Math.min(12, images.length)} images
                                            {pagination.total > 12 && ` (${pagination.total} total)`}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>


            {/* Validation Message */}
            {hasError && (
                <div className="text-sm text-red-600">
                    {errorMessage}
                </div>
            )}

            {/* Loading State */}
            {isValidating && (
                <div className="text-sm text-blue-600">
                    Validating...
                </div>
            )}

            {/* Limits Info */}
            {multiple && (maxItems || minItems) && (
                <div className="text-xs text-gray-500">
                    {minItems && `Minimum: ${minItems} image${minItems !== 1 ? 's' : ''}`}
                    {minItems && maxItems && ' • '}
                    {maxItems && `Maximum: ${maxItems} image${maxItems !== 1 ? 's' : ''}`}
                </div>
            )}
        </div>
    )
}

export default ExpandableImageField
