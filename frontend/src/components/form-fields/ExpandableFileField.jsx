import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { FolderOpen, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import MediaSearchWidget from '../media/MediaSearchWidget'
import FileUploadSection from './FileUploadSection'
import FileDisplaySection from './FileDisplaySection'
import {
    validateFile,
    getFileTypeInfo,
    formatFileSize,
    getFileUrl,
    getAcceptAttribute,
    getAllowedMimeTypes
} from './FileValidationUtils'

/**
 * ExpandableFileField - Refactored version with modular components
 * 
 * Features:
 * - Expandable interface with search form and file list
 * - Configurable file type filtering
 * - Single or multiple file selection
 * - Upload functionality with drag & drop
 * - Auto-tags and collection assignment
 */
const ExpandableFileField = ({
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
    namespace,
    // File type configuration
    allowedFileTypes = ['image', 'document', 'video', 'audio'],
    allowedMimeTypes = [],
    allowedExtensions = '',
    fileTypeLabel = 'File',
    // File size constraints
    maxFileSize = null,
    minFileSize = null,
    // Auto-tags for uploads
    autoTags = '',
    // Default collection for uploads
    defaultCollection = null,
    // Max files limit
    maxFiles = null
}) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [searchTerms, setSearchTerms] = useState([])
    const [files, setFiles] = useState([])
    const [loading, setLoading] = useState(false)
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
    const displayFiles = useMemo(() => {
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

    // Get file URL - use source URL directly (no client-side imgproxy transformation)
    const getThumbnailUrl = (file, size = 150) => {
        const fileTypeInfo = getFileTypeInfo(file.file_type || file.fileType)

        if (fileTypeInfo.category === 'image') {
            return getFileUrl(file)
        }

        return null
    }

    // Load files from media library
    const loadFiles = useCallback(async (page = 1) => {
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
                // Add file type filtering to backend
                ...(allowedFileTypes.length > 0 && {
                    file_types: allowedFileTypes
                }),
                ...(allowedMimeTypes.length > 0 && {
                    mime_types: allowedMimeTypes
                })
            }

            let result
            if (searchTerms.length > 0) {
                result = await mediaApi.search.search(params)
            } else {
                result = await mediaApi.files.list(params)()
            }

            let newFiles = result.results || result || []

            // Filter out already selected files
            const selectedFileIds = new Set(displayFiles.map(file => file.id))
            newFiles = newFiles.filter(file => !selectedFileIds.has(file.id))

            setFiles(newFiles)
            setPagination({
                page,
                pageSize: pagination.pageSize,
                total: result.count || newFiles.length,
                hasNext: result.next != null,
                hasPrev: page > 1
            })
        } catch (error) {
            console.error('Failed to load files:', error)
            addNotification('Failed to load files', 'error')
        } finally {
            setLoading(false)
        }
    }, [namespace, searchTerms, pagination.pageSize, addNotification, isExpanded, allowedFileTypes, allowedMimeTypes, displayFiles])

    // Load files when expanded
    useEffect(() => {
        if (isExpanded) {
            loadFiles(1)
        }
    }, [loadFiles, isExpanded])

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

    // Handle file selection with clone animation (same as image field)
    const handleFileSelect = useCallback((file, event) => {
        if (multiple) {
            const currentFiles = Array.isArray(value) ? value : []
            const isAlreadySelected = currentFiles.some(f => f.id === file.id)

            if (isAlreadySelected) {
                onChange(currentFiles.filter(f => f.id !== file.id))
            } else {
                if (maxItems && currentFiles.length >= maxItems) {
                    addNotification(`Maximum ${maxItems} ${fileTypeLabel.toLowerCase()}s allowed`, 'warning')
                    return
                }

                startSelectionAnimation(file, event)
            }
        } else {
            startSelectionAnimation(file, event, true) // Single selection closes field
        }
    }, [multiple, value, maxItems, addNotification, fileTypeLabel])

    // Start selection animation (same as image field)
    const startSelectionAnimation = useCallback((file, event, closesField = false) => {
        const sourceElement = event?.currentTarget
        if (!sourceElement || !fieldRef.current) return

        const sourceRect = sourceElement.getBoundingClientRect()
        const fieldRect = fieldRef.current.getBoundingClientRect()

        // Calculate destination position (top of the field)
        const destinationTop = fieldRect.top - 20
        const destinationLeft = fieldRect.left + 20

        const fileTypeInfo = getFileTypeInfo(file.fileType || file.file_type, file.originalFilename || file.original_filename || file.title)
        const thumbnailUrl = getThumbnailUrl(file, 80)

        // Create animation state
        setAnimationState({
            type: 'selection',
            file,
            fileTypeInfo,
            thumbnailUrl,
            clone: {
                startPos: { top: sourceRect.top, left: sourceRect.left, width: sourceRect.width, height: sourceRect.height },
                endPos: { top: destinationTop, left: destinationLeft, width: 60, height: 60 }
            }
        })

        // Start shadow state
        setAnimatingItemId(file.id)

        // Trigger CSS animation
        setTimeout(() => {
            setAnimationState(prev => prev ? { ...prev, animating: true } : null)
        }, 50)

        // Complete selection
        setTimeout(() => {
            const currentFiles = Array.isArray(value) ? value : []
            onChange(closesField ? file : [...currentFiles, file])
            if (closesField) setIsExpanded(false)

            // Cleanup
            setAnimatingItemId(null)
            setAnimationState(null)
        }, 600)
    }, [value, onChange, setIsExpanded, getThumbnailUrl, fileTypeLabel])

    // Start removal animation (reverse of selection)
    const startRemovalAnimation = useCallback((file, sourceElement) => {
        if (!sourceElement || !isExpanded) {
            // If field is closed or no source element, just remove without animation
            if (multiple) {
                const currentFiles = Array.isArray(value) ? value : []
                onChange(currentFiles.filter(f => f.id !== file.id))
            } else {
                onChange(null)
            }
            return
        }

        const sourceRect = sourceElement.getBoundingClientRect()

        // Find a position in the search results area
        const searchArea = document.querySelector('[data-search-results]')
        const searchRect = searchArea?.getBoundingClientRect()
        const destinationTop = searchRect ? searchRect.top + 100 : sourceRect.top + 200
        const destinationLeft = searchRect ? searchRect.left + 100 : sourceRect.left

        const fileTypeInfo = getFileTypeInfo(file.fileType || file.file_type, file.originalFilename || file.original_filename || file.title)
        const thumbnailUrl = getThumbnailUrl(file, 80)

        // Create reverse animation state
        setAnimationState({
            type: 'removal',
            file,
            fileTypeInfo,
            thumbnailUrl,
            clone: {
                startPos: { top: sourceRect.top, left: sourceRect.left, width: sourceRect.width, height: sourceRect.height },
                endPos: { top: destinationTop, left: destinationLeft, width: sourceRect.width, height: sourceRect.height }
            }
        })

        // Trigger animation
        setTimeout(() => {
            setAnimationState(prev => prev ? { ...prev, animating: true } : null)
        }, 50)

        // Complete removal
        setTimeout(() => {
            if (multiple) {
                const currentFiles = Array.isArray(value) ? value : []
                onChange(currentFiles.filter(f => f.id !== file.id))
            } else {
                onChange(null)
            }

            setAnimationState(null)
        }, 600)
    }, [multiple, value, onChange, isExpanded, getThumbnailUrl, fileTypeLabel])

    // Remove a file from field with animation
    const handleRemoveFile = useCallback((fileId, event) => {
        const file = displayFiles.find(f => f.id === fileId)
        if (file) {
            startRemovalAnimation(file, event?.currentTarget)
        }
    }, [displayFiles, startRemovalAnimation])

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

        const validationConfig = {
            allowedFileTypes,
            allowedMimeTypes,
            allowedExtensions,
            maxFileSize,
            minFileSize
        }

        droppedFiles.forEach(file => {
            const validation = validateFile(file, validationConfig)
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
    }, [allowedFileTypes, allowedMimeTypes, allowedExtensions, maxFileSize, minFileSize, addNotification, autoTags, parseAutoTags, isExpanded, setIsExpanded, setUploadFiles, setUploadTags])

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

        const validationConfig = {
            allowedFileTypes,
            allowedMimeTypes,
            allowedExtensions,
            maxFileSize,
            minFileSize
        }

        selectedFiles.forEach(file => {
            const validation = validateFile(file, validationConfig)
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
    }, [allowedFileTypes, allowedMimeTypes, allowedExtensions, maxFileSize, minFileSize, addNotification, autoTags, parseAutoTags, setUploadFiles, setUploadTags])

    const hasFiles = displayFiles.length > 0
    const hasError = showValidation && validation && !validation.isValid
    const errorMessage = hasError ? validation.message : null

    const handleUploadComplete = () => {
        if (isExpanded) {
            loadFiles(1)
        }
        setIsExpanded(false)
    }

    // Handle collection removal
    const handleRemoveDefaultCollection = useCallback(() => {
        setCollectionOverride(false)
        addNotification('Files will not be added to any collection', 'info')
    }, [addNotification])

    // Restore original auto-tags
    const handleRestoreAutoTags = useCallback(() => {
        if (originalAutoTags.length > 0) {
            setUploadTags([...originalAutoTags])
            addNotification(`Restored ${originalAutoTags.length} default tag${originalAutoTags.length !== 1 ? 's' : ''}`, 'info')
        }
    }, [originalAutoTags, addNotification])

    // Get effective collection (considering override)
    const getEffectiveCollection = useCallback(() => {
        if (collectionOverride === false) return null // User opted out
        return defaultCollection // Use default or null if none configured
    }, [collectionOverride, defaultCollection])

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
                    : dragOver && !isExpanded && !hasFiles
                        ? 'border-blue-400 bg-blue-50'
                        : isExpanded
                            ? 'border-blue-300 shadow-md'
                            : 'border-gray-300'
                    }`}
                onDrop={!hasFiles ? handleDrop : undefined}
                onDragOver={!hasFiles ? handleDragOver : undefined}
                onDragLeave={!hasFiles ? handleDragLeave : undefined}
            >
                {hasFiles ? (
                    /* Selected Files Display */
                    <FileDisplaySection
                        files={displayFiles}
                        multiple={multiple}
                        fileTypeLabel={fileTypeLabel}
                        maxFiles={maxFiles}
                        isExpanded={isExpanded}
                        setIsExpanded={setIsExpanded}
                        onRemoveFile={(fileId, event) => handleRemoveFile(fileId, event)}
                        getFileTypeInfo={getFileTypeInfo}
                        getThumbnailUrl={getThumbnailUrl}
                        getFileUrl={getFileUrl}
                        formatFileSize={formatFileSize}
                    />
                ) : (
                    /* Empty State with Dropzone */
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`w-full flex items-center justify-center gap-2 p-6 transition-colors ${isExpanded
                            ? 'border-b border-gray-200 bg-gray-50 rounded-lg hover:bg-gray-100'
                            : hasError
                                ? 'border-dashed hover:bg-red-50'
                                : dragOver
                                    ? 'border-dashed bg-blue-100'
                                    : 'border-dashed hover:bg-blue-50'
                            }`}
                    >
                        <FolderOpen className={`w-6 h-6 ${dragOver && !isExpanded ? 'text-blue-500' : 'text-gray-400'}`} />
                        <span className={`${dragOver && !isExpanded ? 'text-blue-700' : 'text-gray-600'}`}>
                            {dragOver && !isExpanded
                                ? `Drop ${fileTypeLabel.toLowerCase()}s here to upload`
                                : `Select ${fileTypeLabel}${multiple ? 's' : ''} from Media Library`
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
                        <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-lg">
                            <FileUploadSection
                                uploadFiles={uploadFiles}
                                setUploadFiles={setUploadFiles}
                                uploading={uploading}
                                setUploading={setUploading}
                                uploadTags={uploadTags}
                                setUploadTags={setUploadTags}
                                uploadErrors={uploadErrors}
                                setUploadErrors={setUploadErrors}
                                showForceUpload={showForceUpload}
                                setShowForceUpload={setShowForceUpload}
                                dragOver={dragOver}
                                namespace={namespace}
                                fileTypeLabel={fileTypeLabel}
                                allowedFileTypes={allowedFileTypes}
                                defaultCollection={getEffectiveCollection()}
                                onRemoveDefaultCollection={handleRemoveDefaultCollection}
                                originalAutoTags={originalAutoTags}
                                onRestoreAutoTags={handleRestoreAutoTags}
                                maxFiles={maxFiles}
                                value={value}
                                multiple={multiple}
                                onChange={onChange}
                                onUploadComplete={handleUploadComplete}
                                validateFile={(file) => validateFile(file, {
                                    allowedFileTypes,
                                    allowedMimeTypes,
                                    allowedExtensions,
                                    maxFileSize,
                                    minFileSize
                                })}
                                parseAutoTags={parseAutoTags}
                                autoTags={autoTags}
                                formatFileSize={formatFileSize}
                                getFileTypeInfo={getFileTypeInfo}
                                handleDrop={handleDrop}
                                handleDragOver={handleDragOver}
                                handleDragLeave={handleDragLeave}
                                handleFileInputChange={handleFileInputChange}
                                getAcceptAttribute={() => getAcceptAttribute(allowedFileTypes, allowedMimeTypes)}
                            />
                        </div>

                        {/* Search Section */}
                        <div className="p-4 border-b border-gray-200">
                            <MediaSearchWidget
                                searchTerms={searchTerms}
                                onChange={handleSearchChange}
                                namespace={namespace}
                                placeholder={`Search ${fileTypeLabel.toLowerCase()}s...`}
                            />
                        </div>

                        {/* Pagination Controls */}
                        {!loading && files.length > 0 && (pagination.hasNext || pagination.hasPrev) && (
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-lg">
                                <div className="text-sm text-gray-500">
                                    Page {pagination.page} of {Math.ceil(pagination.total / pagination.pageSize)}
                                    {pagination.total > 0 && ` • ${pagination.total} total ${fileTypeLabel.toLowerCase()}s`}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => loadFiles(pagination.page - 1)}
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
                                        onClick={() => loadFiles(pagination.page + 1)}
                                        disabled={!pagination.hasNext || loading}
                                        className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Next page"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* File List */}
                        <div className="p-4" data-search-results>
                            {loading ? (
                                <div className="flex items-center justify-center h-64">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : files.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                    <FolderOpen className="w-16 h-16 mb-4" />
                                    <p className="text-lg font-medium">No {fileTypeLabel.toLowerCase()}s found</p>
                                    <p className="text-sm">Try adjusting your search terms</p>
                                </div>
                            ) : (
                                /* List View Only */
                                <div className="space-y-2">
                                    {files.slice(0, 12).map((file) => {
                                        const fileTypeInfo = getFileTypeInfo(file.fileType || file.file_type, file.originalFilename || file.original_filename || file.title)
                                        const IconComponent = fileTypeInfo.icon
                                        const isSelected = multiple
                                            ? displayFiles.some(f => f.id === file.id)
                                            : value && value.id === file.id
                                        const thumbnailUrl = getThumbnailUrl(file, 80)

                                        return (
                                            <div
                                                key={file.id}
                                                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all duration-500 ${animatingItemId === file.id
                                                    ? 'opacity-30 scale-95' // Shadow state - faded and slightly smaller
                                                    : isSelected
                                                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg'
                                                    }`}
                                                onClick={(event) => handleFileSelect(file, event)}
                                            >
                                                {/* File Icon/Thumbnail */}
                                                <div className={`w-16 h-16 rounded-lg overflow-hidden mr-4 flex-shrink-0 ${fileTypeInfo.bgColor} flex items-center justify-center`}>
                                                    {thumbnailUrl && fileTypeInfo.category === 'image' ? (
                                                        <img
                                                            src={thumbnailUrl}
                                                            alt={file.title || file.original_filename || 'File'}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <IconComponent className={`w-8 h-8 ${fileTypeInfo.color}`} />
                                                    )}
                                                </div>

                                                {/* File Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900 truncate">
                                                        {file.title || file.originalFilename || file.original_filename || 'Untitled'}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${fileTypeInfo.bgColor} ${fileTypeInfo.color}`}>
                                                            {fileTypeInfo.category.charAt(0).toUpperCase() + fileTypeInfo.category.slice(1)}
                                                        </span>
                                                        {(file.fileSize || file.file_size) && (
                                                            <span>{formatFileSize(file.fileSize || file.file_size)}</span>
                                                        )}
                                                        {(file.createdAt || file.created_at) && (
                                                            <span>{new Date(file.createdAt || file.created_at).toLocaleDateString()}</span>
                                                        )}
                                                    </div>
                                                    {file.description && (
                                                        <div className="text-xs text-gray-400 mt-1 truncate">
                                                            {file.description}
                                                        </div>
                                                    )}
                                                    {/* Tags */}
                                                    {file.tags && file.tags.length > 0 && (
                                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                                            {file.tags.slice(0, 4).map(tag => (
                                                                <span
                                                                    key={tag.id}
                                                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[80px]"
                                                                    style={{
                                                                        backgroundColor: tag.color || '#3B82F6',
                                                                        color: '#fff'
                                                                    }}
                                                                    title={tag.name}
                                                                >
                                                                    {tag.name}
                                                                </span>
                                                            ))}
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
                    {minItems && `Minimum: ${minItems} ${fileTypeLabel.toLowerCase()}${minItems !== 1 ? 's' : ''}`}
                    {minItems && maxItems && ' • '}
                    {maxItems && `Maximum: ${maxItems} ${fileTypeLabel.toLowerCase()}${maxItems !== 1 ? 's' : ''}`}
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
                    <div className={`w-full h-full border-2 rounded-lg overflow-hidden shadow-xl flex items-center p-3 ${animationState.type === 'selection'
                        ? 'border-green-500 bg-green-50'
                        : 'border-red-500 bg-red-50'
                        }`}>
                        {/* File Icon */}
                        <div className={`w-16 h-16 rounded-lg mr-4 flex-shrink-0 ${animationState.fileTypeInfo.bgColor} flex items-center justify-center`}>
                            {animationState.thumbnailUrl && animationState.fileTypeInfo.originalCategory === 'image' ? (
                                <img
                                    src={animationState.thumbnailUrl}
                                    alt={animationState.file.title || animationState.file.originalFilename || 'File'}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <animationState.fileTypeInfo.icon className={`w-8 h-8 ${animationState.fileTypeInfo.color}`} />
                            )}
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                                {animationState.file.title || animationState.file.originalFilename || animationState.file.original_filename || 'Untitled'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${animationState.fileTypeInfo.bgColor} ${animationState.fileTypeInfo.color}`}>
                                    {animationState.fileTypeInfo.category}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ExpandableFileField