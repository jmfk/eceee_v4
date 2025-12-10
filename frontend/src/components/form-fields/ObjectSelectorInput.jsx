import React, { useState } from 'react'
import { Database, Search, X, AlertCircle } from 'lucide-react'

/**
 * ObjectSelectorInput Component
 * 
 * Object selection component for selecting objects from the system.
 * Currently a placeholder implementation until proper object API integration.
 */
const ObjectSelectorInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    multiple = false,
    searchable = true,
    objectType = null, // Filter by specific object type
    placeholder,
    ...props
}) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [isSearching, setIsSearching] = useState(false)

    // Mock objects data - replace with actual API call
    const mockObjects = [
        { id: 1, title: 'Sample Article', type: 'Article', status: 'published' },
        { id: 2, title: 'Product Demo', type: 'Product', status: 'draft' },
        { id: 3, title: 'News Update', type: 'News', status: 'published' },
        { id: 4, title: 'Event Details', type: 'Event', status: 'published' },
    ]

    // Get validation status for styling
    const getValidationStatus = () => {
        if (isValidating) return 'validating'
        if (!validation) return 'none'
        if (validation.errors?.length > 0) return 'error'
        if (validation.warnings?.length > 0) return 'warning'
        return 'valid'
    }

    const validationStatus = getValidationStatus()
    const hasError = validationStatus === 'error'
    const hasWarning = validationStatus === 'warning'

    const handleObjectSelect = (object) => {
        if (multiple) {
            const currentObjects = Array.isArray(value) ? value : []
            const isAlreadySelected = currentObjects.some(o => o.id === object.id)

            if (isAlreadySelected) {
                onChange(currentObjects.filter(o => o.id !== object.id))
            } else {
                onChange([...currentObjects, object])
            }
        } else {
            onChange(object)
        }
        setSearchTerm('')
    }

    const handleRemoveObject = (objectId) => {
        if (multiple) {
            const currentObjects = Array.isArray(value) ? value : []
            onChange(currentObjects.filter(o => o.id !== objectId))
        } else {
            onChange(null)
        }
    }

    const selectedObjects = multiple ? (Array.isArray(value) ? value : []) : (value ? [value] : [])
    const filteredObjects = mockObjects.filter(object =>
        !selectedObjects.some(selected => selected.id === object.id) &&
        (!objectType || object.type === objectType) &&
        object.title.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getStatusColor = (status) => {
        switch (status) {
            case 'published': return 'bg-green-100 text-green-800'
            case 'draft': return 'bg-yellow-100 text-yellow-800'
            case 'archived': return 'bg-gray-100 text-gray-800'
            default: return 'bg-blue-100 text-blue-800'
        }
    }

    return (
        <div className="space-y-2">
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Description */}
            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* TODO Implementation Notice */}
            <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-md flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-blue-700">
                    Object selector using mock data - needs API integration
                </span>
            </div>

            {/* Object Type Filter Info */}
            {objectType && (
                <div className="text-xs text-gray-500 mb-2">
                    Filtering by object type: <span className="font-medium">{objectType}</span>
                </div>
            )}

            {/* Selected Objects */}
            {selectedObjects.length > 0 && (
                <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-700">
                        Selected Object{selectedObjects.length > 1 ? 's' : ''}:
                    </div>
                    <div className="space-y-2">
                        {selectedObjects.map(object => (
                            <div key={object.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                <div className="flex items-center space-x-2">
                                    <Database className="w-4 h-4 text-gray-600" />
                                    <div>
                                        <div className="font-medium text-gray-900">{object.title}</div>
                                        <div className="text-xs text-gray-500 flex items-center space-x-2">
                                            <span>{object.type}</span>
                                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(object.status)}`}>
                                                {object.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveObject(object.id)}
                                        className="text-gray-400 hover:text-red-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Search Input */}
            {searchable && !disabled && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={placeholder || `Search ${objectType ? objectType.toLowerCase() + 's' : 'objects'}...`}
                        className={`
                            w-full pl-10 pr-4 py-2 border rounded-md
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            ${hasError ? 'border-red-300 bg-red-50' :
                                hasWarning ? 'border-yellow-300 bg-yellow-50' :
                                    'border-gray-300 bg-white'}
                        `}
                    />
                </div>
            )}

            {/* Object Options */}
            {searchTerm && filteredObjects.length > 0 && (
                <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                    {filteredObjects.map(object => (
                        <button
                            key={object.id}
                            type="button"
                            onClick={() => handleObjectSelect(object)}
                            className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 text-left"
                        >
                            <div className="w-8 h-8 bg-gray-200 rounded-md flex items-center justify-center">
                                <Database className="w-4 h-4 text-gray-600" />
                            </div>
                            <div className="flex-1">
                                <div className="font-medium text-gray-900">{object.title}</div>
                                <div className="text-sm text-gray-500 flex items-center space-x-2">
                                    <span>{object.type}</span>
                                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(object.status)}`}>
                                        {object.status}
                                    </span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {searchTerm && filteredObjects.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                    No {objectType ? objectType.toLowerCase() + 's' : 'objects'} found matching "{searchTerm}"
                </div>
            )}

            {/* Validation Messages */}
            {hasError && validation.errors?.map((error, index) => (
                <div key={index} className="text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            ))}

            {hasWarning && validation.warnings?.map((warning, index) => (
                <div key={index} className="text-sm text-yellow-600 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{warning}</span>
                </div>
            ))}

            {/* Loading State */}
            {isValidating && (
                <div className="text-sm text-blue-600">Validating...</div>
            )}
        </div>
    )
}

ObjectSelectorInput.displayName = 'ObjectSelectorInput'

export default ObjectSelectorInput
