import React, { useState, useEffect, useRef } from 'react'
import { X, Plus, FolderOpen, Search, Loader2, Folder } from 'lucide-react'
import { mediaApi } from '../../../api'
import { useGlobalNotifications } from '../../../contexts/GlobalNotificationContext'

/**
 * AutoCollectionInput Component
 * 
 * A specialized collection input component for default collection configuration in schema properties.
 * Shows selected collection and allows searching/creating collections from the media manager.
 */
const AutoCollectionInput = ({
    value = null, // Single collection object or null
    onChange,
    namespace = 'default',
    placeholder = 'Search and select a collection...',
    disabled = false,
    label = 'Default Collection',
    helpText = 'Collection where uploaded files will be automatically added'
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

    // Search for collections in media manager
    const searchCollections = async (searchTerm) => {
        if (!searchTerm.trim()) {
            setSuggestions([])
            return
        }

        setIsSearching(true)
        try {
            const response = await mediaApi.collections.list({
                namespace,
                search: searchTerm.trim(),
                pageSize: 10
            })()

            setSuggestions(response.results || [])
        } catch (error) {
            console.error('Failed to search collections:', error)
            setSuggestions([])
        } finally {
            setIsSearching(false)
        }
    }

    // Handle input change with debounced search
    const handleInputChange = (e) => {
        const searchValue = e.target.value
        setInputValue(searchValue)
        setSelectedIndex(-1)

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        if (searchValue.trim()) {
            setShowSuggestions(true)
            searchTimeoutRef.current = setTimeout(() => {
                searchCollections(searchValue)
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
                handleCreateNewCollection(inputValue.trim())
            }
            return
        }

        const totalOptions = suggestions.length + (inputValue.trim() && !suggestions.some(collection =>
            collection.title.toLowerCase() === inputValue.toLowerCase()) ? 1 : 0)

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
                        handleSelectCollection(suggestions[selectedIndex])
                    } else {
                        handleCreateNewCollection(inputValue.trim())
                    }
                } else {
                    handleCreateNewCollection(inputValue.trim())
                }
                break
            case 'Escape':
                setShowSuggestions(false)
                setSelectedIndex(-1)
                break
        }
    }

    // Select existing collection
    const handleSelectCollection = (collection) => {
        onChange(collection)
        setInputValue('')
        setShowSuggestions(false)
        setSelectedIndex(-1)
        setSuggestions([])
    }

    // Create new collection
    const handleCreateNewCollection = async (collectionTitle) => {
        if (!collectionTitle) {
            return
        }

        try {
            const slug = collectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
            const newCollection = await mediaApi.collections.create({
                title: collectionTitle,
                slug: slug,
                namespace,
                description: `Auto-created collection for schema configuration`,
                accessLevel: 'public'
            })()

            onChange(newCollection)
            setInputValue('')
            setShowSuggestions(false)
            setSelectedIndex(-1)
            setSuggestions([])

            addNotification(`Created new collection: ${collectionTitle}`, 'success')
        } catch (error) {
            console.error('Failed to create collection:', error)
            addNotification(`Failed to create collection: ${collectionTitle}`, 'error')
        }
    }

    // Remove collection
    const handleRemoveCollection = () => {
        onChange(null)
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

            {/* Selected Collection Display */}
            {value && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-center">
                        <Folder className="w-5 h-5 text-blue-600 mr-2" />
                        <div>
                            <div className="font-medium text-blue-900">{value.title}</div>
                            {value.description && (
                                <div className="text-sm text-blue-700">{value.description}</div>
                            )}
                        </div>
                    </div>
                    {!disabled && (
                        <button
                            onClick={handleRemoveCollection}
                            className="text-blue-600 hover:text-blue-800"
                            type="button"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}

            {/* Search Input (only show if no collection selected) */}
            {!value && (
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
                                onClick={() => handleCreateNewCollection(inputValue.trim())}
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
                                    <span className="text-sm">Searching collections...</span>
                                </div>
                            )}

                            {!isSearching && suggestions.length > 0 && suggestions.map((collection, index) => (
                                <button
                                    key={collection.id}
                                    type="button"
                                    onClick={() => handleSelectCollection(collection)}
                                    className={`w-full px-4 py-3 text-left hover:bg-gray-100 flex items-start ${index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                                        }`}
                                >
                                    <Folder className="w-5 h-5 mr-3 text-gray-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{collection.title}</div>
                                        {collection.description && (
                                            <div className="text-sm text-gray-500 truncate">
                                                {collection.description}
                                            </div>
                                        )}
                                        {collection.fileCount > 0 && (
                                            <div className="text-xs text-gray-400 mt-1">
                                                {collection.fileCount} files
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}

                            {!isSearching && inputValue.trim() &&
                                !suggestions.some(collection => collection.title.toLowerCase() === inputValue.toLowerCase()) && (
                                    <button
                                        type="button"
                                        onClick={() => handleCreateNewCollection(inputValue.trim())}
                                        className={`w-full px-4 py-3 text-left hover:bg-gray-100 flex items-center border-t border-gray-200 ${selectedIndex === suggestions.length ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
                                            }`}
                                    >
                                        <Plus className="w-4 h-4 mr-3 text-gray-400" />
                                        <span>Create new collection: <strong>"{inputValue.trim()}"</strong></span>
                                    </button>
                                )}

                            {!isSearching && suggestions.length === 0 && inputValue.trim() && (
                                <div className="px-4 py-3 text-center text-gray-500">
                                    <span className="text-sm">No existing collections found</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Help Text */}
            {helpText && (
                <p className="text-xs text-gray-500">
                    {helpText}
                </p>
            )}
        </div>
    )
}

export default AutoCollectionInput
