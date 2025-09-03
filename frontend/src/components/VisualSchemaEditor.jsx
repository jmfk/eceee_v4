import React, { useState, useCallback, useEffect } from 'react'
import { validateFieldName, validateSchemaShape } from '../utils/schemaValidation'
import { getAllFieldTypes, getDefaultProps } from '../utils/fieldTypeRegistry'
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
  ChevronUp,
  Eye,
  Code,
  Image,
  FolderOpen,
  Files
} from 'lucide-react'
import SchemaFormPreview from './SchemaFormPreview'

// Property type definitions - now using field type registry
// Keeping old PROPERTY_TYPES for backward compatibility during transition
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
  },
  media: {
    icon: Image,
    label: 'Media File',
    description: 'Single media file from library',
    defaultConfig: {
      type: 'object',
      title: '',
      description: '',
      format: 'media',
      default: null,
      mediaTypes: ['image', 'video', 'audio', 'document'],
      multiple: false
    }
  },
  media_multiple: {
    icon: Files,
    label: 'Multiple Media',
    description: 'Multiple media files from library',
    defaultConfig: {
      type: 'array',
      title: '',
      description: '',
      format: 'media',
      default: [],
      mediaTypes: ['image', 'video', 'audio', 'document'],
      multiple: true,
      maxItems: null,
      minItems: null
    }
  },
  image: {
    icon: Image,
    label: 'Image',
    description: 'Single image from library',
    defaultConfig: {
      type: 'object',
      title: '',
      description: '',
      format: 'media',
      default: null,
      mediaTypes: ['image'],
      multiple: false
    }
  },
  gallery: {
    icon: FolderOpen,
    label: 'Image Gallery',
    description: 'Multiple images from library',
    defaultConfig: {
      type: 'array',
      title: '',
      description: '',
      format: 'media',
      default: [],
      mediaTypes: ['image'],
      multiple: true,
      maxItems: null,
      minItems: null
    }
  }
}

