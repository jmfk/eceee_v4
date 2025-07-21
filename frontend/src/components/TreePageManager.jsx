import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Search,
    Plus,
    RefreshCw,
    Filter,
    Expand,
    Minimize2,
    Scissors,
    FolderPlus,
    AlertCircle,
    Loader2
} from 'lucide-react'
import {
    getRootPages,
    getPageChildren,
    movePage,
    deletePage,
    pageTreeUtils
} from '../api/pages'
import PageTreeNode from './PageTreeNode'
import toast from 'react-hot-toast'
import Tooltip from './Tooltip'

const TreePageManager = ({ onEditPage }) => {
    // State management
    const [pages, setPages] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [statusFilter, setStatusFilter] = useState('all')
    const [cutPageId, setCutPageId] = useState(null)
    const [expandedPages, setExpandedPages] = useState(new Set())

    const queryClient = useQueryClient()

    // Fetch root pages
    const {
        data: rootPagesData,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['pages', 'root', { search: searchTerm, status: statusFilter }],
        queryFn: () => {
            const filters = {}
            if (searchTerm) filters.search = searchTerm
            if (statusFilter !== 'all') filters.publication_status = statusFilter
            return getRootPages(filters)
        }
    })

    // Move page mutation with optimistic updates
    const movePageMutation = useMutation({
        mutationFn: ({ pageId, parentId, sortOrder }) =>
            movePage(pageId, parentId, sortOrder),
        onSuccess: () => {
        },
        onError: (error, variables, context) => {
            // Revert optimistic update on error
            if (context?.previousPages) {
                setPages(context.previousPages)
            }
            console.error('Failed to move page: ' + error.message)
        }
    })

    // Delete page mutation with optimistic updates
    const deletePageMutation = useMutation({
        mutationFn: deletePage,
        onSuccess: () => {
        },
        onError: (error, variables, context) => {
            // Revert optimistic delete on error
            if (context?.previousPages) {
                setPages(context.previousPages)
            }
            console.error('Failed to delete page: ' + error.message)
        }
    })

    // Update pages when data changes
    useEffect(() => {
        if (rootPagesData?.results) {
            setPages(rootPagesData.results.map(page => pageTreeUtils.formatPageForTree(page)))
        }
    }, [rootPagesData])

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

    // Helper function to remove a page from tree
    const removePageFromTree = useCallback((pages, pageId) => {
        const removeRecursive = (pageList) => {
            return pageList.filter(page => page.id !== pageId).map(page => {
                if (page.children && page.children.length > 0) {
                    return {
                        ...page,
                        children: removeRecursive(page.children)
                    }
                }
                return page
            })
        }
        return removeRecursive(pages)
    }, [])

    // Helper function to add a page to tree
    const addPageToTree = useCallback((pages, page, parentId) => {
        const formattedPage = pageTreeUtils.formatPageForTree(page)

        if (!parentId) {
            // Add to root level and sort by sort_order
            const updatedPages = [...pages, formattedPage]
            return updatedPages.sort((a, b) => a.sort_order - b.sort_order)
        }

        const addRecursive = (pageList) => {
            return pageList.map(existingPage => {
                if (existingPage.id === parentId) {
                    // Add to children and sort by sort_order
                    const currentChildren = existingPage.children || []
                    const updatedChildren = [...currentChildren, formattedPage]
                    const sortedChildren = updatedChildren.sort((a, b) => a.sort_order - b.sort_order)

                    return {
                        ...existingPage,
                        children: sortedChildren,
                        children_count: (existingPage.children_count || 0) + 1
                    }
                }
                if (existingPage.children && existingPage.children.length > 0) {
                    return {
                        ...existingPage,
                        children: addRecursive(existingPage.children)
                    }
                }
                return existingPage
            })
        }
        return addRecursive(pages)
    }, [])

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
        } catch (error) {
            console.error('Failed to load child pages')
            throw error
        }
    }, [updatePageInTree])

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

        if (cutPageId) {
            // Move operation with optimistic update
            // Store current state for potential rollback
            const previousPages = [...pages]

            // Find the page being moved and target page
            let movedPage = null
            let targetPage = null
            const findPageRecursive = (pageList) => {
                const results = { moved: null, target: null }
                for (const page of pageList) {
                    if (page.id === cutPageId) {
                        results.moved = page
                    }
                    if (page.id === targetPageId) {
                        results.target = page
                    }
                    if (page.children && page.children.length > 0) {
                        const found = findPageRecursive(page.children)
                        if (found.moved && !results.moved) results.moved = found.moved
                        if (found.target && !results.target) results.target = found.target
                    }
                }
                return results
            }
            const foundPages = findPageRecursive(pages)
            movedPage = foundPages.moved
            targetPage = foundPages.target

            if (!movedPage) {
                console.error('Page not found')
                return
            }

            if (!targetPage && pasteMode !== 'top' && pasteMode !== 'bottom') {
                console.error('Target page not found')
                return
            }

            try {
                let newParentId = null
                let newSortOrder = 0

                // Calculate new parent and sort order based on paste mode
                if (pasteMode === 'child') {
                    // Paste as child of target page
                    newParentId = targetPageId
                    newSortOrder = 0 // Backend will calculate
                } else if (pasteMode === 'top' || pasteMode === 'bottom') {
                    // Paste at root level (top or bottom)
                    newParentId = null

                    // Simple hints - backend will normalize to proper spacing
                    if (pasteMode === 'top') {
                        newSortOrder = -1  // Hint: place at beginning
                    } else { // bottom
                        newSortOrder = 999999  // Hint: place at end
                    }
                } else if (pasteMode === 'above' || pasteMode === 'below') {
                    // Paste as sibling of target page
                    newParentId = targetPage.parent?.id || null

                    // Simple hints - backend will normalize to proper spacing
                    if (pasteMode === 'above') {
                        newSortOrder = pageTreeUtils.calculateSortOrderAbove([], targetPage)
                    } else { // below
                        newSortOrder = pageTreeUtils.calculateSortOrderBelow([], targetPage)
                    }
                }

                // Optimistically update the tree
                // 1. Remove page from its current location
                let updatedPages = removePageFromTree(pages, cutPageId)

                // 2. Update the page's parent and sort order
                const updatedPage = {
                    ...movedPage,
                    parent: newParentId ? { id: newParentId } : null,
                    sort_order: newSortOrder
                }
                // 3. Add page to new location
                if (pasteMode === 'child') {
                    updatedPages = addPageToTree(updatedPages, updatedPage, newParentId)
                } else if (pasteMode === 'top') {
                    // Add to beginning of root pages
                    updatedPages = [pageTreeUtils.formatPageForTree(updatedPage), ...updatedPages]
                } else if (pasteMode === 'bottom') {
                    // Add to end of root pages
                    updatedPages = [...updatedPages, pageTreeUtils.formatPageForTree(updatedPage)]
                } else {
                    // For above/below, we need to add to the same parent as target
                    updatedPages = addPageToTree(updatedPages, updatedPage, newParentId)
                }
                // Update local state immediately
                setPages(updatedPages)

                // Call the API
                await movePageMutation.mutateAsync(
                    {
                        pageId: cutPageId,
                        parentId: newParentId,
                        sortOrder: newSortOrder
                    },
                    {
                        context: { previousPages }
                    }
                )
                setCutPageId(null)
                const pasteMessages = {
                    'child': 'as child',
                    'above': 'above target',
                    'below': 'below target',
                    'top': 'to top of tree',
                    'bottom': 'to bottom of tree'
                }
            } catch (error) {
                console.error('Failed to move page')
                // Error handling (revert) is done in the mutation's onError
            }
        }
    }, [cutPageId, pages, movePageMutation, removePageFromTree, addPageToTree])

    // Delete handler with optimistic update
    const handleDelete = useCallback(async (pageId) => {
        // Store current state for potential rollback
        const previousPages = [...pages]

        try {
            // Optimistically remove page from tree
            const updatedPages = removePageFromTree(pages, pageId)
            setPages(updatedPages)

            // Call the API
            await deletePageMutation.mutateAsync(pageId, {
                context: { previousPages }
            })
        } catch (error) {
            console.error('Delete error:', error)
            // Error handling (revert) is done in the mutation's onError
        }
    }, [pages, deletePageMutation, removePageFromTree])

    // Edit handler
    const handleEdit = useCallback((page) => {
        onEditPage?.(page)
    }, [onEditPage])

    // Expand/collapse all
    const expandAll = () => {
        // This would need to recursively expand all nodes
        toast('Expand all functionality coming soon', {
            icon: 'ℹ️',
            duration: 3000
        })
    }

    const collapseAll = () => {
        setExpandedPages(new Set())
    }

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

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="border-b border-gray-200 p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Page Tree Manager</h2>
                    <div className="flex items-center gap-2">
                        <Tooltip text="Expand all" position="top">
                            <button
                                data-testid="expand-all-button"
                                onClick={expandAll}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                                <Expand className="w-4 h-4" />
                            </button>
                        </Tooltip>
                        <Tooltip text="Collapse all" position="top">
                            <button
                                data-testid="collapse-all-button"
                                onClick={collapseAll}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                                <Minimize2 className="w-4 h-4" />
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
                {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        <span className="ml-2 text-gray-600">Loading pages...</span>
                    </div>
                ) : pages.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">
                        <Tooltip text="No pages found" position="top">
                            <div className="cursor-help inline-block">
                                <FolderPlus className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                            </div>
                        </Tooltip>
                        <p>No pages found</p>
                        {searchTerm && (
                            <p className="text-sm mt-2">Try adjusting your search or filters</p>
                        )}
                    </div>
                ) : (
                    <div className="p-2">
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
                                cutPageId={cutPageId}
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
                        <span>Cut to move pages</span>
                        <Tooltip text="Create page" position="top">
                            <button
                                onClick={() => onEditPage?.(null)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors hover:shadow-md"
                            >
                                <Plus className="w-3 h-3 inline mr-1" />
                                New Page
                            </button>
                        </Tooltip>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TreePageManager 