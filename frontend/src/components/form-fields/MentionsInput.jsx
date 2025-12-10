import React, { useState, useRef, useEffect, useCallback } from 'react'
import { AtSign, Hash, User, Tag } from 'lucide-react'

/**
 * MentionsInput Component
 * 
 * Rich text input with @mentions and #hashtag support.
 * Provides autocomplete for users and topics within text areas.
 */
const MentionsInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Type @ to mention users or # for topics...',
    rows = 4,
    users = [],
    topics = [],
    onUserSearch = null, // Function to search users async
    onTopicSearch = null, // Function to search topics async
    mentionStyle = 'highlight', // 'highlight' or 'chip'
    maxSuggestions = 5,
    ...props
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [suggestionType, setSuggestionType] = useState(null) // 'user' or 'topic'
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [cursorPosition, setCursorPosition] = useState(0)
    const [mentionStart, setMentionStart] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')

    const textareaRef = useRef(null)
    const suggestionsRef = useRef(null)

    // Default users and topics if none provided
    const defaultUsers = users.length > 0 ? users : [
        { id: 1, username: 'john_doe', name: 'John Doe', avatar: null },
        { id: 2, username: 'jane_smith', name: 'Jane Smith', avatar: null },
        { id: 3, username: 'bob_wilson', name: 'Bob Wilson', avatar: null },
        { id: 4, username: 'alice_brown', name: 'Alice Brown', avatar: null },
    ]

    const defaultTopics = topics.length > 0 ? topics : [
        { id: 1, name: 'javascript', label: 'JavaScript' },
        { id: 2, name: 'react', label: 'React' },
        { id: 3, name: 'design', label: 'Design' },
        { id: 4, name: 'frontend', label: 'Frontend' },
        { id: 5, name: 'backend', label: 'Backend' },
    ]

    // Parse mentions and hashtags from text
    const parseMentions = useCallback((text) => {
        const mentions = []
        const hashtags = []

        // Find @mentions
        const mentionRegex = /@(\w+)/g
        let match
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push({
                type: 'user',
                username: match[1],
                start: match.index,
                end: match.index + match[0].length
            })
        }

        // Find #hashtags
        const hashtagRegex = /#(\w+)/g
        while ((match = hashtagRegex.exec(text)) !== null) {
            hashtags.push({
                type: 'topic',
                topic: match[1],
                start: match.index,
                end: match.index + match[0].length
            })
        }

        return { mentions, hashtags }
    }, [])

    // Handle text change and detect mention triggers
    const handleTextChange = (e) => {
        const newValue = e.target.value
        const cursorPos = e.target.selectionStart

        onChange(newValue)
        setCursorPosition(cursorPos)

        // Check for mention triggers
        const textBeforeCursor = newValue.substring(0, cursorPos)
        const lastAtIndex = textBeforeCursor.lastIndexOf('@')
        const lastHashIndex = textBeforeCursor.lastIndexOf('#')

        // Check for @mention
        if (lastAtIndex > -1) {
            const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
            if (!textAfterAt.includes(' ') && textAfterAt.length <= 20) {
                setMentionStart(lastAtIndex)
                setSearchQuery(textAfterAt)
                setSuggestionType('user')
                setIsOpen(true)
                setSelectedIndex(0)
                return
            }
        }

        // Check for #hashtag
        if (lastHashIndex > -1) {
            const textAfterHash = textBeforeCursor.substring(lastHashIndex + 1)
            if (!textAfterHash.includes(' ') && textAfterHash.length <= 20) {
                setMentionStart(lastHashIndex)
                setSearchQuery(textAfterHash)
                setSuggestionType('topic')
                setIsOpen(true)
                setSelectedIndex(0)
                return
            }
        }

        // No active mention/hashtag
        setIsOpen(false)
        setSuggestionType(null)
        setSearchQuery('')
    }

    // Filter suggestions based on search query
    const filteredSuggestions = useMemo(() => {
        if (!searchQuery) {
            return suggestionType === 'user' ? defaultUsers.slice(0, maxSuggestions) : defaultTopics.slice(0, maxSuggestions)
        }

        const query = searchQuery.toLowerCase()

        if (suggestionType === 'user') {
            return defaultUsers.filter(user =>
                user.username.toLowerCase().includes(query) ||
                user.name.toLowerCase().includes(query)
            ).slice(0, maxSuggestions)
        } else {
            return defaultTopics.filter(topic =>
                topic.name.toLowerCase().includes(query) ||
                topic.label.toLowerCase().includes(query)
            ).slice(0, maxSuggestions)
        }
    }, [searchQuery, suggestionType, defaultUsers, defaultTopics, maxSuggestions])

    // Handle suggestion selection
    const handleSuggestionSelect = (suggestion) => {
        const currentText = value || ''
        const beforeMention = currentText.substring(0, mentionStart)
        const afterCursor = currentText.substring(cursorPosition)

        let replacement
        if (suggestionType === 'user') {
            replacement = `@${suggestion.username}`
        } else {
            replacement = `#${suggestion.name}`
        }

        const newText = beforeMention + replacement + ' ' + afterCursor
        const newCursorPos = beforeMention.length + replacement.length + 1

        onChange(newText)
        setIsOpen(false)
        setSuggestionType(null)
        setSearchQuery('')

        // Set cursor position after replacement
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
                textareaRef.current.focus()
            }
        }, 0)
    }

    // Keyboard navigation for suggestions
    const handleKeyDown = (e) => {
        if (!isOpen || filteredSuggestions.length === 0) return

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1))
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => Math.max(prev - 1, 0))
                break
            case 'Enter':
            case 'Tab':
                e.preventDefault()
                if (filteredSuggestions[selectedIndex]) {
                    handleSuggestionSelect(filteredSuggestions[selectedIndex])
                }
                break
            case 'Escape':
                e.preventDefault()
                setIsOpen(false)
                setSuggestionType(null)
                break
        }
    }

    // Render text with highlighted mentions and hashtags
    const renderHighlightedText = () => {
        if (!value || mentionStyle !== 'highlight') return null

        const { mentions, hashtags } = parseMentions(value)
        const allMentions = [...mentions, ...hashtags].sort((a, b) => a.start - b.start)

        if (allMentions.length === 0) return null

        const parts = []
        let lastEnd = 0

        allMentions.forEach((mention, index) => {
            // Add text before mention
            if (mention.start > lastEnd) {
                parts.push(
                    <span key={`text-${index}`}>
                        {value.substring(lastEnd, mention.start)}
                    </span>
                )
            }

            // Add highlighted mention
            const mentionText = value.substring(mention.start, mention.end)
            parts.push(
                <span
                    key={`mention-${index}`}
                    className={`
                        ${mention.type === 'user'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-purple-100 text-purple-800 border-purple-200'
                        }
                        px-1 rounded border
                    `}
                >
                    {mentionText}
                </span>
            )

            lastEnd = mention.end
        })

        // Add remaining text
        if (lastEnd < value.length) {
            parts.push(
                <span key="text-end">
                    {value.substring(lastEnd)}
                </span>
            )
        }

        return parts
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
                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={value || ''}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    placeholder={placeholder}
                    rows={rows}
                    className={`
                        w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none
                        ${hasError ? 'border-red-300' : 'border-gray-300'}
                        ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}
                    `}
                    {...props}
                />

                {/* Suggestions Dropdown */}
                {isOpen && filteredSuggestions.length > 0 && (
                    <div
                        ref={suggestionsRef}
                        className="absolute z-10 mt-1 bg-white border border-gray-300 rounded-md shadow-lg w-64"
                    >
                        <div className="py-1">
                            <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                {suggestionType === 'user' ? 'Mention User' : 'Add Topic'}
                            </div>
                            {filteredSuggestions.map((suggestion, index) => (
                                <button
                                    key={suggestion.id}
                                    type="button"
                                    onClick={() => handleSuggestionSelect(suggestion)}
                                    className={`
                                        w-full px-3 py-2 text-left flex items-center space-x-3 transition-colors
                                        ${index === selectedIndex ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'}
                                    `}
                                >
                                    {suggestionType === 'user' ? (
                                        <>
                                            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                                                <User className="w-3 h-3 text-gray-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{suggestion.name}</div>
                                                <div className="text-sm text-gray-500 truncate">@{suggestion.username}</div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <Tag className="w-4 h-4 text-purple-500" />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">#{suggestion.name}</div>
                                                <div className="text-sm text-gray-500 truncate">{suggestion.label}</div>
                                            </div>
                                        </>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Mention Guide */}
            <div className="flex items-center space-x-4 text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                    <AtSign className="w-3 h-3" />
                    <span>Type @ to mention users</span>
                </div>
                <div className="flex items-center space-x-1">
                    <Hash className="w-3 h-3" />
                    <span>Type # for topics</span>
                </div>
            </div>

            {/* Highlighted Preview */}
            {mentionStyle === 'highlight' && value && (
                <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                    <div className="text-gray-600 mb-1">Preview:</div>
                    <div className="leading-relaxed">
                        {renderHighlightedText()}
                    </div>
                </div>
            )}

            {description && (
                <div className="text-sm text-gray-500">{description}</div>
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

MentionsInput.displayName = 'MentionsInput'

export default MentionsInput
