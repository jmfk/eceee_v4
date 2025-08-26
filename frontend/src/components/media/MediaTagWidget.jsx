import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Plus, Hash, Search, Loader2 } from 'lucide-react'
import { mediaApi } from '../../api'

const MediaTagWidget = ({ tags = [], onChange, disabled = false, namespace }) => {
    const [inputValue, setInputValue] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [availableTags, setAvailableTags] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)
    const searchTimeoutRef = useRef(null)

    // Debounced search function for server-side tag lookup
    const searchTags = useCallback(async (searchQuery) => {
        if (!namespace) return;

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Don't search for empty queries
        if (!searchQuery.trim()) {
            setAvailableTags([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        // Debounce the search by 300ms
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const result = await mediaApi.tags.list({
                    namespace,
                    search: searchQuery.trim(),
                    page_size: 20 // Limit results for performance
                })();
                const tags = result.results || result || [];
                setAvailableTags(Array.isArray(tags) ? tags : []);
            } catch (error) {
                console.error('Failed to search media tags:', error);
                setAvailableTags([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);
    }, [namespace]);

    // Load initial tags when namespace changes (optional - could be removed if you want search-only)
    useEffect(() => {
        const loadInitialTags = async () => {
            if (!namespace) return;

            setIsLoading(true);
            try {
                const result = await mediaApi.tags.list({
                    namespace,
                    page_size: 10 // Just get a few popular tags initially
                })();
                const tags = result.results || result || [];
                setAvailableTags(Array.isArray(tags) ? tags : []);
            } catch (error) {
                console.error('Failed to load initial media tags:', error);
                setAvailableTags([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialTags();
    }, [namespace]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    // Filter suggestions to exclude already selected tags (case-insensitive)
    // Server-side search already handles the text filtering
    const suggestions = availableTags
        .filter(tag =>
            !tags.some(existingTag => existingTag.toLowerCase() === tag.name.toLowerCase())
        )
        .slice(0, 10)

    const handleInputChange = (e) => {
        const value = e.target.value
        setInputValue(value)
        setShowSuggestions(value.length > 0)
        setSelectedIndex(-1)

        // Trigger server-side search
        searchTags(value)
    }

    const handleKeyDown = (e) => {
        if (!showSuggestions || isSearching) {
            if (e.key === 'Enter') {
                e.preventDefault()
                addTag(inputValue.trim())
            }
            return
        }

        // Calculate total options (suggestions + create new option if applicable)
        const hasCreateOption = inputValue.trim() && !suggestions.some(tag =>
            tag.name.toLowerCase() === inputValue.toLowerCase()
        )
        const totalOptions = suggestions.length + (hasCreateOption ? 1 : 0)

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev =>
                    prev < totalOptions - 1 ? prev + 1 : prev
                )
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
                break
            case 'Enter':
                e.preventDefault()
                if (selectedIndex >= 0) {
                    if (selectedIndex < suggestions.length && suggestions[selectedIndex]) {
                        // Selected an existing tag
                        addTag(suggestions[selectedIndex].name)
                    } else if (hasCreateOption && selectedIndex === suggestions.length) {
                        // Selected the "create new" option
                        addTag(inputValue.trim())
                    }
                } else {
                    // No selection, create new tag
                    addTag(inputValue.trim())
                }
                break
            case 'Escape':
                setShowSuggestions(false)
                setSelectedIndex(-1)
                break
        }
    }

    const addTag = async (tagName) => {
        if (!tagName) return

        // Normalize tag name for comparison
        const normalizedTagName = tagName.trim()

        // Check for duplicates (case-insensitive) in current tags
        const isDuplicate = tags.some(existingTag =>
            existingTag.toLowerCase() === normalizedTagName.toLowerCase()
        )
        if (isDuplicate) return

        // Check if this tag already exists in our available tags
        const existingTag = availableTags.find(tag =>
            tag.name.toLowerCase() === normalizedTagName.toLowerCase()
        )

        if (existingTag) {
            // Tag exists, add it directly
            const newTags = [...tags, existingTag.name]
            onChange(newTags)
            setInputValue('')
            setShowSuggestions(false)
            setSelectedIndex(-1)
            return
        }

        // For media tags, we'll just add the tag name directly
        // The backend will handle creation during approval
        const newTags = [...tags, normalizedTagName]
        onChange(newTags)
        setInputValue('')
        setShowSuggestions(false)
        setSelectedIndex(-1)
    }

    const removeTag = (tagToRemove) => {
        const newTags = tags.filter(tag => tag !== tagToRemove)
        onChange(newTags)
    }

    const handleSuggestionClick = (tag) => {
        addTag(tag.name)
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

    return (
        <div className="space-y-2">
            {/* Selected Tags Display */}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                        <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                        >
                            <Hash className="w-3 h-3 mr-1" />
                            {tag}
                            {!disabled && (
                                <button
                                    onClick={() => removeTag(tag)}
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

            {/* Tag Input */}
            {!disabled && (
                <div className="relative">
                    <div className="flex">
                        <div className="relative flex-1">
                            {isSearching ? (
                                <Loader2 className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 transform -translate-y-1/2 animate-spin" />
                            ) : (
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                            )}
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                                placeholder={isLoading ? "Loading tags..." : isSearching ? "Searching..." : "Add a tag..."}
                                disabled={disabled || isLoading}
                            />
                        </div>
                        {inputValue.trim() && (
                            <button
                                type="button"
                                onClick={() => addTag(inputValue.trim())}
                                className="ml-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isLoading || isSearching}
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && inputValue.trim() && (
                        <div
                            ref={suggestionsRef}
                            className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                        >
                            {/* Show loading state */}
                            {isSearching && (
                                <div className="px-4 py-3 text-center text-gray-500">
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                                    <span className="text-sm">Searching tags...</span>
                                </div>
                            )}

                            {/* Show search results */}
                            {!isSearching && suggestions.length > 0 && suggestions.map((tag, index) => (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => handleSuggestionClick(tag)}
                                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center ${index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                                        }`}
                                >
                                    <Hash className="w-4 h-4 mr-2 text-gray-400" />
                                    <span className="font-medium">{tag.name}</span>
                                    {tag.usageCount > 0 && (
                                        <span className="ml-auto text-xs text-gray-500">
                                            {tag.usageCount} uses
                                        </span>
                                    )}
                                </button>
                            ))}

                            {/* Show no results message */}
                            {!isSearching && suggestions.length === 0 && availableTags.length === 0 && (
                                <div className="px-4 py-3 text-center text-gray-500">
                                    <span className="text-sm">No tags found</span>
                                </div>
                            )}

                            {/* Create new tag option */}
                            {!isSearching && inputValue.trim() && !suggestions.some(tag => tag.name.toLowerCase() === inputValue.toLowerCase()) && (
                                <button
                                    type="button"
                                    onClick={() => addTag(inputValue.trim())}
                                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center ${suggestions.length > 0 ? 'border-t border-gray-200' : ''} ${selectedIndex === suggestions.length ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                                        }`}
                                >
                                    <Plus className="w-4 h-4 mr-2 text-gray-400" />
                                    <span>Create new tag: <strong>"{inputValue.trim()}"</strong></span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Help Text */}
            <p className="text-xs text-gray-500 mt-1">
                {disabled
                    ? "Tags help organize and categorize your media files"
                    : isLoading
                        ? "Loading available tags..."
                        : isSearching
                            ? "Searching for tags..."
                            : "Type to search existing tags or create new ones. Press Enter or click + to add."
                }
            </p>
        </div>
    )
}

export default MediaTagWidget
