import React, { useState, useEffect, useCallback } from 'react'
import { Image, FolderOpen, X, Eye, Search, Grid3X3, List, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { mediaApi } from '../../api'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import { generateThumbnailUrl } from '../../utils/imgproxy'
import MediaSearchWidget from '../media/MediaSearchWidget'

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
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 81, // 9x9 grid = 81 images per page
        total: 0,
        hasNext: false
    })

    const { addNotification } = useGlobalNotifications()

    // Load images
    const loadImages = useCallback(async (page = 1, append = false) => {
        if (!namespace || !isExpanded) {
            return
        }

        setLoading(true)
        try {
            const params = {
                page,
                page_size: pagination.pageSize, // Use page_size instead of pageSize for Django
                namespace,
                file_type: 'image', // Use file_type instead of fileType for Django
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

            const result = await mediaApi.files.list(params)
            const newImages = result.results || result || []
            setImages(prev => append ? [...prev, ...newImages] : newImages)
            setPagination({
                page,
                pageSize: pagination.pageSize,
                total: result.count || newImages.length,
                hasNext: result.next != null
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

    // Load more images (infinite scroll)
    const loadMore = () => {
        if (pagination.hasNext && !loading) {
            loadImages(pagination.page + 1, true)
        }
    }

    // Get display value for rendering
    const getDisplayValue = () => {
        if (multiple) {
            return Array.isArray(value) ? value : []
        }
        return value ? [value] : []
    }

    const displayImages = getDisplayValue()
    const hasImages = displayImages.length > 0
    const canAddMore = multiple ? (!maxItems || displayImages.length < maxItems) : !hasImages

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

            {/* Media Selection Button */}
            {canAddMore && (
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`w-full flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg transition-colors ${hasError
                        ? 'border-red-300 hover:border-red-400 hover:bg-red-50'
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                >
                    <FolderOpen className="w-6 h-6 text-gray-400" />
                    <span className="text-gray-600">
                        {hasImages
                            ? `Add ${multiple ? 'More' : 'Another'} Image${multiple ? 's' : ''}`
                            : `Select Image${multiple ? 's' : ''} from Media Library`
                        }
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
                <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
                    {/* Search Header */}
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Select Images {multiple && displayImages.length > 0 && `(${displayImages.length}${maxItems ? `/${maxItems}` : ''})`}
                            </h3>
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search Bar */}
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
                                {/* 9x9 Grid */}
                                <div className="grid grid-cols-9 gap-2 mb-4">
                                    {images.map((image) => {
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
                                                    src={generateThumbnailUrl(image.imgproxy_base_url || image.file_url, 120, 120) || image.file_url}
                                                    alt={image.title}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-size="12">IMG</text></svg>'
                                                    }}
                                                />

                                                {/* Hover overlay */}
                                                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                                    <Eye className="w-4 h-4 text-white" />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Load More */}
                                {pagination.hasNext && (
                                    <div className="flex justify-center">
                                        <button
                                            onClick={loadMore}
                                            disabled={loading}
                                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Loading...
                                                </>
                                            ) : (
                                                'Load More Images'
                                            )}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Selected Images Display */}
            {hasImages && (
                <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">
                        Selected Image{multiple && displayImages.length > 1 ? 's' : ''}
                        {multiple && ` (${displayImages.length}${maxItems ? `/${maxItems}` : ''})`}
                    </div>

                    <div className={`grid gap-3 ${multiple ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                        {displayImages.map((image) => (
                            <div key={image.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                                {/* Image Preview */}
                                <div className="flex-shrink-0">
                                    <img
                                        src={generateThumbnailUrl(image.imgproxy_base_url || image.file_url, 48, 48) || image.file_url}
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
                                        {image.file_type} • {image.file_size_display || 'Unknown size'}
                                    </div>
                                    {image.dimensions && (
                                        <div className="text-xs text-gray-400 truncate mt-1">
                                            {image.dimensions}
                                        </div>
                                    )}
                                    {image.description && (
                                        <div className="text-xs text-gray-600 truncate mt-1">
                                            {image.description}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center space-x-1">
                                    {image.file_url && (
                                        <a
                                            href={image.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 text-gray-400 hover:text-blue-600"
                                            title="View image"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </a>
                                    )}
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
                </div>
            )}

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
