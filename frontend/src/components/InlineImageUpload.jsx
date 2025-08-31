import React, { useState, useRef } from 'react'
import { Upload, X, Image, Loader } from 'lucide-react'
import { api } from '../api/client'

/**
 * InlineImageUpload Component
 * 
 * A reusable component for uploading images inline with immediate feedback.
 * Handles the upload process separately from form submission and provides
 * a clean URL that can be used in JSON form data.
 */
const InlineImageUpload = ({
    currentImageUrl = null,
    onImageChange,
    objectTypeId = null,
    placeholder = "Upload image",
    maxSizeBytes = 5 * 1024 * 1024, // 5MB default
    acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    className = '',
    disabled = false
}) => {
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(currentImageUrl)
    const fileInputRef = useRef(null)

    const validateFile = (file) => {
        if (!file) return 'No file selected'

        if (!acceptedTypes.includes(file.type)) {
            return `File type not allowed. Accepted types: ${acceptedTypes.join(', ')}`
        }

        if (file.size > maxSizeBytes) {
            const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024))
            return `File too large. Maximum size: ${maxSizeMB}MB`
        }

        return null
    }

    const handleFileSelect = async (event) => {
        const file = event.target.files[0]
        if (!file) return

        // Validate file
        const validationError = validateFile(file)
        if (validationError) {
            setUploadError(validationError)
            return
        }

        // Clear any previous errors
        setUploadError(null)
        setIsUploading(true)

        try {
            // Create FormData for upload
            const formData = new FormData()
            formData.append('image', file)

            // Include object type ID if provided
            if (objectTypeId) {
                formData.append('object_type_id', objectTypeId)
            }

            // Upload the image
            const response = await api.post('/api/v1/objects/api/upload-image/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                }
            })

            // Update preview and notify parent
            const imageUrl = response.data.url
            setPreviewUrl(imageUrl)

            // If object type was updated, we don't need to pass the URL to parent
            // since it's already saved to the object
            if (response.data.object_type_updated) {
                onImageChange && onImageChange(imageUrl)
            } else {
                onImageChange && onImageChange(imageUrl)
            }

        } catch (error) {
            console.error('Image upload failed:', error)
            setUploadError(
                error.response?.data?.error ||
                error.response?.data?.detail ||
                'Upload failed. Please try again.'
            )
        } finally {
            setIsUploading(false)
        }
    }

    const handleRemoveImage = () => {
        setPreviewUrl(null)
        onImageChange(null)
        setUploadError(null)

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const triggerFileSelect = () => {
        if (disabled || isUploading) return
        fileInputRef.current?.click()
    }

    return (
        <div className={`inline-image-upload ${className}`}>
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes.join(',')}
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled || isUploading}
            />

            <div className="flex items-start space-x-4">
                {/* Image Preview */}
                <div className="flex-shrink-0">
                    {previewUrl ? (
                        <div className="relative group">
                            <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200 group-hover:border-gray-300 transition-colors"
                            />
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={handleRemoveImage}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Remove image"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                            {isUploading && (
                                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                                    <Loader className="w-6 h-6 text-white animate-spin" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div
                            className={`w-20 h-20 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors ${disabled || isUploading
                                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                                : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 cursor-pointer'
                                }`}
                            onClick={triggerFileSelect}
                        >
                            {isUploading ? (
                                <Loader className="w-6 h-6 text-gray-400 animate-spin" />
                            ) : (
                                <Image className="w-6 h-6 text-gray-400" />
                            )}
                        </div>
                    )}
                </div>

                {/* Upload Controls */}
                <div className="flex-1">
                    <button
                        type="button"
                        onClick={triggerFileSelect}
                        disabled={disabled || isUploading}
                        className={`inline-flex items-center px-4 py-2 border rounded-md shadow-sm text-sm font-medium transition-colors ${disabled || isUploading
                            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        {isUploading ? (
                            <>
                                <Loader className="w-4 h-4 mr-2 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                {previewUrl ? 'Change Image' : placeholder}
                            </>
                        )}
                    </button>

                    {/* Helper text */}
                    <p className="text-xs text-gray-500 mt-2">
                        {acceptedTypes.map(type => type.split('/')[1]).join(', ').toUpperCase()} up to {Math.round(maxSizeBytes / (1024 * 1024))}MB
                    </p>

                    {/* Error message */}
                    {uploadError && (
                        <p className="text-red-600 text-sm mt-1">{uploadError}</p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default InlineImageUpload
