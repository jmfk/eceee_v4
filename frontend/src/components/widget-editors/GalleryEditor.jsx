import { useState } from 'react'
import { Plus, Trash2, Image as ImageIcon, Edit3, Eye, Grid, Layout, FolderOpen, ExternalLink } from 'lucide-react'
import BaseWidgetEditor from './BaseWidgetEditor'
import MediaPicker from '../media/MediaPicker'

/**
 * GalleryEditor - Specialized editor for Gallery widgets
 * 
 * Features:
 * - Gallery title and layout configuration
 * - Multi-image management with MediaPicker integration and URL support
 * - Bulk image selection from media library
 * - Image captions and descriptions
 * - Layout options (grid, masonry, carousel, lightbox)
 * - Column settings and display options
 * - Live gallery preview
 * - Media library integration with automatic metadata
 */
const GalleryEditor = ({ config, onChange, errors, widgetType, namespace }) => {
    const [showPreview, setShowPreview] = useState(false)
    const [editingImage, setEditingImage] = useState(null)
    const [showImageForm, setShowImageForm] = useState(false)
    const [showMediaPicker, setShowMediaPicker] = useState(false)

    const layoutOptions = [
        { value: 'grid', label: 'Grid Layout', icon: '⚏', description: 'Evenly spaced image grid' },
        { value: 'masonry', label: 'Masonry', icon: '⚏', description: 'Pinterest-style layout' },
        { value: 'carousel', label: 'Carousel', icon: '→', description: 'Horizontal scrolling' },
        { value: 'lightbox', label: 'Lightbox', icon: '🔍', description: 'Click to enlarge' }
    ]

    const columnOptions = [
        { value: 1, label: '1 Column' },
        { value: 2, label: '2 Columns' },
        { value: 3, label: '3 Columns' },
        { value: 4, label: '4 Columns' },
        { value: 5, label: '5 Columns' },
        { value: 6, label: '6 Columns' }
    ]

    // Handle media selection from MediaPicker
    const handleMediaSelect = (selectedFiles) => {
        if (selectedFiles && selectedFiles.length > 0) {
            // Add multiple images from media library
            const images = config?.images || []
            const newImages = selectedFiles.map(file => ({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                url: file.file_url,
                thumbnail: file.thumbnail_url || file.file_url,
                alt_text: file.title,
                caption: file.title,
                description: file.description || '',
                media_file_id: file.id // Store reference to media file
            }))

            onChange({
                ...config,
                images: [...images, ...newImages]
            })
        }
        setShowMediaPicker(false)
    }

    // Add or update image
    const handleImageSave = (imageData) => {
        const images = config?.images || []
        const imageId = editingImage?.id || Date.now().toString()

        const updatedImage = {
            ...imageData,
            id: imageId
        }

        let updatedImages
        if (editingImage) {
            updatedImages = images.map(image =>
                image.id === imageId ? updatedImage : image
            )
        } else {
            updatedImages = [...images, updatedImage]
        }

        onChange({
            ...config,
            images: updatedImages
        })

        setEditingImage(null)
        setShowImageForm(false)
    }

    // Delete image
    const handleImageDelete = (imageId) => {
        const images = config?.images || []
        const updatedImages = images.filter(image => image.id !== imageId)
        onChange({
            ...config,
            images: updatedImages
        })
    }

    // Move image up/down
    const moveImage = (imageId, direction) => {
        const images = config?.images || []
        const currentIndex = images.findIndex(image => image.id === imageId)
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

        if (newIndex >= 0 && newIndex < images.length) {
            const newImages = [...images]
            const [movedImage] = newImages.splice(currentIndex, 1)
            newImages.splice(newIndex, 0, movedImage)
            onChange({
                ...config,
                images: newImages
            })
        }
    }

    // Render gallery preview
    const renderGalleryPreview = () => {
        const previewConfig = config || {}
        const images = previewConfig.images || []
        const layout = previewConfig.layout || 'grid'
        const columns = previewConfig.columns || 3

        if (images.length === 0) {
            return (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                    <p>No images in gallery</p>
                </div>
            )
        }

        return (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {/* Gallery Header */}
                {previewConfig.title && (
                    <div className="p-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900">
                            {previewConfig.title}
                        </h3>
                    </div>
                )}

                {/* Gallery Content */}
                <div className="p-4">
                    {layout === 'grid' && (
                        <div
                            className="grid gap-4"
                            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                        >
                            {images.map(image => (
                                <div key={image.id} className="group relative">
                                    <img
                                        src={image.url}
                                        alt={image.alt_text}
                                        className="w-full h-32 object-cover rounded-lg"
                                        onError={(e) => {
                                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280">Image not found</text></svg>'
                                        }}
                                    />
                                    {previewConfig.show_captions && (image.caption || image.description) && (
                                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-2 rounded-b-lg">
                                            {image.caption && (
                                                <div className="text-sm font-medium">{image.caption}</div>
                                            )}
                                            {image.description && (
                                                <div className="text-xs opacity-90">{image.description}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {layout === 'masonry' && (
                        <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                            {images.map(image => (
                                <div key={image.id} className="break-inside-avoid mb-4">
                                    <img
                                        src={image.url}
                                        alt={image.alt_text}
                                        className="w-full rounded-lg"
                                        onError={(e) => {
                                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280">Image not found</text></svg>'
                                        }}
                                    />
                                    {previewConfig.show_captions && (image.caption || image.description) && (
                                        <div className="mt-2 text-sm">
                                            {image.caption && (
                                                <div className="font-medium text-gray-900">{image.caption}</div>
                                            )}
                                            {image.description && (
                                                <div className="text-gray-600">{image.description}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {layout === 'carousel' && (
                        <div className="flex space-x-4 overflow-x-auto pb-4">
                            {images.map(image => (
                                <div key={image.id} className="flex-shrink-0 w-64">
                                    <img
                                        src={image.url}
                                        alt={image.alt_text}
                                        className="w-full h-48 object-cover rounded-lg"
                                        onError={(e) => {
                                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280">Image not found</text></svg>'
                                        }}
                                    />
                                    {previewConfig.show_captions && (image.caption || image.description) && (
                                        <div className="mt-2 text-sm">
                                            {image.caption && (
                                                <div className="font-medium text-gray-900">{image.caption}</div>
                                            )}
                                            {image.description && (
                                                <div className="text-gray-600">{image.description}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {layout === 'lightbox' && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {images.map(image => (
                                <div key={image.id} className="group relative cursor-pointer">
                                    <img
                                        src={image.thumbnail || image.url}
                                        alt={image.alt_text}
                                        className="w-full h-24 object-cover rounded-lg group-hover:opacity-80 transition-opacity"
                                        onError={(e) => {
                                            e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280">Image not found</text></svg>'
                                        }}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="bg-black bg-opacity-60 rounded-full p-2">
                                            <Eye className="w-4 h-4 text-white" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Gallery Footer */}
                <div className="px-4 pb-4">
                    <div className="text-xs text-gray-500 text-center">
                        {images.length} image{images.length !== 1 ? 's' : ''} • {layout} layout
                        {layout === 'grid' && ` • ${columns} columns`}
                    </div>
                </div>
            </div>
        )
    }

    // Image form component
    const ImageForm = ({ image, onSave, onCancel }) => {
        const [formData, setFormData] = useState({
            url: image?.url || '',
            thumbnail: image?.thumbnail || '',
            alt_text: image?.alt_text || '',
            caption: image?.caption || '',
            description: image?.description || '',
            media_file_id: image?.media_file_id || null
        })
        const [imageSource, setImageSource] = useState(image?.media_file_id ? 'library' : 'url')
        const [showImagePicker, setShowImagePicker] = useState(false)

        const handleMediaSelectForForm = (selectedFiles) => {
            if (selectedFiles && selectedFiles.length > 0) {
                const selectedFile = selectedFiles[0]
                setFormData({
                    ...formData,
                    url: selectedFile.file_url,
                    thumbnail: selectedFile.thumbnail_url || selectedFile.file_url,
                    alt_text: formData.alt_text || selectedFile.title,
                    caption: formData.caption || selectedFile.title,
                    description: formData.description || selectedFile.description || '',
                    media_file_id: selectedFile.id
                })
            }
            setShowImagePicker(false)
        }

        const handleSubmit = (e) => {
            e.preventDefault()
            if (formData.url && formData.alt_text) {
                onSave({
                    ...formData,
                    id: image?.id
                })
            }
        }

        return (
            <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">
                        {image ? 'Edit Image' : 'Add New Image'}
                    </h4>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        ×
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Image Source Selection */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Image Source *
                        </label>
                        <div className="flex space-x-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="image-source"
                                    value="url"
                                    checked={imageSource === 'url'}
                                    onChange={(e) => setImageSource(e.target.value)}
                                    className="mr-2"
                                />
                                URL
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="image-source"
                                    value="library"
                                    checked={imageSource === 'library'}
                                    onChange={(e) => setImageSource(e.target.value)}
                                    className="mr-2"
                                />
                                Media Library
                            </label>
                        </div>
                    </div>

                    {/* URL Input */}
                    {imageSource === 'url' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Image URL *
                                </label>
                                <input
                                    type="url"
                                    value={formData.url}
                                    onChange={(e) => setFormData({ ...formData, url: e.target.value, media_file_id: null })}
                                    placeholder="https://example.com/image.jpg"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                                {formData.url && (
                                    <div className="flex items-center space-x-2 text-xs text-gray-600 mt-1">
                                        <ExternalLink className="w-3 h-3" />
                                        <a
                                            href={formData.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-blue-600"
                                        >
                                            View original image
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Thumbnail URL (Optional)
                                </label>
                                <input
                                    type="url"
                                    value={formData.thumbnail}
                                    onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                                    placeholder="https://example.com/thumbnail.jpg"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                    Used for lightbox layout. Falls back to main image if not provided.
                                </div>
                            </div>
                        </>
                    )}

                    {/* Media Library Selection */}
                    {imageSource === 'library' && (
                        <div className="space-y-4">
                            <button
                                type="button"
                                onClick={() => setShowImagePicker(true)}
                                className="w-full flex items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                            >
                                <FolderOpen className="w-6 h-6 text-gray-400" />
                                <span className="text-gray-600">
                                    {formData.media_file_id ? 'Change Image from Library' : 'Select Image from Library'}
                                </span>
                            </button>

                            {formData.media_file_id && (
                                <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg">
                                    <p className="font-medium text-green-800">Selected from Media Library</p>
                                    <p>This image is managed in your media library and will stay up-to-date automatically.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Image Preview */}
                    {formData.url && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Preview
                            </label>
                            <img
                                src={formData.url}
                                alt={formData.alt_text || 'Preview'}
                                className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                                onError={(e) => {
                                    e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280">Image not found</text></svg>'
                                }}
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Alt Text *
                        </label>
                        <input
                            type="text"
                            value={formData.alt_text}
                            onChange={(e) => setFormData({ ...formData, alt_text: e.target.value })}
                            placeholder="Describe the image for accessibility"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Caption (Optional)
                        </label>
                        <input
                            type="text"
                            value={formData.caption}
                            onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                            placeholder="Brief caption for the image"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description (Optional)
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Longer description of the image"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        {image ? 'Update Image' : 'Add Image'}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                    >
                        Cancel
                    </button>
                </div>

                {/* Media Picker Modal for Individual Image */}
                {showImagePicker && (
                    <MediaPicker
                        mode="modal"
                        multiple={false}
                        fileTypes={['image']}
                        namespace={namespace}
                        onSelect={handleMediaSelectForForm}
                        onClose={() => setShowImagePicker(false)}
                    />
                )}
            </form>
        )
    }

    return (
        <BaseWidgetEditor
            config={config}
            onChange={onChange}
            errors={errors}
            widgetType={widgetType}
        >
            {({
                config: localConfig,
                handleFieldChange,
                renderTextField,
                renderSelectField,
                renderCheckboxField
            }) => (
                <>
                    {/* Gallery Title */}
                    {renderTextField('title', 'Gallery Title (Optional)', {
                        placeholder: 'Enter a title for your gallery'
                    })}

                    {/* Gallery Layout Settings */}
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h4 className="text-sm font-medium text-blue-900 flex items-center space-x-2">
                            <Layout className="w-4 h-4" />
                            <span>Layout Settings</span>
                        </h4>

                        {/* Layout Selection */}
                        <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">
                                Gallery Layout
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {layoutOptions.map(option => (
                                    <label
                                        key={option.value}
                                        className={`cursor-pointer border-2 rounded-lg p-3 transition-all ${localConfig.layout === option.value
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="gallery-layout"
                                            value={option.value}
                                            checked={localConfig.layout === option.value}
                                            onChange={(e) => handleFieldChange('layout', e.target.value)}
                                            className="sr-only"
                                        />
                                        <div className="text-center">
                                            <div className="text-lg mb-1">{option.icon}</div>
                                            <div className="text-sm font-medium">{option.label}</div>
                                            <div className="text-xs text-gray-500">{option.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Columns for grid layout */}
                        {localConfig.layout === 'grid' && (
                            <div>
                                {renderSelectField('columns', 'Number of Columns', columnOptions)}
                            </div>
                        )}
                    </div>

                    {/* Gallery Images Management */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700">
                                Gallery Images
                            </label>
                            <div className="flex items-center space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setShowMediaPicker(true)}
                                    className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                >
                                    <FolderOpen className="w-3 h-3" />
                                    <span>Add from Library</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowImageForm(true)}
                                    className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add by URL</span>
                                </button>
                            </div>
                        </div>

                        {/* Image Form */}
                        {showImageForm && (
                            <ImageForm
                                image={editingImage}
                                onSave={handleImageSave}
                                onCancel={() => {
                                    setShowImageForm(false)
                                    setEditingImage(null)
                                }}
                            />
                        )}

                        {/* Images List */}
                        <div className="space-y-2">
                            {(localConfig.images || []).map((image, index) => (
                                <div key={image.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                        <img
                                            src={image.url}
                                            alt={image.alt_text}
                                            className="w-12 h-12 object-cover rounded"
                                            onError={(e) => {
                                                e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280" font-size="12">?</text></svg>'
                                            }}
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-sm">
                                                {image.caption || image.alt_text || 'Untitled Image'}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {image.description || 'No description'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <button
                                            type="button"
                                            onClick={() => moveImage(image.id, 'up')}
                                            disabled={index === 0}
                                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveImage(image.id, 'down')}
                                            disabled={index === (localConfig.images || []).length - 1}
                                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingImage(image)
                                                setShowImageForm(true)
                                            }}
                                            className="p-1 text-gray-400 hover:text-blue-600"
                                            title="Edit image"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleImageDelete(image.id)}
                                            className="p-1 text-gray-400 hover:text-red-600"
                                            title="Delete image"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {(!localConfig.images || localConfig.images.length === 0) && (
                                <div className="text-center text-gray-500 py-8 border-2 border-dashed border-gray-300 rounded-lg">
                                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                    <p>No images added yet</p>
                                    <p className="text-xs">Click "Add Image" to get started</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Display Options */}
                    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                            <Grid className="w-4 h-4" />
                            <span>Display Options</span>
                        </h4>

                        {renderCheckboxField(
                            'show_captions',
                            'Show image captions',
                            'Display captions and descriptions with images'
                        )}

                        {renderCheckboxField(
                            'enable_lightbox',
                            'Enable lightbox viewing',
                            'Allow users to view full-size images'
                        )}

                        {localConfig.layout === 'carousel' && (
                            renderCheckboxField(
                                'auto_play',
                                'Auto-advance carousel',
                                'Automatically advance to next image'
                            )
                        )}
                    </div>

                    {/* Live Preview Toggle */}
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                            Gallery Preview
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-800"
                        >
                            <Eye className="w-3 h-3" />
                            <span>{showPreview ? 'Hide' : 'Show'} Preview</span>
                        </button>
                    </div>

                    {/* Gallery Preview */}
                    {showPreview && (
                        <div className="space-y-2">
                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                {renderGalleryPreview()}
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>• Preview shows how the gallery will appear to visitors</p>
                                <p>• Different layouts provide various viewing experiences</p>
                                <p>• Captions and descriptions can be toggled on/off</p>
                            </div>
                        </div>
                    )}

                    {/* Gallery Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                            <ImageIcon className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-blue-900">Gallery Best Practices</h4>
                                <ul className="text-xs text-blue-800 space-y-1">
                                    <li>• Use high-quality images with consistent dimensions</li>
                                    <li>• Provide descriptive alt text for accessibility</li>
                                    <li>• Add meaningful captions to provide context</li>
                                    <li>• Choose appropriate layouts for your content type</li>
                                    <li>• Consider loading performance for large galleries</li>
                                    <li>• Test different layouts to see what works best</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Main Media Picker Modal for Bulk Selection */}
                    {showMediaPicker && (
                        <MediaPicker
                            mode="modal"
                            multiple={true}
                            fileTypes={['image']}
                            namespace={namespace}
                            onSelect={handleMediaSelect}
                            onClose={() => setShowMediaPicker(false)}
                        />
                    )}
                </>
            )}
        </BaseWidgetEditor>
    )
}

export default GalleryEditor 