import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Hash, Search, Loader2, Tag } from 'lucide-react'
import { mediaApi } from '../../api'

const MediaSearchWidget = ({
    searchTerms = [],
    onChange,
    disabled = false,
    namespace,
    placeholder = "Search by title or tags...",
    autoSearch = true, // Auto-trigger search after typing (debounced)
    autoSearchDelay = 500 // Delay in ms for auto-search (debounce)
}) => {
    const [inputValue, setInputValue] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [availableTags, setAvailableTags] = useState([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSearching, setIsSearching] = useState(false)
    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)
    const searchTimeoutRef = useRef(null)
    const autoSearchTimeoutRef = useRef(null)

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
            if (autoSearchTimeoutRef.current) {
                clearTimeout(autoSearchTimeoutRef.current);
            }
        };
    }, []);

    // Filter suggestions to exclude already selected search terms (case-insensitive)
    const suggestions = availableTags
        .filter(tag =>
            !searchTerms.some(term =>
                term.value.toLowerCase() === tag.name.toLowerCase()
            )
        )
        .slice(0, 10)

    const handleInputChange = (e) => {
        const value = e.target.value
        setInputValue(value)
        setShowSuggestions(value.length > 0)
        setSelectedIndex(-1)

        // Trigger server-side search for tag suggestions
        searchTags(value)

        // Auto-search: trigger search when user types
        if (autoSearch) {
            // Clear existing auto-search timeout
            if (autoSearchTimeoutRef.current) {
                clearTimeout(autoSearchTimeoutRef.current);
            }

            // Set new auto-search timeout
            autoSearchTimeoutRef.current = setTimeout(() => {
                // Update search with current text value (keep it in input, don't make pill)
                triggerTextSearch(inputRef.current ? inputRef.current.value.trim() : value.trim())
            }, autoSearchDelay);
        }
    }

    // Trigger text search without creating a pill
    const triggerTextSearch = (text) => {
        // Get current tag terms (exclude text type)
        const tagTerms = searchTerms.filter(term => term.type === 'tag')

        // Create new search terms array with tags plus new text (if any)
        const newSearchTerms = text.trim()
            ? [...tagTerms, { value: text.trim(), type: 'text' }]
            : tagTerms

        onChange(newSearchTerms)
    }

    const handleKeyDown = (e) => {
        if (!showSuggestions || isSearching) {
            if (e.key === 'Enter') {
                e.preventDefault()
                // Just trigger search with current text, don't close suggestions
                triggerTextSearch(inputValue.trim())
            }
            return
        }

        // Only show tag suggestions in dropdown
        const totalOptions = suggestions.length

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
                if (selectedIndex >= 0 && selectedIndex < suggestions.length && suggestions[selectedIndex]) {
                    // Selected an existing tag - add as tag pill
                    addTagTerm(suggestions[selectedIndex].name)
                } else {
                    // No selection, just search with text (don't add pill)
                    triggerTextSearch(inputValue.trim())
                }
                break
            case 'Escape':
                setShowSuggestions(false)
                setSelectedIndex(-1)
                break
        }
    }

    const addTagTerm = (tagName) => {
        if (!tagName) return

        // Normalize tag name for comparison
        const normalizedValue = tagName.trim()

        // Check for duplicates (case-insensitive) in current tag terms
        const isDuplicate = searchTerms.some(existingTerm =>
            existingTerm.type === 'tag' && existingTerm.value.toLowerCase() === normalizedValue.toLowerCase()
        )
        if (isDuplicate) return

        // Get current search terms
        const tagTerms = searchTerms.filter(term => term.type === 'tag')
        const textTerms = searchTerms.filter(term => term.type === 'text')

        // Add new tag
        const newSearchTerms = [
            ...tagTerms,
            { value: normalizedValue, type: 'tag' },
            ...textTerms
        ]

        onChange(newSearchTerms)

        // Don't clear input - keep text search active
        setShowSuggestions(false)
        setSelectedIndex(-1)
    }

    const removeSearchTerm = (termToRemove) => {
        if (termToRemove.type === 'tag') {
            // Remove tag pill
            const newSearchTerms = searchTerms.filter(term =>
                !(term.type === 'tag' && term.value === termToRemove.value)
            )
            onChange(newSearchTerms)
        }
        // Don't handle text type removal - text stays in input field
    }

    const handleSuggestionClick = (tag) => {
        addTagTerm(tag.name)
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

    // Only show tag pills (text search is in the input field)
    const tagTerms = searchTerms.filter(term => term.type === 'tag')

    return (
        <div className="space-y-2">
            {/* Search Input */}
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
                                placeholder={isLoading ? "Loading tags..." : isSearching ? "Searching..." : placeholder}
                                disabled={disabled || isLoading}
                            />
                        </div>
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
                                    <Hash className="w-4 h-4 mr-2 text-blue-500" />
                                    <span className="font-medium">{tag.name}</span>
                                    <Tag className="w-3 h-3 ml-2 text-blue-400" />
                                    {tag.usageCount > 0 && (
                                        <span className="ml-auto text-xs text-gray-500">
                                            {tag.usageCount} uses
                                        </span>
                                    )}
                                </button>
                            ))}

                            {/* Show no results message */}
                            {!isSearching && suggestions.length === 0 && (
                                <div className="px-4 py-3 text-center text-gray-500">
                                    <span className="text-sm">No matching tags found. Press Enter to search text.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Selected Tag Pills (text search stays in input field) */}
            {tagTerms.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {tagTerms.map((term, index) => (
                        <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                        >
                            <Hash className="w-3 h-3 mr-1" />
                            {term.value}
                            {!disabled && (
                                <button
                                    onClick={() => removeSearchTerm(term)}
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

            {/* Help Text */}
            <div className="text-xs text-gray-500 mt-1">
                {disabled
                    ? "Search terms help filter your media files"
                    : isLoading
                        ? "Loading available tags..."
                        : isSearching
                            ? "Searching for tags..."
                            : "Type to search files by text. Click tags to add filters (blue pills). Multiple tags work as AND filters."
                }
            </div>
        </div>
    )
}

export default MediaSearchWidget
