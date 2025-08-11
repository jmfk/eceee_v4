import React, { useState, useCallback } from 'react'
import { validateFieldName, validateSchemaShape } from '../utils/schemaValidation'
import {
  Plus,
  Trash2,
  Edit,
  Type,
  Hash,
  ToggleLeft,
  List,
  Calendar,
  Mail,
  Link,
  FileText,
  ChevronDown,
  ChevronRight,
  Eye,
  Code
} from 'lucide-react'
import SchemaFormPreview from './SchemaFormPreview'

// Property type definitions with their configurations
const PROPERTY_TYPES = {
  string: {
    icon: Type,
    label: 'Text',
    description: 'Single line text input',
    defaultConfig: {
      type: 'string',
      title: '',
      description: '',
      default: '',
      minLength: null,
      maxLength: null,
      pattern: null,
      format: null
    },
    formats: ['email', 'uri', 'date', 'date-time', 'time']
  },
  number: {
    icon: Hash,
    label: 'Number',
    description: 'Numeric input (integer or decimal)',
    defaultConfig: {
      type: 'number',
      title: '',
      description: '',
      default: null,
      minimum: null,
      maximum: null,
      multipleOf: null
    }
  },
  integer: {
    icon: Hash,
    label: 'Integer',
    description: 'Whole number input',
    defaultConfig: {
      type: 'integer',
      title: '',
      description: '',
      default: null,
      minimum: null,
      maximum: null,
      multipleOf: null
    }
  },
  boolean: {
    icon: ToggleLeft,
    label: 'Boolean',
    description: 'True/false toggle',
    defaultConfig: {
      type: 'boolean',
      title: '',
      description: '',
      default: false
    }
  },
  enum: {
    icon: List,
    label: 'Select',
    description: 'Dropdown with predefined options',
    defaultConfig: {
      type: 'string',
      title: '',
      description: '',
      enum: ['Option 1', 'Option 2'],
      default: null
    }
  },
  textarea: {
    icon: FileText,
    label: 'Textarea',
    description: 'Multi-line text input',
    defaultConfig: {
      type: 'string',
      title: '',
      description: '',
      default: '',
      minLength: null,
      maxLength: null,
      format: 'textarea'
    }
  }
}

