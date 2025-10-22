import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Image, FolderOpen, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Grid3X3, List } from 'lucide-react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import MediaSearchWidget from '../media/MediaSearchWidget'
import ImageUploadSection from './ImageUploadSection'
import ImageDisplaySection from './ImageDisplaySection'
import {
    validateImageFile,
    getImageTypeInfo,
    formatFileSize,
    getImageUrl,
    getImageAcceptAttribute,
    getAllowedImageTypes,
    isImageFile
} from './ImageValidationUtils'

/**
 * Memoized image grid item to prevent unnecessary rerenders
 */
const ImageGridItem = React.memo(({ image, isSelected, thumbnailUrl, onSelect, isAnimating }) => {
    const handleClick = useCallback((event) => {
        onSelect(image, event)
    }, [image, onSelect])

    return (
        <div
            className={`relative aspect-square cursor-pointer border-2 rounded-lg overflow-hidden transition-all duration-500 ${isAnimating
                ? 'opacity-30 scale-95' // Shadow state - faded and slightly smaller
                : isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
            onClick={handleClick}
            title={image.title || image.originalFilename || image.original_filename}
        >
            {isSelected && (
                <div className="absolute top-1 right-1 z-10 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                </div>
            )}

            <div className="w-full h-full bg-gray-100">
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={image.title || image.original_filename || 'Image'}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-8 h-8 text-gray-400" />
                    </div>
                )}
            </div>
        </div>
    )
})

ImageGridItem.displayName = 'ImageGridItem'

/**
 * ExpandableImageField - Refactored version with modular components
 * 
 * Features:
 * - Expandable interface with search form and image grid
 * - Configurable image constraints and filtering
 * - Single or multiple image selection
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
    allowedFileTypes = ['image', 'video', 'audio'],
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
    const [isExpanded, setIsExpanded] = useState(false)
    const [searchTerms, setSearchTerms] = useState([])
    const [images, setImages] = useState([])
    const [loading, setLoading] = useState(false)
    const [viewMode, setViewMode] = useState('grid')
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 12,
        total: 0,
        hasNext: false,
        hasPrev: false
    })

    // Upload state
    const [uploadFiles, setUploadFiles] = useState([])
    const [uploading, setUploading] = useState(false)
    const [uploadTags, setUploadTags] = useState([])
    const [dragOver, setDragOver] = useState(false)
    const [uploadErrors, setUploadErrors] = useState([])
    const [showForceUpload, setShowForceUpload] = useState(false)
    const [collectionOverride, setCollectionOverride] = useState(null) // null = use default, false = no collection
    const [originalAutoTags, setOriginalAutoTags] = useState([]) // Store original auto-tags for restoration
    const [animatingItemId, setAnimatingItemId] = useState(null) // Track item being animated
    const [animationState, setAnimationState] = useState(null) // Track complex animation state

    const { addNotification } = useGlobalNotifications()
    const fieldRef = useRef(null)

    // Memoize display values to prevent recalculation - must be defined early
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

    // Scroll field into view
    const scrollToField = useCallback(() => {
        if (fieldRef.current) {
            fieldRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            })
        }
    }, [])

    // Get image URL - use backend-provided thumbnail for optimal performance
    const getThumbnailUrl = (image, size = 150) => {
        // Use backend-provided thumbnail if available (pre-generated 150x150)
        if (image.thumbnail_url || image.thumbnailUrl) {
            return image.thumbnail_url || image.thumbnailUrl
        }
        // Fallback to full URL
        return getImageUrl(image)
    }

    // Load images from media library
    const loadImages = useCallback(async (page = 1) => {
        if (!namespace || !isExpanded) return

        setLoading(true)
        try {
            const params = {
                page,
                pageSize: pagination.pageSize,
                namespace,
                ordering: '-created_at',
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
                })()),
                file_types: allowedFileTypes,
                mime_types: allowedMimeTypes
            }
            let result
            if (searchTerms.length > 0) {
                result = await mediaApi.search.search(params)
            } else {
                result = await mediaApi.files.list(params)()
            }
            let newImages = result.results || result || []

            // Filter out already selected images
            const selectedImageIds = new Set(displayImages.map(img => img.id))
            newImages = newImages.filter(image => !selectedImageIds.has(image.id))

            setImages(newImages)
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
    }, [namespace, searchTerms, pagination.pageSize, addNotification, isExpanded, imageConstraints, displayImages])

    // Load images when expanded
    useEffect(() => {
        if (isExpanded) {
            loadImages(1)
        }
    }, [loadImages, isExpanded])

    // Initialize search terms and store original auto-tags when component mounts or auto-tags change
    useEffect(() => {
        const initializeWithAutoTags = async () => {
            if (autoTags && namespace) {
                try {
                    const tags = await parseAutoTags(autoTags)
                    if (tags.length > 0) {
                        // Store original auto-tags for restoration
                        setOriginalAutoTags(tags)

                        // Set search terms if empty
                        if (searchTerms.length === 0) {
                            const tagSearchTerms = tags.map(tag => ({
                                type: 'tag',
                                value: tag.name,
                                label: tag.name,
                                id: tag.id
                            }))
                            setSearchTerms(tagSearchTerms)
                        }

                        // Initialize upload tags if empty
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

    // Handle image selection with clone animation
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

                startSelectionAnimation(image, event)
            }
        } else {
            startSelectionAnimation(image, event, true) // Single selection closes field
        }
    }, [multiple, value, maxItems, addNotification])

    // Start selection animation
    const startSelectionAnimation = useCallback((image, event, closesField = false) => {
        const sourceElement = event?.currentTarget
        if (!sourceElement || !fieldRef.current) return

        const sourceRect = sourceElement.getBoundingClientRect()
        const fieldRect = fieldRef.current.getBoundingClientRect()

        // Calculate destination position (top of the field)
        const destinationTop = fieldRect.top - 20
        const destinationLeft = fieldRect.left + 20

        const thumbnailUrl = getThumbnailUrl(image, 150)

        // Create animation state
        setAnimationState({
            type: 'selection',
            image,
            thumbnailUrl,
            clone: {
                startPos: { top: sourceRect.top, left: sourceRect.left, width: sourceRect.width, height: sourceRect.height },
                endPos: { top: destinationTop, left: destinationLeft, width: 60, height: 60 },
                element: sourceElement.cloneNode(true)
            }
        })

        // Start shadow state
        setAnimatingItemId(image.id)

        // Trigger CSS animation
        setTimeout(() => {
            setAnimationState(prev => prev ? { ...prev, animating: true } : null)
        }, 50)

        // Complete selection
        setTimeout(() => {
            const currentImages = Array.isArray(value) ? value : []
            onChange(closesField ? image : [...currentImages, image])
            if (closesField) setIsExpanded(false)

            // Cleanup
            setAnimatingItemId(null)
            setAnimationState(null)
        }, 600)
    }, [value, onChange, setIsExpanded, getThumbnailUrl])

    // Start removal animation (reverse of selection)
    const startRemovalAnimation = useCallback((image, sourceElement) => {
        if (!sourceElement || !isExpanded) {
            // If field is closed or no source element, just remove without animation
            if (multiple) {
                const currentImages = Array.isArray(value) ? value : []
                onChange(currentImages.filter(img => img.id !== image.id))
            } else {
                onChange(null)
            }
            return
        }

        const sourceRect = sourceElement.getBoundingClientRect()

        // Find a position in the search results area (approximate)
        const searchArea = document.querySelector('[data-search-results]')
        const searchRect = searchArea?.getBoundingClientRect()
        const destinationTop = searchRect ? searchRect.top + 100 : sourceRect.top + 200
        const destinationLeft = searchRect ? searchRect.left + 100 : sourceRect.left

        const thumbnailUrl = getThumbnailUrl(image, 150)

        // Create reverse animation state
        setAnimationState({
            type: 'removal',
            image,
            thumbnailUrl,
            clone: {
                startPos: { top: sourceRect.top, left: sourceRect.left, width: sourceRect.width, height: sourceRect.height },
                endPos: { top: destinationTop, left: destinationLeft, width: 100, height: 100 }
            }
        })

        // Trigger animation
        setTimeout(() => {
            setAnimationState(prev => prev ? { ...prev, animating: true } : null)
        }, 50)

        // Complete removal
        setTimeout(() => {
            if (multiple) {
                const currentImages = Array.isArray(value) ? value : []
                onChange(currentImages.filter(img => img.id !== image.id))
            } else {
                onChange(null)
            }

            setAnimationState(null)
        }, 600)
    }, [multiple, value, onChange, isExpanded, getThumbnailUrl])

    // Remove an image from field with animation
    const handleRemoveImage = useCallback((imageId, event) => {
        const image = displayImages.find(img => img.id === imageId)
        if (image) {
            startRemovalAnimation(image, event?.currentTarget)
        }
    }, [displayImages, startRemovalAnimation])

    // Handle search
    const handleSearchChange = (newSearchTerms) => {
        setSearchTerms(newSearchTerms)
        setPagination(prev => ({ ...prev, page: 1 }))
    }

    // Drag and drop handlers
    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)

        if (!isExpanded) {
            setIsExpanded(true)
        }

        const droppedFiles = Array.from(e.dataTransfer.files)
        const validFiles = []
        const invalidFiles = []
        const uploadOnlyFiles = []

        const currentImageCount = multiple ? (Array.isArray(value) ? value.length : 0) : 0

        droppedFiles.forEach(file => {
            // Only process image files
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

            // Initialize auto-tags if configured
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

        // Show warnings and errors
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
    }, [imageConstraints, maxFiles, addNotification, autoTags, parseAutoTags, isExpanded, setIsExpanded, setUploadFiles, setUploadTags, multiple, value])

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
            // Only process image files
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
            // Initialize auto-tags if configured
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

        // Show warnings and errors
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
        if (isExpanded) {
            loadImages(1)
        }
        setIsExpanded(false)
    }, [isExpanded, loadImages])

    // Get effective collection (considering override) - must be defined before useMemo
    const getEffectiveCollection = useCallback(() => {
        if (collectionOverride === false) return null // User opted out
        return defaultCollection // Use default or null if none configured
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
        isExpanded,
        setIsExpanded,
        onRemoveImage: (imageId, event) => handleRemoveImage(imageId, event),
        getThumbnailUrl
    }), [displayImages, multiple, maxFiles, isExpanded, setIsExpanded, handleRemoveImage, getThumbnailUrl])

    // Memoize stable handlers to prevent recreation
    const toggleExpanded = useCallback(() => {
        setIsExpanded(!isExpanded)
    }, [isExpanded])

    const closeAndScroll = useCallback(() => {
        setIsExpanded(false)
    }, [])

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
                    : dragOver && !isExpanded && !hasImages
                        ? 'border-blue-400 bg-blue-50'
                        : isExpanded
                            ? 'border-blue-300 shadow-md'
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
                        onClick={toggleExpanded}
                        className={`w-full flex items-center justify-center gap-2 p-6 transition-colors ${isExpanded
                            ? 'border-b border-gray-200 bg-gray-50 hover:bg-gray-100'
                            : hasError
                                ? 'border-dashed hover:bg-red-50'
                                : dragOver
                                    ? 'border-dashed bg-blue-100'
                                    : 'border-dashed hover:bg-blue-50'
                            }`}
                    >
                        <Image className={`w-6 h-6 ${dragOver && !isExpanded ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className={`${dragOver && !isExpanded ? 'text-blue-700' : 'text-gray-600'}`}>
                            {dragOver && !isExpanded
                                ? 'Drop images here to upload'
                                : `Select Image${multiple ? 's' : ''} from Media Library`
                            }
                        </span>
                        {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                            <ChevronDown className={`w-5 h-5 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} />
                        )}
                    </button>
                )}

                {/* Expanded Media Picker */}
                {isExpanded && (
                    <div className="bg-white rounded-lg">
                        {/* Upload Section */}
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <ImageUploadSection {...uploadSectionProps} />
                        </div>

                        {/* Search Section */}
                        <div className="p-4 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Select Images {multiple && displayImages.length > 0 && `(${displayImages.length}${maxItems ? `/${maxItems}` : ''})`}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {/* View Mode Toggle */}
                                    <div className="flex items-center bg-gray-100 rounded-md p-1">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`p-1.5 rounded transition-colors ${viewMode === 'grid'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                            title="Grid view"
                                        >
                                            <Grid3X3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`p-1.5 rounded transition-colors ${viewMode === 'list'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                            title="List view"
                                        >
                                            <List className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={closeAndScroll}
                                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <ChevronUp className="w-5 h-5" />
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

                        {/* Pagination Controls */}
                        {!loading && images.length > 0 && (pagination.hasNext || pagination.hasPrev) && (
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                                <div className="text-sm text-gray-500">
                                    Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
                                    {pagination.total > 0 && ` • ${pagination.total} total images`}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => loadImages(pagination.page - 1)}
                                        disabled={!pagination.hasPrev || loading}
                                        className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Previous page"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        {pagination.page}
                                    </span>
                                    <button
                                        onClick={() => loadImages(pagination.page + 1)}
                                        disabled={!pagination.hasNext || loading}
                                        className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Next page"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Image Grid */}
                        <div className="p-4" data-search-results>
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : images.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                    <FolderOpen className="w-16 h-16 mb-4" />
                                    <p className="text-lg font-medium">No images found</p>
                                    <p className="text-sm">Try adjusting your search terms</p>
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className="grid grid-cols-4 gap-3">
                                    {images.slice(0, 12).map((image) => {
                                        const isSelected = multiple
                                            ? displayImages.some(img => img.id === image.id)
                                            : value && value.id === image.id
                                        const thumbnailUrl = getThumbnailUrl(image, 150)

                                        return (
                                            <ImageGridItem
                                                key={image.id}
                                                image={image}
                                                isSelected={isSelected}
                                                thumbnailUrl={thumbnailUrl}
                                                onSelect={handleImageSelect}
                                                isAnimating={animatingItemId === image.id}
                                            />
                                        )
                                    })}
                                </div>
                            ) : (
                                /* List View */
                                <div className="space-y-2">
                                    {images.slice(0, 12).map((image) => {
                                        const isSelected = multiple
                                            ? displayImages.some(img => img.id === image.id)
                                            : value && value.id === image.id
                                        const thumbnailUrl = getThumbnailUrl(image, 80)

                                        return (
                                            <div
                                                key={image.id}
                                                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all duration-500 ${animatingItemId === image.id
                                                    ? 'opacity-30 scale-95' // Shadow state - faded and slightly smaller
                                                    : isSelected
                                                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                    }`}
                                                onClick={(event) => handleImageSelect(image, event)}
                                            >
                                                {/* Thumbnail */}
                                                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden mr-4 flex-shrink-0">
                                                    {thumbnailUrl ? (
                                                        <img
                                                            src={thumbnailUrl}
                                                            alt={image.title || image.originalFilename || image.original_filename || 'Image'}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Image className="w-6 h-6 text-gray-400" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Image Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 truncate">
                                                        {image.title || image.originalFilename || image.original_filename || 'Untitled'}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {image.width && image.height && `${image.width}×${image.height} • `}
                                                        {(image.fileSize || image.file_size) && formatFileSize(image.fileSize || image.file_size)}
                                                        {(image.createdAt || image.created_at) && ` • ${new Date(image.createdAt || image.created_at).toLocaleDateString()}`}
                                                    </div>
                                                    {image.description && (
                                                        <div className="text-xs text-gray-400 mt-1 truncate">
                                                            {image.description}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Selection Indicator */}
                                                {isSelected && (
                                                    <div className="ml-3 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                        <div className="w-2 h-2 bg-white rounded-full" />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
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

            {/* Clone Animation Overlay */}
            {animationState && (
                <div
                    className={`fixed pointer-events-none z-50 transition-all duration-600 ease-out ${animationState.animating ? 'opacity-0' : 'opacity-100'
                        }`}
                    style={{
                        top: animationState.animating ? animationState.clone.endPos.top : animationState.clone.startPos.top,
                        left: animationState.animating ? animationState.clone.endPos.left : animationState.clone.startPos.left,
                        width: animationState.animating ? animationState.clone.endPos.width : animationState.clone.startPos.width,
                        height: animationState.animating ? animationState.clone.endPos.height : animationState.clone.startPos.height,
                    }}
                >
                    <div className={`w-full h-full border-2 rounded-lg overflow-hidden shadow-xl ${animationState.type === 'selection'
                        ? 'border-green-500 bg-green-50'
                        : 'border-red-500 bg-red-50'
                        }`}>
                        {animationState.thumbnailUrl ? (
                            <img
                                src={animationState.thumbnailUrl}
                                alt={animationState.image.title || animationState.image.originalFilename || 'Image'}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                <Image className="w-8 h-8 text-gray-400" />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default ExpandableImageField
