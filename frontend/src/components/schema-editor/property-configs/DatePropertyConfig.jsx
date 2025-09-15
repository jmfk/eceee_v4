/**
 * DatePropertyConfig - Date Field Property Configuration Component
 * 
 * Specialized configuration component for date/time properties.
 * Handles date-specific options like format, min/max dates, default values, etc.
 */

import React, { useCallback } from 'react'
import { validateFieldName } from '../../../utils/schemaValidation'

const DatePropertyConfig = ({ 
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
            className={`w-full border rounded-lg px-3 py-2 text-sm transition-colors ${
              keyError ? 'border-red-300 bg-red-50' : 'border-gray-300 focus:border-blue-500'
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

      {/* Date Field Options */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Date Field Options</h4>
        
        {/* Date/Time Format */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Format Type
          </label>
          <select
            value={property.format || 'date'}
            onChange={(e) => {
              const format = e.target.value
              handleChange('format', format)
              
              // Update component based on format
              if (format === 'date') {
                handleChange('component', 'DateInput')
              } else if (format === 'date-time') {
                handleChange('component', 'DateTimeInput')
              } else if (format === 'time') {
                handleChange('component', 'TimeInput')
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
          >
            <option value="date">Date Only (YYYY-MM-DD)</option>
            <option value="date-time">Date and Time (ISO 8601)</option>
            <option value="time">Time Only (HH:MM)</option>
          </select>
        </div>

        {/* Date Range Constraints */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Date
            </label>
            <input
              type={property.format === 'time' ? 'time' : (property.format === 'date-time' ? 'datetime-local' : 'date')}
              value={property.minimum || ''}
              onChange={(e) => handleChange('minimum', e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Date
            </label>
            <input
              type={property.format === 'time' ? 'time' : (property.format === 'date-time' ? 'datetime-local' : 'date')}
              value={property.maximum || ''}
              onChange={(e) => handleChange('maximum', e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Default Value */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Value
          </label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id={`default-none-${property.id}`}
                name={`default-${property.id}`}
                checked={!property.default || property.default === ''}
                onChange={() => handleChange('default', null)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor={`default-none-${property.id}`} className="text-sm">
                No default (empty)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id={`default-today-${property.id}`}
                name={`default-${property.id}`}
                checked={property.default === 'today' || property.default === 'now'}
                onChange={() => handleChange('default', property.format === 'date' ? 'today' : 'now')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor={`default-today-${property.id}`} className="text-sm">
                {property.format === 'date' ? 'Today' : (property.format === 'time' ? 'Current time' : 'Current date and time')}
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id={`default-specific-${property.id}`}
                name={`default-${property.id}`}
                checked={property.default && property.default !== 'today' && property.default !== 'now'}
                onChange={() => {
                  // Set a default specific date
                  const today = new Date()
                  if (property.format === 'time') {
                    handleChange('default', '12:00')
                  } else if (property.format === 'date-time') {
                    handleChange('default', today.toISOString().slice(0, 16))
                  } else {
                    handleChange('default', today.toISOString().slice(0, 10))
                  }
                }}
                className="text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor={`default-specific-${property.id}`} className="text-sm">
                Specific date/time:
              </label>
            </div>
            {property.default && property.default !== 'today' && property.default !== 'now' && (
              <div className="ml-6">
                <input
                  type={property.format === 'time' ? 'time' : (property.format === 'date-time' ? 'datetime-local' : 'date')}
                  value={property.default}
                  onChange={(e) => handleChange('default', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                />
              </div>
            )}
          </div>
        </div>

        {/* Display Options */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date Picker Style
          </label>
          <select
            value={property.variant || 'default'}
            onChange={(e) => handleChange('variant', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
          >
            <option value="default">Default picker</option>
            <option value="inline">Inline calendar</option>
            <option value="compact">Compact view</option>
          </select>
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
            placeholder={
              property.format === 'time' ? 'Select time...' : 
              property.format === 'date-time' ? 'Select date and time...' : 
              'Select date...'
            }
          />
        </div>

        {/* Show Week Numbers */}
        {property.format === 'date' && (
          <div className="flex items-center space-x-2 mb-4">
            <input
              type="checkbox"
              id={`show-week-numbers-${property.id}`}
              checked={property.showWeekNumbers || false}
              onChange={(e) => handleChange('showWeekNumbers', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor={`show-week-numbers-${property.id}`} className="text-sm text-gray-700">
              Show week numbers in calendar
            </label>
          </div>
        )}
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
              value={property.group || 'DateTime'}
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

export default DatePropertyConfig
