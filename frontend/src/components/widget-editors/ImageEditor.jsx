import { useState, useRef } from 'react'
import { Upload, Image as ImageIcon, X, ExternalLink, FolderOpen } from 'lucide-react'
import BaseWidgetEditor from './BaseWidgetEditor'
import MediaPicker from '../media/MediaPicker'

/**
 * ImageEditor - Specialized editor for Image widgets
 * 
 * Features:
 * - Image upload with drag and drop
 * - URL input option
 * - Live preview with sizing
 * - Alt text and caption editing
 * - Alignment controls
 */
const ImageEditor = ({ config, onChange, errors, widgetType, namespace }) => {
    const [dragOver, setDragOver] = useState(false)
    const [uploadMethod, setUploadMethod] = useState('url') // 'url', 'upload', or 'library'
    const [showMediaPicker, setShowMediaPicker] = useState(false)
    const fileInputRef = useRef(null)

    const sizeOptions = [
        { value: 'small', label: 'Small (320px)' },
        { value: 'medium', label: 'Medium (640px)' },
        { value: 'large', label: 'Large (1024px)' },
        { value: 'full', label: 'Full Width' }
    ]

    const alignmentOptions = [
        { value: 'left', label: 'Left' },
        { value: 'center', label: 'Center' },
        { value: 'right', label: 'Right' }
    ]

    const handleFileUpload = (file) => {
        if (!file || !file.type.startsWith('image/')) {
            return
        }

        // Create a preview URL for the uploaded file
        const previewUrl = URL.createObjectURL(file)

        // In a real implementation, you would upload the file to your server
        // For now, we'll use the preview URL
        onChange({
            ...config,
            image_url: previewUrl,
            alt_text: config.alt_text || file.name.replace(/\.[^/.]+$/, '')
        })
    }

    const handleMediaSelect = (selectedFiles) => {
        if (selectedFiles && selectedFiles.length > 0) {
            const selectedFile = selectedFiles[0]
            onChange({
                ...config,
                image_url: selectedFile.file_url,
                alt_text: config.alt_text || selectedFile.title,
                media_file_id: selectedFile.id // Store reference to media file
            })
        }
        setShowMediaPicker(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragOver(false)

        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0) {
            handleFileUpload(files[0])
        }
    }

    const handleFileInput = (e) => {
        const files = Array.from(e.target.files)
        if (files.length > 0) {
            handleFileUpload(files[0])
        }
    }

    const renderImagePreview = () => {
        const previewConfig = config || {}
        if (!previewConfig.image_url) {
            return (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                    <p>No image selected</p>
                </div>
            )
        }

        const sizeClasses = {
            small: 'w-32',
            medium: 'w-64',
            large: 'w-96',
            full: 'w-full'
        }

        const alignmentClasses = {
            left: 'text-left',
            center: 'text-center',
            right: 'text-right'
        }

        return (
            <div className={`${alignmentClasses[previewConfig.alignment || 'center']}`}>
                <img
                    src={previewConfig.image_url}
                    alt={previewConfig.alt_text || 'Preview image'}
                    className={`inline-block rounded-lg shadow-sm ${sizeClasses[previewConfig.size || 'medium']}`}
                    onError={(e) => {
                        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%236b7280">Image not found</text></svg>'
                    }}
                />
                {previewConfig.caption && (
                    <p className="text-sm text-gray-600 mt-2">{previewConfig.caption}</p>
                )}
            </div>
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
                renderUrlField
            }) => (
                <>
                    {/* Image Source Selection */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Image Source *
                        </label>
                        <div className="flex space-x-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="upload-method"
                                    value="url"
                                    checked={uploadMethod === 'url'}
                                    onChange={(e) => setUploadMethod(e.target.value)}
                                    className="mr-2"
                                />
                                URL
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="upload-method"
                                    value="library"
                                    checked={uploadMethod === 'library'}
                                    onChange={(e) => setUploadMethod(e.target.value)}
                                    className="mr-2"
                                />
                                Media Library
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="upload-method"
                                    value="upload"
                                    checked={uploadMethod === 'upload'}
                                    onChange={(e) => setUploadMethod(e.target.value)}
                                    className="mr-2"
                                />
                                Upload File
                            </label>
                        </div>
                    </div>

                    {/* URL Input */}
                    {uploadMethod === 'url' && (
                        <div className="space-y-2">
                            {renderUrlField('image_url', 'Image URL', {
                                placeholder: 'https://example.com/image.jpg'
                            })}
                            {localConfig.image_url && (
                                <div className="flex items-center space-x-2 text-xs text-gray-600">
                                    <ExternalLink className="w-3 h-3" />
                                    <a
                                        href={localConfig.image_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-blue-600"
                                    >
                                        View original image
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Media Library Selection */}
                    {uploadMethod === 'library' && (
                        <div className="space-y-4">
                            <button
                                type="button"
                                onClick={() => setShowMediaPicker(true)}
                                className="w-full flex items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                            >
                                <FolderOpen className="w-6 h-6 text-gray-400" />
                                <span className="text-gray-600">
                                    {localConfig.image_url ? 'Change Image from Library' : 'Select Image from Library'}
                                </span>
                            </button>

                            {localConfig.media_file_id && (
                                <div className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg">
                                    <p className="font-medium text-green-800">Selected from Media Library</p>
                                    <p>This image is managed in your media library and will stay up-to-date automatically.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* File Upload */}
                    {uploadMethod === 'upload' && (
                        <div className="space-y-2">
                            <div
                                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragOver
                                    ? 'border-blue-400 bg-blue-50'
                                    : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                onDrop={handleDrop}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    setDragOver(true)
                                }}
                                onDragLeave={() => setDragOver(false)}
                            >
                                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <p className="text-sm text-gray-600 mb-2">
                                    Drag and drop an image here, or
                                </p>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    Choose File
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileInput}
                                    className="hidden"
                                />
                            </div>
                            <p className="text-xs text-gray-500">
                                Supported formats: JPG, PNG, GIF, WebP (max 10MB)
                            </p>
                        </div>
                    )}

                    {/* Alt Text */}
                    {renderTextField('alt_text', 'Alt Text', {
                        placeholder: 'Describe the image for accessibility'
                    })}

                    {/* Caption */}
                    {renderTextField('caption', 'Caption (Optional)', {
                        placeholder: 'Optional caption displayed below the image'
                    })}

                    {/* Size Selection */}
                    {renderSelectField('size', 'Image Size', sizeOptions)}

                    {/* Alignment */}
                    {renderSelectField('alignment', 'Alignment', alignmentOptions)}

                    {/* Clear Image Button */}
                    {localConfig.image_url && (
                        <button
                            type="button"
                            onClick={() => handleFieldChange('image_url', '')}
                            className="flex items-center space-x-1 text-red-600 hover:text-red-800 text-sm"
                        >
                            <X className="w-4 h-4" />
                            <span>Clear Image</span>
                        </button>
                    )}

                    {/* Live Preview */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Preview
                        </label>
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            {renderImagePreview()}
                        </div>
                    </div>

                    {/* Media Picker Modal */}
                    {showMediaPicker && (
                        <MediaPicker
                            mode="modal"
                            multiple={false}
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

export default ImageEditor 