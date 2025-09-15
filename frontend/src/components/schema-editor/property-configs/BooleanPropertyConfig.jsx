import React from 'react'

/**
 * Boolean Property Configuration Component
 * 
 * Handles configuration for boolean input fields including BooleanInput.
 */
export default function BooleanPropertyConfig({
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

      {/* Boolean-Specific Configuration */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Boolean Field Options</h4>

        {/* Default Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Value
          </label>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="radio"
                id={`default-false-${property.key}`}
                name={`default-${property.key}`}
                checked={property.default === false}
                onChange={() => handleChange('default', false)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor={`default-false-${property.key}`} className="ml-2 text-sm text-gray-700">
                False (unchecked)
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id={`default-true-${property.key}`}
                name={`default-${property.key}`}
                checked={property.default === true}
                onChange={() => handleChange('default', true)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor={`default-true-${property.key}`} className="ml-2 text-sm text-gray-700">
                True (checked)
              </label>
            </div>
          </div>
        </div>

        {/* Display Variant */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Display Style
          </label>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="radio"
                id={`variant-toggle-${property.key}`}
                name={`variant-${property.key}`}
                checked={property.variant === 'toggle' || !property.variant}
                onChange={() => handleComponentConfigChange('variant', 'toggle')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor={`variant-toggle-${property.key}`} className="ml-2 text-sm text-gray-700">
                Toggle switch (recommended)
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="radio"
                id={`variant-checkbox-${property.key}`}
                name={`variant-${property.key}`}
                checked={property.variant === 'checkbox'}
                onChange={() => handleComponentConfigChange('variant', 'checkbox')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor={`variant-checkbox-${property.key}`} className="ml-2 text-sm text-gray-700">
                Checkbox
              </label>
            </div>
          </div>
        </div>

        {/* Custom Labels */}
        <div className="mt-4">
          <h5 className="text-sm font-medium text-gray-900 mb-2">Custom Labels (Optional)</h5>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                True Label
              </label>
              <input
                type="text"
                value={property.trueLabel || ''}
                onChange={(e) => handleComponentConfigChange('trueLabel', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Yes, On, Enabled"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                False Label
              </label>
              <input
                type="text"
                value={property.falseLabel || ''}
                onChange={(e) => handleComponentConfigChange('falseLabel', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="No, Off, Disabled"
              />
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-1">
            Custom labels to display instead of true/false
          </div>
        </div>

        {/* Size Option */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Size
          </label>
          <select
            value={property.size || 'default'}
            onChange={(e) => handleComponentConfigChange('size', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="small">Small</option>
            <option value="default">Default</option>
            <option value="large">Large</option>
          </select>
        </div>

        {/* Disabled State */}
        <div className="mt-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`disabled-${property.key}`}
              checked={property.disabled || false}
              onChange={(e) => handleComponentConfigChange('disabled', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor={`disabled-${property.key}`} className="text-sm text-gray-700">
              Disabled by default
            </label>
          </div>
        </div>
      </div>

      {/* Note about required for boolean fields */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="text-sm text-blue-800">
          <div className="font-medium">Note about Required Boolean Fields</div>
          <div className="mt-1">
            Boolean fields are typically not marked as "required" since they always have a value (true or false).
            Consider if you need a three-state field (true/false/null) instead.
          </div>
        </div>
      </div>

      {/* Required toggle (kept for consistency but with warning) */}
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