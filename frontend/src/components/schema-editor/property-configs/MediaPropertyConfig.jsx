/**
 * MediaPropertyConfig - Media Field Property Configuration Component
 * 
 * Specialized configuration component for media input properties.
 * Handles media-specific options like allowed types, multiple selection, etc.
 */

import React, { useCallback } from 'react'
import { validateFieldName } from '../../../utils/schemaValidation'

const MediaPropertyConfig = ({
    property,
    onChange,
    onValidate,
    allProperties = []
}) => {
    // Handle field changes
    const handleChange = useCallback((field, value) => {
        const updated = { ...property, [field]: value }
        onChange(updated)

        if (onValidate) {
            onValidate(updated)
        }
    }, [property, onChange, onValidate])

    // Check if key is unique
    const isKeyUnique = useCallback((key) => {
        if (!key) return true
        return !allProperties.some(prop => prop.key === key && prop.id !== property.id)
    }, [allProperties, property.id])

    const keyError = property.key && (!validateFieldName(property.key) || !isKeyUnique(property.key))

    return (
        <div className="space-y-4">
            {/* Basic Configuration */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Property Key *
                    </label>
                    <input
                        type="text"
                        value={property.key || ''}
                        onChange={(e) => handleChange('key', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                            }
                        }}
                        className={`w-full border rounded-lg px-3 py-2 text-sm transition-colors ${keyError ? 'border-red-300 bg-red-50' : 'border-gray-300 focus:border-blue-500'
                            }`}
                        placeholder="propertyName"
                        required
                    />
                    {property.key && !validateFieldName(property.key) && (
                        <div className="text-red-500 text-xs mt-1">
                            Key must be camelCase (start with lowercase letter, followed by letters and numbers only)
                        </div>
                    )}
                    {property.key && validateFieldName(property.key) && !isKeyUnique(property.key) && (
                        <div className="text-red-500 text-xs mt-1">
                            Property key "{property.key}" already exists. Please choose a unique name.
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Label *
                    </label>
                    <input
                        type="text"
                        value={property.title || ''}
                        onChange={(e) => handleChange('title', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                            }
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                        placeholder="Display Name"
                        required
                    />
                </div>
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                </label>
                <input
                    type="text"
                    value={property.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                        }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                    placeholder="Help text for this field"
                />
            </div>

            {/* Media Field Options */}
            <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Media Field Options</h4>

                {/* Media Types */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Allowed Media Types
                    </label>
                    <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={property.mediaTypes?.includes('image') || false}
                                onChange={(e) => {
                                    const types = new Set(property.mediaTypes || [])
                                    if (e.target.checked) {
                                        types.add('image')
                                    } else {
                                        types.delete('image')
                                    }
                                    handleChange('mediaTypes', Array.from(types))
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">Images (jpg, png, gif, etc.)</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={property.mediaTypes?.includes('video') || false}
                                onChange={(e) => {
                                    const types = new Set(property.mediaTypes || [])
                                    if (e.target.checked) {
                                        types.add('video')
                                    } else {
                                        types.delete('video')
                                    }
                                    handleChange('mediaTypes', Array.from(types))
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">Videos (mp4, webm, etc.)</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={property.mediaTypes?.includes('audio') || false}
                                onChange={(e) => {
                                    const types = new Set(property.mediaTypes || [])
                                    if (e.target.checked) {
                                        types.add('audio')
                                    } else {
                                        types.delete('audio')
                                    }
                                    handleChange('mediaTypes', Array.from(types))
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">Audio (mp3, wav, etc.)</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={property.mediaTypes?.includes('document') || false}
                                onChange={(e) => {
                                    const types = new Set(property.mediaTypes || [])
                                    if (e.target.checked) {
                                        types.add('document')
                                    } else {
                                        types.delete('document')
                                    }
                                    handleChange('mediaTypes', Array.from(types))
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">Documents (pdf, doc, etc.)</span>
                        </label>
                    </div>
                </div>

                {/* Multiple Selection */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Selection Mode
                    </label>
                    <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name={`multiple-${property.id}`}
                                checked={!property.multiple}
                                onChange={() => {
                                    handleChange('multiple', false)
                                    handleChange('type', 'object')
                                    handleChange('default', null)
                                }}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">Single file selection</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name={`multiple-${property.id}`}
                                checked={property.multiple || false}
                                onChange={() => {
                                    handleChange('multiple', true)
                                    handleChange('type', 'array')
                                    handleChange('default', [])
                                }}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">Multiple file selection</span>
                        </label>
                    </div>
                </div>

                {/* Multiple Selection Options */}
                {property.multiple && (
                    <div className="mb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Minimum Files
                                </label>
                                <input
                                    type="number"
                                    value={property.minItems || ''}
                                    onChange={(e) => handleChange('minItems', e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                                    min="0"
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Maximum Files
                                </label>
                                <input
                                    type="number"
                                    value={property.maxItems || ''}
                                    onChange={(e) => handleChange('maxItems', e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                                    min="1"
                                    placeholder="No limit"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* File Size Limits */}
                <div className="mb-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Min File Size (MB)
                            </label>
                            <input
                                type="number"
                                value={property.minSize || ''}
                                onChange={(e) => handleChange('minSize', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                                min="0"
                                step="0.1"
                                placeholder="No minimum"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max File Size (MB)
                            </label>
                            <input
                                type="number"
                                value={property.maxSize || ''}
                                onChange={(e) => handleChange('maxSize', e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                                min="0.1"
                                step="0.1"
                                placeholder="Server limit"
                            />
                        </div>
                    </div>
                </div>

                {/* Display Options */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Display Options
                    </label>
                    <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={property.showPreview !== false}
                                onChange={(e) => handleChange('showPreview', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">Show file preview</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={property.showFileInfo !== false}
                                onChange={(e) => handleChange('showFileInfo', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">Show file information (size, type)</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={property.allowDownload !== false}
                                onChange={(e) => handleChange('allowDownload', e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm">Allow file download</span>
                        </label>
                    </div>
                </div>

                {/* Placeholder */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Placeholder Text
                    </label>
                    <input
                        type="text"
                        value={property.placeholder || ''}
                        onChange={(e) => handleChange('placeholder', e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                            }
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                        placeholder="Select media file..."
                    />
                </div>
            </div>

            {/* Group and Order */}
            <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Organization</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Group
                        </label>
                        <select
                            value={property.group || 'Media'}
                            onChange={(e) => handleChange('group', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                        >
                            <option value="Basic">Basic</option>
                            <option value="Selection">Selection</option>
                            <option value="DateTime">DateTime</option>
                            <option value="Media">Media</option>
                            <option value="Special">Special</option>
                            <option value="Advanced">Advanced</option>
                            <option value="Custom">Custom</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Order
                        </label>
                        <input
                            type="number"
                            value={property.order || ''}
                            onChange={(e) => handleChange('order', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                            min="0"
                            placeholder="0"
                        />
                    </div>
                </div>
            </div>

            {/* Required Toggle */}
            <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                <input
                    type="checkbox"
                    id={`required-${property.id}`}
                    checked={property.required || false}
                    onChange={(e) => handleChange('required', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`required-${property.id}`} className="text-sm font-medium text-gray-700">
                    Required field
                </label>
            </div>
        </div>
    )
}

export default MediaPropertyConfig
