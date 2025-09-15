/**
 * PropertyTypeSelector - Property Type Picker Component
 * 
 * Provides an interface for selecting property types when adding new properties.
 * Shows property types grouped by category with icons and descriptions.
 */

import React, { useState, useRef, useEffect } from 'react'
import { Plus, X, Search } from 'lucide-react'
import { propertyTypeRegistry } from './PropertyTypeRegistry'

const PropertyTypeSelector = ({ onAddProperty, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)

  // Get property types grouped by category
  const propertyTypesByCategory = propertyTypeRegistry.getPropertyTypesByCategory()
  const allPropertyTypes = propertyTypeRegistry.getAllPropertyTypes()

  // Filter property types based on search term
  const filteredPropertyTypes = React.useMemo(() => {
    let types = allPropertyTypes

    // Filter by search term
    if (searchTerm) {
      types = types.filter(type => 
        type.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      types = types.filter(type => type.category === selectedCategory)
    }

    // Group filtered types by category
    const grouped = {}
    types.forEach(type => {
      const category = type.category || 'Other'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(type)
    })

    return grouped
  }, [allPropertyTypes, searchTerm, selectedCategory])

  // Get available categories
  const categories = React.useMemo(() => {
    const cats = ['all', ...Object.keys(propertyTypesByCategory)]
    return cats
  }, [propertyTypesByCategory])

  // Handle property type selection
  const handleSelectPropertyType = (propertyTypeKey) => {
    onAddProperty(propertyTypeKey)
    setIsOpen(false)
    setSearchTerm('')
    setSelectedCategory('all')
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => {
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [isOpen])

  return (
    <div className={`relative ${className}`}>
      {/* Add Property Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md font-medium text-sm"
      >
        <Plus className="w-4 h-4" />
        <span>Add Property</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-2 w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-96 overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Select Property Type</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search property types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors ${
                    selectedCategory === category
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category === 'all' ? 'All' : category}
                </button>
              ))}
            </div>
          </div>

          {/* Property Types List */}
          <div className="max-h-80 overflow-y-auto">
            {Object.keys(filteredPropertyTypes).length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No property types found</p>
                <p className="text-xs">Try adjusting your search or category filter</p>
              </div>
            ) : (
              Object.entries(filteredPropertyTypes).map(([category, types]) => (
                <div key={category} className="border-b border-gray-100 last:border-b-0">
                  {/* Category Header */}
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                      {category}
                    </h4>
                  </div>

                  {/* Property Types */}
                  <div className="p-2">
                    {types.map((propertyType) => {
                      const Icon = propertyType.icon
                      return (
                        <button
                          key={propertyType.key}
                          onClick={() => handleSelectPropertyType(propertyType.key)}
                          className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 text-left transition-colors group"
                        >
                          <div className="p-2 bg-gray-100 group-hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0">
                            <Icon className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {propertyType.label}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {propertyType.description}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-200 bg-gray-50 text-center">
            <div className="text-xs text-gray-500">
              {allPropertyTypes.length} property types available
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}

export default PropertyTypeSelector
