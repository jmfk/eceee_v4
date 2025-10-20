import React, { useState } from 'react'
import { Image, FolderOpen, X, Eye } from 'lucide-react'
import MediaPicker from '../media/MediaPicker'

/**
 * MediaField - Form field component for media selection
 * 
 * Features:
 * - Single or multiple media file selection
 * - Media type filtering (image, video, audio, document)
 * - Preview of selected media
 * - Integration with MediaPicker component
 * - Validation support
 */
const MediaField = ({
    value,
    onChange,
    label,
    description,
    required,
    multiple = false,
    mediaTypes = ['image', 'video', 'audio', 'document'],
    maxItems = null,
    minItems = null,
    validation,
    isValidating,
    showValidation = true,
    namespace,
    mode = 'modal' // 'modal' | 'inline'
}) => {
    const [showMediaPicker, setShowMediaPicker] = useState(false)

    // Handle media selection from MediaPicker
    const handleMediaSelect = (selectedFiles) => {
        if (multiple) {
            // For multiple selection, merge with existing files
            const currentFiles = Array.isArray(value) ? value : []
            const newFiles = selectedFiles.filter(file =>
                !currentFiles.some(existing => existing.id === file.id)
            )
            const updatedFiles = [...currentFiles, ...newFiles]

            // Apply maxItems limit if specified
            const finalFiles = maxItems ? updatedFiles.slice(0, maxItems) : updatedFiles
            onChange(finalFiles)
        } else {
            // For single selection, use the first selected file
            onChange(selectedFiles.length > 0 ? selectedFiles[0] : null)
        }
        setShowMediaPicker(false)
    }

    // Remove a media file
    const handleRemoveMedia = (mediaId) => {
        if (multiple) {
            const currentFiles = Array.isArray(value) ? value : []
            onChange(currentFiles.filter(file => file.id !== mediaId))
        } else {
            onChange(null)
        }
    }

    // Get display value for rendering
    const getDisplayValue = () => {
        if (multiple) {
            return Array.isArray(value) ? value : []
        }
        return value ? [value] : []
    }

    const displayFiles = getDisplayValue()
    const hasFiles = displayFiles.length > 0
    const canAddMore = multiple ? (!maxItems || displayFiles.length < maxItems) : !hasFiles

    // Validation state
    const hasError = showValidation && validation && !validation.isValid
    const errorMessage = hasError ? validation.message : null

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
                    onClick={() => setShowMediaPicker(true)}
                    className={`w-full flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg transition-colors ${hasError
                        ? 'border-red-300 hover:border-red-400 hover:bg-red-50'
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        }`}
                >
                    <FolderOpen className="w-6 h-6 text-gray-400" />
                    <span className="text-gray-600">
                        {hasFiles
                            ? `Add ${multiple ? 'More' : 'Another'} ${mediaTypes.includes('image') ? 'Media' : 'File'}`
                            : `Select ${mediaTypes.includes('image') ? 'Media' : 'File'}${multiple ? 's' : ''} from Library`
                        }
                    </span>
                </button>
            )}

            {/* Selected Media Display */}
            {hasFiles && (
                <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">
                        Selected {mediaTypes.includes('image') ? 'Media' : 'File'}
                        {multiple && displayFiles.length > 1 ? 's' : ''}
                        {multiple && ` (${displayFiles.length}${maxItems ? `/${maxItems}` : ''})`}
                    </div>

                    <div className={`grid gap-3 ${multiple ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                        {displayFiles.map((file) => (
                            <div key={file.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                                {/* Media Preview */}
                                <div className="flex-shrink-0">
                                    {file.file_type?.startsWith('image/') ? (
                                        <img
                                            src={file.imgproxy_base_url || file.file_url}
                                            alt={file.title}
                                            className="w-12 h-12 object-cover rounded"
                                            onError={(e) => {
                                                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-size="12">IMG</text></svg>'
                                            }}
                                        />
                                    ) : (
                                        <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
                                            <Image className="w-6 h-6 text-blue-600" />
                                        </div>
                                    )}
                                </div>

                                {/* File Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-900 truncate">
                                        {file.title}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                        {file.file_type} • {file.file_size_display || 'Unknown size'}
                                    </div>
                                    {file.description && (
                                        <div className="text-xs text-gray-600 truncate mt-1">
                                            {file.description}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center space-x-1">
                                    {file.file_url && (
                                        <a
                                            href={file.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 text-gray-400 hover:text-blue-600"
                                            title="View file"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </a>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveMedia(file.id)}
                                        className="p-1 text-gray-400 hover:text-red-600"
                                        title="Remove file"
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
                    {minItems && `Minimum: ${minItems} file${minItems !== 1 ? 's' : ''}`}
                    {minItems && maxItems && ' • '}
                    {maxItems && `Maximum: ${maxItems} file${maxItems !== 1 ? 's' : ''}`}
                </div>
            )}

            {/* MediaPicker */}
            {showMediaPicker && (
                <MediaPicker
                    mode={mode}
                    multiple={multiple}
                    fileTypes={mediaTypes}
                    namespace={namespace}
                    onSelect={handleMediaSelect}
                    onClose={() => setShowMediaPicker(false)}
                />
            )}
        </div>
    )
}

export default MediaField
