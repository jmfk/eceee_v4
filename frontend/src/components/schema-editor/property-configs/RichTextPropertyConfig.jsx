/**
 * RichTextPropertyConfig - Rich Text Field Property Configuration Component
 * 
 * Specialized configuration component for rich text input properties.
 * Handles rich text-specific options like toolbar configuration, plugins, etc.
 */

import React, { useCallback } from 'react'
import { validateFieldName } from '../../../utils/schemaValidation'

const RichTextPropertyConfig = ({ 
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

      {/* Rich Text Options */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Rich Text Options</h4>
        
        {/* Editor Height */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Editor Height (rows)
          </label>
          <input
            type="number"
            value={property.rows || ''}
            onChange={(e) => handleChange('rows', e.target.value ? parseInt(e.target.value) : null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            min="3"
            placeholder="6"
          />
        </div>

        {/* Toolbar Configuration */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Toolbar Options
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={`toolbar-${property.id}`}
                checked={property.toolbar === 'basic' || !property.toolbar}
                onChange={() => handleChange('toolbar', 'basic')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Basic (bold, italic, lists)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={`toolbar-${property.id}`}
                checked={property.toolbar === 'standard'}
                onChange={() => handleChange('toolbar', 'standard')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Standard (includes headings, links)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={`toolbar-${property.id}`}
                checked={property.toolbar === 'full'}
                onChange={() => handleChange('toolbar', 'full')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Full (all formatting options)</span>
            </label>
          </div>
        </div>

        {/* Allowed Content */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Allowed Content
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={property.allowImages !== false}
                onChange={(e) => handleChange('allowImages', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Allow images</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={property.allowTables !== false}
                onChange={(e) => handleChange('allowTables', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Allow tables</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={property.allowLinks !== false}
                onChange={(e) => handleChange('allowLinks', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Allow links</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={property.allowHtml || false}
                onChange={(e) => handleChange('allowHtml', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Allow HTML</span>
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
            placeholder="Enter rich text..."
          />
        </div>

        {/* Default Value */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Value
          </label>
          <textarea
            value={property.default || ''}
            onChange={(e) => handleChange('default', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            placeholder="Default rich text content..."
            rows={4}
          />
        </div>

        {/* Character Limit */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Character Limit
          </label>
          <input
            type="number"
            value={property.maxLength || ''}
            onChange={(e) => handleChange('maxLength', e.target.value ? parseInt(e.target.value) : null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            min="0"
            placeholder="No limit"
          />
          <div className="text-xs text-gray-500 mt-1">
            Leave empty for no character limit
          </div>
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
              value={property.group || 'Basic'}
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

export default RichTextPropertyConfig
