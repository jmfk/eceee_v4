import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Hash, Search } from 'lucide-react'
import { tagsApi } from '../api/tags'
import TagConflictModal from './TagConflictModal'

const PageTagWidget = ({ tags = [], onChange, disabled = false }) => {
    const [inputValue, setInputValue] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const [isValidating, setIsValidating] = useState(false)
    const [conflictModal, setConflictModal] = useState({
        isOpen: false,
        conflictedTag: '',
        existingTag: null,
        conflictType: 'duplicate'
    })
    const inputRef = useRef(null)
    const suggestionsRef = useRef(null)
    const queryClient = useQueryClient()

    // Fetch available tags for suggestions
    const { data: availableTagsResponse } = useQuery({
        queryKey: ['tags'],
        queryFn: () => tagsApi.list(),
        enabled: !disabled
    })

    const availableTags = availableTagsResponse?.data?.results || availableTagsResponse?.results || []

    // Filter suggestions based on input and exclude already selected tags (case-insensitive)
    const suggestions = availableTags
        .filter(tag =>
            tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
            !tags.some(existingTag => existingTag.toLowerCase() === tag.name.toLowerCase())
        )
        .slice(0, 10)

    const handleInputChange = (e) => {
        const value = e.target.value
        setInputValue(value)
        setShowSuggestions(value.length > 0)
        setSelectedIndex(-1)
    }

    const handleKeyDown = (e) => {
        if (!showSuggestions) {
            if (e.key === 'Enter') {
                e.preventDefault()
                addTag(inputValue.trim())
            }
            return
        }

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
                    addTag(suggestions[selectedIndex].name)
                } else {
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
        
        // Check for case-insensitive duplicates in current page tags
        const isDuplicate = tags.some(existingTag => 
            existingTag.toLowerCase() === tagName.toLowerCase()
        )
        if (isDuplicate) return

        // Check if this tag already exists in our available tags
        const existingTag = availableTags.find(tag =>
            tag.name.toLowerCase() === tagName.toLowerCase()
        )

        if (existingTag) {
            // Tag exists, check if it's not already in the current page's tags (case-insensitive)
            const isAlreadyAdded = tags.some(tag => 
                tag.toLowerCase() === existingTag.name.toLowerCase()
            )
            if (!isAlreadyAdded) {
                const newTags = [...tags, existingTag.name]
                onChange(newTags)
            }
            // Always clear the input regardless
            setInputValue('')
            setShowSuggestions(false)
            setSelectedIndex(-1)
            return
        }

        // Tag doesn't exist, validate and potentially create it
        setIsValidating(true)
        try {
            const result = await tagsApi.validateAndCreate(tagName)

            if (result.conflict) {
                // Show conflict modal
                setConflictModal({
                    isOpen: true,
                    conflictedTag: tagName,
                    existingTag: result.tag,
                    conflictType: result.conflictType
                })
                        } else if (result.tag) {
                // Tag was created successfully or already exists
                // Double-check that this tag isn't already in the current page's tags (case-insensitive)
                const isAlreadyAdded = tags.some(tag => 
                    tag.toLowerCase() === result.tag.name.toLowerCase()
                )
                if (!isAlreadyAdded) {
                    const newTags = [...tags, result.tag.name]
                    onChange(newTags)
                    setInputValue('')
                    setShowSuggestions(false)
                    setSelectedIndex(-1)
                    
                    // Refresh the tags list to include the new tag
                    queryClient.invalidateQueries(['tags'])
                } else {
                    // Tag is already in the list, just clear the input
                    setInputValue('')
                    setShowSuggestions(false)
                    setSelectedIndex(-1)
                }
            }
        } catch (error) {
            console.error('Error validating/creating tag:', error)
            // Show error in conflict modal
            setConflictModal({
                isOpen: true,
                conflictedTag: tagName,
                existingTag: null,
                conflictType: 'invalid'
            })
        } finally {
            setIsValidating(false)
        }
    }

    const removeTag = (tagToRemove) => {
        const newTags = tags.filter(tag => tag !== tagToRemove)
        onChange(newTags)
    }

    const handleSuggestionClick = (tag) => {
        addTag(tag.name)
    }

    const handleConflictResolve = async (newTagName) => {
        // Try to add the new tag name
        await addTag(newTagName)
    }

    const handleConflictClose = () => {
        setConflictModal({
            isOpen: false,
            conflictedTag: '',
            existingTag: null,
            conflictType: 'duplicate'
        })
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
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
                Tags
            </label>

            {/* Selected Tags Display */}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
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
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                                placeholder={isValidating ? "Validating..." : "Add a tag..."}
                                disabled={disabled || isValidating}
                            />
                        </div>
                        {inputValue.trim() && (
                            <button
                                type="button"
                                onClick={() => addTag(inputValue.trim())}
                                className="ml-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isValidating}
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div
                            ref={suggestionsRef}
                            className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                        >
                            {suggestions.map((tag, index) => (
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

                            {/* Create new tag option */}
                            {inputValue.trim() && !suggestions.some(tag => tag.name.toLowerCase() === inputValue.toLowerCase()) && (
                                <button
                                    type="button"
                                    onClick={() => addTag(inputValue.trim())}
                                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 flex items-center border-t border-gray-200 ${selectedIndex === suggestions.length ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
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
            <p className="text-sm text-gray-500">
                {disabled
                    ? "Tags help organize and categorize your page content"
                    : isValidating
                        ? "Validating tag..."
                        : "Type to search existing tags or create new ones. Press Enter or click + to add."
                }
            </p>

            {/* Tag Conflict Modal */}
            <TagConflictModal
                isOpen={conflictModal.isOpen}
                onClose={handleConflictClose}
                conflictedTag={conflictModal.conflictedTag}
                existingTag={conflictModal.existingTag}
                conflictType={conflictModal.conflictType}
                onResolve={handleConflictResolve}
            />
        </div>
    )
}

export default PageTagWidget
