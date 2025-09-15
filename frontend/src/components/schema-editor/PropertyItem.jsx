/**
 * PropertyItem - Individual Property Wrapper Component
 * 
 * Wrapper component for individual properties that handles:
 * - Dynamic loading of property configuration components
 * - Property header with type icon and actions
 * - Expand/collapse functionality
 * - Property actions (move, delete)
 */

import React, { useState, useCallback, useMemo, Suspense } from 'react'
import { 
  ChevronDown, 
  ChevronRight, 
  ChevronUp, 
  Trash2, 
  GripVertical,
  Type,
  AlertCircle 
} from 'lucide-react'
import { propertyTypeRegistry } from './PropertyTypeRegistry'

// Fallback component while loading
const ConfigLoadingFallback = () => (
  <div className="flex items-center justify-center py-8">
    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    <span className="ml-2 text-sm text-gray-600">Loading configuration...</span>
  </div>
)

// Error boundary for property config components
class PropertyConfigErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Property config component error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-red-800 font-medium">Configuration Error</div>
              <div className="text-red-700 text-sm mt-1">
                Failed to load property configuration component.
              </div>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="text-red-600 text-sm underline mt-2"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Dynamic property config component loader
const DynamicPropertyConfig = ({ property, onChange, onValidate }) => {
  const [ConfigComponent, setConfigComponent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const propertyType = useMemo(() => {
    return propertyTypeRegistry.getPropertyType(property.component)
  }, [property.component])

  // Load the configuration component
  React.useEffect(() => {
    const loadConfigComponent = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const configComponentName = propertyType?.configComponent || 'GenericPropertyConfig'
        const Component = await propertyTypeRegistry.getPropertyConfigComponent(configComponentName)
        
        if (Component) {
          setConfigComponent(() => Component)
        } else {
          setError('Configuration component not found')
        }
      } catch (err) {
        console.error('Failed to load config component:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadConfigComponent()
  }, [propertyType])

  if (loading) {
    return <ConfigLoadingFallback />
  }

  if (error || !ConfigComponent) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-yellow-800 font-medium">Configuration Unavailable</div>
            <div className="text-yellow-700 text-sm mt-1">
              Using basic property configuration. {error && `Error: ${error}`}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PropertyConfigErrorBoundary>
      <ConfigComponent
        property={property}
        onChange={onChange}
        onValidate={onValidate}
      />
    </PropertyConfigErrorBoundary>
  )
}

const PropertyItem = ({ 
  property, 
  index, 
  totalCount, 
  allProperties = [],
  onUpdate, 
  onDelete, 
  onMoveUp, 
  onMoveDown 
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Get property type info
  const propertyType = useMemo(() => {
    return propertyTypeRegistry.getPropertyType(property.component)
  }, [property.component])

  const Icon = propertyType?.icon || Type

  // Handle property changes
  const handlePropertyChange = useCallback((updatedProperty) => {
    onUpdate(updatedProperty)
  }, [onUpdate])

  // Validate property
  const validateProperty = useCallback((prop) => {
    const errors = []
    
    // Basic validation
    if (!prop.key || !prop.key.trim()) {
      errors.push('Property key is required')
    }
    
    if (!prop.title || !prop.title.trim()) {
      errors.push('Property title is required')
    }
    
    // Check for duplicate keys
    const duplicateKey = allProperties.some(
      (p, i) => i !== index && p.key === prop.key
    )
    if (duplicateKey) {
      errors.push(`Property key '${prop.key}' is already used`)
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }, [allProperties, index])

  const validation = validateProperty(property)
  const hasErrors = !validation.valid

  return (
    <div className={`border rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-200 ${
      hasErrors ? 'border-red-200 bg-red-50' : 'border-gray-200'
    }`}>
      {/* Property Header */}
      <div
        className={`flex items-center justify-between p-5 cursor-pointer rounded-t-xl transition-colors ${
          hasErrors 
            ? 'hover:bg-red-100' 
            : 'hover:bg-gray-50'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-4">
          {/* Drag handle */}
          <div className="cursor-move text-gray-400 hover:text-gray-600">
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Property type icon */}
          <div className={`p-2 rounded-lg ${
            hasErrors ? 'bg-red-100' : 'bg-blue-50'
          }`}>
            <Icon className={`w-5 h-5 ${
              hasErrors ? 'text-red-600' : 'text-blue-600'
            }`} />
          </div>

          {/* Property info */}
          <div className="flex-1 min-w-0">
            <div className={`font-semibold truncate ${
              hasErrors ? 'text-red-900' : 'text-gray-900'
            }`}>
              {property.title && property.key
                ? `${property.title} (${property.key})`
                : property.title || property.key || 'Unnamed Property'
              }
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <div className="text-sm text-gray-500">
                {propertyType?.label || property.component}
              </div>
              {property.required && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                  Required
                </span>
              )}
              {hasErrors && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Errors
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {/* Move up */}
          <button
            type="button"
            onClick={(e) => { 
              e.stopPropagation() 
              onMoveUp() 
            }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Move up"
            disabled={index === 0}
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          {/* Move down */}
          <button
            type="button"
            onClick={(e) => { 
              e.stopPropagation() 
              onMoveDown() 
            }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Move down"
            disabled={index === totalCount - 1}
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={(e) => { 
              e.stopPropagation() 
              onDelete() 
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete property"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Expand/collapse indicator */}
          <div className="text-gray-400 ml-2">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </div>
        </div>
      </div>

      {/* Property Configuration */}
      {isExpanded && (
        <div className={`border-t px-5 py-4 space-y-4 ${
          hasErrors ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
        }`}>
          {/* Validation errors */}
          {hasErrors && (
            <div className="bg-red-100 border border-red-200 rounded-lg p-3">
              <div className="text-red-800 font-medium text-sm mb-1">
                Property Configuration Errors:
              </div>
              <ul className="text-red-700 text-sm space-y-1">
                {validation.errors.map((error, errorIndex) => (
                  <li key={errorIndex} className="flex items-start space-x-1">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Dynamic property configuration */}
          <Suspense fallback={<ConfigLoadingFallback />}>
            <DynamicPropertyConfig
              property={property}
              onChange={handlePropertyChange}
              onValidate={validateProperty}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
}

export default PropertyItem
