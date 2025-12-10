import React from 'react'
import AutoTagsInput from '../components/AutoTagsInput'
import AutoCollectionInput from '../components/AutoCollectionInput'
import MimeTypesInput from '../components/MimeTypesInput'
import ComponentTypeSelector from '../components/ComponentTypeSelector'

/**
 * Image Property Configuration Component
 * 
 * Handles configuration for image input fields including media selection,
 * file type restrictions, and image-specific settings.
 */
export default function ImagePropertyConfig({
    property,
    onChange,
    onValidate,
    errors = {}
}) {
    const handleChange = (field, value) => {
        const updated = { ...property, [field]: value }
        onChange(updated)
    }

    const handleComponentConfigChange = (key, value) => {
        const updated = {
            ...property,
            [key]: value
        }
        onChange(updated)
    }

    const handleMediaTypesChange = (mediaType, checked) => {
        const currentTypes = property.mediaTypes || ['image']
        let newTypes

        if (checked) {
            newTypes = [...currentTypes, mediaType]
        } else {
            newTypes = currentTypes.filter(type => type !== mediaType)
        }

        // Ensure at least one type is selected (image should always be included)
        if (newTypes.length === 0 || !newTypes.includes('image')) {
            newTypes = ['image']
        }

        handleComponentConfigChange('mediaTypes', newTypes)
    }

    const mediaTypes = property.mediaTypes || ['image']

    return (
        <div className="space-y-4">
            {/* Basic Configuration */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Property Key <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={property.key || ''}
                        onChange={(e) => handleChange('key', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.key ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder="propertyName"
                    />
                    {errors.key && (
                        <div className="text-red-500 text-xs mt-1">{errors.key}</div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Label <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={property.title || ''}
                        onChange={(e) => handleChange('title', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.title ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder="Display Name"
                    />
                    {errors.title && (
                        <div className="text-red-500 text-xs mt-1">{errors.title}</div>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Component Type <span className="text-red-500">*</span>
                </label>
                <ComponentTypeSelector
                    value={property.componentType || property.component}
                    onChange={(newType) => handleChange('componentType', newType)}
                    error={errors.componentType}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                </label>
                <input
                    type="text"
                    value={property.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Help text for this field"
                />
            </div>

            {/* Image-Specific Configuration */}
            <div className="border-t pt-4">
                <div className="text-sm font-medium text-gray-900 mb-3" role="heading" aria-level="4">Media Options</div>

                {/* Media Types */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Allowed Media Types
                    </label>
                    <div className="space-y-2">
                        {[
                            { value: 'image', label: 'Images' },
                            { value: 'video', label: 'Videos' },
                            { value: 'audio', label: 'Audio' }
                        ].map(({ value, label }) => (
                            <div key={value} className="flex items-center">
                                <input
                                    type="checkbox"
                                    id={`media-type-${value}-${property.key}`}
                                    checked={mediaTypes.includes(value)}
                                    onChange={(e) => handleMediaTypesChange(value, e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor={`media-type-${value}-${property.key}`} className="ml-2 text-sm text-gray-700">
                                    {label}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Multiple Selection */}
                <div className="mt-4">
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id={`multiple-${property.key}`}
                            checked={property.multiple || false}
                            onChange={(e) => handleComponentConfigChange('multiple', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`multiple-${property.key}`} className="text-sm text-gray-700">
                            Allow multiple file selection
                        </label>
                    </div>
                </div>

                {/* Max Files Limit */}
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Images
                    </label>
                    <input
                        type="number"
                        value={property.maxFiles || ''}
                        onChange={(e) => handleComponentConfigChange('maxFiles', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="No limit"
                        min="1"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                        Maximum number of images that can be added to this field. Leave empty for no limit.
                    </div>
                </div>

                {/* File Size Limits */}
                {property.multiple && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Min Items
                            </label>
                            <input
                                type="number"
                                value={property.minItems || ''}
                                onChange={(e) => handleChange('minItems', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0"
                                min="0"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max Items
                            </label>
                            <input
                                type="number"
                                value={property.maxItems || ''}
                                onChange={(e) => handleChange('maxItems', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="10"
                                min="1"
                            />
                        </div>
                    </div>
                )}

                {/* File Size Limit */}
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max File Size (MB)
                    </label>
                    <input
                        type="number"
                        value={property.maxFileSize || ''}
                        onChange={(e) => handleComponentConfigChange('maxFileSize', e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="10"
                        min="0.1"
                        step="0.1"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                        Maximum file size per file in megabytes
                    </div>
                </div>

                {/* MIME Types */}
                <div className="mt-4">
                    <MimeTypesInput
                        label="Allowed MIME Types"
                        value={property.allowedMimeTypes || []}
                        onChange={(mimeTypes) => handleComponentConfigChange('allowedMimeTypes', mimeTypes)}
                        allowedFileTypes={['image']}
                        placeholder="Search and add image MIME types..."
                        helpText="Specify which image formats are allowed. Leave empty to allow all image types."
                    />
                </div>

                {/* Auto-Tags Configuration */}
                <div className="mt-4">
                    <AutoTagsInput
                        label="Auto-Tags for Uploads"
                        value={property.autoTags || []}
                        onChange={(tags) => handleComponentConfigChange('autoTags', tags)}
                        namespace="default"
                        placeholder="Search and add tags for uploaded images..."
                        helpText="Tags that will be automatically added to uploaded images. Search existing tags or create new ones."
                    />
                </div>

                {/* Default Collection Configuration */}
                <div className="mt-4">
                    <AutoCollectionInput
                        label="Default Collection"
                        value={property.defaultCollection || null}
                        onChange={(collection) => handleComponentConfigChange('defaultCollection', collection)}
                        namespace="default"
                        placeholder="Search and select a collection for uploaded images..."
                        helpText="Collection where uploaded images will be automatically added. Search existing collections or create a new one."
                    />
                </div>

                {/* Image-specific settings */}
                {mediaTypes.includes('image') && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="text-sm font-medium text-blue-900 mb-2" role="heading" aria-level="5">Image Settings</div>

                        <div className="space-y-3">
                            {/* Dimension Constraints */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-blue-800 mb-1">
                                        Min Width (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={property.minWidth || ''}
                                        onChange={(e) => handleComponentConfigChange('minWidth', e.target.value ? parseInt(e.target.value) : null)}
                                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                        placeholder="800"
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-blue-800 mb-1">
                                        Max Width (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={property.maxWidth || ''}
                                        onChange={(e) => handleComponentConfigChange('maxWidth', e.target.value ? parseInt(e.target.value) : null)}
                                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                        placeholder="4000"
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-blue-800 mb-1">
                                        Min Height (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={property.minHeight || ''}
                                        onChange={(e) => handleComponentConfigChange('minHeight', e.target.value ? parseInt(e.target.value) : null)}
                                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                        placeholder="600"
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-blue-800 mb-1">
                                        Max Height (px)
                                    </label>
                                    <input
                                        type="number"
                                        value={property.maxHeight || ''}
                                        onChange={(e) => handleComponentConfigChange('maxHeight', e.target.value ? parseInt(e.target.value) : null)}
                                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                        placeholder="3000"
                                        min="1"
                                    />
                                </div>
                            </div>

                            {/* File Size Constraints */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-blue-800 mb-1">
                                        Min File Size (KB)
                                    </label>
                                    <input
                                        type="number"
                                        value={property.minSize ? Math.round(property.minSize / 1024) : ''}
                                        onChange={(e) => handleComponentConfigChange('minSize', e.target.value ? parseInt(e.target.value) * 1024 : null)}
                                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                        placeholder="50"
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-blue-800 mb-1">
                                        Max File Size (MB)
                                    </label>
                                    <input
                                        type="number"
                                        value={property.maxSize ? Math.round(property.maxSize / (1024 * 1024)) : ''}
                                        onChange={(e) => handleComponentConfigChange('maxSize', e.target.value ? parseInt(e.target.value) * 1024 * 1024 : null)}
                                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                        placeholder="10"
                                        min="0.1"
                                        step="0.1"
                                    />
                                </div>
                            </div>

                            {/* Aspect Ratio */}
                            <div>
                                <label className="block text-xs font-medium text-blue-800 mb-1">
                                    Aspect Ratio
                                </label>
                                <select
                                    value={property.aspectRatio || ''}
                                    onChange={(e) => handleComponentConfigChange('aspectRatio', e.target.value || null)}
                                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                >
                                    <option value="">Any aspect ratio</option>
                                    <option value="1:1">Square (1:1)</option>
                                    <option value="4:3">Standard (4:3)</option>
                                    <option value="3:2">Classic (3:2)</option>
                                    <option value="16:9">Widescreen (16:9)</option>
                                    <option value="21:9">Ultra-wide (21:9)</option>
                                </select>
                            </div>

                        </div>
                    </div>
                )}
            </div>

            {/* Required toggle */}
            <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                <input
                    type="checkbox"
                    id={`required-${property.key}`}
                    checked={property.required || false}
                    onChange={(e) => handleChange('required', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor={`required-${property.key}`} className="text-sm font-medium text-gray-700">
                    Required field
                </label>
            </div>
        </div>
    )
}