// Property configuration component
function PropertyConfig({ property, onUpdate, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localProperty, setLocalProperty] = useState(property)

  const handleChange = useCallback((field, value) => {
    const updated = { ...localProperty, [field]: value }
    setLocalProperty(updated)
    onUpdate(updated)
  }, [localProperty, onUpdate])

  const typeInfo = PROPERTY_TYPES[property.uiType || 'string']
  const Icon = typeInfo?.icon || Type

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 rounded-t-xl"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-4">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{property.key || 'Unnamed Property'}</div>
            <div className="text-sm text-gray-500">{typeInfo?.label}</div>
            {property.required && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mt-1">
                Required
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete property"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="text-gray-400">
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t bg-gray-50 space-y-4">
          {/* Basic Properties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Property Key</label>
              <input
                type="text"
                className={`w-full border rounded px-3 py-2 text-sm ${property.key && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(property.key) ? 'border-red-500' : ''
                  }`}
                value={property.key || ''}
                onChange={(e) => handleChange('key', e.target.value)}
                placeholder="property_name"
              />
              {property.key && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(property.key) && (
                <div className="text-red-500 text-xs mt-1">
                  Key must start with a letter or underscore, followed by letters, numbers, or underscores
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Display Title</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm"
                value={property.title || ''}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Display Name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm"
              value={property.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Help text for this field"
            />
          </div>

          {/* Type-specific configurations */}
          {(property.type === 'string' || property.type === 'number' || property.type === 'integer') && (
            <div>
              <label className="block text-sm font-medium mb-1">Default Value</label>
              <input
                type={property.type === 'string' ? 'text' : 'number'}
                className="w-full border rounded px-3 py-2 text-sm"
                value={property.default || ''}
                onChange={(e) => {
                  if (property.type === 'string') {
                    handleChange('default', e.target.value)
                  } else {
                    handleChange('default', e.target.value ? parseFloat(e.target.value) : null)
                  }
                }}
                placeholder="Default value"
                step={property.type === 'integer' ? '1' : 'any'}
              />
            </div>
          )}

          {property.type === 'boolean' && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`default-${property.key}`}
                checked={property.default || false}
                onChange={(e) => handleChange('default', e.target.checked)}
              />
              <label htmlFor={`default-${property.key}`} className="text-sm">Default to checked</label>
            </div>
          )}

          {/* String-specific options */}
          {property.type === 'string' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Min Length</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={property.minLength || ''}
                  onChange={(e) => handleChange('minLength', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max Length</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={property.maxLength || ''}
                  onChange={(e) => handleChange('maxLength', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="255"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Format</label>
                <select
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={property.format || ''}
                  onChange={(e) => handleChange('format', e.target.value || null)}
                >
                  <option value="">None</option>
                  {typeInfo?.formats?.map(format => (
                    <option key={format} value={format}>{format}</option>
                  ))}
                  <option value="textarea">Textarea</option>
                </select>
              </div>
            </div>
          )}

          {/* Number-specific options */}
          {(property.type === 'number' || property.type === 'integer') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Minimum</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={property.minimum || ''}
                  onChange={(e) => handleChange('minimum', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0"
                  step={property.type === 'integer' ? '1' : 'any'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Maximum</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={property.maximum || ''}
                  onChange={(e) => handleChange('maximum', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="100"
                  step={property.type === 'integer' ? '1' : 'any'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Multiple Of</label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={property.multipleOf || ''}
                  onChange={(e) => handleChange('multipleOf', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="1"
                  step={property.type === 'integer' ? '1' : 'any'}
                  min="0"
                />
              </div>
            </div>
          )}

          {/* Enum options */}
          {property.enum && (
            <div>
              <label className="block text-sm font-medium mb-1">Options</label>
              <div className="space-y-2">
                {property.enum.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      className="flex-1 border rounded px-3 py-2 text-sm"
                      value={option}
                      onChange={(e) => {
                        const newEnum = [...property.enum]
                        newEnum[index] = e.target.value
                        handleChange('enum', newEnum)
                      }}
                      placeholder={`Option ${index + 1}`}
                    />
                    <button
                      onClick={() => {
                        const newEnum = property.enum.filter((_, i) => i !== index)
                        handleChange('enum', newEnum)
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => handleChange('enum', [...property.enum, `Option ${property.enum.length + 1}`])}
                  className="flex items-center space-x-1 text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Option</span>
                </button>
              </div>
            </div>
          )}

          {/* Required toggle */}
          <div className="flex items-center space-x-2 pt-2 border-t">
            <input
              type="checkbox"
              id={`required-${property.key}`}
              checked={property.required || false}
              onChange={(e) => handleChange('required', e.target.checked)}
            />
            <label htmlFor={`required-${property.key}`} className="text-sm font-medium">Required field</label>
          </div>
        </div>
      )}
    </div>
  )
}

// Property type selector
function PropertyTypeSelector({ onAddProperty }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleAddProperty = (typeKey) => {
    const typeInfo = PROPERTY_TYPES[typeKey]
    const baseKey = typeInfo.label.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const newProperty = {
      ...typeInfo.defaultConfig,
      uiType: typeKey,
      key: baseKey,
      title: typeInfo.label,
      required: false
    }
    onAddProperty(newProperty)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">Add Property</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-3 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-20">
          <div className="p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3 text-center">Select Property Type</div>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(PROPERTY_TYPES).map(([key, type]) => {
                const Icon = type.icon
                return (
                  <button
                    key={key}
                    onClick={() => handleAddProperty(key)}
                    className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 text-left transition-colors group"
                  >
                    <div className="p-2 bg-gray-100 group-hover:bg-blue-100 rounded-lg transition-colors">
                      <Icon className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{type.label}</div>
                      <div className="text-xs text-gray-500">{type.description}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

// Main Visual Schema Editor component
export default function VisualSchemaEditor({ schema, onChange }) {
  const [properties, setProperties] = useState(() => {
    // Convert schema properties to internal format
    const schemaProps = schema?.properties || {}
    const required = schema?.required || []

    return Object.entries(schemaProps).map(([key, prop]) => ({
      ...prop,
      key,
      required: required.includes(key),
      uiType: prop.enum ? 'enum' : (prop.format === 'textarea' ? 'textarea' : prop.type)
    }))
  })

  const [viewMode, setViewMode] = useState('visual') // 'visual' or 'json'
  const [jsonError, setJsonError] = useState('')

  // Clean up property to remove null/empty values
  const cleanProperty = (prop) => {
    const cleaned = {}

    Object.entries(prop).forEach(([key, value]) => {
      // Skip null values and undefined
      if (value === null || value === undefined) {
        return
      }

      // Skip empty strings for numeric fields
      if (typeof value === 'string' && value === '' &&
        ['minLength', 'maxLength', 'minimum', 'maximum', 'multipleOf'].includes(key)) {
        return
      }

      // Skip empty arrays for enum
      if (Array.isArray(value) && value.length === 0 && key === 'enum') {
        return
      }

      // Skip empty strings for non-required string fields
      if (typeof value === 'string' && value === '' && key !== 'default') {
        return
      }

      cleaned[key] = value
    })

    return cleaned
  }

  // Update parent schema when properties change
  const updateSchema = useCallback((newProperties) => {
    const newSchema = {
      type: 'object',
      properties: {},
      required: []
    }

    newProperties.forEach(prop => {
      const { key, required, uiType, ...schemaProp } = prop
      if (key && validateFieldName(key)) {
        newSchema.properties[key] = cleanProperty(schemaProp)
        if (required) {
          newSchema.required.push(key)
        }
      }
    })

    // Remove empty arrays/objects
    if (newSchema.required.length === 0) {
      delete newSchema.required
    }

    onChange(newSchema)
  }, [onChange])

  const handleAddProperty = useCallback((newProperty) => {
    const updatedProperties = [...properties, newProperty]
    setProperties(updatedProperties)
    updateSchema(updatedProperties)
  }, [properties, updateSchema])

  const handleUpdateProperty = useCallback((index, updatedProperty) => {
    const updatedProperties = [...properties]
    updatedProperties[index] = updatedProperty
    setProperties(updatedProperties)
    updateSchema(updatedProperties)
  }, [properties, updateSchema])

  const handleDeleteProperty = useCallback((index) => {
    const updatedProperties = properties.filter((_, i) => i !== index)
    setProperties(updatedProperties)
    updateSchema(updatedProperties)
  }, [properties, updateSchema])

  const generatedSchema = JSON.stringify(schema, null, 2)

  return (
    <div className="space-y-6">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Schema Editor</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('visual')}
            className={`flex items-center space-x-1 px-3 py-1 rounded ${viewMode === 'visual' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <Edit className="w-4 h-4" />
            <span>Visual</span>
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`flex items-center space-x-1 px-3 py-1 rounded ${viewMode === 'json' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <Code className="w-4 h-4" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {viewMode === 'visual' ? (
        <div className="space-y-6">
          {properties.length === 0 ? (
            <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-xl">
              <div className="mb-4">
                <div className="text-gray-600 text-lg mb-2">No properties defined yet</div>
                <div className="text-gray-500 text-sm mb-6">Add your first property to start building your schema</div>
              </div>
              <PropertyTypeSelector onAddProperty={handleAddProperty} />
            </div>
          ) : (
            <>
              {/* Property list */}
              <div className="space-y-4">
                {properties.map((property, index) => (
                  <PropertyConfig
                    key={`${property.key}-${index}`}
                    property={property}
                    onUpdate={(updated) => handleUpdateProperty(index, updated)}
                    onDelete={() => handleDeleteProperty(index)}
                  />
                ))}
              </div>

              {/* Add property button */}
              <div className="flex justify-center">
                <PropertyTypeSelector onAddProperty={handleAddProperty} />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Generated JSON Schema</label>
            <textarea
              className="w-full h-96 border rounded px-3 py-2 font-mono text-sm"
              value={generatedSchema}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  const { valid, reason } = validateSchemaShape(parsed)
                  if (!valid) {
                    setJsonError(reason || 'Invalid schema shape')
                    return
                  }
                  setJsonError('')
                  onChange(parsed)
                  // Re-sync properties from schema
                  const schemaProps = parsed?.properties || {}
                  const required = parsed?.required || []
                  setProperties(Object.entries(schemaProps).map(([key, prop]) => ({
                    ...prop,
                    key,
                    required: required.includes(key),
                    uiType: prop.enum ? 'enum' : (prop.format === 'textarea' ? 'textarea' : prop.type)
                  })))
                } catch (err) {
                  setJsonError('Invalid JSON')
                }
              }}
              placeholder="Enter JSON Schema..."
            />
            {jsonError && (
              <div className="text-red-600 text-sm mt-2">{jsonError}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
