import React from 'react'
import { FolderOpen, Eye, ChevronUp, ChevronDown, X } from 'lucide-react'

/**
 * FileDisplaySection Component
 * 
 * Handles display of selected files in contracted view including:
 * - Multiple files header with count and management
 * - Individual file previews with thumbnails/icons
 * - File removal functionality
 * - Expand/collapse controls
 */
const FileDisplaySection = ({
    files,
    multiple,
    fileTypeLabel,
    maxFiles,
    isExpanded,
    setIsExpanded,
    onRemoveFile,
    // Utility functions passed from parent
    getFileTypeInfo,
    getThumbnailUrl,
    getFileUrl,
    formatFileSize
}) => {
    if (!files || files.length === 0) {
        return null
    }

    return (
        <div className={`transition-colors ${isExpanded ? 'border-b border-gray-200 bg-gray-50 rounded-t-md' : 'rounded-md'
            }`}>
            {/* Multiple files header */}
            {multiple && files.length > 1 && !isExpanded && (
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-t-md">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                            {files.length} {fileTypeLabel}{files.length > 1 ? 's' : ''} selected
                            {maxFiles && ` (max: ${maxFiles})`}
                        </span>
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                        >
                            Manage Files
                        </button>
                    </div>
                </div>
            )}

            {/* Selected Files Display */}
            {files.map((file, index) => {
                const fileTypeInfo = getFileTypeInfo(file.file_type || file.fileType)
                const thumbnailUrl = getThumbnailUrl(file, 48)
                const IconComponent = fileTypeInfo.icon

                return (
                    <div key={file.id} className="flex items-center space-x-3 p-4">
                        {/* File Preview */}
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                {thumbnailUrl ? (
                                    <img
                                        src={thumbnailUrl}
                                        alt={file.title}
                                        className="w-full h-full object-cover rounded"
                                        onError={(e) => {
                                            e.target.style.display = 'none'
                                            e.target.nextSibling.style.display = 'flex'
                                        }}
                                    />
                                ) : null}
                                <div className={`w-full h-full rounded ${fileTypeInfo.bgColor} flex items-center justify-center ${thumbnailUrl ? 'hidden' : 'flex'
                                    }`}>
                                    <IconComponent className={`w-6 h-6 ${fileTypeInfo.color}`} />
                                </div>
                            </div>
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                                {file.title}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                                {fileTypeInfo.category} • {formatFileSize(file.fileSize || file.file_size)}
                            </div>
                            {file.dimensions && (
                                <div className="text-xs text-gray-400 truncate mt-1">
                                    {file.dimensions}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-1">
                            {getFileUrl(file) && (
                                <a
                                    href={getFileUrl(file)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 text-gray-400 hover:text-blue-600"
                                    title="View file"
                                >
                                    <Eye className="w-4 h-4" />
                                </a>
                            )}
                            {multiple && (
                                <button
                                    type="button"
                                    onClick={() => onRemoveFile(file.id)}
                                    className="p-1 text-gray-400 hover:text-red-600"
                                    title={`Remove ${fileTypeLabel.toLowerCase()}`}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="p-1 text-gray-400 hover:text-blue-600"
                                title={isExpanded ? "Collapse" : `Replace ${fileTypeLabel.toLowerCase()}`}
                            >
                                {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                ) : (
                                    <FolderOpen className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export default FileDisplaySection
