import { useQuery } from '@tanstack/react-query'
import { useState, useCallback, useMemo } from 'react'
import { objectRelationshipsApi } from '../api/objectStorage'

/**
 * Hook for searching objects to reference
 * Provides debounced search with pagination support
 * 
 * @param {string} searchTerm - Search query
 * @param {string[]} objectTypes - Filter by object type names
 * @param {object} options - Additional options (enabled, page, pageSize)
 * @returns {object} - Query result with results, pagination info, and loading state
 */
export const useSearchObjects = (searchTerm, objectTypes = [], options = {}) => {
    const {
        enabled = true,
        page = 1,
        pageSize = 20
    } = options

    const queryKey = [
        'objects',
        'search',
        searchTerm,
        objectTypes.join(','),
        page,
        pageSize
    ]

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            const params = {
                q: searchTerm,
                object_types: objectTypes.join(','),
                page,
                page_size: pageSize
            }

            const response = await objectRelationshipsApi.searchForReferences(params)
            return response.data
        },
        enabled: enabled && searchTerm?.length > 0,
        staleTime: 30000, // 30 seconds
        cacheTime: 300000, // 5 minutes
    })

    return {
        results: query.data?.results || [],
        count: query.data?.count || 0,
        page: query.data?.page || 1,
        totalPages: query.data?.total_pages || 1,
        hasNext: query.data?.has_next || false,
        hasPrevious: query.data?.has_previous || false,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch
    }
}

/**
 * Hook to fetch minimal object details for selected objects
 * Used to display chips/tags for selected references
 * 
 * @param {number[]} objectIds - Array of object IDs to fetch
 * @param {object} options - Additional options (enabled)
 * @returns {object} - Query result with object details
 */
export const useObjectDetails = (objectIds = [], options = {}) => {
    const { enabled = true } = options

    const queryKey = ['objects', 'details', ...(objectIds || []).sort()]

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            const response = await objectRelationshipsApi.getObjectDetails(objectIds)
            // Response might be paginated, extract results
            const data = response.data?.results || response.data || []

            // Create a map for quick lookup
            const objectMap = {}
            data.forEach(obj => {
                objectMap[obj.id] = {
                    id: obj.id,
                    title: obj.title,
                    slug: obj.slug,
                    objectType: obj.objectType || obj.object_type
                }
            })

            return objectMap
        },
        enabled: enabled && objectIds && objectIds.length > 0,
        staleTime: 60000, // 1 minute
        cacheTime: 300000, // 5 minutes
    })

    return {
        objectMap: query.data || {},
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch
    }
}

/**
 * Hook for managing object reference field with search
 * Combines search and selection logic with debouncing
 * 
 * @param {number|number[]} value - Current field value
 * @param {function} onChange - Callback when value changes
 * @param {object} fieldConfig - Field configuration from schema
 * @returns {object} - Search state and handlers
 */
export const useObjectReferenceField = (value, onChange, fieldConfig = {}) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [searchPage, setSearchPage] = useState(1)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    const {
        multiple = false,
        max_items = null,
        allowed_object_types = []
    } = fieldConfig

    // Normalize value to array
    const valueArray = useMemo(() => {
        if (!value) return []
        return Array.isArray(value) ? value : [value]
    }, [value])

    // Search with current term
    const searchQuery = useSearchObjects(
        searchTerm,
        allowed_object_types,
        {
            enabled: isDropdownOpen && searchTerm.length > 0,
            page: searchPage,
            pageSize: 20
        }
    )

    // Get details for selected objects
    const selectedQuery = useObjectDetails(valueArray, {
        enabled: valueArray.length > 0
    })

    // Add object to selection
    const addObject = useCallback((objectId) => {
        if (multiple) {
            // Check max_items
            if (max_items && valueArray.length >= max_items) {
                return false
            }

            // Add if not already selected
            if (!valueArray.includes(objectId)) {
                onChange([...valueArray, objectId])
                return true
            }
            return false
        } else {
            // Single selection
            onChange(objectId)
            setIsDropdownOpen(false)
            return true
        }
    }, [multiple, max_items, valueArray, onChange])

    // Remove object from selection
    const removeObject = useCallback((objectId) => {
        if (multiple) {
            onChange(valueArray.filter(id => id !== objectId))
        } else {
            onChange(null)
        }
    }, [multiple, valueArray, onChange])

    // Reorder objects (for multiple)
    const reorderObjects = useCallback((startIndex, endIndex) => {
        if (!multiple) return

        const result = Array.from(valueArray)
        const [removed] = result.splice(startIndex, 1)
        result.splice(endIndex, 0, removed)

        onChange(result)
    }, [multiple, valueArray, onChange])

    // Clear all selections
    const clearAll = useCallback(() => {
        onChange(multiple ? [] : null)
    }, [multiple, onChange])

    // Handle search input change (debounced externally via component)
    const handleSearchChange = useCallback((term) => {
        setSearchTerm(term)
        setSearchPage(1) // Reset to first page
    }, [])

    // Toggle dropdown
    const toggleDropdown = useCallback(() => {
        setIsDropdownOpen(prev => !prev)
    }, [])

    const closeDropdown = useCallback(() => {
        setIsDropdownOpen(false)
        setSearchTerm('')
        setSearchPage(1)
    }, [])

    return {
        // Selection state
        selectedIds: valueArray,
        selectedObjects: selectedQuery.objectMap,
        isLoadingSelected: selectedQuery.isLoading,

        // Search state
        searchTerm,
        searchResults: searchQuery.results,
        isSearching: searchQuery.isLoading,
        searchError: searchQuery.error,
        searchPage,
        totalSearchPages: searchQuery.totalPages,
        hasNextPage: searchQuery.hasNext,
        hasPreviousPage: searchQuery.hasPrevious,

        // Dropdown state
        isDropdownOpen,

        // Handlers
        addObject,
        removeObject,
        reorderObjects,
        clearAll,
        handleSearchChange,
        setSearchPage,
        toggleDropdown,
        closeDropdown,

        // Computed properties
        canAddMore: !max_items || valueArray.length < max_items,
        isFull: max_items && valueArray.length >= max_items,
        count: valueArray.length
    }
}

/**
 * Hook for getting reverse references (read-only)
 * 
 * @param {number} objectId - Object ID to get reverse references for
 * @param {string} relationshipType - Relationship type to filter by
 * @param {object} options - Additional options (enabled, reverse_object_types)
 * @returns {object} - Query result with reverse references
 */
export const useReverseReferences = (objectId, relationshipType, options = {}) => {
    const { enabled = true, reverse_object_types = [] } = options

    const queryKey = [
        'objects',
        objectId,
        'reverse_references',
        relationshipType
    ]

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            const response = await objectRelationshipsApi.getRelatedFromObjects(
                objectId,
                relationshipType
            )

            // Filter by object types if specified
            let objects = response.data?.related_from_objects || []

            if (reverse_object_types.length > 0) {
                objects = objects.filter(obj =>
                    reverse_object_types.includes(obj.object?.object_type?.name)
                )
            }

            return {
                objects,
                count: objects.length
            }
        },
        enabled: enabled && !!objectId && !!relationshipType,
        staleTime: 30000, // 30 seconds
        cacheTime: 300000, // 5 minutes
    })

    return {
        objects: query.data?.objects || [],
        count: query.data?.count || 0,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch
    }
}

