/**
 * PropertyList - Property List Manager Component
 * 
 * Manages the list of properties in the schema editor.
 * Handles property addition, deletion, reordering, and updates.
 */

import React, { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import PropertyItem from './PropertyItem'
import PropertyTypeSelector from './PropertyTypeSelector'
import { propertyTypeRegistry } from './PropertyTypeRegistry'
import { validateFieldName } from '../../utils/schemaValidation'

const PropertyList = ({ properties = [], onChange }) => {
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)

  // Generate unique property key
  const generateUniqueKey = useCallback((baseName, existingKeys = []) => {
    let uniqueKey = baseName
    let counter = 1
    
    while (existingKeys.includes(uniqueKey)) {
      uniqueKey = `${baseName}${counter}`
      counter++
    }
    
    return uniqueKey
  }, [])

  // Handle adding new property
  const handleAddProperty = useCallback((propertyTypeKey) => {
    const propertyType = propertyTypeRegistry.getPropertyType(propertyTypeKey)
    if (!propertyType) {
      console.error(`Property type '${propertyTypeKey}' not found`)
      return
    }

    // Generate unique key based on property type label
    const baseKey = propertyType.label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
      .join('')

    const existingKeys = properties.map(p => p.key).filter(Boolean)
    const uniqueKey = generateUniqueKey(baseKey, existingKeys)

    const newProperty = {
      id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      key: uniqueKey,
      title: propertyType.label,
      ...propertyType.defaultConfig,
      required: false,
      order: properties.length
    }

    const updatedProperties = [...properties, newProperty]
    onChange(updatedProperties)
  }, [properties, onChange, generateUniqueKey])

  // Handle property update
  const handleUpdateProperty = useCallback((index, updatedProperty) => {
    const updatedProperties = [...properties]
    updatedProperties[index] = {
      ...updatedProperty,
      id: properties[index].id // Preserve ID
    }
    onChange(updatedProperties)
  }, [properties, onChange])

  // Handle property deletion
  const handleDeleteProperty = useCallback((index) => {
    const updatedProperties = properties.filter((_, i) => i !== index)
    onChange(updatedProperties)
  }, [properties, onChange])

  // Handle property reordering
  const handleMoveProperty = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= properties.length) {
      return
    }

    const updatedProperties = [...properties]
    const [movedProperty] = updatedProperties.splice(fromIndex, 1)
    updatedProperties.splice(toIndex, 0, movedProperty)
    
    // Update order values
    updatedProperties.forEach((prop, index) => {
      prop.order = index
    })

    onChange(updatedProperties)
  }, [properties, onChange])

  // Drag and drop handlers
  const handleDragStart = useCallback((e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target.outerHTML)
  }, [])

  const handleDragOver = useCallback((e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDragLeave = useCallback((e) => {
    // Only clear if we're leaving the entire drop zone
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null)
    }
  }, [])

  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault()
    
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      handleMoveProperty(draggedIndex, dropIndex)
    }
    
    setDraggedIndex(null)
    setDragOverIndex(null)
  }, [draggedIndex, handleMoveProperty])

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }, [])

  // Validate all properties
  const validateProperties = useCallback(() => {
    const errors = []
    const keys = new Set()
    
    properties.forEach((prop, index) => {
      // Check for valid key
      if (!prop.key || !validateFieldName(prop.key)) {
        errors.push(`Property ${index + 1}: Invalid key format`)
      }
      
      // Check for duplicate keys
      if (prop.key && keys.has(prop.key)) {
        errors.push(`Property ${index + 1}: Duplicate key '${prop.key}'`)
      }
      
      if (prop.key) {
        keys.add(prop.key)
      }
      
      // Check for required title
      if (!prop.title || !prop.title.trim()) {
        errors.push(`Property ${index + 1}: Title is required`)
      }
    })
    
    return errors
  }, [properties])

  const validationErrors = validateProperties()

  if (properties.length === 0) {
    return (
      <div className="space-y-6">
        {/* Add property button */}
        <div className="flex justify-end">
          <PropertyTypeSelector onAddProperty={handleAddProperty} />
        </div>

        {/* Empty state */}
        <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-xl">
          <div className="text-gray-600 text-lg mb-2">No properties defined yet</div>
          <div className="text-gray-500 text-sm">Add your first property to start building your schema</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Add property button */}
      <div className="flex justify-end">
        <PropertyTypeSelector onAddProperty={handleAddProperty} />
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800 font-medium mb-2">Schema Validation Errors:</div>
          <ul className="text-red-700 text-sm space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index} className="flex items-start space-x-1">
                <span className="text-red-500 mt-0.5">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Property list */}
      <div className="space-y-4">
        {properties.map((property, index) => (
          <div
            key={property.id}
            className={`transition-all duration-200 ${
              draggedIndex === index ? 'opacity-50' : ''
            } ${
              dragOverIndex === index ? 'transform scale-105' : ''
            }`}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            <PropertyItem
              property={property}
              index={index}
              totalCount={properties.length}
              allProperties={properties}
              onUpdate={(updatedProperty) => handleUpdateProperty(index, updatedProperty)}
              onDelete={() => handleDeleteProperty(index)}
              onMoveUp={() => handleMoveProperty(index, index - 1)}
              onMoveDown={() => handleMoveProperty(index, index + 1)}
            />
          </div>
        ))}
      </div>

      {/* Properties summary */}
      <div className="text-sm text-gray-500 text-center">
        {properties.length} {properties.length === 1 ? 'property' : 'properties'} defined
        {properties.filter(p => p.required).length > 0 && (
          <span> • {properties.filter(p => p.required).length} required</span>
        )}
      </div>
    </div>
  )
}

export default PropertyList
