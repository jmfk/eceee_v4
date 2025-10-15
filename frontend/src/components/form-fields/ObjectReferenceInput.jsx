import React, { useState, useRef, useEffect } from 'react'
import { Search, X, Plus, GripVertical, Loader2, AlertCircle, ChevronDown, Check } from 'lucide-react'
import { useObjectReferenceField } from '../../hooks/useObjectReferences'

/**
 * ObjectReferenceInput Component
 * 
 * Field for referencing other ObjectInstances with search, autocomplete, and validation.
 * Supports both single and multiple selection modes.
 * Features: search dropdown, chips display, drag-to-reorder, direct PK entry.
 */
const ObjectReferenceInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Search for objects...',
    // Field config from schema
    multiple = false,
    max_items = null,
    allowed_object_types = [],
    relationship_type,
    ...props
}) => {
    const [directPkInput, setDirectPkInput] = useState('')
    const [showDirectInput, setShowDirectInput] = useState(false)
    const dropdownRef = useRef(null)
    const searchInputRef = useRef(null)
    const [draggedIndex, setDraggedIndex] = useState(null)

    const fieldConfig = {
        multiple,
        max_items,
        allowed_object_types,
        relationship_type
    }

    const {
        selectedIds,
        selectedObjects,
        isLoadingSelected,
        searchTerm,
        searchResults,
        isSearching,
        searchError,
        isDropdownOpen,
        addObject,
        removeObject,
        reorderObjects,
        clearAll,
        handleSearchChange,
        toggleDropdown,
        closeDropdown,
        canAddMore,
        isFull,
        count
    } = useObjectReferenceField(value, onChange, fieldConfig)

    // Debounced search
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm)
        }, 300)
        return () => clearTimeout(timer)
    }, [searchTerm])

    // Update search when debounced value changes
    useEffect(() => {
        if (debouncedSearchTerm) {
            handleSearchChange(debouncedSearchTerm)
        }
    }, [debouncedSearchTerm, handleSearchChange])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                closeDropdown()
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [closeDropdown])

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isDropdownOpen && searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [isDropdownOpen])

    // Handle selecting an object from search results
    const handleSelectObject = (objectId) => {
        const added = addObject(objectId)
        if (added && !multiple) {
            closeDropdown()
        }
    }

    // Handle adding by direct PK
    const handleAddByPk = () => {
        const pk = parseInt(directPkInput, 10)
        if (!isNaN(pk)) {
            addObject(pk)
            setDirectPkInput('')
            setShowDirectInput(false)
        }
    }

    // Drag and drop handlers
    const handleDragStart = (index) => {
        setDraggedIndex(index)
    }

    const handleDragOver = (e, index) => {
        e.preventDefault()
        if (draggedIndex !== null && draggedIndex !== index) {
            reorderObjects(draggedIndex, index)
            setDraggedIndex(index)
        }
    }

    const handleDragEnd = () => {
        setDraggedIndex(null)
    }

    // Render error state
    const errorMessage = validation?.message || searchError?.message

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
                <p className="text-sm text-gray-500">{description}</p>
            )}

            {/* Selected Items (Chips) */}
            {multiple && selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-md border border-gray-200">
                    {selectedIds.map((id, index) => {
                        const obj = selectedObjects[id]
                        return (
                            <div
                                key={id}
                                draggable={!disabled}
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`
                                    inline-flex items-center gap-1 px-2 py-1 
                                    bg-blue-100 text-blue-800 rounded-md text-sm
                                    ${!disabled ? 'cursor-move' : 'cursor-default'}
                                    ${draggedIndex === index ? 'opacity-50' : ''}
                                `}
                            >
                                {!disabled && (
                                    <GripVertical className="w-3 h-3 text-blue-600" />
                                )}
                                <span>
                                    {isLoadingSelected ? (
                                        `ID: ${id}`
                                    ) : (
                                        obj ? (
                                            <>
                                                {obj.title}
                                                <span className="text-blue-600 text-xs ml-1">
                                                    ({obj.objectType?.label || obj.objectType?.name})
                                                </span>
                                            </>
                                        ) : (
                                            `ID: ${id}`
                                        )
                                    )}
                                </span>
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={() => removeObject(id)}
                                        className="ml-1 hover:bg-blue-200 rounded p-0.5"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )
                    })}
                    {!disabled && (
                        <button
                            type="button"
                            onClick={clearAll}
                            className="text-xs text-red-600 hover:text-red-800 px-2"
                        >
                            Clear All
                        </button>
                    )}
                </div>
            )}

            {/* Single Selected Item */}
            {!multiple && selectedIds.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md border border-gray-200">
                    <span className="flex-1 text-sm">
                        {isLoadingSelected ? (
                            `ID: ${selectedIds[0]}`
                        ) : (
                            selectedObjects[selectedIds[0]] ? (
                                <>
                                    {selectedObjects[selectedIds[0]].title}
                                    <span className="text-gray-500 text-xs ml-2">
                                        ({selectedObjects[selectedIds[0]].objectType?.label})
                                    </span>
                                </>
                            ) : (
                                `ID: ${selectedIds[0]}`
                            )
                        )}
                    </span>
                    {!disabled && (
                        <button
                            type="button"
                            onClick={() => removeObject(selectedIds[0])}
                            className="text-red-600 hover:text-red-800"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}

            {/* Search / Add Controls */}
            {!disabled && (canAddMore || selectedIds.length === 0) && (
                <div className="relative" ref={dropdownRef}>
                    {/* Search Input */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onFocus={() => !isDropdownOpen && toggleDropdown()}
                            placeholder={placeholder}
                            className={`
                                w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2
                                ${validation?.isValid === false ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
                            `}
                            disabled={disabled}
                        />
                        {isSearching && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                        )}
                    </div>

                    {/* Dropdown Results */}
                    {isDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
                            {isSearching && (
                                <div className="p-4 text-center text-gray-500">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                                    <p className="text-sm">Searching...</p>
                                </div>
                            )}

                            {!isSearching && searchResults.length === 0 && searchTerm && (
                                <div className="p-4 text-center text-gray-500">
                                    <p className="text-sm">No objects found</p>
                                    <p className="text-xs mt-1">Try a different search term</p>
                                </div>
                            )}

                            {!isSearching && searchResults.length === 0 && !searchTerm && (
                                <div className="p-4 text-center text-gray-500">
                                    <p className="text-sm">Start typing to search</p>
                                </div>
                            )}

                            {!isSearching && searchResults.length > 0 && (
                                <div className="py-1">
                                    {searchResults.map((obj) => {
                                        const isSelected = selectedIds.includes(obj.id)
                                        return (
                                            <button
                                                key={obj.id}
                                                type="button"
                                                onClick={() => handleSelectObject(obj.id)}
                                                className={`
                                                    w-full text-left px-4 py-2 hover:bg-gray-100 
                                                    flex items-center justify-between
                                                    ${isSelected ? 'bg-blue-50' : ''}
                                                `}
                                                disabled={isSelected}
                                            >
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {obj.title}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {obj.objectType?.label || obj.object_type?.label} • ID: {obj.id}
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <Check className="w-4 h-4 text-blue-600" />
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Direct PK Entry */}
            {!disabled && canAddMore && (
                <div className="flex gap-2 items-center">
                    {!showDirectInput ? (
                        <button
                            type="button"
                            onClick={() => setShowDirectInput(true)}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" />
                            Add by ID
                        </button>
                    ) : (
                        <div className="flex gap-2 items-center">
                            <input
                                type="number"
                                value={directPkInput}
                                onChange={(e) => setDirectPkInput(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        handleAddByPk()
                                    }
                                }}
                                placeholder="Enter object ID"
                                className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                type="button"
                                onClick={handleAddByPk}
                                disabled={!directPkInput}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                                Add
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDirectInput(false)
                                    setDirectPkInput('')
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Info / Status Messages */}
            {isFull && (
                <p className="text-xs text-amber-600">
                    Maximum of {max_items} {multiple ? 'items' : 'item'} reached
                </p>
            )}

            {allowed_object_types.length > 0 && (
                <p className="text-xs text-gray-500">
                    Allowed types: {allowed_object_types.join(', ')}
                </p>
            )}

            {/* Validation Error */}
            {errorMessage && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Validating Indicator */}
            {isValidating && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validating...</span>
                </div>
            )}
        </div>
    )
}

export default ObjectReferenceInput

