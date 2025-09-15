import React, { useState, useEffect } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { getAllPropertyTypes, isPropertyRegistryInitialized } from './PropertyTypeRegistry'
import PropertyIcon from './components/PropertyIcon'

/**
 * PropertyTypeSelector Component
 * 
 * Allows users to select and add new property types to the schema.
 * Dynamically loads available property types from the registry.
 */
export default function PropertyTypeSelector({
  onAddProperty,
  existingProperties = [],
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [propertyTypes, setPropertyTypes] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [loading, setLoading] = useState(true)

  // Load property types when component mounts
  useEffect(() => {
    const loadPropertyTypes = () => {
      if (isPropertyRegistryInitialized()) {
        const types = getAllPropertyTypes()
        setPropertyTypes(types)
        setLoading(false)
      } else {
        // Registry not initialized yet, check again in a bit
        setTimeout(loadPropertyTypes, 100)
      }
    }

    loadPropertyTypes()
  }, [])

  // Get unique categories from property types
  const categories = [
    { value: 'all', label: 'All Types' },
    ...Array.from(new Set(propertyTypes.map(type => type.category)))
      .map(category => ({
        value: category,
        label: category.charAt(0).toUpperCase() + category.slice(1)
      }))
  ]

  // Filter property types based on search and category
  const filteredTypes = propertyTypes.filter(type => {
    const matchesSearch = !searchTerm ||
      type.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = selectedCategory === 'all' || type.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const handleAddProperty = (propertyType) => {
    // Generate unique key
    let baseKey = propertyType.key
    let uniqueKey = baseKey
    let counter = 1

    const existingKeys = new Set(existingProperties.map(prop => prop.key))

    while (existingKeys.has(uniqueKey)) {
      uniqueKey = `${baseKey}${counter}`
      counter++
    }

    // Create new property with default configuration
    const newProperty = {
      ...propertyType.defaultConfig,
      key: uniqueKey,
      title: propertyType.label,
      _id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    onAddProperty(newProperty)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleClose = () => {
    setIsOpen(false)
    setSearchTerm('')
    setSelectedCategory('all')
  }

  if (loading) {
    return (
      <button
        type="button"
        disabled
        className="flex items-center space-x-2 bg-gray-300 text-gray-500 px-6 py-2.5 rounded-lg font-medium text-sm cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
        <span>Loading...</span>
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
        <span>Add Property</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={handleClose}
          />

          {/* Property Type Selector Modal */}
          <div className="absolute top-full left-0 right-0 mx-auto mt-3 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-96 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg font-semibold text-gray-900">Add Property</div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search property types..."
                />
              </div>

              {/* Category Filter */}
              <div className="mt-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Property Types List */}
            <div className="flex-1 overflow-y-auto">
              {filteredTypes.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchTerm ? 'No property types match your search.' : 'No property types available.'}
                </div>
              ) : (
                <div className="p-2">
                  {filteredTypes.map((propertyType) => (
                    <button
                      type="button"
                      key={propertyType.key}
                      onClick={() => handleAddProperty(propertyType)}
                      className="w-full flex items-start space-x-3 p-3 rounded-lg hover:bg-blue-50 text-left transition-colors group"
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0">
                        <div className="p-2 bg-gray-100 group-hover:bg-blue-100 rounded-lg transition-colors">
                          <PropertyIcon
                            propertyType={propertyType.key}
                            className="w-5 h-5 text-gray-600 group-hover:text-blue-600"
                          />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {propertyType.label}
                          </div>
                          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {propertyType.category}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {propertyType.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <div className="text-xs text-gray-600 text-center">
                {filteredTypes.length} of {propertyTypes.length} property types
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}