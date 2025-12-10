import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, FileType, Search, Loader2 } from 'lucide-react'

/**
 * MimeTypesInput Component
 * 
 * A specialized MIME types input component for file property configuration.
 * Shows selected MIME types as pills and allows searching/adding from predefined list.
 */
const MimeTypesInput = ({
    value = [], // Array of MIME type strings
    onChange,
    allowedFileTypes = [], // Categories to show common types for
    placeholder = 'Search and add MIME types...',
    disabled = false,
    label = 'Specific MIME Types',
    helpText = 'Optional - overrides categories'
}) => {
    const [inputValue, setInputValue] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [selectedIndex, setSelectedIndex] = useState(-1)

    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)

    // Common MIME types by category
    const commonMimeTypes = {
        document: [
            { type: 'application/pdf', label: 'PDF' },
            { type: 'application/msword', label: 'Word (.doc)' },
            { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word (.docx)' },
            { type: 'application/vnd.ms-excel', label: 'Excel (.xls)' },
            { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel (.xlsx)' },
            { type: 'application/vnd.ms-powerpoint', label: 'PowerPoint (.ppt)' },
            { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', label: 'PowerPoint (.pptx)' },
            { type: 'text/plain', label: 'Text (.txt)' },
            { type: 'text/csv', label: 'CSV' },
            { type: 'application/rtf', label: 'Rich Text (.rtf)' },
            { type: 'application/zip', label: 'ZIP Archive' },
            { type: 'application/x-rar-compressed', label: 'RAR Archive' }
        ],
        image: [
            { type: 'image/jpeg', label: 'JPEG' },
            { type: 'image/png', label: 'PNG' },
            { type: 'image/gif', label: 'GIF' },
            { type: 'image/webp', label: 'WebP' },
            { type: 'image/svg+xml', label: 'SVG' },
            { type: 'image/bmp', label: 'BMP' },
            { type: 'image/tiff', label: 'TIFF' },
            { type: 'image/ico', label: 'ICO' }
        ],
        video: [
            { type: 'video/mp4', label: 'MP4' },
            { type: 'video/webm', label: 'WebM' },
            { type: 'video/ogg', label: 'OGG Video' },
            { type: 'video/avi', label: 'AVI' },
            { type: 'video/mov', label: 'MOV' },
            { type: 'video/wmv', label: 'WMV' },
            { type: 'video/flv', label: 'FLV' },
            { type: 'video/mkv', label: 'MKV' }
        ],
        audio: [
            { type: 'audio/mpeg', label: 'MP3' },
            { type: 'audio/wav', label: 'WAV' },
            { type: 'audio/ogg', label: 'OGG Audio' },
            { type: 'audio/aac', label: 'AAC' },
            { type: 'audio/flac', label: 'FLAC' },
            { type: 'audio/wma', label: 'WMA' },
            { type: 'audio/m4a', label: 'M4A' }
        ]
    }

    // Get available MIME types based on selected categories
    const getAvailableMimeTypes = () => {
        if (allowedFileTypes.length === 0) {
            // If no categories selected, show all types
            return Object.values(commonMimeTypes).flat()
        }

        return allowedFileTypes.flatMap(category => commonMimeTypes[category] || [])
    }

    // Filter suggestions based on input and exclude already selected
    const getFilteredSuggestions = (searchTerm) => {
        const available = getAvailableMimeTypes()
        const filtered = available.filter(({ type, label }) => {
            const searchLower = searchTerm.toLowerCase()
            const matchesSearch = type.toLowerCase().includes(searchLower) ||
                label.toLowerCase().includes(searchLower)
            const notSelected = !value.includes(type)
            return matchesSearch && notSelected
        })

        return filtered.slice(0, 10) // Limit to 10 suggestions
    }

    // Handle input change
    const handleInputChange = (e) => {
        const searchValue = e.target.value
        setInputValue(searchValue)
        setSelectedIndex(-1)

        if (searchValue.trim()) {
            const filtered = getFilteredSuggestions(searchValue)
            setSuggestions(filtered)
            setShowSuggestions(true)
        } else {
            setSuggestions([])
            setShowSuggestions(false)
        }
    }

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        if (!showSuggestions) {
            if (e.key === 'Enter') {
                e.preventDefault()
                handleAddCustomMimeType(inputValue.trim())
            }
            return
        }

        const totalOptions = suggestions.length + (inputValue.trim() &&
            !suggestions.some(({ type }) => type.toLowerCase() === inputValue.toLowerCase()) ? 1 : 0)

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => prev < totalOptions - 1 ? prev + 1 : prev)
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
                break
            case 'Enter':
                e.preventDefault()
                if (selectedIndex >= 0) {
                    if (selectedIndex < suggestions.length) {
                        handleSelectMimeType(suggestions[selectedIndex])
                    } else {
                        handleAddCustomMimeType(inputValue.trim())
                    }
                } else {
                    handleAddCustomMimeType(inputValue.trim())
                }
                break
            case 'Escape':
                setShowSuggestions(false)
                setSelectedIndex(-1)
                break
        }
    }

    // Select MIME type from suggestions
    const handleSelectMimeType = (mimeTypeObj) => {
        const newMimeTypes = [...value, mimeTypeObj.type]
        onChange(newMimeTypes)
        setInputValue('')
        setShowSuggestions(false)
        setSelectedIndex(-1)
        setSuggestions([])
    }

    // Add custom MIME type
    const handleAddCustomMimeType = (mimeType) => {
        if (!mimeType || value.includes(mimeType)) {
            return
        }

        // Basic MIME type validation
        if (!/^[a-z]+\/[a-z0-9\-\+\.]+$/i.test(mimeType)) {
            return // Invalid MIME type format
        }

        const newMimeTypes = [...value, mimeType]
        onChange(newMimeTypes)
        setInputValue('')
        setShowSuggestions(false)
        setSelectedIndex(-1)
        setSuggestions([])
    }

    // Remove MIME type
    const handleRemoveMimeType = (mimeTypeToRemove) => {
        const newMimeTypes = value.filter(type => type !== mimeTypeToRemove)
        onChange(newMimeTypes)
    }

    // Get display label for MIME type
    const getMimeTypeLabel = (mimeType) => {
        const allTypes = Object.values(commonMimeTypes).flat()
        const found = allTypes.find(({ type }) => type === mimeType)
        return found ? found.label : mimeType.split('/')[1]?.toUpperCase() || mimeType
    }

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target) &&
                inputRef.current && !inputRef.current.contains(event.target)) {
                setShowSuggestions(false)
                setSelectedIndex(-1)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="space-y-2">
            {/* Label */}
            <label className="block text-sm font-medium text-gray-700">
                {label}
            </label>

            {/* Selected MIME Types Pills */}
            {value.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {value.map((mimeType) => (
                        <span
                            key={mimeType}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800"
                        >
                            <FileType className="w-3 h-3 mr-1" />
                            {getMimeTypeLabel(mimeType)}
                            {!disabled && (
                                <button
                                    onClick={() => handleRemoveMimeType(mimeType)}
                                    className="ml-2 text-green-600 hover:text-green-800"
                                    type="button"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </span>
                    ))}
                </div>
            )}

            {/* Search Input */}
            <div className="relative">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            if (inputValue.trim()) {
                                const filtered = getFilteredSuggestions(inputValue)
                                setSuggestions(filtered)
                                setShowSuggestions(true)
                            }
                        }}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        placeholder={placeholder}
                        disabled={disabled}
                    />
                    {inputValue.trim() && (
                        <button
                            onClick={() => handleAddCustomMimeType(inputValue.trim())}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-800"
                            type="button"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && (inputValue.trim() || suggestions.length > 0) && (
                    <div
                        ref={suggestionsRef}
                        className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
                    >
                        {suggestions.length > 0 && suggestions.map((mimeTypeObj, index) => (
                            <button
                                key={mimeTypeObj.type}
                                type="button"
                                onClick={() => handleSelectMimeType(mimeTypeObj)}
                                className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center ${index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                                    }`}
                            >
                                <FileType className="w-4 h-4 mr-2 text-gray-400" />
                                <div className="flex-1">
                                    <div className="font-medium">{mimeTypeObj.label}</div>
                                    <div className="text-xs text-gray-500">{mimeTypeObj.type}</div>
                                </div>
                            </button>
                        ))}

                        {inputValue.trim() &&
                            !suggestions.some(({ type }) => type.toLowerCase() === inputValue.toLowerCase()) && (
                                <button
                                    type="button"
                                    onClick={() => handleAddCustomMimeType(inputValue.trim())}
                                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center border-t border-gray-200 ${selectedIndex === suggestions.length ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                                        }`}
                                >
                                    <Plus className="w-4 h-4 mr-2 text-gray-400" />
                                    <span>Add custom MIME type: <strong>"{inputValue.trim()}"</strong></span>
                                </button>
                            )}

                        {suggestions.length === 0 && inputValue.trim() && (
                            <div className="px-4 py-3 text-center text-gray-500">
                                <span className="text-sm">No matching MIME types found</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Help Text */}
            {helpText && (
                <div className="text-xs text-gray-500">
                    {helpText}
                </div>
            )}
        </div>
    )
}

export default MimeTypesInput
