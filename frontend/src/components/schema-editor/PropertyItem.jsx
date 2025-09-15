import React, { useState } from 'react'
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { getPropertyTypeByComponent, getAllPropertyTypes } from './PropertyTypeRegistry'
import PropertyIcon from './components/PropertyIcon'
import PropertyActions from './components/PropertyActions'
import PropertyPreview from './components/PropertyPreview'
import GenericPropertyConfig from './property-configs/GenericPropertyConfig'

/**
 * PropertyItem Component
 * 
 * Individual property wrapper component that dynamically loads
 * the appropriate configuration component based on the property type.
 */
export default function PropertyItem({
  property,
  index,
  totalCount,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  errors = {}
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Get the appropriate config component for this property type
  const propertyType = getPropertyTypeByComponent(property.component)
  const ConfigComponent = propertyType?.component || GenericPropertyConfig

  // Validation errors for this property
  const propertyErrors = Object.keys(errors)
    .filter(key => key.startsWith(`property-${index}-`) || key === property.key)
    .reduce((acc, key) => {
      const fieldName = key.replace(`property-${index}-`, '')
      acc[fieldName] = errors[key]
      return acc
    }, {})

  const hasErrors = Object.keys(propertyErrors).length > 0
  const isValid = property.key && property.title && !hasErrors

  const handlePropertyChange = (updatedProperty) => {
    onChange(updatedProperty)
  }

  const handleDuplicate = () => {
    if (onDuplicate) {
      // Create a copy with a unique key
      const duplicatedProperty = {
        ...property,
        key: `${property.key}_copy`,
        title: `${property.title} (Copy)`,
        _id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
      onDuplicate(duplicatedProperty)
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Property Header */}
      <div
        className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 rounded-t-xl ${isExpanded ? 'border-b border-gray-200' : ''
          }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Property Icon */}
          <div className="flex-shrink-0">
            <div className={`p-2 rounded-lg ${isValid ? 'bg-blue-50' : 'bg-red-50'}`}>
              <PropertyIcon
                component={property.component}
                className={`w-5 h-5 ${isValid ? 'text-blue-600' : 'text-red-600'}`}
              />
            </div>
          </div>

          {/* Property Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <div className="font-semibold text-gray-900 truncate">
                {property.title && property.key
                  ? `${property.title} (${property.key})`
                  : property.title || property.key || 'Unnamed Property'
                }
              </div>

              {/* Status Indicators */}
              <div className="flex items-center space-x-1">
                {property.required && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    Required
                  </span>
                )}
                {hasErrors && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Error
                  </span>
                )}
                {isValid && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    Valid
                  </span>
                )}
              </div>
            </div>

            <div className="text-sm text-gray-500 truncate">
              {propertyType?.label || property.component}
              {property.description && ` • ${property.description}`}
            </div>
          </div>
        </div>

        {/* Actions and Expand Toggle */}
        <div className="flex items-center space-x-2">
          <PropertyActions
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDelete={onDelete}
            onDuplicate={handleDuplicate}
            canMoveUp={index > 0}
            canMoveDown={index < totalCount - 1}
            showDuplicate={true}
          />

          <div className="text-gray-400 ml-2">
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Expanded Configuration */}
      {isExpanded && (
        <div className="px-4 py-4 bg-gray-50">
          {/* Error Display */}
          {hasErrors && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-start">
                <AlertCircle className="w-4 h-4 text-red-600 mr-2 mt-0.5" />
                <div className="text-sm text-red-800">
                  <div className="font-medium">Property Configuration Errors:</div>
                  <ul className="mt-1 list-disc list-inside">
                    {Object.entries(propertyErrors).map(([field, error]) => (
                      <li key={field}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Property Configuration Component */}
          <ConfigComponent
            property={property}
            onChange={handlePropertyChange}
            errors={propertyErrors}
            onValidate={(isValid) => {
              // TODO: Handle validation feedback
            }}
          />

          {/* Property Preview */}
          <PropertyPreview
            property={property}
            isVisible={showPreview}
            onToggle={() => setShowPreview(!showPreview)}
          />
        </div>
      )}
    </div>
  )
}