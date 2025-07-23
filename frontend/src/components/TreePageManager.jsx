import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Search,
    Plus,
    RefreshCw,
    Filter,
    Scissors,
    FolderPlus,
    AlertCircle,
    Loader2,
    X,
    Save
} from 'lucide-react'
import {
    getRootPages,
    getPageChildren,
    movePage,
    deletePage,
    pageTreeUtils,
    searchAllPages
} from '../api/pages'
import { api } from '../api/client.js'
import PageTreeNode from './PageTreeNode'
import Tooltip from './Tooltip'
import { useNotificationContext } from './NotificationManager'

// Debounce hook for search
const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])

    return debouncedValue
}

const TreePageManager = ({ onEditPage }) => {
    // State management
    const [pages, setPages] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [statusFilter, setStatusFilter] = useState('all')
    const [cutPageId, setCutPageId] = useState(null)
    const [expandedPages, setExpandedPages] = useState(new Set())
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showRootPageModal, setShowRootPageModal] = useState(false)
    const [positioningParams, setPositioningParams] = useState(null)
    const [searchResults, setSearchResults] = useState([])
    const [isSearching, setIsSearching] = useState(false)

    const queryClient = useQueryClient()
    const { showError } = useNotificationContext()

    // Debounce search term to avoid excessive API calls
    const debouncedSearchTerm = useDebounce(searchTerm, 300)

    // Function to expand parent pages of search results
    const expandSearchResultParents = useCallback(async (results) => {
        if (!results || results.length === 0) return

        // Extract all parent page IDs from hierarchy paths
        const parentIds = new Set()
        results.forEach(result => {
            if (result.hierarchy_path && Array.isArray(result.hierarchy_path)) {
                result.hierarchy_path.forEach(parent => {
                    parentIds.add(parent.id)
                })
            }
        })

        // Expand all parent pages
        setExpandedPages(prev => new Set([...prev, ...parentIds]))
    }, [setExpandedPages])

    // Create page mutation
    const createPageMutation = useMutation({
        mutationFn: async (pageData) => {
            const response = await api.post('/api/v1/webpages/pages/', pageData)
            return response.data
        },
        onSuccess: (newPage) => {
            setShowCreateModal(false)
            setPositioningParams(null)
            // Invalidate queries to refresh data
            queryClient.invalidateQueries(['pages', 'root'])
        },
        onError: (error) => {
            console.error('Failed to create page:', error.response?.data?.detail || error.message)
            showError(error, 'error')
        }
    })

    // Create root page mutation
    const createRootPageMutation = useMutation({
        mutationFn: async (pageData) => {
            const response = await api.post('/api/v1/webpages/pages/', pageData)
            return response.data
        },
        onSuccess: (newPage) => {
            setShowRootPageModal(false)
            // Invalidate queries to refresh data
            queryClient.invalidateQueries(['pages', 'root'])
        },
        onError: (error) => {
            console.error('Failed to create root page:', error.response?.data?.detail || error.message)
            showError(error, 'error')
        }
    })

    // Fetch root pages
    const {
        data: rootPagesData,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['pages', 'root', { search: debouncedSearchTerm, status: statusFilter }],
        queryFn: () => {
            const filters = {}
            if (debouncedSearchTerm) filters.search = debouncedSearchTerm
            if (statusFilter !== 'all') filters.publication_status = statusFilter
            return getRootPages(filters)
        },
        enabled: !debouncedSearchTerm, // Only fetch root pages when not searching
        staleTime: 30000, // Cache for 30 seconds
        refetchOnWindowFocus: false
    })

    // Comprehensive search query
    const {
        data: searchData,
        isLoading: searchLoading,
        error: searchError
    } = useQuery({
        queryKey: ['pages', 'search', { search: debouncedSearchTerm, status: statusFilter }],
        queryFn: () => {
            const filters = {}
            if (statusFilter !== 'all') filters.publication_status = statusFilter
            return searchAllPages(debouncedSearchTerm, filters)
        },
        enabled: !!debouncedSearchTerm && debouncedSearchTerm.length >= 2, // Only search when term is 2+ characters
        staleTime: 30000 // Cache search results for 30 seconds
    })

    // Move page mutation
    const movePageMutation = useMutation({
        mutationFn: ({ pageId, parentId, sortOrder }) =>
            movePage(pageId, parentId, sortOrder),
        onSuccess: () => {
            // Invalidate relevant queries to refresh data
            queryClient.invalidateQueries(['pages', 'root'])
            queryClient.invalidateQueries(['page-children'])
        },
        onError: (error) => {
            console.error('Failed to move page: ' + error.message)
            showError(error, 'error')
        }
    })

    // Delete page mutation
    const deletePageMutation = useMutation({
        mutationFn: deletePage,
        onSuccess: () => {
            // Invalidate relevant queries to refresh data
            queryClient.invalidateQueries(['pages', 'root'])
            queryClient.invalidateQueries(['page-children'])
        },
        onError: (error) => {
            console.error('Failed to delete page: ' + error.message)
            showError(error, 'error')
        }
    })

    // Update pages when data changes
    useEffect(() => {
        if (rootPagesData?.results) {
            // Format pages for tree display
            const formattedPages = rootPagesData.results.map(page => ({
                ...pageTreeUtils.formatPageForTree(page),
                isExpanded: true // Auto-expand all first-level pages
            }))
            setPages(formattedPages)

            // Add all first-level page IDs to expanded set
            const firstLevelPageIds = rootPagesData.results.map(page => page.id)
            setExpandedPages(new Set(firstLevelPageIds))

            // Auto-load children for first-level pages that have children
            const pagesWithChildren = rootPagesData.results.filter(page => page.children_count > 0)
            pagesWithChildren.forEach(async (page) => {
                try {
                    const childrenData = await getPageChildren(page.id)

                    // Check if childrenData has the expected structure
                    if (!childrenData || !childrenData.results) {
                        console.warn(`Invalid children data structure for page ${page.id}:`, childrenData)
                        return
                    }

                    const children = childrenData.results.map(child => pageTreeUtils.formatPageForTree(child))

                    // Update the specific page node with its children
                    setPages(prevPages => {
                        return updatePageInTree(prevPages, page.id, (p) => ({
                            ...p,
                            children: children,
                            childrenLoaded: true,
                            isExpanded: true
                        }))
                    })

                    // Cache the children data in React Query for invalidation
                    queryClient.setQueryData(['page-children', page.id], childrenData)
                } catch (error) {
                    console.error(`Failed to load children for page ${page.id}:`, error)
                    showError(error, 'error')
                }
            })
        }
    }, [rootPagesData, queryClient])

    // Process search results
    useEffect(() => {
        if (searchData?.results && debouncedSearchTerm) {
            setIsSearching(true)
            setSearchResults(searchData.results)

            // Auto-expand parent pages of search results
            expandSearchResultParents(searchData.results)
        } else if (!debouncedSearchTerm) {
            setIsSearching(false)
            setSearchResults([])
        }
    }, [searchData, debouncedSearchTerm, expandSearchResultParents])

    // Helper function to refresh child pages for a specific parent
    const refreshChildPages = useCallback(async (parentId) => {
        try {
            const childrenData = await getPageChildren(parentId)
            const children = childrenData.results.map(child => pageTreeUtils.formatPageForTree(child))

            // Update the parent page with refreshed children
            setPages(prevPages => {
                return updatePageInTree(prevPages, parentId, (page) => ({
                    ...page,
                    children: children,
                    childrenLoaded: true
                }))
            })

            // Update the cached data
            queryClient.setQueryData(['page-children', parentId], childrenData)
        } catch (error) {
            console.error(`Failed to refresh child pages for parent ${parentId}:`, error)
            showError(error, 'error')
        }
    }, [queryClient])

    // Helper function to optimistically update tree structure
    const updatePageInTree = useCallback((pages, pageId, updater) => {
        const updateRecursive = (pageList) => {
            return pageList.map(page => {
                if (page.id === pageId) {
                    return updater(page)
                }
                if (page.children && page.children.length > 0) {
                    return {
                        ...page,
                        children: updateRecursive(page.children)
                    }
                }
                return page
            }).filter(Boolean) // Remove null/undefined pages
        }
        return updateRecursive(pages)
    }, [])

    // Callback function for PageTreeNode to update page data
    const updatePageData = useCallback((pageId, updates) => {
        setPages(prevPages => {
            return updatePageInTree(prevPages, pageId, (page) => ({
                ...page,
                ...updates
            }))
        })
    }, [updatePageInTree])

    // Load children for a specific page
    const loadChildren = useCallback(async (pageId) => {
        try {
            const childrenData = await getPageChildren(pageId)
            const children = childrenData.results.map(child => pageTreeUtils.formatPageForTree(child))

            // Update only the specific page node with its children
            setPages(prevPages => {
                return updatePageInTree(prevPages, pageId, (page) => ({
                    ...page,
                    children: children,
                    childrenLoaded: true,
                    isExpanded: true
                }))
            })

            setExpandedPages(prev => new Set([...prev, pageId]))

            // Cache the children data in React Query for invalidation
            queryClient.setQueryData(['page-children', pageId], childrenData)
        } catch (error) {
            console.error('Failed to load child pages')
            showError(error, 'error')
            throw error
        }
    }, [updatePageInTree, queryClient])

    // Handle expand/collapse
    const handleExpand = useCallback((pageId) => {
        setExpandedPages(prev => new Set([...prev, pageId]))
    }, [])

    const handleCollapse = useCallback((pageId) => {
        setExpandedPages(prev => {
            const newSet = new Set(prev)
            newSet.delete(pageId)
            return newSet
        })
    }, [])

    // Cut/Copy/Paste handlers
    const handleCut = useCallback((pageId) => {
        setCutPageId(pageId)
    }, [])

    const handlePaste = useCallback(async (targetPageId, pasteMode = 'child') => {
        const sourcePageId = cutPageId
        if (!sourcePageId) return

        try {
            let newParentId = null
            let newSortOrder = 0

            // Calculate new parent and sort order based on paste mode
            if (pasteMode === 'child') {
                newParentId = targetPageId
                newSortOrder = 0
            } else if (pasteMode === 'top' || pasteMode === 'bottom') {
                newParentId = null
                newSortOrder = pasteMode === 'top' ? -1 : 999999
            } else if (pasteMode === 'above' || pasteMode === 'below') {
                const targetPage = pages.find(p => p.id === targetPageId)
                newParentId = targetPage?.parent?.id || null
                newSortOrder = pasteMode === 'above' ?
                    pageTreeUtils.calculateSortOrderAbove([], targetPage) :
                    pageTreeUtils.calculateSortOrderBelow([], targetPage)
            }

            // Call the API
            await movePageMutation.mutateAsync({
                pageId: cutPageId,
                parentId: newParentId,
                sortOrder: newSortOrder
            })

            setCutPageId(null)
        } catch (error) {
            console.error('Failed to move page')
            showError(error, 'error')
        }
    }, [cutPageId, pages, movePageMutation])

    // Delete handler
    const handleDelete = useCallback(async (pageId) => {
        try {
            await deletePageMutation.mutateAsync(pageId)
        } catch (error) {
            console.error('Delete error:', error)
            showError(error, 'error')
        }
    }, [deletePageMutation])

    // Edit handler
    const handleEdit = useCallback((page) => {
        if (onEditPage) {
            onEditPage(page)
        } else {
            console.log('Page editing functionality needs to be implemented')
        }
    }, [onEditPage])

    // Add child page handler
    const handleAddPageBelow = useCallback((targetPage) => {
        if (onEditPage) {
            onEditPage(null, {
                parentPage: targetPage,
                parentId: targetPage.id,
                suggestedSortOrder: 0
            })
        } else {
            setPositioningParams({
                parentPage: targetPage,
                parentId: targetPage.id,
                suggestedSortOrder: 0
            })
            setShowCreateModal(true)
        }
    }, [onEditPage])

    // Handle create new page
    const handleCreateNewPage = useCallback(() => {
        if (onEditPage) {
            onEditPage(null)
        } else {
            setPositioningParams(null)
            setShowCreateModal(true)
        }
    }, [onEditPage])

    // Handle create root page
    const handleCreateRootPage = useCallback(() => {
        setShowRootPageModal(true)
    }, [])

    // Clear clipboard
    const clearClipboard = () => {
        setCutPageId(null)
    }

    if (error) {
        return (
            <div className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load pages</h3>
                <p className="text-gray-600 mb-4">{error.message}</p>
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Try Again
                </button>
            </div>
        )
    }

    // Handle search error
    if (searchError && searchTerm) {
        return (
            <div className="p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Search failed</h3>
                <p className="text-gray-600 mb-4">{searchError.message}</p>
                <button
                    onClick={() => setSearchTerm('')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Clear Search
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="border-b border-gray-200 p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Page Tree Manager</h2>
                    <div className="flex items-center gap-2">
                        <Tooltip text="Add root page" position="top">
                            <button
                                data-testid="add-root-page-button"
                                onClick={handleCreateRootPage}
                                className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        <Tooltip text="Refresh" position="top">
                            <button
                                data-testid="refresh-button"
                                onClick={() => refetch()}
                                className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                disabled={isLoading}
                            >
                                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {/* Search and filters */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                        <Tooltip text="Search pages" position="top">
                            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 cursor-help">
                                <Search className="w-4 h-4 text-gray-400" />
                            </div>
                        </Tooltip>
                        <input
                            type="text"
                            placeholder="Search pages..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <button
                        data-testid="filter-button"
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-lg border transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
                    >
                        <Filter className="w-4 h-4" />
                    </button>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <label className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">Status:</span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-1 border border-gray-300 rounded text-sm"
                            >
                                <option value="all">All</option>
                                <option value="published">Published</option>
                                <option value="unpublished">Unpublished</option>
                                <option value="scheduled">Scheduled</option>
                            </select>
                        </label>
                    </div>
                )}
            </div>

            {/* Tree content */}
            <div className="flex-1 overflow-auto">
                {(isLoading || searchLoading) ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-600">
                            {searchLoading ? 'Searching pages...' : 'Loading pages...'}
                        </span>
                    </div>
                ) : pages.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">
                        <Tooltip text="No pages found" position="top">
                            <div className="cursor-help inline-block">
                                <FolderPlus className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                            </div>
                        </Tooltip>
                        <p>
                            {searchTerm ? 'No pages found matching your search' : 'No pages found'}
                        </p>
                        {searchTerm ? (
                            <div className="mt-4">
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                    Clear Search
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4">
                                <button
                                    onClick={handleCreateNewPage}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4 inline mr-2" />
                                    Create First Page
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-2">
                        {searchTerm && searchResults.length > 0 && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Search className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-medium text-blue-800">
                                            Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{debouncedSearchTerm}"
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="text-blue-600 hover:text-blue-800 text-sm"
                                    >
                                        Clear Search
                                    </button>
                                </div>
                            </div>
                        )}
                        {pages.map(page => (
                            <PageTreeNode
                                key={page.id}
                                page={page}
                                level={0}
                                onExpand={handleExpand}
                                onCollapse={handleCollapse}
                                onLoadChildren={loadChildren}
                                onEdit={handleEdit}
                                onCut={handleCut}
                                onPaste={handlePaste}
                                onDelete={handleDelete}
                                onAddPageBelow={handleAddPageBelow}
                                cutPageId={cutPageId}
                                onRefreshChildren={refreshChildPages}
                                isSearchMode={!!searchTerm}
                                searchTerm={searchTerm}
                                onUpdatePageData={updatePageData}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
                <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                        {pages.length} root page{pages.length !== 1 ? 's' : ''}
                        {searchTerm && ' (filtered)'}
                    </span>
                    <div className="flex items-center gap-4">
                        <span>Cut to move pages • Use + (purple) to add root pages • Use + (green) on pages to add child pages</span>
                    </div>
                </div>
            </div>

            {/* Page Creation Modal */}
            {showCreateModal && (
                <PageCreationModal
                    positioningParams={positioningParams}
                    onSave={(pageData) => {
                        // Add positioning params to page data if available
                        const finalPageData = { ...pageData }
                        if (positioningParams) {
                            finalPageData.parent_id = positioningParams.parentId
                            finalPageData.sort_order = positioningParams.suggestedSortOrder
                        }
                        createPageMutation.mutate(finalPageData)
                    }}
                    onCancel={() => {
                        setShowCreateModal(false)
                        setPositioningParams(null)
                    }}
                    isLoading={createPageMutation.isPending}
                />
            )}

            {/* Root Page Creation Modal */}
            {showRootPageModal && (
                <RootPageCreationModal
                    onSave={(pageData) => {
                        createRootPageMutation.mutate(pageData)
                    }}
                    onCancel={() => {
                        setShowRootPageModal(false)
                    }}
                    isLoading={createRootPageMutation.isPending}
                />
            )}
        </div>
    )
}

// Simple page creation modal component
const PageCreationModal = ({ positioningParams, onSave, onCancel, isLoading }) => {
    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        description: '',
        publication_status: 'unpublished'
    })

    const generateSlug = (title) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
    }

    const handleTitleChange = (e) => {
        const title = e.target.value
        setFormData(prev => ({
            ...prev,
            title,
            // Auto-generate slug if it's empty or matches the previous auto-generated slug
            slug: (!prev.slug || prev.slug === generateSlug(prev.title))
                ? generateSlug(title)
                : prev.slug
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.title.trim()) {
            console.error('Page title is required')
            return
        }
        if (!formData.slug.trim()) {
            console.error('Page slug is required')
            return
        }
        onSave(formData)
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-gray-900">
                        {positioningParams ?
                            `Add Child Page to "${positioningParams.parentPage.title}"` :
                            'Create New Page'
                        }
                    </h3>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="page-title" className="block text-sm font-medium text-gray-700 mb-1">
                            Page Title *
                        </label>
                        <input
                            id="page-title"
                            type="text"
                            value={formData.title}
                            onChange={handleTitleChange}
                            placeholder="Enter page title"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="page-slug" className="block text-sm font-medium text-gray-700 mb-1">
                            URL Slug *
                        </label>
                        <input
                            id="page-slug"
                            type="text"
                            value={formData.slug}
                            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                            placeholder="page-url-slug"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="page-description" className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            id="page-description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Enter page description"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="publication-status" className="block text-sm font-medium text-gray-700 mb-1">
                            Publication Status
                        </label>
                        <select
                            id="publication-status"
                            value={formData.publication_status}
                            onChange={(e) => setFormData(prev => ({ ...prev, publication_status: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="unpublished">Unpublished</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="published">Published</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>

                    {positioningParams && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <p className="text-sm text-blue-800">
                                This page will be created as a child page under "{positioningParams.parentPage.title}".
                            </p>
                        </div>
                    )}

                    <div className="flex items-center justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isLoading ? 'Creating...' : 'Create Page'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// Root page creation modal component with hosts field
const RootPageCreationModal = ({ onSave, onCancel, isLoading }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        hostnames: '',
        publication_status: 'unpublished'
    })

    const generateSlug = (title) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!formData.title.trim()) {
            console.error('Page title is required')
            return
        }
        if (!formData.hostnames.trim()) {
            console.error('At least one hostname is required for root pages')
            return
        }

        // Auto-generate slug from title
        const slug = generateSlug(formData.title)

        // Parse hostnames from comma-separated string
        const hostnamesArray = formData.hostnames
            .split(',')
            .map(h => h.trim())
            .filter(h => h.length > 0)

        const pageData = {
            title: formData.title,
            slug: slug,
            description: formData.description,
            publication_status: formData.publication_status,
            hostnames: hostnamesArray,
            parent_id: null // Root pages have no parent
        }

        onSave(pageData)
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-gray-900">
                        Create Root Page
                    </h3>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-500"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="root-page-title" className="block text-sm font-medium text-gray-700 mb-1">
                            Page Title *
                        </label>
                        <input
                            id="root-page-title"
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter page title"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            URL slug will be automatically generated from the title
                        </p>
                    </div>

                    <div>
                        <label htmlFor="root-page-hostnames" className="block text-sm font-medium text-gray-700 mb-1">
                            Hostnames *
                        </label>
                        <input
                            id="root-page-hostnames"
                            type="text"
                            value={formData.hostnames}
                            onChange={(e) => setFormData(prev => ({ ...prev, hostnames: e.target.value }))}
                            placeholder="example.com, www.example.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Enter hostnames separated by commas. Root pages need at least one hostname.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="root-page-description" className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            id="root-page-description"
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Enter page description"
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="root-publication-status" className="block text-sm font-medium text-gray-700 mb-1">
                            Publication Status
                        </label>
                        <select
                            id="root-publication-status"
                            value={formData.publication_status}
                            onChange={(e) => setFormData(prev => ({ ...prev, publication_status: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="unpublished">Unpublished</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="published">Published</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-md p-3">
                        <p className="text-sm text-purple-800">
                            Root pages are top-level pages that can be accessed directly via hostnames.
                            They serve as entry points to your site.
                        </p>
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {isLoading ? 'Creating...' : 'Create Root Page'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default TreePageManager 