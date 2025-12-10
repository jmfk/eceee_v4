import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'

/**
 * MultiSelectInput Component
 * 
 * Multi-select dropdown component with search functionality.
 * Supports both array of strings and array of objects as options.
 */
const MultiSelectInput = ({
    value = [],
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Select options...',
    options = [],
    maxSelections,
    searchable = true,
    showSelectAll = true,
    ...props
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const dropdownRef = useRef(null)
    const searchInputRef = useRef(null)

    // Normalize options to consistent format
    const normalizeOptions = (opts) => {
        if (!Array.isArray(opts)) return []

        return opts.map(option => {
            if (typeof option === 'string') {
                return { value: option, label: option }
            }
            if (typeof option === 'object' && option.value !== undefined) {
                return { value: option.value, label: option.label || option.value }
            }
            return { value: String(option), label: String(option) }
        })
    }

    const normalizedOptions = normalizeOptions(options)
    const selectedValues = Array.isArray(value) ? value : []

    // Filter options based on search term
    const filteredOptions = searchTerm
        ? normalizedOptions.filter(option =>
            option.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : normalizedOptions

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
                setSearchTerm('')
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [isOpen, searchable])

    const handleToggleDropdown = () => {
        if (!disabled) {
            setIsOpen(!isOpen)
            if (!isOpen) {
                setSearchTerm('')
            }
        }
    }

    const handleOptionToggle = (optionValue) => {
        const isSelected = selectedValues.includes(optionValue)
        let newValue

        if (isSelected) {
            newValue = selectedValues.filter(v => v !== optionValue)
        } else {
            if (maxSelections && selectedValues.length >= maxSelections) {
                return // Don't add more if at max
            }
            newValue = [...selectedValues, optionValue]
        }

        onChange(newValue)
    }

    const handleSelectAll = () => {
        const allValues = filteredOptions.map(opt => opt.value)
        const newValue = selectedValues.length === filteredOptions.length ? [] : allValues
        onChange(newValue)
    }

    const handleRemoveOption = (optionValue, e) => {
        e.stopPropagation()
        const newValue = selectedValues.filter(v => v !== optionValue)
        onChange(newValue)
    }

    const getSelectedLabels = () => {
        return selectedValues.map(val => {
            const option = normalizedOptions.find(opt => opt.value === val)
            return option ? option.label : val
        })
    }

    // Get validation status for styling
    const hasError = validation && !validation.isValid

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="relative" ref={dropdownRef}>
                {/* Main Input */}
                <div
                    onClick={handleToggleDropdown}
                    className={`
                        w-full min-h-[2.5rem] px-3 py-2 border rounded-md cursor-pointer
                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                        transition-colors duration-200
                        ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white hover:border-gray-400'}
                        ${hasError ? 'border-red-300' : 'border-gray-300'}
                        ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
                    `}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex-1 flex flex-wrap gap-1">
                            {selectedValues.length === 0 ? (
                                <span className="text-gray-500">{placeholder}</span>
                            ) : (
                                getSelectedLabels().map((label, index) => (
                                    <span
                                        key={selectedValues[index]}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded"
                                    >
                                        {label}
                                        {!disabled && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleRemoveOption(selectedValues[index], e)}
                                                className="hover:bg-blue-200 rounded"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </span>
                                ))
                            )}
                        </div>
                        <ChevronDown
                            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''
                                }`}
                        />
                    </div>
                </div>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {/* Search Input */}
                        {searchable && (
                            <div className="p-2 border-b border-gray-200">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search options..."
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        )}

                        {/* Select All Option */}
                        {showSelectAll && filteredOptions.length > 1 && (
                            <div
                                onClick={handleSelectAll}
                                className="px-3 py-2 text-sm border-b border-gray-200 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                            >
                                <span className="font-medium">
                                    {selectedValues.length === filteredOptions.length ? 'Deselect All' : 'Select All'}
                                </span>
                                {selectedValues.length === filteredOptions.length && (
                                    <Check className="h-4 w-4 text-blue-600" />
                                )}
                            </div>
                        )}

                        {/* Options */}
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500">
                                {searchTerm ? 'No options found' : 'No options available'}
                            </div>
                        ) : (
                            filteredOptions.map((option) => {
                                const isSelected = selectedValues.includes(option.value)
                                const isDisabled = !isSelected && maxSelections && selectedValues.length >= maxSelections

                                return (
                                    <div
                                        key={option.value}
                                        onClick={() => !isDisabled && handleOptionToggle(option.value)}
                                        className={`
                                            px-3 py-2 text-sm cursor-pointer flex items-center justify-between
                                            ${isDisabled ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-gray-50'}
                                            ${isSelected ? 'bg-blue-50 text-blue-900' : ''}
                                        `}
                                    >
                                        <span>{option.label}</span>
                                        {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}
            </div>

            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* Validation Message */}
            {hasError && validation?.errors?.length > 0 && (
                <div className="text-sm text-red-600">
                    {validation.errors[0]}
                </div>
            )}

            {/* Loading State */}
            {isValidating && (
                <div className="text-sm text-blue-600">
                    Validating...
                </div>
            )}

            {/* Selection Info */}
            {maxSelections && (
                <div className="text-xs text-gray-500">
                    {selectedValues.length}/{maxSelections} selected
                </div>
            )}
        </div>
    )
}

MultiSelectInput.displayName = 'MultiSelectInput'

export default MultiSelectInput
