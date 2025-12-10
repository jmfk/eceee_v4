import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, Hash, Search, Loader2 } from 'lucide-react'
import { mediaApi } from '../../../api'
import { useGlobalNotifications } from '../../../contexts/GlobalNotificationContext'

/**
 * AutoTagsInput Component
 * 
 * A specialized tag input component for auto-tags configuration in schema properties.
 * Shows selected tags as pills and allows searching/adding tags from the media manager.
 */
const AutoTagsInput = ({
    value = [], // Array of tag objects
    onChange,
    namespace = 'default',
    placeholder = 'Search and add tags...',
    disabled = false,
    label = 'Auto-Tags for Uploads',
    helpText = 'Tags that will be automatically added to uploaded files'
}) => {
    const [inputValue, setInputValue] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [isSearching, setIsSearching] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)

    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)
    const searchTimeoutRef = useRef(null)

    const { addNotification } = useGlobalNotifications()

    // Ensure value is always an array of tag objects
    const tags = Array.isArray(value) ? value : []

    // Search for tags in media manager
    const searchTags = async (searchTerm) => {
        if (!searchTerm.trim()) {
            setSuggestions([])
            return
        }

        setIsSearching(true)
        try {
            const response = await mediaApi.tags.list({
                namespace,
                search: searchTerm.trim(),
                pageSize: 10
            })()

            // Filter out already selected tags
            const filtered = response.results.filter(tag =>
                !tags.some(selectedTag => selectedTag.id === tag.id)
            )

            setSuggestions(filtered)
        } catch (error) {
            console.error('Failed to search tags:', error)
            setSuggestions([])
        } finally {
            setIsSearching(false)
        }
    }

    // Handle input change with debounced search
    const handleInputChange = (e) => {
        const value = e.target.value
        setInputValue(value)
        setSelectedIndex(-1)

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        if (value.trim()) {
            setShowSuggestions(true)
            searchTimeoutRef.current = setTimeout(() => {
                searchTags(value)
            }, 300)
        } else {
            setShowSuggestions(false)
            setSuggestions([])
        }
    }

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        if (!showSuggestions) {
            if (e.key === 'Enter') {
                e.preventDefault()
                handleCreateNewTag(inputValue.trim())
            }
            return
        }

        const totalOptions = suggestions.length + (inputValue.trim() && !suggestions.some(tag =>
            tag.name.toLowerCase() === inputValue.toLowerCase()) ? 1 : 0)

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
                        handleSelectTag(suggestions[selectedIndex])
                    } else {
                        handleCreateNewTag(inputValue.trim())
                    }
                } else {
                    handleCreateNewTag(inputValue.trim())
                }
                break
            case 'Escape':
                setShowSuggestions(false)
                setSelectedIndex(-1)
                break
        }
    }

    // Add existing tag
    const handleSelectTag = (tag) => {
        const newTags = [...tags, tag]
        onChange(newTags)
        setInputValue('')
        setShowSuggestions(false)
        setSelectedIndex(-1)
        setSuggestions([])
    }

    // Create new tag
    const handleCreateNewTag = async (tagName) => {
        if (!tagName || tags.some(tag => tag.name.toLowerCase() === tagName.toLowerCase())) {
            return
        }

        try {
            const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
            const newTag = await mediaApi.tags.create({
                name: tagName,
                slug: slug,
                namespace,
                description: `Auto-created tag for schema configuration`
            })()

            const newTags = [...tags, newTag]
            onChange(newTags)
            setInputValue('')
            setShowSuggestions(false)
            setSelectedIndex(-1)
            setSuggestions([])

            addNotification(`Created new tag: ${tagName}`, 'success')
        } catch (error) {
            console.error('Failed to create tag:', error)
            addNotification(`Failed to create tag: ${tagName}`, 'error')
        }
    }

    // Remove tag
    const handleRemoveTag = (tagToRemove) => {
        const newTags = tags.filter(tag => tag.id !== tagToRemove.id)
        onChange(newTags)
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

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
        }
    }, [])

    return (
        <div className="space-y-2">
            {/* Label */}
            <label className="block text-sm font-medium text-gray-700">
                {label}
            </label>

            {/* Selected Tags Pills */}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                        <span
                            key={tag.id}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                        >
                            <Hash className="w-3 h-3 mr-1" />
                            {tag.name}
                            {!disabled && (
                                <button
                                    onClick={() => handleRemoveTag(tag)}
                                    className="ml-2 text-blue-600 hover:text-blue-800"
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
                                setShowSuggestions(true)
                            }
                        }}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        placeholder={placeholder}
                        disabled={disabled}
                    />
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 animate-spin" />
                    )}
                    {!isSearching && inputValue.trim() && (
                        <button
                            onClick={() => handleCreateNewTag(inputValue.trim())}
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
                        {isSearching && (
                            <div className="px-4 py-3 text-center text-gray-500">
                                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                                <span className="text-sm">Searching tags...</span>
                            </div>
                        )}

                        {!isSearching && suggestions.length > 0 && suggestions.map((tag, index) => (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => handleSelectTag(tag)}
                                className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center ${index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                                    }`}
                            >
                                <Hash className="w-4 h-4 mr-2 text-gray-400" />
                                <span className="font-medium">{tag.name}</span>
                                {tag.description && (
                                    <span className="ml-2 text-xs text-gray-500 truncate">
                                        {tag.description}
                                    </span>
                                )}
                            </button>
                        ))}

                        {!isSearching && inputValue.trim() &&
                            !suggestions.some(tag => tag.name.toLowerCase() === inputValue.toLowerCase()) && (
                                <button
                                    type="button"
                                    onClick={() => handleCreateNewTag(inputValue.trim())}
                                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center border-t border-gray-200 ${selectedIndex === suggestions.length ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                                        }`}
                                >
                                    <Plus className="w-4 h-4 mr-2 text-gray-400" />
                                    <span>Create new tag: <strong>"{inputValue.trim()}"</strong></span>
                                </button>
                            )}

                        {!isSearching && suggestions.length === 0 && inputValue.trim() && (
                            <div className="px-4 py-3 text-center text-gray-500">
                                <span className="text-sm">No existing tags found</span>
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

export default AutoTagsInput
