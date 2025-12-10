import React, { useState, useMemo } from 'react'
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Search, Check } from 'lucide-react'

/**
 * TransferInput Component
 * 
 * Dual listbox component for transferring items between available and selected lists.
 * Supports search, bulk operations, and custom item rendering.
 */
const TransferInput = ({
    value = [],
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    options = [],
    titles = ['Available', 'Selected'],
    searchable = true,
    searchPlaceholder = 'Search...',
    height = 300,
    showSelectAll = true,
    itemRender = (item) => item.label || item.value,
    filterOption = (option, searchTerm) => {
        const term = searchTerm.toLowerCase()
        const label = (option.label || option.value).toLowerCase()
        return label.includes(term)
    },
    ...props
}) => {
    const [leftSearch, setLeftSearch] = useState('')
    const [rightSearch, setRightSearch] = useState('')
    const [leftSelected, setLeftSelected] = useState([])
    const [rightSelected, setRightSelected] = useState([])

    // Normalize options
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

    const allOptions = normalizeOptions(options)
    const selectedValues = Array.isArray(value) ? value : []

    // Split options into available and selected
    const { availableOptions, selectedOptions } = useMemo(() => {
        const available = allOptions.filter(option => !selectedValues.includes(option.value))
        const selected = selectedValues.map(val =>
            allOptions.find(opt => opt.value === val)
        ).filter(Boolean)

        return { availableOptions: available, selectedOptions: selected }
    }, [allOptions, selectedValues])

    // Filter options based on search
    const filteredAvailable = useMemo(() => {
        if (!leftSearch.trim()) return availableOptions
        return availableOptions.filter(option => filterOption(option, leftSearch))
    }, [availableOptions, leftSearch, filterOption])

    const filteredSelected = useMemo(() => {
        if (!rightSearch.trim()) return selectedOptions
        return selectedOptions.filter(option => filterOption(option, rightSearch))
    }, [selectedOptions, rightSearch, filterOption])

    // Handle item selection in lists
    const handleLeftItemClick = (option) => {
        setLeftSelected(prev => {
            const isSelected = prev.includes(option.value)
            if (isSelected) {
                return prev.filter(val => val !== option.value)
            } else {
                return [...prev, option.value]
            }
        })
    }

    const handleRightItemClick = (option) => {
        setRightSelected(prev => {
            const isSelected = prev.includes(option.value)
            if (isSelected) {
                return prev.filter(val => val !== option.value)
            } else {
                return [...prev, option.value]
            }
        })
    }

    // Transfer operations
    const moveToSelected = () => {
        const newSelected = [...selectedValues, ...leftSelected]
        onChange(newSelected)
        setLeftSelected([])
    }

    const moveToAvailable = () => {
        const newSelected = selectedValues.filter(val => !rightSelected.includes(val))
        onChange(newSelected)
        setRightSelected([])
    }

    const moveAllToSelected = () => {
        const allAvailableValues = filteredAvailable.map(opt => opt.value)
        const newSelected = [...selectedValues, ...allAvailableValues]
        onChange(newSelected)
        setLeftSelected([])
    }

    const moveAllToAvailable = () => {
        const allSelectedValues = filteredSelected.map(opt => opt.value)
        const newSelected = selectedValues.filter(val => !allSelectedValues.includes(val))
        onChange(newSelected)
        setRightSelected([])
    }

    // Select all in list
    const selectAllLeft = () => {
        setLeftSelected(filteredAvailable.map(opt => opt.value))
    }

    const selectAllRight = () => {
        setRightSelected(filteredSelected.map(opt => opt.value))
    }

    const renderList = (items, selectedItems, onItemClick, searchValue, onSearchChange, title, isLeft = true) => (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-gray-900" role="heading" aria-level="4">{title}</div>
                    <span className="text-xs text-gray-500">
                        {selectedItems.length > 0 && `${selectedItems.length}/`}{items.length}
                    </span>
                </div>

                {/* Search */}
                {searchable && (
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <input
                            type="text"
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                )}

                {/* Select All */}
                {showSelectAll && items.length > 0 && (
                    <button
                        type="button"
                        onClick={isLeft ? selectAllLeft : selectAllRight}
                        className="mt-2 w-full text-xs text-blue-600 hover:text-blue-800 transition-colors"
                    >
                        Select all ({items.length})
                    </button>
                )}
            </div>

            {/* List */}
            <div
                className="flex-1 overflow-y-auto"
                style={{ height: `${height - 120}px` }}
            >
                {items.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                        <div className="text-sm">No items</div>
                    </div>
                ) : (
                    <div className="p-1">
                        {items.map(option => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => onItemClick(option)}
                                disabled={disabled}
                                className={`
                                    w-full p-2 text-left text-sm rounded transition-colors flex items-center space-x-2
                                    ${selectedItems.includes(option.value)
                                        ? 'bg-blue-50 text-blue-900 border border-blue-200'
                                        : 'hover:bg-gray-50'
                                    }
                                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                                `}
                            >
                                <div className="w-4 h-4 flex items-center justify-center">
                                    {selectedItems.includes(option.value) && (
                                        <Check className="w-3 h-3 text-blue-600" />
                                    )}
                                </div>
                                <div className="flex-1 truncate">
                                    {itemRender(option)}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )

    const hasError = validation && !validation.isValid

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div
                className={`
                    border rounded-lg overflow-hidden
                    ${hasError ? 'border-red-300' : 'border-gray-300'}
                `}
                style={{ height: `${height}px` }}
            >
                <div className="h-full flex">
                    {/* Available Items */}
                    <div className="flex-1 border-r border-gray-200">
                        {renderList(
                            filteredAvailable,
                            leftSelected,
                            handleLeftItemClick,
                            leftSearch,
                            setLeftSearch,
                            titles[0],
                            true
                        )}
                    </div>

                    {/* Transfer Controls */}
                    <div className="w-16 flex flex-col items-center justify-center space-y-2 bg-gray-50">
                        <button
                            type="button"
                            onClick={moveToSelected}
                            disabled={disabled || leftSelected.length === 0}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Move selected to right"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={moveAllToSelected}
                            disabled={disabled || filteredAvailable.length === 0}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Move all to right"
                        >
                            <ChevronsRight className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={moveToAvailable}
                            disabled={disabled || rightSelected.length === 0}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Move selected to left"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <button
                            type="button"
                            onClick={moveAllToAvailable}
                            disabled={disabled || filteredSelected.length === 0}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Move all to left"
                        >
                            <ChevronsLeft className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Selected Items */}
                    <div className="flex-1">
                        {renderList(
                            filteredSelected,
                            rightSelected,
                            handleRightItemClick,
                            rightSearch,
                            setRightSearch,
                            titles[1],
                            false
                        )}
                    </div>
                </div>
            </div>

            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* Summary */}
            <div className="flex justify-between text-xs text-gray-500">
                <span>{availableOptions.length} available</span>
                <span>{selectedOptions.length} selected</span>
            </div>

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
        </div>
    )
}

TransferInput.displayName = 'TransferInput'

export default TransferInput
