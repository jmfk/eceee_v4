import React from 'react'

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

        // Ensure at least one type is selected
        if (newTypes.length === 0) {
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
                <h4 className="text-sm font-medium text-gray-900 mb-3">Media Options</h4>

                {/* Media Types */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Allowed Media Types
                    </label>
                    <div className="space-y-2">
                        {[
                            { value: 'image', label: 'Images' },
                            { value: 'video', label: 'Videos' },
                            { value: 'audio', label: 'Audio' },
                            { value: 'document', label: 'Documents' }
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

                {/* Accept Attribute */}
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Accepted File Types
                    </label>
                    <input
                        type="text"
                        value={property.accept || ''}
                        onChange={(e) => handleComponentConfigChange('accept', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="image/*,.pdf,.doc"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                        HTML accept attribute value (e.g., "image/*", ".jpg,.png", etc.)
                    </div>
                </div>

                {/* Image-specific settings */}
                {mediaTypes.includes('image') && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <h5 className="text-sm font-medium text-blue-900 mb-2">Image Settings</h5>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-blue-800 mb-1">
                                    Max Width (px)
                                </label>
                                <input
                                    type="number"
                                    value={property.maxWidth || ''}
                                    onChange={(e) => handleComponentConfigChange('maxWidth', e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm"
                                    placeholder="1920"
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
                                    placeholder="1080"
                                    min="1"
                                />
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
