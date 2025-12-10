import React, { useState, useRef, useEffect } from 'react'
import { X, Plus, Tag, Hash } from 'lucide-react'

/**
 * TagInput Component
 * 
 * Tag input field with autocomplete, creation, and validation.
 * Supports both predefined tags and user-created tags.
 */
const TagInput = ({
    value = [],
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Type to add tags...',
    suggestions = [],
    allowCreate = true,
    maxTags,
    tagColors = true,
    caseSensitive = false,
    validateTag = (tag) => tag.length >= 2,
    ...props
}) => {
    const [inputValue, setInputValue] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [filteredSuggestions, setFilteredSuggestions] = useState([])
    const inputRef = useRef(null)
    const containerRef = useRef(null)

    const selectedTags = Array.isArray(value) ? value : []

    // Filter suggestions based on input
    useEffect(() => {
        if (inputValue.trim()) {
            const query = caseSensitive ? inputValue : inputValue.toLowerCase()
            const filtered = suggestions.filter(suggestion => {
                const suggestionText = caseSensitive ? suggestion : suggestion.toLowerCase()
                return suggestionText.includes(query) && !selectedTags.includes(suggestion)
            })
            setFilteredSuggestions(filtered)
            setShowSuggestions(filtered.length > 0)
        } else {
            setFilteredSuggestions([])
            setShowSuggestions(false)
        }
    }, [inputValue, suggestions, selectedTags, caseSensitive])

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setShowSuggestions(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleInputChange = (e) => {
        setInputValue(e.target.value)
    }

    const handleInputKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addTag(inputValue.trim())
        } else if (e.key === 'Backspace' && inputValue === '' && selectedTags.length > 0) {
            // Remove last tag when backspacing on empty input
            removeTag(selectedTags[selectedTags.length - 1])
        } else if (e.key === 'Escape') {
            setShowSuggestions(false)
            setInputValue('')
        }
    }

    const addTag = (tag) => {
        if (!tag) return

        const trimmedTag = tag.trim()
        if (!trimmedTag) return

        // Check if tag already exists
        const normalizedTag = caseSensitive ? trimmedTag : trimmedTag.toLowerCase()
        const existingTag = selectedTags.find(existing =>
            caseSensitive ? existing === trimmedTag : existing.toLowerCase() === normalizedTag
        )

        if (existingTag) return

        // Check max tags limit
        if (maxTags && selectedTags.length >= maxTags) return

        // Validate tag
        if (!validateTag(trimmedTag)) return

        // Add tag
        const newTags = [...selectedTags, trimmedTag]
        onChange(newTags)
        setInputValue('')
        setShowSuggestions(false)
    }

    const removeTag = (tagToRemove) => {
        const newTags = selectedTags.filter(tag => tag !== tagToRemove)
        onChange(newTags)
    }

    const handleSuggestionClick = (suggestion) => {
        addTag(suggestion)
        inputRef.current?.focus()
    }

    const getTagColor = (tag, index) => {
        if (!tagColors) return 'bg-gray-100 text-gray-800'

        const colors = [
            'bg-blue-100 text-blue-800',
            'bg-green-100 text-green-800',
            'bg-yellow-100 text-yellow-800',
            'bg-red-100 text-red-800',
            'bg-purple-100 text-purple-800',
            'bg-pink-100 text-pink-800',
            'bg-indigo-100 text-indigo-800',
            'bg-gray-100 text-gray-800'
        ]

        // Simple hash function for consistent colors
        let hash = 0
        for (let i = 0; i < tag.length; i++) {
            hash = ((hash << 5) - hash + tag.charCodeAt(i)) & 0xffffffff
        }

        return colors[Math.abs(hash) % colors.length]
    }

    const hasError = validation && !validation.isValid
    const canAddMore = !maxTags || selectedTags.length < maxTags

    return (
        <div className="space-y-1" ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {/* Tag Container */}
            <div
                className={`
                    min-h-[2.5rem] w-full px-3 py-2 border rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500
                    ${hasError ? 'border-red-300' : 'border-gray-300'}
                    ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}
                `}
                onClick={() => inputRef.current?.focus()}
            >
                <div className="flex flex-wrap gap-2">
                    {/* Selected Tags */}
                    {selectedTags.map((tag, index) => (
                        <span
                            key={tag}
                            className={`
                                inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium
                                ${getTagColor(tag, index)}
                            `}
                        >
                            <Tag className="w-3 h-3" />
                            {tag}
                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        removeTag(tag)
                                    }}
                                    className="hover:bg-black/10 rounded"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </span>
                    ))}

                    {/* Input */}
                    {canAddMore && !disabled && (
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyDown={handleInputKeyDown}
                            placeholder={selectedTags.length === 0 ? placeholder : ''}
                            className="flex-1 min-w-[120px] outline-none bg-transparent"
                            disabled={disabled}
                        />
                    )}
                </div>
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="relative">
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-auto">
                        {filteredSuggestions.map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                            >
                                <Hash className="w-3 h-3 text-gray-400" />
                                <span>{suggestion}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Create New Tag Hint */}
            {inputValue.trim() && allowCreate && canAddMore && !filteredSuggestions.includes(inputValue.trim()) && (
                <div className="text-xs text-gray-500">
                    Press Enter or comma to create "{inputValue.trim()}"
                </div>
            )}

            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* Tag Count */}
            {maxTags && (
                <div className="text-xs text-gray-500">
                    {selectedTags.length}/{maxTags} tags
                </div>
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

            {/* No tags message */}
            {selectedTags.length === 0 && !disabled && (
                <div className="text-xs text-gray-500">
                    {allowCreate ? 'Type and press Enter to add tags' : 'Select from available options'}
                </div>
            )}
        </div>
    )
}

TagInput.displayName = 'TagInput'

export default TagInput
