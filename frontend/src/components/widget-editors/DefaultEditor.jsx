import React from 'react'
import BaseWidgetEditor from './BaseWidgetEditor'
import { AlertCircle } from 'lucide-react'

/**
 * DefaultEditor - Generic widget editor for unknown widget types
 * 
 * This editor dynamically generates form fields based on the widget's JSON schema.
 * Used as a fallback when no specialized editor is available.
 */
const DefaultEditor = ({ config, onChange, errors = {}, widgetType }) => {
  const schema = widgetType?.configurationSchema || {}
  const properties = schema.properties || {}
  const required = schema.required || []

  const renderField = (fieldName, fieldSchema) => {
    const value = config[fieldName] || ''
    const error = errors[fieldName]
    const isRequired = required.includes(fieldName)
    const fieldType = fieldSchema.type || 'string'
    const fieldTitle = fieldSchema.title || fieldName
    const fieldDescription = fieldSchema.description

    const handleChange = (newValue) => {
      onChange({
        ...config,
        [fieldName]: newValue
      })
    }

    // Handle different field types based on JSON schema
    switch (fieldType) {
      case 'string':
        if (fieldSchema.enum) {
          // Select dropdown
          return (
            <div key={fieldName} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {fieldTitle}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              {fieldDescription && (
                <p className="text-xs text-gray-500">{fieldDescription}</p>
              )}
              <select
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                }`}
              >
                <option value="">Select {fieldTitle}</option>
                {fieldSchema.enum.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {error && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">{error}</span>
                </div>
              )}
            </div>
          )
        } else if (fieldSchema.format === 'textarea' || fieldSchema.maxLength > 200) {
          // Textarea
          return (
            <div key={fieldName} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {fieldTitle}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              {fieldDescription && (
                <p className="text-xs text-gray-500">{fieldDescription}</p>
              )}
              <textarea
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={fieldSchema.placeholder || ''}
                rows={fieldSchema.rows || 4}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                }`}
              />
              {error && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">{error}</span>
                </div>
              )}
            </div>
          )
        } else if (fieldSchema.format === 'date') {
          // Date input
          return (
            <div key={fieldName} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {fieldTitle}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              {fieldDescription && (
                <p className="text-xs text-gray-500">{fieldDescription}</p>
              )}
              <input
                type="date"
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                }`}
              />
              {error && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">{error}</span>
                </div>
              )}
            </div>
          )
        } else if (fieldSchema.format === 'date-time') {
          // DateTime input
          return (
            <div key={fieldName} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {fieldTitle}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              {fieldDescription && (
                <p className="text-xs text-gray-500">{fieldDescription}</p>
              )}
              <input
                type="datetime-local"
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                }`}
              />
              {error && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">{error}</span>
                </div>
              )}
            </div>
          )
        } else if (fieldSchema.format === 'uri' || fieldSchema.format === 'url') {
          // URL input
          return (
            <div key={fieldName} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {fieldTitle}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              {fieldDescription && (
                <p className="text-xs text-gray-500">{fieldDescription}</p>
              )}
              <input
                type="url"
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="https://example.com"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                }`}
              />
              {error && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">{error}</span>
                </div>
              )}
            </div>
          )
        } else if (fieldSchema.format === 'email') {
          // Email input
          return (
            <div key={fieldName} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {fieldTitle}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              {fieldDescription && (
                <p className="text-xs text-gray-500">{fieldDescription}</p>
              )}
              <input
                type="email"
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="user@example.com"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                }`}
              />
              {error && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">{error}</span>
                </div>
              )}
            </div>
          )
        } else {
          // Default text input
          return (
            <div key={fieldName} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {fieldTitle}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              {fieldDescription && (
                <p className="text-xs text-gray-500">{fieldDescription}</p>
              )}
              <input
                type="text"
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={fieldSchema.placeholder || ''}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                }`}
              />
              {error && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">{error}</span>
                </div>
              )}
            </div>
          )
        }

      case 'number':
      case 'integer':
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {fieldTitle}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {fieldDescription && (
              <p className="text-xs text-gray-500">{fieldDescription}</p>
            )}
            <input
              type="number"
              value={value}
              onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
              placeholder={fieldSchema.placeholder || ''}
              min={fieldSchema.minimum}
              max={fieldSchema.maximum}
              step={fieldType === 'integer' ? 1 : 'any'}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
              }`}
            />
            {error && (
              <div className="flex items-center space-x-1 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs">{error}</span>
              </div>
            )}
          </div>
        )

      case 'boolean':
        return (
          <div key={fieldName} className="space-y-2">
            <div className="flex items-start">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => handleChange(e.target.checked)}
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="ml-3">
                <label className="text-sm font-medium text-gray-700">
                  {fieldTitle}
                  {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                {fieldDescription && (
                  <p className="text-xs text-gray-500 mt-1">{fieldDescription}</p>
                )}
              </div>
            </div>
            {error && (
              <div className="flex items-center space-x-1 text-red-600 ml-6">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs">{error}</span>
              </div>
            )}
          </div>
        )

      case 'array':
        if (fieldSchema.items?.enum) {
          // Multi-select
          return (
            <div key={fieldName} className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {fieldTitle}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              {fieldDescription && (
                <p className="text-xs text-gray-500">{fieldDescription}</p>
              )}
              <select
                multiple
                value={Array.isArray(value) ? value : []}
                onChange={(e) => {
                  const selectedValues = Array.from(e.target.selectedOptions, option => option.value)
                  handleChange(selectedValues)
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                }`}
                size={Math.min(5, fieldSchema.items.enum.length)}
              >
                {fieldSchema.items.enum.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500">Hold Ctrl/Cmd to select multiple options</p>
              {error && (
                <div className="flex items-center space-x-1 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs">{error}</span>
                </div>
              )}
            </div>
          )
        }
        // For other array types, show a simple text input with JSON
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {fieldTitle}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {fieldDescription && (
              <p className="text-xs text-gray-500">{fieldDescription}</p>
            )}
            <textarea
              value={JSON.stringify(value || [], null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  if (Array.isArray(parsed)) {
                    handleChange(parsed)
                  }
                } catch (err) {
                  // Invalid JSON, don't update
                }
              }}
              placeholder="[]"
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
              }`}
            />
            <p className="text-xs text-gray-500">Enter valid JSON array</p>
            {error && (
              <div className="flex items-center space-x-1 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs">{error}</span>
              </div>
            )}
          </div>
        )

      case 'object':
        // For object types, show a JSON textarea
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {fieldTitle}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {fieldDescription && (
              <p className="text-xs text-gray-500">{fieldDescription}</p>
            )}
            <textarea
              value={JSON.stringify(value || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                    handleChange(parsed)
                  }
                } catch (err) {
                  // Invalid JSON, don't update
                }
              }}
              placeholder="{}"
              rows={6}
              className={`w-full px-3 py-2 border rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
              }`}
            />
            <p className="text-xs text-gray-500">Enter valid JSON object</p>
            {error && (
              <div className="flex items-center space-x-1 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs">{error}</span>
              </div>
            )}
          </div>
        )

      default:
        // Unknown type, render as text
        return (
          <div key={fieldName} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {fieldTitle}
              {isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {fieldDescription && (
              <p className="text-xs text-gray-500">{fieldDescription}</p>
            )}
            <input
              type="text"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={fieldSchema.placeholder || ''}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
              }`}
            />
            {error && (
              <div className="flex items-center space-x-1 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs">{error}</span>
              </div>
            )}
          </div>
        )
    }
  }

  return (
    <div className="space-y-4">
      {Object.keys(properties).length > 0 ? (
        Object.entries(properties).map(([fieldName, fieldSchema]) =>
          renderField(fieldName, fieldSchema)
        )
      ) : (
        <div className="text-center text-gray-500 py-8">
          <p>No configuration options available for this widget.</p>
          <p className="text-sm mt-2">Widget type: {widgetType?.name || 'Unknown'}</p>
        </div>
      )}
    </div>
  )
}

export default DefaultEditor