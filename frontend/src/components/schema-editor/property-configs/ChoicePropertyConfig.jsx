import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import ComponentTypeSelector from '../components/ComponentTypeSelector'

/**
 * Choice Property Configuration Component
 * 
 * Handles configuration for choice/select input fields including SelectInput.
 */
export default function ChoicePropertyConfig({
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

  const handleOptionsChange = (newOptions) => {
    handleChange('enum', newOptions)
  }

  const addOption = () => {
    const currentOptions = property.enum || []
    const newOptions = [...currentOptions, `Option ${currentOptions.length + 1}`]
    handleOptionsChange(newOptions)
  }

  const removeOption = (index) => {
    const currentOptions = property.enum || []
    const newOptions = currentOptions.filter((_, i) => i !== index)
    handleOptionsChange(newOptions)
  }

  const updateOption = (index, value) => {
    const currentOptions = property.enum || []
    const newOptions = [...currentOptions]
    newOptions[index] = value
    handleOptionsChange(newOptions)
  }

  const options = property.enum || []

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

      {/* Choice-Specific Configuration */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Choice Options</h4>

        {/* Placeholder */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Placeholder Text
          </label>
          <input
            type="text"
            value={property.placeholder || ''}
            onChange={(e) => handleComponentConfigChange('placeholder', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Select an option..."
          />
        </div>

        {/* Options List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Available Options <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={addOption}
              className="flex items-center space-x-1 text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Option</span>
            </button>
          </div>

          {options.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
              <div className="text-gray-500 text-sm mb-2">No options defined</div>
              <button
                type="button"
                onClick={addOption}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Add your first option
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`Option ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                    title="Remove option"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Default Value */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Value
          </label>
          <select
            value={property.default || ''}
            onChange={(e) => handleChange('default', e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">No default selection</option>
            {options.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Display Options */}
        <div className="mt-4">
          <h5 className="text-sm font-medium text-gray-900 mb-2">Display Options</h5>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`searchable-${property.key}`}
                checked={property.searchable !== false}
                onChange={(e) => handleComponentConfigChange('searchable', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`searchable-${property.key}`} className="text-sm text-gray-700">
                Enable search/filter
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`clearable-${property.key}`}
                checked={property.clearable !== false}
                onChange={(e) => handleComponentConfigChange('clearable', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`clearable-${property.key}`} className="text-sm text-gray-700">
                Allow clearing selection
              </label>
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