import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Plus, Hash, Search, Loader2, Tag } from 'lucide-react'
import { mediaApi } from '../../api'

const MediaSearchWidget = ({
    searchTerms = [],
    onChange,
    disabled = false,
    namespace,
    placeholder = "Search media files..."
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

        // Trigger server-side search
        searchTags(value)
    }

    const handleKeyDown = (e) => {
        if (!showSuggestions || isSearching) {
            if (e.key === 'Enter') {
                e.preventDefault()
                addSearchTerm(inputValue.trim())
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
                        addSearchTerm(suggestions[selectedIndex].name, 'tag')
                    } else if (hasCreateOption && selectedIndex === suggestions.length) {
                        // Selected the "create new" option
                        addSearchTerm(inputValue.trim(), 'text')
                    }
                } else {
                    // No selection, create new search term
                    addSearchTerm(inputValue.trim(), 'text')
                }
                break
            case 'Escape':
                setShowSuggestions(false)
                setSelectedIndex(-1)
                break
        }
    }

    const addSearchTerm = async (termValue, termType = null) => {
        if (!termValue) return

        // Normalize term value for comparison
        const normalizedValue = termValue.trim()

        // Check for duplicates (case-insensitive) in current search terms
        const isDuplicate = searchTerms.some(existingTerm =>
            existingTerm.value.toLowerCase() === normalizedValue.toLowerCase()
        )
        if (isDuplicate) return

        // Determine if this is a tag or free text
        let type = termType
        if (!type) {
            // Check if this term exists in our available tags
            const existingTag = availableTags.find(tag =>
                tag.name.toLowerCase() === normalizedValue.toLowerCase()
            )
            type = existingTag ? 'tag' : 'text'
        }

        // Create new search term object
        const newTerm = {
            value: normalizedValue,
            type: type // 'tag' for existing tags, 'text' for free text
        }

        const newSearchTerms = [...searchTerms, newTerm]
        onChange(newSearchTerms)
        setInputValue('')
        setShowSuggestions(false)
        setSelectedIndex(-1)
    }

    const removeSearchTerm = (termToRemove) => {
        const newSearchTerms = searchTerms.filter(term =>
            term.value !== termToRemove.value
        )
        onChange(newSearchTerms)
    }

    const handleSuggestionClick = (tag) => {
        addSearchTerm(tag.name, 'tag')
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

    // Get pill styling based on term type
    const getPillStyling = (term) => {
        if (term.type === 'tag') {
            return "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
        } else {
            return "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800"
        }
    }

    // Get icon for term type
    const getTermIcon = (term) => {
        if (term.type === 'tag') {
            return <Hash className="w-3 h-3 mr-1" />
        } else {
            return <Search className="w-3 h-3 mr-1" />
        }
    }

    return (
        <div className="space-y-2">
            {/* Selected Search Terms Display */}
            {searchTerms.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {searchTerms.map((term, index) => (
                        <span
                            key={index}
                            className={getPillStyling(term)}
                        >
                            {getTermIcon(term)}
                            {term.value}
                            {!disabled && (
                                <button
                                    onClick={() => removeSearchTerm(term)}
                                    className={`ml-2 ${term.type === 'tag' ? 'text-blue-600 hover:text-blue-800' : 'text-gray-600 hover:text-gray-800'}`}
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
                        {inputValue.trim() && (
                            <button
                                type="button"
                                onClick={() => addSearchTerm(inputValue.trim(), 'text')}
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
                            {!isSearching && suggestions.length === 0 && availableTags.length === 0 && (
                                <div className="px-4 py-3 text-center text-gray-500">
                                    <span className="text-sm">No tags found</span>
                                </div>
                            )}

                            {/* Create new search term option */}
                            {!isSearching && inputValue.trim() && !suggestions.some(tag => tag.name.toLowerCase() === inputValue.toLowerCase()) && (
                                <button
                                    type="button"
                                    onClick={() => addSearchTerm(inputValue.trim(), 'text')}
                                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center ${suggestions.length > 0 ? 'border-t border-gray-200' : ''} ${selectedIndex === suggestions.length ? 'bg-gray-50 text-gray-700' : 'text-gray-900'
                                        }`}
                                >
                                    <Search className="w-4 h-4 mr-2 text-gray-400" />
                                    <span>Search for: <strong>"{inputValue.trim()}"</strong></span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Help Text */}
            <p className="text-xs text-gray-500 mt-1">
                {disabled
                    ? "Search terms help filter your media files"
                    : isLoading
                        ? "Loading available tags..."
                        : isSearching
                            ? "Searching for tags..."
                            : "Type to search existing tags (blue pills) or add free text search terms (gray pills). Press Enter or click + to add."
                }
            </p>
        </div>
    )
}

export default MediaSearchWidget
