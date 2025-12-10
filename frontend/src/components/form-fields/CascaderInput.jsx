import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen, Check, Search } from 'lucide-react'

/**
 * CascaderInput Component
 * 
 * Hierarchical tree selection component for nested data structures.
 * Supports breadcrumb navigation, search, and multiple selection modes.
 */
const CascaderInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Select from hierarchy...',
    options = [],
    multiple = false,
    showSearch = true,
    expandTrigger = 'click', // 'click' or 'hover'
    changeOnSelect = false, // Change value when selecting intermediate nodes
    displayRender = (labels) => labels.join(' > '),
    searchPlaceholder = 'Search options...',
    ...props
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedNodes, setExpandedNodes] = useState(new Set())
    const [activePath, setActivePath] = useState([])
    const [hoveredPath, setHoveredPath] = useState([])

    const containerRef = useRef(null)
    const searchInputRef = useRef(null)

    // Default hierarchical data if none provided
    const defaultOptions = options.length > 0 ? options : [
        {
            value: 'technology',
            label: 'Technology',
            children: [
                {
                    value: 'frontend',
                    label: 'Frontend',
                    children: [
                        { value: 'react', label: 'React' },
                        { value: 'vue', label: 'Vue.js' },
                        { value: 'angular', label: 'Angular' }
                    ]
                },
                {
                    value: 'backend',
                    label: 'Backend',
                    children: [
                        { value: 'nodejs', label: 'Node.js' },
                        { value: 'python', label: 'Python' },
                        { value: 'java', label: 'Java' }
                    ]
                }
            ]
        },
        {
            value: 'design',
            label: 'Design',
            children: [
                { value: 'ui', label: 'UI Design' },
                { value: 'ux', label: 'UX Research' },
                { value: 'graphics', label: 'Graphic Design' }
            ]
        }
    ]

    // Flatten options for search
    const flattenOptions = (opts, path = []) => {
        const flattened = []

        opts.forEach(option => {
            const currentPath = [...path, option]
            flattened.push({
                ...option,
                path: currentPath,
                pathLabels: currentPath.map(p => p.label),
                searchText: currentPath.map(p => p.label).join(' ')
            })

            if (option.children) {
                flattened.push(...flattenOptions(option.children, currentPath))
            }
        })

        return flattened
    }

    const flatOptions = useMemo(() => flattenOptions(defaultOptions), [defaultOptions])

    // Filter options based on search
    const filteredOptions = useMemo(() => {
        if (!searchTerm.trim()) return defaultOptions

        const query = searchTerm.toLowerCase()
        const matching = flatOptions.filter(option =>
            option.searchText.toLowerCase().includes(query)
        )

        // Build tree structure from matching items
        const tree = {}
        matching.forEach(option => {
            let current = tree
            option.path.forEach((pathItem, index) => {
                if (!current[pathItem.value]) {
                    current[pathItem.value] = {
                        ...pathItem,
                        children: {},
                        isLeaf: index === option.path.length - 1
                    }
                }
                current = current[pathItem.value].children
            })
        })

        // Convert back to array format
        const convertToArray = (obj) => {
            return Object.values(obj).map(item => ({
                value: item.value,
                label: item.label,
                children: Object.keys(item.children).length > 0 ? convertToArray(item.children) : undefined
            }))
        }

        return convertToArray(tree)
    }, [searchTerm, flatOptions, defaultOptions])

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleNodeClick = (option, path) => {
        const fullPath = [...path, option]

        if (option.children && !changeOnSelect) {
            // Expand/collapse node
            const nodeKey = fullPath.map(p => p.value).join('.')
            setExpandedNodes(prev => {
                const newSet = new Set(prev)
                if (newSet.has(nodeKey)) {
                    newSet.delete(nodeKey)
                } else {
                    newSet.add(nodeKey)
                }
                return newSet
            })
        } else {
            // Select option
            const selectedValue = fullPath.map(p => p.value)
            const selectedLabels = fullPath.map(p => p.label)

            if (multiple) {
                const currentValues = Array.isArray(value) ? value : []
                const valueExists = currentValues.some(v =>
                    Array.isArray(v) ? v.join('.') === selectedValue.join('.') : v === selectedValue[selectedValue.length - 1]
                )

                if (valueExists) {
                    // Remove value
                    const newValues = currentValues.filter(v =>
                        Array.isArray(v) ? v.join('.') !== selectedValue.join('.') : v !== selectedValue[selectedValue.length - 1]
                    )
                    onChange(newValues)
                } else {
                    // Add value
                    onChange([...currentValues, selectedValue])
                }
            } else {
                onChange(selectedValue)
                setIsOpen(false)
            }
        }
    }

    const renderNode = (option, path = [], level = 0) => {
        const fullPath = [...path, option]
        const nodeKey = fullPath.map(p => p.value).join('.')
        const isExpanded = expandedNodes.has(nodeKey)
        const hasChildren = option.children && option.children.length > 0

        // Check if selected
        const isSelected = multiple
            ? Array.isArray(value) && value.some(v =>
                Array.isArray(v) ? v.join('.') === fullPath.map(p => p.value).join('.') : false
            )
            : Array.isArray(value) && value.join('.') === fullPath.map(p => p.value).join('.')

        return (
            <div key={option.value}>
                <button
                    type="button"
                    onClick={() => handleNodeClick(option, path)}
                    className={`
                        w-full flex items-center space-x-2 px-3 py-2 text-left transition-colors
                        ${isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'}
                    `}
                    style={{ paddingLeft: `${12 + level * 20}px` }}
                >
                    {hasChildren ? (
                        isExpanded ? (
                            <FolderOpen className="w-4 h-4 text-blue-500" />
                        ) : (
                            <Folder className="w-4 h-4 text-gray-500" />
                        )
                    ) : (
                        <div className="w-4 h-4 flex items-center justify-center">
                            {isSelected && <Check className="w-3 h-3 text-blue-600" />}
                        </div>
                    )}

                    <span className="flex-1 truncate">{option.label}</span>

                    {hasChildren && (
                        <ChevronRight
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''
                                }`}
                        />
                    )}
                </button>

                {hasChildren && isExpanded && (
                    <div>
                        {option.children.map(child =>
                            renderNode(child, fullPath, level + 1)
                        )}
                    </div>
                )}
            </div>
        )
    }

    const getDisplayValue = () => {
        if (!value) return ''

        if (multiple) {
            const values = Array.isArray(value) ? value : []
            return values.map(v => {
                if (Array.isArray(v)) {
                    const option = flatOptions.find(opt =>
                        opt.path.map(p => p.value).join('.') === v.join('.')
                    )
                    return option ? displayRender(option.pathLabels) : v.join(' > ')
                }
                return String(v)
            }).join(', ')
        }

        if (Array.isArray(value)) {
            const option = flatOptions.find(opt =>
                opt.path.map(p => p.value).join('.') === value.join('.')
            )
            return option ? displayRender(option.pathLabels) : value.join(' > ')
        }

        return String(value)
    }

    return (
        <div className="space-y-1" ref={containerRef}>
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="relative">
                {/* Display Input */}
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className={`
                        w-full px-3 py-2 border rounded-md text-left focus:outline-none focus:ring-2 focus:ring-blue-500
                        ${hasError ? 'border-red-300' : 'border-gray-300'}
                        ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white hover:border-gray-400'}
                    `}
                >
                    <div className="flex items-center justify-between">
                        <span className={getDisplayValue() ? 'text-gray-900' : 'text-gray-500'}>
                            {getDisplayValue() || placeholder}
                        </span>
                        <ChevronDown
                            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''
                                }`}
                        />
                    </div>
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                        {/* Search */}
                        {showSearch && (
                            <div className="p-2 border-b border-gray-200">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder={searchPlaceholder}
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Options Tree */}
                        <div className="max-h-64 overflow-y-auto">
                            {filteredOptions.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">
                                    <Folder className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                                    <div className="text-sm">No options available</div>
                                </div>
                            ) : (
                                <div className="py-1">
                                    {filteredOptions.map(option => renderNode(option))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {/* Selection Summary */}
            {multiple && Array.isArray(value) && value.length > 0 && (
                <div className="text-xs text-gray-500">
                    {value.length} item{value.length !== 1 ? 's' : ''} selected
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

CascaderInput.displayName = 'CascaderInput'

export default CascaderInput
