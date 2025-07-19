/**
 * Layout Selector Component
 * 
 * A reusable component for selecting code-based layouts in forms.
 */

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Code, Search, X } from 'lucide-react'
import { layoutsApi, layoutUtils } from '../api/layouts'

const LayoutSelector = ({
    value = '',
    onChange,
    placeholder = 'Select a layout...',
    disabled = false,
    allowClear = true,
    className = '',
    label = 'Layout',
    description = '',
    required = false,
    showDescription = true,
    groupByType = true
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedLayout, setSelectedLayout] = useState(null)

    // Fetch code layouts
    const { data: layoutsData, isLoading } = useQuery({
        queryKey: ['layouts', 'code'],
        queryFn: () => layoutsApi.codeLayouts.list()
    })

    // Get layout options
    const getLayoutOptions = () => {
        if (!layoutsData?.results) return []

        const options = []

        // Add code layouts
        layoutsData.results.forEach(layout => {
            options.push({
                value: layout.name,
                label: layout.name,
                description: layout.description,
                type: 'code',
                layout: layout
            })
        })

        return options
    }

    // Filter options based on search
    const filteredOptions = getLayoutOptions().filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (option.description && option.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    // Group options (simplified for code-only layouts)
    const groupedOptions = { code: filteredOptions }

    // Find selected layout
    useEffect(() => {
        if (value) {
            const option = getLayoutOptions().find(opt => opt.value === value)
            setSelectedLayout(option || null)
        } else {
            setSelectedLayout(null)
        }
    }, [value, layoutsData])

    const handleSelect = (option) => {
        onChange(option.value)
        setIsOpen(false)
        setSearchTerm('')
    }

    const handleClear = (e) => {
        e.stopPropagation()
        onChange('')
        setSelectedLayout(null)
    }

    const renderOption = (option) => (
        <div
            key={option.value}
            onClick={() => handleSelect(option)}
            className="flex items-start space-x-3 p-3 hover:bg-gray-50 cursor-pointer"
        >
            <div className="flex-shrink-0 mt-0.5">
                <Code className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                        {option.label}
                    </p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Code
                    </span>
                </div>
                {showDescription && option.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {option.description}
                    </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                    {option.layout.slot_configuration?.slots?.length || 0} slots
                </p>
            </div>
        </div>
    )

    const renderGroup = (title, options, icon) => {
        if (options.length === 0) return null

        return (
            <div key={title}>
                <div className="flex items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
                    {icon}
                    <span className="text-xs font-medium text-gray-700 uppercase tracking-wide ml-2">
                        {title} ({options.length})
                    </span>
                </div>
                <div className="divide-y divide-gray-100">
                    {options.map(renderOption)}
                </div>
            </div>
        )
    }

    return (
        <div className={`relative ${className}`}>
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Description */}
            {description && (
                <p className="text-sm text-gray-600 mb-2">{description}</p>
            )}

            {/* Selector Button */}
            <div className="relative">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`relative w-full bg-white border border-gray-300 rounded-md pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${disabled ? 'bg-gray-50 text-gray-500' : ''
                        }`}
                >
                    <div className="flex items-center">
                        {selectedLayout ? (
                            <>
                                <div className="flex-shrink-0 mr-3">
                                    <Code className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-900 truncate">
                                        {selectedLayout.label}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                        Code Layout
                                    </p>
                                </div>
                            </>
                        ) : (
                            <span className="text-gray-500">{placeholder}</span>
                        )}
                    </div>

                    {/* Clear button */}
                    {allowClear && selectedLayout && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute inset-y-0 right-8 flex items-center pr-2 hover:text-gray-700"
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    )}

                    {/* Dropdown arrow */}
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    </span>
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-96 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                        {/* Search */}
                        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-3 py-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search layouts..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                />
                            </div>
                        </div>

                        {/* Loading */}
                        {isLoading && (
                            <div className="px-3 py-8 text-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                                <p className="text-sm text-gray-500 mt-2">Loading layouts...</p>
                            </div>
                        )}

                        {/* Options */}
                        {!isLoading && (
                            <>
                                {groupByType ? (
                                    <div>
                                        {renderGroup(
                                            'Code Layouts',
                                            groupedOptions.code,
                                            <Code className="w-4 h-4 text-blue-600" />
                                        )}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {filteredOptions.map(renderOption)}
                                    </div>
                                )}

                                {/* No results */}
                                {filteredOptions.length === 0 && (
                                    <div className="px-3 py-8 text-center">
                                        <p className="text-sm text-gray-500">
                                            {searchTerm ? 'No layouts found matching your search' : 'No layouts available'}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Click outside to close */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    )
}

export default LayoutSelector 