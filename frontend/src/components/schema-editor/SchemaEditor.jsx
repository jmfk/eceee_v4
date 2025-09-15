/**
 * Schema Editor - Main Container Component
 * 
 * The main container component for the new modular schema editor system.
 * Manages schema state, converts between internal and JSON schema formats,
 * and coordinates between all child components.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { Code, Edit, Eye, Save, RotateCcw } from 'lucide-react'
import PropertyList from './PropertyList'
import { validateSchemaShape } from '../../utils/schemaValidation'
import { propertyTypeRegistry } from './PropertyTypeRegistry'

const SchemaEditor = ({ 
  schema, 
  onChange, 
  onValidate,
  className = "",
  showPreview = true,
  showJsonView = true 
}) => {
  const [properties, setProperties] = useState([])
  const [viewMode, setViewMode] = useState('visual') // 'visual', 'json', 'preview'
  const [jsonError, setJsonError] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Convert JSON Schema to internal properties format
  const convertSchemaToProperties = useCallback((inputSchema) => {
    if (!inputSchema || !inputSchema.properties) return []

    const schemaProps = inputSchema.properties
    const required = inputSchema.required || []
    const propertyOrder = inputSchema.propertyOrder || []

    const convertedProperties = []

    // Use propertyOrder if available, otherwise use object key order
    const orderedKeys = propertyOrder.length > 0 
      ? propertyOrder 
      : Object.keys(schemaProps)

    orderedKeys.forEach((key, index) => {
      if (schemaProps[key]) {
        const prop = schemaProps[key]
        convertedProperties.push({
          id: `prop-${index}-${key}`,
          key,
          title: prop.title || '',
          description: prop.description || '',
          type: prop.type || 'string',
          required: required.includes(key),
          component: prop.component || 'TextInput',
          group: prop.group || 'Basic',
          order: prop.order || index,
          default: prop.default,
          // Copy all other schema properties
          ...prop,
          // Ensure we don't override the converted values
          key,
          title: prop.title || '',
          description: prop.description || ''
        })
      }
    })

    return convertedProperties
  }, [])

  // Convert internal properties to JSON Schema format
  const convertPropertiesToSchema = useCallback((inputProperties) => {
    const newSchema = {
      type: 'object',
      properties: {},
      propertyOrder: [],
      required: []
    }

    inputProperties.forEach(prop => {
      const { id, key, required, ...schemaProp } = prop
      
      if (key && key.trim()) {
        // Clean up the property by removing undefined values
        const cleanedProp = {}
        Object.entries(schemaProp).forEach(([propKey, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            cleanedProp[propKey] = value
          }
        })

        newSchema.properties[key] = cleanedProp
        newSchema.propertyOrder.push(key)
        
        if (required) {
          newSchema.required.push(key)
        }
      }
    })

    return newSchema
  }, [])

  // Initialize properties from schema
  useEffect(() => {
    const convertedProperties = convertSchemaToProperties(schema)
    setProperties(convertedProperties)
    setHasUnsavedChanges(false)
  }, [schema, convertSchemaToProperties])

  // Handle properties change
  const handlePropertiesChange = useCallback((newProperties) => {
    setProperties(newProperties)
    setHasUnsavedChanges(true)
    
    // Convert to schema and trigger onChange
    const newSchema = convertPropertiesToSchema(newProperties)
    
    // Validate schema if validation function provided
    if (onValidate) {
      const validation = onValidate(newSchema)
      if (!validation.valid) {
        console.warn('Schema validation failed:', validation.errors)
      }
    }
    
    onChange(newSchema)
  }, [convertPropertiesToSchema, onChange, onValidate])

  // Handle JSON view changes
  const handleJsonChange = useCallback((jsonValue) => {
    try {
      const parsed = JSON.parse(jsonValue)
      const { valid, reason } = validateSchemaShape(parsed)
      
      if (!valid) {
        setJsonError(reason || 'Invalid schema shape')
        return
      }
      
      setJsonError('')
      const convertedProperties = convertSchemaToProperties(parsed)
      setProperties(convertedProperties)
      setHasUnsavedChanges(true)
      onChange(parsed)
    } catch (err) {
      setJsonError('Invalid JSON syntax')
    }
  }, [convertSchemaToProperties, onChange])

  // Reset to original schema
  const handleReset = useCallback(() => {
    const convertedProperties = convertSchemaToProperties(schema)
    setProperties(convertedProperties)
    setHasUnsavedChanges(false)
  }, [schema, convertSchemaToProperties])

  const generatedSchema = JSON.stringify(convertPropertiesToSchema(properties), null, 2)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">Schema Editor</h3>
          {hasUnsavedChanges && (
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
              Unsaved changes
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'visual' 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Edit className="w-4 h-4" />
              <span>Visual</span>
            </button>
            
            {showJsonView && (
              <button
                type="button"
                onClick={() => setViewMode('json')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'json' 
                    ? 'bg-white text-blue-700 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Code className="w-4 h-4" />
                <span>JSON</span>
              </button>
            )}
            
            {showPreview && (
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'preview' 
                    ? 'bg-white text-blue-700 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>Preview</span>
              </button>
            )}
          </div>

          {/* Reset button */}
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              title="Reset to original"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'visual' && (
        <PropertyList
          properties={properties}
          onChange={handlePropertiesChange}
        />
      )}

      {viewMode === 'json' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              JSON Schema
            </label>
            <textarea
              className={`w-full h-96 border rounded-lg px-3 py-2 font-mono text-sm resize-y ${
                jsonError ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              value={generatedSchema}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder="Enter JSON Schema..."
            />
            {jsonError && (
              <div className="text-red-600 text-sm mt-2 flex items-start space-x-1">
                <span className="text-red-500 mt-0.5">⚠</span>
                <span>{jsonError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'preview' && (
        <div className="space-y-4">
          <div className="text-sm font-medium text-gray-700 mb-4">
            Form Preview
          </div>
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <div className="text-center text-gray-500">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Form preview will be implemented in Phase 4</p>
              <p className="text-xs">This will show how the form will appear to users</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SchemaEditor
