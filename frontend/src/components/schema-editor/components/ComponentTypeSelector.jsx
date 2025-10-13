import React, { useState, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { fieldTypeRegistry } from '../../../utils/fieldTypeRegistry'

/**
 * ComponentTypeSelector Component
 * 
 * A dropdown selector for choosing field component types from available
 * field types registered in the system. Supports search and grouping by category.
 */
export default function ComponentTypeSelector({
    value,
    onChange,
    disabled = false,
    error = null
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [fieldTypes, setFieldTypes] = useState([])
    const [loading, setLoading] = useState(true)

    // Load field types when component mounts
    useEffect(() => {
        const loadFieldTypes = () => {
            try {
                const types = fieldTypeRegistry.getAllFieldTypes()
                setFieldTypes(types)
                setLoading(false)
            } catch (error) {
                console.error('Failed to load field types:', error)
                setLoading(false)
            }
        }

        loadFieldTypes()
    }, [])

    // Find the selected field type
    const selectedType = fieldTypes.find(ft => ft.key === value)

    // Group field types by category
    const groupedTypes = fieldTypes.reduce((acc, type) => {
        const category = type.category || 'other'
        if (!acc[category]) {
            acc[category] = []
        }
        acc[category].push(type)
        return acc
    }, {})

    // Filter types based on search term
    const filteredGroups = Object.entries(groupedTypes).reduce((acc, [category, types]) => {
        const filtered = types.filter(type =>
            !searchTerm ||
            type.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            type.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (type.description && type.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        if (filtered.length > 0) {
            acc[category] = filtered
        }
        return acc
    }, {})

    const handleSelect = (typeKey) => {
        onChange(typeKey)
        setIsOpen(false)
        setSearchTerm('')
    }

    const handleClose = () => {
        setIsOpen(false)
        setSearchTerm('')
    }

    if (loading) {
        return (
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                Loading field types...
            </div>
        )
    }

    return (
        <div className="relative">
            {/* Selector Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-3 py-2 border rounded-md text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${error ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                    } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-gray-400'}`}
            >
                <span className={selectedType ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedType ? selectedType.label : 'Select component type...'}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
            </button>

            {error && (
                <div className="text-red-500 text-xs mt-1">{error}</div>
            )}

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={handleClose}
                    />

                    {/* Dropdown Menu */}
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-96 flex flex-col">
                        {/* Search */}
                        <div className="p-3 border-b border-gray-200">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Search component types..."
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>

                        {/* Options List */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {Object.keys(filteredGroups).length === 0 ? (
                                <div className="p-3 text-center text-gray-500 text-sm">
                                    No component types match your search.
                                </div>
                            ) : (
                                Object.entries(filteredGroups).map(([category, types]) => (
                                    <div key={category} className="mb-3 last:mb-0">
                                        {/* Category Header */}
                                        <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            {category}
                                        </div>

                                        {/* Category Items */}
                                        <div className="space-y-0.5">
                                            {types.map((type) => (
                                                <button
                                                    key={type.key}
                                                    type="button"
                                                    onClick={() => handleSelect(type.key)}
                                                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${value === type.key
                                                            ? 'bg-blue-50 text-blue-900'
                                                            : 'hover:bg-gray-50 text-gray-900'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm truncate">
                                                                {type.label}
                                                            </div>
                                                            {type.description && (
                                                                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                                                    {type.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {value === type.key && (
                                                            <div className="ml-2 flex-shrink-0">
                                                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-400 mt-1 font-mono">
                                                        {type.key}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-2 border-t border-gray-200 bg-gray-50">
                            <div className="text-xs text-gray-600 text-center">
                                {Object.values(filteredGroups).flat().length} of {fieldTypes.length} types
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

