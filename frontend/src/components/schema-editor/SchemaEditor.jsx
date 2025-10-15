import React, { useState, useEffect, useCallback } from 'react'
import { Edit, Code, Eye, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { initializePropertyRegistry, getAllPropertyTypes, isPropertyRegistryInitialized, getAvailableComponentTypes } from './PropertyTypeRegistry'
import PropertyList from './PropertyList'
import PropertyTypeSelector from './PropertyTypeSelector'
import { validateFieldName, validateSchemaShape, validateComponentType } from '../../utils/schemaValidation'

/**
 * SchemaEditor Component
 * 
 * Main schema editor component that provides a visual interface for
 * creating and editing JSON schemas with dynamic property types.
 */
export default function SchemaEditor({
  schema = {},
  onChange,
  disabled = false,
  onValidationChange = null
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [initError, setInitError] = useState(null)
  const [viewMode, setViewMode] = useState('visual') // 'visual' or 'json' or 'preview'
  const [jsonError, setJsonError] = useState('')
  const [properties, setProperties] = useState([])
  const [validationErrors, setValidationErrors] = useState({})

  // Initialize the property registry and convert schema to internal format
  useEffect(() => {
    const initializeEditor = async () => {
      try {
        setIsLoading(true)

        // Initialize property registry from backend field types
        if (!isPropertyRegistryInitialized()) {
          await initializePropertyRegistry()
        }

        // Convert schema to internal properties format
        const internalProperties = convertSchemaToProperties(schema)
        setProperties(internalProperties)

        // Validate the initial schema
        validateProperties(internalProperties)

      } catch (error) {
        console.error('Failed to initialize schema editor:', error)
        setInitError(error.message)
      } finally {
        setIsLoading(false)
      }
    }

    initializeEditor()
  }, []) // Only run once on mount

  // Update properties when schema prop changes (but not during initialization)
  // Note: convertSchemaToProperties and validateProperties are useCallback functions
  // that are stable across renders, so we don't need them in dependencies
  useEffect(() => {
    if (!isLoading && !initError) {
      console.log('[SchemaEditor] Schema prop changed, updating properties', {
        schema,
        isLoading,
        initError
      })
      const internalProperties = convertSchemaToProperties(schema)
      setProperties(internalProperties)
      validateProperties(internalProperties)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, isLoading, initError])

  /**
   * Convert JSON schema to internal properties format
   */
  const convertSchemaToProperties = useCallback((inputSchema) => {
    if (!inputSchema || !inputSchema.properties) {
      return []
    }

    const schemaProps = inputSchema.properties
    const required = inputSchema.required || []
    const propertyOrder = inputSchema.propertyOrder || Object.keys(schemaProps)

    return propertyOrder.map((key, index) => {
      if (schemaProps[key]) {
        const prop = { ...schemaProps[key] }

        // Backend uses 'field_type', frontend uses 'componentType'
        // Convert field_type to componentType for internal use
        if (prop.field_type && !prop.componentType) {
          prop.componentType = prop.field_type
        }

        return {
          ...prop,
          key,
          required: required.includes(key),
          _id: `prop-${index}` // Stable ID for React keys based on position only
        }
      }
      return null
    }).filter(Boolean)
  }, [])

  /**
   * Get JSON Schema type for a given componentType
   */
  const getJsonSchemaType = (componentType, isMultiple = false) => {
    // Map componentTypes to JSON Schema types based on backend field registry
    const typeMapping = {
      'text': 'string',
      'textarea': 'string',
      'rich_text': 'string',
      'number': 'number',
      'integer': 'integer',
      'date': 'string',
      'datetime': 'string',
      'time': 'string',
      'boolean': 'boolean',
      'image': 'string',
      'file': 'string',
      'url': 'string',
      'email': 'string',
      'choice': 'string',
      'multi_choice': 'array',
      'user_reference': 'array', // Always array for consistency
      'object_reference': 'array', // Always array for consistency
      'reverse_object_reference': 'array',
      'tag': 'array',
      'date_range': 'object',
      'object_type_selector': 'string',
    }

    return typeMapping[componentType] || 'string'
  }

  /**
   * Convert internal properties format to JSON schema
   * Note: We preserve all properties, even those with validation errors,
   * to prevent data loss during editing. Validation errors will prevent saving.
   */
  const convertPropertiesToSchema = useCallback((propertiesList) => {
    console.log('[SchemaEditor] convertPropertiesToSchema called with', propertiesList.length, 'properties')

    const newSchema = {
      type: 'object',
      properties: {},
      required: [],
      propertyOrder: []
    }

    propertiesList.forEach((prop, index) => {
      const { key, required, _id, ...schemaProp } = prop

      console.log(`[SchemaEditor] Processing property ${index}:`, {
        key,
        required,
        hasType: !!schemaProp.type,
        hasComponentType: !!schemaProp.componentType,
        componentType: schemaProp.componentType
      })

      // Preserve all properties with keys, even invalid ones
      // This prevents fields from being deleted when editing
      if (key) {
        // Ensure the property has a 'type' field (required by backend validation)
        if (!schemaProp.type && schemaProp.componentType) {
          schemaProp.type = getJsonSchemaType(schemaProp.componentType, schemaProp.multiple)
          console.log(`[SchemaEditor] Added type '${schemaProp.type}' for ${key}`)
        }

        // Backend expects 'field_type' not 'componentType'
        // Keep BOTH for internal editing, backend will convert field_type during save
        if (schemaProp.componentType) {
          schemaProp.field_type = schemaProp.componentType
          // DON'T delete componentType - we need it for the UI
          console.log(`[SchemaEditor] Set field_type from componentType for ${key}`)
        }

        // Add to properties object
        newSchema.properties[key] = schemaProp
        newSchema.propertyOrder.push(key)

        // Add to required array if property is required
        if (required) {
          newSchema.required.push(key)
        }

        console.log(`[SchemaEditor] Added property '${key}' to schema. Required: ${required}`)
      } else {
        console.warn(`[SchemaEditor] Skipping property at index ${index} - no key`)
      }
    })

    console.log('[SchemaEditor] Final schema:', {
      propertyCount: Object.keys(newSchema.properties).length,
      propertyKeys: Object.keys(newSchema.properties),
      required: newSchema.required,
      propertyOrder: newSchema.propertyOrder
    })

    return newSchema
  }, [])

  /**
   * Validate properties and set validation errors
   */
  const validateProperties = useCallback((propertiesList) => {
    const errors = {}
    const usedKeys = new Set()

    propertiesList.forEach((property, index) => {
      const keyPrefix = `property-${index}-`

      // Validate property key
      if (!property.key || !property.key.trim()) {
        errors[`${keyPrefix}key`] = 'Property key is required'
      } else if (!validateFieldName(property.key)) {
        errors[`${keyPrefix}key`] = 'Invalid key format. Use camelCase (e.g., firstName)'
      } else if (usedKeys.has(property.key)) {
        errors[`${keyPrefix}key`] = `Duplicate key "${property.key}"`
      } else {
        usedKeys.add(property.key)
      }

      // Validate property title
      if (!property.title || !property.title.trim()) {
        errors[`${keyPrefix}title`] = 'Display label is required'
      }

      // Validate component type
      const componentType = property.componentType || property.component
      if (!componentType) {
        errors[`${keyPrefix}componentType`] = 'Component type is required'
      } else {
        // Validate against available types
        const availableTypes = getAvailableComponentTypes()
        const componentTypeError = validateComponentType(componentType, availableTypes)
        if (componentTypeError) {
          errors[`${keyPrefix}componentType`] = componentTypeError
        }
      }

      // Type-specific validations
      if (property.component === 'SelectInput' && (!property.enum || property.enum.length === 0)) {
        errors[`${keyPrefix}enum`] = 'Choice fields must have at least one option'
      }
    })

    setValidationErrors(errors)
    const isValid = Object.keys(errors).length === 0

    // Notify parent component of validation state
    if (onValidationChange) {
      onValidationChange(isValid, errors)
    }

    return isValid
  }, [onValidationChange])

  /**
   * Handle properties change and update schema
   */
  const handlePropertiesChange = useCallback((newProperties) => {
    console.log('[SchemaEditor] handlePropertiesChange called', {
      newProperties,
      propertiesCount: newProperties.length
    })

    setProperties(newProperties)

    // Validate properties
    const isValid = validateProperties(newProperties)

    // Convert to schema format and notify parent
    const newSchema = convertPropertiesToSchema(newProperties)
    console.log('[SchemaEditor] Calling onChange with new schema', {
      newSchema,
      isValid,
      note: 'Always calling onChange to keep parent in sync'
    })
    onChange(newSchema)
  }, [onChange, validateProperties, convertPropertiesToSchema])

  /**
   * Handle adding a new property from the header button
   */
  const handleAddProperty = useCallback((newProperty) => {
    const updatedProperties = [...properties, newProperty]
    handlePropertiesChange(updatedProperties)
  }, [properties, handlePropertiesChange])

  /**
   * Handle JSON mode changes
   */
  const handleJsonChange = useCallback((jsonString) => {
    try {
      const parsed = JSON.parse(jsonString)
      const { valid, reason } = validateSchemaShape(parsed)

      if (!valid) {
        setJsonError(reason || 'Invalid schema shape')
        return
      }

      setJsonError('')

      // Convert to internal format and update
      const newProperties = convertSchemaToProperties(parsed)
      setProperties(newProperties)
      validateProperties(newProperties)

      onChange(parsed)
    } catch (err) {
      setJsonError('Invalid JSON')
    }
  }, [onChange, convertSchemaToProperties, validateProperties])

  const generatedSchema = convertPropertiesToSchema(properties)
  const hasErrors = Object.keys(validationErrors).length > 0
  const isValid = !hasErrors && properties.length > 0

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <div className="text-gray-600">Loading schema editor...</div>
          <div className="text-sm text-gray-500 mt-1">Initializing property types</div>
        </div>
      </div>
    )
  }

  // Error state
  if (initError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5" />
          <div>
            <div className="text-red-800 font-medium">Failed to initialize schema editor</div>
            <div className="text-red-700 mt-1">{initError}</div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 text-red-600 hover:text-red-800 underline text-sm"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with view toggle and status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium">Schema Editor</h3>

          {/* Status Indicator */}
          <div className="flex items-center space-x-2">
            {isValid ? (
              <div className="flex items-center space-x-1 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Valid Schema</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  {properties.length === 0 ? 'No Properties' : `${Object.keys(validationErrors).length} Errors`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Add Property Button and View Mode Toggle */}
        <div className="flex items-center space-x-4">
          {/* Add Property Button */}
          <PropertyTypeSelector
            onAddProperty={handleAddProperty}
            existingProperties={properties}
            disabled={disabled}
          />

          {/* View Mode Toggle */}
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

            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center space-x-1 px-3 py-1 rounded ${viewMode === 'preview' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <Eye className="w-4 h-4" />
              <span>Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'visual' && (
        <div>
          {/* Global Validation Errors */}
          {hasErrors && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-400 mr-3 mt-0.5" />
                <div>
                  <h3 className="text-red-800 font-medium">Schema Validation Errors</h3>
                  <div className="text-red-700 mt-1 text-sm">
                    Please fix the following errors before the schema can be saved:
                  </div>
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                    {Object.values(validationErrors).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <PropertyList
            properties={properties}
            onChange={handlePropertiesChange}
            errors={validationErrors}
            disabled={disabled}
          />
        </div>
      )}

      {viewMode === 'json' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Generated JSON Schema</label>
            <textarea
              className="w-full h-96 border rounded px-3 py-2 font-mono text-sm"
              value={JSON.stringify(generatedSchema, null, 2)}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder="Enter JSON Schema..."
              disabled={disabled}
            />
            {jsonError && (
              <div className="text-red-600 text-sm mt-2">{jsonError}</div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'preview' && (
        <div className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            This preview shows how the schema will appear when rendered as a form.
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            {properties.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No properties to preview. Add some properties first.
              </div>
            ) : (
              <div className="space-y-4">
                {properties.map((property, index) => (
                  <div key={property._id || index} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {property.title || property.key || 'Untitled Field'}
                      {property.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {property.description && (
                      <div className="text-sm text-gray-600">{property.description}</div>
                    )}

                    <div className="bg-gray-100 border border-gray-300 rounded-md p-3 text-center text-sm text-gray-500">
                      {property.component} field preview
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}