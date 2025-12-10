import React, { useState, useCallback, useRef, useMemo } from 'react'
import { Image } from 'lucide-react'
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext'
import ImageDisplaySection from './ImageDisplaySection'
import MediaSelectModal from '../media/MediaSelectModal'
import {
    validateImageFile,
    getImageUrl,
    isImageFile
} from './ImageValidationUtils'

/**
 * ExpandableImageField - Image field with unified media modal
 * 
 * Features:
 * - Compact preview mode showing selected images
 * - Full-screen MediaInsertModal for image selection
 * - Upload functionality via MediaBrowser
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
    maxFiles = null,
    // Allow collection selection
    allowCollections = true
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
    const [dragOver, setDragOver] = useState(false)

    const { addNotification } = useGlobalNotifications()
    const fieldRef = useRef(null)

    // Memoize display values to prevent recalculation
    const displayImages = useMemo(() => {
        if (multiple) {
            return Array.isArray(value) ? value : []
        }
        return value ? [value] : []
    }, [value, multiple])

    // Get image URL - use backend-provided thumbnail for optimal performance
    const getThumbnailUrl = useCallback((image, size = 150) => {
        // Use backend-provided thumbnail if available (pre-generated 150x150)
        if (image.thumbnail_url || image.thumbnailUrl) {
            return image.thumbnail_url || image.thumbnailUrl
        }
        // Fallback to full URL
        return getImageUrl(image)
    }, [])

    // Handle media selection from modal
    const handleMediaSelect = useCallback((selected) => {
        if (multiple) {
            // For multiple selection, selected is an array
            const selectedArray = Array.isArray(selected) ? selected : [selected]

            // Validate max items
            if (maxItems && selectedArray.length > maxItems) {
                addNotification(`Maximum ${maxItems} images allowed`, 'warning')
                onChange(selectedArray.slice(0, maxItems))
            } else {
                onChange(selectedArray)
            }
        } else {
            // For single selection
            onChange(selected)
        }
        setIsModalOpen(false)
    }, [multiple, maxItems, onChange, addNotification])

    // Remove an image from field
    const handleRemoveImage = useCallback((imageId, event) => {
        if (multiple) {
            const currentImages = Array.isArray(value) ? value : []
            onChange(currentImages.filter(img => img.id !== imageId))
        } else {
            onChange(null)
        }
    }, [multiple, value, onChange])

    // Drag and drop handlers (open modal when files dropped)
    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)
        // Open modal - user can upload there
        setIsModalOpen(true)
    }, [])

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        setDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
        setDragOver(false)
    }, [])

    const hasImages = displayImages.length > 0
    const hasError = showValidation && validation && !validation.isValid
    const errorMessage = hasError ? validation.message : null

    // Handle image tags change
    const handleImageTagsChanged = useCallback((updatedFile) => {
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
    }, [multiple, value, onChange])

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
                    <ImageDisplaySection
                        images={displayImages}
                        multiple={multiple}
                        maxFiles={maxFiles}
                        onRemoveImage={handleRemoveImage}
                        onOpenModal={() => setIsModalOpen(true)}
                        getThumbnailUrl={getThumbnailUrl}
                        namespace={namespace}
                        onImageTagsChanged={handleImageTagsChanged}
                    />
                ) : (
                    /* Empty State with Dropzone */
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className={`w-full flex items-center justify-center gap-2 p-6 transition-colors ${hasError
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

            {/* Media Select Modal */}
            <MediaSelectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSelect={handleMediaSelect}
                multiple={multiple}
                allowCollections={allowCollections}
                currentSelection={multiple ? null : (displayImages && displayImages[0])}
                namespace={namespace}
            />
        </div>
    )
}

export default ExpandableImageField
