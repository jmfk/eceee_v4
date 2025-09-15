/**
 * BooleanPropertyConfig - Boolean Field Property Configuration Component
 * 
 * Specialized configuration component for boolean/toggle properties.
 * Handles boolean-specific options like default state, toggle variant, labels, etc.
 */

import React, { useCallback } from 'react'
import { validateFieldName } from '../../../utils/schemaValidation'

const BooleanPropertyConfig = ({ 
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

      {/* Boolean Field Options */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Boolean Field Options</h4>
        
        {/* Variant */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Style
          </label>
          <select
            value={property.variant || 'toggle'}
            onChange={(e) => handleChange('variant', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
          >
            <option value="toggle">Toggle Switch</option>
            <option value="checkbox">Checkbox</option>
            <option value="radio">Radio Buttons</option>
          </select>
        </div>

        {/* Default Value */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default State
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={`default-${property.id}`}
                checked={property.default === true}
                onChange={() => handleChange('default', true)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Checked/True by default</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={`default-${property.id}`}
                checked={property.default === false}
                onChange={() => handleChange('default', false)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Unchecked/False by default</span>
            </label>
          </div>
        </div>

        {/* Custom Labels for Radio Variant */}
        {property.variant === 'radio' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Labels
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">True Label</label>
                <input
                  type="text"
                  value={property.trueLabel || ''}
                  onChange={(e) => handleChange('trueLabel', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                  placeholder="Yes"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">False Label</label>
                <input
                  type="text"
                  value={property.falseLabel || ''}
                  onChange={(e) => handleChange('falseLabel', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                  placeholder="No"
                />
              </div>
            </div>
          </div>
        )}

        {/* Size (for toggle variant) */}
        {property.variant === 'toggle' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Toggle Size
            </label>
            <select
              value={property.size || 'medium'}
              onChange={(e) => handleChange('size', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        )}

        {/* Help Text Position */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Help Text Position
          </label>
          <select
            value={property.helpTextPosition || 'below'}
            onChange={(e) => handleChange('helpTextPosition', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
          >
            <option value="below">Below field</option>
            <option value="right">Right of field</option>
            <option value="tooltip">In tooltip</option>
          </select>
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
        <div className="text-xs text-gray-500 ml-2">
          (User must explicitly choose true/false)
        </div>
      </div>
    </div>
  )
}

export default BooleanPropertyConfig
