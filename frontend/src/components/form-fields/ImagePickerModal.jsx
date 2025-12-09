import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Image, FolderOpen, ChevronLeft, ChevronRight, Grid3X3, List, X } from 'lucide-react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import MediaSearchWidget from '../media/MediaSearchWidget'
import ImageUploadSection from './ImageUploadSection'
import { getGridStyle, getObjectFitClass } from '../../utils/imageGridLayout'
import { formatFileSize } from './ImageValidationUtils'

/**
 * Memoized image grid item to prevent unnecessary rerenders
 */
const ImageGridItem = React.memo(({ image, isSelected, thumbnailUrl, onSelect, isAnimating }) => {
    const handleClick = useCallback((event) => {
        onSelect(image, event)
    }, [image, onSelect])

    const gridStyle = getGridStyle(image)
    const objectFitClass = getObjectFitClass(image)

    return (
        <div
            className="cursor-pointer transition-all duration-500"
            style={gridStyle}
            onClick={handleClick}
        >
            <div
                className={`relative border-2 rounded-lg overflow-hidden transition-all duration-500 ${isAnimating
                    ? 'opacity-30 scale-95'
                    : isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
            >
                {isSelected && (
                    <div className="absolute top-1 right-1 z-10 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                )}

                <div className="w-full aspect-square bg-gray-100">
                    {thumbnailUrl ? (
                        <img
                            src={thumbnailUrl}
                            alt={image.title || image.original_filename || 'Image'}
                            className={`w-full h-full ${objectFitClass}`}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Image className="w-8 h-8 text-gray-400" />
                        </div>
                    )}
                </div>
                
                {/* Tags overlay */}
                {image.tags && image.tags.length > 0 && (
                    <div className="absolute top-1 left-1 z-10">
                        <div className="flex gap-1 flex-wrap">
                            {image.tags.slice(0, 2).map(tag => (
                                <span
                                    key={tag.id}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[60px] bg-black/60"
                                    style={{
                                        color: '#fff'
                                    }}
                                    title={tag.name}
                                >
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Title and annotation below image */}
            <div className="mt-2 px-1 space-y-0.5">
                {image.title && (
                    <div className="text-sm font-medium text-gray-900 truncate" title={image.title}>
                        {image.title}
                    </div>
                )}
                {image.annotation && (
                    <div className="text-xs text-gray-600 line-clamp-2" title={image.annotation}>
                        {image.annotation}
                    </div>
                )}
            </div>
        </div>
    )
})

ImageGridItem.displayName = 'ImageGridItem'

/**
 * ImagePickerModal - Full-screen modal for selecting images from media library
 * 
 * Features:
 * - Full-screen modal interface (90vh x 90vw)
 * - Upload section with drag & drop
 * - Search with MediaSearchWidget
 * - Grid/list view toggle
 * - Pagination controls
 * - Image selection with animation
 */
const ImagePickerModal = ({
    isOpen,
    onClose,
    value,
    onChange,
    multiple = false,
    maxItems = null,
    namespace,
    imageConstraints = {},
    autoTags = '',
    defaultCollection = null,
    maxFiles = null,
    allowedFileTypes = ['image'],
    allowedMimeTypes = [],
    parseAutoTags,
    uploadSectionProps,
    getThumbnailUrl,
    handleImageSelect,
    animatingItemId
}) => {
    const [searchTerms, setSearchTerms] = useState([])
    const [images, setImages] = useState([])
    const [loading, setLoading] = useState(false)
    const [viewMode, setViewMode] = useState('grid')
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 24,
        total: 0,
        hasNext: false,
        hasPrev: false
    })

    const { addNotification } = useGlobalNotifications()

    // Memoize display values to prevent recalculation
    const displayImages = useMemo(() => {
        if (multiple) {
            return Array.isArray(value) ? value : []
        }
        return value ? [value] : []
    }, [value, multiple])

    // Load images from media library
    const loadImages = useCallback(async (page = 1) => {
        if (!namespace || !isOpen) return

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
    }, [namespace, searchTerms, pagination.pageSize, addNotification, isOpen, displayImages, allowedFileTypes, allowedMimeTypes])

    // Load images when modal opens
    useEffect(() => {
        if (isOpen) {
            loadImages(1)
        }
    }, [isOpen, loadImages])

    // Initialize search terms with auto-tags when modal opens
    useEffect(() => {
        const initializeWithAutoTags = async () => {
            if (isOpen && autoTags && namespace && parseAutoTags) {
                try {
                    const tags = await parseAutoTags(autoTags)
                    if (tags.length > 0 && searchTerms.length === 0) {
                        const tagSearchTerms = tags.map(tag => ({
                            type: 'tag',
                            value: tag.name,
                            label: tag.name,
                            id: tag.id
                        }))
                        setSearchTerms(tagSearchTerms)
                    }
                } catch (error) {
                    console.warn('Failed to initialize auto-tags:', error)
                }
            }
        }

        initializeWithAutoTags()
    }, [isOpen, autoTags, namespace, parseAutoTags])

    // Handle search
    const handleSearchChange = (newSearchTerms) => {
        setSearchTerms(newSearchTerms)
        setPagination(prev => ({ ...prev, page: 1 }))
    }

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }

        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [isOpen, onClose])

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }

        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    if (!isOpen) return null

    const modalContent = (
        <div className="fixed inset-0 z-[10010] overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 transition-opacity"
                onClick={onClose}
            />

            {/* Modal content */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div 
                    className="relative bg-white rounded-lg shadow-xl transform transition-all flex flex-col"
                    style={{
                        width: '90vw',
                        height: '90vh',
                        maxWidth: '1800px'
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Select Images {multiple && displayImages.length > 0 && `(${displayImages.length}${maxItems ? `/${maxItems}` : ''})`}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                            aria-label="Close modal"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Content - scrollable */}
                    <div className="flex-1 overflow-y-auto">
                        {/* Upload Section */}
                        <div className="p-6 border-b border-gray-200 bg-gray-50">
                            <ImageUploadSection {...uploadSectionProps} />
                        </div>

                        {/* Search Section */}
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex-1 max-w-2xl">
                                    <MediaSearchWidget
                                        searchTerms={searchTerms}
                                        onChange={handleSearchChange}
                                        namespace={namespace}
                                        placeholder="Search images..."
                                        autoSearch={true}
                                        autoSearchDelay={500}
                                    />
                                </div>

                                {/* View Mode Toggle */}
                                <div className="flex items-center bg-gray-100 rounded-md p-1 ml-4">
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
                            </div>
                        </div>

                        {/* Pagination Controls */}
                        {!loading && images.length > 0 && (pagination.hasNext || pagination.hasPrev) && (
                            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50">
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
                        <div className="p-6" data-search-results>
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
                                <div className="grid grid-cols-6 gap-4" style={{ gridAutoFlow: 'dense' }}>
                                    {images.map((image) => {
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
                                    {images.map((image) => {
                                        const isSelected = multiple
                                            ? displayImages.some(img => img.id === image.id)
                                            : value && value.id === image.id
                                        const thumbnailUrl = getThumbnailUrl(image, 80)

                                        return (
                                            <div
                                                key={image.id}
                                                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all duration-500 ${animatingItemId === image.id
                                                    ? 'opacity-30 scale-95'
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
                                                    {/* Tags */}
                                                    {image.tags && image.tags.length > 0 && (
                                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                                            {image.tags.slice(0, 4).map(tag => (
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
                </div>
            </div>
        </div>
    )

    return createPortal(modalContent, document.body)
}

export default ImagePickerModal

