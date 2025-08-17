import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Mini form renderer to preview how the schema will look as a form
export default function SchemaFormPreview({ schema }) {
  const [formData, setFormData] = useState({})

  if (!schema?.properties || Object.keys(schema.properties).length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-6 text-center">
        <div className="text-gray-500 text-sm">
          No schema properties defined yet. Add properties to see a form preview.
        </div>
      </div>
    )
  }

  const handleInputChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const renderField = (key, property) => {
    const isRequired = schema.required?.includes(key)
    const value = formData[key] || property.default || ''

    switch (property.type) {
      case 'string':
        if (property.enum) {
          return (
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={value}
              onChange={(e) => handleInputChange(key, e.target.value)}
            >
              <option value="">Select an option...</option>
              {property.enum.map((option, index) => (
                <option key={index} value={option}>{option}</option>
              ))}
            </select>
          )
        } else if (property.format === 'textarea') {
          return (
            <textarea
              className="w-full border rounded px-3 py-2 text-sm"
              rows={3}
              value={value}
              onChange={(e) => handleInputChange(key, e.target.value)}
              placeholder={property.description || ''}
              minLength={property.minLength}
              maxLength={property.maxLength}
            />
          )
        } else {
          const inputType = property.format === 'email' ? 'email' :
            property.format === 'uri' ? 'url' :
              property.format === 'date' ? 'date' :
                property.format === 'date-time' ? 'datetime-local' :
                  property.format === 'time' ? 'time' : 'text'

          return (
            <input
              type={inputType}
              className="w-full border rounded px-3 py-2 text-sm"
              value={value}
              onChange={(e) => handleInputChange(key, e.target.value)}
              placeholder={property.description || ''}
              minLength={property.minLength}
              maxLength={property.maxLength}
              pattern={property.pattern}
            />
          )
        }

      case 'number':
      case 'integer':
        return (
          <input
            type="number"
            className="w-full border rounded px-3 py-2 text-sm"
            value={value}
            onChange={(e) => handleInputChange(key, parseFloat(e.target.value) || 0)}
            placeholder={property.description || ''}
            min={property.minimum}
            max={property.maximum}
            step={property.type === 'integer' ? 1 : (property.multipleOf || 'any')}
          />
        )

      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`preview-${key}`}
              checked={!!value}
              onChange={(e) => handleInputChange(key, e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor={`preview-${key}`} className="text-sm">
              {property.title || key}
            </label>
          </div>
        )

      default:
        return (
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-sm"
            value={value}
            onChange={(e) => handleInputChange(key, e.target.value)}
            placeholder={property.description || ''}
          />
        )
    }
  }

  return (
    <div className="rounded-lg bg-gray-50">
      <div className="space-y-4">
        {Object.entries(schema.properties).map(([key, property]) => {
          const isRequired = schema.required?.includes(key)

          return (
            <div key={key}>
              <label className="block text-sm font-medium mb-1">
                {property.title || key}
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              {property.description && (
                <div className="text-xs text-gray-500 mb-2">{property.description}</div>
              )}
              {renderField(key, property)}
            </div>
          )
        })}
      </div>

      {Object.keys(formData).length > 0 && (
        <details className="mt-4 pt-4 border-t">
          <summary className="text-sm font-medium cursor-pointer">Form Data (JSON)</summary>
          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify(formData, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}
