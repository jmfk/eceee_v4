/**
 * ChoicePropertyConfig - Choice/Selection Field Property Configuration Component
 * 
 * Specialized configuration component for selection properties (dropdown, radio, etc.).
 * Handles choice-specific options like options management, multiple selection, etc.
 */

import React, { useCallback } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { validateFieldName } from '../../../utils/schemaValidation'

const ChoicePropertyConfig = ({ 
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

  // Handle options changes
  const handleOptionsChange = useCallback((newOptions) => {
    handleChange('enum', newOptions)
    
    // Update the options array for segmented control
    if (property.component === 'SegmentedControlInput') {
      const optionsArray = newOptions.map(option => ({
        value: option,
        label: option,
        icon: null
      }))
      handleChange('options', optionsArray)
    }
  }, [handleChange, property.component])

  // Add new option
  const addOption = useCallback(() => {
    const currentOptions = property.enum || []
    const newOption = `Option ${currentOptions.length + 1}`
    handleOptionsChange([...currentOptions, newOption])
  }, [property.enum, handleOptionsChange])

  // Remove option
  const removeOption = useCallback((index) => {
    const currentOptions = property.enum || []
    const newOptions = currentOptions.filter((_, i) => i !== index)
    handleOptionsChange(newOptions)
  }, [property.enum, handleOptionsChange])

  // Update option value
  const updateOption = useCallback((index, value) => {
    const currentOptions = property.enum || []
    const newOptions = [...currentOptions]
    newOptions[index] = value
    handleOptionsChange(newOptions)
  }, [property.enum, handleOptionsChange])

  // Move option
  const moveOption = useCallback((fromIndex, toIndex) => {
    const currentOptions = property.enum || []
    if (toIndex < 0 || toIndex >= currentOptions.length) return
    
    const newOptions = [...currentOptions]
    const [movedOption] = newOptions.splice(fromIndex, 1)
    newOptions.splice(toIndex, 0, movedOption)
    handleOptionsChange(newOptions)
  }, [property.enum, handleOptionsChange])

  const keyError = property.key && (!validateFieldName(property.key) || !isKeyUnique(property.key))
  const options = property.enum || []

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

      {/* Selection Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Selection Type
        </label>
        <select
          value={property.component || 'SelectInput'}
          onChange={(e) => handleChange('component', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
        >
          <option value="SelectInput">Dropdown</option>
          <option value="RadioInput">Radio Buttons</option>
          <option value="SegmentedControlInput">Segmented Control</option>
          <option value="MultiSelectInput">Multi-Select</option>
          <option value="CheckboxInput">Checkbox Group</option>
        </select>
      </div>

      {/* Options Management */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">Options</h4>
          <button
            type="button"
            onClick={addOption}
            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Option</span>
          </button>
        </div>

        {options.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg">
            <div className="text-gray-500 text-sm mb-2">No options defined</div>
            <button
              type="button"
              onClick={addOption}
              className="text-blue-600 hover:text-blue-700 text-sm underline"
            >
              Add your first option
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {options.map((option, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg"
              >
                {/* Drag handle */}
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 cursor-move"
                  title="Drag to reorder"
                >
                  <GripVertical className="w-4 h-4" />
                </button>

                {/* Option value */}
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                    }
                  }}
                  className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:border-blue-500 transition-colors"
                  placeholder={`Option ${index + 1}`}
                />

                {/* Move buttons */}
                <button
                  type="button"
                  onClick={() => moveOption(index, index - 1)}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveOption(index, index + 1)}
                  disabled={index === options.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  ↓
                </button>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="text-red-600 hover:text-red-700"
                  title="Remove option"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selection Options */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Selection Options</h4>
        
        {/* Multiple Selection */}
        {['MultiSelectInput', 'CheckboxInput'].includes(property.component) && (
          <div className="mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Selections
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
                  Maximum Selections
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

        {/* Default Value */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Selection
          </label>
          {['MultiSelectInput', 'CheckboxInput'].includes(property.component) ? (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {options.map((option, index) => (
                <label key={index} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={Array.isArray(property.default) && property.default.includes(option)}
                    onChange={(e) => {
                      const currentDefault = Array.isArray(property.default) ? property.default : []
                      if (e.target.checked) {
                        handleChange('default', [...currentDefault, option])
                      } else {
                        handleChange('default', currentDefault.filter(v => v !== option))
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{option}</span>
                </label>
              ))}
            </div>
          ) : (
            <select
              value={property.default || ''}
              onChange={(e) => handleChange('default', e.target.value || null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            >
              <option value="">No default</option>
              {options.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Placeholder for dropdown */}
        {property.component === 'SelectInput' && (
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
              placeholder="Select an option..."
            />
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
              value={property.group || 'Selection'}
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

export default ChoicePropertyConfig
