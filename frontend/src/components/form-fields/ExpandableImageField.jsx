import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Image } from 'lucide-react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import ImageUploadSection from './ImageUploadSection'
import ImageDisplaySection from './ImageDisplaySection'
import ImagePickerModal from './ImagePickerModal'
import {
    validateImageFile,
    getImageUrl,
    isImageFile
} from './ImageValidationUtils'

/**
 * ExpandableImageField - Image field with modal picker
 * 
 * Features:
 * - Compact preview mode showing selected images
 * - Full-screen modal for image selection
 * - Upload functionality with drag & drop
 * - Auto-tags and collection assignment
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
    allowedFileTypes = ['image'],
    allowedMimeTypes = [],
    allowedExtensions = '',
    validation,
    isValidating,
    showValidation = true,
    namespace,
    // Image constraints
    constraints = {},
    // Auto-tags for uploads
    autoTags = '',
    // Default collection for uploads
    defaultCollection = null,
    // Max files limit
    maxFiles = null
}) => {
    // Memoize constraints to prevent recreation on every render
    const imageConstraints = useMemo(() => {
        const defaultConstraints = {
            allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            minWidth: null,
            maxWidth: null,
            minHeight: null,
            maxHeight: null,
            minSize: null,
            maxSize: 10 * 1024 * 1024, // 10MB
            aspectRatio: null,
            exactDimensions: null
        }
        return { ...defaultConstraints, ...constraints }
    }, [constraints])
    
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Upload state
    const [uploadFiles, setUploadFiles] = useState([])
    const [uploading, setUploading] = useState(false)
    const [uploadTags, setUploadTags] = useState([])
    const [dragOver, setDragOver] = useState(false)
    const [uploadErrors, setUploadErrors] = useState([])
    const [showForceUpload, setShowForceUpload] = useState(false)
    const [collectionOverride, setCollectionOverride] = useState(null)
    const [originalAutoTags, setOriginalAutoTags] = useState([])
    const [animatingItemId, setAnimatingItemId] = useState(null)

    const { addNotification } = useGlobalNotifications()
    const fieldRef = useRef(null)

    // Memoize display values to prevent recalculation
    const displayImages = useMemo(() => {
        if (multiple) {
            return Array.isArray(value) ? value : []
        }
        return value ? [value] : []
    }, [value, multiple])

    // Parse auto-tags array into tag objects
    const parseAutoTags = useCallback(async (autoTagsConfig) => {
        if (!autoTagsConfig || !namespace) return []

        // Handle both string (legacy) and array (new) formats
        let tagsToProcess = []

        if (typeof autoTagsConfig === 'string') {
            const tagNames = autoTagsConfig.split(',').map(name => name.trim()).filter(name => name.length > 0)
            tagsToProcess = tagNames.map(name => ({ name }))
        } else if (Array.isArray(autoTagsConfig)) {
            tagsToProcess = autoTagsConfig.filter(tag => tag && tag.name)
        } else {
            return []
        }

        if (tagsToProcess.length === 0) return []

        try {
            const tagPromises = tagsToProcess.map(async (tagConfig) => {
                const tagName = tagConfig.name
                try {
                    if (tagConfig.id) {
                        return tagConfig
                    }

                    const response = await mediaApi.tags.list({
                        namespace,
                        name: tagName,
                        pageSize: 1
                    })()

                    if (response.results?.length > 0) {
                        return response.results[0]
                    }

                    const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                    return await mediaApi.tags.create({
                        name: tagName,
                        slug: slug,
                        namespace,
                        description: `Auto-generated tag: ${tagName}`
                    })()
                } catch (error) {
                    console.warn(`Failed to get/create tag "${tagName}":`, error)
                    return null
                }
            })

            const tags = await Promise.all(tagPromises)
            return tags.filter(tag => tag !== null)
        } catch (error) {
            console.warn('Failed to parse auto-tags:', error)
            return []
        }
    }, [namespace])

    // Get image URL - use backend-provided thumbnail for optimal performance
    const getThumbnailUrl = useCallback((image, size = 150) => {
        // Use backend-provided thumbnail if available (pre-generated 150x150)
        if (image.thumbnail_url || image.thumbnailUrl) {
            return image.thumbnail_url || image.thumbnailUrl
        }
        // Fallback to full URL
        return getImageUrl(image)
    }, [])

    // Initialize upload tags with auto-tags when component mounts
    useEffect(() => {
        const initializeWithAutoTags = async () => {
            if (autoTags && namespace) {
                try {
                    const tags = await parseAutoTags(autoTags)
                    if (tags.length > 0) {
                        setOriginalAutoTags(tags)
                        if (uploadTags.length === 0) {
                            setUploadTags(tags)
                        }
                    }
                } catch (error) {
                    console.warn('Failed to initialize auto-tags:', error)
                }
            }
        }

        initializeWithAutoTags()
    }, [autoTags, namespace, parseAutoTags])

    // Handle image selection
    const handleImageSelect = useCallback((image, event) => {
        if (multiple) {
            const currentImages = Array.isArray(value) ? value : []
            const isAlreadySelected = currentImages.some(img => img.id === image.id)

            if (isAlreadySelected) {
                onChange(currentImages.filter(img => img.id !== image.id))
            } else {
                if (maxItems && currentImages.length >= maxItems) {
                    addNotification(`Maximum ${maxItems} images allowed`, 'warning')
                    return
                }

                setAnimatingItemId(image.id)
                onChange([...currentImages, image])
                
                setTimeout(() => {
                    setAnimatingItemId(null)
                }, 600)
            }
        } else {
            setAnimatingItemId(image.id)
            onChange(image)
            
            setTimeout(() => {
                setAnimatingItemId(null)
                setIsModalOpen(false)
            }, 600)
        }
    }, [multiple, value, maxItems, addNotification, onChange])

    // Remove an image from field
    const handleRemoveImage = useCallback((imageId, event) => {
        if (multiple) {
            const currentImages = Array.isArray(value) ? value : []
            onChange(currentImages.filter(img => img.id !== imageId))
        } else {
            onChange(null)
        }
    }, [multiple, value, onChange])

    // Drag and drop handlers
    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)

        if (!isModalOpen) {
            setIsModalOpen(true)
        }

        const droppedFiles = Array.from(e.dataTransfer.files)
        const validFiles = []
        const invalidFiles = []
        const uploadOnlyFiles = []

        const currentImageCount = multiple ? (Array.isArray(value) ? value.length : 0) : 0

        droppedFiles.forEach(file => {
            if (!isImageFile(file)) {
                invalidFiles.push({ file, errors: ['Only image files are allowed'] })
                return
            }

            const validation = validateImageFile(file, imageConstraints, currentImageCount, maxFiles)
            if (validation.isValid) {
                if (validation.canAddToField) {
                    validFiles.push(file)
                } else {
                    uploadOnlyFiles.push({ file, fieldErrors: validation.fieldErrors })
                }
            } else {
                invalidFiles.push({ file, errors: validation.uploadErrors })
            }
        })

        if (validFiles.length > 0) {
            setUploadFiles(validFiles)

            if (autoTags && ((typeof autoTags === 'string' && autoTags.trim()) || (Array.isArray(autoTags) && autoTags.length > 0))) {
                parseAutoTags(autoTags).then(tags => {
                    if (tags.length > 0) {
                        setUploadTags(tags)
                    }
                }).catch(error => {
                    console.warn('Failed to initialize auto-tags:', error)
                })
            }
        }

        if (uploadOnlyFiles.length > 0) {
            const warningMessages = uploadOnlyFiles.map(({ file, fieldErrors }) =>
                `${file.name}: ${fieldErrors.join(', ')} - will be uploaded to media library only`
            )
            addNotification(`Type mismatch warnings:\n${warningMessages.join('\n')}`, 'warning')
        }

        if (invalidFiles.length > 0) {
            const errorMessages = invalidFiles.map(({ file, errors }) =>
                `${file.name}: ${errors.join(', ')}`
            )
            addNotification(`Upload rejected:\n${errorMessages.join('\n')}`, 'error')
        }
    }, [imageConstraints, maxFiles, addNotification, autoTags, parseAutoTags, setUploadFiles, setUploadTags, multiple, value, isModalOpen])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        setDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)
    }, [])

    const handleFileInputChange = useCallback((e) => {
        const selectedFiles = Array.from(e.target.files)
        const validFiles = []
        const invalidFiles = []
        const uploadOnlyFiles = []

        const currentImageCount = multiple ? (Array.isArray(value) ? value.length : 0) : 0

        selectedFiles.forEach(file => {
            if (!isImageFile(file)) {
                invalidFiles.push({ file, errors: ['Only image files are allowed'] })
                return
            }

            const validation = validateImageFile(file, imageConstraints, currentImageCount, maxFiles)
            if (validation.isValid) {
                if (validation.canAddToField) {
                    validFiles.push(file)
                } else {
                    uploadOnlyFiles.push({ file, fieldErrors: validation.fieldErrors })
                }
            } else {
                invalidFiles.push({ file, errors: validation.uploadErrors })
            }
        })
        
        if (validFiles.length > 0) {
            setUploadFiles(validFiles)
            if (autoTags && ((typeof autoTags === 'string' && autoTags.trim()) || (Array.isArray(autoTags) && autoTags.length > 0))) {
                parseAutoTags(autoTags).then(tags => {
                    if (tags.length > 0) {
                        setUploadTags(tags)
                    }
                }).catch(error => {
                    console.warn('Failed to initialize auto-tags:', error)
                })
            }
        }

        if (uploadOnlyFiles.length > 0) {
            const warningMessages = uploadOnlyFiles.map(({ file, fieldErrors }) =>
                `${file.name}: ${fieldErrors.join(', ')} - will be uploaded to media library only`
            )
            addNotification(`Type mismatch warnings:\n${warningMessages.join('\n')}`, 'warning')
        }

        if (invalidFiles.length > 0) {
            const errorMessages = invalidFiles.map(({ file, errors }) =>
                `${file.name}: ${errors.join(', ')}`
            )
            addNotification(`Upload rejected:\n${errorMessages.join('\n')}`, 'error')
        }

        e.target.value = ''
    }, [imageConstraints, maxFiles, addNotification, autoTags, parseAutoTags, setUploadFiles, setUploadTags, multiple, value])

    const hasImages = displayImages.length > 0
    const hasError = showValidation && validation && !validation.isValid
    const errorMessage = hasError ? validation.message : null

    const handleUploadComplete = useCallback(() => {
        setIsModalOpen(false)
    }, [])

    // Get effective collection (considering override)
    const getEffectiveCollection = useCallback(() => {
        if (collectionOverride === false) return null
        return defaultCollection
    }, [collectionOverride, defaultCollection])

    // Handle collection removal
    const handleRemoveDefaultCollection = useCallback(() => {
        setCollectionOverride(false)
        addNotification('Images will not be added to any collection', 'info')
    }, [addNotification])

    // Restore original auto-tags
    const handleRestoreAutoTags = useCallback(() => {
        if (originalAutoTags.length > 0) {
            setUploadTags([...originalAutoTags])
            addNotification(`Restored ${originalAutoTags.length} default tag${originalAutoTags.length !== 1 ? 's' : ''}`, 'info')
        }
    }, [originalAutoTags, addNotification])

    // Memoize upload section props to prevent unnecessary rerenders
    const uploadSectionProps = useMemo(() => ({
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
        constraints: imageConstraints,
        defaultCollection: getEffectiveCollection(),
        onRemoveDefaultCollection: handleRemoveDefaultCollection,
        originalAutoTags,
        onRestoreAutoTags: handleRestoreAutoTags,
        maxFiles,
        value,
        multiple,
        onChange,
        onUploadComplete: handleUploadComplete,
        parseAutoTags,
        autoTags,
        handleDrop,
        handleDragOver,
        handleDragLeave,
        handleFileInputChange
    }), [
        uploadFiles, setUploadFiles, uploading, setUploading, uploadTags, setUploadTags,
        uploadErrors, setUploadErrors, showForceUpload, setShowForceUpload, dragOver,
        namespace, imageConstraints, getEffectiveCollection, handleRemoveDefaultCollection,
        originalAutoTags, handleRestoreAutoTags, maxFiles, value, multiple,
        onChange, handleUploadComplete, parseAutoTags, autoTags, handleDrop,
        handleDragOver, handleDragLeave, handleFileInputChange
    ])

    // Memoize display section props
    const displaySectionProps = useMemo(() => ({
        images: displayImages,
        multiple,
        maxFiles,
        onRemoveImage: (imageId, event) => handleRemoveImage(imageId, event),
        onOpenModal: () => setIsModalOpen(true),
        getThumbnailUrl,
        namespace,
        onImageTagsChanged: (updatedFile) => {
            if (multiple) {
                const updatedImages = (Array.isArray(value) ? value : []).map(img =>
                    img.id === updatedFile.id ? { ...img, tags: updatedFile.tags } : img
                )
                onChange(updatedImages)
            } else {
                if (value && value.id === updatedFile.id) {
                    onChange({ ...value, tags: updatedFile.tags })
                }
            }
        }
    }), [displayImages, multiple, maxFiles, handleRemoveImage, getThumbnailUrl, namespace, value, onChange])

    return (
        <div ref={fieldRef} className="space-y-3">
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

            {/* Main Container with Dropzone */}
            <div
                className={`border-2 rounded-lg transition-all duration-300 ${hasError
                    ? 'border-red-300'
                    : dragOver && !hasImages
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-300'
                    }`}
                onDrop={!hasImages ? handleDrop : undefined}
                onDragOver={!hasImages ? handleDragOver : undefined}
                onDragLeave={!hasImages ? handleDragLeave : undefined}
            >
                {hasImages ? (
                    /* Selected Images Display */
                    <ImageDisplaySection {...displaySectionProps} />
                ) : (
                    /* Empty State with Dropzone */
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className={`w-full flex items-center justify-center gap-2 p-6 transition-colors ${
                            hasError
                                ? 'border-dashed hover:bg-red-50'
                                : dragOver
                                    ? 'border-dashed bg-blue-100'
                                    : 'border-dashed hover:bg-blue-50'
                            }`}
                    >
                        <Image className={`w-6 h-6 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className={`${dragOver ? 'text-blue-700' : 'text-gray-600'}`}>
                            {dragOver
                                ? 'Drop images here to upload'
                                : `Select Image${multiple ? 's' : ''} from Media Library`
                            }
                        </span>
                    </button>
                )}
            </div>

            {/* Validation and Help Text */}
            {showValidation && hasError && (
                <div className="text-red-500 text-sm mt-1">{errorMessage}</div>
            )}

            {multiple && (maxItems || minItems) && (
                <div className="text-xs text-gray-500">
                    {minItems && `Minimum: ${minItems} image${minItems !== 1 ? 's' : ''}`}
                    {minItems && maxItems && ' • '}
                    {maxItems && `Maximum: ${maxItems} image${maxItems !== 1 ? 's' : ''}`}
                </div>
            )}

            {/* Image Picker Modal */}
            <ImagePickerModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                value={value}
                onChange={onChange}
                multiple={multiple}
                maxItems={maxItems}
                namespace={namespace}
                imageConstraints={imageConstraints}
                autoTags={autoTags}
                defaultCollection={defaultCollection}
                maxFiles={maxFiles}
                allowedFileTypes={allowedFileTypes}
                allowedMimeTypes={allowedMimeTypes}
                parseAutoTags={parseAutoTags}
                uploadSectionProps={uploadSectionProps}
                getThumbnailUrl={getThumbnailUrl}
                handleImageSelect={handleImageSelect}
                animatingItemId={animatingItemId}
            />
        </div>
    )
}

export default ExpandableImageField
