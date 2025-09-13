import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Search, ChevronDown, Plus, Loader2, Check, X } from 'lucide-react'

/**
 * ComboboxInput Component
 * 
 * Advanced combobox with async search, creatable options, and virtualized lists.
 * Supports large datasets with efficient rendering and search capabilities.
 */
const ComboboxInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Search or select...',
    options = [],
    asyncSearch = null, // Function that returns Promise<options[]>
    allowCreate = false,
    createOptionLabel = (inputValue) => `Create "${inputValue}"`,
    isLoading = false,
    loadingText = 'Loading...',
    noOptionsText = 'No options found',
    maxHeight = 200,
    itemHeight = 40,
    searchDebounce = 300,
    minSearchLength = 0,
    caseSensitive = false,
    ...props
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [asyncOptions, setAsyncOptions] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [searchTimeout, setSearchTimeout] = useState(null)

    const inputRef = useRef(null)
    const listRef = useRef(null)
    const containerRef = useRef(null)

    // Normalize options to consistent format
    const normalizeOptions = (opts) => {
        if (!Array.isArray(opts)) return []

        return opts.map((option, index) => {
            if (typeof option === 'string') {
                return { value: option, label: option, id: `option-${index}` }
            }
            if (typeof option === 'object' && option.value !== undefined) {
                return {
                    value: option.value,
                    label: option.label || option.value,
                    id: option.id || `option-${index}`,
                    ...option
                }
            }
            return { value: String(option), label: String(option), id: `option-${index}` }
        })
    }

    // Combine static and async options
    const allOptions = useMemo(() => {
        const staticOptions = normalizeOptions(options)
        const dynamicOptions = normalizeOptions(asyncOptions)

        // Merge and deduplicate
        const combined = [...staticOptions, ...dynamicOptions]
        const seen = new Set()
        return combined.filter(option => {
            if (seen.has(option.value)) return false
            seen.add(option.value)
            return true
        })
    }, [options, asyncOptions])

    // Filter options based on search term
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim() || searchTerm.length < minSearchLength) {
            return allOptions.slice(0, 100) // Limit for performance
        }

        const query = caseSensitive ? searchTerm : searchTerm.toLowerCase()

        return allOptions.filter(option => {
            const label = caseSensitive ? option.label : option.label.toLowerCase()
            const value = caseSensitive ? String(option.value) : String(option.value).toLowerCase()

            return label.includes(query) || value.includes(query)
        }).slice(0, 100)
    }, [searchTerm, allOptions, minSearchLength, caseSensitive])

    // Add create option if allowed
    const displayOptions = useMemo(() => {
        const options = [...filteredOptions]

        if (allowCreate && searchTerm.trim() &&
            !filteredOptions.some(opt => opt.value === searchTerm.trim())) {
            options.unshift({
                value: searchTerm.trim(),
                label: createOptionLabel(searchTerm.trim()),
                id: 'create-option',
                isCreateOption: true
            })
        }

        return options
    }, [filteredOptions, allowCreate, searchTerm, createOptionLabel])

    // Async search handler
    const performAsyncSearch = useCallback(async (query) => {
        if (!asyncSearch || query.length < minSearchLength) return

        setIsSearching(true)
        try {
            const results = await asyncSearch(query)
            setAsyncOptions(results || [])
        } catch (error) {
            console.error('Async search error:', error)
            setAsyncOptions([])
        } finally {
            setIsSearching(false)
        }
    }, [asyncSearch, minSearchLength])

    // Debounced search effect
    useEffect(() => {
        if (searchTimeout) {
            clearTimeout(searchTimeout)
        }

        if (searchTerm.trim() && asyncSearch) {
            const timeout = setTimeout(() => {
                performAsyncSearch(searchTerm.trim())
            }, searchDebounce)

            setSearchTimeout(timeout)
        }

        return () => {
            if (searchTimeout) {
                clearTimeout(searchTimeout)
            }
        }
    }, [searchTerm, performAsyncSearch, searchDebounce])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault()
                setIsOpen(true)
            }
            return
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, displayOptions.length - 1))
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, -1))
                break
            case 'Enter':
                e.preventDefault()
                if (selectedIndex >= 0 && displayOptions[selectedIndex]) {
                    handleOptionSelect(displayOptions[selectedIndex])
                }
                break
            case 'Escape':
                e.preventDefault()
                setIsOpen(false)
                setSearchTerm('')
                setSelectedIndex(-1)
                break
        }
    }

    const handleOptionSelect = (option) => {
        onChange(option.value)
        setIsOpen(false)
        setSearchTerm('')
        setSelectedIndex(-1)

        // Focus back to input
        inputRef.current?.focus()
    }

    const handleInputClick = () => {
        if (!disabled) {
            setIsOpen(!isOpen)
        }
    }

    // Get selected option for display
    const selectedOption = allOptions.find(opt => opt.value === value)

    return (
        <div className="space-y-1" ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="relative">
                {/* Input */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        value={isOpen ? searchTerm : (selectedOption?.label || '')}
                        onChange={(e) => {
                            setSearchTerm(e.target.value)
                            if (!isOpen) setIsOpen(true)
                        }}
                        onKeyDown={handleKeyDown}
                        onClick={handleInputClick}
                        disabled={disabled}
                        placeholder={placeholder}
                        className={`
                            w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
                            ${validation && !validation.isValid ? 'border-red-300' : 'border-gray-300'}
                            ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                        {...props}
                    />

                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-1">
                        {(isSearching || isLoading) && (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                        )}
                        {selectedOption && !isOpen && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onChange(null)
                                }}
                                className="text-gray-400 hover:text-gray-600"
                                title="Clear selection"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        <ChevronDown
                            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </div>
                </div>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                        <div
                            ref={listRef}
                            className="overflow-auto"
                            style={{ maxHeight: `${maxHeight}px` }}
                        >
                            {isSearching || isLoading ? (
                                <div className="p-4 text-center">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-gray-400" />
                                    <p className="text-sm text-gray-500">{loadingText}</p>
                                </div>
                            ) : displayOptions.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">
                                    <Search className="w-5 h-5 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">{noOptionsText}</p>
                                </div>
                            ) : (
                                <div className="py-1">
                                    {displayOptions.map((option, index) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => handleOptionSelect(option)}
                                            className={`
                                                w-full px-3 py-2 text-left flex items-center space-x-3 transition-colors
                                                ${index === selectedIndex ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'}
                                            `}
                                            style={{ height: `${itemHeight}px` }}
                                        >
                                            {option.isCreateOption ? (
                                                <>
                                                    <Plus className="w-4 h-4 text-green-500" />
                                                    <span className="text-green-700">{option.label}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium truncate">{option.label}</div>
                                                        {option.description && (
                                                            <div className="text-sm text-gray-500 truncate">
                                                                {option.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {option.value === value && (
                                                        <Check className="w-4 h-4 text-blue-600" />
                                                    )}
                                                </>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {description && (
                <p className="text-sm text-gray-500">{description}</p>
            )}
        </div>
    )
}

ComboboxInput.displayName = 'ComboboxInput'

export default ComboboxInput
