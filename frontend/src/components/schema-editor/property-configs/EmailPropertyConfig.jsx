/**
 * EmailPropertyConfig - Email Field Property Configuration Component
 * 
 * Specialized configuration component for email input properties.
 * Handles email-specific options like validation, placeholder, etc.
 */

import React, { useCallback } from 'react'
import { validateFieldName } from '../../../utils/schemaValidation'

const EmailPropertyConfig = ({ 
  property, 
  onChange, 
  onValidate,
  allProperties = [] 
}) => {
  // Handle field changes
  const handleChange = useCallback((field, value) => {
    const updated = { ...property, [field]: value }
    
    // Ensure email format is set
    if (field !== 'format') {
      updated.format = 'email'
    }
    
    onChange(updated)
    
    if (onValidate) {
      onValidate(updated)
    }
  }, [property, onChange, onValidate])

  // Check if key is unique
  const isKeyUnique = useCallback((key) => {
    if (!key) return true
    return !allProperties.some(prop => prop.key === key && prop.id !== property.id)
  }, [allProperties, property.id])

  const keyError = property.key && (!validateFieldName(property.key) || !isKeyUnique(property.key))

  return (
    <div className="space-y-4">
      {/* Basic Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Property Key *
          </label>
          <input
            type="text"
            value={property.key || ''}
            onChange={(e) => handleChange('key', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
            className={`w-full border rounded-lg px-3 py-2 text-sm transition-colors ${
              keyError ? 'border-red-300 bg-red-50' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="propertyName"
            required
          />
          {property.key && !validateFieldName(property.key) && (
            <div className="text-red-500 text-xs mt-1">
              Key must be camelCase (start with lowercase letter, followed by letters and numbers only)
            </div>
          )}
          {property.key && validateFieldName(property.key) && !isKeyUnique(property.key) && (
            <div className="text-red-500 text-xs mt-1">
              Property key "{property.key}" already exists. Please choose a unique name.
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Label *
          </label>
          <input
            type="text"
            value={property.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            placeholder="Display Name"
            required
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <input
          type="text"
          value={property.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
            }
          }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
          placeholder="Help text for this field"
        />
      </div>

      {/* Email Field Options */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Email Field Options</h4>
        
        {/* Placeholder */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Placeholder Text
          </label>
          <input
            type="text"
            value={property.placeholder || ''}
            onChange={(e) => handleChange('placeholder', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            placeholder="Enter email address..."
          />
        </div>

        {/* Default Value */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Value
          </label>
          <input
            type="email"
            value={property.default || ''}
            onChange={(e) => handleChange('default', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            placeholder="user@example.com"
          />
        </div>

        {/* Validation Options */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Validation
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={property.strictValidation !== false}
                onChange={(e) => handleChange('strictValidation', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Strict email validation</span>
            </label>
            <div className="text-xs text-gray-500 ml-6">
              Uses RFC 5322 compliant validation for email addresses
            </div>
          </div>
        </div>

        {/* Domain Restrictions */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Allowed Domains (Optional)
          </label>
          <input
            type="text"
            value={property.allowedDomains || ''}
            onChange={(e) => handleChange('allowedDomains', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            placeholder="example.com, company.org"
          />
          <div className="text-xs text-gray-500 mt-1">
            Comma-separated list of allowed email domains. Leave empty to allow all domains.
          </div>
        </div>

        {/* Autocomplete */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Autocomplete
          </label>
          <select
            value={property.autocomplete || 'email'}
            onChange={(e) => handleChange('autocomplete', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
          >
            <option value="email">Email</option>
            <option value="username">Username</option>
            <option value="off">Disabled</option>
          </select>
        </div>
      </div>

      {/* Group and Order */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Organization</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Group
            </label>
            <select
              value={property.group || 'Special'}
              onChange={(e) => handleChange('group', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            >
              <option value="Basic">Basic</option>
              <option value="Selection">Selection</option>
              <option value="DateTime">DateTime</option>
              <option value="Media">Media</option>
              <option value="Special">Special</option>
              <option value="Advanced">Advanced</option>
              <option value="Custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order
            </label>
            <input
              type="number"
              value={property.order || ''}
              onChange={(e) => handleChange('order', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
              min="0"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Required Toggle */}
      <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
        <input
          type="checkbox"
          id={`required-${property.id}`}
          checked={property.required || false}
          onChange={(e) => handleChange('required', e.target.checked)}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor={`required-${property.id}`} className="text-sm font-medium text-gray-700">
          Required field
        </label>
      </div>
    </div>
  )
}

export default EmailPropertyConfig
