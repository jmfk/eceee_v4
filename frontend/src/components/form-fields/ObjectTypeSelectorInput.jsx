import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Check, Database, Loader2, AlertCircle } from 'lucide-react'
import { endpoints } from '../../api/endpoints'

/**
 * ObjectTypeSelectorInput Component
 * 
 * Select ObjectType(s) from the backend system.
 * Supports both single and multiple selection modes.
 */
const ObjectTypeSelectorInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Select object type(s)...',
    multiple = true, // Configurable: single or multiple selection
    filterActive = true, // Only show active object types
    ...props
}) => {
    // Initialize from value
    const [selectedIds, setSelectedIds] = useState(() => {
        if (multiple) {
            return Array.isArray(value) ? value : []
        } else {
            return value || null
        }
    })

    const [objectTypes, setObjectTypes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const dropdownRef = useRef(null)
    const searchInputRef = useRef(null)

    // Fetch object types from API
    useEffect(() => {
        const fetchObjectTypes = async () => {
            try {
                setLoading(true)
                setError(null)

                const params = new URLSearchParams()
                if (filterActive) {
                    params.append('is_active', 'true')
                }

                const url = `${endpoints.objectTypes.list}?${params}`
                const response = await fetch(url, {
                    credentials: 'include',
                })

                if (!response.ok) {
                    throw new Error(`Failed to fetch object types: ${response.statusText}`)
                }

                const data = await response.json()
                setObjectTypes(data.results || data) // Handle paginated or non-paginated responses
                setLoading(false)
            } catch (err) {
                console.error('Error fetching object types:', err)
                setError(err.message)
                setLoading(false)
            }
        }

        fetchObjectTypes()
    }, [filterActive])

    // Filter object types based on search term
    const filteredObjectTypes = searchTerm
        ? objectTypes.filter(ot =>
            ot.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (ot.description && ot.description.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        : objectTypes

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
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus()
        }
    }, [isOpen])

    const handleToggleDropdown = () => {
        if (!disabled && !loading) {
            setIsOpen(!isOpen)
            if (!isOpen) {
                setSearchTerm('')
            }
        }
    }

    const handleOptionToggle = (objectTypeId) => {
        let newValue

        if (multiple) {
            const isSelected = selectedIds.includes(objectTypeId)

            if (isSelected) {
                newValue = selectedIds.filter(id => id !== objectTypeId)
            } else {
                newValue = [...selectedIds, objectTypeId]
            }
        } else {
            // Single selection mode
            newValue = objectTypeId
            setIsOpen(false) // Close dropdown after selection
        }

        setSelectedIds(newValue)
        onChange(newValue) // Publish to UDC
    }

    const handleRemoveOption = (objectTypeId, e) => {
        e.stopPropagation()

        if (multiple) {
            const newValue = selectedIds.filter(id => id !== objectTypeId)
            setSelectedIds(newValue)
            onChange(newValue)
        } else {
            setSelectedIds(null)
            onChange(null)
        }
    }

    const getSelectedObjectTypes = () => {
        const ids = multiple ? selectedIds : (selectedIds ? [selectedIds] : [])
        // Map selected IDs to full object data, or create placeholder objects for IDs not yet loaded
        return ids.map(id => {
            const found = objectTypes.find(ot => ot.id === id)
            if (found) {
                return found
            }
            // Return placeholder while loading
            return {
                id: id,
                label: `Loading... (ID: ${id})`,
                name: `loading_${id}`,
                isPlaceholder: true
            }
        })
    }

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

    const selectedObjectTypes = getSelectedObjectTypes()

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
                <div className="text-sm text-gray-500 mb-2">{description}</div>
            )}

            {/* Main dropdown trigger */}
            <div ref={dropdownRef} className="relative">
                <button
                    type="button"
                    onClick={handleToggleDropdown}
                    disabled={disabled || loading}
                    className={`
                        w-full px-4 py-2 text-left border rounded-lg
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                        transition-colors
                        ${hasError ? 'border-red-300 bg-red-50' :
                            hasWarning ? 'border-yellow-300 bg-yellow-50' :
                                'border-gray-300 bg-white hover:border-gray-400'}
                        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex-1 flex flex-wrap gap-2">
                            {selectedObjectTypes.length > 0 ? (
                                selectedObjectTypes.map(ot => (
                                    <span
                                        key={ot.id}
                                        className={`inline-flex items-center space-x-1 px-2 py-1 rounded-md text-sm ${ot.isPlaceholder
                                            ? 'bg-gray-100 text-gray-600'
                                            : 'bg-blue-100 text-blue-800'
                                            }`}
                                    >
                                        {ot.isPlaceholder ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : ot.iconImage ? (
                                            <img src={ot.iconImage} alt="" className="w-4 h-4" />
                                        ) : (
                                            <Database className="w-3 h-3" />
                                        )}
                                        <span>{ot.label}</span>
                                        {!disabled && (
                                            <span
                                                onClick={(e) => handleRemoveOption(ot.id, e)}
                                                className="hover:text-blue-900 ml-1 cursor-pointer"
                                                role="button"
                                                aria-label={`Remove ${ot.label}`}
                                            >
                                                <X className="w-3 h-3" />
                                            </span>
                                        )}
                                    </span>
                                ))
                            ) : loading ? (
                                <div className="flex items-center space-x-2 text-gray-500">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Loading object types...</span>
                                </div>
                            ) : (
                                <span className="text-gray-400">{placeholder}</span>
                            )}
                        </div>
                        <ChevronDown
                            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''
                                }`}
                        />
                    </div>
                </button>

                {/* Dropdown menu */}
                {isOpen && !loading && !error && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
                        {/* Search input */}
                        <div className="p-2 border-b border-gray-200">
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search object types..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Options list */}
                        <div className="overflow-y-auto max-h-64">
                            {filteredObjectTypes.length === 0 ? (
                                <div className="px-4 py-8 text-center text-gray-500">
                                    {searchTerm ? `No object types found matching "${searchTerm}"` : 'No object types available'}
                                </div>
                            ) : (
                                filteredObjectTypes.map(ot => {
                                    const isSelected = multiple
                                        ? selectedIds.includes(ot.id)
                                        : selectedIds === ot.id

                                    return (
                                        <button
                                            key={ot.id}
                                            type="button"
                                            onClick={() => handleOptionToggle(ot.id)}
                                            className={`
                                                w-full px-4 py-3 text-left hover:bg-gray-50
                                                transition-colors flex items-start space-x-3
                                                ${isSelected ? 'bg-blue-50' : ''}
                                            `}
                                        >
                                            <div className="flex-shrink-0 mt-1">
                                                {ot.iconImage ? (
                                                    <img src={ot.iconImage} alt="" className="w-6 h-6" />
                                                ) : (
                                                    <Database className="w-6 h-6 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900">{ot.label}</div>
                                                {ot.description && (
                                                    <div className="text-sm text-gray-500 mt-1">{ot.description}</div>
                                                )}
                                                <div className="text-xs text-gray-400 mt-1">
                                                    {ot.name} • {ot.hierarchyLevel || 'both'}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                                            )}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Error state */}
            {error && (
                <div className="flex items-center space-x-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
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

            {/* Validating state */}
            {isValidating && (
                <div className="text-sm text-blue-600 flex items-center space-x-1">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Validating...</span>
                </div>
            )}
        </div>
    )
}

ObjectTypeSelectorInput.displayName = 'ObjectTypeSelectorInput'

export default ObjectTypeSelectorInput

