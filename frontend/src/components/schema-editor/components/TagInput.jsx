import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Hash, Search, Loader2, Check, AlertCircle } from 'lucide-react'
import {
    parseTagString,
    validateAndCreateTags,
    formatTagsForDisplay,
    getTagSuggestions,
    validateTagName
} from '../../../utils/mediaTagUtils'
import { namespacesApi } from '../../../api'

/**
 * TagInput Component for Property Configurations
 * 
 * A specialized tag input component for use in schema property configurations.
 * Handles tag validation, creation, and provides visual feedback.
 */
const TagInput = ({
    value = '',
    onChange,
    namespace = null, // Allow null to auto-detect default namespace
    placeholder = 'Enter tags separated by commas',
    disabled = false,
    label = 'Tags',
    helpText = 'Comma-separated list of tags',
    className = ''
}) => {
    const [inputValue, setInputValue] = useState('')
    const [validatedTags, setValidatedTags] = useState([])
    const [isValidating, setIsValidating] = useState(false)
    const [validationErrors, setValidationErrors] = useState([])
    const [createdTags, setCreatedTags] = useState([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [currentNamespace, setCurrentNamespace] = useState(namespace)
    const [isLoadingNamespace, setIsLoadingNamespace] = useState(!namespace)

    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)
    const searchTimeoutRef = useRef(null)

    // Load namespace if not provided
    useEffect(() => {
        const loadNamespace = async () => {
            if (namespace) {
                setCurrentNamespace(namespace)
                setIsLoadingNamespace(false)
                return
            }

            try {
                setIsLoadingNamespace(true)
                const defaultNamespace = await namespacesApi.getDefault()
                setCurrentNamespace(defaultNamespace?.slug || 'default')
            } catch (error) {
                console.error('Failed to load default namespace:', error)
                setCurrentNamespace('default') // Fallback
            } finally {
                setIsLoadingNamespace(false)
            }
        }

        loadNamespace()
    }, [namespace])

    // Parse initial value
    useEffect(() => {
        if (!currentNamespace || isLoadingNamespace) return

        const tagNames = parseTagString(value)
        if (tagNames.length > 0) {
            validateTags(tagNames)
        } else {
            setValidatedTags([])
            setValidationErrors([])
            setCreatedTags([])
        }
    }, [value, currentNamespace, isLoadingNamespace])

    // Load suggestions when input changes
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        if (!currentNamespace || isLoadingNamespace) {
            setSuggestions([])
            setIsLoadingSuggestions(false)
            return
        }

        if (inputValue.trim().length >= 2) {
            setIsLoadingSuggestions(true)
            searchTimeoutRef.current = setTimeout(async () => {
                try {
                    const tagSuggestions = await getTagSuggestions(inputValue, currentNamespace)
                    setSuggestions(tagSuggestions)
                } catch (error) {
                    console.error('Failed to load suggestions:', error)
                    setSuggestions([])
                } finally {
                    setIsLoadingSuggestions(false)
                }
            }, 300)
        } else {
            setSuggestions([])
            setIsLoadingSuggestions(false)
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
        }
    }, [inputValue, currentNamespace, isLoadingNamespace])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
        }
    }, [])

    const validateTags = async (tagNames) => {
        if (!currentNamespace) return

        setIsValidating(true)
        setValidationErrors([])
        setCreatedTags([])

        try {
            const result = await validateAndCreateTags(tagNames, currentNamespace)
            setValidatedTags(result.validTags)
            setValidationErrors(result.errors)
            setCreatedTags(result.createdTags)
        } catch (error) {
            console.error('Tag validation failed:', error)
            setValidationErrors([`Validation failed: ${error.message}`])
            setValidatedTags([])
        } finally {
            setIsValidating(false)
        }
    }

    const handleInputChange = (e) => {
        const newValue = e.target.value
        setInputValue(newValue)
        setShowSuggestions(newValue.trim().length > 0)
        setSelectedIndex(-1)

        // Update the actual value
        onChange(newValue)
    }

    const handleKeyDown = (e) => {
        if (showSuggestions && suggestions.length > 0) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault()
                    setSelectedIndex(prev =>
                        prev < suggestions.length - 1 ? prev + 1 : prev
                    )
                    break
                case 'ArrowUp':
                    e.preventDefault()
                    setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
                    break
                case 'Enter':
                    e.preventDefault()
                    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                        addSuggestionToInput(suggestions[selectedIndex])
                    }
                    break
                case 'Escape':
                    setShowSuggestions(false)
                    setSelectedIndex(-1)
                    break
            }
        }
    }

    const addSuggestionToInput = (tag) => {
        const currentTags = parseTagString(value)
        const newTags = [...currentTags, tag.name]
        const newValue = newTags.join(', ')

        onChange(newValue)
        setInputValue('')
        setShowSuggestions(false)
        setSelectedIndex(-1)
    }

    const handleSuggestionClick = (tag) => {
        addSuggestionToInput(tag)
    }

    const removeTag = (tagToRemove) => {
        const currentTags = parseTagString(value)
        const newTags = currentTags.filter(tag => tag !== tagToRemove.name)
        const newValue = newTags.join(', ')
        onChange(newValue)
    }

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target) &&
                !inputRef.current.contains(event.target)
            ) {
                setShowSuggestions(false)
                setSelectedIndex(-1)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const hasValidationErrors = validationErrors.length > 0
    const hasCreatedTags = createdTags.length > 0

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}

            {/* Validated Tags Display */}
            {validatedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 items-start">
                    {validatedTags.map((tag, index) => {
                        const isNewTag = createdTags.some(createdTag => createdTag.id === tag.id)
                        return (
                            <span
                                key={tag.id || index}
                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${isNewTag
                                        ? 'bg-green-100 text-green-800 border border-green-300'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                title={isNewTag ? 'Newly created tag' : 'Existing tag'}
                            >
                                <Hash className="w-3 h-3 mr-1" />
                                {tag.name}
                                {isNewTag && <Check className="w-3 h-3 ml-1 text-green-600" />}
                                {!disabled && (
                                    <button
                                        onClick={() => removeTag(tag)}
                                        className={`ml-2 hover:opacity-75 ${isNewTag ? 'text-green-600' : 'text-blue-600'
                                            }`}
                                        type="button"
                                        title="Remove tag"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </span>
                        )
                    })}
                </div>
            )}

            {/* Input Field */}
            <div className="relative">
                <div className="flex items-center">
                    <div className="relative flex-1">
                        {isValidating || isLoadingSuggestions || isLoadingNamespace ? (
                            <Loader2 className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 transform -translate-y-1/2 animate-spin" />
                        ) : (
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                        )}

                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue || value}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            onFocus={() => {
                                if (inputValue.trim().length > 0) {
                                    setShowSuggestions(true)
                                }
                            }}
                            className={`w-full pl-10 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${hasValidationErrors ? 'border-red-300' : 'border-gray-300'
                                }`}
                            placeholder={placeholder}
                            disabled={disabled || isLoadingNamespace}
                        />
                    </div>
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && !disabled && (suggestions.length > 0 || isLoadingSuggestions) && (
                    <div
                        ref={suggestionsRef}
                        className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
                    >
                        {isLoadingSuggestions ? (
                            <div className="px-4 py-2 text-sm text-gray-500 flex items-center">
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Loading suggestions...
                            </div>
                        ) : (
                            suggestions.map((tag, index) => (
                                <div
                                    key={tag.id}
                                    className={`px-4 py-2 text-sm cursor-pointer flex items-center ${index === selectedIndex
                                            ? 'bg-blue-100 text-blue-900'
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                    onClick={() => handleSuggestionClick(tag)}
                                >
                                    <Hash className="w-4 h-4 mr-2 text-gray-400" />
                                    <span className="font-medium">{tag.name}</span>
                                    {tag.description && (
                                        <span className="ml-2 text-xs text-gray-500 truncate">
                                            {tag.description}
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Status Messages */}
            <div className="space-y-1">
                {/* Success Message for Created Tags */}
                {hasCreatedTags && (
                    <div className="flex items-center text-sm text-green-600">
                        <Check className="w-4 h-4 mr-1" />
                        Created {createdTags.length} new tag{createdTags.length !== 1 ? 's' : ''}: {
                            createdTags.map(tag => tag.name).join(', ')
                        }
                    </div>
                )}

                {/* Validation Errors */}
                {hasValidationErrors && (
                    <div className="space-y-1">
                        {validationErrors.map((error, index) => (
                            <div key={index} className="flex items-start text-sm text-red-600">
                                <AlertCircle className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Help Text */}
                {helpText && !hasValidationErrors && (
                    <div className="text-xs text-gray-500">
                        {helpText}
                    </div>
                )}
            </div>
        </div>
    )
}

export default TagInput
