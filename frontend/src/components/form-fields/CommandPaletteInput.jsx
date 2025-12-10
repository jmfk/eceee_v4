import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Search, Command, ArrowRight, Hash, User, Settings, Zap, ChevronRight } from 'lucide-react'

/**
 * CommandPaletteInput Component
 * 
 * Global command palette with fuzzy search for actions, navigation, and quick operations.
 * Supports keyboard navigation, categories, and custom action handlers.
 */
const CommandPaletteInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Search commands...',
    actions = [],
    categories = ['Actions', 'Navigation', 'Settings'],
    maxResults = 10,
    showCategories = true,
    showIcons = true,
    onActionSelect = () => { },
    ...props
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [recentActions, setRecentActions] = useState([])
    const inputRef = useRef(null)
    const listRef = useRef(null)

    // Default actions if none provided
    const defaultActions = [
        { id: 'new-page', label: 'Create New Page', category: 'Actions', icon: 'Plus', description: 'Create a new page' },
        { id: 'new-widget', label: 'Add Widget', category: 'Actions', icon: 'Plus', description: 'Add a new widget' },
        { id: 'save', label: 'Save Changes', category: 'Actions', icon: 'Save', description: 'Save current changes' },
        { id: 'publish', label: 'Publish Page', category: 'Actions', icon: 'Upload', description: 'Publish the current page' },
        { id: 'settings', label: 'Open Settings', category: 'Settings', icon: 'Settings', description: 'Open application settings' },
        { id: 'theme', label: 'Theme Editor', category: 'Settings', icon: 'Palette', description: 'Open theme editor' },
        { id: 'dashboard', label: 'Go to Dashboard', category: 'Navigation', icon: 'Home', description: 'Navigate to dashboard' },
        { id: 'pages', label: 'View All Pages', category: 'Navigation', icon: 'FileText', description: 'View all pages' },
        { id: 'media', label: 'Media Library', category: 'Navigation', icon: 'Image', description: 'Open media library' },
        { id: 'users', label: 'User Management', category: 'Navigation', icon: 'Users', description: 'Manage users' },
    ]

    const allActions = actions.length > 0 ? actions : defaultActions

    // Fuzzy search implementation
    const fuzzySearch = (query, text) => {
        if (!query) return { score: 1, matches: [] }

        const queryLower = query.toLowerCase()
        const textLower = text.toLowerCase()

        // Exact match gets highest score
        if (textLower.includes(queryLower)) {
            return { score: 10, matches: [queryLower] }
        }

        // Fuzzy matching
        let score = 0
        let queryIndex = 0
        const matches = []

        for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
            if (textLower[i] === queryLower[queryIndex]) {
                score += 1
                matches.push(textLower[i])
                queryIndex++
            }
        }

        // Bonus for matching all characters
        if (queryIndex === queryLower.length) {
            score += 5
        }

        return { score, matches }
    }

    // Filter and sort actions based on search term
    const filteredActions = useMemo(() => {
        if (!searchTerm.trim()) {
            // Show recent actions first, then all actions
            const recent = recentActions.slice(0, 3)
            const remaining = allActions.filter(action =>
                !recent.some(r => r.id === action.id)
            ).slice(0, maxResults - recent.length)

            return [...recent, ...remaining]
        }

        // Fuzzy search and score
        const scored = allActions.map(action => {
            const labelMatch = fuzzySearch(searchTerm, action.label)
            const descMatch = fuzzySearch(searchTerm, action.description || '')
            const categoryMatch = fuzzySearch(searchTerm, action.category || '')

            const totalScore = labelMatch.score * 3 + descMatch.score + categoryMatch.score

            return {
                ...action,
                score: totalScore,
                matches: [...labelMatch.matches, ...descMatch.matches, ...categoryMatch.matches]
            }
        })

        return scored
            .filter(action => action.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
    }, [searchTerm, allActions, recentActions, maxResults])

    // Group actions by category
    const groupedActions = useMemo(() => {
        if (!showCategories) return { 'All': filteredActions }

        const groups = {}
        filteredActions.forEach(action => {
            const category = action.category || 'Other'
            if (!groups[category]) groups[category] = []
            groups[category].push(action)
        })

        return groups
    }, [filteredActions, showCategories])

    // Close palette when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (inputRef.current && !inputRef.current.parentElement?.contains(event.target)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!isOpen) return

            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault()
                    setSelectedIndex(prev => Math.min(prev + 1, filteredActions.length - 1))
                    break
                case 'ArrowUp':
                    event.preventDefault()
                    setSelectedIndex(prev => Math.max(prev - 1, 0))
                    break
                case 'Enter':
                    event.preventDefault()
                    if (filteredActions[selectedIndex]) {
                        handleActionSelect(filteredActions[selectedIndex])
                    }
                    break
                case 'Escape':
                    event.preventDefault()
                    setIsOpen(false)
                    setSearchTerm('')
                    break
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, selectedIndex, filteredActions])

    // Reset selected index when search term changes
    useEffect(() => {
        setSelectedIndex(0)
    }, [searchTerm])

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value)
        if (!isOpen) setIsOpen(true)
    }

    const handleInputFocus = () => {
        setIsOpen(true)
    }

    const handleActionSelect = (action) => {
        // Add to recent actions
        setRecentActions(prev => {
            const filtered = prev.filter(a => a.id !== action.id)
            return [action, ...filtered].slice(0, 5)
        })

        // Update form value
        onChange(action.id)

        // Call action handler
        onActionSelect(action)

        // Close palette
        setIsOpen(false)
        setSearchTerm('')
    }

    const getActionIcon = (iconName) => {
        const icons = {
            Plus: '+',
            Save: '💾',
            Upload: '📤',
            Settings: '⚙️',
            Palette: '🎨',
            Home: '🏠',
            FileText: '📄',
            Image: '🖼️',
            Users: '👥',
        }
        return icons[iconName] || '⚡'
    }

    const highlightMatches = (text, matches) => {
        if (!matches || matches.length === 0) return text

        // Simple highlighting - in a real implementation you might want more sophisticated highlighting
        let highlighted = text
        matches.forEach(match => {
            const regex = new RegExp(`(${match})`, 'gi')
            highlighted = highlighted.replace(regex, '<mark>$1</mark>')
        })

        return <span dangerouslySetInnerHTML={{ __html: highlighted }} />
    }

    const hasError = validation && !validation.isValid

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="relative">
                {/* Command Input */}
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Command className="h-4 w-4 text-gray-400" />
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={handleInputChange}
                        onFocus={handleInputFocus}
                        disabled={disabled}
                        placeholder={placeholder}
                        className={`
                            w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
                            ${hasError ? 'border-red-300' : 'border-gray-300'}
                            ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}
                        `}
                        {...props}
                    />

                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <kbd className="px-1 py-0.5 text-xs font-mono bg-gray-100 border border-gray-300 rounded">
                            ⌘K
                        </kbd>
                    </div>
                </div>

                {/* Command Palette Dropdown */}
                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
                        {filteredActions.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                <Search className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                                <div className="text-sm">No commands found</div>
                                {searchTerm && (
                                    <div className="text-xs mt-1">Try a different search term</div>
                                )}
                            </div>
                        ) : (
                            <div className="py-2">
                                {Object.entries(groupedActions).map(([category, categoryActions]) => (
                                    <div key={category}>
                                        {showCategories && categoryActions.length > 0 && (
                                            <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                                {category}
                                            </div>
                                        )}
                                        {categoryActions.map((action, actionIndex) => {
                                            const globalIndex = filteredActions.findIndex(a => a.id === action.id)
                                            const isSelected = globalIndex === selectedIndex

                                            return (
                                                <button
                                                    key={action.id}
                                                    type="button"
                                                    onClick={() => handleActionSelect(action)}
                                                    className={`
                                                        w-full px-3 py-2 text-left flex items-center space-x-3 transition-colors
                                                        ${isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'}
                                                    `}
                                                >
                                                    {showIcons && (
                                                        <span className="text-lg">
                                                            {getActionIcon(action.icon)}
                                                        </span>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium">
                                                            {highlightMatches(action.label, action.matches)}
                                                        </div>
                                                        {action.description && (
                                                            <div className="text-sm text-gray-500 truncate">
                                                                {action.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isSelected && (
                                                        <ChevronRight className="w-4 h-4 text-blue-600" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="border-t border-gray-100 px-3 py-2 bg-gray-50">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center space-x-4">
                                    <span className="flex items-center space-x-1">
                                        <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded">↑↓</kbd>
                                        <span>navigate</span>
                                    </span>
                                    <span className="flex items-center space-x-1">
                                        <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded">⏎</kbd>
                                        <span>select</span>
                                    </span>
                                    <span className="flex items-center space-x-1">
                                        <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded">esc</kbd>
                                        <span>close</span>
                                    </span>
                                </div>
                                <span>{filteredActions.length} commands</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* Current Selection Display */}
            {value && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    <span className="text-blue-600 font-medium">Selected: </span>
                    <span className="text-blue-800">
                        {allActions.find(a => a.id === value)?.label || value}
                    </span>
                </div>
            )}

            {/* Recent Actions */}
            {!isOpen && recentActions.length > 0 && (
                <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">Recent:</div>
                    <div className="flex flex-wrap gap-1">
                        {recentActions.slice(0, 3).map(action => (
                            <button
                                key={action.id}
                                type="button"
                                onClick={() => handleActionSelect(action)}
                                disabled={disabled}
                                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
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
        </div>
    )
}

// Global keyboard shortcut handler (optional)
export const useCommandPalette = (onOpen) => {
    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
                event.preventDefault()
                onOpen?.()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [onOpen])
}

CommandPaletteInput.displayName = 'CommandPaletteInput'

export default CommandPaletteInput
