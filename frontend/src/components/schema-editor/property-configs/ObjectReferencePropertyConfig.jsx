import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { objectTypesApi } from '../../../api/objectStorage'
import ComponentTypeSelector from '../components/ComponentTypeSelector'

/**
 * Object Reference Property Configuration Component
 * 
 * Handles configuration for object_reference fields including:
 * - multiple: Allow multiple object references
 * - maxItems: Maximum number of references (when multiple)
 * - relationshipType: Name of the relationship (e.g., "authors", "tags")
 * - allowedObjectTypes: Which object types can be referenced
 */
export default function ObjectReferencePropertyConfig({
    property,
    onChange,
    onValidate,
    errors = {},
    disabled = false
}) {
    // Fetch available object types from API
    const { data: objectTypesResponse, isLoading } = useQuery({
        queryKey: ['objectTypes'],
        queryFn: () => objectTypesApi.getAll(),
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    })

    const objectTypes = objectTypesResponse?.results || []

    const handleChange = (field, value) => {
        const updated = { ...property, [field]: value }
        onChange(updated)
    }

    const isMultiple = property.multiple || false
    const selectedTypes = property.allowedObjectTypes || []

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
                        disabled={disabled}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.key ? 'border-red-300' : 'border-gray-300'
                            } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
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
                        disabled={disabled}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.title ? 'border-red-300' : 'border-gray-300'
                            } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
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
                    disabled={disabled}
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
                    disabled={disabled}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    placeholder="Help text for this field"
                />
            </div>

            {/* Object Reference Specific Configuration */}
            <div className="border-t pt-4">
                <div className="text-sm font-medium text-gray-900 mb-3" role="heading" aria-level="4">Reference Configuration</div>

                {/* Multiple References */}
                <div className="flex items-start space-x-3 mb-4">
                    <div className="flex items-center h-5">
                        <input
                            type="checkbox"
                            id={`multiple-${property.key}`}
                            checked={isMultiple}
                            onChange={(e) => handleChange('multiple', e.target.checked)}
                            disabled={disabled}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>
                    <div className="flex-1">
                        <label htmlFor={`multiple-${property.key}`} className="text-sm font-medium text-gray-700">
                            Allow Multiple References
                        </label>
                        <div className="text-xs text-gray-500 mt-1">
                            Enable to allow selecting multiple objects
                        </div>
                    </div>
                </div>

                {/* Max Items (only shown when multiple is enabled) */}
                {isMultiple && (
                    <div className="mb-4 ml-7">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Max Items
                        </label>
                        <input
                            type="number"
                            value={property.maxItems || ''}
                            onChange={(e) => handleChange('maxItems', e.target.value ? parseInt(e.target.value) : null)}
                            disabled={disabled}
                            className={`w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                            placeholder="No limit"
                            min="1"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                            Maximum number of references allowed (leave empty for no limit)
                        </div>
                    </div>
                )}

                {/* Relationship Type */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Relationship Type <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={property.relationshipType || ''}
                        onChange={(e) => handleChange('relationshipType', e.target.value)}
                        disabled={disabled}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.relationshipType ? 'border-red-300' : 'border-gray-300'
                            } ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                        placeholder="e.g., authors, tags, categories"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                        Name of the relationship field (used for database relationships)
                    </div>
                    {errors.relationshipType && (
                        <div className="text-red-500 text-xs mt-1">{errors.relationshipType}</div>
                    )}
                </div>

                {/* Allowed Object Types */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Allowed Object Types <span className="text-red-500">*</span>
                    </label>

                    {isLoading ? (
                        <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-gray-500">
                            Loading object types...
                        </div>
                    ) : objectTypes.length === 0 ? (
                        <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm text-gray-500">
                            No object types available
                        </div>
                    ) : (
                        <div className="border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                            {objectTypes.map((type) => (
                                <label
                                    key={type.name}
                                    className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedTypes.includes(type.name)}
                                        onChange={(e) => {
                                            const newSelectedTypes = e.target.checked
                                                ? [...selectedTypes, type.name]
                                                : selectedTypes.filter(t => t !== type.name)
                                            handleChange('allowedObjectTypes', newSelectedTypes)
                                        }}
                                        disabled={disabled}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <span className="ml-3 text-sm">
                                        <span className="font-medium text-gray-900">{type.label}</span>
                                        <span className="text-gray-500 ml-1">({type.name})</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}

                    <div className="text-xs text-gray-500 mt-1">
                        Select which object types can be referenced by this field
                    </div>
                    {selectedTypes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {selectedTypes.map(typeName => {
                                const type = objectTypes.find(t => t.name === typeName)
                                return (
                                    <span
                                        key={typeName}
                                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                                    >
                                        {type?.label || typeName}
                                    </span>
                                )
                            })}
                        </div>
                    )}
                    {errors.allowedObjectTypes && (
                        <div className="text-red-500 text-xs mt-1">{errors.allowedObjectTypes}</div>
                    )}
                </div>
            </div>

            {/* Required toggle */}
            <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                <input
                    type="checkbox"
                    id={`required-${property.key}`}
                    checked={property.required || false}
                    onChange={(e) => handleChange('required', e.target.checked)}
                    disabled={disabled}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <label htmlFor={`required-${property.key}`} className="text-sm font-medium text-gray-700">
                    Required field
                </label>
            </div>
        </div>
    )
}

