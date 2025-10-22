import { FileText, FileImage, FileVideo, FileAudio, File } from 'lucide-react'

/**
 * File Validation Utilities
 * 
 * Shared validation logic and utilities for file field components
 */

// File type configuration with comprehensive MIME type and extension support
export const fileTypeCategories = {
    image: {
        mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff'],
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif'],
        icon: FileImage,
        color: 'text-green-600',
        bgColor: 'bg-green-100'
    },
    pdf: {
        mimeTypes: ['application/pdf'],
        extensions: ['.pdf'],
        icon: FileText,
        color: 'text-red-600',
        bgColor: 'bg-red-100',
        label: 'PDF'
    },
    word: {
        mimeTypes: [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        extensions: ['.doc', '.docx'],
        icon: FileText,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        label: 'Word'
    },
    excel: {
        mimeTypes: [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ],
        extensions: ['.xls', '.xlsx'],
        icon: FileText,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        label: 'Excel'
    },
    powerpoint: {
        mimeTypes: [
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ],
        extensions: ['.ppt', '.pptx'],
        icon: FileText,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100',
        label: 'PowerPoint'
    },
    text: {
        mimeTypes: ['text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript'],
        extensions: ['.txt', '.csv', '.html', '.css', '.js', '.json', '.xml'],
        icon: FileText,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        label: 'Text'
    },
    video: {
        mimeTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime'],
        extensions: ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.qt'],
        icon: FileVideo,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100'
    },
    audio: {
        mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp3', 'audio/flac'],
        extensions: ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'],
        icon: FileAudio,
        color: 'text-orange-600',
        bgColor: 'bg-orange-100'
    }
}

// Get all allowed MIME types based on configuration
export const getAllowedMimeTypes = (allowedFileTypes, allowedMimeTypes) => {
    if (allowedMimeTypes.length > 0) {
        return allowedMimeTypes
    }

    const mimeTypes = []
    allowedFileTypes.forEach(category => {
        if (fileTypeCategories[category]) {
            mimeTypes.push(...fileTypeCategories[category].mimeTypes)
        }
    })
    return mimeTypes
}

// Get allowed file extensions as array
export const getAllowedExtensions = (allowedExtensions) => {
    if (!allowedExtensions) return []
    return allowedExtensions
        .split(',')
        .map(ext => ext.trim().toLowerCase())
        .filter(ext => ext.length > 0)
}

// Validate file against all constraints
export const validateFile = (file, config) => {
    const { allowedFileTypes, allowedMimeTypes, allowedExtensions, maxFileSize, minFileSize } = config
    const fieldErrors = []
    const uploadErrors = []

    // MIME type validation for field constraints
    const allowedMimes = getAllowedMimeTypes(allowedFileTypes, allowedMimeTypes)
    if (allowedMimes.length > 0 && !allowedMimes.includes(file.type)) {
        fieldErrors.push(`File type ${file.type} is not allowed for this field`)
    }

    // Extension validation for field constraints
    const allowedExts = getAllowedExtensions(allowedExtensions)
    if (allowedExts.length > 0) {
        const fileExt = '.' + file.name.split('.').pop().toLowerCase()
        if (!allowedExts.includes(fileExt)) {
            fieldErrors.push(`File extension ${fileExt} is not allowed for this field`)
        }
    }

    // File size validation (applies to both upload and field)
    if (maxFileSize && file.size > (maxFileSize * 1024 * 1024)) {
        uploadErrors.push(`File size exceeds maximum of ${maxFileSize}MB`)
    }

    if (minFileSize && file.size < (minFileSize * 1024)) {
        uploadErrors.push(`File size is below minimum of ${minFileSize}KB`)
    }

    // Check if file can be uploaded at all (basic safety checks)
    const canUpload = uploadErrors.length === 0
    const canAddToField = fieldErrors.length === 0 && canUpload

    return {
        isValid: canUpload, // Can be uploaded to media library
        canAddToField: canAddToField, // Can be added to this specific field
        fieldErrors: fieldErrors, // Errors preventing addition to field
        uploadErrors: uploadErrors, // Errors preventing upload entirely
        errors: [...uploadErrors, ...fieldErrors] // All errors combined
    }
}

// Get file type info for display with enhanced detection
export const getFileTypeInfo = (fileType, filename = '') => {
    // First try MIME type matching
    for (const [category, config] of Object.entries(fileTypeCategories)) {
        if (config.mimeTypes.includes(fileType)) {
            return {
                category: config.label || category,
                originalCategory: category,
                ...config
            }
        }
    }

    // Fallback to extension matching if MIME type doesn't match
    if (filename) {
        const extension = '.' + filename.toLowerCase().split('.').pop()
        for (const [category, config] of Object.entries(fileTypeCategories)) {
            if (config.extensions && config.extensions.includes(extension)) {
                return {
                    category: config.label || category,
                    originalCategory: category,
                    ...config
                }
            }
        }
    }

    // Enhanced fallback based on common patterns
    if (fileType) {
        if (fileType.startsWith('image/')) {
            return {
                category: 'Image',
                originalCategory: 'image',
                icon: FileImage,
                color: 'text-green-600',
                bgColor: 'bg-green-100'
            }
        }
        if (fileType.startsWith('video/')) {
            return {
                category: 'Video',
                originalCategory: 'video',
                icon: FileVideo,
                color: 'text-purple-600',
                bgColor: 'bg-purple-100'
            }
        }
        if (fileType.startsWith('audio/')) {
            return {
                category: 'Audio',
                originalCategory: 'audio',
                icon: FileAudio,
                color: 'text-orange-600',
                bgColor: 'bg-orange-100'
            }
        }
        if (fileType.includes('text') || fileType.includes('document')) {
            return {
                category: 'Document',
                originalCategory: 'document',
                icon: FileText,
                color: 'text-blue-600',
                bgColor: 'bg-blue-100'
            }
        }
    }

    // Default for unknown file types
    return {
        category: 'File',
        originalCategory: 'unknown',
        icon: File,
        color: 'text-gray-600',
        bgColor: 'bg-gray-100'
    }
}

// Format file size
export const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Generate FULL file URL for display (NOT thumbnails)
export const getFileUrl = (file) => {
    // Check full file fields (NOT thumbnails - those are handled separately)
    return file.imgproxyBaseUrl || file.imgproxy_base_url || file.fileUrl || file.file_url || file.url
}

// Generate accept attribute for file input
export const getAcceptAttribute = (allowedFileTypes, allowedMimeTypes) => {
    const allowedMimes = getAllowedMimeTypes(allowedFileTypes, allowedMimeTypes)
    return allowedMimes.length > 0 ? allowedMimes.join(',') : '*/*'
}
