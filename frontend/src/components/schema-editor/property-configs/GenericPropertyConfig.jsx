/**
 * GenericPropertyConfig - Fallback Property Configuration Component
 * 
 * A generic property configuration component that handles basic property settings
 * and serves as a fallback when specific property config components are not available.
 */

import React, { useCallback } from 'react'
import { validateFieldName } from '../../../utils/schemaValidation'

const GenericPropertyConfig = ({ 
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

      {/* Component Type (read-only) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Component Type
        </label>
        <input
          type="text"
          value={property.component || 'TextInput'}
          readOnly
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600"
        />
      </div>

      {/* Group */}
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

      {/* Default Value */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Default Value
        </label>
        <input
          type={property.type === 'number' ? 'number' : 'text'}
          value={property.default || ''}
          onChange={(e) => {
            let value = e.target.value
            if (property.type === 'number') {
              value = value ? parseFloat(value) : null
            } else if (property.type === 'boolean') {
              value = e.target.checked
            }
            handleChange('default', value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
            }
          }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
          placeholder="Default value"
        />
      </div>

      {/* Required Toggle */}
      <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
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

      {/* Additional JSON Schema Properties */}
      {property.type === 'string' && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">String Options</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Length
              </label>
              <input
                type="number"
                value={property.minLength || ''}
                onChange={(e) => handleChange('minLength', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                min="0"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Length
              </label>
              <input
                type="number"
                value={property.maxLength || ''}
                onChange={(e) => handleChange('maxLength', e.target.value ? parseInt(e.target.value) : null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                min="0"
                placeholder="255"
              />
            </div>
          </div>
        </div>
      )}

      {property.type === 'number' && (
        <div className="pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Number Options</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum
              </label>
              <input
                type="number"
                value={property.minimum || ''}
                onChange={(e) => handleChange('minimum', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                placeholder="0"
                step="any"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum
              </label>
              <input
                type="number"
                value={property.maximum || ''}
                onChange={(e) => handleChange('maximum', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                placeholder="100"
                step="any"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Step
              </label>
              <input
                type="number"
                value={property.step || ''}
                onChange={(e) => handleChange('step', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
                placeholder="1"
                step="any"
                min="0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GenericPropertyConfig
