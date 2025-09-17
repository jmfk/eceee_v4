import React, { useState, useEffect, useCallback, useRef } from 'react'
import { FolderOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import { generateThumbnailUrl } from '../../utils/imgproxy'
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
 * - Expandable interface with search form and file grid/list
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

    const { addNotification } = useGlobalNotifications()
    const fieldRef = useRef(null)

    console.log("autoTags", autoTags)
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

    // Generate thumbnail URL for images
    const getThumbnailUrl = (file, size = 150) => {
        const fileTypeInfo = getFileTypeInfo(file.file_type || file.fileType)

        if (fileTypeInfo.category === 'image') {
            if (file.thumbnail_url && size <= 150) {
                return file.thumbnail_url
            }
            const sourceUrl = getFileUrl(file)
            return sourceUrl ? generateThumbnailUrl(sourceUrl, size, size) : null
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

            // Backend now handles filtering, so we can use the results directly
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
    }, [namespace, searchTerms, pagination.pageSize, addNotification, isExpanded, allowedFileTypes, allowedMimeTypes])

    // Load files when expanded
    useEffect(() => {
        if (isExpanded) {
            loadFiles(1)
        }
    }, [loadFiles, isExpanded])

    // Initialize search terms with auto-tags when component mounts or auto-tags change
    useEffect(() => {
        const initializeSearchWithAutoTags = async () => {
            if (autoTags && namespace && searchTerms.length === 0) {
                try {
                    const tags = await parseAutoTags(autoTags)
                    if (tags.length > 0) {
                        const tagSearchTerms = tags.map(tag => ({
                            type: 'tag',
                            value: tag.name,
                            label: tag.name,
                            id: tag.id
                        }))
                        setSearchTerms(tagSearchTerms)
                    }
                } catch (error) {
                    console.warn('Failed to initialize search with auto-tags:', error)
                }
            }
        }

        initializeSearchWithAutoTags()
    }, [autoTags, namespace, parseAutoTags, searchTerms.length])

    // Handle file selection from media library
    const handleFileSelect = (file) => {
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
                onChange([...currentFiles, file])
            }
        } else {
            onChange(file)
            setIsExpanded(false)
            setTimeout(scrollToField, 100)
        }
    }

    // Remove a file from field
    const handleRemoveFile = (fileId) => {
        if (multiple) {
            const currentFiles = Array.isArray(value) ? value : []
            onChange(currentFiles.filter(f => f.id !== fileId))
        } else {
            onChange(null)
        }
    }

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

    // Get display value for rendering
    const getDisplayValue = () => {
        if (multiple) {
            return Array.isArray(value) ? value : []
        }
        return value ? [value] : []
    }

    const displayFiles = getDisplayValue()
    const hasFiles = displayFiles.length > 0
    const hasError = showValidation && validation && !validation.isValid
    const errorMessage = hasError ? validation.message : null

    const handleUploadComplete = () => {
        if (isExpanded) {
            loadFiles(1)
        }
        setIsExpanded(false)
        setTimeout(scrollToField, 100)
    }

    // Handle collection removal
    const handleRemoveDefaultCollection = useCallback(() => {
        setCollectionOverride(false)
        addNotification('Files will not be added to any collection', 'info')
    }, [addNotification])

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
                        onRemoveFile={handleRemoveFile}
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
                            ? 'border-b border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-t-md'
                            : hasError
                                ? 'border-dashed hover:bg-red-50 rounded-md'
                                : dragOver
                                    ? 'border-dashed bg-blue-100 rounded-md'
                                    : 'border-dashed hover:bg-blue-50 rounded-md'
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
                    <div className="bg-white rounded-b-md">
                        {/* Upload Section */}
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
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
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Select {fileTypeLabel}s {multiple && displayFiles.length > 0 && `(${displayFiles.length}${maxItems ? `/${maxItems}` : ''})`}
                                </h3>
                                <button
                                    onClick={() => {
                                        setIsExpanded(false)
                                        setTimeout(scrollToField, 100)
                                    }}
                                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <ChevronUp className="w-5 h-5" />
                                </button>
                            </div>

                            <MediaSearchWidget
                                searchTerms={searchTerms}
                                onChange={handleSearchChange}
                                namespace={namespace}
                                placeholder={`Search ${fileTypeLabel.toLowerCase()}s...`}
                            />
                        </div>

                        {/* File Grid - Simplified for now */}
                        <div className="p-4">
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
                                <div className="grid grid-cols-4 gap-3">
                                    {files.slice(0, 12).map((file) => {
                                        const fileTypeInfo = getFileTypeInfo(file.file_type || file.fileType)
                                        const IconComponent = fileTypeInfo.icon
                                        const isSelected = multiple
                                            ? displayFiles.some(f => f.id === file.id)
                                            : value && value.id === file.id

                                        return (
                                            <div
                                                key={file.id}
                                                className={`relative aspect-square cursor-pointer border-2 rounded-lg overflow-hidden transition-all duration-200 ${isSelected
                                                    ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                                                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                                                    }`}
                                                onClick={() => handleFileSelect(file)}
                                                title={file.title}
                                            >
                                                {isSelected && (
                                                    <div className="absolute top-1 right-1 z-10 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                                                        <div className="w-2 h-2 bg-white rounded-full" />
                                                    </div>
                                                )}

                                                <div className={`w-full h-full ${fileTypeInfo.bgColor} flex items-center justify-center`}>
                                                    <IconComponent className={`w-8 h-8 ${fileTypeInfo.color}`} />
                                                </div>
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
        </div>
    )
}

export default ExpandableFileField
