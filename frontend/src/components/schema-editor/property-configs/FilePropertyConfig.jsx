import React from 'react'
import AutoTagsInput from '../components/AutoTagsInput'
import AutoCollectionInput from '../components/AutoCollectionInput'
import MimeTypesInput from '../components/MimeTypesInput'
import ComponentTypeSelector from '../components/ComponentTypeSelector'

/**
 * File Property Configuration Component
 * 
 * Handles configuration for file input fields with file-specific constraints
 * like file types, extensions, file size limits, etc.
 * Does not include image-specific constraints like dimensions or aspect ratios.
 */
export default function FilePropertyConfig({
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

    const handleFileTypesChange = (fileType, checked) => {
        const currentTypes = property.allowedFileTypes || ['document', 'image', 'video', 'audio']
        let newTypes

        if (checked) {
            newTypes = [...currentTypes, fileType]
        } else {
            newTypes = currentTypes.filter(type => type !== fileType)
        }

        // Ensure at least one type is selected
        if (newTypes.length === 0) {
            newTypes = ['document']
        }

        handleComponentConfigChange('allowedFileTypes', newTypes)
    }


    const allowedFileTypes = property.allowedFileTypes || ['document', 'image', 'video', 'audio']
    const allowedMimeTypes = property.allowedMimeTypes || []

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

            {/* File-Specific Configuration */}
            <div className="border-t pt-4">
                <div className="text-sm font-medium text-gray-900 mb-3" role="heading" aria-level="4">File Options</div>

                {/* File Type Categories */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Allowed File Type Categories
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { value: 'document', label: 'Documents (PDF, Word, Excel, etc.)' },
                            { value: 'image', label: 'Images (JPEG, PNG, GIF, etc.)' },
                            { value: 'video', label: 'Videos (MP4, WebM, etc.)' },
                            { value: 'audio', label: 'Audio (MP3, WAV, etc.)' }
                        ].map(({ value, label }) => (
                            <div key={value} className="flex items-start">
                                <input
                                    type="checkbox"
                                    id={`file-type-${value}-${property.key}`}
                                    checked={allowedFileTypes.includes(value)}
                                    onChange={(e) => handleFileTypesChange(value, e.target.checked)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                                />
                                <label htmlFor={`file-type-${value}-${property.key}`} className="ml-2 text-sm text-gray-700">
                                    {label}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Specific MIME Types */}
                <div className="mt-4">
                    <MimeTypesInput
                        label="Specific MIME Types"
                        value={allowedMimeTypes}
                        onChange={(mimeTypes) => handleComponentConfigChange('allowedMimeTypes', mimeTypes)}
                        allowedFileTypes={allowedFileTypes}
                        placeholder="Search and add MIME types..."
                        helpText="Optional - overrides categories. Search common types or add custom MIME types."
                    />
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
                        Maximum Files
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
                        Maximum number of files that can be added to this field. Leave empty for no limit.
                    </div>
                </div>

                {/* File Count Limits */}
                {property.multiple && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Min Files
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
                                Max Files
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

                {/* File Size Constraints */}
                <div className="mt-4">
                    <div className="text-sm font-medium text-gray-700 mb-3" role="heading" aria-level="5">File Size Constraints</div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Min File Size (KB)
                            </label>
                            <input
                                type="number"
                                value={property.minFileSize ? Math.round(property.minFileSize) : ''}
                                onChange={(e) => handleComponentConfigChange('minFileSize', e.target.value ? parseFloat(e.target.value) : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0"
                                min="0"
                                step="1"
                            />
                            <div className="text-xs text-gray-500 mt-1">
                                Minimum file size in kilobytes
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max File Size (MB)
                            </label>
                            <input
                                type="number"
                                value={property.maxFileSize || ''}
                                onChange={(e) => handleComponentConfigChange('maxFileSize', e.target.value ? parseFloat(e.target.value) : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="100"
                                min="0.1"
                                step="0.1"
                            />
                            <div className="text-xs text-gray-500 mt-1">
                                Maximum file size per file in megabytes
                            </div>
                        </div>
                    </div>
                </div>

                {/* File Extensions */}
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Allowed File Extensions
                    </label>
                    <input
                        type="text"
                        value={property.allowedExtensions || ''}
                        onChange={(e) => handleComponentConfigChange('allowedExtensions', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder=".pdf, .doc, .docx, .jpg, .png"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                        Comma-separated list of allowed file extensions (e.g., ".pdf, .doc, .jpg")
                    </div>
                </div>

                {/* File Type Label */}
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        File Type Label
                    </label>
                    <input
                        type="text"
                        value={property.fileTypeLabel || ''}
                        onChange={(e) => handleComponentConfigChange('fileTypeLabel', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="File"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                        Label used in UI text (e.g., "Document", "Media File", "Attachment")
                    </div>
                </div>

                {/* Auto-Tags Configuration */}
                <div className="mt-4">
                    <AutoTagsInput
                        label="Auto-Tags for Uploads"
                        value={property.autoTags || []}
                        onChange={(tags) => handleComponentConfigChange('autoTags', tags)}
                        namespace="default"
                        placeholder="Search and add tags for uploaded files..."
                        helpText="Tags that will be automatically added to uploaded files. Search existing tags or create new ones."
                    />
                </div>

                {/* Default Collection Configuration */}
                <div className="mt-4">
                    <AutoCollectionInput
                        label="Default Collection"
                        value={property.defaultCollection || null}
                        onChange={(collection) => handleComponentConfigChange('defaultCollection', collection)}
                        namespace="default"
                        placeholder="Search and select a collection for uploaded files..."
                        helpText="Collection where uploaded files will be automatically added. Search existing collections or create a new one."
                    />
                </div>
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
