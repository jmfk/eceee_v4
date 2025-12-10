import React, { useCallback, useState, useEffect } from 'react'
import { X, Eye, Tag, Plus, FolderOpen } from 'lucide-react'
import { getImageUrl, formatFileSize } from './ImageValidationUtils'
import MediaItemTagEditor from '../media/MediaItemTagEditor'
import { getGridStyle, getObjectFitClass } from '../../utils/imageGridLayout'
import CollectionThumbnailGrid from '../media/CollectionThumbnailGrid'
import { mediaCollectionsApi } from '../../api'

const ImageDisplaySection = ({
    images,
    multiple,
    maxFiles,
    onRemoveImage,
    onOpenModal,
    getThumbnailUrl,
    namespace = null,
    onImageTagsChanged = null
}) => {
    const [editingTagsForImage, setEditingTagsForImage] = useState(null)
    if (!images || images.length === 0) return null

    const displayImages = Array.isArray(images) ? images : [images]

    if (multiple && displayImages.length > 1) {
        // Multiple images - show header with count and first few thumbnails
        return (
            <div className="bg-white rounded-lg">
                {/* Header */}
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4">
                    <div className="flex -space-x-2">
                        {displayImages.slice(0, 3).map((image, index) => {
                            const thumbnailUrl = getThumbnailUrl
                                ? getThumbnailUrl(image, 40)
                                : (image.thumbnailUrl || getImageUrl(image))
                            return (
                                <div
                                    key={image.id || index}
                                    className="w-10 h-10 rounded-lg border-2 border-white bg-gray-100 overflow-hidden"
                                >
                                    {thumbnailUrl && (
                                        <img
                                            src={thumbnailUrl}
                                            alt={image.title || image.originalFilename || 'Image'}
                                            className="w-full h-full object-cover"
                                        />
                                        )}
                                    </div>
                                );
                            })}
                        {displayImages.length > 3 && (
                            <div className="w-10 h-10 rounded-lg border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                                +{displayImages.length - 3}
                            </div>
                        )}
                    </div>

                    <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                            {displayImages.length} Image{displayImages.length !== 1 ? 's' : ''} Selected
                            {maxFiles && ` (${displayImages.length}/${maxFiles})`}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                            Click button to select more
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onOpenModal}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        Select More
                    </button>
                </div>

                {/* Compact view with individual image controls */}
                <div className="border-t border-gray-200">
                    <div className="p-4">
                        <div className="grid grid-cols-4 gap-3" style={{ gridAutoFlow: 'dense' }}>
                            {displayImages.map((image, index) => {
                                const thumbnailUrl = getThumbnailUrl
                                    ? getThumbnailUrl(image, 150)
                                    : (image.thumbnailUrl || getImageUrl(image))
                                const isEditingTags = editingTagsForImage === image.id
                                const gridStyle = getGridStyle(image)
                                const objectFitClass = getObjectFitClass(image)
                                
                                return (
                                    <div key={image.id || index} className="relative group" style={gridStyle}>
                                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                            {thumbnailUrl && (
                                                <img
                                                    src={thumbnailUrl}
                                                    alt={image.title || image.originalFilename || 'Image'}
                                                    className={`w-full h-full ${objectFitClass}`}
                                                />
                                            )}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="absolute top-1 right-1 flex gap-1">
                                            {namespace && (
                                                <button
                                                    onClick={() => setEditingTagsForImage(isEditingTags ? null : image.id)}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-opacity ${
                                                        isEditingTags
                                                            ? 'bg-blue-500 text-white'
                                                            : (image.tags && image.tags.length > 0)
                                                                ? 'bg-blue-100 text-blue-600'
                                                                : 'bg-white text-gray-600'
                                                    } opacity-0 group-hover:opacity-100`}
                                                    title={`${(image.tags || []).length} tag${(image.tags || []).length !== 1 ? 's' : ''}`}
                                                >
                                                    <Tag className="w-3 h-3" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(event) => onRemoveImage(image.id, event)}
                                                className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                title="Remove image"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Tag editor overlay */}
                                        {isEditingTags && namespace && onImageTagsChanged && (
                                            <div className="absolute inset-0 bg-white p-2 rounded-lg overflow-y-auto z-10 border-2 border-blue-500">
                                                <MediaItemTagEditor
                                                    mediaFile={{ id: image.id, tags: image.tags || [] }}
                                                    namespace={namespace}
                                                    onTagsChanged={(updatedFile) => {
                                                        onImageTagsChanged(updatedFile)
                                                        setEditingTagsForImage(null)
                                                    }}
                                                    compact={false}
                                                    className="h-full"
                                                />
                                            </div>
                                        )}

                                        {/* Image info */}
                                        <div className="mt-2 text-xs text-gray-500 min-w-0">
                                            <div className="truncate" title={image.title || image.originalFilename}>
                                                {image.title || image.originalFilename || 'Untitled'}
                                            </div>
                                            {image.file_size && (
                                                <div className="truncate">{formatFileSize(image.file_size)}</div>
                                            )}
                                            {image.tags && image.tags.length > 0 && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <Tag className="w-3 h-3 text-blue-500" />
                                                    <span className="text-blue-600">{image.tags.length}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Single image or single image in multiple mode
    const image = displayImages[0]
    const isCollection = image?.type === "collection" || (image?.id && (image?.fileCount !== undefined || image?.sampleImages !== undefined || image?.slug !== undefined) && !image?.url && !image?.fileUrl)
    
    // State for collection data and files
    const [collectionData, setCollectionData] = useState(null)
    const [collectionFiles, setCollectionFiles] = useState([])
    const [loadingCollection, setLoadingCollection] = useState(false)
    
    // Fetch collection data and files when it's a collection
    useEffect(() => {
        if (isCollection && image?.id) {
            const loadCollection = async () => {
                setLoadingCollection(true)
                try {
                    const [collection, filesResult] = await Promise.all([
                        mediaCollectionsApi.get(image.id)(),
                        mediaCollectionsApi.getFiles(image.id, { page_size: 9 })()
                    ])
                    setCollectionData(collection)
                    const files = filesResult.results || filesResult || []
                    setCollectionFiles(files.slice(0, 9)) // Get first 9 images
                } catch (error) {
                    console.error('Failed to load collection:', error)
                    setCollectionData(null)
                    setCollectionFiles([])
                } finally {
                    setLoadingCollection(false)
                }
            }
            loadCollection()
        } else {
            setCollectionData(null)
            setCollectionFiles([])
        }
    }, [isCollection, image?.id])
    
    // For collections, we'll show a collection preview with thumbnails (1-9 images in 3x3 grid)
    if (isCollection) {
        // Determine grid layout based on number of files (1-9 images)
        const fileCount = collectionFiles.length
        const getGridCols = (count) => {
            if (count === 1) return 1
            if (count <= 4) return 2
            return 3 // 5-9 images use 3 columns
        }
        const gridCols = getGridCols(fileCount)
        
        return (
            <div className="bg-white rounded-lg">
                <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 p-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        {loadingCollection ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <FolderOpen className="w-6 h-6 text-gray-400 animate-pulse" />
                            </div>
                        ) : collectionFiles.length > 0 ? (
                            <div 
                                className="w-full h-full grid gap-0.5"
                                style={{
                                    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                                    gridTemplateRows: `repeat(${gridCols}, 1fr)`
                                }}
                            >
                                {collectionFiles.map((file, index) => {
                                    const thumbnailUrl = file.imgproxyBaseUrl || file.imgproxy_base_url || file.thumbnailUrl || file.thumbnail_url || file.url || file.fileUrl
                                    return (
                                        <div key={file.id || index} className="relative overflow-hidden bg-gray-200">
                                            {thumbnailUrl ? (
                                                <img
                                                    src={thumbnailUrl}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none'
                                                    }}
                                                />
                                            ) : null}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <FolderOpen className="w-6 h-6 text-gray-400" />
                            </div>
                        )}
                    </div>

                    <div className="min-w-0 overflow-hidden">
                        <div className="text-sm font-medium text-gray-900 truncate" title={collectionData?.title || "Collection"}>
                            {collectionData?.title || "Collection"}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                            {collectionData?.fileCount || collectionData?.file_count || 0} image{(collectionData?.fileCount || collectionData?.file_count || 0) !== 1 ? 's' : ''}
                        </div>
                    </div>

                    {/* Change button to open modal */}
                    <button
                        type="button"
                        onClick={onOpenModal}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        Change
                    </button>

                    {/* Remove button */}
                    <button
                        onClick={(event) => onRemoveImage(image.id, event)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                        title="Remove collection"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }
    
    // Regular image display
    const thumbnailUrl = getThumbnailUrl
        ? getThumbnailUrl(image, 150)
        : (image.thumbnailUrl || getImageUrl(image))

    return (
        <div className="bg-white rounded-lg">
            <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 p-4">
                <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                    {thumbnailUrl && (
                        <img
                            src={thumbnailUrl}
                            alt={image.title || image.originalFilename || 'Image'}
                            className="w-full h-full object-cover"
                        />
                    )}
                </div>

                <div className="min-w-0 overflow-hidden">
                    <div className="text-sm font-medium text-gray-900 truncate" title={image.title || image.originalFilename || 'Untitled Image'}>
                        {image.title || image.originalFilename || 'Untitled Image'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                        {image.file_size && formatFileSize(image.file_size)}
                        {image.width && image.height && ` • ${image.width}×${image.height}`}
                    </div>
                </div>

                {/* Change/Add button to open modal */}
                <button
                    type="button"
                    onClick={onOpenModal}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" />
                    {multiple ? 'Add More' : 'Change'}
                </button>

                        {/* Remove button */}
                        <button
                            onClick={(event) => onRemoveImage(image.id, event)}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                            title="Remove image"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
        </div>
    )
}

export default React.memo(ImageDisplaySection)
