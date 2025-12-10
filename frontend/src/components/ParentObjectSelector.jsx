import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronDown, X, User, Users, ExternalLink } from 'lucide-react'
import { objectInstancesApi, objectTypesApi } from '../api/objectStorage'

const ParentObjectSelector = ({
    value,
    onChange,
    currentObjectType,
    currentObjectId = null,
    disabled = false,
    placeholder = "Search for parent object..."
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedParent, setSelectedParent] = useState(null)

    // Fetch all object types to find which ones allow this object type as child
    const { data: objectTypesResponse } = useQuery({
        queryKey: ['objectTypes', 'all'],
        queryFn: () => objectTypesApi.getActive()
    })

    // Fetch current parent object details if value exists
    const { data: currentParentResponse, isLoading: isLoadingCurrentParent } = useQuery({
        queryKey: ['objectInstance', value],
        queryFn: () => objectInstancesApi.get(value),
        enabled: !!value
    })

    const allObjectTypes = objectTypesResponse?.data || []
    const currentParent = currentParentResponse?.data

    // Find object types that allow current object type as child
    const validParentTypes = allObjectTypes.filter(type => {
        const allowedChildTypes = type.allowedChildTypes || []
        return allowedChildTypes.some(childType =>
            childType.id === currentObjectType?.id ||
            childType.name === currentObjectType?.name
        )
    })

    // Fetch potential parent objects from valid parent types
    const { data: potentialParentsResponse, isLoading } = useQuery({
        queryKey: ['objectInstances', 'potential-parents', validParentTypes.map(t => t.id).join(','), searchTerm],
        queryFn: async () => {
            if (validParentTypes.length === 0) return { data: [] }

            // Fetch objects from all valid parent types
            const promises = validParentTypes.map(type =>
                objectInstancesApi.getByType(type.name, { search: searchTerm })
            )

            const responses = await Promise.all(promises)

            // Combine all results and flatten
            const allObjects = responses.reduce((acc, response) => {
                const objects = response.data || []
                return acc.concat(objects)
            }, [])

            // Filter out current object to prevent self-parenting
            return {
                data: allObjects.filter(obj => obj.id !== currentObjectId)
            }
        },
        enabled: validParentTypes.length > 0
    })

    const potentialParents = potentialParentsResponse?.data || []

    // Update selected parent when value changes
    useEffect(() => {
        if (currentParent) {
            setSelectedParent(currentParent)
        } else if (value === null || value === undefined) {
            setSelectedParent(null)
        }
        // If value exists but currentParent is not loaded yet, don't clear selectedParent
    }, [currentParent, value, currentParentResponse])

    const handleSelect = (parent) => {
        setSelectedParent(parent)
        onChange(parent.id)
        setIsOpen(false)
        setSearchTerm('')
    }

    const handleClear = () => {
        setSelectedParent(null)
        onChange(null)
        setSearchTerm('')
    }

    const filteredParents = potentialParents.filter(parent =>
        parent.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        parent.objectType?.label?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent Object
            </label>

            {/* Loading State */}
            {value && isLoadingCurrentParent ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <div className="text-gray-600">Loading parent object...</div>
                </div>
            ) : selectedParent ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        {selectedParent.objectType?.iconImage ? (
                            <img
                                src={selectedParent.objectType.iconImage}
                                alt={selectedParent.objectType.label}
                                className="w-5 h-5 object-cover rounded"
                            />
                        ) : (
                            <User className="w-5 h-5 text-gray-400" />
                        )}
                        <div>
                            <div className="font-medium text-gray-900">{selectedParent.title}</div>
                            <div className="text-sm text-gray-500">
                                {selectedParent.objectType?.label} • ID: {selectedParent.id}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            type="button"
                            onClick={() => window.open(`/objects/${selectedParent.id}/edit/content`, '_blank')}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Open in new tab"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handleClear}
                            disabled={disabled}
                            className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                            title="Remove parent"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            disabled={disabled}
                            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            title="Change parent"
                        >
                            <ChevronDown className={`w-4 h-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </div>
            ) : (
                /* No Selection - Search Input */
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        placeholder={placeholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => setIsOpen(true)}
                        disabled={disabled}
                    />
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        disabled={disabled}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                        <ChevronDown className={`w-4 h-4 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            )}

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {/* Search input when parent is selected */}
                    {selectedParent && (
                        <div className="p-2 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Search for different parent..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}

                    {/* Loading state */}
                    {isLoading && (
                        <div className="p-4 text-center text-gray-500">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto"></div>
                            <div className="mt-2 text-sm">Loading potential parents...</div>
                        </div>
                    )}

                    {/* No valid parent types */}
                    {!isLoading && validParentTypes.length === 0 && (
                        <div className="p-4 text-center text-gray-500">
                            <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <div className="text-sm">No object types allow {currentObjectType?.label} as sub-objects</div>
                            <div className="text-xs text-gray-400 mt-1">
                                Configure allowedChildTypes in object type settings
                            </div>
                        </div>
                    )}

                    {/* No results */}
                    {!isLoading && validParentTypes.length > 0 && filteredParents.length === 0 && (
                        <div className="p-4 text-center text-gray-500">
                            <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <div className="text-sm">No matching objects found</div>
                            {searchTerm && (
                                <div className="text-xs text-gray-400 mt-1">
                                    Try a different search term
                                </div>
                            )}
                        </div>
                    )}

                    {/* Results */}
                    {!isLoading && filteredParents.map((parent) => (
                        <button
                            key={parent.id}
                            type="button"
                            onClick={() => handleSelect(parent)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                        >
                            <div className="flex items-center space-x-3">
                                {parent.objectType?.iconImage ? (
                                    <img
                                        src={parent.objectType.iconImage}
                                        alt={parent.objectType.label}
                                        className="w-6 h-6 object-cover rounded"
                                    />
                                ) : (
                                    <User className="w-6 h-6 text-gray-400" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">{parent.title}</div>
                                    <div className="text-sm text-gray-500 truncate">
                                        {parent.objectType?.label} • Level {parent.level || 0}
                                        {parent.slug && ` • /${parent.slug}`}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}

                    {/* Clear option */}
                    {selectedParent && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="w-full px-4 py-3 text-left hover:bg-red-50 focus:bg-red-50 focus:outline-none border-t border-gray-200 text-red-600"
                        >
                            <div className="flex items-center space-x-3">
                                <X className="w-6 h-6" />
                                <div>Remove parent (make root level)</div>
                            </div>
                        </button>
                    )}
                </div>
            )}

            {/* Click outside to close */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Help text */}
            <div className="text-gray-500 text-sm mt-2">
                {validParentTypes.length > 0 ? (
                    <>
                        Can be a child of: {validParentTypes.map(type => type.label).join(', ')}
                    </>
                ) : (
                    <>
                        No parent types configured for {currentObjectType?.label}
                    </>
                )}
            </div>
        </div>
    )
}

export default ParentObjectSelector
