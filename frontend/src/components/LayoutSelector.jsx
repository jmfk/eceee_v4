/**
 * Layout Selector Component
 * 
 * A reusable component for selecting code-based layouts in forms.
 */

import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Code, Search, X } from 'lucide-react'
import { layoutsApi } from '../api/layouts'

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
    const [dropdownPosition, setDropdownPosition] = useState({ openUpward: false, maxHeight: 384 })
    const containerRef = useRef(null)

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

    // Calculate dropdown position when opening
    const calculateDropdownPosition = () => {
        if (!containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const spaceBelow = viewportHeight - rect.bottom
        const spaceAbove = rect.top

        // Use consistent height to avoid unpredictable behavior
        const dropdownHeight = 320 // Fixed height for predictability

        // Determine if we should open upward
        const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

        setDropdownPosition({
            openUpward: shouldOpenUpward,
            maxHeight: dropdownHeight
        })
    }

    // Calculate position when dropdown opens and handle click outside
    useEffect(() => {
        if (isOpen) {
            calculateDropdownPosition()

            // Handle resize
            const handleResize = () => {
                // Small delay to ensure resize is complete
                setTimeout(calculateDropdownPosition, 10)
            }

            // Handle click outside to close dropdown
            const handleClickOutside = (event) => {
                if (containerRef.current && !containerRef.current.contains(event.target)) {
                    setIsOpen(false)
                }
            }

            window.addEventListener('resize', handleResize)
            document.addEventListener('mousedown', handleClickOutside)

            return () => {
                window.removeEventListener('resize', handleResize)
                document.removeEventListener('mousedown', handleClickOutside)
            }
        }
    }, [isOpen])

    const handleSelect = (option) => {
        onChange(option.value)
        setIsOpen(false)
        setSearchTerm('')
    }

    const handleClear = (e) => {
        e.stopPropagation()
        onChange('')
        setSelectedLayout(null)
        setIsOpen(false)
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
                    <div className="text-sm font-medium text-gray-900 truncate">
                        {option.label}
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Code
                    </span>
                </div>
                {showDescription && option.description && (
                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {option.description}
                    </div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                    {option.layout.slotConfiguration?.slots?.length || 0} slots
                </div>
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
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Description */}
            {description && (
                <div className="text-sm text-gray-600 mb-2">{description}</div>
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
                                    <div className="text-sm text-gray-900 truncate">
                                        {selectedLayout.label}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate">
                                        Code Layout
                                    </div>
                                </div>
                            </>
                        ) : (
                            <span className="text-gray-500">{placeholder}</span>
                        )}
                    </div>

                    {/* Dropdown arrow */}
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    </span>
                </button>

                {/* Clear button - moved outside main button */}
                {allowClear && selectedLayout && !disabled && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute inset-y-0 right-8 flex items-center pr-2 hover:text-gray-700 z-10"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                )}

                {/* Dropdown */}
                {isOpen && (
                    <div
                        className={`absolute z-10 w-full bg-white shadow-lg rounded-md py-1 text-base ring-1 ring-black/5 overflow-auto focus:outline-none sm:text-sm ${dropdownPosition.openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                        style={{ maxHeight: `${dropdownPosition.maxHeight}px` }}
                    >
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
                                <div className="text-sm text-gray-500 mt-2">Loading layouts...</div>
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
                                        <div className="text-sm text-gray-500">
                                            {searchTerm ? 'No layouts found matching your search' : 'No layouts available'}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom spacer when dropdown is open downward - ensures scrollable space */}
            {isOpen && !dropdownPosition.openUpward && (
                <div style={{ height: '350px' }} />
            )}

        </div>
    )
}

export default LayoutSelector 