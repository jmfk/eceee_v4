import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Custom hook for managing tree state with efficient updates and caching
 * Provides better state management for hierarchical data structures
 */
export const useTreeState = () => {
    const [expandedPages, setExpandedPages] = useState(new Set())
    const [loadedChildren, setLoadedChildren] = useState(new Set())
    const [pageData, setPageData] = useState(new Map()) // pageId -> page data
    const [treeStructure, setTreeStructure] = useState([]) // root pages array
    const [lastUpdate, setLastUpdate] = useState(Date.now())

    const queryClient = useQueryClient()
    const updateQueue = useRef(new Set())
    const updateTimeout = useRef(null)

    // Batch updates to prevent excessive re-renders
    const batchUpdate = useCallback(() => {
        if (updateQueue.current.size > 0) {
            setLastUpdate(Date.now())
            updateQueue.current.clear()
        }
    }, [])

    // Schedule a batched update
    const scheduleUpdate = useCallback(() => {
        if (updateTimeout.current) {
            clearTimeout(updateTimeout.current)
        }
        updateTimeout.current = setTimeout(batchUpdate, 16) // ~60fps
    }, [batchUpdate])

    // Add page to the tree state
    const addPage = useCallback((page) => {
        setPageData(prev => {
            const newMap = new Map(prev)
            newMap.set(page.id, page)
            return newMap
        })
        updateQueue.current.add(page.id)
        scheduleUpdate()
    }, [scheduleUpdate])

    // Update page in the tree state
    const updatePage = useCallback((pageId, updates) => {
        setPageData(prev => {
            const newMap = new Map(prev)
            const existing = newMap.get(pageId)
            if (existing) {
                newMap.set(pageId, { ...existing, ...updates })
                updateQueue.current.add(pageId)
                scheduleUpdate()
            }
            return newMap
        })
    }, [scheduleUpdate])

    // Remove page from the tree state
    const removePage = useCallback((pageId) => {
        setPageData(prev => {
            const newMap = new Map(prev)
            newMap.delete(pageId)
            return newMap
        })
        updateQueue.current.add(pageId)
        scheduleUpdate()
    }, [scheduleUpdate])

    // Expand a page
    const expandPage = useCallback((pageId) => {
        setExpandedPages(prev => {
            if (prev.has(pageId)) return prev
            const newSet = new Set(prev)
            newSet.add(pageId)
            return newSet
        })
    }, [])

    // Collapse a page
    const collapsePage = useCallback((pageId) => {
        setExpandedPages(prev => {
            if (!prev.has(pageId)) return prev
            const newSet = new Set(prev)
            newSet.delete(pageId)
            return newSet
        })
    }, [])

    // Mark children as loaded
    const markChildrenLoaded = useCallback((pageId) => {
        setLoadedChildren(prev => {
            if (prev.has(pageId)) return prev
            const newSet = new Set(prev)
            newSet.add(pageId)
            return newSet
        })
    }, [])

    // Get page data
    const getPage = useCallback((pageId) => {
        return pageData.get(pageId)
    }, [pageData])

    // Get all pages
    const getAllPages = useCallback(() => {
        return Array.from(pageData.values())
    }, [pageData])

    // Check if page is expanded
    const isPageExpanded = useCallback((pageId) => {
        return expandedPages.has(pageId)
    }, [expandedPages])

    // Check if page children are loaded
    const areChildrenLoaded = useCallback((pageId) => {
        return loadedChildren.has(pageId)
    }, [loadedChildren])

    // Build tree structure from page data with memoization
    const buildTree = useCallback((rootPages) => {
        if (!rootPages || rootPages.length === 0) return []

        const buildNode = (page) => {
            const pageData = getPage(page.id) || page
            const isExpanded = expandedPages.has(page.id)
            const childrenLoaded = loadedChildren.has(page.id)

            return {
                ...pageData,
                isExpanded,
                childrenLoaded,
                children: childrenLoaded && isExpanded ?
                    (pageData.children || []).map(buildNode) : []
            }
        }

        return rootPages.map(buildNode)
    }, [getPage, expandedPages, loadedChildren])

    // Update tree structure
    const updateTreeStructure = useCallback((newStructure) => {
        setTreeStructure(newStructure)
    }, [])

    // Bulk update pages
    const bulkUpdatePages = useCallback((updates) => {
        setPageData(prev => {
            const newMap = new Map(prev)
            updates.forEach(({ pageId, updates: pageUpdates }) => {
                const existing = newMap.get(pageId)
                if (existing) {
                    newMap.set(pageId, { ...existing, ...pageUpdates })
                    updateQueue.current.add(pageId)
                }
            })
            return newMap
        })
        scheduleUpdate()
    }, [scheduleUpdate])

    // Clear all state
    const clearState = useCallback(() => {
        setExpandedPages(new Set())
        setLoadedChildren(new Set())
        setPageData(new Map())
        setTreeStructure([])
        updateQueue.current.clear()
        if (updateTimeout.current) {
            clearTimeout(updateTimeout.current)
        }
    }, [])

    // Get tree statistics
    const getTreeStats = useCallback(() => {
        return {
            totalPages: pageData.size,
            expandedPages: expandedPages.size,
            loadedChildren: loadedChildren.size,
            treeStructureLength: treeStructure.length,
            lastUpdate
        }
    }, [pageData.size, expandedPages.size, loadedChildren.size, treeStructure.length, lastUpdate])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (updateTimeout.current) {
                clearTimeout(updateTimeout.current)
            }
        }
    }, [])

    return {
        // State
        expandedPages,
        loadedChildren,
        pageData,
        treeStructure,
        lastUpdate,

        // Actions
        addPage,
        updatePage,
        removePage,
        expandPage,
        collapsePage,
        markChildrenLoaded,
        updateTreeStructure,
        bulkUpdatePages,
        clearState,

        // Getters
        getPage,
        getAllPages,
        isPageExpanded,
        areChildrenLoaded,
        buildTree,
        getTreeStats
    }
}