// Property configuration component
function PropertyConfig({ property, index, totalCount, onUpdate, onDelete, onMoveUp, onMoveDown, allProperties = [] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [localProperty, setLocalProperty] = useState(property)

  const handleChange = useCallback((field, value) => {
    const updated = { ...localProperty, [field]: value }
    setLocalProperty(updated)
    onUpdate(updated)
  }, [localProperty, onUpdate])

  // Check if key is unique
  const isKeyUnique = useCallback((key) => {
    if (!key) return true

    // Check if any other property has the same key
    return !allProperties.some(prop => prop.key === key && prop._id !== property._id)
  }, [allProperties, property._id])

  // Get field type info from registry
  const fieldTypes = getAllFieldTypes()
  const typeInfo = fieldTypes.find(ft => ft.key === (property.uiType || property.fieldType || 'text'))
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
            <div className="font-semibold text-gray-900">
              {property.title && property.key
                ? `${property.title} (${property.key})`
                : property.title || property.key || 'Unnamed Property'
              }
            </div>
            <div className="text-sm text-gray-500">{typeInfo?.label}</div>
            {property.required && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mt-1">
                Required
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Sort buttons */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveUp() }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Move up"
            disabled={index === 0}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMoveDown() }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Move down"
            disabled={index === totalCount - 1}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
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
        <div className="px-4 py-4 border-t bg-gray-50 space-y-4">
          {/* Basic Properties */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Property Key</label>
              <input
                type="text"
                className={`w-full border rounded px-3 py-2 text-sm ${(property.key && (!validateFieldName(property.key) || !isKeyUnique(property.key))) ? 'border-red-500' : ''
                  }`}
                value={property.key || ''}
                onChange={(e) => handleChange('key', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                  }
                }}
                placeholder="propertyName"
              />
              {property.key && !validateFieldName(property.key) && (
                <div className="text-red-500 text-xs mt-1">
                  Key must be in camelCase (start with lowercase letter, followed by letters and numbers only)
                </div>
              )}
              {property.key && validateFieldName(property.key) && !isKeyUnique(property.key) && (
                <div className="text-red-500 text-xs mt-1">
                  Property key "{property.key}" already exists. Please choose a unique name.
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                  }
                }}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                }
              }}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                    }
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                    }
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                    }
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                    }
                  }}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                    }
                  }}
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                        }
                      }}
                      placeholder={`Option ${index + 1}`}
                    />
                    <button
                      type="button"
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
                  type="button"
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
function PropertyTypeSelector({ onAddProperty, existingProperties = [] }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleAddProperty = (typeKey) => {
    const fieldTypes = getAllFieldTypes()
    const typeInfo = fieldTypes.find(ft => ft.key === typeKey)

    if (!typeInfo) {
      console.error(`Field type ${typeKey} not found in registry`)
      return
    }

    // Convert to camelCase: "Text Field" -> "textField"
    let baseKey = typeInfo.label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .split(/\s+/) // Split by spaces
      .map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
      .join('')

    // Ensure unique key by checking existing properties
    const existingKeys = new Set()

    // Get existing keys from the passed existingProperties
    existingProperties.forEach(prop => {
      if (prop.key) {
        existingKeys.add(prop.key)
      }
    })

    // Make key unique if it already exists
    let uniqueKey = baseKey
    let counter = 1
    while (existingKeys.has(uniqueKey)) {
      uniqueKey = `${baseKey}${counter}`
      counter++
    }

    const newProperty = {
      ...getDefaultProps(typeKey),
      fieldType: typeKey, // Use fieldType instead of uiType
      uiType: typeKey,    // Keep uiType for internal use
      key: uniqueKey,     // Use the unique key
      title: typeInfo.label,
      required: false
    }
    onAddProperty(newProperty)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm"
      >
        <Plus className="w-4 h-4" />
        <span>Add Property</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mx-auto mt-3 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-20">
          <div className="p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3 text-center">Select Property Type</div>
            <div className="grid grid-cols-1 gap-2">
              {getAllFieldTypes().map((fieldType) => {
                const Icon = fieldType.icon
                return (
                  <button
                    type="button"
                    key={fieldType.key}
                    onClick={() => handleAddProperty(fieldType.key)}
                    className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 text-left transition-colors group"
                  >
                    <div className="p-2 bg-gray-100 group-hover:bg-blue-100 rounded-lg transition-colors">
                      <Icon className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{fieldType.label}</div>
                      <div className="text-xs text-gray-500">{fieldType.description}</div>
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
    const propertyOrder = schema?.propertyOrder || []

    // If propertyOrder exists, use it to maintain order
    if (propertyOrder.length > 0) {
      const orderedProps = []

      // Add properties in the specified order
      propertyOrder.forEach((key, index) => {
        if (schemaProps[key]) {
          orderedProps.push({
            ...schemaProps[key],
            key,
            required: required.includes(key),
            uiType: schemaProps[key].fieldType || (schemaProps[key].enum ? 'choice' : (schemaProps[key].format === 'textarea' ? 'rich_text' : 'text')),
            _id: `prop-${index}` // Stable ID for React key based on position
          })
        }
      })

      // Add any properties not in the order list (for backward compatibility)
      let extraIndex = propertyOrder.length
      Object.entries(schemaProps).forEach(([key, prop]) => {
        if (!propertyOrder.includes(key)) {
          orderedProps.push({
            ...prop,
            key,
            required: required.includes(key),
            uiType: prop.fieldType || (prop.enum ? 'choice' : (prop.format === 'textarea' ? 'rich_text' : 'text')),
            _id: `prop-${extraIndex}` // Stable ID for React key based on position
          })
          extraIndex++
        }
      })

      return orderedProps
    }

    // Fallback to object key order if no propertyOrder
    return Object.entries(schemaProps).map(([key, prop], index) => ({
      ...prop,
      key,
      required: required.includes(key),
      uiType: prop.fieldType || (prop.enum ? 'choice' : (prop.format === 'textarea' ? 'rich_text' : 'text')),
      _id: `prop-${index}` // Stable ID for React key based on position
    }))
  })

  // Update properties when schema prop changes
  useEffect(() => {

    const schemaProps = schema?.properties || {}
    const required = schema?.required || []
    const propertyOrder = schema?.propertyOrder || []

    let newProperties = []

    if (propertyOrder.length > 0) {
      // Use propertyOrder for ordering
      propertyOrder.forEach((key, index) => {
        if (schemaProps[key]) {
          newProperties.push({
            ...schemaProps[key],
            key,
            required: required.includes(key),
            uiType: schemaProps[key].fieldType || (schemaProps[key].enum ? 'choice' : (schemaProps[key].format === 'textarea' ? 'rich_text' : 'text')),
            _id: `prop-${index}`
          })
        }
      })
    } else {
      // Fallback to object key order
      newProperties = Object.entries(schemaProps).map(([key, prop], index) => ({
        ...prop,
        key,
        required: required.includes(key),
        uiType: prop.fieldType || (prop.enum ? 'choice' : (prop.format === 'textarea' ? 'rich_text' : 'text')),
        _id: `prop-${index}`
      }))
    }
    setProperties(newProperties)
  }, [schema])

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
      propertyOrder: [],
      required: []
    }

    // Convert internal properties format to JSON Schema format
    newProperties.forEach(prop => {
      const { key, required, uiType, _id, ...schemaProp } = prop
      if (key && validateFieldName(key)) {
        // Add fieldType to the property definition
        const propertyWithFieldType = {
          ...schemaProp,
          fieldType: uiType || schemaProp.fieldType || 'text' // Use uiType as fieldType
        }

        // Add to properties object (not array) - key becomes the property name
        newSchema.properties[key] = cleanProperty(propertyWithFieldType)
        newSchema.propertyOrder.push(key)

        // Add to required array if property is required
        if (required) {
          newSchema.required.push(key)
        }
      }
    })

    onChange(newSchema)
  }, [onChange])

  const handleAddProperty = useCallback((newProperty) => {
    // Add a stable ID to the new property
    const propertyWithId = {
      ...newProperty,
      _id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
    const updatedProperties = [...properties, propertyWithId]
    setProperties(updatedProperties)
    updateSchema(updatedProperties)
  }, [properties, updateSchema])

  const handleUpdateProperty = useCallback((index, updatedProperty) => {
    const updatedProperties = [...properties]
    // Preserve the _id when updating
    updatedProperties[index] = {
      ...updatedProperty,
      _id: properties[index]._id
    }
    setProperties(updatedProperties)
    updateSchema(updatedProperties)
  }, [properties, updateSchema])

  const handleDeleteProperty = useCallback((index) => {
    const updatedProperties = properties.filter((_, i) => i !== index)
    setProperties(updatedProperties)
    updateSchema(updatedProperties)
  }, [properties, updateSchema])

  const handleMoveProperty = useCallback((index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= properties.length) return

    const updatedProperties = [...properties]
    const [movedProperty] = updatedProperties.splice(index, 1)
    updatedProperties.splice(newIndex, 0, movedProperty)
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
            type="button"
            onClick={() => setViewMode('visual')}
            className={`flex items-center space-x-1 px-3 py-1 rounded ${viewMode === 'visual' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <Edit className="w-4 h-4" />
            <span>Visual</span>
          </button>
          <button
            type="button"
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
              <div className="mb-6">
                <div className="text-gray-600 text-lg mb-2">No properties defined yet</div>
                <div className="text-gray-500 text-sm">Add your first property to start building your schema</div>
              </div>
              <div className="flex justify-center pt-4 border-t border-gray-100">
                <PropertyTypeSelector onAddProperty={handleAddProperty} existingProperties={properties} />
              </div>
            </div>
          ) : (
            <>
              {/* Property list */}
              <div className="space-y-4">
                {properties.map((property, index) => (
                  <PropertyConfig
                    key={property._id}
                    property={property}
                    index={index}
                    totalCount={properties.length}
                    allProperties={properties}
                    onUpdate={(updated) => handleUpdateProperty(index, updated)}
                    onDelete={() => handleDeleteProperty(index)}
                    onMoveUp={() => handleMoveProperty(index, 'up')}
                    onMoveDown={() => handleMoveProperty(index, 'down')}
                  />
                ))}
              </div>

              {/* Add property button */}
              <div className="flex justify-center pt-4 border-t border-gray-100">
                <PropertyTypeSelector onAddProperty={handleAddProperty} existingProperties={properties} />
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
