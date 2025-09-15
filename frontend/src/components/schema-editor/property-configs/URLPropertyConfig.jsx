/**
 * URLPropertyConfig - URL Field Property Configuration Component
 * 
 * Specialized configuration component for URL/link input properties.
 * Handles URL-specific options like validation, protocol requirements, etc.
 */

import React, { useCallback } from 'react'
import { validateFieldName } from '../../../utils/schemaValidation'

const URLPropertyConfig = ({ 
  property, 
  onChange, 
  onValidate,
  allProperties = [] 
}) => {
  // Handle field changes
  const handleChange = useCallback((field, value) => {
    const updated = { ...property, [field]: value }
    
    // Ensure URI format is set
    if (field !== 'format') {
      updated.format = 'uri'
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

      {/* URL Field Options */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">URL Field Options</h4>
        
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
            placeholder="https://example.com"
          />
        </div>

        {/* Default Value */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Value
          </label>
          <input
            type="url"
            value={property.default || ''}
            onChange={(e) => handleChange('default', e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 transition-colors"
            placeholder="https://example.com"
          />
        </div>

        {/* Protocol Requirements */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Protocol Requirements
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={`protocol-${property.id}`}
                checked={!property.allowedProtocols || property.allowedProtocols.includes('http') && property.allowedProtocols.includes('https')}
                onChange={() => handleChange('allowedProtocols', ['http', 'https'])}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">HTTP and HTTPS</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={`protocol-${property.id}`}
                checked={property.allowedProtocols && property.allowedProtocols.length === 1 && property.allowedProtocols.includes('https')}
                onChange={() => handleChange('allowedProtocols', ['https'])}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">HTTPS only (secure)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={`protocol-${property.id}`}
                checked={property.allowedProtocols && property.allowedProtocols.includes('ftp')}
                onChange={() => handleChange('allowedProtocols', ['http', 'https', 'ftp'])}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">HTTP, HTTPS, and FTP</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name={`protocol-${property.id}`}
                checked={property.allowedProtocols === null}
                onChange={() => handleChange('allowedProtocols', null)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Any protocol</span>
            </label>
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
            placeholder="example.com, *.github.io"
          />
          <div className="text-xs text-gray-500 mt-1">
            Comma-separated list of allowed domains. Use * for wildcards. Leave empty to allow all domains.
          </div>
        </div>

        {/* URL Validation Options */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Validation Options
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={property.requireProtocol !== false}
                onChange={(e) => handleChange('requireProtocol', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Require protocol (http://, https://, etc.)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={property.validateUrl !== false}
                onChange={(e) => handleChange('validateUrl', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Validate URL format</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={property.checkReachability || false}
                onChange={(e) => handleChange('checkReachability', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Check if URL is reachable (slower validation)</span>
            </label>
          </div>
        </div>

        {/* Display Options */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Display Options
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={property.showPreview || false}
                onChange={(e) => handleChange('showPreview', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Show link preview</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={property.openInNewTab !== false}
                onChange={(e) => handleChange('openInNewTab', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Open links in new tab</span>
            </label>
          </div>
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

export default URLPropertyConfig
