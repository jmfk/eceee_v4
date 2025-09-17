import { FileText, FileImage, FileVideo, FileAudio, File } from 'lucide-react'

/**
 * Validate an image file against constraints
 */
export const validateImageFile = (file, constraints = {}, currentFieldCount = 0, maxFiles = null) => {
    const errors = []
    const fieldErrors = []

    // Default constraints
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

    const imageConstraints = { ...defaultConstraints, ...constraints }

    // Check file type
    if (imageConstraints.allowedTypes && imageConstraints.allowedTypes.length > 0) {
        if (!imageConstraints.allowedTypes.includes(file.type)) {
            const allowedExtensions = imageConstraints.allowedTypes.map(type =>
                type.split('/')[1].toUpperCase()
            ).join(', ')
            fieldErrors.push(`Only ${allowedExtensions} images allowed`)
        }
    }

    // Check file size
    if (imageConstraints.maxSize && file.size > imageConstraints.maxSize) {
        errors.push(`File size exceeds ${formatFileSize(imageConstraints.maxSize)} limit`)
    }

    if (imageConstraints.minSize && file.size < imageConstraints.minSize) {
        errors.push(`File size below ${formatFileSize(imageConstraints.minSize)} minimum`)
    }

    // Check max files limit
    const canAddToField = maxFiles ? (currentFieldCount < maxFiles) : true
    if (!canAddToField) {
        fieldErrors.push(`Maximum ${maxFiles} images allowed in field`)
    }

    const isValid = errors.length === 0

    return {
        isValid,
        canAddToField: isValid && canAddToField,
        uploadErrors: errors,
        fieldErrors
    }
}

/**
 * Get image type information for display
 */
export const getImageTypeInfo = (mimeType) => {
    const type = mimeType?.toLowerCase() || ''

    if (type.startsWith('image/')) {
        return {
            category: 'image',
            icon: FileImage,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
        }
    }

    // Fallback for non-images
    return {
        category: 'other',
        icon: File,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100'
    }
}

/**
 * Format file size for display
 */
export const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'

    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Get image URL for display
 */
export const getImageUrl = (image) => {
    if (image.file_url) return image.file_url
    if (image.url) return image.url
    if (image.file) return image.file
    return null
}

/**
 * Get accept attribute for file input (images only)
 */
export const getImageAcceptAttribute = (constraints = {}) => {
    const defaultTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const allowedTypes = constraints.allowedTypes || defaultTypes
    return allowedTypes.join(',')
}

/**
 * Check if file is an image
 */
export const isImageFile = (file) => {
    return file.type && file.type.startsWith('image/')
}

/**
 * Get allowed MIME types for images
 */
export const getAllowedImageTypes = (constraints = {}) => {
    const defaultTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    return constraints.allowedTypes || defaultTypes
}
