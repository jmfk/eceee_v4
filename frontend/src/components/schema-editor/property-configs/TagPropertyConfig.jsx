import React from 'react'
import ComponentTypeSelector from '../components/ComponentTypeSelector'

/**
 * Tag Property Configuration Component
 * 
 * Handles configuration for tags fields.
 * 
 * Configuration options:
 * - allowCreate: Allow creating new tags
 * - maxTags: Maximum number of tags
 * - tagColors: Enable tag color coding
 * - placeholder: Placeholder text
 */
export default function TagPropertyConfig({
    property,
    onChange,
    onValidate,
    errors = {}
}) {
    const handleChange = (field, value) => {
        const updated = { ...property, [field]: value }
        onChange(updated)
    }

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

            {/* Tag Specific Configuration */}
            <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Tag Field Configuration</h4>

                {/* Placeholder */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Placeholder Text
                    </label>
                    <input
                        type="text"
                        value={property.placeholder || ''}
                        onChange={(e) => handleChange('placeholder', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Type and press enter to add tags..."
                    />
                </div>

                {/* Max Tags */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Maximum Number of Tags
                    </label>
                    <input
                        type="number"
                        value={property.maxTags || ''}
                        onChange={(e) => handleChange('maxTags', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="No limit"
                        min="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Leave empty for unlimited tags
                    </p>
                </div>

                {/* Options */}
                <div className="space-y-3">
                    <h5 className="text-sm font-medium text-gray-900">Options</h5>

                    <div className="flex items-start space-x-3">
                        <div className="flex items-center h-5">
                            <input
                                type="checkbox"
                                id={`allowCreate-${property.key}`}
                                checked={property.allowCreate !== false}
                                onChange={(e) => handleChange('allowCreate', e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                        </div>
                        <div className="flex-1">
                            <label htmlFor={`allowCreate-${property.key}`} className="text-sm text-gray-700">
                                Allow creating new tags
                            </label>
                            <p className="text-xs text-gray-500 mt-1">
                                Users can create new tags by typing and pressing enter
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-3">
                        <div className="flex items-center h-5">
                            <input
                                type="checkbox"
                                id={`tagColors-${property.key}`}
                                checked={property.tagColors !== false}
                                onChange={(e) => handleChange('tagColors', e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                        </div>
                        <div className="flex-1">
                            <label htmlFor={`tagColors-${property.key}`} className="text-sm text-gray-700">
                                Enable tag color coding
                            </label>
                            <p className="text-xs text-gray-500 mt-1">
                                Display tags with different colors
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start space-x-3">
                        <div className="flex items-center h-5">
                            <input
                                type="checkbox"
                                id={`uniqueItems-${property.key}`}
                                checked={property.uniqueItems !== false}
                                onChange={(e) => handleChange('uniqueItems', e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                        </div>
                        <div className="flex-1">
                            <label htmlFor={`uniqueItems-${property.key}`} className="text-sm text-gray-700">
                                Prevent duplicate tags
                            </label>
                            <p className="text-xs text-gray-500 mt-1">
                                Ensure each tag appears only once
                            </p>
                        </div>
                    </div>
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

