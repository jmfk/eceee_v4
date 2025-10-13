import React from 'react'
import { AlertTriangle } from 'lucide-react'
import ComponentTypeSelector from '../components/ComponentTypeSelector'

/**
 * Generic Property Configuration Component
 * 
 * Fallback component used when no specific property config component
 * is available for a field type. Provides basic property configuration.
 */
export default function GenericPropertyConfig({
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
      {/* Warning about generic config */}
      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 flex items-start">
        <AlertTriangle className="w-4 h-4 text-amber-600 mr-2 mt-0.5" />
        <div className="text-sm text-amber-800">
          <div className="font-medium">Generic Configuration</div>
          <div>No specific configuration component found for "{property.component}". Using generic settings.</div>
        </div>
      </div>

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

      {/* Default Value */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Default Value
        </label>
        <input
          type="text"
          value={property.default || ''}
          onChange={(e) => handleChange('default', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Default value"
        />
      </div>

      {/* Required toggle */}
      <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
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

      {/* Raw JSON Configuration for advanced users */}
      <details className="mt-4">
        <summary className="text-sm font-medium text-gray-700 cursor-pointer">
          Advanced: Raw Configuration
        </summary>
        <div className="mt-2">
          <textarea
            value={JSON.stringify(property, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                onChange(parsed)
              } catch (err) {
                // Invalid JSON, ignore for now
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
            rows={8}
            placeholder="Raw property configuration..."
          />
          <div className="text-xs text-gray-500 mt-1">
            Edit the raw JSON configuration. Changes will be applied if valid JSON is entered.
          </div>
        </div>
      </details>
    </div>
  )
}