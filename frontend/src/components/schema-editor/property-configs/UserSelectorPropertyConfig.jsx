import React from 'react'
import ComponentTypeSelector from '../components/ComponentTypeSelector'

/**
 * User Selector Property Configuration Component
 * 
 * Handles configuration for user_reference fields that allow selecting user(s).
 * 
 * Configuration options:
 * - multiple: Allow selecting multiple users
 * - maxUsers: Maximum number of users (when multiple)
 * - searchable: Enable search functionality
 * - filterByGroup: Filter users by group (optional)
 */
export default function UserSelectorPropertyConfig({
  property,
  onChange,
  onValidate,
  errors = {}
}) {
  const handleChange = (field, value) => {
    const updated = { ...property, [field]: value }
    onChange(updated)
  }

  const isMultiple = property.multiple || false
  const isSearchable = property.searchable !== false // default to true

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

      {/* User Selector Specific Configuration */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">User Selector Configuration</h4>

        {/* Multiple Users */}
        <div className="flex items-start space-x-3 mb-4">
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              id={`multiple-${property.key}`}
              checked={isMultiple}
              onChange={(e) => handleChange('multiple', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="flex-1">
            <label htmlFor={`multiple-${property.key}`} className="text-sm font-medium text-gray-700">
              Allow Multiple Users
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Enable to allow selecting multiple users
            </p>
          </div>
        </div>

        {/* Max Users (only shown when multiple is enabled) */}
        {isMultiple && (
          <div className="mb-4 ml-7">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Users
            </label>
            <input
              type="number"
              value={property.maxUsers || ''}
              onChange={(e) => handleChange('maxUsers', e.target.value ? parseInt(e.target.value) : null)}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="No limit"
              min="1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum number of users allowed (leave empty for no limit)
            </p>
          </div>
        )}

        {/* Searchable */}
        <div className="flex items-start space-x-3 mb-4">
          <div className="flex items-center h-5">
            <input
              type="checkbox"
              id={`searchable-${property.key}`}
              checked={isSearchable}
              onChange={(e) => handleChange('searchable', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          <div className="flex-1">
            <label htmlFor={`searchable-${property.key}`} className="text-sm text-gray-700">
              Enable Search
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Allow searching/filtering users by name
            </p>
          </div>
        </div>

        {/* Filter by Group (Optional) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by User Group (Optional)
          </label>
          <input
            type="text"
            value={property.filterByGroup || ''}
            onChange={(e) => handleChange('filterByGroup', e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., editors, authors, admins"
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave empty to show all users, or specify a group name to filter
          </p>
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

