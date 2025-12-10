import React from 'react'
import ComponentTypeSelector from '../components/ComponentTypeSelector'

/**
 * Number Property Configuration Component
 * 
 * Handles configuration for numeric input fields including NumberInput.
 */
export default function NumberPropertyConfig({
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

  const isInteger = property.type === 'integer'

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

      {/* Number-Specific Configuration */}
      <div className="border-t pt-4">
        <div className="text-sm font-medium text-gray-900 mb-3" role="heading" aria-level="4">
          {isInteger ? 'Integer' : 'Number'} Field Options
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Value
            </label>
            <input
              type="number"
              value={property.default || ''}
              onChange={(e) => handleChange('default', e.target.value ? (isInteger ? parseInt(e.target.value) : parseFloat(e.target.value)) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
              step={isInteger ? '1' : 'any'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Placeholder Text
            </label>
            <input
              type="text"
              value={property.placeholder || ''}
              onChange={(e) => handleComponentConfigChange('placeholder', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter a number..."
            />
          </div>
        </div>

        {/* Range Constraints */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Value
            </label>
            <input
              type="number"
              value={property.minimum || ''}
              onChange={(e) => handleChange('minimum', e.target.value ? (isInteger ? parseInt(e.target.value) : parseFloat(e.target.value)) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="No minimum"
              step={isInteger ? '1' : 'any'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Value
            </label>
            <input
              type="number"
              value={property.maximum || ''}
              onChange={(e) => handleChange('maximum', e.target.value ? (isInteger ? parseInt(e.target.value) : parseFloat(e.target.value)) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="No maximum"
              step={isInteger ? '1' : 'any'}
            />
          </div>
        </div>

        {/* Step/Multiple Of */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Step Size
            </label>
            <input
              type="number"
              value={property.step || ''}
              onChange={(e) => handleComponentConfigChange('step', e.target.value ? (isInteger ? parseInt(e.target.value) : parseFloat(e.target.value)) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={isInteger ? "1" : "any"}
              step={isInteger ? '1' : 'any'}
              min={isInteger ? '1' : '0.001'}
            />
            <div className="text-xs text-gray-500 mt-1">
              Step size for input controls
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Multiple Of
            </label>
            <input
              type="number"
              value={property.multipleOf || ''}
              onChange={(e) => handleChange('multipleOf', e.target.value ? (isInteger ? parseInt(e.target.value) : parseFloat(e.target.value)) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Any value"
              step={isInteger ? '1' : 'any'}
              min={isInteger ? '1' : '0.001'}
            />
            <div className="text-xs text-gray-500 mt-1">
              Value must be a multiple of this number
            </div>
          </div>
        </div>

        {/* Display Options */}
        <div className="mt-4">
          <div className="text-sm font-medium text-gray-900 mb-2" role="heading" aria-level="5">Display Options</div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`show-spinner-${property.key}`}
                checked={property.showSpinner !== false}
                onChange={(e) => handleComponentConfigChange('showSpinner', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`show-spinner-${property.key}`} className="text-sm text-gray-700">
                Show spinner controls
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`show-prefix-${property.key}`}
                checked={!!property.prefix}
                onChange={(e) => {
                  if (!e.target.checked) {
                    handleComponentConfigChange('prefix', '')
                  }
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`show-prefix-${property.key}`} className="text-sm text-gray-700">
                Show prefix
              </label>
              {property.prefix !== undefined && (
                <input
                  type="text"
                  value={property.prefix || ''}
                  onChange={(e) => handleComponentConfigChange('prefix', e.target.value)}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
                  placeholder="$"
                />
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`show-suffix-${property.key}`}
                checked={!!property.suffix}
                onChange={(e) => {
                  if (!e.target.checked) {
                    handleComponentConfigChange('suffix', '')
                  }
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor={`show-suffix-${property.key}`} className="text-sm text-gray-700">
                Show suffix
              </label>
              {property.suffix !== undefined && (
                <input
                  type="text"
                  value={property.suffix || ''}
                  onChange={(e) => handleComponentConfigChange('suffix', e.target.value)}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
                  placeholder="kg"
                />
              )}
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