/**
 * Hook for managing page updates with optimistic updates and cache invalidation
 */
export const usePageUpdates = () => {
    const queryClient = useQueryClient()

    // Update page in all relevant caches
    const updatePageInCache = useCallback((pageId, updates) => {
        // Update all page-related cache entries
        const cacheKeys = [
            ['pages', 'root'],
            ['pages', 'search'],
            ['page-children']
        ]

        cacheKeys.forEach(key => {
            queryClient.setQueriesData(key, (oldData) => {
                if (!oldData) return oldData

                const updatePageInResults = (results) => {
                    return results.map(p => {
                        if (p.id === pageId) {
                            return { ...p, ...updates }
                        }
                        if (p.children && p.children.length > 0) {
                            return { ...p, children: updatePageInResults(p.children) }
                        }
                        return p
                    })
                }

                return {
                    ...oldData,
                    results: updatePageInResults(oldData.results)
                }
            })
        })
    }, [queryClient])

    // Invalidate specific page caches
    const invalidatePageCaches = useCallback((pageId) => {
        queryClient.invalidateQueries(['pages', 'root'])
        queryClient.invalidateQueries(['page-children', pageId])
        queryClient.invalidateQueries(['pages', 'search'])
    }, [queryClient])

    // Optimistic update with rollback capability
    const optimisticUpdate = useCallback(async (pageId, updates, apiCall) => {
        // Store original data for potential rollback
        const originalData = queryClient.getQueryData(['pages', 'root'])

        // Apply optimistic update
        updatePageInCache(pageId, updates)

        try {
            // Make API call
            const result = await apiCall()

            // Update with actual response data
            updatePageInCache(pageId, result)

            return result
        } catch (error) {
            // Rollback on error
            if (originalData) {
                queryClient.setQueryData(['pages', 'root'], originalData)
            }
            throw error
        }
    }, [queryClient, updatePageInCache])

    return {
        updatePageInCache,
        invalidatePageCaches,
        optimisticUpdate
    }
}

/**
 * Hook for managing tree refresh operations
 */
export const useTreeRefresh = () => {
    const queryClient = useQueryClient()
    const refreshTimeout = useRef(null)

    // Debounced refresh function
    const debouncedRefresh = useCallback((callback, delay = 500) => {
        if (refreshTimeout.current) {
            clearTimeout(refreshTimeout.current)
        }

        refreshTimeout.current = setTimeout(() => {
            callback()
        }, delay)
    }, [])

    // Refresh specific page and its children
    const refreshPage = useCallback((pageId) => {
        queryClient.invalidateQueries(['page-children', pageId])
        queryClient.invalidateQueries(['pages', 'root'])
    }, [queryClient])

    // Refresh entire tree
    const refreshTree = useCallback(() => {
        queryClient.invalidateQueries(['pages', 'root'])
        queryClient.invalidateQueries(['page-children'])
        queryClient.invalidateQueries(['pages', 'search'])
    }, [queryClient])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (refreshTimeout.current) {
                clearTimeout(refreshTimeout.current)
            }
        }
    }, [])

    return {
        debouncedRefresh,
        refreshPage,
        refreshTree
    }
} 