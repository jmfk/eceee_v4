import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { objectTypesApi } from '../../../api/objectStorage'
import ComponentTypeSelector from '../components/ComponentTypeSelector'

/**
 * Reverse Object Reference Property Configuration Component
 * 
 * Handles configuration for reverse_object_reference fields (read-only display of relationships from other objects).
 * These fields show objects that reference this object.
 * 
 * Configuration options:
 * - reverseRelationshipType: The field name on the other object that references this one
 * - reverseObjectTypes: Which object types to fetch reverse references from
 * - showCount: Display count badge
 * - linkToObjects: Make items clickable
 */
export default function ReverseObjectReferencePropertyConfig({
  property,
  onChange,
  onValidate,
  errors = {}
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

  const selectedTypes = property.reverseObjectTypes || []

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
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.key ? 'border-red-300' : 'border-gray-300'
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
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.title ? 'border-red-300' : 'border-gray-300'
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

      {/* Reverse Reference Specific Configuration */}
      <div className="border-t pt-4">
        <div className="text-sm font-medium text-gray-900 mb-3" role="heading" aria-level="4">Reverse Reference Configuration</div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
          <div className="text-sm text-blue-800">
            <span className="font-bold">Read-only field:</span> This field displays objects from other object types that reference this object.
            It automatically fetches and displays the reverse relationships.
          </div>
        </div>

        {/* Reverse Relationship Type */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reverse Relationship Field Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={property.reverseRelationshipType || ''}
            onChange={(e) => handleChange('reverseRelationshipType', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.reverseRelationshipType ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="e.g., columns_authored, articles"
          />
          <div className="text-xs text-gray-500 mt-1">
            The field name on the other object that references this object
          </div>
          {errors.reverseRelationshipType && (
            <div className="text-red-500 text-xs mt-1">{errors.reverseRelationshipType}</div>
          )}
        </div>

        {/* Reverse Object Types */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fetch From Object Types <span className="text-red-500">*</span>
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
                      handleChange('reverseObjectTypes', newSelectedTypes)
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
            Select which object types to fetch reverse references from
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
          {errors.reverseObjectTypes && (
            <div className="text-red-500 text-xs mt-1">{errors.reverseObjectTypes}</div>
          )}
        </div>

        {/* Display Options */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-900" role="heading" aria-level="5">Display Options</div>
          
          <div className="flex items-start space-x-3">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                id={`showCount-${property.key}`}
                checked={property.showCount !== false}
                onChange={(e) => handleChange('showCount', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex-1">
              <label htmlFor={`showCount-${property.key}`} className="text-sm text-gray-700">
                Show count badge
              </label>
              <div className="text-xs text-gray-500 mt-1">
                Display the number of reverse references
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                id={`linkToObjects-${property.key}`}
                checked={property.linkToObjects !== false}
                onChange={(e) => handleChange('linkToObjects', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex-1">
              <label htmlFor={`linkToObjects-${property.key}`} className="text-sm text-gray-700">
                Link to referenced objects
              </label>
              <div className="text-xs text-gray-500 mt-1">
                Make items clickable to navigate to the referenced objects
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

