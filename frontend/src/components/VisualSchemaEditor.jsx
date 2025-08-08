import React, { useState, useCallback } from 'react'
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
    <div className="border rounded-lg bg-white shadow-sm">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          <Icon className="w-5 h-5 text-gray-600" />
          <div>
            <div className="font-medium">{property.key || 'Unnamed Property'}</div>
            <div className="text-sm text-gray-500">{typeInfo?.label}</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
                className="w-full border rounded px-3 py-2 text-sm"
                value={property.key || ''}
                onChange={(e) => handleChange('key', e.target.value)}
                placeholder="property_name"
              />
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
                onChange={(e) => handleChange('default', e.target.value)}
                placeholder="Default value"
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
    const newProperty = {
      ...typeInfo.defaultConfig,
      uiType: typeKey,
      key: `property_${Date.now()}`,
      required: false
    }
    onAddProperty(newProperty)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        <Plus className="w-4 h-4" />
        <span>Add Property</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white border rounded-lg shadow-lg z-10">
          <div className="p-2">
            <div className="text-sm font-medium text-gray-900 mb-2">Select Property Type</div>
            <div className="space-y-1">
              {Object.entries(PROPERTY_TYPES).map(([key, type]) => {
                const Icon = type.icon
                return (
                  <button
                    key={key}
                    onClick={() => handleAddProperty(key)}
                    className="w-full flex items-center space-x-3 p-3 rounded hover:bg-gray-50 text-left"
                  >
                    <Icon className="w-5 h-5 text-gray-600" />
                    <div>
                      <div className="font-medium text-sm">{type.label}</div>
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

  // Update parent schema when properties change
  const updateSchema = useCallback((newProperties) => {
    const newSchema = {
      type: 'object',
      properties: {},
      required: []
    }

    newProperties.forEach(prop => {
      const { key, required, uiType, ...schemaProp } = prop
      if (key) {
        newSchema.properties[key] = schemaProp
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
            className={`flex items-center space-x-1 px-3 py-1 rounded ${
              viewMode === 'visual' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Edit className="w-4 h-4" />
            <span>Visual</span>
          </button>
          <button
            onClick={() => setViewMode('json')}
            className={`flex items-center space-x-1 px-3 py-1 rounded ${
              viewMode === 'json' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {viewMode === 'visual' ? (
        <div className="space-y-4">
          {/* Property list */}
          <div className="space-y-3">
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
          <PropertyTypeSelector onAddProperty={handleAddProperty} />

          {properties.length === 0 && (
            <div className="text-center py-8 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
              <div className="text-gray-500 mb-4">No properties defined yet</div>
              <PropertyTypeSelector onAddProperty={handleAddProperty} />
            </div>
          )}

          {/* Form Preview */}
          {properties.length > 0 && (
            <div className="mt-6">
              <SchemaFormPreview schema={schema} />
            </div>
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
                  // Invalid JSON, ignore for now
                }
              }}
              placeholder="Enter JSON Schema..."
            />
          </div>
        </div>
      )}
    </div>
  )
}
