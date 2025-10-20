import React, { useCallback } from 'react'
import { X, ChevronDown, ChevronUp, Eye } from 'lucide-react'
import { getImageUrl, formatFileSize } from './ImageValidationUtils'

const ImageDisplaySection = ({
    images,
    multiple,
    maxFiles,
    isExpanded,
    setIsExpanded,
    onRemoveImage,
    getThumbnailUrl
}) => {
    if (!images || images.length === 0) return null

    const displayImages = Array.isArray(images) ? images : [images]

    if (multiple && displayImages.length > 1) {
        // Multiple images - show header with count and first few thumbnails
        return (
            <div className="bg-white rounded-lg">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            {displayImages.slice(0, 3).map((image, index) => {
                                const thumbnailUrl = getThumbnailUrl ? getThumbnailUrl(image, 40) : getImageUrl(image)
                                return (
                                    <div
                                        key={image.id || index}
                                        className="w-10 h-10 rounded-lg border-2 border-white bg-gray-100 overflow-hidden"
                                    >
                                        {thumbnailUrl && (
                                            <img
                                                src={thumbnailUrl}
                                                alt={image.title || image.original_filename || 'Image'}
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                    </div>
                                )
                            })}
                            {displayImages.length > 3 && (
                                <div className="w-10 h-10 rounded-lg border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                    +{displayImages.length - 3}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="text-sm font-medium text-gray-900">
                                {displayImages.length} Image{displayImages.length !== 1 ? 's' : ''} Selected
                                {maxFiles && ` (${displayImages.length}/${maxFiles})`}
                            </div>
                            <div className="text-xs text-gray-500">
                                Click to manage selection
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    >
                        Manage Images
                        {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                    </button>
                </div>

                {/* Expanded view with individual image controls */}
                {isExpanded && (
                    <div className="p-4">
                        <div className="grid grid-cols-4 gap-3">
                            {displayImages.map((image, index) => {
                                const thumbnailUrl = getThumbnailUrl ? getThumbnailUrl(image, 150) : getImageUrl(image)
                                return (
                                    <div key={image.id || index} className="relative group">
                                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                            {thumbnailUrl && (
                                                <img
                                                    src={thumbnailUrl}
                                                    alt={image.title || image.original_filename || 'Image'}
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                        </div>

                                        {/* Remove button */}
                                        <button
                                            onClick={(event) => onRemoveImage(image.id, event)}
                                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                            title="Remove image"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>

                                        {/* Image info */}
                                        <div className="mt-2 text-xs text-gray-500">
                                            <div className="truncate" title={image.title || image.original_filename}>
                                                {image.title || image.original_filename || 'Untitled'}
                                            </div>
                                            {image.file_size && (
                                                <div>{formatFileSize(image.file_size)}</div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Single image or single image in multiple mode
    const image = displayImages[0]
    const thumbnailUrl = getThumbnailUrl ? getThumbnailUrl(image, 150) : getImageUrl(image)

    return (
        <div className="bg-white rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        {thumbnailUrl && (
                            <img
                                src={thumbnailUrl}
                                alt={image.title || image.original_filename || 'Image'}
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>

                    <div>
                        <div className="text-sm font-medium text-gray-900">
                            {image.title || image.original_filename || 'Untitled Image'}
                        </div>
                        <div className="text-xs text-gray-500">
                            {image.file_size && formatFileSize(image.file_size)}
                            {image.width && image.height && ` • ${image.width}×${image.height}`}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Preview button */}
                    {thumbnailUrl && (
                        <button
                            type="button"
                            onClick={() => window.open(getImageUrl(image), '_blank')}
                            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            title="View full size"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                    )}

                    {/* Remove button */}
                    <button
                        onClick={(event) => onRemoveImage(image.id, event)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove image"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Expand button */}
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default React.memo(ImageDisplaySection)
